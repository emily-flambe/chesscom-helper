#!/bin/bash

# Exit on error
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Parse command line arguments
FIX_MODE=false
if [[ "$1" == "--fix" ]]; then
    FIX_MODE=true
fi

# Function to print section headers
print_header() {
    echo -e "\n${YELLOW}========================================${NC}"
    echo -e "${YELLOW}$1${NC}"
    echo -e "${YELLOW}========================================${NC}\n"
}

# Function to print success
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Function to print error
print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Track overall status
OVERALL_STATUS=0

# Run TypeScript type checking
print_header "Running TypeScript Type Check"
if npm run typecheck 2>&1; then
    print_success "TypeScript type check passed"
else
    print_error "TypeScript type check failed"
    OVERALL_STATUS=1
fi

# Run ESLint
print_header "Running ESLint"
if [ "$FIX_MODE" = true ]; then
    echo "Running ESLint with automatic fixes..."
    
    # Capture the output of ESLint with fix
    ESLINT_OUTPUT=$(npm run lint:fix 2>&1 || true)
    ESLINT_EXIT_CODE=$?
    
    echo "$ESLINT_OUTPUT"
    
    # Check if any files were fixed
    if echo "$ESLINT_OUTPUT" | grep -q "problems.*fixed"; then
        print_success "ESLint fixed some issues automatically"
        
        # Run ESLint again to check if all issues were fixed
        if npm run lint >/dev/null 2>&1; then
            print_success "All ESLint issues resolved"
        else
            print_error "Some ESLint issues remain that require manual fixes"
            OVERALL_STATUS=1
        fi
    elif [ $ESLINT_EXIT_CODE -eq 0 ]; then
        print_success "No ESLint issues found"
    else
        print_error "ESLint found issues that couldn't be automatically fixed"
        OVERALL_STATUS=1
    fi
else
    # Just run the linter without fixing
    if npm run lint 2>&1; then
        print_success "ESLint check passed"
    else
        print_error "ESLint check failed (run with --fix to attempt automatic fixes)"
        OVERALL_STATUS=1
    fi
fi

# Summary
print_header "Lint Summary"
if [ $OVERALL_STATUS -eq 0 ]; then
    print_success "All lint checks passed!"
    echo -e "\n🎉 Your code is clean and ready!"
else
    print_error "Some lint checks failed"
    echo -e "\n💡 Tips:"
    echo "  - Run '$0 --fix' to automatically fix ESLint issues"
    echo "  - Check the output above for specific errors"
    echo "  - TypeScript errors must be fixed manually"
fi

exit $OVERALL_STATUS