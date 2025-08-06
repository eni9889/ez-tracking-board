# 🚀 Deployment Instructions - EZ Tracking Board

This guide walks you through deploying the EZ Tracking Board application to AWS using Pulumi and GitHub Actions.

## 📋 Prerequisites

Before starting, ensure you have:

1. **AWS Account** with appropriate permissions
2. **GitHub Repository** with the code
3. **Pulumi Account** (free tier is sufficient)
4. **Domain Name** (optional, for custom domain)

## 🔧 Initial Setup

### 1. AWS Setup

#### Create IAM User for Deployment
```bash
# Create a user with programmatic access
aws iam create-user --user-name ez-tracking-deploy

# Attach necessary policies (adjust based on your security requirements)
aws iam attach-user-policy --user-name ez-tracking-deploy --policy-arn arn:aws:iam::aws:policy/PowerUserAccess

# Create access keys
aws iam create-access-key --user-name ez-tracking-deploy
```

Save the `AccessKeyId` and `SecretAccessKey` for GitHub secrets.

### 2. Pulumi Setup

1. **Create Pulumi Account**: Sign up at [pulumi.com](https://app.pulumi.com/signup)

2. **Get Access Token**:
   - Go to Settings → Access Tokens
   - Create new token named "GitHub Actions"
   - Save the token for GitHub secrets

3. **Install Pulumi CLI** (for local testing):
```bash
# macOS
brew install pulumi

# Linux/WSL
curl -fsSL https://get.pulumi.com | sh
```

### 3. GitHub Repository Setup

#### Configure GitHub Secrets

Go to your repository → Settings → Secrets and variables → Actions, then add:

| Secret Name | Description | Example Value |
|-------------|-------------|---------------|
| `AWS_ACCESS_KEY_ID` | AWS IAM user access key | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM user secret key | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| `PULUMI_ACCESS_TOKEN` | Pulumi access token | `pul-abc123...` |
| `BACKEND_URL` | (Set after first deploy) | `http://alb-dns.region.elb.amazonaws.com` |

#### Create Production Branch
```bash
# Create production branch
git checkout -b production
git push -u origin production
```

### 4. Local Environment Setup (Optional)

For local testing and debugging:

```bash
# Clone repository
git clone https://github.com/yourusername/ez-tracking-board.git
cd ez-tracking-board

# Install dependencies
npm install
cd server && npm install
cd ../pulumi && npm install

# Configure AWS CLI
aws configure

# Login to Pulumi
pulumi login

# Select/create stack
cd pulumi
pulumi stack init production
```

## 🚀 First Deployment

### Step 1: Configure Pulumi Stack

1. **Update Configuration** in `pulumi/Pulumi.production.yaml`:
```yaml
config:
  aws:region: us-east-1  # Change if needed
  ez-tracking-board:environment: production
  ez-tracking-board:dbInstanceClass: db.t3.micro
  ez-tracking-board:dbAllocatedStorage: 20
  ez-tracking-board:redisNodeType: cache.t3.micro
  ez-tracking-board:backendCpu: 512
  ez-tracking-board:backendMemory: 1024
  ez-tracking-board:domainName: ""  # Add your domain if you have one
```

2. **Commit and Push**:
```bash
git add pulumi/Pulumi.production.yaml
git commit -m "Configure production environment"
git push origin main
```

### Step 2: Deploy Infrastructure

1. **Merge to Production Branch**:
```bash
git checkout production
git merge main
git push origin production
```

2. **Monitor GitHub Actions**:
   - Go to Actions tab in GitHub
   - Watch the "Deploy to Production" workflow
   - First deployment will take 15-20 minutes

3. **Get Output Values**:
   After successful deployment, get the URLs from GitHub Actions logs or Pulumi console:
   - Frontend URL (CloudFront)
   - Backend URL (ALB)
   - ECR Repository URL

### Step 3: Update Backend URL

1. **Add Backend URL to GitHub Secrets**:
   - Copy the ALB URL from deployment output
   - Add as `BACKEND_URL` secret in GitHub

2. **Trigger Rebuild**:
   - Re-run the deployment workflow
   - This will rebuild frontend with correct API URL

## 📦 Application Updates

### Frontend Updates

For frontend changes:
```bash
# Make changes to React code
git add .
git commit -m "Update frontend"
git push origin main

# Merge to production
git checkout production
git merge main
git push origin production
```

The workflow will:
1. Build React app with production API URL
2. Upload to S3
3. Invalidate CloudFront cache

### Backend Updates

For backend changes:
```bash
# Make changes to Node.js code
git add .
git commit -m "Update backend"
git push origin main

# Merge to production
git checkout production
git merge main
git push origin production
```

The workflow will:
1. Build new Docker image
2. Push to ECR
3. Update ECS service
4. Wait for healthy deployment

### Database Migrations

For database schema changes:

1. **Create Migration Script**:
```typescript
// server/src/migrations/001_add_new_table.ts
export async function up(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE new_table (
      id SERIAL PRIMARY KEY,
      ...
    )
  `);
}
```

2. **Run Migration**:
   - Add migration runner to your deployment
   - Or connect to RDS and run manually

## 🔍 Monitoring & Troubleshooting

### View Logs

#### CloudWatch Logs
```bash
# View ECS logs
aws logs tail /ecs/ez-tracking-backend --follow

