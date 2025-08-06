# 🐳 Docker Development Environment

This guide explains how to use Docker Compose for local development of the EZ Tracking Board application.

## 📋 Prerequisites

- Docker Desktop (includes Docker Compose)
  - [Mac](https://docs.docker.com/desktop/install/mac-install/)
  - [Windows](https://docs.docker.com/desktop/install/windows-install/)
  - [Linux](https://docs.docker.com/desktop/install/linux-install/)

## 🚀 Quick Start

### 1. Clone and Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/ez-tracking-board.git
cd ez-tracking-board

# Copy environment example (if needed)
cp .env.example .env
```

### 2. Start All Services

```bash
# Start all services (frontend, backend, worker, postgres, redis)
docker-compose up

# Or run in background
docker-compose up -d

# View logs
docker-compose logs -f
```

### 3. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5001
- **pgAdmin** (optional): http://localhost:5050
  - Email: `admin@example.com`
  - Password: `admin`
- **Redis Commander** (optional): http://localhost:8081

## 🛠️ Development Workflow

### Starting Services

```bash
# Start all services
docker-compose up

# Start specific services
docker-compose up backend frontend

# Start with optional tools (pgAdmin, Redis Commander)
docker-compose --profile tools up
```

### Stopping Services

```bash
# Stop all services (keeps data)
docker-compose stop

# Stop and remove containers (keeps data)
docker-compose down

# Stop and remove everything (including data)
docker-compose down -v
```

### Viewing Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend

# Last 100 lines
docker-compose logs --tail=100 backend
```

## 📦 Service Details

### Frontend (React)
- **Port**: 3000
- **Hot Reload**: ✅ Enabled
- **Volume Mounts**: `src/` and `public/` directories
- **Environment**: Development mode with source maps

### Backend API (Node.js)
- **Port**: 5001
- **Hot Reload**: ✅ Enabled via Nodemon
- **Volume Mounts**: Entire `server/` directory
- **Features**: TypeScript compilation, auto-restart on changes

### Worker (Background Jobs)
- **Hot Reload**: ✅ Enabled via Nodemon
- **Purpose**: Processes background jobs from Redis queue
- **Same codebase as backend

### PostgreSQL Database
- **Port**: 5432
- **Credentials**:
  - User: `postgres`
  - Password: `postgres`
  - Database: `vital_signs_tracking`
- **Data Persistence**: ✅ Via Docker volume

### Redis Cache
- **Port**: 6379
- **Data Persistence**: ✅ Via Docker volume
- **Purpose**: Session storage, job queue

## 🔧 Common Tasks

### Database Management

```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U postgres -d vital_signs_tracking

# Run migrations
docker-compose exec backend npm run migrate

# Access pgAdmin (if running with tools profile)
# Open http://localhost:5050
# Add server with:
#   Host: postgres
#   Port: 5432
#   Username: postgres
#   Password: postgres
```

### Redis Management

```bash
# Connect to Redis CLI
docker-compose exec redis redis-cli

# Access Redis Commander (if running with tools profile)
# Open http://localhost:8081
```

### Running Commands

```bash
# Install new npm package in backend
docker-compose exec backend npm install package-name

# Install new npm package in frontend
docker-compose exec frontend npm install package-name

# Run backend tests
docker-compose exec backend npm test

# Build backend TypeScript
docker-compose exec backend npm run build
```

### Debugging

```bash
# Shell access to containers
docker-compose exec backend sh
docker-compose exec frontend sh

# Check container status
docker-compose ps

# Inspect network
docker network inspect ez-tracking-network
```

## 🐛 Troubleshooting

### Port Already in Use

If you get "port already allocated" errors:

```bash
# Find process using port (example for 5001)
lsof -i :5001  # Mac/Linux
netstat -ano | findstr :5001  # Windows

# Kill the process or change the port in docker-compose.yml
```

### Database Connection Issues

1. Ensure PostgreSQL is healthy:
```bash
docker-compose ps postgres
```

2. Check logs:
```bash
docker-compose logs postgres
```

3. Verify connection from backend:
```bash
docker-compose exec backend sh
nc -zv postgres 5432
```

### Frontend Not Hot Reloading

1. Ensure `CHOKIDAR_USEPOLLING=true` is set (already in docker-compose.yml)
2. Try restarting the frontend service:
```bash
docker-compose restart frontend
```

### Permission Issues

If you encounter permission issues with volumes on Linux:

```bash
# Run containers with your user ID
export UID=$(id -u)
export GID=$(id -g)
docker-compose up
```

## 🔄 Resetting Everything

```bash
# Stop all services
docker-compose down

# Remove all data (databases, caches)
docker-compose down -v

# Remove all images (forces rebuild)
docker-compose down --rmi all

# Fresh start
docker-compose up --build
```

## 📝 Environment Variables

### Backend Environment
Located in `docker-compose.yml`:
- `NODE_ENV`: development
- `DB_HOST`: postgres (container name)
- `DB_PORT`: 5432
- `REDIS_HOST`: redis (container name)
- `REDIS_PORT`: 6379

### Frontend Environment
- `REACT_APP_API_URL`: http://localhost:5001
- `CHOKIDAR_USEPOLLING`: true (for hot reload in Docker)

### Custom Configuration
Create a `.env` file in the project root:
```env
# Add your EZDerm API credentials
EZDERM_API_BASE_URL=https://your-server.com
EZDERM_CLIENT_ID=your-client-id
EZDERM_CLIENT_SECRET=your-client-secret
```

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│    Frontend     │────▶│    Backend      │────▶│   PostgreSQL    │
│  (React:3000)   │     │  (Node:5001)    │     │    (5432)       │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │                          
                               │                          
                               ▼                          
                        ┌─────────────────┐     ┌─────────────────┐
                        │                 │     │                 │
                        │     Worker      │────▶│     Redis       │
                        │   (Background)  │     │    (6379)       │
                        │                 │     │                 │
                        └─────────────────┘     └─────────────────┘
```

## 🚢 Production vs Development

This Docker Compose setup is for **development only**. Key differences from production:

| Feature | Development | Production |
|---------|-------------|------------|
| Hot Reload | ✅ Enabled | ❌ Disabled |
| Source Maps | ✅ Generated | ❌ Disabled |
| Volume Mounts | ✅ Local files | ❌ Baked into image |
| Debug Logging | ✅ Verbose | ❌ Minimal |
| Security | ⚠️ Relaxed | ✅ Hardened |
| Performance | ⚠️ Not optimized | ✅ Optimized |

## 💡 Tips

1. **VS Code Integration**: Install the Docker extension for easy container management
2. **Performance**: On Mac/Windows, Docker Desktop can be resource-intensive. Allocate sufficient resources in Docker Desktop settings
3. **Data Persistence**: Database and Redis data persist in Docker volumes between restarts
4. **Multi-Stage Build**: The production Dockerfile uses multi-stage builds for smaller images

---

🎉 **Happy Developing!** If you encounter issues, check the logs first: `docker-compose logs -f` 