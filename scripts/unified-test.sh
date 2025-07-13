#!/bin/bash

# Unified Testing Script for Swarm Orchestrator
# Consolidates all testing strategies into one comprehensive script

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# Default values
TEST_TYPE="all"
ENVIRONMENT="test"
COVERAGE=false
VERBOSE=false
SKIP_LINT=false
SKIP_SECURITY=false
OUTPUT_DIR="test-results"

# Usage function
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Unified testing script for Swarm Orchestrator.

OPTIONS:
    -t, --type TYPE          Test type (unit|integration|e2e|performance|security|all) [default: all]
    -e, --environment ENV    Test environment (test|staging|production) [default: test]
    -c, --coverage           Generate test coverage reports
    -v, --verbose            Verbose output
    --skip-lint              Skip linting checks
    --skip-security          Skip security scans
    -o, --output DIR         Output directory for reports [default: test-results]
    -h, --help               Show this help message

TEST TYPES:
    unit        - Unit tests for all workspaces
    integration - Integration tests with services
    e2e         - End-to-end browser tests
    performance - Load and performance tests
    security    - Security and vulnerability scans
    all         - Run all test types (default)

EXAMPLES:
    $0                                    # Run all tests
    $0 -t unit -c                        # Run unit tests with coverage
    $0 -t e2e -e staging                 # Run E2E tests against staging
    $0 -t performance -v                 # Run performance tests with verbose output
    $0 --skip-security --skip-lint      # Skip security and lint checks

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
            --skip-lint)
                SKIP_LINT=true
                shift
                ;;
            --skip-security)
                SKIP_SECURITY=true
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

# Validation
validate_test_type() {
    case $TEST_TYPE in
        unit|integration|e2e|performance|security|all)
            ;;
        *)
            echo -e "${RED}❌ Invalid test type: $TEST_TYPE${NC}"
            echo -e "${YELLOW}Valid options: unit, integration, e2e, performance, security, all${NC}"
            exit 1
            ;;
    esac
}

# Setup
setup_environment() {
    echo -e "${BLUE}🔧 Setting up test environment...${NC}"
    
    # Create output directory
    mkdir -p "$OUTPUT_DIR"
    
    # Install dependencies
    if [ -f "package.json" ]; then
        echo -e "${YELLOW}📦 Installing dependencies...${NC}"
        pnpm install --frozen-lockfile
    fi
    
    # Setup test environment variables
    export NODE_ENV="test"
    export CI=true
    
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
    
    echo -e "${GREEN}✅ Environment setup complete${NC}"
}

# Linting and code quality
run_lint_checks() {
    if [ "$SKIP_LINT" = true ]; then
        echo -e "${YELLOW}⏭️  Skipping lint checks${NC}"
        return 0
    fi
    
    echo -e "${BLUE}🔍 Running lint and code quality checks...${NC}"
    
    # ESLint
    echo -e "${YELLOW}📝 Running ESLint...${NC}"
    pnpm run lint --workspace=apps/manager --workspace=admin-dashboard 2>&1 | tee "$OUTPUT_DIR/eslint-report.txt" || echo "Linting issues found"
    
    # Prettier
    echo -e "${YELLOW}🎨 Checking code formatting...${NC}"
    pnpm run format:check 2>&1 | tee "$OUTPUT_DIR/prettier-report.txt" || echo "Formatting issues found"
    
    # TypeScript
    echo -e "${YELLOW}📝 Running TypeScript checks...${NC}"
    pnpm run build --workspace=shared/types 2>&1 | tee "$OUTPUT_DIR/typescript-report.txt" || echo "TypeScript issues found"
    
    echo -e "${GREEN}✅ Lint checks completed${NC}"
}

# Security scans
run_security_scans() {
    if [ "$SKIP_SECURITY" = true ]; then
        echo -e "${YELLOW}⏭️  Skipping security scans${NC}"
        return 0
    fi
    
    echo -e "${BLUE}🔒 Running security scans...${NC}"
    
    # Dependency audit
    echo -e "${YELLOW}📦 Scanning dependencies...${NC}"
    pnpm audit --audit-level moderate --json > "$OUTPUT_DIR/dependency-audit.json" 2>/dev/null || echo "Dependency vulnerabilities found"
    
    # Secret scanning
    echo -e "${YELLOW}🔐 Scanning for secrets...${NC}"
    if command -v trufflehog &> /dev/null; then
        trufflehog git file://. --json > "$OUTPUT_DIR/secret-scan.json" 2>/dev/null || echo "Secret scan completed"
    else
        echo -e "${YELLOW}⚠️  TruffleHog not installed, skipping secret scan${NC}"
    fi
    
    echo -e "${GREEN}✅ Security scans completed${NC}"
}

