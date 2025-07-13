#!/bin/bash
# Integration Test Runner
# Tests integration between services, APIs, and databases

set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
ENVIRONMENT=${ENVIRONMENT:-"test"}
OUTPUT_DIR=${OUTPUT_DIR:-"test-results"}
VERBOSE=${VERBOSE:-false}
TIMEOUT=${TIMEOUT:-300} # 5 minutes default timeout

# Service configuration
SERVICES_CONFIG=(
    "manager:3001:/health"
    "dashboard:3000:/api/health"
)

# Test results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
START_TIME=$(date +%s)

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

Integration test runner for swarm services.

OPTIONS:
    -e, --environment ENV    Test environment (test|staging|local) [default: test]
    -v, --verbose            Verbose output
    -t, --timeout SECONDS    Service startup timeout [default: 300]
    -o, --output DIR         Output directory for reports [default: test-results]
    -h, --help               Show this help message

EXAMPLES:
    $0                       # Run integration tests in test environment
    $0 -e local              # Run against local services
    $0 -e staging -v         # Run against staging with verbose output

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
            -v|--verbose)
                VERBOSE=true
                shift
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

# Setup test environment
setup_environment() {
    info "Setting up integration test environment..."
    
    # Create output directory
    mkdir -p "$OUTPUT_DIR"
    
    # Set environment variables
    export NODE_ENV="test"
    export CI=true
    
    case $ENVIRONMENT in
        staging)
            export TEST_API_URL="https://swarm-manager-staging.fly.dev"
            export TEST_DASHBOARD_URL="https://staging-dashboard.vercel.app"
            ;;
        local)
            export TEST_API_URL="http://localhost:3001"
            export TEST_DASHBOARD_URL="http://localhost:3000"
            ;;
        *)
            export TEST_API_URL="http://localhost:3001"
            export TEST_DASHBOARD_URL="http://localhost:3000"
            ;;
    esac
    
    success "Environment setup complete for: $ENVIRONMENT"
}

# Start local services if needed
start_services() {
    if [ "$ENVIRONMENT" != "test" ] && [ "$ENVIRONMENT" != "local" ]; then
        info "Using external services for $ENVIRONMENT environment"
        return 0
    fi
    
    info "Starting local services for integration testing..."
    
    # Check if docker-compose file exists
    if [ -f "docker-compose.test.yml" ]; then
        progress "Starting services with docker-compose..."
        docker-compose -f docker-compose.test.yml up -d
        
        # Wait for services to be ready
        wait_for_services
    elif [ -f "docker-compose.yml" ]; then
        progress "Starting services with main docker-compose..."
        docker-compose up -d
        
        # Wait for services to be ready
        wait_for_services
    else
        warning "No docker-compose configuration found"
        info "Assuming services are already running"
    fi
}

# Wait for services to be ready
wait_for_services() {
    info "Waiting for services to be ready..."
    
    local max_attempts=$((TIMEOUT / 5))
    local attempt=1
    
    for service_config in "${SERVICES_CONFIG[@]}"; do
        IFS=':' read -r service_name port health_endpoint <<< "$service_config"
        local service_url="http://localhost:${port}${health_endpoint}"
        
        progress "Waiting for $service_name at $service_url..."
        
        while [ $attempt -le $max_attempts ]; do
            if curl -f "$service_url" > /dev/null 2>&1; then
                success "$service_name is ready"
                break
            fi
            
            if [ $attempt -eq $max_attempts ]; then
                error "$service_name failed to start within ${TIMEOUT} seconds"
                return 1
            fi
            
            echo "  Attempt $attempt/$max_attempts - waiting..."
            sleep 5
            ((attempt++))
        done
        
        attempt=1
    done
    
    success "All services are ready"
}

# Stop local services
stop_services() {
    if [ "$ENVIRONMENT" = "test" ] || [ "$ENVIRONMENT" = "local" ]; then
        info "Stopping local services..."
        
        if [ -f "docker-compose.test.yml" ]; then
            docker-compose -f docker-compose.test.yml down
        elif [ -f "docker-compose.yml" ]; then
            docker-compose down
        fi
        
        success "Services stopped"
    fi
}

