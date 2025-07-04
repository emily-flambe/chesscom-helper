#!/bin/bash

# Chess.com Helper - Environment Configuration Script
# This script creates and configures environment files for different deployment environments

set -e  # Exit on any error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Global variables
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENVIRONMENT="local"
FORCE_OVERWRITE=false

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

log_step() {
    echo -e "${CYAN}[STEP]${NC} $1"
}

# Generate secure random values
generate_random_hex() {
    local length="${1:-32}"
    if command -v openssl >/dev/null 2>&1; then
        openssl rand -hex "$length"
    elif command -v head >/dev/null 2>&1 && [ -e /dev/urandom ]; then
        head -c "$length" /dev/urandom | xxd -p -c "$length"
    else
        # Fallback for systems without openssl or /dev/urandom
        date +%s | sha256sum | head -c "$((length * 2))"
    fi
}

generate_random_base64() {
    local length="${1:-32}"
    if command -v openssl >/dev/null 2>&1; then
        openssl rand -base64 "$length" | tr -d '\n'
    elif command -v head >/dev/null 2>&1 && [ -e /dev/urandom ]; then
        head -c "$length" /dev/urandom | base64 | tr -d '\n'
    else
        # Fallback
        date +%s | sha256sum | base64 | head -c "$length"
    fi
}

generate_jwt_secret() {
    generate_random_base64 64
}

generate_session_key() {
    generate_random_hex 32
}

