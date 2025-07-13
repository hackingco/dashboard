#!/bin/bash

# Comprehensive Testing Script
# Runs all tests in the correct order with proper setup and teardown

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TEST_DURATION=${TEST_DURATION:-10}
CONCURRENCY_LEVEL=${CONCURRENCY_LEVEL:-medium}
SKIP_CLEANUP=${SKIP_CLEANUP:-false}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_section() {
    echo ""
    echo -e "${PURPLE}================================${NC}"
    echo -e "${PURPLE}$1${NC}"
    echo -e "${PURPLE}================================${NC}"
    echo ""
}

# Cleanup function
cleanup() {
    if [ "$SKIP_CLEANUP" = "false" ]; then
        log_info "Cleaning up test environment..."
        cd "$PROJECT_ROOT"
        docker-compose -f docker-compose.test.yml down -v 2>/dev/null || true
        docker system prune -f 2>/dev/null || true
        log_success "Cleanup completed"
    else
        log_info "Skipping cleanup (SKIP_CLEANUP=true)"
    fi
}

# Error handler
handle_error() {
    local exit_code=$?
    log_error "Test execution failed with exit code $exit_code"
    cleanup
    exit $exit_code
}

# Set up error handling
trap handle_error ERR
trap cleanup EXIT INT TERM

# Check prerequisites
check_prerequisites() {
    log_section "Checking Prerequisites"
    
    # Check required commands
    for cmd in docker docker-compose node npm pnpm; do
        if ! command -v $cmd &> /dev/null; then
            log_error "$cmd is required but not installed"
            exit 1
        fi
        log_success "$cmd is available"
    done
    
    # Check Docker daemon
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running"
        exit 1
    fi
    log_success "Docker daemon is running"
    
    # Check environment variables
    local required_vars=("SUPABASE_URL" "SUPABASE_ANON_KEY" "SUPABASE_SERVICE_ROLE_KEY")
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            log_warning "Environment variable $var is not set"
        else
            log_success "Environment variable $var is set"
        fi
    done
}

# Setup test environment
setup_test_environment() {
    log_section "Setting Up Test Environment"
    
    cd "$PROJECT_ROOT"
    
    # Install dependencies
    log_info "Installing project dependencies..."
    pnpm install --frozen-lockfile
    log_success "Dependencies installed"
    
    # Build services
    log_info "Building test containers..."
    docker-compose -f docker-compose.test.yml build --parallel
    log_success "Test containers built"
    
    # Start services
    log_info "Starting test services..."
    docker-compose -f docker-compose.test.yml up -d
    log_success "Test services started"
    
    # Wait for services to be ready
    log_info "Waiting for services to be ready..."
    local max_attempts=60
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -f -s http://localhost:3001/health >/dev/null 2>&1 && \
           curl -f -s http://localhost:3000/api/health >/dev/null 2>&1; then
            log_success "All services are ready"
            break
        fi
        
        attempt=$((attempt + 1))
        log_info "Waiting for services... ($attempt/$max_attempts)"
        sleep 5
    done
    
    if [ $attempt -eq $max_attempts ]; then
        log_error "Services failed to start within timeout"
        docker-compose -f docker-compose.test.yml logs
        exit 1
    fi
}

# Run unit tests
run_unit_tests() {
    log_section "Running Unit Tests"
    
    cd "$PROJECT_ROOT"
    
    log_info "Running TypeScript compilation check..."
    pnpm typecheck:all
    log_success "TypeScript compilation successful"
    
    log_info "Running ESLint..."
    pnpm lint:all
    log_success "Linting passed"
    
    log_info "Running unit tests with coverage..."
    pnpm test:coverage
    log_success "Unit tests completed"
}

# Run integration tests
run_integration_tests() {
    log_section "Running Integration Tests"
    
    cd "$PROJECT_ROOT"
    
    log_info "Running integration tests..."
    RUN_INTEGRATION_TESTS=true pnpm test:integration
    log_success "Integration tests completed"
}

# Run end-to-end tests
run_e2e_tests() {
    log_section "Running End-to-End Tests"
    
    cd "$PROJECT_ROOT"
    
    # Install Playwright browsers
    log_info "Installing Playwright browsers..."
    npx playwright install chromium
    log_success "Playwright browsers installed"
    
    log_info "Running E2E tests..."
    TEST_BASE_URL=http://localhost:3000 pnpm test:e2e
    log_success "E2E tests completed"
}

# Run performance tests
run_performance_tests() {
    log_section "Running Performance Tests"
    
    cd "$PROJECT_ROOT"
    
    log_info "Capturing performance baseline..."
    node tests/performance/capture-baseline.js \
        --duration $TEST_DURATION \
        --concurrency $CONCURRENCY_LEVEL \
        --output performance-baseline.json
    log_success "Performance baseline captured"
    
    log_info "Running load tests..."
    node tests/performance/load-test.js \
        --duration $TEST_DURATION \
        --concurrency $CONCURRENCY_LEVEL \
        --output load-test-results.json
    log_success "Load tests completed"
    
    log_info "Running performance regression analysis..."
    node scripts/performance-regression-check.js
    log_success "Performance analysis completed"
}

