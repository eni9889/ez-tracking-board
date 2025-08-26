# DigitalOcean App Platform Deployment Guide

This guide explains how to deploy the EZ Tracking Board application to DigitalOcean App Platform using the provided configuration.

## Overview

The DigitalOcean App Platform deployment mirrors the Docker Compose setup with the following services:

- **Frontend**: React static site (served via CDN)
- **Backend**: Node.js API service (2 instances for high availability)
- **Worker**: Background job processor (1 instance)
- **Bull Board**: Job monitoring dashboard (optional)
- **PostgreSQL**: Managed database (14.x)
- **Redis**: Managed cache (7.x)

## Prerequisites

1. DigitalOcean account with billing enabled
2. GitHub repository with your code
3. Claude API key for AI functionality
4. Domain name (optional, for custom domain)

## Deployment Steps

### 1. Prepare Your Repository

Ensure your code is pushed to a GitHub repository and the main branch is ready for deployment.

### 2. Update App Configuration

1. Open `.do/app.yaml`
2. Update the following fields:
   ```yaml
   github:
     repo: your-github-username/ez-tracking-board  # Replace with your repo
     branch: main  # Or your production branch
   ```
3. If using a custom domain, update the domains section:
   ```yaml
   domains:
     - domain: your-domain.com  # Replace with your domain
       type: PRIMARY
   ```

### 3. Deploy to DigitalOcean

#### Option A: Using DigitalOcean Console

