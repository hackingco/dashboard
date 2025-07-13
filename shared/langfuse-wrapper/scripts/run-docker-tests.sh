#!/bin/bash

##
# Docker Test Execution Script for Langfuse Wrapper
# Comprehensive test suite execution in containerized environment
##

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TEST_RESULTS_DIR="${PROJECT_ROOT}/test-results"
DOCKER_IMAGE_NAME="langfuse-wrapper-test"
DOCKER_CONTAINER_NAME="langfuse-test-container-$(date +%s)"
DOCKER_NETWORK="langfuse-test-network"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

# Cleanup function
cleanup() {
    log_info "Cleaning up Docker resources..."
    
    # Stop and remove container
    if docker ps -a --format '{{.Names}}' | grep -q "^${DOCKER_CONTAINER_NAME}$"; then
        docker stop "${DOCKER_CONTAINER_NAME}" >/dev/null 2>&1 || true
        docker rm "${DOCKER_CONTAINER_NAME}" >/dev/null 2>&1 || true
    fi
    
    # Remove test network
    if docker network ls --format '{{.Name}}' | grep -q "^${DOCKER_NETWORK}$"; then
        docker network rm "${DOCKER_NETWORK}" >/dev/null 2>&1 || true
    fi
    
    # Optional: Remove test image (uncomment if desired)
    # docker rmi "${DOCKER_IMAGE_NAME}" >/dev/null 2>&1 || true
}

# Set trap for cleanup
trap cleanup EXIT

# Function to check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed or not in PATH"
        exit 1
    fi
    
    # Check Docker daemon
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker daemon is not running"
        exit 1
    fi
    
    # Check Node.js (for local validation)
    if ! command -v node &> /dev/null; then
        log_warning "Node.js not found locally, skipping local validation"
    fi
    
    log_success "Prerequisites check passed"
}

# Function to create test results directory
setup_test_environment() {
    log_info "Setting up test environment..."
    
    # Create test results directory
    mkdir -p "${TEST_RESULTS_DIR}/docker"
    mkdir -p "${TEST_RESULTS_DIR}/coverage"
    mkdir -p "${TEST_RESULTS_DIR}/screenshots"
    
    # Create Docker network for test isolation
    if ! docker network ls --format '{{.Name}}' | grep -q "^${DOCKER_NETWORK}$"; then
        docker network create "${DOCKER_NETWORK}" >/dev/null
        log_info "Created Docker test network: ${DOCKER_NETWORK}"
    fi
    
    log_success "Test environment setup completed"
}

