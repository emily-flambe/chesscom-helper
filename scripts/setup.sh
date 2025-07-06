#!/bin/bash

# Chess.com Helper - Initial Project Setup Script
# This script sets up the development environment for the Chess.com Helper project

set -e  # Exit on any error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check Node.js version
check_node_version() {
    log_info "Checking Node.js version..."
    
    if ! command_exists node; then
        log_error "Node.js is not installed. Please install Node.js 18+ from https://nodejs.org/"
        exit 1
    fi
    
    local node_version=$(node --version | cut -d 'v' -f 2)
    local major_version=$(echo $node_version | cut -d '.' -f 1)
    
    if [ "$major_version" -lt 18 ]; then
        log_error "Node.js version $node_version is too old. Please upgrade to Node.js 18 or higher."
        exit 1
    fi
    
    log_success "Node.js version $node_version is compatible"
}

# Check npm availability
check_npm() {
    log_info "Checking npm availability..."
    
    if ! command_exists npm; then
        log_error "npm is not available. Please install npm or use a Node.js installer that includes npm."
        exit 1
    fi
    
    local npm_version=$(npm --version)
    log_success "npm version $npm_version is available"
}

# Install dependencies
install_dependencies() {
    log_info "Installing project dependencies..."
    
    if [ ! -f "package.json" ]; then
        log_error "package.json not found. Are you in the correct directory?"
        exit 1
    fi
    
    npm install
    
    if [ $? -ne 0 ]; then
        log_error "Failed to install dependencies"
        exit 1
    fi
    
    log_success "Dependencies installed successfully"
}

# Create .env file from .env.example
create_env_file() {
    log_info "Setting up environment configuration..."
    
    if [ -f ".env" ]; then
        log_warning ".env file already exists. Skipping creation."
        return
    fi
    
    if [ -f ".env.example" ]; then
        cp .env.example .env
        log_success "Created .env file from .env.example"
        log_warning "Please review and update the .env file with your specific configuration."
    else
        log_warning ".env.example not found. Creating minimal .env file..."
        cat > .env << EOF
# Chess.com Helper Environment Configuration
# Please update these values according to your setup

# Development environment
NODE_ENV=development

# Database configuration will be handled by wrangler.toml
# Add any additional environment variables here
EOF
        log_success "Created basic .env file"
    fi
}

# Check Wrangler CLI
check_wrangler() {
    log_info "Checking Wrangler CLI..."
    
    if ! command_exists wrangler; then
        log_warning "Wrangler CLI not found globally. Using project-local version."
        
        # Check if wrangler is available via npx
        if ! npx wrangler --version >/dev/null 2>&1; then
            log_error "Wrangler CLI is not available. Please install it globally: npm install -g wrangler"
            exit 1
        fi
        
        WRANGLER_CMD="npx wrangler"
    else
        WRANGLER_CMD="wrangler"
    fi
    
    local wrangler_version=$($WRANGLER_CMD --version | head -n1)
    log_success "Wrangler CLI is available: $wrangler_version"
}

# Setup local database
setup_database() {
    log_info "Setting up local D1 database..."
    
    # Check if wrangler.toml exists
    if [ ! -f "wrangler.toml" ]; then
        log_error "wrangler.toml not found. Database setup cannot proceed."
        exit 1
    fi
    
    # Create local D1 database if it doesn't exist
    log_info "Creating local D1 database..."
    
    # The local database will be created automatically when running migrations
    # We just need to ensure the .wrangler directory exists
    mkdir -p .wrangler
    
    log_success "Local database setup prepared"
}

# Run initial migrations
run_migrations() {
    log_info "Running database migrations..."
    
    # Check if migrations directory exists
    if [ ! -d "database/migrations" ] && [ ! -d "migrations" ]; then
        log_warning "No migrations directory found. Skipping migration step."
        return
    fi
    
    # Run local migrations
    log_info "Applying migrations to local database..."
    
    if ! $WRANGLER_CMD d1 migrations apply chesscom-helper-db --local; then
        log_error "Failed to apply migrations to local database"
        exit 1
    fi
    
    log_success "Database migrations applied successfully"
}

# Verify setup
verify_setup() {
    log_info "Verifying project setup..."
    
    # Check if TypeScript compiles
    log_info "Checking TypeScript compilation..."
    if ! npm run typecheck; then
        log_warning "TypeScript compilation has errors. These should be fixed before deployment."
    fi
    
    # Check if linting passes
    log_info "Running linter..."
    if ! npm run lint; then
        log_warning "Linting issues found. Run 'npm run lint:fix' to auto-fix some issues."
    fi
    
    log_success "Project setup verification completed"
}

# Display next steps
display_next_steps() {
    echo ""
    echo -e "${GREEN}🎉 Setup completed successfully!${NC}"
    echo ""
    echo -e "${BLUE}Next steps:${NC}"
    echo "1. Review and update configuration files:"
    echo "   - .env (environment variables)"
    echo "   - wrangler.toml (Cloudflare Workers configuration)"
    echo ""
    echo "2. Start the development server:"
    echo -e "   ${YELLOW}npm run dev${NC}"
    echo ""
    echo "3. Run tests:"
    echo -e "   ${YELLOW}npm test${NC}"
    echo ""
    echo "4. Build for production:"
    echo -e "   ${YELLOW}npm run build${NC}"
    echo ""
    echo "5. Deploy to Cloudflare Workers:"
    echo -e "   ${YELLOW}npm run deploy${NC}"
    echo ""
    echo "6. Database management:"
    echo -e "   ${YELLOW}npm run db:studio${NC}        - Open D1 database studio"
    echo -e "   ${YELLOW}npm run db:migrate:local${NC}  - Apply migrations locally"
    echo -e "   ${YELLOW}npm run db:migrate:remote${NC} - Apply migrations to production"
    echo ""
    echo -e "${BLUE}Useful resources:${NC}"
    echo "- Cloudflare Workers Docs: https://developers.cloudflare.com/workers/"
    echo "- D1 Database Docs: https://developers.cloudflare.com/d1/"
    echo "- Wrangler CLI Docs: https://developers.cloudflare.com/workers/wrangler/"
    echo ""
    echo -e "${GREEN}Happy coding! 🚀${NC}"
}

# Main setup function
main() {
    echo -e "${BLUE}=== Chess.com Helper - Project Setup ===${NC}"
    echo ""
    
    # Check if we're in the right directory
    if [ ! -f "package.json" ]; then
        log_error "package.json not found. Please run this script from the project root directory."
        exit 1
    fi
    
    # Run setup steps
    check_node_version
    check_npm
    install_dependencies
    create_env_file
    check_wrangler
    setup_database
    run_migrations
    verify_setup
    
    # Display completion message
    display_next_steps
}

# Handle script interruption
cleanup() {
    echo ""
    log_warning "Setup interrupted. You may need to run this script again."
    exit 1
}

# Set up signal handlers
trap cleanup INT TERM

# Run main function
main "$@"