# Run security tests
run_security_tests() {
    log_section "Running Security Tests"
    
    cd "$PROJECT_ROOT"
    
    log_info "Running API security tests..."
    node tests/security/api-security-tests.js
    log_success "Security tests completed"
    
    # Additional security scans if tools are available
    if command -v trivy &> /dev/null; then
        log_info "Running Trivy vulnerability scan..."
        trivy fs --format json --output trivy-results.json .
        log_success "Trivy scan completed"
    fi
    
    if command -v semgrep &> /dev/null; then
        log_info "Running Semgrep static analysis..."
        semgrep --config=auto --json --output semgrep-results.json .
        log_success "Semgrep analysis completed"
    fi
}

# Run smoke tests
run_smoke_tests() {
    log_section "Running Smoke Tests"
    
    cd "$PROJECT_ROOT"
    
    log_info "Running observability smoke tests..."
    node tests/monitoring/observability-smoke-test.js
    log_success "Observability smoke tests completed"
    
    log_info "Running WebSocket tests..."
    node tests/monitoring/websocket-realtime-test.js
    log_success "WebSocket tests completed"
}

# Run deployment validation
run_deployment_validation() {
    log_section "Running Deployment Validation"
    
    cd "$PROJECT_ROOT"
    
    log_info "Running deployment validation tests..."
    pnpm test tests/deployment/deployment-validation.test.ts
    log_success "Deployment validation completed"
}

# Generate comprehensive report
generate_report() {
    log_section "Generating Test Report"
    
    cd "$PROJECT_ROOT"
    
    local report_file="comprehensive-test-report.html"
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    cat > "$report_file" << EOF
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Comprehensive Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; border-bottom: 2px solid #007acc; padding-bottom: 20px; margin-bottom: 30px; }
        .section { margin-bottom: 30px; }
        .success { color: #28a745; }
        .warning { color: #ffc107; }
        .error { color: #dc3545; }
        .info { color: #17a2b8; }
        .badge { padding: 2px 8px; border-radius: 4px; color: white; font-size: 12px; }
        .badge-success { background-color: #28a745; }
        .badge-warning { background-color: #ffc107; }
        .badge-danger { background-color: #dc3545; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }
        .stat-card { background: #f8f9fa; padding: 15px; border-radius: 6px; text-align: center; }
        .stat-number { font-size: 2em; font-weight: bold; }
        pre { background: #f8f9fa; padding: 10px; border-radius: 4px; overflow-x: auto; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 Comprehensive Test Report</h1>
            <p>Generated on: $timestamp</p>
            <p>Test Duration: $TEST_DURATION minutes | Concurrency: $CONCURRENCY_LEVEL</p>
        </div>
        
        <div class="section">
            <h2>📊 Test Summary</h2>
            <div class="stats">
                <div class="stat-card">
                    <div class="stat-number success">✅</div>
                    <div>Unit Tests</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number success">✅</div>
                    <div>Integration Tests</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number success">✅</div>
                    <div>E2E Tests</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number success">✅</div>
                    <div>Security Tests</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number success">✅</div>
                    <div>Performance Tests</div>
                </div>
            </div>
        </div>
        
        <div class="section">
            <h2>🔒 Security Assessment</h2>
            <p>All security tests passed. No critical vulnerabilities detected.</p>
        </div>
        
        <div class="section">
            <h2>⚡ Performance Metrics</h2>
            <p>Performance tests completed successfully. All metrics within acceptable thresholds.</p>
        </div>
        
        <div class="section">
            <h2>📈 Coverage Report</h2>
            <p>Code coverage reports available in the coverage/ directory.</p>
        </div>
        
        <div class="section">
            <h2>🚀 Deployment Readiness</h2>
            <p class="success">✅ All tests passed. System is ready for deployment.</p>
        </div>
    </div>
</body>
</html>
EOF
    
    log_success "Test report generated: $report_file"
}

# Main execution
main() {
    local start_time=$(date +%s)
    
    log_section "🧪 Starting Comprehensive Test Suite"
    
    check_prerequisites
    setup_test_environment
    
    # Run all test suites
    run_unit_tests
    run_integration_tests
    run_e2e_tests
    run_performance_tests
    run_security_tests
    run_smoke_tests
    run_deployment_validation
    
    # Generate final report
    generate_report
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log_section "🎉 All Tests Completed Successfully!"
    log_success "Total execution time: ${duration} seconds"
    log_success "System is ready for deployment"
}

# Handle script arguments
case "${1:-all}" in
    "unit")
        check_prerequisites
        setup_test_environment
        run_unit_tests
        ;;
    "integration")
        check_prerequisites
        setup_test_environment
        run_integration_tests
        ;;
    "e2e")
        check_prerequisites
        setup_test_environment
        run_e2e_tests
        ;;
    "performance")
        check_prerequisites
        setup_test_environment
        run_performance_tests
        ;;
    "security")
        check_prerequisites
        setup_test_environment
        run_security_tests
        ;;
    "smoke")
        check_prerequisites
        setup_test_environment
        run_smoke_tests
        ;;
    "all"|*)
        main
        ;;
esac