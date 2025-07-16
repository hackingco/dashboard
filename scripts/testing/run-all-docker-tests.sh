#!/bin/bash

# Comprehensive Docker Stack Test Runner
# Orchestrates all validation tests for the complete Docker stack

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
RESULTS_DIR="${PROJECT_ROOT}/test-results"
LOG_FILE="${RESULTS_DIR}/docker-stack-tests-$(date +%Y%m%d_%H%M%S).log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging function
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

# Setup test environment
setup() {
    log "Setting up test environment..."
    
    mkdir -p "$RESULTS_DIR"
    cd "$PROJECT_ROOT"
    
    # Create comprehensive results file
    cat > "${RESULTS_DIR}/test-execution-summary.json" <<EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "tests": {},
  "environment": {
    "project_root": "$PROJECT_ROOT",
    "results_dir": "$RESULTS_DIR",
    "docker_version": "$(docker --version 2>/dev/null || echo 'not available')",
    "compose_version": "$(docker compose version 2>/dev/null || docker-compose --version 2>/dev/null || echo 'not available')",
    "node_version": "$(node --version 2>/dev/null || echo 'not available')"
  },
  "summary": {
    "total_test_suites": 0,
    "passed_suites": 0,
    "failed_suites": 0,
    "warnings": 0,
    "start_time": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "end_time": null,
    "duration_seconds": null
  }
}
EOF
    
    success "Test environment setup completed"
}

# Update test results
update_test_result() {
    local test_name="$1"
    local status="$2"
    local message="$3"
    local details="${4:-{}}"
    
    local temp_file=$(mktemp)
    jq --arg name "$test_name" \
       --arg status "$status" \
       --arg message "$message" \
       --argjson details "$details" \
       '.tests[$name] = {
         "status": $status,
         "message": $message,
         "details": $details,
         "timestamp": now | strftime("%Y-%m-%dT%H:%M:%SZ")
       } | 
       .summary.total_test_suites += 1 |
       if $status == "passed" then .summary.passed_suites += 1
       elif $status == "failed" then .summary.failed_suites += 1
       else .summary.warnings += 1 end' \
       "${RESULTS_DIR}/test-execution-summary.json" > "$temp_file" && mv "$temp_file" "${RESULTS_DIR}/test-execution-summary.json"
}

