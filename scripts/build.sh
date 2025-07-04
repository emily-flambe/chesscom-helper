#!/bin/bash

# Production build script for chesscom-helper
# Exit on any error
set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_step() {
    echo -e "${BLUE}==>${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Start build process
echo -e "${BLUE}Starting production build...${NC}"
echo ""

# Check required tools
print_step "Checking required tools..."
MISSING_TOOLS=()

if ! command_exists node; then
    MISSING_TOOLS+=("node")
fi

if ! command_exists npm; then
    MISSING_TOOLS+=("npm")
fi

if [ ${#MISSING_TOOLS[@]} -ne 0 ]; then
    print_error "Missing required tools: ${MISSING_TOOLS[*]}"
    echo "Please install the missing tools and try again."
    exit 1
fi

print_success "All required tools found"
echo ""

# Clean previous builds
print_step "Cleaning previous builds..."
rm -rf dist/ 2>/dev/null || true
rm -rf .parcel-cache/ 2>/dev/null || true
rm -rf coverage/ 2>/dev/null || true
print_success "Cleaned build directories"
echo ""

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    print_step "Installing dependencies..."
    npm ci || {
        print_error "Failed to install dependencies"
        exit 1
    }
    print_success "Dependencies installed"
    echo ""
fi

# Run TypeScript compilation check
print_step "Running TypeScript compilation check..."
npx tsc --noEmit || {
    print_error "TypeScript compilation failed"
    exit 1
}
print_success "TypeScript compilation check passed"
echo ""

# Run linting checks
print_step "Running linting checks..."
npm run lint || {
    print_error "Linting checks failed"
    exit 1
}
print_success "Linting checks passed"
echo ""

# Run tests
print_step "Running tests..."
npm test || {
    print_error "Tests failed"
    exit 1
}
print_success "All tests passed"
echo ""

# Build the extension
print_step "Building extension..."
npm run build || {
    print_error "Build failed"
    exit 1
}
print_success "Extension built successfully"
echo ""

# Display build results
print_step "Build Results:"
echo ""

# Check if dist directory exists
if [ -d "dist" ]; then
    # Get total size of dist directory
    TOTAL_SIZE=$(du -sh dist | cut -f1)
    echo -e "${GREEN}Total build size:${NC} $TOTAL_SIZE"
    echo ""
    
    # List files with sizes
    echo "File sizes:"
    find dist -type f -exec ls -lh {} \; | awk '{printf "  %-40s %s\n", $9, $5}'
    echo ""
    
    # Count files by type
    echo "File counts by type:"
    echo "  JavaScript files: $(find dist -name "*.js" | wc -l)"
    echo "  CSS files: $(find dist -name "*.css" | wc -l)"
    echo "  HTML files: $(find dist -name "*.html" | wc -l)"
    echo "  JSON files: $(find dist -name "*.json" | wc -l)"
    echo "  Other files: $(find dist -type f ! -name "*.js" ! -name "*.css" ! -name "*.html" ! -name "*.json" | wc -l)"
    echo ""
    
    # Check for source maps
    SOURCE_MAPS=$(find dist -name "*.map" | wc -l)
    if [ "$SOURCE_MAPS" -gt 0 ]; then
        print_warning "Found $SOURCE_MAPS source map files in production build"
    fi
else
    print_error "Build directory 'dist' not found"
    exit 1
fi

# Final success message
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ Production build completed successfully!${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo ""
echo "Next steps:"
echo "  1. Test the extension locally"
echo "  2. Create a release package with: npm run package"
echo "  3. Upload to Chrome Web Store"

exit 0