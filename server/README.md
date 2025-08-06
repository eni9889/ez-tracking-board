# EZ Tracking Board Server

Backend server for the EZ Tracking Board application with PostgreSQL database integration.

## Prerequisites

- Node.js (v18+ recommended)
- PostgreSQL (v12+ recommended)
- npm or yarn

## Database Setup

### PostgreSQL Installation

#### macOS (with Homebrew)
```bash
brew install postgresql
brew services start postgresql
```

#### Ubuntu/Debian
```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

#### Windows
Download and install from [PostgreSQL official website](https://www.postgresql.org/download/windows/)

### Database Configuration

1. **Create Database and User:**
```bash
# Connect to PostgreSQL as superuser
sudo -u postgres psql

# Create database
CREATE DATABASE vital_signs_tracking;

# Create user (optional, you can use default postgres user)
CREATE USER ez_tracking_user WITH PASSWORD 'your_secure_password';

# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE vital_signs_tracking TO ez_tracking_user;

# Exit psql
\q
```

2. **Environment Configuration:**

Create a `.env` file in the server directory:
```env
# PostgreSQL Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=vital_signs_tracking
DB_USER=postgres
DB_PASSWORD=postgres
DB_SSL=false

# Application Configuration
PORT=5001
NODE_ENV=development

# Redis Configuration (if using Redis for queue management)
REDIS_URL=redis://localhost:6379
```

**Important:** Never commit your `.env` file to version control. Add it to `.gitignore`.

## Installation

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build
```

## Development

```bash
# Run in development mode with auto-restart
npm run dev

# Build and watch for changes
npm run build:watch
```

## Production

```bash
# Build the application
npm run build

# Start the production server
npm start
```

## Database Migration

The application will automatically create the required tables on first run:
- `processed_vital_signs` - Tracks processed vital sign encounters
- `user_credentials` - Stores user authentication data
- `user_sessions` - Manages user sessions

## Database Schema

### processed_vital_signs
```sql
CREATE TABLE processed_vital_signs (
  id SERIAL PRIMARY KEY,
  encounter_id TEXT UNIQUE NOT NULL,
  patient_id TEXT NOT NULL,
  processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  source_encounter_id TEXT,
  height_value REAL,
  weight_value REAL,
  height_unit TEXT,
  weight_unit TEXT,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### user_credentials
```sql
CREATE TABLE user_credentials (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  server_url TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### user_sessions
```sql
CREATE TABLE user_sessions (
  id SERIAL PRIMARY KEY,
  session_token TEXT UNIQUE NOT NULL,
  username TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  user_agent TEXT,
  ip_address TEXT,
  is_active BOOLEAN DEFAULT true
);
```

## API Endpoints

- `POST /api/login` - User authentication
- `POST /api/logout` - User logout
- `GET /api/encounters` - Get patient encounters
- `GET /api/sessions` - Get active sessions (admin)
- `GET /api/health` - Health check

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_NAME` | Database name | `vital_signs_tracking` |
| `DB_USER` | Database user | `postgres` |
| `DB_PASSWORD` | Database password | `postgres` |
| `DB_SSL` | Enable SSL connection | `false` |
| `PORT` | Server port | `5001` |
| `NODE_ENV` | Environment | `development` |

## Features

- **PostgreSQL Integration**: Robust relational database with connection pooling
- **Session Management**: Secure server-side session handling
- **Vital Signs Processing**: Automated processing and tracking
- **Rate Limiting**: API rate limiting for security
- **Error Handling**: Comprehensive error handling and logging
- **TypeScript**: Full TypeScript support with type safety

## Troubleshooting

### Database Connection Issues

1. **Check PostgreSQL is running:**
```bash
# macOS
brew services list | grep postgresql

# Linux
sudo systemctl status postgresql
```

2. **Test connection:**
```bash
psql -h localhost -p 5432 -U postgres -d vital_signs_tracking
```

3. **Check firewall settings** if connecting to remote PostgreSQL

### Common Issues

- **Permission denied**: Ensure database user has proper privileges
- **Connection timeout**: Check `DB_HOST` and `DB_PORT` in `.env`
- **SSL errors**: Set `DB_SSL=false` for local development

## Docker Support

You can run PostgreSQL in Docker for development:

```bash
# Run PostgreSQL container
docker run --name postgres-ez-tracking \
  -e POSTGRES_DB=vital_signs_tracking \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  -d postgres:14

# Stop container
docker stop postgres-ez-tracking

# Start existing container
docker start postgres-ez-tracking
``` 