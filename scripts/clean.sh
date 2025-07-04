#!/usr/bin/env bash

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Default flags
CLEAN_DEPS=false
CLEAN_ALL=false

# Usage function
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Clean build artifacts and temporary files from the project.

OPTIONS:
    --deps      Also clean node_modules directory
    --all       Clean everything including dependencies
    -h, --help  Show this help message

EXAMPLES:
    $0              # Clean build artifacts only
    $0 --deps       # Clean build artifacts and node_modules
    $0 --all        # Clean everything

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --deps)
            CLEAN_DEPS=true
            shift
            ;;
        --all)
            CLEAN_ALL=true
            CLEAN_DEPS=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo -e "${RED}Error: Unknown option $1${NC}"
            usage
            exit 1
            ;;
    esac
done

# Change to project root
cd "$PROJECT_ROOT"

echo -e "${YELLOW}Starting cleanup...${NC}"

# Function to safely remove directories/files
safe_remove() {
    local path=$1
    local description=$2
    
    if [[ -e "$path" ]]; then
        echo -e "  Removing ${description}..."
        rm -rf "$path"
        echo -e "  ${GREEN}✓${NC} ${description} removed"
    else
        echo -e "  ${GREEN}✓${NC} ${description} already clean"
    fi
}

# Function to clean pattern-matched files
clean_pattern() {
    local pattern=$1
    local description=$2
    local count=0
    
    # Use find to locate files matching pattern
    while IFS= read -r -d '' file; do
        rm -f "$file"
        ((count++))
    done < <(find . -name "$pattern" -type f -print0 2>/dev/null)
    
    if [[ $count -gt 0 ]]; then
        echo -e "  ${GREEN}✓${NC} Removed ${count} ${description}"
    else
        echo -e "  ${GREEN}✓${NC} No ${description} found"
    fi
}

echo -e "\n${YELLOW}Cleaning build artifacts...${NC}"

# Clean TypeScript/JavaScript build artifacts
safe_remove "dist" "dist directory"
safe_remove "build" "build directory"
safe_remove ".next" ".next directory"
safe_remove "out" "out directory"

# Clean test coverage
safe_remove "coverage" "coverage directory"
safe_remove ".nyc_output" ".nyc_output directory"

# Clean Cloudflare Wrangler cache
safe_remove ".wrangler" "Wrangler cache"
safe_remove ".mf" ".mf directory"

# Clean temporary and cache directories
safe_remove ".cache" ".cache directory"
safe_remove ".tmp" ".tmp directory"
safe_remove "tmp" "tmp directory"
safe_remove ".turbo" "Turbo cache"

# Clean log files
echo -e "\n${YELLOW}Cleaning log files...${NC}"
clean_pattern "*.log" "log files"
clean_pattern "npm-debug.log*" "npm debug logs"
clean_pattern "yarn-debug.log*" "yarn debug logs"
clean_pattern "yarn-error.log*" "yarn error logs"
clean_pattern "pnpm-debug.log*" "pnpm debug logs"

# Clean other temporary files
echo -e "\n${YELLOW}Cleaning temporary files...${NC}"
clean_pattern ".DS_Store" ".DS_Store files"
clean_pattern "*.swp" "swap files"
clean_pattern "*.swo" "swap files"
clean_pattern "*~" "backup files"
clean_pattern "*.tmp" "temporary files"

# Clean TypeScript cache files
clean_pattern "*.tsbuildinfo" "TypeScript build info files"

# Clean package manager locks (only if --all)
if [[ "$CLEAN_ALL" == true ]]; then
    echo -e "\n${YELLOW}Cleaning package manager files...${NC}"
    safe_remove "package-lock.json" "package-lock.json"
    safe_remove "yarn.lock" "yarn.lock"
    safe_remove "pnpm-lock.yaml" "pnpm-lock.yaml"
fi

# Clean node_modules if requested
if [[ "$CLEAN_DEPS" == true ]]; then
    echo -e "\n${YELLOW}Cleaning dependencies...${NC}"
    safe_remove "node_modules" "node_modules directory"
    
    # Also clean any nested node_modules (monorepo support)
    local nested_count=0
    while IFS= read -r -d '' dir; do
        if [[ "$dir" != "./node_modules" ]]; then
            rm -rf "$dir"
            ((nested_count++))
        fi
    done < <(find . -name "node_modules" -type d -prune -print0 2>/dev/null)
    
    if [[ $nested_count -gt 0 ]]; then
        echo -e "  ${GREEN}✓${NC} Removed ${nested_count} nested node_modules directories"
    fi
fi

# Clean Python artifacts if present
if [[ -d "__pycache__" ]] || find . -name "*.pyc" -type f -print -quit 2>/dev/null | grep -q .; then
    echo -e "\n${YELLOW}Cleaning Python artifacts...${NC}"
    clean_pattern "*.pyc" "Python cache files"
    clean_pattern "*.pyo" "Python optimized files"
    
    # Remove __pycache__ directories
    local pycache_count=0
    while IFS= read -r -d '' dir; do
        rm -rf "$dir"
        ((pycache_count++))
    done < <(find . -name "__pycache__" -type d -print0 2>/dev/null)
    
    if [[ $pycache_count -gt 0 ]]; then
        echo -e "  ${GREEN}✓${NC} Removed ${pycache_count} __pycache__ directories"
    fi
fi

# Summary
echo -e "\n${GREEN}✅ Cleanup complete!${NC}"

# Show disk space saved (if available)
if command -v du >/dev/null 2>&1; then
    # Get current directory size
    CURRENT_SIZE=$(du -sh . 2>/dev/null | cut -f1)
    echo -e "\nCurrent project size: ${YELLOW}${CURRENT_SIZE}${NC}"
fi

# Remind about reinstalling dependencies if cleaned
if [[ "$CLEAN_DEPS" == true ]]; then
    echo -e "\n${YELLOW}Note:${NC} Dependencies were removed. Run 'npm install' to reinstall."
fi