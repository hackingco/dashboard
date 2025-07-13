#!/bin/bash
# Health Check and Validation Script
# Consolidated health checking for all system components

set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
TIMEOUT=${TIMEOUT:-30}
RETRY_COUNT=${RETRY_COUNT:-3}
RETRY_DELAY=${RETRY_DELAY:-5}
OUTPUT_DIR=${OUTPUT_DIR:-"validation-results"}
ENVIRONMENT=${ENVIRONMENT:-"local"}

# Service endpoints
declare -A SERVICES=(
    ["manager"]="http://localhost:3001"
    ["dashboard"]="http://localhost:3000"
)

# Health check results
declare -A HEALTH_RESULTS
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0

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

Health check and validation script for swarm services.

OPTIONS:
    -e, --environment ENV    Environment (local|staging|production) [default: local]
    -t, --timeout SECONDS    Request timeout [default: 30]
    -r, --retry COUNT        Retry attempts [default: 3]
    -d, --delay SECONDS      Retry delay [default: 5]
    -o, --output DIR         Output directory [default: validation-results]
    -h, --help               Show this help message

EXAMPLES:
    $0                       # Check local services
    $0 -e staging            # Check staging environment
    $0 -t 60 -r 5            # Custom timeout and retries

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
            -r|--retry)
                RETRY_COUNT="$2"
                shift 2
                ;;
            -d|--delay)
                RETRY_DELAY="$2"
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

# Setup environment-specific URLs
setup_environment() {
    case $ENVIRONMENT in
        staging)
            SERVICES["manager"]="https://swarm-manager-staging.fly.dev"
            SERVICES["dashboard"]="https://staging-dashboard.vercel.app"
            ;;
        production)
            SERVICES["manager"]="https://swarm-manager-live.fly.dev"
            SERVICES["dashboard"]="https://admin-dashboard-l0e1w6ivz-hackingco.vercel.app"
            ;;
        *)
            # Keep local defaults
            ;;
    esac
    
    mkdir -p "$OUTPUT_DIR"
    info "Health checking $ENVIRONMENT environment"
}

# Perform health check with retries
check_endpoint() {
    local name="$1"
    local url="$2"
    local endpoint="$3"
    local expected_status="${4:-200}"
    
    local full_url="${url}${endpoint}"
    local attempt=1
    
    progress "Checking $name at $full_url..."
    
    while [ $attempt -le $RETRY_COUNT ]; do
        local start_time=$(date +%s%3N)
        
        if response=$(curl -s -w "HTTPSTATUS:%{http_code};TIME:%{time_total}" \
                          --max-time "$TIMEOUT" \
                          --connect-timeout 10 \
                          "$full_url" 2>/dev/null); then
            
            local end_time=$(date +%s%3N)
            local duration=$((end_time - start_time))
            
            # Extract HTTP status and response time
            local http_status=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
            local response_time=$(echo "$response" | grep -o "TIME:[0-9.]*" | cut -d: -f2)
            local body=$(echo "$response" | sed -E 's/HTTPSTATUS:[0-9]*;TIME:[0-9.]*$//')
            
            if [ "$http_status" = "$expected_status" ]; then
                success "$name is healthy (${response_time}s, attempt $attempt)"
                HEALTH_RESULTS["$name"]="PASS:$http_status:$response_time:$attempt"
                ((PASSED_CHECKS++))
                return 0
            else
                warning "$name returned status $http_status (expected $expected_status)"
            fi
        else
            warning "$name connection failed (attempt $attempt)"
        fi
        
        if [ $attempt -lt $RETRY_COUNT ]; then
            echo "  Retrying in ${RETRY_DELAY}s..."
            sleep $RETRY_DELAY
        fi
        
        ((attempt++))
    done
    
    error "$name health check failed after $RETRY_COUNT attempts"
    HEALTH_RESULTS["$name"]="FAIL:0:0:$RETRY_COUNT"
    ((FAILED_CHECKS++))
    return 1
}

# Check service health endpoints
check_service_health() {
    info "Checking service health endpoints..."
    
    # Manager API health
    check_endpoint "Manager Health" "${SERVICES[manager]}" "/health" "200"
    ((TOTAL_CHECKS++))
    
    # Manager API status
    check_endpoint "Manager Status" "${SERVICES[manager]}" "/api/system/status" "200"
    ((TOTAL_CHECKS++))
    
    # Dashboard health (if available)
    if [[ "${SERVICES[dashboard]}" == *"localhost"* ]]; then
        check_endpoint "Dashboard Health" "${SERVICES[dashboard]}" "/api/health" "200"
        ((TOTAL_CHECKS++))
    else
        check_endpoint "Dashboard" "${SERVICES[dashboard]}" "/" "200"
        ((TOTAL_CHECKS++))
    fi
}

