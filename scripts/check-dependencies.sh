#!/bin/bash

# Check if required dependencies are installed
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

echo "🔍 Checking dependencies..."

# Check Python
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version | cut -d ' ' -f 2)
    print_success "Python $PYTHON_VERSION installed"
else
    print_error "Python 3 is not installed"
    exit 1
fi

# Check Poetry (add common paths)
export PATH="$HOME/.local/bin:$PATH"
if command -v poetry &> /dev/null; then
    POETRY_VERSION=$(poetry --version | cut -d ' ' -f 3)
    print_success "Poetry $POETRY_VERSION installed"
else
    print_error "Poetry is not installed"
    echo "Install with: curl -sSL https://install.python-poetry.org | python3 -"
    echo "Then add to PATH: export PATH=\"\$HOME/.local/bin:\$PATH\""
    echo "And restart your terminal or run: source ~/.zshrc"
    exit 1
fi

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    print_success "Node.js $NODE_VERSION installed"
else
    print_error "Node.js is not installed"
    exit 1
fi

# Check npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    print_success "npm $NPM_VERSION installed"
else
    print_error "npm is not installed"
    exit 1
fi

# Check PostgreSQL (check Homebrew paths too)
if command -v psql &> /dev/null; then
    PSQL_VERSION=$(psql --version | cut -d ' ' -f 3)
    print_success "PostgreSQL $PSQL_VERSION installed"
elif [ -x "/opt/homebrew/opt/postgresql@15/bin/psql" ]; then
    export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"
    PSQL_VERSION=$(psql --version | cut -d ' ' -f 3)
    print_success "PostgreSQL@15 $PSQL_VERSION installed (Homebrew)"
    print_warning "Add to PATH: export PATH=\"/opt/homebrew/opt/postgresql@15/bin:\$PATH\""
elif [ -x "/usr/local/opt/postgresql@15/bin/psql" ]; then
    export PATH="/usr/local/opt/postgresql@15/bin:$PATH"
    PSQL_VERSION=$(psql --version | cut -d ' ' -f 3)
    print_success "PostgreSQL@15 $PSQL_VERSION installed (Homebrew Intel)"
    print_warning "Add to PATH: export PATH=\"/usr/local/opt/postgresql@15/bin:\$PATH\""
else
    print_error "PostgreSQL is not installed"
    echo "Install with: brew install postgresql@15 (macOS) or sudo apt install postgresql (Linux)"
    exit 1
fi

# Check if PostgreSQL is running
if pg_isready -h localhost -p 5432 &> /dev/null; then
    print_success "PostgreSQL is running"
else
    print_warning "PostgreSQL is not running"
    echo "Start with: brew services start postgresql@15 (macOS) or sudo systemctl start postgresql (Linux)"
fi

print_success "All dependencies check passed!"