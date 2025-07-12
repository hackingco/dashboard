#!/bin/bash

# Smoke Tests for Swarm Management System
# Quick validation tests to run after deployment

set -e

# Configuration
API_URL="${API_URL:-https://swarm-admin.fly.dev/api}"
TIMEOUT="${TIMEOUT:-5}"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m'

echo "🔥 Running Smoke Tests..."
echo "========================"
echo "Target: $API_URL"
echo ""

# Test counter
TESTS_RUN=0
TESTS_PASSED=0

# Test function
run_test() {
    local test_name=$1
    local command=$2
    local expected=$3
    
    TESTS_RUN=$((TESTS_RUN + 1))
    echo -n "Testing $test_name... "
    
    if eval "$command"; then
        echo -e "${GREEN}✓${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗${NC}"
        return 1
    fi
}

# Critical Path Tests

# 1. Health Check
run_test "Service Health" \
    "curl -sf --max-time $TIMEOUT $API_URL/health > /dev/null" \
    "200"

# 2. Swarm Status
run_test "Swarm Status API" \
    "curl -sf --max-time $TIMEOUT $API_URL/swarm-status | jq -e '.totalMachines' > /dev/null" \
    "valid"

# 3. Machine List
run_test "Machine List API" \
    "curl -sf --max-time $TIMEOUT $API_URL/machines > /dev/null" \
    "200"

# 4. Metrics Endpoint
run_test "Metrics API" \
    "curl -sf --max-time $TIMEOUT ${API_URL/\/api/}/api/metrics > /dev/null" \
    "200"

# 5. Database Connectivity (through API)
run_test "Database Status" \
    "curl -sf --max-time $TIMEOUT ${API_URL/admin/manager}/system/database-status | jq -e '.connected' | grep -q true" \
    "true"

# 6. Redis Connectivity (through API)
run_test "Redis Status" \
    "curl -sf --max-time $TIMEOUT ${API_URL/admin/manager}/system/redis-status | jq -e '.connected' | grep -q true" \
    "true"

# 7. Response Time Check
run_test "Response Time < 1s" \
    "[ $(curl -o /dev/null -s -w '%{time_total}' $API_URL/health | cut -d. -f1) -lt 1 ]" \
    "fast"

# 8. Concurrent Request Handling
run_test "Concurrent Requests" \
    "(for i in {1..5}; do curl -sf --max-time $TIMEOUT $API_URL/health & done; wait)" \
    "success"

# Summary
echo ""
echo "========================"
echo "Smoke Test Summary"
echo "========================"
echo "Tests Run: $TESTS_RUN"
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$((TESTS_RUN - TESTS_PASSED))${NC}"
echo ""

if [ $TESTS_PASSED -eq $TESTS_RUN ]; then
    echo -e "${GREEN}✅ All smoke tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some smoke tests failed.${NC}"
    exit 1
fi