#!/usr/bin/env bash

# Chess.com Helper - Dependency Installation Script
# This script manages clean installation of project dependencies

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored output
print_error() {
    echo -e "${RED}✗ $1${NC}" >&2
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Check for required tools
check_requirements() {
    print_info "Checking system requirements..."
    
    # Check for Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18+ first."
        exit 1
    fi
    
    # Check Node.js version
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js version 18+ is required. Current version: $(node -v)"
        exit 1
    fi
    
    # Check for npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm first."
        exit 1
    fi
    
    print_success "System requirements satisfied"
}

# Clean existing dependencies
clean_dependencies() {
    print_info "Cleaning existing dependencies..."
    
    if [ -d "node_modules" ]; then
        print_warning "Removing existing node_modules directory..."
        rm -rf node_modules
        print_success "Removed node_modules"
    else
        print_info "No existing node_modules found"
    fi
    
    if [ -f "package-lock.json" ]; then
        print_warning "Removing package-lock.json for fresh install..."
        rm -f package-lock.json
        print_success "Removed package-lock.json"
    fi
}

# Install Node.js dependencies
install_npm_dependencies() {
    print_info "Installing npm dependencies..."
    
    if ! npm install; then
        print_error "Failed to install npm dependencies"
        exit 1
    fi
    
    print_success "npm dependencies installed successfully"
}

# Check and install Wrangler globally if needed
install_wrangler_global() {
    print_info "Checking for global Wrangler installation..."
    
    if command -v wrangler &> /dev/null; then
        WRANGLER_VERSION=$(wrangler --version 2>&1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
        print_info "Wrangler is already installed globally (version: $WRANGLER_VERSION)"
    else
        print_warning "Wrangler not found globally. Installing..."
        
        if npm install -g wrangler; then
            print_success "Wrangler installed globally"
        else
            print_warning "Failed to install Wrangler globally. You may need sudo permissions."
            print_info "To install manually, run: sudo npm install -g wrangler"
            print_info "Continuing with local Wrangler from node_modules..."
        fi
    fi
}

# Verify installations
verify_installation() {
    print_info "Verifying installation..."
    
    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        print_error "node_modules directory not found"
        exit 1
    fi
    
    # Check for key dependencies
    if [ ! -d "node_modules/wrangler" ]; then
        print_error "Wrangler not found in node_modules"
        exit 1
    fi
    
    if [ ! -d "node_modules/typescript" ]; then
        print_error "TypeScript not found in node_modules"
        exit 1
    fi
    
    print_success "All dependencies verified"
}

# Display version information
display_versions() {
    print_info "Installed versions:"
    echo ""
    
    # Node.js version
    echo "  Node.js:    $(node -v)"
    
    # npm version
    echo "  npm:        $(npm -v)"
    
    # Wrangler version (try global first, then local)
    if command -v wrangler &> /dev/null; then
        WRANGLER_VERSION=$(wrangler --version 2>&1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
        echo "  Wrangler:   $WRANGLER_VERSION (global)"
    elif [ -f "node_modules/.bin/wrangler" ]; then
        WRANGLER_VERSION=$(node_modules/.bin/wrangler --version 2>&1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
        echo "  Wrangler:   $WRANGLER_VERSION (local)"
    fi
    
    # TypeScript version
    if [ -f "node_modules/.bin/tsc" ]; then
        TSC_VERSION=$(node_modules/.bin/tsc -v | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')
        echo "  TypeScript: $TSC_VERSION"
    fi
    
    echo ""
}

# Main execution
main() {
    echo "=================================="
    echo "Chess.com Helper - Install Script"
    echo "=================================="
    echo ""
    
    # Change to project root directory
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
    cd "$PROJECT_ROOT"
    
    print_info "Working directory: $PROJECT_ROOT"
    echo ""
    
    # Run installation steps
    check_requirements
    clean_dependencies
    install_npm_dependencies
    install_wrangler_global
    verify_installation
    
    echo ""
    display_versions
    
    print_success "Installation completed successfully!"
    echo ""
    print_info "You can now run:"
    echo "  • npm run dev     - Start development server"
    echo "  • npm run test    - Run tests"
    echo "  • npm run deploy  - Deploy to Cloudflare"
    echo ""
}

# Run main function
main "$@"