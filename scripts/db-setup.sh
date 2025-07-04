#!/bin/bash

# Chess.com Helper - Database Setup Script
# Handles local and remote database operations including migrations and seeding

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Global variables
ENVIRONMENT="local"
OPERATION=""
MIGRATION_NAME=""
ROLLBACK_STEPS=1
VERBOSE=false

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
    echo -e "${BLUE}[i]${NC} $1"
}

print_verbose() {
    if [ "$VERBOSE" = true ]; then
        echo -e "${BLUE}[DEBUG]${NC} $1"
    fi
}

# Usage function
usage() {
    cat << EOF
Chess.com Helper Database Setup Script

USAGE:
    ./scripts/db-setup.sh [OPTIONS] OPERATION [ARGS]

OPTIONS:
    --local         Use local database (default)
    --remote        Use remote database
    --verbose       Enable verbose output
    -h, --help      Show this help message

OPERATIONS:
    status          Display database status and migration history
    create NAME     Create a new migration with the given name
    migrate         Apply all pending migrations
    rollback [N]    Rollback N migrations (default: 1)
    seed            Apply seed data to the database
    reset           Reset database (drop all tables and reapply migrations)
    studio          Open D1 Studio for database inspection

EXAMPLES:
    ./scripts/db-setup.sh status
    ./scripts/db-setup.sh --local migrate
    ./scripts/db-setup.sh --remote create add_user_settings
    ./scripts/db-setup.sh --verbose seed
    ./scripts/db-setup.sh rollback 2
    ./scripts/db-setup.sh --remote reset

NOTES:
    - Local operations use wrangler with --local flag
    - Remote operations require proper Cloudflare authentication
    - Seed data is only applied to development/local environments
    - Reset operation will destroy all data - use with caution
EOF
}

# Check dependencies
check_dependencies() {
    print_verbose "Checking dependencies..."
    
    # Check if we're in the project root
    if [ ! -f "package.json" ]; then
        print_error "This script must be run from the project root directory"
        exit 1
    fi
    
    # Check for wrangler
    if ! command -v wrangler &> /dev/null && [ ! -f "node_modules/.bin/wrangler" ]; then
        print_error "Wrangler is not installed. Please install it first:"
        echo "  npm install -g wrangler"
        echo "  or"
        echo "  npm install wrangler --save-dev"
        exit 1
    fi
    
    # Check for database migrations directory
    if [ ! -d "database/migrations" ]; then
        print_error "Database migrations directory not found at 'database/migrations'"
        exit 1
    fi
    
    print_verbose "Dependencies check passed"
}

# Get wrangler command (global or local)
get_wrangler_cmd() {
    if command -v wrangler &> /dev/null; then
        echo "wrangler"
    else
        echo "npx wrangler"
    fi
}

# Get environment flag for wrangler
get_env_flag() {
    if [ "$ENVIRONMENT" = "local" ]; then
        echo "--local"
    else
        echo "--env production"
    fi
}

# Display database status
show_status() {
    local wrangler_cmd=$(get_wrangler_cmd)
    local env_flag=$(get_env_flag)
    
    print_info "Database Status - Environment: $ENVIRONMENT"
    echo "=============================================="
    
    # Show current migrations
    print_info "Migration files:"
    if [ -d "database/migrations" ]; then
        ls -la database/migrations/ | grep -E '\.sql$' | awk '{print "  " $9}' || echo "  No migration files found"
    else
        echo "  No migrations directory found"
    fi
    
    echo ""
    
    # Show applied migrations using wrangler
    print_info "Applied migrations:"
    if $wrangler_cmd d1 migrations list $env_flag 2>/dev/null; then
        : # Command output is already displayed
    else
        print_warning "Could not retrieve migration history (database may not exist yet)"
    fi
    
    echo ""
    
    # Try to show table count
    print_info "Database tables:"
    if $wrangler_cmd d1 execute $env_flag --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;" 2>/dev/null; then
        : # Command output is already displayed
    else
        print_warning "Could not retrieve table information"
    fi
}

# Create a new migration
create_migration() {
    local migration_name="$1"
    local wrangler_cmd=$(get_wrangler_cmd)
    
    if [ -z "$migration_name" ]; then
        print_error "Migration name is required"
        echo "Usage: ./scripts/db-setup.sh create MIGRATION_NAME"
        exit 1
    fi
    
    print_info "Creating migration: $migration_name"
    
    # Create migration using wrangler
    $wrangler_cmd d1 migrations create "$migration_name"
    
    if [ $? -eq 0 ]; then
        print_status "Migration created successfully"
        print_info "Don't forget to add your SQL commands to the new migration file"
    else
        print_error "Failed to create migration"
        exit 1
    fi
}

# Apply pending migrations
apply_migrations() {
    local wrangler_cmd=$(get_wrangler_cmd)
    local env_flag=$(get_env_flag)
    
    print_info "Applying migrations - Environment: $ENVIRONMENT"
    
    # Apply migrations
    $wrangler_cmd d1 migrations apply $env_flag
    
    if [ $? -eq 0 ]; then
        print_status "Migrations applied successfully"
    else
        print_error "Failed to apply migrations"
        exit 1
    fi
}

