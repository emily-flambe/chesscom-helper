# Chess.com Helper - Makefile
# Development and deployment automation

.PHONY: help install dev build test lint clean setup deps check deploy

# Default target
help: ## Show this help message
	@echo "Chess.com Helper - Available Commands:"
	@echo
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

# Installation and Setup
install: ## Install all dependencies (backend + frontend)
	@echo "📦 Installing dependencies..."
	cd chesscom_helper && PATH="$$HOME/.local/bin:$$PATH" poetry install
	cd chesscom_helper/frontend && npm install

setup: install ## Complete project setup including database
	@echo "🛠️  Setting up project..."
	chmod +x ./scripts/setup-database.sh
	./scripts/setup-database.sh

deps: ## Check and install missing dependencies
	@echo "🔍 Checking dependencies..."
	chmod +x ./scripts/check-dependencies.sh
	./scripts/check-dependencies.sh

# Development
dev: ## Start development servers (backend + frontend)
	@echo "🚀 Starting development servers..."
	chmod +x ./scripts/start-backend.sh ./scripts/start-frontend.sh
	./scripts/start-backend.sh &
	./scripts/start-frontend.sh &
	wait

dev-backend: ## Start Django development server
	@echo "🐍 Starting Django backend..."
	chmod +x ./scripts/start-backend.sh
	./scripts/start-backend.sh

dev-frontend: ## Start Vite development server
	@echo "⚡ Starting Vite frontend..."
	chmod +x ./scripts/start-frontend.sh
	./scripts/start-frontend.sh

# Building and Testing
build: ## Build frontend for production
	@echo "🏗️  Building frontend..."
	cd chesscom_helper/frontend && npm run build

test: ## Run all tests
	@echo "🧪 Running tests..."
	export $$(cat .env | grep -v '^#' | xargs) && cd chesscom_helper && PATH="$$HOME/.local/bin:$$PATH" poetry run python manage.py test

lint: ## Run linting and formatting
	@echo "🧹 Running linting..."
	cd chesscom_helper && PATH="$$HOME/.local/bin:$$PATH" poetry run black .
	cd chesscom_helper/frontend && npm run lint

# Database and Management
migrate: ## Run Django migrations
	@echo "📊 Running migrations..."
	export $$(cat .env | grep -v '^#' | xargs) && cd chesscom_helper && PATH="$$HOME/.local/bin:$$PATH" poetry run python manage.py migrate

makemigrations: ## Create new Django migrations
	@echo "📝 Creating migrations..."
	export $$(cat .env | grep -v '^#' | xargs) && cd chesscom_helper && PATH="$$HOME/.local/bin:$$PATH" poetry run python manage.py makemigrations

superuser: ## Create Django superuser
	@echo "👤 Creating superuser..."
	export $$(cat .env | grep -v '^#' | xargs) && cd chesscom_helper && PATH="$$HOME/.local/bin:$$PATH" poetry run python manage.py createsuperuser

collectstatic: ## Collect static files
	@echo "📁 Collecting static files..."
	export $$(cat .env | grep -v '^#' | xargs) && cd chesscom_helper && PATH="$$HOME/.local/bin:$$PATH" poetry run python manage.py collectstatic --noinput

# Monitoring and Management
check-matches: ## Check for live chess matches
	@echo "♟️  Checking live matches..."
	./scripts/check-live-matches.sh

shell: ## Open Django shell
	@echo "🐚 Opening Django shell..."
	export $$(cat .env | grep -v '^#' | xargs) && cd chesscom_helper && PATH="$$HOME/.local/bin:$$PATH" poetry run python manage.py shell

# Cleaning
clean: ## Clean build artifacts and cache
	@echo "🧽 Cleaning build artifacts..."
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete
	rm -rf chesscom_helper/frontend/dist
	rm -rf chesscom_helper/frontend/node_modules/.cache

clean-all: clean ## Clean everything including dependencies
	@echo "🗑️  Deep cleaning..."
	rm -rf chesscom_helper/frontend/node_modules
	cd chesscom_helper && PATH="$$HOME/.local/bin:$$PATH" poetry env remove --all 2>/dev/null || true

# Deployment
deploy-check: lint test ## Pre-deployment checks
	@echo "✅ Running deployment checks..."
	export $$(cat .env | grep -v '^#' | xargs) && cd chesscom_helper && PATH="$$HOME/.local/bin:$$PATH" poetry run python manage.py check --deploy

deploy: deploy-check build ## Deploy to production
	@echo "🚀 Deploying to production..."
	./deploy_scripts/deploy.sh

# Quick shortcuts
quick-start: deps dev ## Quick start for new developers

format: ## Format code (alias for lint)
	make lint

status: ## Show project status
	@echo "📊 Project Status:"
	@echo "  Backend: Django $(shell cd chesscom_helper && PATH="$$HOME/.local/bin:$$PATH" poetry run python -c 'import django; print(django.get_version())')"
	@echo "  Frontend: React $(shell cd chesscom_helper/frontend && node -p 'require("./package.json").dependencies.react')"
	@echo "  Python: $(shell python --version)"
	@echo "  Node: $(shell node --version)"