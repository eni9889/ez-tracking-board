import * as pulumi from "@pulumi/pulumi";
import { NetworkingStack } from "./infrastructure/vpc";
import { DatabaseStack } from "./infrastructure/database";
import { RedisStack } from "./infrastructure/redis";
import { FrontendStack } from "./infrastructure/frontend";
import { BackendStack } from "./infrastructure/backend";
import { LoadBalancerStack } from "./infrastructure/alb";

// Get the stack name
const stackName = pulumi.getStack();
const projectName = "ez-tracking";

// Create networking infrastructure
const networking = new NetworkingStack(projectName);

// Create security groups
const albSecurityGroup = networking.createAlbSecurityGroup(projectName);
const ecsSecurityGroup = networking.createEcsSecurityGroup(projectName, albSecurityGroup);
const rdsSecurityGroup = networking.createRdsSecurityGroup(projectName, ecsSecurityGroup);
const redisSecurityGroup = networking.createRedisSecurityGroup(projectName, ecsSecurityGroup);

// Create database
const database = new DatabaseStack(
  projectName,
  networking.vpcId,
  networking.privateSubnetIds,
  rdsSecurityGroup.id
);

// Create Redis
const redis = new RedisStack(
  projectName,
  networking.vpcId,
  networking.privateSubnetIds,
  redisSecurityGroup.id
);

// Create secrets in Secrets Manager
const dbSecret = database.createDatabaseSecret(projectName);
const redisSecret = redis.createRedisSecret(projectName);

// Create frontend infrastructure (S3 + CloudFront)
const frontend = new FrontendStack(projectName);

// Create backend infrastructure (ECS)
const backend = new BackendStack(
  projectName,
  networking.vpcId,
  networking.privateSubnetIds,
  ecsSecurityGroup.id,
  dbSecret,
  redisSecret,
  frontend.cloudFrontUrl
);

// Create Application Load Balancer
const loadBalancer = new LoadBalancerStack(
  projectName,
  networking.vpcId,
  networking.publicSubnetIds,
  albSecurityGroup.id,
  backend.targetGroup.arn
);

// Export important values
export const vpcId = networking.vpcId;
export const frontendUrl = frontend.cloudFrontUrl;
export const frontendBucketName = frontend.bucketName;
export const backendUrl = loadBalancer.albUrl;
export const ecrRepositoryUrl = backend.taskDefinition.containers.apply(c => c?.backend?.image || "");
export const dbEndpoint = database.dbEndpoint;
export const redisEndpoint = redis.redisEndpoint;
export const ecsClusterName = backend.cluster.name;
export const ecsServiceName = backend.service.service.name;

// Output instructions
export const deploymentInstructions = pulumi.all([
  frontend.cloudFrontUrl,
  loadBalancer.albUrl,
  backend.taskDefinition.containers
]).apply(([cfUrl, albUrl, containers]) => {
  return `
Deployment Complete! 🎉

Frontend URL: ${cfUrl}
Backend API URL: ${albUrl}

Next Steps:
1. Build and push your backend Docker image to ECR
2. Build your React app with REACT_APP_API_URL=${albUrl}
3. Deploy frontend files to S3
4. Update your DNS records if using a custom domain

For detailed deployment instructions, see the GitHub Actions workflows.
`;
}); 