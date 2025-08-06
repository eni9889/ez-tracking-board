import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

export class NetworkingStack {
  public vpc: awsx.ec2.Vpc;
  public publicSubnetIds: pulumi.Output<string>[];
  public privateSubnetIds: pulumi.Output<string>[];
  public vpcId: pulumi.Output<string>;

  constructor(name: string) {
    // Create VPC with public and private subnets across 2 AZs
    this.vpc = new awsx.ec2.Vpc(`${name}-vpc`, {
      cidrBlock: "10.0.0.0/16",
      numberOfAvailabilityZones: 2,
      natGateways: {
        strategy: "Single", // Single NAT Gateway to reduce costs
      },
      subnetSpecs: [
        {
          type: awsx.ec2.SubnetType.Public,
          cidrMask: 24,
          name: "public",
        },
        {
          type: awsx.ec2.SubnetType.Private,
          cidrMask: 24,
          name: "private",
        },
      ],
      tags: {
        Name: `${name}-vpc`,
        Environment: pulumi.getStack(),
      },
    });

    this.vpcId = this.vpc.vpcId;
    this.publicSubnetIds = this.vpc.publicSubnetIds;
    this.privateSubnetIds = this.vpc.privateSubnetIds;
  }

  // Create security group for ALB
  createAlbSecurityGroup(name: string): aws.ec2.SecurityGroup {
    return new aws.ec2.SecurityGroup(`${name}-alb-sg`, {
      vpcId: this.vpcId,
      description: "Security group for Application Load Balancer",
      ingress: [
        {
          protocol: "tcp",
          fromPort: 80,
          toPort: 80,
          cidrBlocks: ["0.0.0.0/0"],
          description: "Allow HTTP from anywhere",
        },
        {
          protocol: "tcp",
          fromPort: 443,
          toPort: 443,
          cidrBlocks: ["0.0.0.0/0"],
          description: "Allow HTTPS from anywhere",
        },
      ],
      egress: [
        {
          protocol: "-1",
          fromPort: 0,
          toPort: 0,
          cidrBlocks: ["0.0.0.0/0"],
          description: "Allow all outbound traffic",
        },
      ],
      tags: {
        Name: `${name}-alb-sg`,
        Environment: pulumi.getStack(),
      },
    });
  }

  // Create security group for ECS tasks
  createEcsSecurityGroup(name: string, albSecurityGroup: aws.ec2.SecurityGroup): aws.ec2.SecurityGroup {
    return new aws.ec2.SecurityGroup(`${name}-ecs-sg`, {
      vpcId: this.vpcId,
      description: "Security group for ECS tasks",
      ingress: [
        {
          protocol: "tcp",
          fromPort: 5001,
          toPort: 5001,
          securityGroups: [albSecurityGroup.id],
          description: "Allow traffic from ALB",
        },
      ],
      egress: [
        {
          protocol: "-1",
          fromPort: 0,
          toPort: 0,
          cidrBlocks: ["0.0.0.0/0"],
          description: "Allow all outbound traffic",
        },
      ],
      tags: {
        Name: `${name}-ecs-sg`,
        Environment: pulumi.getStack(),
      },
    });
  }

  // Create security group for RDS
  createRdsSecurityGroup(name: string, ecsSecurityGroup: aws.ec2.SecurityGroup): aws.ec2.SecurityGroup {
    return new aws.ec2.SecurityGroup(`${name}-rds-sg`, {
      vpcId: this.vpcId,
      description: "Security group for RDS PostgreSQL",
      ingress: [
        {
          protocol: "tcp",
          fromPort: 5432,
          toPort: 5432,
          securityGroups: [ecsSecurityGroup.id],
          description: "Allow PostgreSQL from ECS tasks",
        },
      ],
      egress: [
        {
          protocol: "-1",
          fromPort: 0,
          toPort: 0,
          cidrBlocks: ["0.0.0.0/0"],
          description: "Allow all outbound traffic",
        },
      ],
      tags: {
        Name: `${name}-rds-sg`,
        Environment: pulumi.getStack(),
      },
    });
  }

  // Create security group for Redis
  createRedisSecurityGroup(name: string, ecsSecurityGroup: aws.ec2.SecurityGroup): aws.ec2.SecurityGroup {
    return new aws.ec2.SecurityGroup(`${name}-redis-sg`, {
      vpcId: this.vpcId,
      description: "Security group for ElastiCache Redis",
      ingress: [
        {
          protocol: "tcp",
          fromPort: 6379,
          toPort: 6379,
          securityGroups: [ecsSecurityGroup.id],
          description: "Allow Redis from ECS tasks",
        },
      ],
      egress: [
        {
          protocol: "-1",
          fromPort: 0,
          toPort: 0,
          cidrBlocks: ["0.0.0.0/0"],
          description: "Allow all outbound traffic",
        },
      ],
      tags: {
        Name: `${name}-redis-sg`,
        Environment: pulumi.getStack(),
      },
    });
  }
} 