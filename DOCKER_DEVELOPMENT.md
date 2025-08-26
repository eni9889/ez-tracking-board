# Docker Development Guide

This guide explains how to run the EZ Tracking Board application using Docker Compose with the new migration service.

## Architecture Overview

The Docker Compose setup includes the following services:

```
┌─────────────────────────────────────────────────────────────┐
│                    Service Dependencies                     │
├─────────────────────────────────────────────────────────────┤
│ postgres (db) ──┐                                          │
│                 ├─► migrate ──┐                            │
│ redis (cache) ──┘             ├─► backend                  │
│                               ├─► worker                   │
│                               └─► bull-board               │
│                                                             │
│ backend ──────────────────────────► frontend               │
└─────────────────────────────────────────────────────────────┘
```

## Services

### Core Infrastructure
- **postgres** - PostgreSQL 14 database
- **redis** - Redis 7 cache and job queue

### Migration Service
- **migrate** - Runs database migrations once, then exits
  - Depends on: postgres (healthy)
  - Run command: `npm run migrate`
  - Restart policy: `no` (runs once)

### Application Services
- **backend** - Node.js API server (port 5001)
- **worker** - Background job processor
- **bull-board** - Job monitoring dashboard (port 3001)
- **frontend** - React development server (port 3000)

All application services depend on the migration service completing successfully.

### Optional Services (disabled by default)
- **pgadmin** - Database management UI (port 5050)
- **redis-commander** - Redis management UI (port 8081)

## Quick Start

### 1. Environment Setup

Copy the environment example:
```bash
cp env.example .env
```

Add your Claude API key to `.env`:
```bash
CLAUDE_API_KEY=your_claude_api_key_here
```

### 2. Start All Services

```bash
# Start all services (migrations run automatically first)
docker-compose up

# Or start in background
docker-compose up -d

# View logs
docker-compose logs -f
```

### 3. Access the Application

- **Frontend**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:5001](http://localhost:5001)
- **Bull Board**: [http://localhost:3001](http://localhost:3001)

## Development Workflows

### Starting Development

```bash
# Clean start (removes containers and volumes)
docker-compose down -v
docker-compose up

# Start specific services
docker-compose up postgres redis migrate backend

# Start with build (if Dockerfiles changed)
docker-compose up --build
```

### Working with Migrations

```bash
# Create a new migration
docker-compose exec backend npm run migrate:create "add user email" -- --migration-file-language ts

# Run migrations manually (if needed)
docker-compose run --rm migrate

# Check migration status
docker-compose exec backend npm run migrate:dry-run

# Rollback last migration
docker-compose exec backend npm run migrate:down
```

### Debugging Services

```bash
# View logs for specific service
docker-compose logs -f backend
docker-compose logs -f migrate
docker-compose logs -f worker

# Execute commands in running containers
docker-compose exec backend bash
docker-compose exec postgres psql -U postgres -d vital_signs_tracking

# Restart specific service
docker-compose restart backend
```

### Database Management

```bash
# Start with database management tools
docker-compose --profile tools up

# Access pgAdmin: http://localhost:5050
# Email: admin@example.com, Password: admin

# Access Redis Commander: http://localhost:8081
```

## Service Dependencies Explained

### Migration Service Dependencies
```yaml
migrate:
  depends_on:
    postgres:
      condition: service_healthy  # Waits for DB to be ready
```

The migration service waits for PostgreSQL to pass health checks before running.

### Application Service Dependencies
```yaml
backend:
  depends_on:
    postgres:
      condition: service_healthy     # DB must be healthy
    redis:
      condition: service_healthy     # Redis must be healthy  
    migrate:
      condition: service_completed_successfully  # Migrations must complete
```

All application services wait for:
1. PostgreSQL to be healthy
2. Redis to be healthy (if needed)
3. Migration service to complete successfully

## Health Checks

Services have built-in health checks:

```yaml
# PostgreSQL health check
postgres:
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U postgres"]
    interval: 10s
    timeout: 5s
    retries: 5

# Redis health check
redis:
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 10s
    timeout: 5s
    retries: 5
```

## Common Commands

### Service Management
```bash
# Start services
docker-compose up -d

# Stop services  
docker-compose down

# Restart service
docker-compose restart <service-name>

# View service status
docker-compose ps

# View resource usage
docker-compose top
```

### Development Commands
```bash
# Install dependencies (if package.json changes)
docker-compose run --rm backend npm install
docker-compose run --rm frontend npm install

# Run tests
docker-compose run --rm backend npm test
docker-compose run --rm frontend npm test

# Build production assets
docker-compose run --rm frontend npm run build
docker-compose run --rm backend npm run build
```

### Data Management
```bash
# Reset database (removes all data)
docker-compose down -v
docker-compose up

# Backup database
docker-compose exec postgres pg_dump -U postgres vital_signs_tracking > backup.sql

# Restore database  
docker-compose exec -T postgres psql -U postgres vital_signs_tracking < backup.sql
```

## Troubleshooting

### Migration Service Fails

```bash
# Check migration logs
docker-compose logs migrate

# Run migration manually with verbose output
docker-compose run --rm migrate npm run migrate:dry-run

# Reset and try again
docker-compose down -v
docker-compose up postgres redis
docker-compose run --rm migrate
```

### Services Won't Start

```bash
# Check all service status
docker-compose ps

# Check service logs
docker-compose logs <service-name>

# Check health status
docker-compose exec postgres pg_isready -U postgres
docker-compose exec redis redis-cli ping
```

### Port Conflicts

If ports are already in use:

```bash
# Find what's using the port
lsof -i :3000
lsof -i :5001

# Stop other services or change ports in docker-compose.yml
```

### Database Connection Issues

```bash
# Test database connection
docker-compose exec backend npm run migrate:dry-run

# Check database logs
docker-compose logs postgres

# Connect to database directly
docker-compose exec postgres psql -U postgres -d vital_signs_tracking
```

## Environment Variables

### Required Variables
- `CLAUDE_API_KEY` - Claude AI API key for note checking

### Optional Variables
- `DEBUG_AXIOS` - Set to "true" for verbose HTTP logging
- `CHOKIDAR_USEPOLLING` - Set to "true" for file watching in Docker

### Database Variables (set automatically)
- `DB_HOST=postgres`
- `DB_PORT=5432` 
- `DB_NAME=vital_signs_tracking`
- `DB_USER=postgres`
- `DB_PASSWORD=postgres`

## Production Differences

In production deployment:
- No volume mounts (code is built into images)
- Migration service uses production Dockerfile
- Environment variables come from DigitalOcean
- Managed PostgreSQL and Redis services

## Best Practices

### Development Workflow
1. Always start fresh when schema changes: `docker-compose down -v && docker-compose up`
2. Check migration logs if services fail to start
3. Use `docker-compose logs -f` to monitor all services
4. Create migrations before making schema changes

### Debugging Tips
1. Use `docker-compose exec <service> bash` to inspect containers
2. Check health status with `docker-compose ps`
3. Monitor resource usage with `docker-compose top`
4. Use `--profile tools` for database management UIs

### Performance Tips
1. Use `docker-compose up -d` for background execution
2. Use `docker-compose restart <service>` instead of full restart
3. Keep volumes for faster restarts
4. Use `docker-compose build --no-cache` if builds seem cached incorrectly
