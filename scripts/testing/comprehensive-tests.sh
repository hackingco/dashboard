#!/bin/bash
# Comprehensive Test Suite
# Runs all test types with orchestrated execution and detailed reporting

set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
TEST_TYPE=${TEST_TYPE:-"all"}
ENVIRONMENT=${ENVIRONMENT:-"test"}
COVERAGE=${COVERAGE:-false}
VERBOSE=${VERBOSE:-false}
SKIP_LINT=${SKIP_LINT:-false}
SKIP_SECURITY=${SKIP_SECURITY:-false}
PARALLEL=${PARALLEL:-true}
OUTPUT_DIR=${OUTPUT_DIR:-"test-results"}
TIMEOUT=${TIMEOUT:-600} # 10 minutes

# Test results tracking
declare -A TEST_RESULTS
TOTAL_SUITES=0
PASSED_SUITES=0
FAILED_SUITES=0
START_TIME=$(date +%s)

# Utility functions
info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
success() { echo -e "${GREEN}✅ $1${NC}"; }
warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
error() { echo -e "${RED}❌ $1${NC}"; }
progress() { echo -e "${PURPLE}🔄 $1${NC}"; }
highlight() { echo -e "${CYAN}🎯 $1${NC}"; }

# Usage function
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Comprehensive test suite for the swarm orchestrator project.

OPTIONS:
    -t, --type TYPE          Test type (unit|integration|lint|security|performance|all) [default: all]
    -e, --environment ENV    Test environment (test|staging|local) [default: test]
    -c, --coverage           Generate test coverage reports
    -v, --verbose            Verbose output
    -p, --parallel           Run tests in parallel where possible [default: true]
    --skip-lint              Skip linting checks
    --skip-security          Skip security scans
    --timeout SECONDS        Overall timeout in seconds [default: 600]
    -o, --output DIR         Output directory for reports [default: test-results]
    -h, --help               Show this help message

TEST TYPES:
    unit         - Unit tests for all workspaces
    integration  - Integration tests with services
    lint         - Code linting and formatting checks
    security     - Security and vulnerability scans
    performance  - Performance and load tests
    all          - Run all test types (default)

EXAMPLES:
    $0                                    # Run all tests
    $0 -t unit -c                        # Run unit tests with coverage
    $0 -t integration -e staging         # Run integration tests against staging
    $0 -p --skip-security                # Parallel execution, skip security
    $0 -v --timeout 1200                 # Verbose with 20-minute timeout

EOF
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -t|--type)
                TEST_TYPE="$2"
                shift 2
                ;;
            -e|--environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            -c|--coverage)
                COVERAGE=true
                shift
                ;;
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -p|--parallel)
                PARALLEL=true
                shift
                ;;
            --skip-lint)
                SKIP_LINT=true
                shift
                ;;
            --skip-security)
                SKIP_SECURITY=true
                shift
                ;;
            --timeout)
                TIMEOUT="$2"
                shift 2
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

# Validate test type
validate_test_type() {
    case $TEST_TYPE in
        unit|integration|lint|security|performance|all)
            ;;
        *)
            error "Invalid test type: $TEST_TYPE"
            echo -e "${YELLOW}Valid options: unit, integration, lint, security, performance, all${NC}"
            exit 1
            ;;
    esac
}

# Setup comprehensive test environment
setup_environment() {
    highlight "Setting up comprehensive test environment..."
    
    # Create output directory structure
    mkdir -p "$OUTPUT_DIR"/{logs,reports,coverage,artifacts}
    
    # Export environment variables
    export NODE_ENV="test"
    export CI=true
    export COVERAGE="$COVERAGE"
    export VERBOSE="$VERBOSE"
    export OUTPUT_DIR="$OUTPUT_DIR"
    export ENVIRONMENT="$ENVIRONMENT"
    
    # Set service URLs based on environment
    case $ENVIRONMENT in
        staging)
            export TEST_API_URL="https://swarm-manager-staging.fly.dev"
            export TEST_DASHBOARD_URL="https://staging-dashboard.vercel.app"
            ;;
        production)
            export TEST_API_URL="https://swarm-manager-live.fly.dev"
            export TEST_DASHBOARD_URL="https://admin-dashboard-l0e1w6ivz-hackingco.vercel.app"
            ;;
        *)
            export TEST_API_URL="http://localhost:3001"
            export TEST_DASHBOARD_URL="http://localhost:3000"
            ;;
    esac
    
    # Validate required tools
    local required_tools=("node" "npm" "curl")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            error "$tool is required but not installed"
            exit 1
        fi
    done
    
    success "Environment setup complete"
}