# View specific time range
aws logs filter-log-events \
  --log-group-name /ecs/ez-tracking-backend \
  --start-time $(date -u -d '1 hour ago' +%s)000
```

#### ECS Service Status
```bash
# Check service status
aws ecs describe-services \
  --cluster ez-tracking-cluster \
  --services ez-tracking-backend-service

# View running tasks
aws ecs list-tasks \
  --cluster ez-tracking-cluster \
  --service-name ez-tracking-backend-service
```

### Common Issues

#### 1. ECS Task Failing to Start
- Check CloudWatch logs for errors
- Verify database connectivity
- Ensure secrets are properly configured

#### 2. Frontend Not Updating
- Check CloudFront invalidation status
- Clear browser cache
- Verify S3 upload completed

#### 3. Database Connection Issues
- Check security group rules
- Verify RDS is running
- Test connection from ECS subnet

#### 4. High Costs
- Review CloudWatch metrics
- Check for unused resources
- Consider using Reserved Instances

## 🔒 Security Best Practices

1. **Secrets Management**:
   - Never commit secrets to Git
   - Rotate AWS access keys regularly
   - Use IAM roles where possible

2. **Network Security**:
   - Keep RDS in private subnets
   - Restrict security group rules
   - Enable VPC Flow Logs

3. **Application Security**:
   - Keep dependencies updated
   - Enable AWS GuardDuty
   - Regular security scans

## 🛑 Rollback Procedures

### Quick Rollback

1. **Via GitHub**:
   - Go to Actions → Select failed deployment
   - Click "Re-run jobs" on previous successful deployment

2. **Via AWS Console**:
   - ECS → Select service
   - Update service → Force new deployment
   - Select previous task definition revision

### Database Rollback

1. **From Snapshot**:
```bash
# List available snapshots
aws rds describe-db-snapshots \
  --db-instance-identifier ez-tracking-db

# Restore from snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier ez-tracking-db-restore \
  --db-snapshot-identifier <snapshot-id>
```

## 📊 Scaling

### Horizontal Scaling

1. **Increase ECS Tasks**:
   - Update `desiredCount` in Pulumi config
   - Deploy changes

2. **Enable Auto-scaling**:
   - Add auto-scaling policies in Pulumi
   - Based on CPU/memory metrics

### Vertical Scaling

1. **Increase Instance Sizes**:
   - Update instance types in Pulumi config
   - Plan for brief downtime for RDS

## 🗑️ Cleanup

To completely remove all resources:

```bash
# Destroy Pulumi stack
cd pulumi
pulumi destroy --yes

# Remove GitHub secrets
# (Do this manually in GitHub UI)

# Delete Pulumi stack
pulumi stack rm production
```

## 📞 Support & Maintenance

### Regular Maintenance

1. **Weekly**:
   - Review CloudWatch metrics
   - Check for security updates

2. **Monthly**:
   - Update dependencies
   - Review AWS costs
   - Backup verification

3. **Quarterly**:
   - Security audit
   - Performance optimization
   - Disaster recovery test

### Getting Help

1. **AWS Support**: Use AWS Support Center
2. **Pulumi Community**: [community.pulumi.com](https://community.pulumi.com)
3. **GitHub Issues**: Track in your repository

---

🎉 **Congratulations!** Your EZ Tracking Board is now deployed to AWS with automated CI/CD! 