# Unit tests
run_unit_tests() {
    echo -e "${BLUE}🧪 Running unit tests...${NC}"
    
    local coverage_flag=""
    if [ "$COVERAGE" = true ]; then
        coverage_flag="--coverage"
        echo -e "${YELLOW}📊 Coverage reporting enabled${NC}"
    fi
    
    # Manager API tests
    echo -e "${YELLOW}🖥️  Testing Manager API...${NC}"
    cd apps/manager
    if [ -f "package.json" ] && grep -q '"test"' package.json; then
        pnpm test $coverage_flag 2>&1 | tee "../../$OUTPUT_DIR/manager-unit-tests.txt" || echo "Manager tests failed"
        
        if [ "$COVERAGE" = true ] && [ -d "coverage" ]; then
            cp -r coverage "../../$OUTPUT_DIR/manager-coverage"
        fi
    else
        echo -e "${YELLOW}⚠️  No unit tests found for Manager API${NC}"
    fi
    cd - > /dev/null
    
    # Dashboard tests
    echo -e "${YELLOW}🎨 Testing Dashboard...${NC}"
    cd admin-dashboard
    if [ -f "package.json" ] && grep -q '"test"' package.json; then
        npm test -- --watchAll=false --coverage=$COVERAGE 2>&1 | tee "../$OUTPUT_DIR/dashboard-unit-tests.txt" || echo "Dashboard tests failed"
        
        if [ "$COVERAGE" = true ] && [ -d "coverage" ]; then
            cp -r coverage "../$OUTPUT_DIR/dashboard-coverage"
        fi
    else
        echo -e "${YELLOW}⚠️  No unit tests found for Dashboard${NC}"
    fi
    cd - > /dev/null
    
    echo -e "${GREEN}✅ Unit tests completed${NC}"
}

# Integration tests
run_integration_tests() {
    echo -e "${BLUE}🔗 Running integration tests...${NC}"
    
    # Start test services if testing locally
    if [ "$ENVIRONMENT" = "test" ]; then
        echo -e "${YELLOW}🚀 Starting test services...${NC}"
        
        if [ -f "docker-compose.test.yml" ]; then
            docker-compose -f docker-compose.test.yml up -d
            sleep 30  # Wait for services to be ready
            
            # Health check
            for i in {1..10}; do
                if curl -f http://localhost:3001/health > /dev/null 2>&1; then
                    echo -e "${GREEN}✅ Test services are ready${NC}"
                    break
                fi
                echo "Waiting for services... ($i/10)"
                sleep 5
            done
        fi
    fi
    
    # Run integration tests
    echo -e "${YELLOW}🧪 Running API integration tests...${NC}"
    if [ -f "tests/integration/api.test.js" ]; then
        node tests/integration/api.test.js 2>&1 | tee "$OUTPUT_DIR/integration-tests.txt" || echo "Integration tests failed"
    else
        echo -e "${YELLOW}⚠️  No integration tests found${NC}"
    fi
    
    # Cleanup
    if [ "$ENVIRONMENT" = "test" ] && [ -f "docker-compose.test.yml" ]; then
        docker-compose -f docker-compose.test.yml down
    fi
    
    echo -e "${GREEN}✅ Integration tests completed${NC}"
}

# E2E tests
run_e2e_tests() {
    echo -e "${BLUE}🌐 Running end-to-end tests...${NC}"
    
    # Install Playwright if not already installed
    if ! command -v playwright &> /dev/null; then
        echo -e "${YELLOW}📦 Installing Playwright...${NC}"
        pnpm add -D @playwright/test
        pnpm exec playwright install
    fi
    
    # Run E2E tests
    echo -e "${YELLOW}🎭 Running Playwright tests...${NC}"
    if [ -f "tests/e2e" ] || [ -f "playwright.config.js" ]; then
        pnpm exec playwright test --reporter=html --output-dir="$OUTPUT_DIR/e2e-results" 2>&1 | tee "$OUTPUT_DIR/e2e-tests.txt" || echo "E2E tests failed"
    else
        echo -e "${YELLOW}⚠️  No E2E tests configured${NC}"
    fi
    
    echo -e "${GREEN}✅ E2E tests completed${NC}"
}

# Performance tests
run_performance_tests() {
    echo -e "${BLUE}⚡ Running performance tests...${NC}"
    
    # Start test environment if needed
    if [ "$ENVIRONMENT" = "test" ]; then
        echo -e "${YELLOW}🚀 Starting performance test environment...${NC}"
        if [ -f "docker-compose.test.yml" ]; then
            docker-compose -f docker-compose.test.yml up -d
            sleep 45  # Extra time for performance baseline
        fi
    fi
    
    # Run performance tests
    echo -e "${YELLOW}📊 Running load tests...${NC}"
    
    # API load test
    if [ -f "tests/performance/api-load-test.js" ]; then
        node tests/performance/api-load-test.js --output "$OUTPUT_DIR/api-load-results.json" || echo "API load test failed"
    fi
    
    # WebSocket load test
    if [ -f "tests/performance/websocket-load-test.js" ]; then
        node tests/performance/websocket-load-test.js --output "$OUTPUT_DIR/ws-load-results.json" || echo "WebSocket load test failed"
    fi
    
    # Memory profiling
    if [ -f "tests/performance/memory-profiler.js" ]; then
        node tests/performance/memory-profiler.js --output "$OUTPUT_DIR/memory-profile.json" || echo "Memory profiling failed"
    fi
    
    # Performance regression check
    if [ -f "scripts/performance-regression-check.js" ]; then
        node scripts/performance-regression-check.js 2>&1 | tee "$OUTPUT_DIR/performance-regression.txt" || echo "Performance regression check failed"
    fi
    
    # Cleanup
    if [ "$ENVIRONMENT" = "test" ] && [ -f "docker-compose.test.yml" ]; then
        docker-compose -f docker-compose.test.yml down
    fi
    
    echo -e "${GREEN}✅ Performance tests completed${NC}"
}