# Check database connectivity
check_database() {
    info "Checking database connectivity..."
    
    check_endpoint "Database Status" "${SERVICES[manager]}" "/api/system/database-status" "200"
    ((TOTAL_CHECKS++))
    
    # Additional database checks
    if response=$(curl -s --max-time "$TIMEOUT" "${SERVICES[manager]}/api/system/database-status" 2>/dev/null); then
        if echo "$response" | grep -q '"connected":true'; then
            success "Database is connected"
        else
            warning "Database connection status unclear"
        fi
        
        # Check for high latency
        if latency=$(echo "$response" | grep -o '"latency":[0-9]*' | cut -d: -f2); then
            if [ "$latency" -gt 1000 ]; then
                warning "High database latency: ${latency}ms"
            else
                info "Database latency: ${latency}ms"
            fi
        fi
    fi
}

# Check WebSocket connectivity
check_websocket() {
    info "Checking WebSocket connectivity..."
    
    local ws_url="${SERVICES[manager]}"
    ws_url="${ws_url/http:/ws:}"
    ws_url="${ws_url/https:/wss:}"
    ws_url="${ws_url}/ws"
    
    # Create WebSocket test script
    local ws_test_script="$OUTPUT_DIR/ws-health-test.js"
    cat > "$ws_test_script" << EOF
const WebSocket = require('ws');

const ws = new WebSocket('$ws_url');
let success = false;

const timeout = setTimeout(() => {
    if (!success) {
        console.log('WebSocket timeout');
        process.exit(1);
    }
}, ${TIMEOUT}000);

ws.on('open', () => {
    console.log('WebSocket connected');
    success = true;
    clearTimeout(timeout);
    ws.close();
    process.exit(0);
});

ws.on('error', (error) => {
    console.log('WebSocket error:', error.message);
    clearTimeout(timeout);
    process.exit(1);
});
EOF
    
    if node "$ws_test_script" 2>/dev/null; then
        success "WebSocket is accessible"
        HEALTH_RESULTS["WebSocket"]="PASS:200:0:1"
        ((PASSED_CHECKS++))
    else
        error "WebSocket connection failed"
        HEALTH_RESULTS["WebSocket"]="FAIL:0:0:1"
        ((FAILED_CHECKS++))
    fi
    
    ((TOTAL_CHECKS++))
    rm -f "$ws_test_script"
}

# Check system resources
check_system_resources() {
    info "Checking system resources..."
    
    if response=$(curl -s --max-time "$TIMEOUT" "${SERVICES[manager]}/api/metrics" 2>/dev/null); then
        if echo "$response" | grep -q '"system"'; then
            # Parse CPU and memory if available
            if cpu=$(echo "$response" | grep -o '"cpu":[0-9.]*' | cut -d: -f2); then
                cpu_percent=$(echo "$cpu * 100" | bc -l 2>/dev/null || echo "N/A")
                if [[ "$cpu_percent" != "N/A" ]] && (( $(echo "$cpu > 0.8" | bc -l 2>/dev/null || echo 0) )); then
                    warning "High CPU usage: ${cpu_percent%.*}%"
                else
                    info "CPU usage: ${cpu_percent%.*}%"
                fi
            fi
            
            if memory=$(echo "$response" | grep -o '"memory":[0-9.]*' | cut -d: -f2); then
                memory_percent=$(echo "$memory * 100" | bc -l 2>/dev/null || echo "N/A")
                if [[ "$memory_percent" != "N/A" ]] && (( $(echo "$memory > 0.85" | bc -l 2>/dev/null || echo 0) )); then
                    warning "High memory usage: ${memory_percent%.*}%"
                else
                    info "Memory usage: ${memory_percent%.*}%"
                fi
            fi
            
            success "System metrics accessible"
            HEALTH_RESULTS["System Metrics"]="PASS:200:0:1"
            ((PASSED_CHECKS++))
        else
            warning "System metrics format unexpected"
            HEALTH_RESULTS["System Metrics"]="WARN:200:0:1"
            ((FAILED_CHECKS++))
        fi
    else
        error "System metrics not accessible"
        HEALTH_RESULTS["System Metrics"]="FAIL:0:0:1"
        ((FAILED_CHECKS++))
    fi
    
    ((TOTAL_CHECKS++))
}

