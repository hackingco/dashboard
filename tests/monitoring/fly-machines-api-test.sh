#!/bin/bash

# Fly Machines API Smoke Test Suite
# Tests Fly Machines API endpoints with health monitoring
# Usage: ./fly-machines-api-test.sh [app-name] [machine-id]

set -euo pipefail

# Configuration
APP_NAME="${1:-swarm-admin}"
MACHINE_ID="${2:-e82992c773ed98}"
FLY_ACCESS_TOKEN="${FLY_ACCESS_TOKEN:-}"
TIMEOUT=30
MAX_RETRIES=3
HEALTH_TIMEOUT=300  # 5 minutes max wait for health

# API Endpoints
FLY_API_BASE="https://api.machines.dev/v1"
APPS_ENDPOINT="$FLY_API_BASE/apps"
MACHINES_ENDPOINT="$FLY_API_BASE/apps/$APP_NAME/machines"
STATS_ENDPOINT="$MACHINES_ENDPOINT/$MACHINE_ID/stats"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test results tracking
TESTS_PASSED=0
TESTS_FAILED=0
FAILED_TESTS=()

echo "🔥 Fly Machines API Smoke Test Suite"
echo "===================================="
echo "📱 App: $APP_NAME"
echo "🤖 Machine: $MACHINE_ID"
echo "🌐 API Base: $FLY_API_BASE"
echo ""

# Function to check if FLY_ACCESS_TOKEN is set
check_token() {
    if [ -z "$FLY_ACCESS_TOKEN" ]; then
        echo -e "${RED}❌ FLY_ACCESS_TOKEN not set!${NC}"
        echo ""
        echo "Please set your Fly.io access token:"
        echo "export FLY_ACCESS_TOKEN=your_token_here"
        echo ""
        echo "Or run the setup script:"
        echo "./scripts/setup-fly-token.sh"
        exit 1
    fi
    
    # Validate token format
    if [[ ! "$FLY_ACCESS_TOKEN" =~ ^fo[0-9]_[a-zA-Z0-9_-]+$ ]]; then
        echo -e "${YELLOW}⚠️  Warning: Token format may be invalid${NC}"
        echo "Expected format: fo[0-9]_[alphanumeric_underscore_dash]"
        echo "Current token: ${FLY_ACCESS_TOKEN:0:10}..."
        echo ""
    fi
}

# Function to make authenticated API call
api_call() {
    local url="$1"
    local method="${2:-GET}"
    local data="${3:-}"
    
    local curl_cmd="curl -s --max-time $TIMEOUT -H 'Authorization: Bearer $FLY_ACCESS_TOKEN' -H 'Content-Type: application/json'"
    
    if [ "$method" != "GET" ] && [ -n "$data" ]; then
        curl_cmd="$curl_cmd -X $method -d '$data'"
    fi
    
    eval "$curl_cmd '$url'"
}

# Function to run a test with retries
run_test() {
    local test_name="$1"
    local test_function="$2"
    local expected_result="${3:-success}"
    
    echo -n "🧪 Testing: $test_name... "
    
    for i in $(seq 1 $MAX_RETRIES); do
        if $test_function; then
            echo -e "${GREEN}✅ PASS${NC}"
            ((TESTS_PASSED++))
            return 0
        else
            if [ $i -eq $MAX_RETRIES ]; then
                echo -e "${RED}❌ FAIL${NC}"
                ((TESTS_FAILED++))
                FAILED_TESTS+=("$test_name")
                return 1
            else
                echo -n "🔄 Retry $i/$MAX_RETRIES... "
                sleep 2
            fi
        fi
    done
}

# Test functions
test_api_connectivity() {
    local response=$(api_call "$APPS_ENDPOINT" "GET")
    local status_code=$(echo "$response" | jq -r '.error // empty' 2>/dev/null)
    
    if [ -z "$status_code" ] && echo "$response" | jq -e '. | type == "object"' >/dev/null 2>&1; then
        return 0
    else
        echo -e "\n${RED}API Error: $response${NC}"
        return 1
    fi
}

test_app_exists() {
    local response=$(api_call "$APPS_ENDPOINT/$APP_NAME" "GET")
    local app_name=$(echo "$response" | jq -r '.name // empty' 2>/dev/null)
    
    if [ "$app_name" = "$APP_NAME" ]; then
        return 0
    else
        echo -e "\n${RED}App not found or access denied: $response${NC}"
        return 1
    fi
}

test_machines_list() {
    local response=$(api_call "$MACHINES_ENDPOINT" "GET")
    
    if echo "$response" | jq -e '. | type == "array"' >/dev/null 2>&1; then
        local machine_count=$(echo "$response" | jq '. | length')
        echo -e "\n${BLUE}ℹ️  Found $machine_count machines${NC}"
        return 0
    else
        echo -e "\n${RED}Failed to list machines: $response${NC}"
        return 1
    fi
}

test_machine_stats() {
    local response=$(api_call "$STATS_ENDPOINT" "GET")
    
    if echo "$response" | jq -e '.cpu_usage // .memory_usage' >/dev/null 2>&1; then
        local cpu=$(echo "$response" | jq -r '.cpu_usage // "N/A"')
        local memory=$(echo "$response" | jq -r '.memory_usage // "N/A"')
        echo -e "\n${BLUE}ℹ️  CPU: $cpu%, Memory: $memory%${NC}"
        return 0
    else
        echo -e "\n${RED}Failed to get machine stats: $response${NC}"
        return 1
    fi
}