# Validate environment variables
validate_env_vars() {
    local env_file="$1"
    local errors=0
    
    log_step "Validating environment variables in $env_file"
    
    # Check required variables
    local required_vars=(
        "JWT_SECRET"
        "JWT_ISSUER"
        "JWT_AUDIENCE"
        "SESSION_ENCRYPTION_KEY"
        "BCRYPT_ROUNDS"
        "ENVIRONMENT"
    )
    
    for var in "${required_vars[@]}"; do
        if ! grep -q "^${var}=" "$env_file" 2>/dev/null; then
            log_error "Required variable $var is missing from $env_file"
            ((errors++))
        fi
    done
    
    # Validate JWT_SECRET length
    if [ -f "$env_file" ]; then
        local jwt_secret=$(grep "^JWT_SECRET=" "$env_file" | cut -d'=' -f2- | tr -d '"')
        if [ ${#jwt_secret} -lt 32 ]; then
            log_error "JWT_SECRET must be at least 32 characters long"
            ((errors++))
        fi
    fi
    
    if [ $errors -eq 0 ]; then
        log_success "Environment variables validation passed"
        return 0
    else
        log_error "Environment variables validation failed with $errors errors"
        return 1
    fi
}

# Create environment file
create_env_file() {
    local env_name="$1"
    local env_file="$PROJECT_ROOT/.env.$env_name"
    
    # Handle special case for local environment
    if [ "$env_name" = "local" ]; then
        env_file="$PROJECT_ROOT/.env"
    fi
    
    log_step "Creating environment file: $env_file"
    
    # Check if file exists and handle overwrite
    if [ -f "$env_file" ] && [ "$FORCE_OVERWRITE" != true ]; then
        log_warning "Environment file already exists: $env_file"
        echo -n "Do you want to overwrite it? [y/N]: "
        read -r response
        if [[ ! "$response" =~ ^[Yy]$ ]]; then
            log_info "Skipping $env_file creation"
            return 0
        fi
    fi
    
    # Generate secure values
    local jwt_secret=$(generate_jwt_secret)
    local session_key=$(generate_session_key)
    local bcrypt_rounds="12"
    
    # Set environment-specific values
    local jwt_issuer="chesscom-helper-${env_name}"
    local jwt_audience="chesscom-helper-users"
    local db_name="chesscom-helper-${env_name}"
    
    # Create the environment file
    cat > "$env_file" << EOF
# Chess.com Helper Environment Configuration
# Generated on $(date)
# Environment: $env_name

# =============================================================================
# CORE ENVIRONMENT SETTINGS
# =============================================================================

# Environment name (local, staging, production)
ENVIRONMENT=$env_name

# Node.js environment
NODE_ENV=$([ "$env_name" = "local" ] && echo "development" || echo "production")

# =============================================================================
# JWT AUTHENTICATION SETTINGS
# =============================================================================

# JWT secret key - KEEP THIS SECURE!
# This is used to sign and verify JWT tokens
JWT_SECRET=$jwt_secret

# JWT issuer - identifies who issued the token
JWT_ISSUER=$jwt_issuer

# JWT audience - identifies who the token is intended for
JWT_AUDIENCE=$jwt_audience

# =============================================================================
# SESSION MANAGEMENT
# =============================================================================

# Session encryption key - KEEP THIS SECURE!
# Used to encrypt session data
SESSION_ENCRYPTION_KEY=$session_key

# =============================================================================
# PASSWORD SECURITY
# =============================================================================

# bcrypt rounds - higher = more secure but slower
# Recommended: 12 for production, 10 for development
BCRYPT_ROUNDS=$bcrypt_rounds

# =============================================================================
# DATABASE CONFIGURATION
# =============================================================================

# D1 Database name (configured in wrangler.toml)
DB_NAME=$db_name

# =============================================================================
# RATE LIMITING
# =============================================================================

# Rate limiting settings
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
AUTH_RATE_LIMIT_WINDOW_MS=900000
AUTH_RATE_LIMIT_MAX_REQUESTS=5

# =============================================================================
# EXTERNAL SERVICES
# =============================================================================

# Chess.com API settings
CHESS_COM_API_BASE_URL=https://api.chess.com/pub
CHESS_COM_USER_AGENT=Chess.com-Helper/1.0

# Email service settings (if using external email service)
# EMAIL_SERVICE_API_KEY=your-email-service-api-key
# EMAIL_FROM_ADDRESS=noreply@yourdomain.com
# EMAIL_FROM_NAME=Chess.com Helper

# =============================================================================
# SECURITY SETTINGS
# =============================================================================

# CORS settings
CORS_ALLOWED_ORIGINS=$([ "$env_name" = "local" ] && echo "http://localhost:*,https://localhost:*" || echo "https://yourdomain.com")

# Security headers
SECURITY_HEADERS_ENABLED=true

# =============================================================================
# DEVELOPMENT SETTINGS (local environment only)
# =============================================================================

EOF

    # Add development-specific settings for local environment
    if [ "$env_name" = "local" ]; then
        cat >> "$env_file" << 'EOF'
# Development-only settings
DEBUG=true
LOG_LEVEL=debug

# Local development ports
DEV_PORT=8787
DEV_HOST=localhost

# Disable certain security features for local development
DISABLE_RATE_LIMITING=false
ALLOW_HTTP_COOKIES=true

EOF
    fi
    
    # Add production-specific settings for non-local environments
    if [ "$env_name" != "local" ]; then
        cat >> "$env_file" << 'EOF'
# Production settings
DEBUG=false
LOG_LEVEL=info

# Production security settings
FORCE_HTTPS=true
SECURE_COOKIES=true
STRICT_TRANSPORT_SECURITY=true

EOF
    fi
    
    # Set secure file permissions
    chmod 600 "$env_file"
    
    log_success "Created environment file: $env_file"
    
    # Validate the created file
    if ! validate_env_vars "$env_file"; then
        log_error "Environment file validation failed"
        return 1
    fi
    
    return 0
}

# Create environment template
create_env_template() {
    local template_file="$PROJECT_ROOT/.env.template"
    
    log_step "Creating environment template: $template_file"
    
    cat > "$template_file" << 'EOF'
# Chess.com Helper Environment Configuration Template
# Copy this file to .env and fill in the values

# =============================================================================
# CORE ENVIRONMENT SETTINGS
# =============================================================================

# Environment name (local, staging, production)
ENVIRONMENT=local

# Node.js environment
NODE_ENV=development

# =============================================================================
# JWT AUTHENTICATION SETTINGS
# =============================================================================

# JWT secret key - GENERATE A SECURE RANDOM VALUE!
JWT_SECRET=your-jwt-secret-here

# JWT issuer - identifies who issued the token
JWT_ISSUER=chesscom-helper-local

# JWT audience - identifies who the token is intended for
JWT_AUDIENCE=chesscom-helper-users

# =============================================================================
# SESSION MANAGEMENT
# =============================================================================

# Session encryption key - GENERATE A SECURE RANDOM VALUE!
SESSION_ENCRYPTION_KEY=your-session-encryption-key-here

# =============================================================================
# PASSWORD SECURITY
# =============================================================================

# bcrypt rounds - higher = more secure but slower
BCRYPT_ROUNDS=12

# =============================================================================
# DATABASE CONFIGURATION
# =============================================================================

# D1 Database name (configured in wrangler.toml)
DB_NAME=chesscom-helper-local

# =============================================================================
# RATE LIMITING
# =============================================================================

# Rate limiting settings
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
AUTH_RATE_LIMIT_WINDOW_MS=900000
AUTH_RATE_LIMIT_MAX_REQUESTS=5

# =============================================================================
# EXTERNAL SERVICES
# =============================================================================

# Chess.com API settings
CHESS_COM_API_BASE_URL=https://api.chess.com/pub
CHESS_COM_USER_AGENT=Chess.com-Helper/1.0

# Email service settings (if using external email service)
# EMAIL_SERVICE_API_KEY=your-email-service-api-key
# EMAIL_FROM_ADDRESS=noreply@yourdomain.com
# EMAIL_FROM_NAME=Chess.com Helper

# =============================================================================
# SECURITY SETTINGS
# =============================================================================

# CORS settings
CORS_ALLOWED_ORIGINS=http://localhost:*,https://localhost:*

# Security headers
SECURITY_HEADERS_ENABLED=true

# =============================================================================
# DEVELOPMENT SETTINGS
# =============================================================================

# Development-only settings
DEBUG=true
LOG_LEVEL=debug

# Local development ports
DEV_PORT=8787
DEV_HOST=localhost

# Disable certain security features for local development
DISABLE_RATE_LIMITING=false
ALLOW_HTTP_COOKIES=true

EOF
    
    chmod 644 "$template_file"
    log_success "Created environment template: $template_file"
}

# Display environment guidance
display_env_guidance() {
    local env_name="$1"
    local env_file="$PROJECT_ROOT/.env"
    
    if [ "$env_name" != "local" ]; then
        env_file="$PROJECT_ROOT/.env.$env_name"
    fi
    
    echo ""
    echo -e "${GREEN}=== Environment Configuration Complete ===${NC}"
    echo ""
    echo -e "${BLUE}Created environment file:${NC} $env_file"
    echo ""
    echo -e "${YELLOW}⚠️  IMPORTANT SECURITY NOTES:${NC}"
    echo ""
    echo "1. 🔐 NEVER commit environment files to version control"
    echo "   - Add .env* to your .gitignore file"
    echo "   - These files contain sensitive secrets"
    echo ""
    echo "2. 🔑 Secure your secrets:"
    echo "   - JWT_SECRET: Used to sign authentication tokens"
    echo "   - SESSION_ENCRYPTION_KEY: Used to encrypt session data"
    echo "   - Store these securely in production"
    echo ""
    echo "3. 🌐 Configure your Cloudflare Workers:"
    echo "   - Set environment variables in Cloudflare dashboard"
    echo "   - Or use: wrangler secret put <SECRET_NAME>"
    echo ""
    echo -e "${BLUE}Next steps for $env_name environment:${NC}"
    echo ""
    
    if [ "$env_name" = "local" ]; then
        echo "1. Review and customize settings in .env"
        echo "2. Start development server: npm run dev"
        echo "3. Test authentication endpoints"
        echo ""
        echo -e "${CYAN}Local development URLs:${NC}"
        echo "- Health check: http://localhost:8787/health"
        echo "- Main app: http://localhost:8787/"
        echo "- Auth endpoints: http://localhost:8787/api/auth/*"
    else
        echo "1. Review settings in .env.$env_name"
        echo "2. Upload secrets to Cloudflare Workers:"
        echo "   wrangler secret put JWT_SECRET --env $env_name"
        echo "   wrangler secret put SESSION_ENCRYPTION_KEY --env $env_name"
        echo "3. Deploy: wrangler deploy --env $env_name"
        echo "4. Test your deployment"
    fi
    
    echo ""
    echo -e "${GREEN}✅ Environment setup complete!${NC}"
    echo ""
}

# Update gitignore
update_gitignore() {
    local gitignore_file="$PROJECT_ROOT/.gitignore"
    
    log_step "Updating .gitignore to exclude environment files"
    
    # Create .gitignore if it doesn't exist
    if [ ! -f "$gitignore_file" ]; then
        touch "$gitignore_file"
    fi
    
    # Add environment file patterns if not already present
    local patterns=(
        ".env"
        ".env.local"
        ".env.development"
        ".env.staging"
        ".env.production"
        ".env.*.local"
    )
    
    for pattern in "${patterns[@]}"; do
        if ! grep -q "^$pattern$" "$gitignore_file" 2>/dev/null; then
            echo "$pattern" >> "$gitignore_file"
        fi
    done
    
    log_success "Updated .gitignore with environment file patterns"
}

# Check for required dependencies
check_dependencies() {
    log_step "Checking for required dependencies"
    
    # Check for openssl or alternative random generators
    if ! command -v openssl >/dev/null 2>&1; then
        if [ ! -e /dev/urandom ]; then
            log_warning "Neither openssl nor /dev/urandom found. Using fallback random generation."
            log_warning "For better security, consider installing openssl."
        fi
    fi
    
    # Check if we're in a Git repository
    if [ ! -d "$PROJECT_ROOT/.git" ]; then
        log_warning "Not in a Git repository. Skipping .gitignore update."
        return 0
    fi
    
    log_success "Dependency check complete"
}

# Display usage information
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS] [ENVIRONMENT]

Create and configure environment files for Chess.com Helper.

ARGUMENTS:
  ENVIRONMENT    Environment to configure (local, staging, production)
                 Default: local

OPTIONS:
  -f, --force    Force overwrite existing files
  -t, --template Create environment template only
  -v, --validate Validate existing environment file
  -h, --help     Show this help message

EXAMPLES:
  $0                     # Create local environment (.env)
  $0 staging             # Create staging environment (.env.staging)
  $0 production          # Create production environment (.env.production)
  $0 --template          # Create environment template (.env.template)
  $0 --validate local    # Validate .env file
  $0 --force production  # Force overwrite .env.production

SECURITY NOTES:
  - Generated secrets are cryptographically secure
  - Environment files are created with restricted permissions (600)
  - Files are automatically added to .gitignore
  - Never commit environment files to version control

EOF
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -f|--force)
                FORCE_OVERWRITE=true
                shift
                ;;
            -t|--template)
                create_env_template
                exit 0
                ;;
            -v|--validate)
                if [ -z "$2" ]; then
                    log_error "Environment name required for validation"
                    exit 1
                fi
                local env_file="$PROJECT_ROOT/.env"
                if [ "$2" != "local" ]; then
                    env_file="$PROJECT_ROOT/.env.$2"
                fi
                validate_env_vars "$env_file"
                exit $?
                ;;
            -h|--help)
                show_usage
                exit 0
                ;;
            -*)
                log_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
            *)
                if [[ "$1" =~ ^(local|staging|production)$ ]]; then
                    ENVIRONMENT="$1"
                else
                    log_error "Invalid environment: $1"
                    log_error "Valid environments: local, staging, production"
                    exit 1
                fi
                shift
                ;;
        esac
    done
}

# Main function
main() {
    echo -e "${BLUE}=== Chess.com Helper - Environment Setup ===${NC}"
    echo ""
    
    # Change to project root
    cd "$PROJECT_ROOT"
    
    # Check if we're in the right directory
    if [ ! -f "package.json" ]; then
        log_error "package.json not found. Please run this script from the project root."
        exit 1
    fi
    
    # Check dependencies
    check_dependencies
    
    # Create environment file
    if ! create_env_file "$ENVIRONMENT"; then
        log_error "Failed to create environment file"
        exit 1
    fi
    
    # Update .gitignore
    update_gitignore
    
    # Display guidance
    display_env_guidance "$ENVIRONMENT"
}

# Handle script interruption
cleanup() {
    echo ""
    log_warning "Environment setup interrupted."
    exit 1
}

# Set up signal handlers
trap cleanup INT TERM

# Parse arguments and run main function
parse_args "$@"
main