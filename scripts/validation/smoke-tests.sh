#!/bin/bash
# Smoke Tests - Basic functionality validation
# Quick tests to ensure core features are working

set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
ENVIRONMENT=${ENVIRONMENT:-"local"}
TIMEOUT=${TIMEOUT:-30}
OUTPUT_DIR=${OUTPUT_DIR:-"smoke-test-results"}

# Service URLs
MANAGER_URL="http://localhost:3001"
DASHBOARD_URL="http://localhost:3000"

# Test results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

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

Smoke tests for basic swarm functionality validation.

OPTIONS:
    -e, --environment ENV    Environment (local|staging|production) [default: local]
    -t, --timeout SECONDS    Request timeout [default: 30]
    -o, --output DIR         Output directory [default: smoke-test-results]
    -h, --help               Show this help message

EXAMPLES:
    $0                       # Run smoke tests on local environment
    $0 -e staging            # Run against staging environment
    $0 -t 60                 # Custom timeout

EOF
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            -t|--timeout)
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

# Setup environment
setup_environment() {
    case $ENVIRONMENT in
        staging)
            MANAGER_URL="https://swarm-manager-staging.fly.dev"
            DASHBOARD_URL="https://staging-dashboard.vercel.app"
            ;;
        production)
            MANAGER_URL="https://swarm-manager-live.fly.dev"
            DASHBOARD_URL="https://admin-dashboard-l0e1w6ivz-hackingco.vercel.app"
            ;;
        *)
            # Keep local defaults
            ;;
    esac
    
    mkdir -p "$OUTPUT_DIR"
    info "Running smoke tests against $ENVIRONMENT environment"
}

# Run a smoke test
run_smoke_test() {
    local test_name="$1"
    local test_function="$2"
    
    progress "Running $test_name..."
    ((TOTAL_TESTS++))
    
    if $test_function; then
        success "$test_name passed"
        ((PASSED_TESTS++))
        return 0
    else
        error "$test_name failed"
        ((FAILED_TESTS++))
        return 1
    fi
}

# Test basic API connectivity
test_api_connectivity() {
    curl -f -s --max-time "$TIMEOUT" "$MANAGER_URL/health" > /dev/null 2>&1
}

# Test API status endpoint
test_api_status() {
    local response
    response=$(curl -f -s --max-time "$TIMEOUT" "$MANAGER_URL/api/system/status" 2>/dev/null)
    
    # Check if response contains expected fields
    echo "$response" | grep -q '"status"' && \
    echo "$response" | grep -q '"timestamp"'
}

# Test swarm initialization
test_swarm_init() {
    local response
    response=$(curl -f -s --max-time "$TIMEOUT" \
        -H "Content-Type: application/json" \
        -d '{"topology": "mesh", "maxAgents": 3}' \
        "$MANAGER_URL/api/swarm/init" 2>/dev/null)
    
    # Check if response contains swarm ID
    echo "$response" | grep -q '"swarmId"'
}

# Test agent spawning
test_agent_spawn() {
    # First initialize a swarm
    local swarm_response
    swarm_response=$(curl -f -s --max-time "$TIMEOUT" \
        -H "Content-Type: application/json" \
        -d '{"topology": "mesh", "maxAgents": 3}' \
        "$MANAGER_URL/api/swarm/init" 2>/dev/null)
    
    local swarm_id
    swarm_id=$(echo "$swarm_response" | grep -o '"swarmId":"[^"]*"' | cut -d'"' -f4)
    
    if [ -z "$swarm_id" ]; then
        return 1
    fi
    
    # Spawn an agent
    local agent_response
    agent_response=$(curl -f -s --max-time "$TIMEOUT" \
        -H "Content-Type: application/json" \
        -d "{\"swarmId\": \"$swarm_id\", \"type\": \"researcher\", \"name\": \"SmokeTestAgent\"}" \
        "$MANAGER_URL/api/swarm/agents" 2>/dev/null)
    
    # Check if response contains agent ID
    echo "$agent_response" | grep -q '"agentId"'
}

# Test memory operations
test_memory_operations() {
    # Test memory store
    local store_response
    store_response=$(curl -f -s --max-time "$TIMEOUT" \
        -H "Content-Type: application/json" \
        -d '{"key": "smoke-test", "value": "test-data", "namespace": "testing"}' \
        "$MANAGER_URL/api/memory/store" 2>/dev/null)
    
    # Test memory retrieve
    local retrieve_response
    retrieve_response=$(curl -f -s --max-time "$TIMEOUT" \
        "$MANAGER_URL/api/memory/retrieve?key=smoke-test&namespace=testing" 2>/dev/null)
    
    # Check if we can retrieve what we stored
    echo "$retrieve_response" | grep -q "test-data"
}

# Test WebSocket connectivity
test_websocket() {
    local ws_url="${MANAGER_URL/http/ws}/ws"
    
    # Create WebSocket test script
    local ws_script="$OUTPUT_DIR/smoke-ws-test.js"
    cat > "$ws_script" << EOF
const WebSocket = require('ws');

const ws = new WebSocket('$ws_url');
let connected = false;

const timeout = setTimeout(() => {
    if (!connected) {
        process.exit(1);
    }
}, ${TIMEOUT}000);

ws.on('open', () => {
    connected = true;
    clearTimeout(timeout);
    ws.close();
    process.exit(0);
});

ws.on('error', () => {
    clearTimeout(timeout);
    process.exit(1);
});
EOF
    
    node "$ws_script" 2>/dev/null
    local result=$?
    rm -f "$ws_script"
    return $result
}

