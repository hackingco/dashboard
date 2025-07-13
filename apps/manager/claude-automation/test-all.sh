#!/bin/bash
# Comprehensive Test Runner with Clear Feedback

set -euo pipefail

# Import common functions
source "$(dirname "$0")/common-functions.sh"

# Test results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0
START_TIME=$(date +%s)

# Test report file
REPORT_FILE="${REPORT_DIR}/test-report-$(date +%Y%m%d-%H%M%S).json"

# Function to run a test suite
run_test_suite() {
    local suite_name=$1
    local test_command=$2
    local suite_start=$(date +%s)
    
    echo ""
    info "Running ${suite_name}..."
    echo "$(🚀)"
    
    # Create test output file
    local test_output="${LOG_DIR}/${suite_name}-$(date +%Y%m%d-%H%M%S).log"
    
    # Run tests and capture output
    if $test_command > "$test_output" 2>&1; then
        local suite_end=$(date +%s)
        local duration=$((suite_end - suite_start))
        success "${suite_name} passed (${duration}s)"
        ((PASSED_TESTS++))
        
        # Extract test count from output if available
        if grep -q "passing" "$test_output"; then
            local count=$(grep -oE '[0-9]+ passing' "$test_output" | grep -oE '[0-9]+' | head -1)
            echo "  ✓ ${count} tests passed"
        fi
    else
        local suite_end=$(date +%s)
        local duration=$((suite_end - suite_start))
        error "${suite_name} failed (${duration}s)"
        ((FAILED_TESTS++))
        
        # Show failure details
        echo "  Failure output:"
        tail -n 20 "$test_output" | sed 's/^/    /'
        echo "  Full output: $test_output"
    fi
    
    ((TOTAL_TESTS++))
}

# Main test execution
echo ""
echo "$(🧪) Claude Test Runner - Comprehensive Test Suite"
echo "=================================================="
info "Starting test execution at $(date)"
echo ""

# Pre-test validation
progress "Validating test environment..."
if ! node --version > /dev/null 2>&1; then
    error "Node.js is not installed or not in PATH"
    exit 1
fi

if ! npm --version > /dev/null 2>&1; then
    error "npm is not installed or not in PATH"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    progress "Installing dependencies..."
    npm install --silent || {
        error "Failed to install dependencies"
        exit 1
    }
fi

# Run each test suite
run_test_suite "Unit Tests" "npm run test:unit"
run_test_suite "Integration Tests" "npm run test:integration"
run_test_suite "TypeScript Check" "npm run typecheck"
run_test_suite "ESLint" "npm run lint"
run_test_suite "Build Validation" "npm run build"

# Calculate summary
END_TIME=$(date +%s)
TOTAL_DURATION=$((END_TIME - START_TIME))

# Generate test report
echo ""
echo "$(📊) Test Summary"
echo "==============="
echo "Total Suites: ${TOTAL_TESTS}"
echo "$(✅) Passed: ${PASSED_TESTS}"
echo "$(❌) Failed: ${FAILED_TESTS}"
echo "$(⏳) Duration: ${TOTAL_DURATION}s"
echo ""

# Generate JSON report
cat > "$REPORT_FILE" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "duration": ${TOTAL_DURATION},
  "total": ${TOTAL_TESTS},
  "passed": ${PASSED_TESTS},
  "failed": ${FAILED_TESTS},
  "skipped": ${SKIPPED_TESTS},
  "success": $([ $FAILED_TESTS -eq 0 ] && echo "true" || echo "false")
}
EOF

# Exit status
if [ $FAILED_TESTS -eq 0 ]; then
    success "All tests passed! 🎉"
    info "Test report saved to: $REPORT_FILE"
    exit 0
else
    error "${FAILED_TESTS} test suite(s) failed"
    warning "Please check the logs for details"
    info "Test report saved to: $REPORT_FILE"
    exit 1
fi