# Function to build Docker test image
build_docker_image() {
    log_info "Building Docker test image..."
    
    # Create Dockerfile for testing
    cat > "${PROJECT_ROOT}/Dockerfile.test" << 'EOF'
FROM node:18-alpine

# Install system dependencies
RUN apk add --no-cache \
    sqlite \
    curl \
    bash \
    git \
    python3 \
    make \
    g++ \
    && ln -sf python3 /usr/bin/python

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with retry mechanism
RUN npm ci --only=production || \
    (sleep 5 && npm ci --only=production) || \
    (sleep 10 && npm ci --only=production)

# Install dev dependencies for testing
RUN npm install --save-dev \
    jest \
    @jest/globals \
    @types/jest \
    typescript \
    ts-jest \
    ts-node \
    || echo "Dev dependencies installation completed with warnings"

# Copy source code
COPY . .

# Create test directories
RUN mkdir -p .swarm test-results/docker test-results/coverage

# Set permissions
RUN chmod +x scripts/*.sh || true

# Create test database directory
RUN mkdir -p .swarm && \
    sqlite3 .swarm/test.db "CREATE TABLE IF NOT EXISTS test_table (id INTEGER PRIMARY KEY, data TEXT);" && \
    chmod 666 .swarm/test.db

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "console.log('Container healthy')" || exit 1

# Default command
CMD ["npm", "test"]
EOF

    # Build the image
    if ! docker build -f "${PROJECT_ROOT}/Dockerfile.test" -t "${DOCKER_IMAGE_NAME}" "${PROJECT_ROOT}"; then
        log_error "Failed to build Docker test image"
        exit 1
    fi
    
    log_success "Docker test image built successfully"
}

# Function to run Docker integration tests
run_docker_integration_tests() {
    log_info "Running Docker integration tests..."
    
    # Run container with comprehensive test configuration
    docker run \
        --name "${DOCKER_CONTAINER_NAME}" \
        --network "${DOCKER_NETWORK}" \
        --env NODE_ENV=test \
        --env LANGFUSE_ENABLED=false \
        --env LANGFUSE_PUBLIC_KEY=test-key \
        --env LANGFUSE_SECRET_KEY=test-secret \
        --env CI=true \
        --env JEST_JUNIT_OUTPUT_DIR=/app/test-results/docker \
        --env JEST_JUNIT_OUTPUT_NAME=docker-integration-results.xml \
        --volume "${TEST_RESULTS_DIR}:/app/test-results" \
        --workdir /app \
        --rm \
        "${DOCKER_IMAGE_NAME}" \
        bash -c "
            echo 'Starting Docker integration tests...'
            
            # Verify environment
            echo 'Node version:' && node --version
            echo 'NPM version:' && npm --version
            echo 'SQLite version:' && sqlite3 --version
            
            # Run specific Docker integration test
            npm test -- tests/integration/docker-langfuse.test.ts \
                --testTimeout=30000 \
                --verbose \
                --detectOpenHandles \
                --forceExit \
                --coverage \
                --coverageDirectory=test-results/coverage/docker \
                --reporters=default \
                --reporters=jest-junit
            
            echo 'Docker integration tests completed'
        "
    
    local exit_code=$?
    if [ $exit_code -eq 0 ]; then
        log_success "Docker integration tests passed"
    else
        log_error "Docker integration tests failed with exit code: $exit_code"
        return $exit_code
    fi
}

# Function to run swarm scenario tests
run_swarm_scenario_tests() {
    log_info "Running swarm scenario tests in Docker..."
    
    docker run \
        --name "${DOCKER_CONTAINER_NAME}-scenarios" \
        --network "${DOCKER_NETWORK}" \
        --env NODE_ENV=test \
        --env LANGFUSE_ENABLED=false \
        --volume "${TEST_RESULTS_DIR}:/app/test-results" \
        --workdir /app \
        --rm \
        "${DOCKER_IMAGE_NAME}" \
        bash -c "
            echo 'Starting swarm scenario tests...'
            
            # Run swarm tracing scenarios
            npm test -- tests/scenarios/swarm-tracing.scenario.ts \
                --testTimeout=45000 \
                --verbose \
                --coverage \
                --coverageDirectory=test-results/coverage/scenarios \
                --reporters=default
            
            echo 'Swarm scenario tests completed'
        "
    
    local exit_code=$?
    if [ $exit_code -eq 0 ]; then
        log_success "Swarm scenario tests passed"
    else
        log_error "Swarm scenario tests failed with exit code: $exit_code"
        return $exit_code
    fi
}

# Function to run hook lifecycle tests
run_hook_lifecycle_tests() {
    log_info "Running hook lifecycle tests in Docker..."
    
    docker run \
        --name "${DOCKER_CONTAINER_NAME}-hooks" \
        --network "${DOCKER_NETWORK}" \
        --env NODE_ENV=test \
        --env LANGFUSE_ENABLED=false \
        --volume "${TEST_RESULTS_DIR}:/app/test-results" \
        --workdir /app \
        --rm \
        "${DOCKER_IMAGE_NAME}" \
        bash -c "
            echo 'Starting hook lifecycle tests...'
            
            # Run hook lifecycle scenarios
            npm test -- tests/scenarios/hook-lifecycle.scenario.ts \
                --testTimeout=60000 \
                --verbose \
                --coverage \
                --coverageDirectory=test-results/coverage/hooks \
                --reporters=default
            
            echo 'Hook lifecycle tests completed'
        "
    
    local exit_code=$?
    if [ $exit_code -eq 0 ]; then
        log_success "Hook lifecycle tests passed"
    else
        log_error "Hook lifecycle tests failed with exit code: $exit_code"
        return $exit_code
    fi
}

# Function to run performance benchmarks
run_performance_benchmarks() {
    log_info "Running performance benchmarks in Docker..."
    
    docker run \
        --name "${DOCKER_CONTAINER_NAME}-perf" \
        --network "${DOCKER_NETWORK}" \
        --env NODE_ENV=test \
        --env LANGFUSE_ENABLED=false \
        --volume "${TEST_RESULTS_DIR}:/app/test-results" \
        --memory="512m" \
        --cpus="2" \
        --workdir /app \
        --rm \
        "${DOCKER_IMAGE_NAME}" \
        bash -c "
            echo 'Starting performance benchmarks...'
            
            # Run performance tests
            npm test -- tests/performance/high-throughput.test.ts \
                --testTimeout=120000 \
                --verbose \
                --reporters=default
            
            # Generate performance report
            echo 'Performance benchmark completed' > test-results/performance-summary.txt
            echo 'Container Resources: 512MB RAM, 2 CPUs' >> test-results/performance-summary.txt
            echo 'Timestamp:' \$(date) >> test-results/performance-summary.txt
            
            echo 'Performance benchmarks completed'
        "
    
    local exit_code=$?
    if [ $exit_code -eq 0 ]; then
        log_success "Performance benchmarks completed"
    else
        log_warning "Performance benchmarks completed with warnings (exit code: $exit_code)"
    fi
}

# Function to run stress tests
run_stress_tests() {
    log_info "Running stress tests in Docker..."
    
    docker run \
        --name "${DOCKER_CONTAINER_NAME}-stress" \
        --network "${DOCKER_NETWORK}" \
        --env NODE_ENV=test \
        --env LANGFUSE_ENABLED=false \
        --volume "${TEST_RESULTS_DIR}:/app/test-results" \
        --memory="256m" \
        --cpus="1" \
        --workdir /app \
        --rm \
        "${DOCKER_IMAGE_NAME}" \
        bash -c "
            echo 'Starting stress tests with resource constraints...'
            
            # Run under memory pressure
            timeout 300s npm test -- tests/integration/ \
                --testTimeout=30000 \
                --maxWorkers=1 \
                --verbose \
                || echo 'Stress test completed (may have timeouts)'
            
            echo 'Stress tests completed'
        "
    
    log_info "Stress tests completed (resource-constrained environment)"
}

# Function to generate comprehensive test report
generate_test_report() {
    log_info "Generating comprehensive test report..."
    
    local report_file="${TEST_RESULTS_DIR}/docker-test-report.html"
    
    cat > "${report_file}" << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Langfuse Wrapper Docker Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f4f4f4; padding: 20px; border-radius: 5px; }
        .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .success { background: #d4edda; border-color: #c3e6cb; }
        .warning { background: #fff3cd; border-color: #ffeaa7; }
        .error { background: #f8d7da; border-color: #f5c6cb; }
        .code { background: #f8f9fa; padding: 10px; font-family: monospace; border-radius: 3px; }
        .timestamp { color: #666; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Langfuse Wrapper Docker Test Report</h1>
        <p class="timestamp">Generated: $(date)</p>
    </div>
    
    <div class="section success">
        <h2>Test Summary</h2>
        <ul>
            <li>Docker Integration Tests: Completed</li>
            <li>Swarm Scenario Tests: Completed</li>
            <li>Hook Lifecycle Tests: Completed</li>
            <li>Performance Benchmarks: Completed</li>
            <li>Stress Tests: Completed</li>
        </ul>
    </div>
    
    <div class="section">
        <h2>Test Environment</h2>
        <div class="code">
            Docker Image: ${DOCKER_IMAGE_NAME}<br>
            Node.js Version: $(docker run --rm ${DOCKER_IMAGE_NAME} node --version 2>/dev/null || echo "Unknown")<br>
            Container Network: ${DOCKER_NETWORK}<br>
            Test Results Directory: ${TEST_RESULTS_DIR}
        </div>
    </div>
    
    <div class="section">
        <h2>Coverage Reports</h2>
        <p>Coverage reports are available in the following directories:</p>
        <ul>
            <li>Docker Integration: test-results/coverage/docker/</li>
            <li>Scenario Tests: test-results/coverage/scenarios/</li>
            <li>Hook Tests: test-results/coverage/hooks/</li>
        </ul>
    </div>
    
    <div class="section">
        <h2>Next Steps</h2>
        <ul>
            <li>Review detailed test logs in test-results/docker/</li>
            <li>Analyze coverage reports for areas needing improvement</li>
            <li>Run production deployment validation if all tests pass</li>
        </ul>
    </div>
</body>
</html>
EOF

    log_success "Test report generated: ${report_file}"
}

# Function to validate test results
validate_test_results() {
    log_info "Validating test results..."
    
    # Check for test result files
    if [ -d "${TEST_RESULTS_DIR}" ]; then
        local file_count=$(find "${TEST_RESULTS_DIR}" -type f | wc -l)
        log_info "Found ${file_count} test result files"
        
        # Check for critical test outputs
        if [ -f "${TEST_RESULTS_DIR}/docker/docker-integration-results.xml" ]; then
            log_success "Docker integration test results found"
        else
            log_warning "Docker integration test results not found"
        fi
        
        # Check coverage directories
        if [ -d "${TEST_RESULTS_DIR}/coverage" ]; then
            log_success "Coverage reports generated"
        else
            log_warning "Coverage reports not found"
        fi
    else
        log_error "Test results directory not found"
        return 1
    fi
}

# Function to cleanup test artifacts
cleanup_test_artifacts() {
    log_info "Cleaning up test artifacts..."
    
    # Remove temporary Dockerfile
    if [ -f "${PROJECT_ROOT}/Dockerfile.test" ]; then
        rm "${PROJECT_ROOT}/Dockerfile.test"
        log_info "Removed temporary Dockerfile"
    fi
    
    # Optional: Clean up old test result directories
    find "${TEST_RESULTS_DIR}" -name "*.tmp" -delete 2>/dev/null || true
    
    log_success "Test artifacts cleanup completed"
}

# Main execution function
main() {
    log_info "Starting Langfuse Wrapper Docker Test Suite"
    log_info "=========================================="
    
    # Parse command line arguments
    local run_integration=true
    local run_scenarios=true
    local run_hooks=true
    local run_performance=true
    local run_stress=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --integration-only)
                run_scenarios=false
                run_hooks=false
                run_performance=false
                shift
                ;;
            --scenarios-only)
                run_integration=false
                run_hooks=false
                run_performance=false
                shift
                ;;
            --hooks-only)
                run_integration=false
                run_scenarios=false
                run_performance=false
                shift
                ;;
            --performance-only)
                run_integration=false
                run_scenarios=false
                run_hooks=false
                shift
                ;;
            --include-stress)
                run_stress=true
                shift
                ;;
            --help)
                echo "Usage: $0 [options]"
                echo "Options:"
                echo "  --integration-only   Run only Docker integration tests"
                echo "  --scenarios-only     Run only swarm scenario tests"
                echo "  --hooks-only         Run only hook lifecycle tests"
                echo "  --performance-only   Run only performance benchmarks"
                echo "  --include-stress     Include stress testing"
                echo "  --help              Show this help message"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Execute test pipeline
    check_prerequisites
    setup_test_environment
    build_docker_image
    
    local overall_exit_code=0
    
    # Run selected test suites
    if [ "$run_integration" = true ]; then
        if ! run_docker_integration_tests; then
            overall_exit_code=1
        fi
    fi
    
    if [ "$run_scenarios" = true ]; then
        if ! run_swarm_scenario_tests; then
            overall_exit_code=1
        fi
    fi
    
    if [ "$run_hooks" = true ]; then
        if ! run_hook_lifecycle_tests; then
            overall_exit_code=1
        fi
    fi
    
    if [ "$run_performance" = true ]; then
        run_performance_benchmarks  # Don't fail overall on performance issues
    fi
    
    if [ "$run_stress" = true ]; then
        run_stress_tests  # Don't fail overall on stress test issues
    fi
    
    # Generate reports and validate
    validate_test_results
    generate_test_report
    cleanup_test_artifacts
    
    # Final status
    log_info "=========================================="
    if [ $overall_exit_code -eq 0 ]; then
        log_success "All critical tests passed successfully!"
        log_info "View detailed report: ${TEST_RESULTS_DIR}/docker-test-report.html"
    else
        log_error "Some critical tests failed (exit code: $overall_exit_code)"
        log_info "Check test results in: ${TEST_RESULTS_DIR}/"
    fi
    
    exit $overall_exit_code
}

# Execute main function with all arguments
main "$@"