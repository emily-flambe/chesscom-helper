#!/bin/bash

# Setup PostgreSQL database for Chess.com Helper
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

echo "🗄️  Setting up PostgreSQL database..."

# Add PostgreSQL to PATH (Homebrew)
if [ -x "/opt/homebrew/opt/postgresql@15/bin/psql" ]; then
    export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"
elif [ -x "/usr/local/opt/postgresql@15/bin/psql" ]; then
    export PATH="/usr/local/opt/postgresql@15/bin:$PATH"
fi

# Check if PostgreSQL is running
if ! pg_isready -h localhost -p 5432 &> /dev/null; then
    print_error "PostgreSQL is not running"
    echo "Please start PostgreSQL first:"
    echo "  macOS: brew services start postgresql@15"
    echo "  Linux: sudo systemctl start postgresql"
    exit 1
fi

# Database configuration
DB_NAME="chesscom_helper"
DB_USER="chesscom_user"
DB_PASS="chesscom_password"

# Create database and user
echo "Creating database and user..."

# Connect as postgres user and create database/user
if command -v sudo &> /dev/null && id -u postgres &> /dev/null; then
    # Linux: use sudo to connect as postgres user
    sudo -u postgres psql -c "DROP DATABASE IF EXISTS $DB_NAME;"
    sudo -u postgres psql -c "DROP USER IF EXISTS $DB_USER;"
    sudo -u postgres psql -c "CREATE DATABASE $DB_NAME;"
    sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';"
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
    sudo -u postgres psql -c "ALTER USER $DB_USER CREATEDB;"
else
    # macOS: connect directly to postgres database
    psql postgres -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>/dev/null || true
    psql postgres -c "DROP USER IF EXISTS $DB_USER;" 2>/dev/null || true
    psql postgres -c "CREATE DATABASE $DB_NAME;"
    psql postgres -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';"
    psql postgres -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
    psql postgres -c "ALTER USER $DB_USER CREATEDB;"
fi

print_success "Database created: $DB_NAME"
print_success "User created: $DB_USER"

# Test connection
if PGPASSWORD=$DB_PASS psql -h localhost -U $DB_USER -d $DB_NAME -c "SELECT 1;" &> /dev/null; then
    print_success "Database connection test passed"
else
    print_error "Database connection test failed"
    exit 1
fi

echo ""
echo "Database setup complete!"
echo "Database: $DB_NAME"
echo "User: $DB_USER"
echo "Password: $DB_PASS"
echo "Host: localhost"
echo "Port: 5432"