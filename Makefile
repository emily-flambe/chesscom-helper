# Chess.com Helper - Development Automation
# Comprehensive Makefile for Cloudflare Workers TypeScript Project

.PHONY: help setup install dev test lint build deploy clean env-setup db-status db-migrate db-seed db-reset db-studio fmt deps check all

# Default target
.DEFAULT_GOAL := help

# Colors for output
CYAN = \033[36m
GREEN = \033[32m
YELLOW = \033[33m
RED = \033[31m
RESET = \033[0m

##@ Setup and Installation

setup: ## 🚀 Initial project setup (dependencies, env, database)
	@echo "$(CYAN)Setting up Chess.com Helper project...$(RESET)"
	@./scripts/setup.sh

install: ## 📦 Install/update dependencies
	@echo "$(CYAN)Installing dependencies...$(RESET)"
	@./scripts/install.sh

env-setup: ## 🔧 Configure environment variables
	@echo "$(CYAN)Setting up environment configuration...$(RESET)"
	@./scripts/env-setup.sh

env-prod: ## 🔧 Configure production environment
	@echo "$(CYAN)Setting up production environment...$(RESET)"
	@./scripts/env-setup.sh production

##@ Development

dev: ## 🔥 Start local development server
	@echo "$(CYAN)Starting development server...$(RESET)"
	@./scripts/dev.sh

test: ## 🧪 Run test suite
	@echo "$(CYAN)Running tests...$(RESET)"
	@./scripts/test.sh

test-watch: ## 🔍 Run tests in watch mode
	@echo "$(CYAN)Running tests in watch mode...$(RESET)"
	@./scripts/test.sh --watch

test-coverage: ## 📊 Run tests with coverage
	@echo "$(CYAN)Running tests with coverage...$(RESET)"
	@./scripts/test.sh --coverage

lint: ## 🔍 Run linting checks
	@echo "$(CYAN)Running linting checks...$(RESET)"
	@./scripts/lint.sh

lint-fix: ## 🔧 Run linting with automatic fixes
	@echo "$(CYAN)Running linting with fixes...$(RESET)"
	@./scripts/lint.sh --fix

fmt: ## 🎨 Format code (alias for lint-fix)
	@make lint-fix

##@ Database Operations

db-status: ## 📊 Show local database status
	@echo "$(CYAN)Checking local database status...$(RESET)"
	@./scripts/db-setup.sh status

db-status-remote: ## 📊 Show remote database status
	@echo "$(CYAN)Checking remote database status...$(RESET)"
	@./scripts/db-setup.sh --remote status

db-migrate: ## 🚀 Apply database migrations (local)
	@echo "$(CYAN)Applying local database migrations...$(RESET)"
	@./scripts/db-setup.sh migrate

db-migrate-remote: ## 🚀 Apply database migrations (remote)
	@echo "$(CYAN)Applying remote database migrations...$(RESET)"
	@./scripts/db-setup.sh --remote migrate

db-seed: ## 🌱 Apply seed data to local database
	@echo "$(CYAN)Applying seed data...$(RESET)"
	@./scripts/db-setup.sh seed

db-reset: ## ⚠️  Reset local database (destructive)
	@echo "$(YELLOW)Resetting local database...$(RESET)"
	@./scripts/db-setup.sh reset

db-clear: ## 🧹 Clear all data from local database (keeps schema)
	@echo "$(YELLOW)Clearing all data from local database...$(RESET)"
	@wrangler d1 execute chesscom-helper-db --local --command "DELETE FROM notification_log; DELETE FROM player_subscriptions; DELETE FROM player_status; DELETE FROM user_preferences; DELETE FROM users; DELETE FROM monitoring_jobs; DELETE FROM agent_results; DELETE FROM agent_tasks; DELETE FROM game_analysis; DELETE FROM notification_optimizations; DELETE FROM player_activity_log; DELETE FROM player_notification_preferences; DELETE FROM player_stats; DELETE FROM user_behavior_insights;"

db-studio: ## 🎨 Open D1 Studio for local database
	@echo "$(CYAN)Opening D1 Studio...$(RESET)"
	@./scripts/db-setup.sh studio

db-studio-remote: ## 🎨 Open D1 Studio for remote database
	@echo "$(CYAN)Opening D1 Studio for remote database...$(RESET)"
	@./scripts/db-setup.sh --remote studio

##@ Build and Deploy

build: ## 🏗️  Build for production
	@echo "$(CYAN)Building for production...$(RESET)"
	@./scripts/build.sh

deploy: ## 🚀 Deploy to production
	@echo "$(CYAN)Deploying to production...$(RESET)"
	@./scripts/deploy.sh

deploy-dev: ## 🚀 Deploy to development environment
	@echo "$(CYAN)Deploying to development...$(RESET)"
	@./scripts/deploy.sh --environment development

deploy-force: ## ⚠️  Force deploy (skip validations)
	@echo "$(YELLOW)Force deploying...$(RESET)"
	@./scripts/deploy.sh --force

deploy-quick: ## ⚡ Quick deploy (skip tests)
	@echo "$(CYAN)Quick deploying...$(RESET)"
	@./scripts/deploy.sh --skip-tests

##@ Maintenance

clean: ## 🧹 Clean build artifacts
	@echo "$(CYAN)Cleaning build artifacts...$(RESET)"
	@./scripts/clean.sh

clean-deps: ## 🧹 Clean build artifacts and dependencies
	@echo "$(CYAN)Cleaning build artifacts and dependencies...$(RESET)"
	@./scripts/clean.sh --deps

clean-all: ## 🧹 Clean everything (including lock files)
	@echo "$(CYAN)Cleaning everything...$(RESET)"
	@./scripts/clean.sh --all

##@ Quality Assurance

check: ## ✅ Run all quality checks (lint, test, typecheck)
	@echo "$(CYAN)Running all quality checks...$(RESET)"
	@make lint
	@make test
	@echo "$(GREEN)✅ All quality checks passed!$(RESET)"

ci: ## 🤖 Run CI pipeline (check + build)
	@echo "$(CYAN)Running CI pipeline...$(RESET)"
	@make check
	@make build
	@echo "$(GREEN)✅ CI pipeline completed successfully!$(RESET)"

##@ Utilities

deps: ## 📊 Show dependency information
	@echo "$(CYAN)Dependency Information:$(RESET)"
	@echo "Node.js: $$(node --version)"
	@echo "npm: $$(npm --version)"
	@echo "Wrangler: $$(wrangler --version 2>/dev/null || echo 'Not installed')"
	@echo "TypeScript: $$(npx tsc --version 2>/dev/null || echo 'Not installed')"

status: ## 📊 Show project status
	@echo "$(CYAN)Project Status:$(RESET)"
	@echo "Git branch: $$(git branch --show-current 2>/dev/null || echo 'Not a git repository')"
	@echo "Git status: $$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ') files changed"
	@make deps

all: ## 🔄 Run complete workflow (setup, check, build)
	@echo "$(CYAN)Running complete workflow...$(RESET)"
	@make setup
	@make check
	@make build
	@echo "$(GREEN)✅ Complete workflow finished!$(RESET)"

##@ Help

help: ## 📚 Show this help message
	@echo "$(CYAN)Chess.com Helper - Development Commands$(RESET)"
	@echo ""
	@echo "$(GREEN)Available commands:$(RESET)"
	@awk 'BEGIN {FS = ":.*##"; printf ""} /^[a-zA-Z_-]+:.*?##/ { printf "  $(CYAN)%-20s$(RESET) %s\n", $$1, $$2 } /^##@/ { printf "\n$(YELLOW)%s$(RESET)\n", substr($$0, 5) } ' $(MAKEFILE_LIST)
	@echo ""
	@echo "$(GREEN)Examples:$(RESET)"
	@echo "  make setup          # Initial project setup"
	@echo "  make dev            # Start development server"
	@echo "  make test           # Run tests"
	@echo "  make build          # Build for production"
	@echo "  make deploy         # Deploy to production"
	@echo "  make clean          # Clean build artifacts"
	@echo ""
	@echo "$(GREEN)Common workflows:$(RESET)"
	@echo "  make setup && make dev              # New developer setup"
	@echo "  make lint-fix && make test          # Code quality workflow"
	@echo "  make check && make build            # Pre-deployment checks"
	@echo "  make db-migrate && make db-seed     # Database setup"
	@echo ""
	@echo "$(YELLOW)For more information, see: README.md$(RESET)"