# Check external dependencies
check_external_dependencies() {
    info "Checking external dependencies..."
    
    # Check Supabase connection (if configured)
    if supabase_status=$(curl -s --max-time "$TIMEOUT" "${SERVICES[manager]}/api/system/database-status" 2>/dev/null); then
        if echo "$supabase_status" | grep -q '"connected":true'; then
            success "External database is connected"
        else
            warning "External database connection issue"
        fi
    fi
    
    # Check Langfuse connection (if configured)
    if curl -s --max-time 10 "https://cloud.langfuse.com" > /dev/null 2>&1; then
        success "Langfuse service is accessible"
    else
        warning "Langfuse service may be unreachable"
    fi
    
    # Check Fly.io API (if in production)
    if [ "$ENVIRONMENT" != "local" ]; then
        if curl -s --max-time 10 "https://api.fly.io/graphql" > /dev/null 2>&1; then
            success "Fly.io API is accessible"
        else
            warning "Fly.io API may be unreachable"
        fi
    fi
}

# Generate health report
generate_health_report() {
    local timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    local report_file="$OUTPUT_DIR/health-check-report.json"
    
    # Calculate success rate
    local success_rate=0
    if [ $TOTAL_CHECKS -gt 0 ]; then
        success_rate=$(( (PASSED_CHECKS * 100) / TOTAL_CHECKS ))
    fi
    
    # Generate JSON report
    cat > "$report_file" << EOF
{
  "timestamp": "$timestamp",
  "environment": "$ENVIRONMENT",
  "configuration": {
    "timeout": $TIMEOUT,
    "retry_count": $RETRY_COUNT,
    "retry_delay": $RETRY_DELAY
  },
  "summary": {
    "total_checks": $TOTAL_CHECKS,
    "passed_checks": $PASSED_CHECKS,
    "failed_checks": $FAILED_CHECKS,
    "success_rate": $success_rate,
    "overall_health": "$([ $FAILED_CHECKS -eq 0 ] && echo "HEALTHY" || echo "DEGRADED")"
  },
  "services": {
EOF
    
    # Add service results
    local first=true
    for service in "${!HEALTH_RESULTS[@]}"; do
        IFS=':' read -r status http_code response_time attempts <<< "${HEALTH_RESULTS[$service]}"
        if [ "$first" = true ]; then
            first=false
        else
            echo "," >> "$report_file"
        fi
        cat >> "$report_file" << EOF
    "$service": {
      "status": "$status",
      "http_code": $http_code,
      "response_time": "$response_time",
      "attempts": $attempts
    }
EOF
    done
    
    cat >> "$report_file" << EOF
  }
}
EOF
    
    info "Health report saved to: $report_file"
}

# Display results summary
display_summary() {
    echo ""
    echo -e "${BLUE}🏥 Health Check Summary${NC}"
    echo "======================="
    echo "Environment: $ENVIRONMENT"
    echo "Total Checks: $TOTAL_CHECKS"
    echo -e "${GREEN}✅ Passed: $PASSED_CHECKS${NC}"
    echo -e "${RED}❌ Failed: $FAILED_CHECKS${NC}"
    
    if [ $TOTAL_CHECKS -gt 0 ]; then
        local success_rate=$(( (PASSED_CHECKS * 100) / TOTAL_CHECKS ))
        echo "Success Rate: $success_rate%"
    fi
    
    echo ""
    echo -e "${BLUE}📋 Service Details:${NC}"
    for service in "${!HEALTH_RESULTS[@]}"; do
        IFS=':' read -r status http_code response_time attempts <<< "${HEALTH_RESULTS[$service]}"
        case $status in
            PASS)
                echo -e "  ${GREEN}✅ $service${NC} - ${response_time}s (HTTP $http_code)"
                ;;
            FAIL)
                echo -e "  ${RED}❌ $service${NC} - Failed after $attempts attempts"
                ;;
            WARN)
                echo -e "  ${YELLOW}⚠️  $service${NC} - Warning (HTTP $http_code)"
                ;;
        esac
    done
    echo ""
}

# Main execution
main() {
    parse_args "$@"
    
    echo ""
    echo -e "${BLUE}🏥 Health Check & Validation${NC}"
    echo -e "${BLUE}============================${NC}\n"
    
    setup_environment
    
    # Run health checks
    check_service_health
    check_database
    check_websocket
    check_system_resources
    check_external_dependencies
    
    # Generate reports
    generate_health_report
    
    # Display summary
    display_summary
    
    # Exit with appropriate code
    if [ $FAILED_CHECKS -eq 0 ]; then
        success "All health checks passed! 🎉"
        exit 0
    else
        error "$FAILED_CHECKS health check(s) failed"
        warning "System may be degraded"
        exit 1
    fi
}

# Execute main function
main "$@"