# Test database connectivity
test_database() {
    local response
    response=$(curl -f -s --max-time "$TIMEOUT" \
        "$MANAGER_URL/api/system/database-status" 2>/dev/null)
    
    # Check if database is connected
    echo "$response" | grep -q '"connected":true'
}

# Test task orchestration
test_task_orchestration() {
    # Initialize swarm first
    local swarm_response
    swarm_response=$(curl -f -s --max-time "$TIMEOUT" \
        -H "Content-Type: application/json" \
        -d '{"topology": "mesh", "maxAgents": 2}' \
        "$MANAGER_URL/api/swarm/init" 2>/dev/null)
    
    local swarm_id
    swarm_id=$(echo "$swarm_response" | grep -o '"swarmId":"[^"]*"' | cut -d'"' -f4)
    
    if [ -z "$swarm_id" ]; then
        return 1
    fi
    
    # Orchestrate a simple task
    local task_response
    task_response=$(curl -f -s --max-time "$TIMEOUT" \
        -H "Content-Type: application/json" \
        -d "{\"swarmId\": \"$swarm_id\", \"task\": \"Simple smoke test task\", \"strategy\": \"sequential\"}" \
        "$MANAGER_URL/api/swarm/tasks" 2>/dev/null)
    
    # Check if task was created
    echo "$task_response" | grep -q '"taskId"'
}

# Test metrics endpoint
test_metrics() {
    local response
    response=$(curl -f -s --max-time "$TIMEOUT" \
        "$MANAGER_URL/api/metrics" 2>/dev/null)
    
    # Check if metrics contain expected data
    echo "$response" | grep -q '"system"' || echo "$response" | grep -q '"requests"'
}

# Test dashboard accessibility (if available)
test_dashboard() {
    if [[ "$DASHBOARD_URL" == *"localhost"* ]]; then
        # For local, check if dashboard health endpoint exists
        curl -f -s --max-time "$TIMEOUT" "$DASHBOARD_URL/api/health" > /dev/null 2>&1 || \
        curl -f -s --max-time "$TIMEOUT" "$DASHBOARD_URL" > /dev/null 2>&1
    else
        # For remote, just check if URL is accessible
        curl -f -s --max-time "$TIMEOUT" "$DASHBOARD_URL" > /dev/null 2>&1
    fi
}

# Generate smoke test report
generate_report() {
    local timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    local report_file="$OUTPUT_DIR/smoke-test-report.json"
    
    local success_rate=0
    if [ $TOTAL_TESTS -gt 0 ]; then
        success_rate=$(( (PASSED_TESTS * 100) / TOTAL_TESTS ))
    fi
    
    cat > "$report_file" << EOF
{
  "timestamp": "$timestamp",
  "environment": "$ENVIRONMENT",
  "type": "smoke-tests",
  "summary": {
    "total_tests": $TOTAL_TESTS,
    "passed_tests": $PASSED_TESTS,
    "failed_tests": $FAILED_TESTS,
    "success_rate": $success_rate,
    "overall_status": "$([ $FAILED_TESTS -eq 0 ] && echo "PASS" || echo "FAIL")"
  },
  "configuration": {
    "manager_url": "$MANAGER_URL",
    "dashboard_url": "$DASHBOARD_URL",
    "timeout": $TIMEOUT
  }
}
EOF
    
    info "Smoke test report saved to: $report_file"
}

# Display results
display_results() {
    echo ""
    echo -e "${BLUE}💨 Smoke Test Results${NC}"
    echo "===================="
    echo "Environment: $ENVIRONMENT"
    echo "Total Tests: $TOTAL_TESTS"
    echo -e "${GREEN}✅ Passed: $PASSED_TESTS${NC}"
    echo -e "${RED}❌ Failed: $FAILED_TESTS${NC}"
    
    if [ $TOTAL_TESTS -gt 0 ]; then
        local success_rate=$(( (PASSED_TESTS * 100) / TOTAL_TESTS ))
        echo "Success Rate: $success_rate%"
    fi
    echo ""
}

# Main execution
main() {
    parse_args "$@"
    
    echo ""
    echo -e "${BLUE}💨 Smoke Tests - Basic Functionality${NC}"
    echo -e "${BLUE}====================================${NC}\n"
    
    setup_environment
    
    # Run core smoke tests
    run_smoke_test "API Connectivity" test_api_connectivity
    run_smoke_test "API Status" test_api_status
    run_smoke_test "Database Connectivity" test_database
    run_smoke_test "Swarm Initialization" test_swarm_init
    run_smoke_test "Agent Spawning" test_agent_spawn
    run_smoke_test "Memory Operations" test_memory_operations
    run_smoke_test "WebSocket Connection" test_websocket
    run_smoke_test "Task Orchestration" test_task_orchestration
    run_smoke_test "Metrics Endpoint" test_metrics
    
    # Optional dashboard test
    if run_smoke_test "Dashboard Access" test_dashboard; then
        info "Dashboard is accessible"
    else
        warning "Dashboard test failed (may be expected for some environments)"
        # Don't count dashboard failure as critical for overall result
        ((FAILED_TESTS--))
        ((TOTAL_TESTS--))
    fi
    
    # Generate report
    generate_report
    
    # Display results
    display_results
    
    # Exit with appropriate code
    if [ $FAILED_TESTS -eq 0 ]; then
        success "All smoke tests passed! 🎉"
        success "Core functionality is working correctly"
        exit 0
    else
        error "$FAILED_TESTS smoke test(s) failed"
        error "Core functionality may be compromised"
        exit 1
    fi
}

# Execute main function
main "$@"