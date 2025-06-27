#!/bin/bash

# Start React frontend server
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

echo "🌐 Starting React frontend..."

# Navigate to frontend directory
cd "$(dirname "$0")/../chesscom_helper/frontend"

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed"
    exit 1
fi

# Check if npm is available
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing Node.js dependencies..."
    npm install
    print_success "Dependencies installed"
fi

# Kill any existing processes on port 5173
echo "Checking for processes on port 5173..."
if lsof -ti:5173 >/dev/null 2>&1; then
    print_warning "Killing existing process on port 5173"
    lsof -ti:5173 | xargs kill -9 2>/dev/null || true
    sleep 1
fi

# Start development server
echo ""
print_success "Starting React development server..."
echo "Frontend will be available at: http://localhost:5173"
echo "Press Ctrl+C to stop"
echo ""

npm run dev