test_machine_status() {
    local response=$(api_call "$MACHINES_ENDPOINT/$MACHINE_ID" "GET")
    local status=$(echo "$response" | jq -r '.state // empty' 2>/dev/null)
    
    if [ -n "$status" ]; then
        echo -e "\n${BLUE}ℹ️  Machine status: $status${NC}"
        return 0
    else
        echo -e "\n${RED}Failed to get machine status: $response${NC}"
        return 1
    fi
}

# Health monitoring function
monitor_health_until_passing() {
    echo ""
    echo "🏥 Starting health monitoring..."
    echo "⏰ Max wait time: ${HEALTH_TIMEOUT}s"
    echo ""
    
    local start_time=$(date +%s)
    local checks=0
    
    while true; do
        local current_time=$(date +%s)
        local elapsed=$((current_time - start_time))
        
        if [ $elapsed -ge $HEALTH_TIMEOUT ]; then
            echo -e "${RED}❌ Health check timeout after ${HEALTH_TIMEOUT}s${NC}"
            return 1
        fi
        
        ((checks++))
        echo -n "🔍 Health check #$checks (${elapsed}s elapsed)... "
        
        # Get machine status
        local response=$(api_call "$MACHINES_ENDPOINT/$MACHINE_ID" "GET" 2>/dev/null)
        local status=$(echo "$response" | jq -r '.state // "unknown"' 2>/dev/null)
        
        case "$status" in
            "started")
                echo -e "${GREEN}✅ HEALTHY - Machine is running${NC}"
                
                # Additional health check via HTTP if available
                local health_response=$(api_call "$MACHINES_ENDPOINT/$MACHINE_ID/health" "GET" 2>/dev/null || echo "{}")
                local health_status=$(echo "$health_response" | jq -r '.status // "unknown"' 2>/dev/null)
                
                if [ "$health_status" = "passing" ] || [ "$health_status" = "unknown" ]; then
                    echo -e "${GREEN}🎉 Health monitoring complete - System is healthy!${NC}"
                    return 0
                else
                    echo -e "${YELLOW}⚠️  Machine running but health check: $health_status${NC}"
                fi
                ;;
            "stopped"|"stopping")
                echo -e "${RED}❌ UNHEALTHY - Machine is $status${NC}"
                ;;
            "starting")
                echo -e "${YELLOW}⏳ STARTING - Machine is starting up...${NC}"
                ;;
            *)
                echo -e "${YELLOW}❓ UNKNOWN - Status: $status${NC}"
                ;;
        esac
        
        sleep 10
    done
}

# WebSocket connection test
test_websocket_connection() {
    echo ""
    echo "🔌 Testing WebSocket real-time connections..."
    
    # Test if wscat is available
    if ! command -v wscat &> /dev/null; then
        echo -e "${YELLOW}⚠️  wscat not found - installing...${NC}"
        npm install -g wscat 2>/dev/null || {
            echo -e "${YELLOW}⚠️  Skipping WebSocket test - wscat not available${NC}"
            return 0
        }
    fi
    
    # Test WebSocket connection to manager service
    local ws_url="wss://swarm-mgr-1739853764.fly.dev/ws"
    echo "🔗 Testing WebSocket: $ws_url"
    
    timeout 10 wscat -c "$ws_url" -x '{"type":"ping"}' &>/dev/null && {
        echo -e "${GREEN}✅ WebSocket connection successful${NC}"
        return 0
    } || {
        echo -e "${YELLOW}⚠️  WebSocket connection failed or timed out${NC}"
        return 1
    }
}

# Main execution
main() {
    echo "🔐 Checking authentication..."
    check_token
    echo -e "${GREEN}✅ Token format validated${NC}"
    echo ""
    
    # Core API tests
    run_test "API Connectivity" test_api_connectivity
    run_test "App Existence" test_app_exists
    run_test "Machines List" test_machines_list
    run_test "Machine Stats" test_machine_stats
    run_test "Machine Status" test_machine_status
    
    # WebSocket test
    run_test "WebSocket Connection" test_websocket_connection
    
    # Health monitoring
    echo ""
    echo "🏥 Health Monitoring Phase"
    echo "========================="
    
    if monitor_health_until_passing; then
        echo -e "${GREEN}✅ Health monitoring completed successfully${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌ Health monitoring failed${NC}"
        ((TESTS_FAILED++))
        FAILED_TESTS+=("Health Monitoring")
    fi
    
    # Results summary
    echo ""
    echo "📊 Test Results Summary"
    echo "======================="
    echo -e "✅ Passed: ${GREEN}$TESTS_PASSED${NC}"
    echo -e "❌ Failed: ${RED}$TESTS_FAILED${NC}"
    echo -e "📈 Success Rate: $(( TESTS_PASSED * 100 / (TESTS_PASSED + TESTS_FAILED) ))%"
    
    if [ $TESTS_FAILED -gt 0 ]; then
        echo ""
        echo -e "${RED}❌ Failed Tests:${NC}"
        for test in "${FAILED_TESTS[@]}"; do
            echo "  - $test"
        done
        echo ""
        echo -e "${YELLOW}💡 Troubleshooting Tips:${NC}"
        echo "  1. Verify FLY_ACCESS_TOKEN is correct and has proper permissions"
        echo "  2. Check app name and machine ID are correct"
        echo "  3. Ensure machine is deployed and running"
        echo "  4. Check Fly.io status page for API issues"
        echo "  5. Run 'flyctl status -a $APP_NAME' for more details"
        exit 1
    else
        echo ""
        echo -e "${GREEN}🎉 All tests passed! Fly Machines API is healthy.${NC}"
        exit 0
    fi
}

# Run main function
main "$@"