# Run integration test suite
run_integration_test() {
    local test_name=$1
    local test_command=$2
    local test_start=$(date +%s)
    
    info "Running $test_name..."
    
    local test_output="${OUTPUT_DIR}/${test_name,,}-integration-$(date +%Y%m%d-%H%M%S).log"
    
    if eval "$test_command" > "$test_output" 2>&1; then
        local test_end=$(date +%s)
        local duration=$((test_end - test_start))
        success "$test_name passed (${duration}s)"
        ((PASSED_TESTS++))
    else
        local test_end=$(date +%s)
        local duration=$((test_end - test_start))
        error "$test_name failed (${duration}s)"
        ((FAILED_TESTS++))
        
        # Show failure details
        echo "  Failure output:"
        tail -n 10 "$test_output" | sed 's/^/    /'
        if [ "$VERBOSE" = true ]; then
            echo "  Full output: $test_output"
        fi
    fi
    
    ((TOTAL_TESTS++))
}

# Test API health endpoints
test_api_health() {
    info "Testing API health endpoints..."
    
    local api_health_test="curl -f ${TEST_API_URL}/health && curl -f ${TEST_API_URL}/api/system/status"
    run_integration_test "API Health Check" "$api_health_test"
}

# Test WebSocket connections
test_websocket_connection() {
    info "Testing WebSocket connections..."
    
    # Create a simple WebSocket test script
    local ws_test_script="${OUTPUT_DIR}/ws-test.js"
    cat > "$ws_test_script" << 'EOF'
const WebSocket = require('ws');
const wsUrl = process.env.TEST_API_URL.replace('http', 'ws') + '/ws';

console.log('Testing WebSocket connection to:', wsUrl);

const ws = new WebSocket(wsUrl);

ws.on('open', () => {
    console.log('✅ WebSocket connection established');
    ws.send(JSON.stringify({ type: 'ping' }));
});

ws.on('message', (data) => {
    console.log('📨 Received message:', data.toString());
    ws.close();
});

ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error.message);
    process.exit(1);
});

ws.on('close', () => {
    console.log('🔌 WebSocket connection closed');
    process.exit(0);
});

// Timeout after 10 seconds
setTimeout(() => {
    console.error('❌ WebSocket test timeout');
    process.exit(1);
}, 10000);
EOF
    
    run_integration_test "WebSocket Connection" "node $ws_test_script"
}

# Test database connectivity
test_database_connectivity() {
    info "Testing database connectivity..."
    
    local db_test="curl -f ${TEST_API_URL}/api/system/database-status"
    run_integration_test "Database Connectivity" "$db_test"
}

# Test swarm operations
test_swarm_operations() {
    info "Testing swarm operations..."
    
    # Create swarm test script
    local swarm_test_script="${OUTPUT_DIR}/swarm-test.js"
    cat > "$swarm_test_script" << 'EOF'
const fetch = require('node-fetch');

async function testSwarmOperations() {
    const baseUrl = process.env.TEST_API_URL;
    
    try {
        // Test swarm initialization
        console.log('🐝 Testing swarm initialization...');
        const initResponse = await fetch(`${baseUrl}/api/swarm/init`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topology: 'mesh', maxAgents: 3 })
        });
        
        if (!initResponse.ok) {
            throw new Error(`Swarm init failed: ${initResponse.status}`);
        }
        
        const initData = await initResponse.json();
        console.log('✅ Swarm initialized:', initData.swarmId);
        
        // Test agent spawning
        console.log('🤖 Testing agent spawning...');
        const spawnResponse = await fetch(`${baseUrl}/api/swarm/agents`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                swarmId: initData.swarmId,
                type: 'researcher',
                name: 'TestAgent'
            })
        });
        
        if (!spawnResponse.ok) {
            throw new Error(`Agent spawn failed: ${spawnResponse.status}`);
        }
        
        const spawnData = await spawnResponse.json();
        console.log('✅ Agent spawned:', spawnData.agentId);
        
        // Test swarm status
        console.log('📊 Testing swarm status...');
        const statusResponse = await fetch(`${baseUrl}/api/swarm/${initData.swarmId}/status`);
        
        if (!statusResponse.ok) {
            throw new Error(`Swarm status failed: ${statusResponse.status}`);
        }
        
        const statusData = await statusResponse.json();
        console.log('✅ Swarm status retrieved:', statusData.status);
        
        console.log('🎉 All swarm operations completed successfully');
        
    } catch (error) {
        console.error('❌ Swarm test failed:', error.message);
        process.exit(1);
    }
}

testSwarmOperations();
EOF
    
    run_integration_test "Swarm Operations" "node $swarm_test_script"
}

