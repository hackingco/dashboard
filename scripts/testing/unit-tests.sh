#!/bin/bash
# Consolidated Unit Test Runner
# Runs unit tests across all workspaces with clear feedback

set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# Test results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
START_TIME=$(date +%s)

# Configuration
COVERAGE=${COVERAGE:-false}
VERBOSE=${VERBOSE:-false}
OUTPUT_DIR=${OUTPUT_DIR:-"test-results"}

# Utility functions
info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
success() { echo -e "${GREEN}✅ $1${NC}"; }
warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
error() { echo -e "${RED}❌ $1${NC}"; }
progress() { echo -e "${YELLOW}🔄 $1${NC}"; }

# Usage function
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Consolidated unit test runner for the swarm project.

OPTIONS:
    -c, --coverage           Generate test coverage reports
    -v, --verbose            Verbose output
    -o, --output DIR         Output directory for reports [default: test-results]
    -h, --help               Show this help message

EXAMPLES:
    $0                       # Run all unit tests
    $0 -c                    # Run with coverage
    $0 -v -o custom-results  # Verbose with custom output dir

EOF
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -c|--coverage)
                COVERAGE=true
                shift
                ;;
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -o|--output)
                OUTPUT_DIR="$2"
                shift 2
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            *)
                echo -e "${RED}❌ Unknown option: $1${NC}"
                usage
                exit 1
                ;;
        esac
    done
}

# Setup test environment
setup_environment() {
    info "Setting up test environment..."
    
    # Create output directory
    mkdir -p "$OUTPUT_DIR"
    
    # Validate Node.js environment
    if ! node --version > /dev/null 2>&1; then
        error "Node.js is not installed or not in PATH"
        exit 1
    fi

    if ! npm --version > /dev/null 2>&1; then
        error "npm is not installed or not in PATH"
        exit 1
    fi

    # Set test environment variables
    export NODE_ENV="test"
    export CI=true
    
    success "Environment setup complete"
}

# Function to run a test suite
run_test_suite() {
    local suite_name=$1
    local test_command=$2
    local workspace_dir=$3
    local suite_start=$(date +%s)
    
    echo ""
    info "Running ${suite_name}..."
    
    # Create test output file
    local test_output="${OUTPUT_DIR}/${suite_name}-$(date +%Y%m%d-%H%M%S).log"
    
    # Change to workspace directory
    cd "$workspace_dir"
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        progress "Installing dependencies for ${suite_name}..."
        npm install --silent || {
            error "Failed to install dependencies for ${suite_name}"
            ((FAILED_TESTS++))
            ((TOTAL_TESTS++))
            cd - > /dev/null
            return 1
        }
    fi
    
    # Run tests and capture output
    if eval "$test_command" > "$test_output" 2>&1; then
        local suite_end=$(date +%s)
        local duration=$((suite_end - suite_start))
        success "${suite_name} passed (${duration}s)"
        ((PASSED_TESTS++))
        
        # Extract test count from output if available
        if grep -q "passing\|✓" "$test_output"; then
            local count=$(grep -oE '[0-9]+ (passing|✓)' "$test_output" | grep -oE '[0-9]+' | head -1)
            if [ -n "$count" ]; then
                echo "  ✓ ${count} tests passed"
            fi
        fi
        
        # Show coverage summary if enabled
        if [ "$COVERAGE" = true ] && grep -q "coverage" "$test_output"; then
            echo "  📊 Coverage report generated"
        fi
    else
        local suite_end=$(date +%s)
        local duration=$((suite_end - suite_start))
        error "${suite_name} failed (${duration}s)"
        ((FAILED_TESTS++))
        
        # Show failure details
        echo "  Failure output:"
        tail -n 10 "$test_output" | sed 's/^/    /'
        if [ "$VERBOSE" = true ]; then
            echo "  Full output: $test_output"
        fi
    fi
    
    ((TOTAL_TESTS++))
    cd - > /dev/null
}

# Main test execution
main() {
    parse_args "$@"
    
    echo ""
    echo -e "${BLUE}🧪 Consolidated Unit Test Runner${NC}"
    echo -e "${BLUE}=================================${NC}\n"
    
    echo -e "${YELLOW}Configuration:${NC}"
    echo -e "  Coverage: ${COVERAGE:+Enabled}${COVERAGE:-Disabled}"
    echo -e "  Verbose: ${VERBOSE:+Enabled}${VERBOSE:-Disabled}"
    echo -e "  Output: $OUTPUT_DIR"
    echo ""
    
    setup_environment
    
    # Manager API unit tests
    if [ -d "apps/manager" ] && [ -f "apps/manager/package.json" ]; then
        local coverage_flag=""
        if [ "$COVERAGE" = true ]; then
            coverage_flag="--coverage"
        fi
        run_test_suite "Manager API" "npm test $coverage_flag" "apps/manager"
    else
        warning "Manager API workspace not found, skipping"
    fi
    
    # Admin Dashboard unit tests
    if [ -d "admin-dashboard" ] && [ -f "admin-dashboard/package.json" ]; then
        local coverage_flag=""
        if [ "$COVERAGE" = true ]; then
            coverage_flag="-- --coverage"
        fi
        run_test_suite "Admin Dashboard" "npm test -- --watchAll=false $coverage_flag" "admin-dashboard"
    else
        warning "Admin Dashboard workspace not found, skipping"
    fi
    
    # Shared types tests
    if [ -d "shared/types" ] && [ -f "shared/types/package.json" ]; then
        run_test_suite "Shared Types" "npm test" "shared/types"
    else
        info "Shared Types workspace has no tests, skipping"
    fi
    
    # Calculate final results
    local END_TIME=$(date +%s)
    local TOTAL_DURATION=$((END_TIME - START_TIME))
    
    # Generate test summary
    echo ""
    echo -e "${BLUE}📊 Test Summary${NC}"
    echo "==============="
    echo "Total Suites: ${TOTAL_TESTS}"
    echo -e "${GREEN}✅ Passed: ${PASSED_TESTS}${NC}"
    echo -e "${RED}❌ Failed: ${FAILED_TESTS}${NC}"
    echo -e "⏳ Duration: ${TOTAL_DURATION}s"
    echo ""
    
    # Generate JSON report
    local report_file="$OUTPUT_DIR/unit-test-report.json"
    cat > "$report_file" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "type": "unit-tests",
  "duration": ${TOTAL_DURATION},
  "total": ${TOTAL_TESTS},
  "passed": ${PASSED_TESTS},
  "failed": ${FAILED_TESTS},
  "success": $([ $FAILED_TESTS -eq 0 ] && echo "true" || echo "false"),
  "coverage": ${COVERAGE}
}
EOF
    
    # Copy coverage reports if enabled
    if [ "$COVERAGE" = true ]; then
        for workspace in "apps/manager" "admin-dashboard"; do
            if [ -d "$workspace/coverage" ]; then
                cp -r "$workspace/coverage" "$OUTPUT_DIR/${workspace//\//-}-coverage"
                info "Coverage report copied for $workspace"
            fi
        done
    fi
    
    # Final status
    if [ $FAILED_TESTS -eq 0 ]; then
        success "All unit tests passed! 🎉"
        info "Test report saved to: $report_file"
        exit 0
    else
        error "${FAILED_TESTS} test suite(s) failed"
        warning "Please check the logs for details"
        info "Test report saved to: $report_file"
        exit 1
    fi
}

# Execute main function
main "$@"