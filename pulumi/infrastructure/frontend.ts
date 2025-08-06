import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

export class FrontendStack {
  public bucket: aws.s3.Bucket;
  public distribution: aws.cloudfront.Distribution;
  public bucketName: pulumi.Output<string>;
  public cloudFrontUrl: pulumi.Output<string>;

  constructor(name: string) {
    const config = new pulumi.Config();

    // Create S3 bucket for static website hosting
    this.bucket = new aws.s3.Bucket(`${name}-frontend`, {
      website: {
        indexDocument: "index.html",
        errorDocument: "index.html", // For React SPA routing
      },
      corsRules: [
        {
          allowedHeaders: ["*"],
          allowedMethods: ["GET", "HEAD"],
          allowedOrigins: ["*"],
          maxAgeSeconds: 3000,
        },
      ],
      tags: {
        Name: `${name}-frontend`,
        Environment: pulumi.getStack(),
      },
    });

    // Create bucket public access block (keeping bucket private)
    const bucketPab = new aws.s3.BucketPublicAccessBlock(`${name}-frontend-pab`, {
      bucket: this.bucket.id,
      blockPublicAcls: true,
      blockPublicPolicy: true,
      ignorePublicAcls: true,
      restrictPublicBuckets: true,
    });

    // Create CloudFront Origin Access Identity
    const originAccessIdentity = new aws.cloudfront.OriginAccessIdentity(`${name}-oai`, {
      comment: `OAI for ${name} frontend`,
    });

    // Create bucket policy to allow CloudFront access
    const bucketPolicy = new aws.s3.BucketPolicy(`${name}-frontend-policy`, {
      bucket: this.bucket.id,
      policy: pulumi.all([this.bucket.arn, originAccessIdentity.iamArn]).apply(([bucketArn, oaiArn]) =>
        JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Principal: {
                AWS: oaiArn,
              },
              Action: "s3:GetObject",
              Resource: `${bucketArn}/*`,
            },
          ],
        })
      ),
    }, { dependsOn: [bucketPab] });

    // Create CloudFront distribution
    this.distribution = new aws.cloudfront.Distribution(`${name}-cdn`, {
      enabled: true,
      isIpv6Enabled: true,
      comment: `CloudFront distribution for ${name}`,
      defaultRootObject: "index.html",
      
      origins: [
        {
          domainName: this.bucket.bucketRegionalDomainName,
          originId: this.bucket.id,
          s3OriginConfig: {
            originAccessIdentity: originAccessIdentity.cloudfrontAccessIdentityPath,
          },
        },
      ],

      defaultCacheBehavior: {
        targetOriginId: this.bucket.id,
        viewerProtocolPolicy: "redirect-to-https",
        allowedMethods: ["GET", "HEAD", "OPTIONS"],
        cachedMethods: ["GET", "HEAD", "OPTIONS"],
        compress: true,
        minTtl: 0,
        defaultTtl: 3600,
        maxTtl: 86400,
        
        forwardedValues: {
          queryString: false,
          cookies: {
            forward: "none",
          },
        },
      },

      // Custom error pages for SPA routing
      customErrorResponses: [
        {
          errorCode: 403,
          responseCode: 200,
          responsePagePath: "/index.html",
          errorCachingMinTtl: 300,
        },
        {
          errorCode: 404,
          responseCode: 200,
          responsePagePath: "/index.html",
          errorCachingMinTtl: 300,
        },
      ],

      priceClass: "PriceClass_100", // Use only North America and Europe edge locations

      restrictions: {
        geoRestriction: {
          restrictionType: "none",
        },
      },

      viewerCertificate: {
        cloudfrontDefaultCertificate: true,
      },

      tags: {
        Name: `${name}-cdn`,
        Environment: pulumi.getStack(),
      },
    });

    this.bucketName = this.bucket.id;
    this.cloudFrontUrl = pulumi.interpolate`https://${this.distribution.domainName}`;
  }

  // Create invalidation for CloudFront distribution
  createInvalidation(name: string, paths: string[]): aws.cloudfront.Invalidation {
    return new aws.cloudfront.Invalidation(`${name}-invalidation-${Date.now()}`, {
      distributionId: this.distribution.id,
      paths: paths,
    });
  }
} 