# Rollback migrations
rollback_migrations() {
    local steps="$1"
    local wrangler_cmd=$(get_wrangler_cmd)
    local env_flag=$(get_env_flag)
    
    if [ -z "$steps" ]; then
        steps=1
    fi
    
    print_warning "Rolling back $steps migration(s) - Environment: $ENVIRONMENT"
    print_warning "This operation cannot be undone!"
    
    # Ask for confirmation unless in verbose mode (assuming automated)
    if [ "$VERBOSE" = false ]; then
        echo -n "Are you sure you want to rollback $steps migration(s)? (y/N): "
        read -r confirm
        if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
            print_info "Rollback cancelled"
            exit 0
        fi
    fi
    
    # Note: D1 doesn't have built-in rollback, so we'll show a warning
    print_error "D1 does not support automatic rollbacks"
    print_info "To rollback migrations, you need to:"
    print_info "1. Create a new migration with the reverse SQL commands"
    print_info "2. Apply the new migration"
    print_info "3. Alternatively, use 'reset' to drop all tables and reapply selected migrations"
}

# Apply seed data
apply_seed_data() {
    local wrangler_cmd=$(get_wrangler_cmd)
    local env_flag=$(get_env_flag)
    local seed_file="database/seeds/dev_seed.sql"
    
    print_info "Applying seed data - Environment: $ENVIRONMENT"
    
    # Check if seed file exists
    if [ ! -f "$seed_file" ]; then
        print_error "Seed file not found: $seed_file"
        exit 1
    fi
    
    # Warn if applying to remote
    if [ "$ENVIRONMENT" = "remote" ]; then
        print_warning "Applying seed data to REMOTE database!"
        print_warning "This will add development data to your production database!"
        echo -n "Are you sure you want to continue? (y/N): "
        read -r confirm
        if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
            print_info "Seed operation cancelled"
            exit 0
        fi
    fi
    
    # Apply seed data
    print_info "Executing seed file: $seed_file"
    $wrangler_cmd d1 execute $env_flag --file="$seed_file"
    
    if [ $? -eq 0 ]; then
        print_status "Seed data applied successfully"
    else
        print_error "Failed to apply seed data"
        exit 1
    fi
}

# Reset database
reset_database() {
    local wrangler_cmd=$(get_wrangler_cmd)
    local env_flag=$(get_env_flag)
    
    print_warning "Resetting database - Environment: $ENVIRONMENT"
    print_warning "This will DESTROY ALL DATA in the database!"
    
    # Double confirmation for remote
    if [ "$ENVIRONMENT" = "remote" ]; then
        print_error "DANGER: You are about to reset the REMOTE database!"
        print_error "This will permanently delete all production data!"
        echo -n "Type 'RESET REMOTE DATABASE' to confirm: "
        read -r confirm
        if [ "$confirm" != "RESET REMOTE DATABASE" ]; then
            print_info "Reset operation cancelled"
            exit 0
        fi
    else
        echo -n "Are you sure you want to reset the database? (y/N): "
        read -r confirm
        if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
            print_info "Reset operation cancelled"
            exit 0
        fi
    fi
    
    # Get list of tables to drop
    print_info "Retrieving table list..."
    tables=$($wrangler_cmd d1 execute $env_flag --command "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'd1_migrations';" --json 2>/dev/null | jq -r '.results[].name' 2>/dev/null || echo "")
    
    if [ -n "$tables" ]; then
        print_info "Dropping tables..."
        for table in $tables; do
            print_verbose "Dropping table: $table"
            $wrangler_cmd d1 execute $env_flag --command "DROP TABLE IF EXISTS $table;"
        done
    fi
    
    # Reset migrations table
    print_info "Resetting migrations table..."
    $wrangler_cmd d1 execute $env_flag --command "DELETE FROM d1_migrations;"
    
    # Reapply all migrations
    print_info "Reapplying all migrations..."
    apply_migrations
    
    print_status "Database reset completed successfully"
}

# Open D1 Studio
open_studio() {
    local wrangler_cmd=$(get_wrangler_cmd)
    local env_flag=$(get_env_flag)
    
    print_info "Opening D1 Studio - Environment: $ENVIRONMENT"
    
    # D1 Studio command
    $wrangler_cmd d1 studio $env_flag
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --local)
                ENVIRONMENT="local"
                shift
                ;;
            --remote)
                ENVIRONMENT="remote"
                shift
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            status)
                OPERATION="status"
                shift
                ;;
            create)
                OPERATION="create"
                shift
                if [[ $# -gt 0 && $1 != --* ]]; then
                    MIGRATION_NAME="$1"
                    shift
                fi
                ;;
            migrate)
                OPERATION="migrate"
                shift
                ;;
            rollback)
                OPERATION="rollback"
                shift
                if [[ $# -gt 0 && $1 != --* ]]; then
                    ROLLBACK_STEPS="$1"
                    shift
                fi
                ;;
            seed)
                OPERATION="seed"
                shift
                ;;
            reset)
                OPERATION="reset"
                shift
                ;;
            studio)
                OPERATION="studio"
                shift
                ;;
            *)
                print_error "Unknown option: $1"
                usage
                exit 1
                ;;
        esac
    done
}

# Main execution
main() {
    # Parse arguments
    parse_args "$@"
    
    # Show help if no operation specified
    if [ -z "$OPERATION" ]; then
        usage
        exit 0
    fi
    
    # Check dependencies
    check_dependencies
    
    # Print environment info
    print_verbose "Environment: $ENVIRONMENT"
    print_verbose "Operation: $OPERATION"
    
    # Execute operation
    case $OPERATION in
        status)
            show_status
            ;;
        create)
            create_migration "$MIGRATION_NAME"
            ;;
        migrate)
            apply_migrations
            ;;
        rollback)
            rollback_migrations "$ROLLBACK_STEPS"
            ;;
        seed)
            apply_seed_data
            ;;
        reset)
            reset_database
            ;;
        studio)
            open_studio
            ;;
        *)
            print_error "Unknown operation: $OPERATION"
            usage
            exit 1
            ;;
    esac
}

# Execute main function with all arguments
main "$@"