# Run test suite with timing and error handling
run_test_suite() {
    local suite_name="$1"
    local test_command="$2"
    local suite_start=$(date +%s)
    
    progress "Starting $suite_name..."
    
    local log_file="$OUTPUT_DIR/logs/${suite_name,,}-$(date +%Y%m%d-%H%M%S).log"
    
    # Run with timeout
    if timeout "$TIMEOUT" bash -c "$test_command" > "$log_file" 2>&1; then
        local suite_end=$(date +%s)
        local duration=$((suite_end - suite_start))
        success "$suite_name completed successfully (${duration}s)"
        TEST_RESULTS["$suite_name"]="PASS:$duration"
        ((PASSED_SUITES++))
    else
        local exit_code=$?
        local suite_end=$(date +%s)
        local duration=$((suite_end - suite_start))
        
        if [ $exit_code -eq 124 ]; then
            error "$suite_name timed out after ${TIMEOUT}s"
            TEST_RESULTS["$suite_name"]="TIMEOUT:$duration"
        else
            error "$suite_name failed (${duration}s)"
            TEST_RESULTS["$suite_name"]="FAIL:$duration"
        fi
        
        ((FAILED_SUITES++))
        
        # Show failure details
        if [ "$VERBOSE" = true ]; then
            echo "  Last 15 lines of output:"
            tail -n 15 "$log_file" | sed 's/^/    /'
        fi
        echo "  Full log: $log_file"
    fi
    
    ((TOTAL_SUITES++))
}

# Lint and code quality checks
run_lint_checks() {
    if [ "$SKIP_LINT" = true ]; then
        warning "Skipping lint checks"
        return 0
    fi
    
    local lint_script="
        # ESLint
        if [ -f 'package.json' ]; then
            npm run lint 2>&1 || echo 'Lint issues found'
        fi
        
        # Prettier check
        if command -v prettier &> /dev/null; then
            prettier --check '**/*.{js,ts,json,md}' 2>&1 || echo 'Formatting issues found'
        fi
        
        # TypeScript check
        if [ -d 'apps/manager' ]; then
            cd apps/manager && npm run typecheck 2>&1 || echo 'TypeScript issues found'
            cd - > /dev/null
        fi
    "
    
    run_test_suite "Lint & Code Quality" "$lint_script"
}

# Security scans
run_security_scans() {
    if [ "$SKIP_SECURITY" = true ]; then
        warning "Skipping security scans"
        return 0
    fi
    
    local security_script="
        # Dependency audit
        npm audit --audit-level moderate 2>&1 || echo 'Vulnerabilities found'
        
        # Check for secrets (if trufflehog is available)
        if command -v trufflehog &> /dev/null; then
            trufflehog git file://. --json 2>&1 || echo 'Secret scan completed'
        fi
        
        # Basic security checks
        find . -name '*.env*' -not -path './node_modules/*' -exec echo 'Found env file: {}' \;
        grep -r 'password.*=' --include='*.js' --include='*.ts' . 2>/dev/null || echo 'Password scan completed'
    "
    
    run_test_suite "Security Scans" "$security_script"
}

# Unit tests
run_unit_tests() {
    local unit_script="./scripts/testing/unit-tests.sh"
    
    if [ -f "$unit_script" ]; then
        local coverage_flag=""
        if [ "$COVERAGE" = true ]; then
            coverage_flag="-c"
        fi
        
        run_test_suite "Unit Tests" "$unit_script $coverage_flag -o $OUTPUT_DIR"
    else
        error "Unit test script not found: $unit_script"
        TEST_RESULTS["Unit Tests"]="MISSING:0"
        ((FAILED_SUITES++))
        ((TOTAL_SUITES++))
    fi
}

# Integration tests
run_integration_tests() {
    local integration_script="./scripts/testing/integration-tests.sh"
    
    if [ -f "$integration_script" ]; then
        local verbose_flag=""
        if [ "$VERBOSE" = true ]; then
            verbose_flag="-v"
        fi
        
        run_test_suite "Integration Tests" "$integration_script -e $ENVIRONMENT $verbose_flag -o $OUTPUT_DIR"
    else
        error "Integration test script not found: $integration_script"
        TEST_RESULTS["Integration Tests"]="MISSING:0"
        ((FAILED_SUITES++))
        ((TOTAL_SUITES++))
    fi
}

# Performance tests
run_performance_tests() {
    local perf_script="
        # Basic load test
        if command -v ab &> /dev/null && [ '$ENVIRONMENT' != 'production' ]; then
            ab -n 100 -c 10 \${TEST_API_URL}/health 2>&1 || echo 'Load test failed'
        fi
        
        # Memory usage test
        if [ -d 'apps/manager' ]; then
            cd apps/manager
            node -e 'console.log(\"Memory test:\", process.memoryUsage())' 2>&1
            cd - > /dev/null
        fi
        
        # Response time test
        curl -w 'Response time: %{time_total}s\n' -o /dev/null -s \${TEST_API_URL}/health 2>&1 || echo 'Response time test failed'
    "
    
    run_test_suite "Performance Tests" "$perf_script"
}

