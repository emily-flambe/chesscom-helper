#!/bin/bash
#
# Complete D1 Migration Script
# ===========================
#
# This script runs the complete migration pipeline from PostgreSQL to D1.
# It includes error checking, logging, and automatic cleanup.
#
# Usage:
#   ./run_complete_migration.sh [--dry-run] [--skip-validation]
#
# Prerequisites:
#   - PostgreSQL environment variables set
#   - Cloudflare API environment variables set
#   - Python and Node.js installed
#   - All migration scripts present
#

set -e  # Exit on any error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="migration_${TIMESTAMP}.log"
EXPORT_DIR="migration_data_${TIMESTAMP}"
TRANSFORM_DIR="d1_migration_data_${TIMESTAMP}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Flags
DRY_RUN=false
SKIP_VALIDATION=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --skip-validation)
            SKIP_VALIDATION=true
            shift
            ;;
        --help)
            echo "Usage: $0 [--dry-run] [--skip-validation]"
            echo ""
            echo "Options:"
            echo "  --dry-run          Test run without actual import to D1"
            echo "  --skip-validation  Skip final validation step"
            echo "  --help            Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option $1"
            exit 1
            ;;
    esac
done

# Logging function
log() {
    local level=$1
    shift
    local message="$@"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $level in
        "INFO")
            echo -e "${GREEN}[INFO]${NC} $message" | tee -a "$LOG_FILE"
            ;;
        "WARN")
            echo -e "${YELLOW}[WARN]${NC} $message" | tee -a "$LOG_FILE"
            ;;
        "ERROR")
            echo -e "${RED}[ERROR]${NC} $message" | tee -a "$LOG_FILE"
            ;;
        "DEBUG")
            echo -e "${BLUE}[DEBUG]${NC} $message" | tee -a "$LOG_FILE"
            ;;
    esac
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
}

# Error handler
error_exit() {
    log "ERROR" "Migration failed: $1"
    log "ERROR" "Check $LOG_FILE for detailed error information"
    exit 1
}

# Check prerequisites
check_prerequisites() {
    log "INFO" "Checking prerequisites..."
    
    # Check Python
    if ! command -v python3 &> /dev/null; then
        error_exit "Python 3 is required but not installed"
    fi
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        error_exit "Node.js is required but not installed"
    fi
    
    # Check required environment variables for PostgreSQL
    local postgres_vars=("POSTGRES_HOST" "POSTGRES_DB" "POSTGRES_USER" "POSTGRES_PASSWORD")
    for var in "${postgres_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            error_exit "Required environment variable $var is not set"
        fi
    done
    
    # Check required environment variables for Cloudflare
    if [[ "$DRY_RUN" != true ]]; then
        local cf_vars=("CLOUDFLARE_API_TOKEN" "CLOUDFLARE_ACCOUNT_ID" "D1_DATABASE_ID")
        for var in "${cf_vars[@]}"; do
            if [[ -z "${!var}" ]]; then
                error_exit "Required environment variable $var is not set"
            fi
        done
    fi
    
    # Check if migration scripts exist
    local scripts=("export_postgresql_data.py" "transform_data_for_d1.py" "import_to_d1.js" "validate_migration.py")
    for script in "${scripts[@]}"; do
        if [[ ! -f "$SCRIPT_DIR/$script" ]]; then
            error_exit "Required script $script not found in $SCRIPT_DIR"
        fi
    done
    
    log "INFO" "Prerequisites check passed"
}

# Step 1: Export PostgreSQL data
export_data() {
    log "INFO" "Step 1: Exporting PostgreSQL data..."
    
    cd "$SCRIPT_DIR"
    
    if ! python3 export_postgresql_data.py \
        --output-dir "$EXPORT_DIR" \
        --validate; then
        error_exit "PostgreSQL data export failed"
    fi
    
    # Check if export files were created
    local expected_files=("chesscom_app_user.json" "chesscom_app_emailsubscription.json" "chesscom_app_notificationlog.json")
    for file in "${expected_files[@]}"; do
        if [[ ! -f "$EXPORT_DIR/$file" ]]; then
            error_exit "Expected export file $file was not created"
        fi
    done
    
    log "INFO" "PostgreSQL data export completed successfully"
}

# Step 2: Transform data for D1
transform_data() {
    log "INFO" "Step 2: Transforming data for D1 compatibility..."
    
    cd "$SCRIPT_DIR"
    
    if ! python3 transform_data_for_d1.py \
        --input-dir "$EXPORT_DIR" \
        --output-dir "$TRANSFORM_DIR" \
        --validate; then
        error_exit "Data transformation failed"
    fi
    
    # Check if transformed files were created
    local expected_files=("chesscom_app_user_transformed.json" "chesscom_app_emailsubscription_transformed.json" "chesscom_app_notificationlog_transformed.json")
    for file in "${expected_files[@]}"; do
        if [[ ! -f "$TRANSFORM_DIR/$file" ]]; then
            error_exit "Expected transformed file $file was not created"
        fi
    done
    
    log "INFO" "Data transformation completed successfully"
}

