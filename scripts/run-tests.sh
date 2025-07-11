#!/bin/bash

# Comprehensive test runner script for Hive Mind project
# Usage: ./run-tests.sh [test-type] [options]

set -euo pipefail

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
TEST_TYPE="${1:-all}"
COVERAGE="${COVERAGE:-true}"
VERBOSE="${VERBOSE:-false}"
CI="${CI:-false}"

# Help function
show_help() {
    echo "Usage: $0 [test-type] [options]"
    echo ""
    echo "Test Types:"
    echo "  all          Run all tests (default)"
    echo "  unit         Run unit tests only"
    echo "  integration  Run integration tests only"
    echo "  e2e          Run end-to-end tests only"
    echo "  performance  Run performance tests only"
    echo "  smoke        Run smoke tests"
    echo "  lint         Run linting and type checking"
    echo "  coverage     Generate coverage reports"
    echo ""
    echo "Options:"
    echo "  --no-coverage    Skip coverage generation"
    echo "  --verbose        Enable verbose output"
    echo "  --ci             CI mode (stricter settings)"
    echo "  --help           Show this help message"
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --no-coverage)
            COVERAGE="false"
            shift
            ;;
        --verbose)
            VERBOSE="true"
            shift
            ;;
        --ci)
            CI="true"
            shift
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            if [[ -z "${TEST_TYPE}" || "${TEST_TYPE}" == "all" ]]; then
                TEST_TYPE="$1"
            fi
            shift
            ;;
    esac
done

# Functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

run_command() {
    local cmd="$1"
    local description="$2"
    
    log_info "$description"
    
    if [[ "$VERBOSE" == "true" ]]; then
        echo "Running: $cmd"
    fi
    
    if eval "$cmd"; then
        log_success "$description completed"
        return 0
    else
        log_error "$description failed"
        return 1
    fi
}

check_dependencies() {
    log_info "Checking dependencies..."
    
    # Check if pnpm is installed
    if ! command -v pnpm &> /dev/null; then
        log_error "pnpm is not installed. Please install it first."
        exit 1
    fi
    
    # Check if node_modules exists
    if [[ ! -d "node_modules" ]]; then
        log_warning "node_modules not found. Installing dependencies..."
        run_command "pnpm install" "Installing dependencies"
    fi
    
    log_success "Dependencies check passed"
}

run_lint_tests() {
    log_info "Running lint and type checks..."
    
    run_command "pnpm run lint:all" "Linting"
    run_command "pnpm run typecheck:all" "Type checking"
    run_command "pnpm run format:check" "Format checking"
    
    log_success "Lint tests completed"
}

run_unit_tests() {
    log_info "Running unit tests..."
    
    local cmd="pnpm run test:unit"
    
    if [[ "$COVERAGE" == "true" ]]; then
        cmd="$cmd --coverage"
    fi
    
    if [[ "$CI" == "true" ]]; then
        cmd="$cmd --reporter=junit --outputFile=unit-test-results.xml"
    fi
    
    run_command "$cmd" "Unit tests"
    
    log_success "Unit tests completed"
}

run_integration_tests() {
    log_info "Running integration tests..."
    
    # Check if database is available
    if [[ -n "${DATABASE_URL:-}" ]] || [[ "$CI" == "true" ]]; then
        local cmd="pnpm run test:integration"
        
        if [[ "$CI" == "true" ]]; then
            cmd="$cmd --reporter=junit --outputFile=integration-test-results.xml"
        fi
        
        run_command "$cmd" "Integration tests"
        log_success "Integration tests completed"
    else
        log_warning "DATABASE_URL not set. Skipping integration tests."
        log_info "To run integration tests locally, set DATABASE_URL environment variable"
    fi
}