# Install dependencies if needed
install_dependencies() {
    log "Checking and installing dependencies..."
    
    # Check if Node.js packages are available
    local missing_packages=()
    
    if ! node -e "require('axios')" 2>/dev/null; then
        missing_packages+=("axios")
    fi
    
    if ! node -e "require('ioredis')" 2>/dev/null; then
        missing_packages+=("ioredis")
    fi
    
    if ! node -e "require('pg')" 2>/dev/null; then
        missing_packages+=("pg")
    fi
    
    if [[ ${#missing_packages[@]} -gt 0 ]]; then
        warning "Missing packages: ${missing_packages[*]}"
        log "Installing missing packages..."
        
        if npm install "${missing_packages[@]}" --no-save; then
            success "Dependencies installed"
        else
            warning "Failed to install some dependencies - tests may fail"
        fi
    else
        success "All dependencies are available"
    fi
}

# Run Docker stack validation
run_docker_validation() {
    log "Running Docker stack validation..."
    
    if bash "${SCRIPT_DIR}/docker-stack-validation.sh"; then
        success "Docker stack validation passed"
        update_test_result "docker_stack_validation" "passed" "Docker stack validation successful"
        return 0
    else
        error "Docker stack validation failed"
        update_test_result "docker_stack_validation" "failed" "Docker stack validation failed"
        return 1
    fi
}

# Run Langfuse connectivity tests
run_langfuse_tests() {
    log "Running Langfuse connectivity tests..."
    
    if node "${SCRIPT_DIR}/langfuse-connectivity-test.js"; then
        success "Langfuse connectivity tests passed"
        update_test_result "langfuse_connectivity" "passed" "Langfuse connectivity tests successful"
        
        # Copy results
        if [[ -f "langfuse-connectivity-test-results.json" ]]; then
            cp "langfuse-connectivity-test-results.json" "${RESULTS_DIR}/"
        fi
        return 0
    else
        error "Langfuse connectivity tests failed"
        update_test_result "langfuse_connectivity" "failed" "Langfuse connectivity tests failed"
        return 1
    fi
}

# Run ClickHouse data flow tests
run_clickhouse_tests() {
    log "Running ClickHouse data flow tests..."
    
    if node "${SCRIPT_DIR}/clickhouse-data-flow-test.js"; then
        success "ClickHouse data flow tests passed"
        update_test_result "clickhouse_data_flow" "passed" "ClickHouse data flow tests successful"
        
        # Copy results
        if [[ -f "clickhouse-data-flow-test-results.json" ]]; then
            cp "clickhouse-data-flow-test-results.json" "${RESULTS_DIR}/"
        fi
        return 0
    else
        error "ClickHouse data flow tests failed"
        update_test_result "clickhouse_data_flow" "failed" "ClickHouse data flow tests failed"
        return 1
    fi
}

# Run Prisma/database tests
run_prisma_tests() {
    log "Running Prisma migrations and database tests..."
    
    if node "${SCRIPT_DIR}/prisma-migrations-test.js"; then
        success "Prisma/database tests passed"
        update_test_result "prisma_migrations" "passed" "Prisma migrations tests successful"
        
        # Copy results
        if [[ -f "prisma-migrations-test-results.json" ]]; then
            cp "prisma-migrations-test-results.json" "${RESULTS_DIR}/"
        fi
        return 0
    else
        error "Prisma/database tests failed"
        update_test_result "prisma_migrations" "failed" "Prisma migrations tests failed"
        return 1
    fi
}

# Run health monitoring
run_health_monitoring() {
    log "Running health monitoring suite..."
    
    if node "${SCRIPT_DIR}/health-monitoring-suite.js"; then
        success "Health monitoring completed"
        update_test_result "health_monitoring" "passed" "Health monitoring successful"
        
        # Copy results
        if [[ -f "health-check-latest.json" ]]; then
            cp "health-check-latest.json" "${RESULTS_DIR}/health-check-final.json"
        fi
        return 0
    else
        error "Health monitoring failed"
        update_test_result "health_monitoring" "failed" "Health monitoring failed"
        return 1
    fi
}

# Create comprehensive test report
create_final_report() {
    log "Creating comprehensive test report..."
    
    local end_time=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local start_time=$(jq -r '.summary.start_time' "${RESULTS_DIR}/test-execution-summary.json")
    local duration=$(( $(date -d "$end_time" +%s) - $(date -d "$start_time" +%s) ))
    
    # Update summary with end time and duration
    local temp_file=$(mktemp)
    jq --arg end_time "$end_time" \
       --arg duration "$duration" \
       '.summary.end_time = $end_time | 
        .summary.duration_seconds = ($duration | tonumber)' \
       "${RESULTS_DIR}/test-execution-summary.json" > "$temp_file" && mv "$temp_file" "${RESULTS_DIR}/test-execution-summary.json"
    
    # Create markdown report
    cat > "${RESULTS_DIR}/Docker_Stack_Test_Report.md" <<EOF
# Docker Stack Validation Test Report

**Generated:** $(date)  
**Duration:** ${duration} seconds  
**Project:** $(basename "$PROJECT_ROOT")

## Summary

$(jq -r '.summary | "- Total Test Suites: \(.total_test_suites)\n- Passed: \(.passed_suites)\n- Failed: \(.failed_suites)\n- Warnings: \(.warnings)"' "${RESULTS_DIR}/test-execution-summary.json")

## Environment

$(jq -r '.environment | "- Project Root: \(.project_root)\n- Docker Version: \(.docker_version)\n- Compose Version: \(.compose_version)\n- Node Version: \(.node_version)"' "${RESULTS_DIR}/test-execution-summary.json")

## Test Results

$(jq -r '.tests | to_entries[] | "### \(.key | gsub("_"; " ") | ascii_upcase)\n\n**Status:** \(.value.status | ascii_upcase)  \n**Message:** \(.value.message)  \n**Timestamp:** \(.value.timestamp)\n"' "${RESULTS_DIR}/test-execution-summary.json")

## Files Generated

- \`test-execution-summary.json\` - Complete test results
- \`docker-stack-test-results.json\` - Docker validation results
- \`langfuse-connectivity-test-results.json\` - Langfuse test results
- \`clickhouse-data-flow-test-results.json\` - ClickHouse test results
- \`prisma-migrations-test-results.json\` - Database test results
- \`health-check-final.json\` - Health monitoring results
- \`docker-stack-tests-*.log\` - Detailed execution logs

## Next Steps

$(if [[ $(jq -r '.summary.failed_suites' "${RESULTS_DIR}/test-execution-summary.json") -gt 0 ]]; then
echo "⚠️ **Some tests failed. Review the detailed results and logs to identify issues.**"
else
echo "✅ **All tests passed! The Docker stack is ready for use.**"
fi)
EOF
    
    success "Test report created: ${RESULTS_DIR}/Docker_Stack_Test_Report.md"
}

# Store results for coordination
store_coordination_results() {
    log "Storing results for swarm coordination..."
    
    local summary=$(jq -r '.summary | "Docker stack tests: \(.passed_suites)/\(.total_test_suites) passed in \(.duration_seconds)s"' "${RESULTS_DIR}/test-execution-summary.json")
    
    # Store final test results
    if command -v npx &> /dev/null; then
        npx claude-flow@alpha hooks notification --message "$summary" --telemetry true || true
        npx claude-flow@alpha hooks post-edit --file "${RESULTS_DIR}/test-execution-summary.json" --memory-key "docker/validation/final" || true
    fi
}

# Cleanup function
cleanup() {
    log "Cleaning up test environment..."
    
    cd "$PROJECT_ROOT"
    
    # Stop any running containers from tests
    docker-compose down --remove-orphans &> /dev/null || true
    docker-compose -f docker-compose.langfuse.yml down --remove-orphans &> /dev/null || true
    
    success "Cleanup completed"
}

# Main execution
main() {
    local start_time=$(date +%s)
    
    log "=== DOCKER STACK COMPREHENSIVE VALIDATION ==="
    log "Starting comprehensive Docker stack validation"
    log "Project root: $PROJECT_ROOT"
    log "Results directory: $RESULTS_DIR"
    
    # Set trap for cleanup
    trap cleanup EXIT
    
    # Setup
    setup
    install_dependencies
    
    # Run all test suites
    local failed_tests=0
    
    log "=== RUNNING TEST SUITES ==="
    
    run_docker_validation || ((failed_tests++))
    sleep 5  # Brief pause between test suites
    
    run_langfuse_tests || ((failed_tests++))
    sleep 5
    
    run_clickhouse_tests || ((failed_tests++))
    sleep 5
    
    run_prisma_tests || ((failed_tests++))
    sleep 5
    
    run_health_monitoring || ((failed_tests++))
    
    # Create final report
    create_final_report
    store_coordination_results
    
    # Summary
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log "=== FINAL SUMMARY ==="
    log "Total execution time: ${duration} seconds"
    log "Failed test suites: $failed_tests"
    log "Results saved to: $RESULTS_DIR"
    
    if [[ $failed_tests -eq 0 ]]; then
        success "🎉 ALL DOCKER STACK TESTS PASSED!"
        exit 0
    else
        error "❌ $failed_tests test suite(s) failed. Check the detailed reports."
        exit 1
    fi
}

# Handle script arguments
case "${1:-run}" in
    "setup")
        setup
        ;;
    "docker")
        setup && install_dependencies && run_docker_validation
        ;;
    "langfuse")
        setup && install_dependencies && run_langfuse_tests
        ;;
    "clickhouse")
        setup && install_dependencies && run_clickhouse_tests
        ;;
    "prisma")
        setup && install_dependencies && run_prisma_tests
        ;;
    "health")
        setup && install_dependencies && run_health_monitoring
        ;;
    "report")
        create_final_report
        ;;
    "run"|*)
        main
        ;;
esac