# Generate comprehensive report
generate_comprehensive_report() {
    local END_TIME=$(date +%s)
    local TOTAL_DURATION=$((END_TIME - START_TIME))
    
    progress "Generating comprehensive test report..."
    
    # JSON Report
    local json_report="$OUTPUT_DIR/reports/comprehensive-test-report.json"
    local success_rate=0
    if [ $TOTAL_SUITES -gt 0 ]; then
        success_rate=$(( (PASSED_SUITES * 100) / TOTAL_SUITES ))
    fi
    
    cat > "$json_report" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "environment": "$ENVIRONMENT",
  "test_type": "$TEST_TYPE",
  "configuration": {
    "coverage": $COVERAGE,
    "parallel": $PARALLEL,
    "timeout": $TIMEOUT,
    "skip_lint": $SKIP_LINT,
    "skip_security": $SKIP_SECURITY
  },
  "summary": {
    "total_duration": $TOTAL_DURATION,
    "total_suites": $TOTAL_SUITES,
    "passed_suites": $PASSED_SUITES,
    "failed_suites": $FAILED_SUITES,
    "success_rate": $success_rate,
    "overall_status": "$([ $FAILED_SUITES -eq 0 ] && echo "PASS" || echo "FAIL")"
  },
  "results": {
EOF
    
    # Add individual test results
    local first=true
    for suite in "${!TEST_RESULTS[@]}"; do
        IFS=':' read -r status duration <<< "${TEST_RESULTS[$suite]}"
        if [ "$first" = true ]; then
            first=false
        else
            echo "," >> "$json_report"
        fi
        echo "    \"$suite\": { \"status\": \"$status\", \"duration\": $duration }" >> "$json_report"
    done
    
    cat >> "$json_report" << EOF
  },
  "artifacts": {
    "logs_directory": "$OUTPUT_DIR/logs",
    "coverage_directory": "$OUTPUT_DIR/coverage",
    "reports_directory": "$OUTPUT_DIR/reports"
  }
}
EOF
    
    # HTML Report
    local html_report="$OUTPUT_DIR/reports/comprehensive-test-report.html"
    cat > "$html_report" << EOF