run_e2e_tests() {
    log_info "Running end-to-end tests..."
    
    # Install Playwright browsers if needed
    if [[ ! -d "apps/dashboard/node_modules/@playwright" ]]; then
        log_info "Installing Playwright browsers..."
        run_command "pnpm --filter @swarm/dashboard exec playwright install" "Installing Playwright browsers"
    fi
    
    # Start the application if not in CI
    if [[ "$CI" != "true" ]]; then
        log_info "Starting application for E2E tests..."
        
        # Build first
        run_command "pnpm run build:all" "Building applications"
        
        # Start in background
        pnpm run dev &
        DEV_PID=$!
        
        # Wait for application to be ready
        log_info "Waiting for application to be ready..."
        for i in {1..30}; do
            if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
                log_success "Application is ready"
                break
            fi
            if [[ $i -eq 30 ]]; then
                log_error "Application failed to start"
                kill $DEV_PID 2>/dev/null || true
                exit 1
            fi
            sleep 2
        done
    fi
    
    local cmd="pnpm run test:e2e"
    
    if [[ "$CI" == "true" ]]; then
        cmd="$cmd --reporter=junit"
    fi
    
    if run_command "$cmd" "End-to-end tests"; then
        log_success "E2E tests completed"
    else
        log_error "E2E tests failed"
        # Clean up background process
        if [[ "$CI" != "true" ]] && [[ -n "${DEV_PID:-}" ]]; then
            kill $DEV_PID 2>/dev/null || true
        fi
        exit 1
    fi
    
    # Clean up background process
    if [[ "$CI" != "true" ]] && [[ -n "${DEV_PID:-}" ]]; then
        kill $DEV_PID 2>/dev/null || true
    fi
}

run_performance_tests() {
    log_info "Running performance tests..."
    
    # Check if k6 is installed
    if ! command -v k6 &> /dev/null; then
        log_warning "k6 is not installed. Skipping performance tests."
        log_info "To run performance tests, install k6: https://k6.io/docs/getting-started/installation/"
        return 0
    fi
    
    # Set default API URL if not provided
    export API_URL="${API_URL:-http://localhost:3000}"
    
    run_command "k6 run tests/performance/load-test.js" "Performance tests"
    
    log_success "Performance tests completed"
}

run_smoke_tests() {
    log_info "Running smoke tests..."
    
    local environment="${ENVIRONMENT:-staging}"
    
    if [[ -f "scripts/smoke-test.sh" ]]; then
        run_command "bash scripts/smoke-test.sh $environment" "Smoke tests"
        log_success "Smoke tests completed"
    else
        log_warning "Smoke test script not found. Skipping smoke tests."
    fi
}

generate_coverage_report() {
    if [[ "$COVERAGE" == "true" ]]; then
        log_info "Generating coverage reports..."
        
        run_command "pnpm run test:coverage" "Coverage report generation"
        
        if [[ -f "coverage/lcov.info" ]]; then
            log_success "Coverage report generated at coverage/index.html"
        fi
    fi
}

# Main execution
main() {
    echo "🧪 Hive Mind Test Runner"
    echo "========================="
    echo "Test Type: $TEST_TYPE"
    echo "Coverage: $COVERAGE"
    echo "Verbose: $VERBOSE"
    echo "CI Mode: $CI"
    echo ""
    
    check_dependencies
    
    case "$TEST_TYPE" in
        "all")
            run_lint_tests
            run_unit_tests
            run_integration_tests
            run_e2e_tests
            run_performance_tests
            generate_coverage_report
            ;;
        "unit")
            run_unit_tests
            ;;
        "integration")
            run_integration_tests
            ;;
        "e2e")
            run_e2e_tests
            ;;
        "performance")
            run_performance_tests
            ;;
        "smoke")
            run_smoke_tests
            ;;
        "lint")
            run_lint_tests
            ;;
        "coverage")
            generate_coverage_report
            ;;
        *)
            log_error "Unknown test type: $TEST_TYPE"
            show_help
            exit 1
            ;;
    esac
    
    echo ""
    log_success "🎉 All requested tests completed successfully!"
    
    # Summary
    echo ""
    echo "📊 Test Summary:"
    echo "================"
    echo "✅ Test type: $TEST_TYPE"
    echo "✅ Coverage: $COVERAGE"
    
    if [[ "$COVERAGE" == "true" ]] && [[ -f "coverage/index.html" ]]; then
        echo "📈 Coverage report: file://$(pwd)/coverage/index.html"
    fi
    
    if [[ -d "test-results" ]]; then
        echo "📁 Test results: $(pwd)/test-results/"
    fi
    
    if [[ -d "apps/dashboard/test-results" ]]; then
        echo "🎭 E2E results: $(pwd)/apps/dashboard/test-results/"
    fi
}

# Run main function
main "$@"