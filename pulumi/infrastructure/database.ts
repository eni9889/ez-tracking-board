import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as random from "@pulumi/random";

export class DatabaseStack {
  public dbInstance: aws.rds.Instance;
  public dbEndpoint: pulumi.Output<string>;
  public dbPassword: pulumi.Output<string>;

  constructor(
    name: string,
    vpcId: pulumi.Output<string>,
    subnetIds: pulumi.Output<string>[],
    securityGroupId: pulumi.Output<string>
  ) {
    const config = new pulumi.Config();
    
    // Create random password for database
    const dbPassword = new random.RandomPassword(`${name}-db-password`, {
      length: 32,
      special: true,
      overrideSpecial: "!#$%&*()-_=+[]{}<>:?",
    });

    // Create DB subnet group
    const dbSubnetGroup = new aws.rds.SubnetGroup(`${name}-db-subnet-group`, {
      subnetIds: subnetIds,
      tags: {
        Name: `${name}-db-subnet-group`,
        Environment: pulumi.getStack(),
      },
    });

    // Create RDS instance (Single AZ)
    this.dbInstance = new aws.rds.Instance(`${name}-db`, {
      engine: "postgres",
      engineVersion: "14.9",
      instanceClass: config.get("dbInstanceClass") || "db.t3.micro",
      allocatedStorage: config.getNumber("dbAllocatedStorage") || 20,
      storageType: "gp3",
      storageEncrypted: true,
      
      dbName: "vital_signs_tracking",
      username: "postgres",
      password: dbPassword.result,
      
      vpcSecurityGroupIds: [securityGroupId],
      dbSubnetGroupName: dbSubnetGroup.name,
      
      // Single AZ deployment
      multiAz: false,
      
      // Backup configuration
      backupRetentionPeriod: 7,
      backupWindow: "03:00-04:00",
      maintenanceWindow: "sun:04:00-sun:05:00",
      
      // Enable automated minor version upgrades
      autoMinorVersionUpgrade: true,
      
      // Performance Insights
      performanceInsightsEnabled: true,
      performanceInsightsRetentionPeriod: 7,
      
      // Final snapshot
      skipFinalSnapshot: false,
      finalSnapshotIdentifier: `${name}-db-final-snapshot-${Date.now()}`,
      
      tags: {
        Name: `${name}-db`,
        Environment: pulumi.getStack(),
      },
    });

    this.dbEndpoint = this.dbInstance.endpoint;
    this.dbPassword = dbPassword.result;
  }

  // Store database credentials in Secrets Manager
  createDatabaseSecret(name: string): aws.secretsmanager.Secret {
    const secret = new aws.secretsmanager.Secret(`${name}-db-secret`, {
      description: "RDS PostgreSQL database credentials",
      tags: {
        Name: `${name}-db-secret`,
        Environment: pulumi.getStack(),
      },
    });

    new aws.secretsmanager.SecretVersion(`${name}-db-secret-version`, {
      secretId: secret.id,
      secretString: pulumi.interpolate`{
        "username": "${this.dbInstance.username}",
        "password": "${this.dbPassword}",
        "engine": "postgres",
        "host": "${this.dbInstance.address}",
        "port": ${this.dbInstance.port},
        "dbname": "${this.dbInstance.dbName}"
      }`,
    });

    return secret;
  }
} 