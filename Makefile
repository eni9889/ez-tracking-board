# EZ Tracking Board - Development Commands
.PHONY: help up down restart logs build clean test shell db redis

# Default target
help:
	@echo "EZ Tracking Board - Docker Development Commands"
	@echo ""
	@echo "Basic Commands:"
	@echo "  make up          - Start all services"
	@echo "  make down        - Stop all services"
	@echo "  make restart     - Restart all services"
	@echo "  make logs        - View logs for all services"
	@echo "  make build       - Build/rebuild all images"
	@echo "  make clean       - Stop services and remove volumes"
	@echo ""
	@echo "Service-Specific:"
	@echo "  make backend     - View backend logs"
	@echo "  make frontend    - View frontend logs"
	@echo "  make worker      - View worker logs"
	@echo ""
	@echo "Database/Cache:"
	@echo "  make db          - Connect to PostgreSQL"
	@echo "  make redis       - Connect to Redis"
	@echo "  make pgadmin     - Start with pgAdmin"
	@echo ""
	@echo "Development:"
	@echo "  make shell-backend  - Shell into backend container"
	@echo "  make shell-frontend - Shell into frontend container"
	@echo "  make test        - Run all tests"
	@echo "  make migrate     - Run database migrations"

# Basic Commands
up:
	docker-compose up -d
	@echo "✅ Services started! Access at:"
	@echo "   Frontend: http://localhost:3000"
	@echo "   Backend:  http://localhost:5001"

down:
	docker-compose down

restart:
	docker-compose restart

logs:
	docker-compose logs -f

build:
	docker-compose build --no-cache

clean:
	docker-compose down -v
	@echo "⚠️  All data has been removed!"

# Service-Specific Logs
backend:
	docker-compose logs -f backend

frontend:
	docker-compose logs -f frontend

worker:
	docker-compose logs -f worker

# Database/Cache Access
db:
	docker-compose exec postgres psql -U postgres -d vital_signs_tracking

redis:
	docker-compose exec redis redis-cli

pgadmin:
	docker-compose --profile tools up -d
	@echo "✅ pgAdmin started at http://localhost:5050"
	@echo "   Email: admin@example.com"
	@echo "   Password: admin"

# Development Commands
shell-backend:
	docker-compose exec backend sh

shell-frontend:
	docker-compose exec frontend sh

test:
	@echo "Running backend tests..."
	docker-compose exec backend npm test
	@echo "Running frontend tests..."
	docker-compose exec frontend npm test

migrate:
	docker-compose exec backend npm run migrate

# Installation helpers
install-backend:
	docker-compose exec backend npm install

install-frontend:
	docker-compose exec frontend npm install

# Health check
health:
	@echo "Checking service health..."
	@docker-compose ps
	@echo ""
	@echo "Backend health check:"
	@curl -f http://localhost:5001/api/health 2>/dev/null && echo "✅ Backend is healthy" || echo "❌ Backend is not responding"
	@echo ""
	@echo "Frontend check:"
	@curl -f http://localhost:3000 2>/dev/null > /dev/null && echo "✅ Frontend is accessible" || echo "❌ Frontend is not responding"

# Development setup
setup:
	@echo "Setting up development environment..."
	@cp -n .env.example .env 2>/dev/null || echo "✅ .env file already exists"
	@docker-compose build
	@docker-compose up -d
	@sleep 5
	@make health
	@echo ""
	@echo "🎉 Development environment is ready!"
	@echo "   Run 'make logs' to view logs"
	@echo "   Run 'make help' for more commands" 