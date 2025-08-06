import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

export class BackendStack {
  public cluster: aws.ecs.Cluster;
  public service: awsx.ecs.FargateService;
  public taskDefinition: awsx.ecs.FargateTaskDefinition;
  public targetGroup: aws.lb.TargetGroup;

  constructor(
    name: string,
    vpcId: pulumi.Output<string>,
    privateSubnetIds: pulumi.Output<string>[],
    securityGroupId: pulumi.Output<string>,
    dbSecret: aws.secretsmanager.Secret,
    redisSecret: aws.secretsmanager.Secret,
    cloudFrontUrl: pulumi.Output<string>
  ) {
    const config = new pulumi.Config();

    // Create ECS cluster
    this.cluster = new aws.ecs.Cluster(`${name}-cluster`, {
      name: `${name}-cluster`,
      settings: [{
        name: "containerInsights",
        value: "enabled",
      }],
      tags: {
        Name: `${name}-cluster`,
        Environment: pulumi.getStack(),
      },
    });

    // Create CloudWatch log group for container logs
    const logGroup = new aws.cloudwatch.LogGroup(`${name}-backend-logs`, {
      name: `/ecs/${name}-backend`,
      retentionInDays: 7,
      tags: {
        Name: `${name}-backend-logs`,
        Environment: pulumi.getStack(),
      },
    });

    // Create ECR repository
    const repo = new aws.ecr.Repository(`${name}-backend-repo`, {
      name: `${name}-backend`,
      imageScanningConfiguration: {
        scanOnPush: true,
      },
      imageTagMutability: "MUTABLE",
      tags: {
        Name: `${name}-backend-repo`,
        Environment: pulumi.getStack(),
      },
    });

    // Create ECR lifecycle policy to keep only last 10 images
    new aws.ecr.LifecyclePolicy(`${name}-backend-repo-policy`, {
      repository: repo.name,
      policy: JSON.stringify({
        rules: [{
          rulePriority: 1,
          description: "Keep last 10 images",
          selection: {
            tagStatus: "any",
            countType: "imageCountMoreThan",
            countNumber: 10,
          },
          action: {
            type: "expire",
          },
        }],
      }),
    });

    // Create execution role for ECS task
    const executionRole = new aws.iam.Role(`${name}-backend-execution-role`, {
      assumeRolePolicy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [{
          Action: "sts:AssumeRole",
          Effect: "Allow",
          Principal: {
            Service: "ecs-tasks.amazonaws.com",
          },
        }],
      }),
      tags: {
        Name: `${name}-backend-execution-role`,
        Environment: pulumi.getStack(),
      },
    });

    // Attach policies to execution role
    new aws.iam.RolePolicyAttachment(`${name}-backend-execution-role-policy`, {
      role: executionRole.name,
      policyArn: "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy",
    });

    // Create task role for ECS task
    const taskRole = new aws.iam.Role(`${name}-backend-task-role`, {
      assumeRolePolicy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [{
          Action: "sts:AssumeRole",
          Effect: "Allow",
          Principal: {
            Service: "ecs-tasks.amazonaws.com",
          },
        }],
      }),
      tags: {
        Name: `${name}-backend-task-role`,
        Environment: pulumi.getStack(),
      },
    });

    // Allow task to read secrets
    new aws.iam.RolePolicy(`${name}-backend-secrets-policy`, {
      role: taskRole.name,
      policy: pulumi.all([dbSecret.arn, redisSecret.arn]).apply(([dbArn, redisArn]) =>
        JSON.stringify({
          Version: "2012-10-17",
          Statement: [{
            Effect: "Allow",
            Action: [
              "secretsmanager:GetSecretValue",
              "secretsmanager:DescribeSecret",
            ],
            Resource: [dbArn, redisArn],
          }],
        })
      ),
    });

    // Create task definition
    this.taskDefinition = new awsx.ecs.FargateTaskDefinition(`${name}-backend-task`, {
      cpu: config.get("backendCpu") || "512",
      memory: config.get("backendMemory") || "1024",
      executionRole: executionRole,
      taskRole: taskRole,
      networkMode: "awsvpc",
      requiresCompatibilities: ["FARGATE"],
      container: {
        name: "backend",
        image: repo.repositoryUrl,
        portMappings: [{
          containerPort: 5001,
          protocol: "tcp",
        }],
        environment: [
          { name: "NODE_ENV", value: "production" },
          { name: "PORT", value: "5001" },
          { name: "CORS_ORIGIN", value: cloudFrontUrl },
        ],
        secrets: [
          {
            name: "DB_SECRET",
            valueFrom: dbSecret.arn,
          },
          {
            name: "REDIS_SECRET",
            valueFrom: redisSecret.arn,
          },
        ],
        logConfiguration: {
          logDriver: "awslogs",
          options: {
            "awslogs-group": logGroup.name,
            "awslogs-region": aws.getRegion().then(r => r.name),
            "awslogs-stream-prefix": "backend",
          },
        },
        healthCheck: {
          command: ["CMD-SHELL", "curl -f http://localhost:5001/api/health || exit 1"],
          interval: 30,
          timeout: 5,
          retries: 3,
          startPeriod: 60,
        },
      },
    });

    // Create target group for ALB
    this.targetGroup = new aws.lb.TargetGroup(`${name}-backend-tg`, {
      name: `${name}-backend-tg`,
      port: 5001,
      protocol: "HTTP",
      vpcId: vpcId,
      targetType: "ip",
      healthCheck: {
        enabled: true,
        path: "/api/health",
        protocol: "HTTP",
        matcher: "200",
        interval: 30,
        timeout: 5,
        healthyThreshold: 2,
        unhealthyThreshold: 3,
      },
      deregistrationDelay: 30,
      tags: {
        Name: `${name}-backend-tg`,
        Environment: pulumi.getStack(),
      },
    });

    // Create Fargate service (single task)
    this.service = new awsx.ecs.FargateService(`${name}-backend-service`, {
      cluster: this.cluster.arn,
      taskDefinition: this.taskDefinition.taskDefinition.arn,
      desiredCount: 1, // Single task as requested
      assignPublicIp: false,
      subnets: privateSubnetIds,
      securityGroups: [securityGroupId],
      loadBalancers: [{
        targetGroupArn: this.targetGroup.arn,
        containerName: "backend",
        containerPort: 5001,
      }],
      enableEcsManagedTags: true,
      propagateTags: "SERVICE",
      platformVersion: "LATEST",
      deploymentConfiguration: {
        maximumPercent: 200,
        minimumHealthyPercent: 100,
      },
      tags: {
        Name: `${name}-backend-service`,
        Environment: pulumi.getStack(),
      },
    });
  }
} 