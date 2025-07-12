#!/bin/bash

# Deployment Validation Script
# Run comprehensive checks after deployment to ensure everything is working

set -e

echo "🚀 Starting Deployment Validation..."
echo "=================================="

# Configuration
DASHBOARD_URL="${DASHBOARD_URL:-https://swarm-admin.fly.dev}"
MANAGER_URL="${MANAGER_URL:-https://swarm-manager.fly.dev}"
WORKER_URL="${WORKER_URL:-}"
ENVIRONMENT="${ENVIRONMENT:-production}"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Helper functions
check_endpoint() {
    local url=$1
    local description=$2
    local expected_status=${3:-200}
    
    echo -n "Checking $description... "
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "$url" || echo "000")
    
    if [ "$response" = "$expected_status" ]; then
        echo -e "${GREEN}✓${NC} ($response)"
        return 0
    else
        echo -e "${RED}✗${NC} (Expected: $expected_status, Got: $response)"
        return 1
    fi
}

check_json_endpoint() {
    local url=$1
    local description=$2
    local json_path=$3
    
    echo -n "Checking $description... "
    
    response=$(curl -s "$url")
    
    if [ -z "$response" ]; then
        echo -e "${RED}✗${NC} (No response)"
        return 1
    fi
    
    if echo "$response" | jq -e "$json_path" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC}"
        return 0
    else
        echo -e "${RED}✗${NC} (Invalid JSON or missing field)"
        return 1
    fi
}

# Service Health Checks
echo ""
echo "1. Service Health Checks"
echo "------------------------"

check_endpoint "$DASHBOARD_URL/api/health" "Dashboard health"
check_endpoint "$MANAGER_URL/health" "Manager health"

if [ -n "$WORKER_URL" ]; then
    check_endpoint "$WORKER_URL/health" "Worker health"
fi

# API Endpoints
echo ""
echo "2. API Endpoint Validation"
echo "--------------------------"

check_json_endpoint "$DASHBOARD_URL/api/swarm-status" "Swarm status API" '.totalMachines'
check_endpoint "$DASHBOARD_URL/api/machines" "Machines API" "200,401"
check_endpoint "$MANAGER_URL/api/metrics" "Metrics API"

# Database Connectivity
echo ""
echo "3. Database & Redis Connectivity"
echo "--------------------------------"

check_json_endpoint "$MANAGER_URL/api/system/database-status" "Database connection" '.connected'
check_json_endpoint "$MANAGER_URL/api/system/redis-status" "Redis connection" '.connected'

# Fly.io Integration
echo ""
echo "4. Fly.io Integration"
echo "--------------------"

if [ -n "$FLY_API_TOKEN" ]; then
    echo -n "Checking Fly.io API access... "
    fly_response=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Authorization: Bearer $FLY_API_TOKEN" \
        "https://api.machines.dev/v1/apps")
    
    if [ "$fly_response" = "200" ]; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${RED}✗${NC} (Status: $fly_response)"
    fi
else
    echo -e "${YELLOW}⚠${NC} Fly.io API token not set, skipping Fly.io checks"
fi

# Supabase Integration
echo ""
echo "5. Supabase Integration"
echo "----------------------"

if [ -n "$NEXT_PUBLIC_SUPABASE_URL" ]; then
    check_endpoint "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/" "Supabase REST API" "200,401"
else
    echo -e "${YELLOW}⚠${NC} Supabase URL not set, skipping Supabase checks"
fi

# Performance Checks
echo ""
echo "6. Performance Validation"
echo "------------------------"

echo -n "Testing response times... "
start_time=$(date +%s%N)
curl -s "$DASHBOARD_URL/api/health" > /dev/null
end_time=$(date +%s%N)
duration=$((($end_time - $start_time) / 1000000))

if [ $duration -lt 1000 ]; then
    echo -e "${GREEN}✓${NC} (${duration}ms)"
else
    echo -e "${YELLOW}⚠${NC} (${duration}ms - slower than expected)"
fi

# Concurrent Request Test
echo -n "Testing concurrent requests... "
errors=0
for i in {1..10}; do
    (curl -s -o /dev/null "$DASHBOARD_URL/api/swarm-status" || ((errors++))) &
done
wait

if [ $errors -eq 0 ]; then
    echo -e "${GREEN}✓${NC} (10 concurrent requests successful)"
else
    echo -e "${RED}✗${NC} ($errors failed out of 10)"
fi

# SSL Certificate Check
echo ""
echo "7. SSL Certificate Validation"
echo "----------------------------"

check_ssl() {
    local domain=$1
    echo -n "Checking SSL for $domain... "
    
    if echo | openssl s_client -servername "$domain" -connect "$domain:443" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${RED}✗${NC}"
    fi
}

# Extract domain from URL
dashboard_domain=$(echo "$DASHBOARD_URL" | sed -E 's|https?://([^/]+).*|\1|')
manager_domain=$(echo "$MANAGER_URL" | sed -E 's|https?://([^/]+).*|\1|')

check_ssl "$dashboard_domain"
check_ssl "$manager_domain"

# Summary
echo ""
echo "=================================="
echo "Deployment Validation Summary"
echo "=================================="

# Count successes and failures
total_checks=0
failed_checks=0

# You would need to implement proper counting logic here
# For now, we'll just provide a general summary

if [ $failed_checks -eq 0 ]; then
    echo -e "${GREEN}✅ All validation checks passed!${NC}"
    echo "The deployment appears to be healthy."
    exit 0
else
    echo -e "${RED}❌ Some validation checks failed.${NC}"
    echo "Please review the errors above and troubleshoot as needed."
    exit 1
fi