# Test end-to-end workflow
test_e2e_workflow() {
    info "Testing end-to-end workflow..."
    
    # Create E2E test script
    local e2e_test_script="${OUTPUT_DIR}/e2e-test.js"
    cat > "$e2e_test_script" << 'EOF'
const fetch = require('node-fetch');
const WebSocket = require('ws');

async function testE2EWorkflow() {
    const baseUrl = process.env.TEST_API_URL;
    
    try {
        console.log('🚀 Starting end-to-end workflow test...');
        
        // 1. Health check
        console.log('1️⃣ Health check...');
        const healthResponse = await fetch(`${baseUrl}/health`);
        if (!healthResponse.ok) throw new Error('Health check failed');
        
        // 2. Initialize swarm
        console.log('2️⃣ Initialize swarm...');
        const swarmResponse = await fetch(`${baseUrl}/api/swarm/init`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topology: 'mesh', maxAgents: 2 })
        });
        if (!swarmResponse.ok) throw new Error('Swarm init failed');
        const swarmData = await swarmResponse.json();
        
        // 3. Spawn agents
        console.log('3️⃣ Spawn agents...');
        const agentPromises = ['researcher', 'coder'].map(type =>
            fetch(`${baseUrl}/api/swarm/agents`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    swarmId: swarmData.swarmId,
                    type,
                    name: `Test${type.charAt(0).toUpperCase() + type.slice(1)}`
                })
            })
        );
        
        const agentResponses = await Promise.all(agentPromises);
        if (!agentResponses.every(r => r.ok)) {
            throw new Error('Agent spawning failed');
        }
        
        // 4. Execute task
        console.log('4️⃣ Execute task...');
        const taskResponse = await fetch(`${baseUrl}/api/swarm/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                swarmId: swarmData.swarmId,
                task: 'Test task execution',
                strategy: 'parallel'
            })
        });
        if (!taskResponse.ok) throw new Error('Task execution failed');
        
        // 5. Monitor progress
        console.log('5️⃣ Monitor progress...');
        const statusResponse = await fetch(`${baseUrl}/api/swarm/${swarmData.swarmId}/status`);
        if (!statusResponse.ok) throw new Error('Status check failed');
        
        console.log('🎉 End-to-end workflow completed successfully');
        
    } catch (error) {
        console.error('❌ E2E workflow failed:', error.message);
        process.exit(1);
    }
}

testE2EWorkflow();
EOF
    
    run_integration_test "E2E Workflow" "node $e2e_test_script"
}

# Main execution
main() {
    parse_args "$@"
    
    echo ""
    echo -e "${BLUE}🔗 Integration Test Runner${NC}"
    echo -e "${BLUE}==========================${NC}\n"
    
    echo -e "${YELLOW}Configuration:${NC}"
    echo -e "  Environment: $ENVIRONMENT"
    echo -e "  API URL: ${TEST_API_URL:-Not set}"
    echo -e "  Dashboard URL: ${TEST_DASHBOARD_URL:-Not set}"
    echo -e "  Timeout: ${TIMEOUT}s"
    echo -e "  Output: $OUTPUT_DIR"
    echo ""
    
    setup_environment
    
    # Start services if needed
    start_services
    
    # Trap to ensure cleanup
    trap 'stop_services' EXIT
    
    # Run integration tests
    test_api_health
    test_websocket_connection
    test_database_connectivity
    test_swarm_operations
    test_e2e_workflow
    
    # Calculate results
    local END_TIME=$(date +%s)
    local TOTAL_DURATION=$((END_TIME - START_TIME))
    
    # Generate report
    echo ""
    echo -e "${BLUE}📊 Integration Test Summary${NC}"
    echo "============================"
    echo "Total Tests: ${TOTAL_TESTS}"
    echo -e "${GREEN}✅ Passed: ${PASSED_TESTS}${NC}"
    echo -e "${RED}❌ Failed: ${FAILED_TESTS}${NC}"
    echo -e "⏳ Duration: ${TOTAL_DURATION}s"
    echo ""
    
    # Generate JSON report
    local report_file="$OUTPUT_DIR/integration-test-report.json"
    cat > "$report_file" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "type": "integration-tests",
  "environment": "$ENVIRONMENT",
  "duration": ${TOTAL_DURATION},
  "total": ${TOTAL_TESTS},
  "passed": ${PASSED_TESTS},
  "failed": ${FAILED_TESTS},
  "success": $([ $FAILED_TESTS -eq 0 ] && echo "true" || echo "false")
}
EOF
    
    # Final status
    if [ $FAILED_TESTS -eq 0 ]; then
        success "All integration tests passed! 🎉"
        info "Test report saved to: $report_file"
        exit 0
    else
        error "${FAILED_TESTS} integration test(s) failed"
        warning "Please check the logs for details"
        info "Test report saved to: $report_file"
        exit 1
    fi
}

# Execute main function
main "$@"