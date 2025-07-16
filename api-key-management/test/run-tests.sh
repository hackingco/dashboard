#!/bin/bash

# API Key Management Test Runner
# Comprehensive test execution with reporting

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test configuration
TEST_DIR="$(dirname "$0")"
PROJECT_ROOT="$(dirname "$TEST_DIR")"
COVERAGE_DIR="$PROJECT_ROOT/coverage"

echo -e "${BLUE}🧪 API Key Management Test Suite${NC}"
echo "=================================="

# Function to run test suite
run_test_suite() {
    local suite=$1
    local description=$2
    
    echo -e "\n${YELLOW}Running $description...${NC}"
    
    if npm run test:$suite; then
        echo -e "${GREEN}✅ $description passed${NC}"
        return 0
    else
        echo -e "${RED}❌ $description failed${NC}"
        return 1
    fi
}

# Function to check prerequisites
check_prerequisites() {
    echo -e "\n${BLUE}Checking prerequisites...${NC}"
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Node.js is not installed${NC}"
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}❌ npm is not installed${NC}"
        exit 1
    fi
    
    # Install dependencies if needed
    if [ ! -d "$PROJECT_ROOT/node_modules" ]; then
        echo -e "${YELLOW}Installing dependencies...${NC}"
        cd "$PROJECT_ROOT"
        npm install
    fi
    
    echo -e "${GREEN}✅ Prerequisites satisfied${NC}"
}

# Function to generate coverage report
generate_coverage_report() {
    echo -e "\n${BLUE}Generating coverage report...${NC}"
    
    npm run test:coverage
    
    if [ -d "$COVERAGE_DIR" ]; then
        echo -e "${GREEN}✅ Coverage report generated at: $COVERAGE_DIR${NC}"
        
        # Display coverage summary
        if [ -f "$COVERAGE_DIR/coverage-summary.json" ]; then
            echo -e "\n${BLUE}Coverage Summary:${NC}"
            node -e "
                const coverage = require('$COVERAGE_DIR/coverage-summary.json');
                const total = coverage.total;
                console.log('  Lines:      ' + total.lines.pct + '%');
                console.log('  Statements: ' + total.statements.pct + '%');
                console.log('  Functions:  ' + total.functions.pct + '%');
                console.log('  Branches:   ' + total.branches.pct + '%');
            "
        fi
    fi
}

# Main test execution
main() {
    local failed_tests=0
    local test_suite="${1:-all}"
    
    check_prerequisites
    
    cd "$PROJECT_ROOT"
    
    case "$test_suite" in
        "unit")
            run_test_suite "unit" "Unit Tests" || ((failed_tests++))
            ;;
        "integration")
            run_test_suite "integration" "Integration Tests" || ((failed_tests++))
            ;;
        "e2e")
            run_test_suite "e2e" "End-to-End Tests" || ((failed_tests++))
            ;;
        "coverage")
            generate_coverage_report
            ;;
        "ci")
            echo -e "\n${BLUE}Running CI test suite...${NC}"
            npm run test:ci || ((failed_tests++))
            ;;
        "all"|*)
            # Run all test suites
            run_test_suite "unit" "Unit Tests" || ((failed_tests++))
            run_test_suite "integration" "Integration Tests" || ((failed_tests++))
            run_test_suite "e2e" "End-to-End Tests" || ((failed_tests++))
            
            # Generate coverage report
            generate_coverage_report
            ;;
    esac
    
    # Summary
    echo -e "\n${BLUE}Test Summary${NC}"
    echo "============="
    
    if [ $failed_tests -eq 0 ]; then
        echo -e "${GREEN}✅ All tests passed!${NC}"
        exit 0
    else
        echo -e "${RED}❌ $failed_tests test suite(s) failed${NC}"
        exit 1
    fi
}

# Show usage
usage() {
    echo "Usage: $0 [unit|integration|e2e|coverage|ci|all]"
    echo ""
    echo "Options:"
    echo "  unit         Run unit tests only"
    echo "  integration  Run integration tests only"
    echo "  e2e          Run end-to-end tests only"
    echo "  coverage     Generate coverage report"
    echo "  ci           Run CI test suite"
    echo "  all          Run all tests (default)"
    echo ""
    echo "Examples:"
    echo "  $0              # Run all tests"
    echo "  $0 unit         # Run unit tests only"
    echo "  $0 coverage     # Generate coverage report"
}

# Parse arguments
if [ "$1" == "--help" ] || [ "$1" == "-h" ]; then
    usage
    exit 0
fi

# Run tests
main "$1"