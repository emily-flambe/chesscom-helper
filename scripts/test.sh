#!/usr/bin/env bash

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
WATCH_MODE=false
COVERAGE=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --watch|-w)
      WATCH_MODE=true
      shift
      ;;
    --coverage|-c)
      COVERAGE=true
      shift
      ;;
    --help|-h)
      echo "Usage: $0 [options]"
      echo ""
      echo "Options:"
      echo "  --watch, -w     Run tests in watch mode"
      echo "  --coverage, -c  Run tests with coverage report"
      echo "  --help, -h      Show this help message"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      exit 1
      ;;
  esac
done

# Function to handle errors
handle_error() {
  echo -e "\n${RED}✗ Error: $1${NC}"
  exit 1
}

# Function to check if a command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Check if npm is installed
if ! command_exists npm; then
  handle_error "npm is not installed. Please install Node.js and npm first."
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}⚠ node_modules not found. Running npm install...${NC}"
  npm install || handle_error "Failed to install dependencies"
fi

echo -e "${BLUE}🔍 Running TypeScript type checking...${NC}"
npm run typecheck || handle_error "TypeScript type checking failed"

echo -e "\n${GREEN}✓ TypeScript type checking passed${NC}\n"

# Build test command
TEST_CMD="npm run test"

if [ "$WATCH_MODE" = true ]; then
  echo -e "${BLUE}👁  Running tests in watch mode...${NC}"
  TEST_CMD="npm run test:watch"
elif [ "$COVERAGE" = true ]; then
  echo -e "${BLUE}📊 Running tests with coverage...${NC}"
  TEST_CMD="npm run test -- --coverage"
else
  echo -e "${BLUE}🧪 Running tests...${NC}"
fi

# Run tests
if $TEST_CMD; then
  if [ "$WATCH_MODE" = false ]; then
    echo -e "\n${GREEN}✓ All tests passed!${NC}"
    
    # If coverage was requested and generated, show the location
    if [ "$COVERAGE" = true ] && [ -d "coverage" ]; then
      echo -e "\n${BLUE}📊 Coverage report generated:${NC}"
      echo -e "   HTML: file://$(pwd)/coverage/index.html"
      echo -e "   Text: See output above"
    fi
  fi
else
  handle_error "Tests failed"
fi