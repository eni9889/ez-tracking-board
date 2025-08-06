import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

export class RedisStack {
  public redisCluster: aws.elasticache.ReplicationGroup;
  public redisEndpoint: pulumi.Output<string>;
  public redisPort: pulumi.Output<number>;

  constructor(
    name: string,
    vpcId: pulumi.Output<string>,
    subnetIds: pulumi.Output<string>[],
    securityGroupId: pulumi.Output<string>
  ) {
    const config = new pulumi.Config();

    // Create subnet group for Redis
    const redisSubnetGroup = new aws.elasticache.SubnetGroup(`${name}-redis-subnet-group`, {
      subnetIds: subnetIds,
      description: "Subnet group for ElastiCache Redis",
      tags: {
        Name: `${name}-redis-subnet-group`,
        Environment: pulumi.getStack(),
      },
    });

    // Create Redis replication group (single node)
    this.redisCluster = new aws.elasticache.ReplicationGroup(`${name}-redis`, {
      replicationGroupId: `${name}-redis`,
      description: "Redis for session management and job queue",
      
      engine: "redis",
      engineVersion: "7.0",
      nodeType: config.get("redisNodeType") || "cache.t3.micro",
      
      // Single node configuration
      numCacheClusters: 1,
      automaticFailoverEnabled: false,
      
      // Network configuration
      subnetGroupName: redisSubnetGroup.name,
      securityGroupIds: [securityGroupId],
      
      // Redis configuration
      port: 6379,
      parameterGroupName: "default.redis7",
      
      // Encryption
      atRestEncryptionEnabled: true,
      transitEncryptionEnabled: true,
      authToken: pulumi.secret(this.generateAuthToken()),
      
      // Maintenance and backup
      maintenanceWindow: "sun:05:00-sun:06:00",
      snapshotRetentionLimit: 5,
      snapshotWindow: "03:00-05:00",
      
      // Logging
      logDeliveryConfigurations: [
        {
          destinationType: "cloudwatch-logs",
          logFormat: "json",
          logType: "slow-log",
        },
      ],
      
      tags: {
        Name: `${name}-redis`,
        Environment: pulumi.getStack(),
      },
    });

    this.redisEndpoint = this.redisCluster.primaryEndpointAddress;
    this.redisPort = this.redisCluster.port.apply(p => p || 6379);
  }

  private generateAuthToken(): string {
    // Generate a random auth token for Redis
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let token = '';
    for (let i = 0; i < 32; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }

  // Store Redis credentials in Secrets Manager
  createRedisSecret(name: string): aws.secretsmanager.Secret {
    const secret = new aws.secretsmanager.Secret(`${name}-redis-secret`, {
      description: "ElastiCache Redis connection details",
      tags: {
        Name: `${name}-redis-secret`,
        Environment: pulumi.getStack(),
      },
    });

    new aws.secretsmanager.SecretVersion(`${name}-redis-secret-version`, {
      secretId: secret.id,
      secretString: pulumi.interpolate`{
        "host": "${this.redisEndpoint}",
        "port": ${this.redisPort},
        "auth_token": "${this.redisCluster.authToken}",
        "tls": true
      }`,
    });

    return secret;
  }
} 