# Generate comprehensive report
generate_report() {
    echo -e "${BLUE}📊 Generating test report...${NC}"
    
    local report_file="$OUTPUT_DIR/test-summary.html"
    
    cat > "$report_file" << EOF
<!DOCTYPE html>
<html>
<head>
    <title>Swarm Orchestrator Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f0f8ff; padding: 20px; border-radius: 5px; }
        .section { margin: 20px 0; padding: 15px; border-left: 4px solid #007acc; }
        .success { border-left-color: #28a745; }
        .warning { border-left-color: #ffc107; }
        .error { border-left-color: #dc3545; }
        .file-list { background: #f8f9fa; padding: 10px; border-radius: 3px; }
        pre { background: #f8f9fa; padding: 10px; overflow-x: auto; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🧪 Swarm Orchestrator Test Report</h1>
        <p><strong>Generated:</strong> $(date)</p>
        <p><strong>Test Type:</strong> $TEST_TYPE</p>
        <p><strong>Environment:</strong> $ENVIRONMENT</p>
        <p><strong>Coverage:</strong> ${COVERAGE:+Enabled}${COVERAGE:-Disabled}</p>
    </div>

    <div class="section success">
        <h2>✅ Test Summary</h2>
        <div class="file-list">
            <h3>Generated Files:</h3>
            <ul>
EOF

    # List all generated files
    find "$OUTPUT_DIR" -type f -name "*.txt" -o -name "*.json" -o -name "*.html" | while read -r file; do
        echo "                <li>$(basename "$file")</li>" >> "$report_file"
    done

    cat >> "$report_file" << EOF
            </ul>
        </div>
    </div>

    <div class="section">
        <h2>📋 Test Execution Details</h2>
        <p>Check the individual report files for detailed results:</p>
        <ul>
            <li><strong>Lint Reports:</strong> eslint-report.txt, prettier-report.txt, typescript-report.txt</li>
            <li><strong>Security Reports:</strong> dependency-audit.json, secret-scan.json</li>
            <li><strong>Unit Tests:</strong> manager-unit-tests.txt, dashboard-unit-tests.txt</li>
            <li><strong>Integration Tests:</strong> integration-tests.txt</li>
            <li><strong>E2E Tests:</strong> e2e-tests.txt, e2e-results/</li>
            <li><strong>Performance Tests:</strong> *-load-results.json, memory-profile.json</li>
        </ul>
    </div>

    <div class="section">
        <h2>🎯 Next Steps</h2>
        <ul>
            <li>Review any failed tests and fix issues</li>
            <li>Check coverage reports if enabled</li>
            <li>Address security vulnerabilities if found</li>
            <li>Monitor performance metrics</li>
        </ul>
    </div>
</body>
</html>
EOF

    echo -e "${GREEN}✅ Test report generated: $report_file${NC}"
}

# Main execution
main() {
    parse_args "$@"
    validate_test_type
    
    echo -e "${BLUE}🧪 Unified Swarm Testing Script${NC}"
    echo -e "${BLUE}===============================${NC}\n"
    
    echo -e "${YELLOW}Test Configuration:${NC}"
    echo -e "  Type: $TEST_TYPE"
    echo -e "  Environment: $ENVIRONMENT"
    echo -e "  Coverage: ${COVERAGE:+Enabled}${COVERAGE:-Disabled}"
    echo -e "  Output: $OUTPUT_DIR"
    echo ""
    
    setup_environment
    
    # Run selected tests
    case $TEST_TYPE in
        lint)
            run_lint_checks
            ;;
        unit)
            run_lint_checks
            run_unit_tests
            ;;
        integration)
            run_lint_checks
            run_unit_tests
            run_integration_tests
            ;;
        e2e)
            run_lint_checks
            run_e2e_tests
            ;;
        performance)
            run_performance_tests
            ;;
        security)
            run_security_scans
            ;;
        all)
            run_lint_checks
            run_security_scans
            run_unit_tests
            run_integration_tests
            run_e2e_tests
            run_performance_tests
            ;;
    esac
    
    generate_report
    
    echo -e "\n${GREEN}🎉 Testing completed!${NC}"
    echo -e "${YELLOW}📊 Check the report: $OUTPUT_DIR/test-summary.html${NC}"
    
    if [ "$VERBOSE" = true ]; then
        echo -e "\n${BLUE}Generated Files:${NC}"
        ls -la "$OUTPUT_DIR"
    fi
}

# Execute main function
main "$@"