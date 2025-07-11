#!/bin/bash

# Smoke test script for Hive Mind deployment
# Usage: ./smoke-test.sh [staging|production]

set -euo pipefail

ENVIRONMENT=${1:-staging}
RETRY_COUNT=3
TIMEOUT=30

# Set URLs based on environment
if [ "$ENVIRONMENT" = "staging" ]; then
    DASHBOARD_URL="https://staging.hive-mind.fly.dev"
    MANAGER_URL="https://staging-manager.hive-mind.fly.dev"
elif [ "$ENVIRONMENT" = "production" ]; then
    DASHBOARD_URL="https://hive-mind.fly.dev"
    MANAGER_URL="https://manager.hive-mind.fly.dev"
else
    echo "❌ Invalid environment: $ENVIRONMENT. Use 'staging' or 'production'"
    exit 1
fi

echo "🧪 Running smoke tests for $ENVIRONMENT environment..."
echo "📊 Dashboard URL: $DASHBOARD_URL"
echo "⚙️  Manager URL: $MANAGER_URL"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Test results
TESTS_PASSED=0
TESTS_FAILED=0
FAILED_TESTS=()

# Function to run a test with retries
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_status="${3:-200}"
    
    echo -n "🔍 Testing: $test_name... "
    
    for i in $(seq 1 $RETRY_COUNT); do
        if eval "$test_command"; then
            echo -e "${GREEN}✅ PASS${NC}"
            ((TESTS_PASSED++))
            return 0
        else
            if [ $i -eq $RETRY_COUNT ]; then
                echo -e "${RED}❌ FAIL${NC}"
                ((TESTS_FAILED++))
                FAILED_TESTS+=("$test_name")
                return 1
            else
                echo -n "🔄 Retry $i/$RETRY_COUNT... "
                sleep 2
            fi
        fi
    done
}

# Function to check HTTP status
check_http_status() {
    local url="$1"
    local expected_status="${2:-200}"
    
    local status_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$url" || echo "000")
    [ "$status_code" = "$expected_status" ]
}

# Function to check API response
check_api_response() {
    local url="$1"
    local expected_field="$2"
    
    local response=$(curl -s --max-time $TIMEOUT "$url" || echo "{}")
    echo "$response" | grep -q "$expected_field"
}

# Function to check content
check_content() {
    local url="$1"
    local expected_content="$2"
    
    local response=$(curl -s --max-time $TIMEOUT "$url" || echo "")
    echo "$response" | grep -q "$expected_content"
}

echo "🚀 Starting smoke tests..."
echo ""

# Test 1: Dashboard accessibility
run_test "Dashboard home page" "check_http_status '$DASHBOARD_URL'"

# Test 2: Dashboard API health
run_test "Dashboard API health" "check_api_response '$DASHBOARD_URL/api/health' 'healthy'"

# Test 3: Manager API health
run_test "Manager API health" "check_api_response '$MANAGER_URL/health' 'healthy'"

# Test 4: Dashboard machines API
run_test "Dashboard machines API" "check_http_status '$DASHBOARD_URL/api/machines'"

# Test 5: Dashboard swarm status API
run_test "Dashboard swarm status API" "check_api_response '$DASHBOARD_URL/api/swarm-status' 'totalMachines'"

# Test 6: Manager swarms API
run_test "Manager swarms API" "check_http_status '$MANAGER_URL/api/swarms'"

# Test 7: Manager tasks API
run_test "Manager tasks API" "check_http_status '$MANAGER_URL/api/tasks'"

# Test 8: Dashboard assets loading
run_test "Dashboard CSS assets" "check_http_status '$DASHBOARD_URL/_next/static/css' '200'"

# Test 9: Dashboard JavaScript loading
run_test "Dashboard JS bundle" "check_content '$DASHBOARD_URL' '_next/static'"

# Test 10: Manager metrics endpoint
run_test "Manager metrics" "check_http_status '$MANAGER_URL/metrics'"

# Test 11: Dashboard error handling
run_test "Dashboard 404 handling" "check_http_status '$DASHBOARD_URL/nonexistent' '404'"

# Test 12: API rate limiting (should not be rate limited in normal use)
run_test "API rate limiting check" "check_http_status '$DASHBOARD_URL/api/swarm-status'"

echo ""
echo "📊 Test Summary:"
echo "=================="
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
    echo "  1. Check application logs: flyctl logs -a <app-name>"
    echo "  2. Verify Fly.io machine status: flyctl status -a <app-name>"
    echo "  3. Check environment variables and secrets"
    echo "  4. Verify database connectivity"
    echo "  5. Check for recent deployments or maintenance"
    echo ""
    exit 1
else
    echo ""
    echo -e "${GREEN}🎉 All smoke tests passed! Environment is healthy.${NC}"
    
    # Additional health metrics
    echo ""
    echo "📈 Performance Metrics:"
    echo "======================="
    
    # Measure response times
    dashboard_time=$(curl -s -w "%{time_total}" -o /dev/null "$DASHBOARD_URL" || echo "0")
    manager_time=$(curl -s -w "%{time_total}" -o /dev/null "$MANAGER_URL/health" || echo "0")
    
    echo "Dashboard response time: ${dashboard_time}s"
    echo "Manager response time: ${manager_time}s"
    
    # Check if response times are reasonable
    if (( $(echo "$dashboard_time > 5.0" | bc -l) )); then
        echo -e "${YELLOW}⚠️  Dashboard response time is high (>${dashboard_time}s)${NC}"
    fi
    
    if (( $(echo "$manager_time > 3.0" | bc -l) )); then
        echo -e "${YELLOW}⚠️  Manager response time is high (>${manager_time}s)${NC}"
    fi
    
    echo ""
    echo -e "${GREEN}✅ Smoke tests completed successfully!${NC}"
    exit 0
fi