#!/bin/bash

# Check for live matches manually
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

echo "🎯 Checking for live matches..."

# Navigate to Django project directory
cd "$(dirname "$0")/../chesscom_helper"

# Check if .env exists
if [ ! -f "../.env" ]; then
    print_error ".env file not found"
    echo "Please create .env file first"
    exit 1
fi

# Load environment variables
export $(cat ../.env | grep -v '^#' | xargs)

# Ensure Poetry is in PATH
export PATH="$HOME/.local/bin:$PATH"

# Check if poetry is available
if ! command -v poetry &> /dev/null; then
    print_error "Poetry is not installed"
    exit 1
fi

# Run the live matches checker
poetry run python manage.py check_live_matches --verbose