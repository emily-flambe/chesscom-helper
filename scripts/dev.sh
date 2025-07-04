#!/bin/bash

# Chess.com Helper - Development Script
# This script sets up and starts the local development environment

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# Check if we're in the project root
if [ ! -f "package.json" ]; then
    print_error "This script must be run from the project root directory"
    exit 1
fi

echo "🏁 Chess.com Helper Development Setup"
echo "====================================="

# Check for Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js first."
    exit 1
else
    NODE_VERSION=$(node -v)
    print_status "Node.js installed: $NODE_VERSION"
fi

# Check for npm
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm first."
    exit 1
else
    NPM_VERSION=$(npm -v)
    print_status "npm installed: $NPM_VERSION"
fi

# Check if node_modules exists, install dependencies if not
if [ ! -d "node_modules" ]; then
    print_warning "Dependencies not installed. Installing..."
    npm install
    if [ $? -eq 0 ]; then
        print_status "Dependencies installed successfully"
    else
        print_error "Failed to install dependencies"
        exit 1
    fi
else
    print_status "Dependencies already installed"
fi

# Check for .env file
if [ ! -f ".env" ]; then
    print_error ".env file not found!"
    echo ""
    echo "Please create a .env file with the following structure:"
    echo "----------------------------------------"
    echo "# Chess.com API Configuration"
    echo "CHESS_COM_API_KEY=your_api_key_here"
    echo ""
    echo "# Cloudflare Configuration (optional for local dev)"
    echo "CLOUDFLARE_ACCOUNT_ID=your_account_id"
    echo "CLOUDFLARE_API_TOKEN=your_api_token"
    echo "----------------------------------------"
    echo ""
    echo "You can copy the example file:"
    echo "  cp .env.example .env"
    echo ""
    exit 1
else
    print_status ".env file found"
fi

# Check if Wrangler is installed globally or locally
if command -v wrangler &> /dev/null; then
    WRANGLER_VERSION=$(wrangler --version 2>&1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
    print_status "Wrangler installed globally: $WRANGLER_VERSION"
elif [ -f "node_modules/.bin/wrangler" ]; then
    print_status "Wrangler installed locally"
else
    print_warning "Wrangler not found. Installing..."
    npm install wrangler --save-dev
    if [ $? -eq 0 ]; then
        print_status "Wrangler installed successfully"
    else
        print_error "Failed to install Wrangler"
        exit 1
    fi
fi

# Check if port 8787 is already in use
if lsof -Pi :8787 -sTCP:LISTEN -t >/dev/null 2>&1; then
    print_error "Port 8787 is already in use. Please stop the process using this port."
    echo "You can find the process with: lsof -i :8787"
    exit 1
fi

echo ""
echo "🚀 Starting development server..."
echo "================================="
echo ""

# Start Wrangler dev server
print_status "Starting Wrangler development server..."
echo ""
echo "📋 Local development URLs:"
echo "  • API: http://localhost:8787"
echo "  • Chess.com endpoint: http://localhost:8787/api/chess"
echo "  • Health check: http://localhost:8787/health"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Run Wrangler dev server
if command -v wrangler &> /dev/null; then
    wrangler dev
else
    npx wrangler dev
fi