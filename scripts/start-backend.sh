#!/bin/bash

# Start Django backend server
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

echo "🚀 Starting Django backend..."

# Navigate to Django project directory
cd "$(dirname "$0")/../chesscom_helper"

# Check if .env exists
if [ ! -f "../.env" ]; then
    print_error ".env file not found"
    echo "Please create .env file first by running: cp .env.example .env"
    exit 1
fi

# Load environment variables
export $(cat ../.env | grep -v '^#' | xargs)

# Ensure Poetry and PostgreSQL are in PATH
export PATH="$HOME/.local/bin:$PATH"
if [ -x "/opt/homebrew/opt/postgresql@15/bin/psql" ]; then
    export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"
elif [ -x "/usr/local/opt/postgresql@15/bin/psql" ]; then
    export PATH="/usr/local/opt/postgresql@15/bin:$PATH"
fi

# Check if poetry is available
if ! command -v poetry &> /dev/null; then
    print_error "Poetry is not installed"
    echo "Install with: curl -sSL https://install.python-poetry.org | python3 -"
    echo "Then add to PATH: export PATH=\"\$HOME/.local/bin:\$PATH\""
    exit 1
fi

# Install dependencies if needed
if [ ! -d ".venv" ]; then
    echo "Installing Python dependencies..."
    poetry install
    print_success "Dependencies installed"
fi

# Check database connection
echo "Checking database connection..."
if ! poetry run python -c "
import os
import psycopg2
try:
    conn = psycopg2.connect(
        host=os.environ.get('POSTGRES_HOST', 'localhost'),
        port=os.environ.get('POSTGRES_PORT', '5432'),
        database=os.environ.get('POSTGRES_DB', 'chesscom_helper'),
        user=os.environ.get('POSTGRES_USER', 'chesscom_user'),
        password=os.environ.get('POSTGRES_PASSWORD', 'chesscom_password')
    )
    conn.close()
    print('Database connection successful')
except Exception as e:
    print(f'Database connection failed: {e}')
    exit(1)
" 2>/dev/null; then
    print_error "Database connection failed"
    echo "Please run: ./scripts/setup-database.sh"
    exit 1
fi

print_success "Database connection verified"

# Run migrations
echo "Running database migrations..."
poetry run python manage.py migrate
print_success "Migrations completed"

# Collect static files
echo "Collecting static files..."
poetry run python manage.py collectstatic --noinput
print_success "Static files collected"

# Kill any existing processes on port 8000
echo "Checking for processes on port 8000..."
if lsof -ti:8000 >/dev/null 2>&1; then
    print_warning "Killing existing process on port 8000"
    lsof -ti:8000 | xargs kill -9 2>/dev/null || true
    sleep 1
fi

# Start development server
echo ""
print_success "Starting Django development server..."
echo "Backend will be available at: http://localhost:8000"
echo "Press Ctrl+C to stop"
echo ""

poetry run python manage.py runserver 8000