# Step 3: Import to D1
import_data() {
    log "INFO" "Step 3: Importing data to D1..."
    
    cd "$SCRIPT_DIR"
    
    local import_args=(
        "--input-dir" "$TRANSFORM_DIR"
    )
    
    if [[ "$DRY_RUN" == true ]]; then
        import_args+=("--dry-run")
        log "INFO" "Running import in dry-run mode"
    fi
    
    if ! node import_to_d1.js "${import_args[@]}"; then
        error_exit "D1 data import failed"
    fi
    
    log "INFO" "D1 data import completed successfully"
}

# Step 4: Validate migration
validate_migration() {
    if [[ "$SKIP_VALIDATION" == true ]]; then
        log "INFO" "Skipping validation step as requested"
        return 0
    fi
    
    if [[ "$DRY_RUN" == true ]]; then
        log "INFO" "Skipping validation step in dry-run mode"
        return 0
    fi
    
    log "INFO" "Step 4: Validating migration..."
    
    cd "$SCRIPT_DIR"
    
    if ! python3 validate_migration.py \
        --export-dir "$EXPORT_DIR" \
        --transformed-dir "$TRANSFORM_DIR" \
        --detailed; then
        error_exit "Migration validation failed"
    fi
    
    log "INFO" "Migration validation completed successfully"
}

# Generate final report
generate_report() {
    log "INFO" "Generating final migration report..."
    
    local report_file="migration_report_${TIMESTAMP}.json"
    
    cat > "$report_file" << EOF
{
    "migration_timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "migration_id": "${TIMESTAMP}",
    "dry_run": ${DRY_RUN},
    "skip_validation": ${SKIP_VALIDATION},
    "export_directory": "${EXPORT_DIR}",
    "transform_directory": "${TRANSFORM_DIR}",
    "log_file": "${LOG_FILE}",
    "status": "completed",
    "files_created": [
EOF
    
    # List all created files
    local first=true
    for dir in "$EXPORT_DIR" "$TRANSFORM_DIR"; do
        if [[ -d "$dir" ]]; then
            find "$dir" -type f -name "*.json" | while read -r file; do
                if [[ "$first" != true ]]; then
                    echo "," >> "$report_file"
                fi
                first=false
                size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo "0")
                echo "        {" >> "$report_file"
                echo "            \"path\": \"$file\"," >> "$report_file"
                echo "            \"size_bytes\": $size" >> "$report_file"
                echo -n "        }" >> "$report_file"
            done
        fi
    done
    
    cat >> "$report_file" << EOF

    ]
}
EOF
    
    log "INFO" "Migration report saved to: $report_file"
}

# Cleanup function
cleanup() {
    log "INFO" "Migration cleanup..."
    
    # Archive logs
    if [[ -f "$LOG_FILE" ]]; then
        log "INFO" "Migration log saved to: $LOG_FILE"
    fi
    
    # Note: We don't automatically delete migration data directories
    # They should be manually cleaned up after verifying the migration
    log "INFO" "Migration data directories preserved:"
    log "INFO" "  Export data: $EXPORT_DIR"
    log "INFO" "  Transformed data: $TRANSFORM_DIR"
    log "INFO" "These can be safely deleted after verifying the migration"
}

# Main execution
main() {
    local start_time=$(date +%s)
    
    echo "=================================="
    echo "D1 Migration Pipeline"
    echo "=================================="
    echo "Timestamp: $(date)"
    echo "Dry run: $DRY_RUN"
    echo "Skip validation: $SKIP_VALIDATION"
    echo "Log file: $LOG_FILE"
    echo "=================================="
    echo ""
    
    log "INFO" "Starting D1 migration pipeline"
    
    # Set up error handling
    trap 'error_exit "Unexpected error occurred"' ERR
    
    # Run migration steps
    check_prerequisites
    export_data
    transform_data
    import_data
    validate_migration
    generate_report
    cleanup
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log "INFO" "Migration completed successfully in ${duration} seconds"
    
    echo ""
    echo "=================================="
    echo "🎉 Migration Completed Successfully!"
    echo "=================================="
    echo "Duration: ${duration} seconds"
    echo "Log file: $LOG_FILE"
    echo "Export data: $EXPORT_DIR"
    echo "Transformed data: $TRANSFORM_DIR"
    
    if [[ "$DRY_RUN" == true ]]; then
        echo ""
        echo "This was a dry run. No actual data was imported to D1."
        echo "Remove --dry-run flag to perform the actual migration."
    fi
}

# Run main function
main "$@"