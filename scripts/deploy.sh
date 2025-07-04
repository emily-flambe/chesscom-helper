#!/bin/bash

# Chess.com Helper - Deployment Script
# This script builds and deploys the application to Cloudflare Workers

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[ℹ]${NC} $1"
}

# Check if we're in the project root
if [ ! -f "package.json" ]; then
    print_error "This script must be run from the project root directory"
    exit 1
fi

# Parse command line arguments
ENVIRONMENT="production"
SKIP_TESTS=false
SKIP_MIGRATIONS=false
FORCE_DEPLOY=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --skip-migrations)
            SKIP_MIGRATIONS=true
            shift
            ;;
        --force)
            FORCE_DEPLOY=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  -e, --environment ENV    Deploy to environment (production|development) [default: production]"
            echo "  --skip-tests            Skip running tests before deployment"
            echo "  --skip-migrations       Skip running database migrations"
            echo "  --force                 Force deployment even if checks fail"
            echo "  -h, --help              Show this help message"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

echo "🚀 Chess.com Helper Deployment"
echo "=============================="
echo "Environment: $ENVIRONMENT"
echo ""

# Check for required tools
print_info "Checking required tools..."

if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js first."
    exit 1
fi

if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm first."
    exit 1
fi

# Check for Wrangler
WRANGLER_CMD=""
if command -v wrangler &> /dev/null; then
    WRANGLER_CMD="wrangler"
elif [ -f "node_modules/.bin/wrangler" ]; then
    WRANGLER_CMD="npx wrangler"
else
    print_error "Wrangler not found. Please install Wrangler first."
    exit 1
fi

print_status "All required tools are available"

# Check for dependencies
if [ ! -d "node_modules" ]; then
    print_warning "Dependencies not installed. Installing..."
    npm ci
    if [ $? -eq 0 ]; then
        print_status "Dependencies installed successfully"
    else
        print_error "Failed to install dependencies"
        exit 1
    fi
else
    print_status "Dependencies are installed"
fi

# Check for required environment variables
print_info "Checking environment configuration..."

# Check if .env file exists (for local development)
if [ -f ".env" ]; then
    print_status ".env file found"
else
    print_warning ".env file not found (using Cloudflare secrets)"
fi

# Validate Wrangler configuration
if [ ! -f "wrangler.toml" ]; then
    print_error "wrangler.toml not found. Please configure Wrangler first."
    exit 1
fi

print_status "Wrangler configuration found"

# Check if we're authenticated with Cloudflare
print_info "Checking Cloudflare authentication..."
if ! $WRANGLER_CMD whoami &> /dev/null; then
    print_error "Not authenticated with Cloudflare. Please run 'wrangler login' first."
    exit 1
fi

print_status "Cloudflare authentication verified"

# Run linting
print_info "Running linting checks..."
if npm run lint; then
    print_status "Linting passed"
else
    if [ "$FORCE_DEPLOY" = true ]; then
        print_warning "Linting failed, but continuing due to --force flag"
    else
        print_error "Linting failed. Fix issues or use --force to deploy anyway."
        exit 1
    fi
fi

# Run type checking
print_info "Running type checks..."
if npm run typecheck; then
    print_status "Type checking passed"
else
    if [ "$FORCE_DEPLOY" = true ]; then
        print_warning "Type checking failed, but continuing due to --force flag"
    else
        print_error "Type checking failed. Fix issues or use --force to deploy anyway."
        exit 1
    fi
fi

# Run tests
if [ "$SKIP_TESTS" = false ]; then
    print_info "Running tests..."
    if npm test; then
        print_status "All tests passed"
    else
        if [ "$FORCE_DEPLOY" = true ]; then
            print_warning "Tests failed, but continuing due to --force flag"
        else
            print_error "Tests failed. Fix issues, use --skip-tests, or use --force to deploy anyway."
            exit 1
        fi
    fi
else
    print_warning "Skipping tests (--skip-tests flag used)"
fi

# Build the project
print_info "Building project..."
if npm run build; then
    print_status "Build completed successfully"
else
    print_error "Build failed. Please fix build errors."
    exit 1
fi

# Deploy to Cloudflare Workers
print_info "Deploying to Cloudflare Workers ($ENVIRONMENT)..."
if [ "$ENVIRONMENT" = "production" ]; then
    DEPLOY_CMD="$WRANGLER_CMD deploy --env production"
else
    DEPLOY_CMD="$WRANGLER_CMD deploy --env $ENVIRONMENT"
fi

if $DEPLOY_CMD; then
    print_status "Deployment completed successfully"
else
    print_error "Deployment failed"
    exit 1
fi

# Run database migrations
if [ "$SKIP_MIGRATIONS" = false ]; then
    print_info "Running database migrations on $ENVIRONMENT..."
    
    # Check if migrations directory exists
    if [ -d "migrations" ] && [ "$(ls -A migrations)" ]; then
        if [ "$ENVIRONMENT" = "production" ]; then
            MIGRATION_CMD="$WRANGLER_CMD d1 migrations apply --env production"
        else
            MIGRATION_CMD="$WRANGLER_CMD d1 migrations apply --env $ENVIRONMENT"
        fi
        
        if $MIGRATION_CMD; then
            print_status "Database migrations completed successfully"
        else
            print_error "Database migrations failed"
            exit 1
        fi
    else
        print_warning "No migrations found, skipping"
    fi
else
    print_warning "Skipping database migrations (--skip-migrations flag used)"
fi

# Get deployment URL
print_info "Getting deployment information..."
WORKER_NAME=$(grep "^name" wrangler.toml | cut -d '"' -f 2 | tr -d ' ')
if [ -z "$WORKER_NAME" ]; then
    WORKER_NAME="chesscom-helper"
fi

# Try to get the account subdomain
ACCOUNT_INFO=$($WRANGLER_CMD whoami 2>/dev/null | grep "subdomain" | cut -d ':' -f 2 | tr -d ' ')
if [ -n "$ACCOUNT_INFO" ]; then
    DEPLOYMENT_URL="https://$WORKER_NAME.$ACCOUNT_INFO.workers.dev"
else
    DEPLOYMENT_URL="https://$WORKER_NAME.workers.dev"
fi

echo ""
echo "🎉 Deployment Complete!"
echo "======================"
echo ""
echo "Environment: $ENVIRONMENT"
echo "Deployment URL: $DEPLOYMENT_URL"
echo ""
echo "Available endpoints:"
echo "  • Health check: $DEPLOYMENT_URL/health"
echo "  • Chess.com API: $DEPLOYMENT_URL/api/chess"
echo ""
echo "Next steps:"
echo "  1. Test the deployment: curl $DEPLOYMENT_URL/health"
echo "  2. Monitor logs: wrangler tail --env $ENVIRONMENT"
echo "  3. View analytics: wrangler tail --env $ENVIRONMENT --format json"
echo ""

print_status "Deployment script completed successfully"