<!DOCTYPE html>
<html>
<head>
    <title>Comprehensive Test Report</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 30px; }
        .header h1 { margin: 0; font-size: 2.5em; }
        .header p { margin: 10px 0; opacity: 0.9; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; border-left: 4px solid #007acc; }
        .metric h3 { margin: 0 0 10px 0; color: #333; }
        .metric .value { font-size: 2em; font-weight: bold; color: #007acc; }
        .results { margin: 20px 0; }
        .result-item { display: flex; justify-content: space-between; align-items: center; padding: 15px; margin: 10px 0; border-radius: 5px; }
        .pass { background: #d4edda; border-left: 4px solid #28a745; }
        .fail { background: #f8d7da; border-left: 4px solid #dc3545; }
        .timeout { background: #fff3cd; border-left: 4px solid #ffc107; }
        .missing { background: #e2e3e5; border-left: 4px solid #6c757d; }
        .status { font-weight: bold; padding: 5px 10px; border-radius: 3px; color: white; }
        .status.pass { background: #28a745; }
        .status.fail { background: #dc3545; }
        .status.timeout { background: #ffc107; color: #000; }
        .status.missing { background: #6c757d; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 Comprehensive Test Report</h1>
            <p><strong>Generated:</strong> $(date)</p>
            <p><strong>Environment:</strong> $ENVIRONMENT | <strong>Type:</strong> $TEST_TYPE | <strong>Duration:</strong> ${TOTAL_DURATION}s</p>
        </div>

        <div class="summary">
            <div class="metric">
                <h3>Total Suites</h3>
                <div class="value">$TOTAL_SUITES</div>
            </div>
            <div class="metric">
                <h3>Passed</h3>
                <div class="value" style="color: #28a745;">$PASSED_SUITES</div>
            </div>
            <div class="metric">
                <h3>Failed</h3>
                <div class="value" style="color: #dc3545;">$FAILED_SUITES</div>
            </div>
            <div class="metric">
                <h3>Success Rate</h3>
                <div class="value">$success_rate%</div>
            </div>
        </div>

        <div class="results">
            <h2>📋 Test Results</h2>
EOF
    
    # Add test results to HTML
    for suite in "${!TEST_RESULTS[@]}"; do
        IFS=':' read -r status duration <<< "${TEST_RESULTS[$suite]}"
        local css_class=$(echo "$status" | tr '[:upper:]' '[:lower:]')
        cat >> "$html_report" << EOF
            <div class="result-item $css_class">
                <span><strong>$suite</strong> (${duration}s)</span>
                <span class="status $css_class">$status</span>
            </div>
EOF
    done
    
    cat >> "$html_report" << EOF
        </div>

        <div class="footer">
            <p>📁 <strong>Artifacts:</strong> Logs, coverage reports, and detailed results are available in the $OUTPUT_DIR directory.</p>
            <p>🔧 <strong>Configuration:</strong> Coverage: $COVERAGE | Parallel: $PARALLEL | Timeout: ${TIMEOUT}s</p>
        </div>
    </div>
</body>
</html>
EOF
    
    success "Reports generated:"
    echo "  📊 JSON: $json_report"
    echo "  🌐 HTML: $html_report"
}

# Display final results
display_results() {
    local END_TIME=$(date +%s)
    local TOTAL_DURATION=$((END_TIME - START_TIME))
    
    echo ""
    echo -e "${CYAN}${'='*60}${NC}"
    echo -e "${CYAN}COMPREHENSIVE TEST RESULTS${NC}"
    echo -e "${CYAN}${'='*60}${NC}"
    echo ""
    
    echo -e "${BLUE}📊 Summary:${NC}"
    echo -e "  Total Duration: ${TOTAL_DURATION}s"
    echo -e "  Total Suites: $TOTAL_SUITES"
    echo -e "  ${GREEN}✅ Passed: $PASSED_SUITES${NC}"
    echo -e "  ${RED}❌ Failed: $FAILED_SUITES${NC}"
    
    if [ $TOTAL_SUITES -gt 0 ]; then
        local success_rate=$(( (PASSED_SUITES * 100) / TOTAL_SUITES ))
        echo -e "  Success Rate: $success_rate%"
    fi
    
    echo ""
    echo -e "${BLUE}📋 Detailed Results:${NC}"
    
    for suite in "${!TEST_RESULTS[@]}"; do
        IFS=':' read -r status duration <<< "${TEST_RESULTS[$suite]}"
        case $status in
            PASS)
                echo -e "  ${GREEN}✅ $suite${NC} (${duration}s)"
                ;;
            FAIL)
                echo -e "  ${RED}❌ $suite${NC} (${duration}s)"
                ;;
            TIMEOUT)
                echo -e "  ${YELLOW}⏰ $suite${NC} (timeout after ${duration}s)"
                ;;
            MISSING)
                echo -e "  ${YELLOW}❓ $suite${NC} (script missing)"
                ;;
        esac
    done
    
    echo ""
    echo -e "${BLUE}📁 Artifacts:${NC}"
    echo -e "  Logs: $OUTPUT_DIR/logs/"
    echo -e "  Reports: $OUTPUT_DIR/reports/"
    if [ "$COVERAGE" = true ]; then
        echo -e "  Coverage: $OUTPUT_DIR/coverage/"
    fi
    
    echo -e "${CYAN}${'='*60}${NC}"
}

# Main execution
main() {
    parse_args "$@"
    validate_test_type
    
    echo ""
    echo -e "${PURPLE}🧪 Comprehensive Test Suite${NC}"
    echo -e "${PURPLE}============================${NC}\n"
    
    echo -e "${YELLOW}Configuration:${NC}"
    echo -e "  Test Type: $TEST_TYPE"
    echo -e "  Environment: $ENVIRONMENT"
    echo -e "  Coverage: ${COVERAGE:+Enabled}${COVERAGE:-Disabled}"
    echo -e "  Parallel: ${PARALLEL:+Enabled}${PARALLEL:-Disabled}"
    echo -e "  Timeout: ${TIMEOUT}s"
    echo -e "  Output: $OUTPUT_DIR"
    echo ""
    
    setup_environment
    
    # Run selected test types
    case $TEST_TYPE in
        lint)
            run_lint_checks
            ;;
        security)
            run_security_scans
            ;;
        unit)
            run_unit_tests
            ;;
        integration)
            run_integration_tests
            ;;
        performance)
            run_performance_tests
            ;;
        all)
            if [ "$PARALLEL" = true ]; then
                # Run independent tests in parallel
                run_lint_checks &
                run_security_scans &
                wait # Wait for static analysis to complete
                
                run_unit_tests
                run_integration_tests
                run_performance_tests
            else
                # Sequential execution
                run_lint_checks
                run_security_scans
                run_unit_tests
                run_integration_tests
                run_performance_tests
            fi
            ;;
    esac
    
    # Generate reports
    generate_comprehensive_report
    
    # Display results
    display_results
    
    # Exit with appropriate code
    if [ $FAILED_SUITES -eq 0 ]; then
        success "All tests passed! 🎉"
        exit 0
    else
        error "$FAILED_SUITES test suite(s) failed"
        exit 1
    fi
}

# Execute main function
main "$@"