1. Log into [DigitalOcean Console](https://cloud.digitalocean.com/)
2. Navigate to "Apps" in the left sidebar
3. Click "Create App"
4. Choose "Import from App Spec" option
5. Upload the `.do/app.yaml` file
6. Review the configuration and click "Next"
7. Connect your GitHub account and authorize repository access
8. Review resource allocation and pricing
9. Click "Create Resources"

#### Option B: Using doctl CLI

1. Install doctl CLI:
   ```bash
   # macOS
   brew install doctl
   
   # Linux
   curl -sL https://github.com/digitalocean/doctl/releases/download/v1.98.1/doctl-1.98.1-linux-amd64.tar.gz | tar -xzv
   sudo mv doctl /usr/local/bin
   ```

2. Authenticate with DigitalOcean:
   ```bash
   doctl auth init
   ```

3. Create the app:
   ```bash
   doctl apps create --spec .do/app.yaml
   ```

### 4. Configure Environment Variables

After deployment, set up the required environment variables in the DigitalOcean console:

1. Go to your app in the DigitalOcean console
2. Click on "Settings" tab
3. Navigate to "App-Level Environment Variables"
4. Add the following SECRET variables:
   - `CLAUDE_API_KEY`: Your Claude API key

### 5. Database Setup

The managed PostgreSQL database will be automatically created. The app will connect using the environment variables automatically injected by DigitalOcean.

If you need to initialize the database with schemas:

1. Use the console connection string to connect via psql
2. Run any necessary migration scripts
3. Or use a database migration tool in your application startup

### 6. Verify Deployment

After deployment completes (usually 5-10 minutes):

1. Check that all services are running in the DigitalOcean console
2. Visit your app URL to test the frontend
3. Test API endpoints at `https://your-app-url/api/health`
4. Check job monitoring at `https://your-app-url/bull-board` (if enabled)

## Configuration Details

### Service Specifications

| Service | Type | Instances | Size | Purpose |
|---------|------|-----------|------|---------|
| Frontend | Static Site | - | - | React application served via CDN |
| Backend | Service | 2 | basic-xxs | API server with load balancing |
| Worker | Worker | 1 | basic-xxs | Background job processing |
| Bull Board | Service | 1 | basic-xxs | Job queue monitoring |
| PostgreSQL | Database | 1 | db-s-1vcpu-1gb | Primary data storage |
| Redis | Database | 1 | db-s-1vcpu-1gb | Cache and job queue |

### Resource Costs (Estimated)

- **Frontend (Static Site)**: $0 (included in plan)
- **Backend (2x basic-xxs)**: ~$12/month
- **Worker (1x basic-xxs)**: ~$6/month
- **Bull Board (1x basic-xxs)**: ~$6/month
- **PostgreSQL (db-s-1vcpu-1gb)**: ~$15/month
- **Redis (db-s-1vcpu-1gb)**: ~$15/month

**Total Estimated Cost**: ~$54/month

### Health Checks and Monitoring

The configuration includes:

- **HTTP Health Checks**: Backend and Bull Board services
- **Automatic Restarts**: Failed services are automatically restarted
- **Alerts**: CPU, memory, and restart count monitoring
- **Load Balancing**: Round-robin distribution for backend services

## Scaling Considerations

### Vertical Scaling
Upgrade instance sizes for more CPU/memory:
- `basic-xxs` → `basic-xs` → `basic-s` → `basic-m`

### Horizontal Scaling
Increase instance counts:
```yaml
services:
  - name: backend
    instance_count: 3  # Scale up API servers
  - name: worker
    instance_count: 2  # Scale up workers for more job processing
```

### Database Scaling
Upgrade database sizes:
- `db-s-1vcpu-1gb` → `db-s-1vcpu-2gb` → `db-s-2vcpu-4gb`

## Environment Variables Reference

### Automatically Injected by DigitalOcean

| Variable | Source | Description |
|----------|--------|-------------|
| `DB_HOST` | ${db.HOSTNAME} | PostgreSQL hostname |
| `DB_PORT` | ${db.PORT} | PostgreSQL port |
| `DB_NAME` | ${db.DATABASE} | Database name |
| `DB_USER` | ${db.USERNAME} | Database username |
| `DB_PASSWORD` | ${db.PASSWORD} | Database password |
| `DATABASE_URL` | ${db.DATABASE_URL} | Full PostgreSQL connection string |
| `REDIS_HOST` | ${redis.HOSTNAME} | Redis hostname |
| `REDIS_PORT` | ${redis.PORT} | Redis port |
| `REDIS_PASSWORD` | ${redis.PASSWORD} | Redis password |
| `REDIS_URL` | ${redis.DATABASE_URL} | Full Redis connection string |
| `REACT_APP_API_URL` | ${backend.PUBLIC_URL} | Backend API URL for frontend |
| `CORS_ORIGIN` | ${frontend.PUBLIC_URL} | Frontend URL for CORS |

### Manually Configured

| Variable | Type | Description |
|----------|------|-------------|
| `CLAUDE_API_KEY` | SECRET | API key for Claude AI integration |

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Check build logs in DigitalOcean console
   - Verify all dependencies are in package.json
   - Ensure TypeScript compiles successfully

2. **Database Connection Issues**
   - Verify database service is running
   - Check environment variable injection
   - Review connection string format

3. **Frontend Not Loading**
   - Check that build command succeeds
   - Verify output_dir is correct (build)
   - Check routes configuration

4. **API Endpoints Not Working**
   - Verify backend service is healthy
   - Check health check endpoint
   - Review CORS configuration

### Logs and Debugging

1. **View Application Logs**:
   ```bash
   doctl apps logs your-app-id --follow
   ```

2. **View Specific Service Logs**:
   ```bash
   doctl apps logs your-app-id --component backend --follow
   ```

3. **Check Service Status**:
   ```bash
   doctl apps get your-app-id
   ```

## Maintenance

### Updates and Deployments

The app is configured for automatic deployment on push to the main branch. To deploy:

1. Push changes to your main branch
2. DigitalOcean will automatically detect changes
3. New deployment will start automatically
4. Zero-downtime deployment for services

### Database Backups

DigitalOcean automatically backs up managed databases:
- **Daily backups** retained for 7 days
- **Point-in-time recovery** available
- Manual backups can be triggered from console

### Monitoring

Monitor your app through:
- DigitalOcean console dashboard
- Built-in alerts for CPU, memory, and restarts
- Bull Board for job queue monitoring
- Application logs via doctl or console

## Security Considerations

1. **Environment Variables**: Sensitive data stored as encrypted secrets
2. **Database Security**: Managed databases include SSL/TLS encryption
3. **Network Security**: Private networking between services
4. **Access Control**: Service-to-service communication over private network
5. **HTTPS**: Automatic SSL certificates for custom domains

## Custom Domain Setup

1. **Add Domain to App**:
   - Update domains section in app.yaml
   - Or add through DigitalOcean console

2. **Configure DNS**:
   - Point your domain to DigitalOcean nameservers
   - Or create CNAME record pointing to app URL

3. **SSL Certificate**:
   - Automatically provisioned by DigitalOcean
   - Includes auto-renewal

## Backup and Disaster Recovery

1. **Code**: Stored in GitHub repository
2. **Database**: Automatic daily backups
3. **Environment Variables**: Document in secure location
4. **App Configuration**: Store app.yaml in version control

### Recovery Process

1. Redeploy from GitHub repository
2. Restore database from backup if needed
3. Reconfigure environment variables
4. Update DNS if using custom domain

## Support

For issues related to:
- **DigitalOcean Platform**: Contact DigitalOcean support
- **Application Code**: Check application logs and GitHub issues
- **Third-party Services**: Contact respective service providers (Claude AI, etc.)
