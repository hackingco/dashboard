#!/bin/bash

# Continuous Health Monitoring for Fly Swarm Deployment
# Monitors health status until all services are passing
# Usage: ./continuous-health-monitor.sh [interval] [max-duration]

set -euo pipefail

# Configuration
INTERVAL="${1:-30}"          # Check interval in seconds
MAX_DURATION="${2:-1800}"    # Maximum monitoring duration (30 minutes)
FLY_ACCESS_TOKEN="${FLY_ACCESS_TOKEN:-}"

# Service endpoints to monitor
SERVICES=(
    "swarm-admin:https://swarm-admin-dashboard-3vgcyjnzq-hackingco.vercel.app"
    "swarm-manager:https://swarm-mgr-1739853764.fly.dev"
)

# Fly machines to monitor
MACHINES=(
    "swarm-admin:e82992c773ed98"
    "swarm-manager:auto-detect"
)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Status tracking
MONITORING_START=$(date +%s)
HEALTH_CHECKS=0
CONSECUTIVE_PASSES=0
REQUIRED_CONSECUTIVE_PASSES=3

echo "🏥 Continuous Health Monitoring"
echo "==============================="
echo "⏰ Check interval: ${INTERVAL}s"
echo "🕐 Max duration: ${MAX_DURATION}s"
echo "🎯 Required consecutive passes: $REQUIRED_CONSECUTIVE_PASSES"
echo "📊 Services to monitor: ${#SERVICES[@]}"
echo "🤖 Machines to monitor: ${#MACHINES[@]}"
echo ""

# Function to check if monitoring should continue
should_continue() {
    local current_time=$(date +%s)
    local elapsed=$((current_time - MONITORING_START))
    
    if [ $elapsed -ge $MAX_DURATION ]; then
        echo -e "${RED}⏰ Maximum monitoring duration reached (${MAX_DURATION}s)${NC}"
        return 1
    fi
    
    return 0
}

# Function to make authenticated Fly API call
fly_api_call() {
    local url="$1"
    
    if [ -z "$FLY_ACCESS_TOKEN" ]; then
        echo "No token available"
        return 1
    fi
    
    curl -s --max-time 10 \
        -H "Authorization: Bearer $FLY_ACCESS_TOKEN" \
        -H "Content-Type: application/json" \
        "$url" 2>/dev/null || echo '{"error": "api_error"}'
}

# Function to check HTTP service health
check_http_health() {
    local service_name="$1"
    local service_url="$2"
    
    echo -n "  🌐 $service_name: "
    
    # Check basic connectivity
    local status_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$service_url" 2>/dev/null || echo "000")
    local response_time=$(curl -s -o /dev/null -w "%{time_total}" --max-time 10 "$service_url" 2>/dev/null || echo "999")
    
    case "$status_code" in
        200|201|204)
            if (( $(echo "$response_time < 5.0" | bc -l) )); then
                echo -e "${GREEN}✅ HEALTHY${NC} (${status_code}, ${response_time}s)"
                return 0
            else
                echo -e "${YELLOW}⚠️  SLOW${NC} (${status_code}, ${response_time}s)"
                return 1
            fi
            ;;
        404|403)
            echo -e "${YELLOW}⚠️  ACCESSIBLE${NC} (${status_code})"
            return 0  # Service is running, just not found/forbidden
            ;;
        *)
            echo -e "${RED}❌ UNHEALTHY${NC} (${status_code})"
            return 1
            ;;
    esac
}

# Function to check specific health endpoints
check_health_endpoints() {
    local service_name="$1"
    local base_url="$2"
    
    # Common health endpoint patterns
    local health_endpoints=(
        "/health"
        "/api/health"
        "/healthz"
        "/_health"
    )
    
    for endpoint in "${health_endpoints[@]}"; do
        local health_url="${base_url}${endpoint}"
        local response=$(curl -s --max-time 5 "$health_url" 2>/dev/null || echo "")
        
        if echo "$response" | grep -qi "healthy\|ok\|running\|pass"; then
            echo -e "    💚 Health endpoint found: $endpoint"
            return 0
        fi
    done
    
    echo -e "    💛 No health endpoint found"
    return 1
}

# Function to auto-detect machine ID for an app
auto_detect_machine() {
    local app_name="$1"
    
    local response=$(fly_api_call "https://api.machines.dev/v1/apps/$app_name/machines")
    local machine_id=$(echo "$response" | jq -r '.[0].id // empty' 2>/dev/null)
    
    if [ -n "$machine_id" ] && [ "$machine_id" != "null" ]; then
        echo "$machine_id"
        return 0
    else
        return 1
    fi
}

# Function to check Fly machine health
check_machine_health() {
    local app_name="$1"
    local machine_id="$2"
    
    echo -n "  🤖 $app_name machine: "
    
    if [ -z "$FLY_ACCESS_TOKEN" ]; then
        echo -e "${YELLOW}⚠️  NO TOKEN${NC}"
        return 1
    fi
    
    # Auto-detect machine ID if needed
    if [ "$machine_id" = "auto-detect" ]; then
        machine_id=$(auto_detect_machine "$app_name")
        if [ -z "$machine_id" ]; then
            echo -e "${RED}❌ NO MACHINES${NC}"
            return 1
        fi
    fi
    
    # Get machine status
    local response=$(fly_api_call "https://api.machines.dev/v1/apps/$app_name/machines/$machine_id")
    local state=$(echo "$response" | jq -r '.state // "unknown"' 2>/dev/null)
    local region=$(echo "$response" | jq -r '.region // "unknown"' 2>/dev/null)
    
    case "$state" in
        "started")
            echo -e "${GREEN}✅ RUNNING${NC} ($machine_id in $region)"
            
            # Try to get machine stats if available
            local stats_response=$(fly_api_call "https://api.machines.dev/v1/apps/$app_name/machines/$machine_id/stats")
            local cpu=$(echo "$stats_response" | jq -r '.cpu_usage // empty' 2>/dev/null)
            local memory=$(echo "$stats_response" | jq -r '.memory_usage // empty' 2>/dev/null)
            
            if [ -n "$cpu" ] && [ -n "$memory" ] && [ "$cpu" != "null" ] && [ "$memory" != "null" ]; then
                echo -e "    📊 CPU: ${cpu}%, Memory: ${memory}%"
            fi
            
            return 0
            ;;
        "starting")
            echo -e "${YELLOW}⏳ STARTING${NC} ($machine_id)"
            return 1
            ;;
        "stopped")
            echo -e "${RED}❌ STOPPED${NC} ($machine_id)"
            return 1
            ;;
        *)
            echo -e "${RED}❓ UNKNOWN${NC} ($state, $machine_id)"
            return 1
            ;;
    esac
}

# Function to run WebSocket connectivity test
check_websocket_health() {
    echo -n "  🔌 WebSocket connectivity: "
    
    # Check if wscat or node is available for WebSocket testing
    if command -v wscat &> /dev/null; then
        local ws_url="wss://swarm-mgr-1739853764.fly.dev/ws"
        if timeout 5 wscat -c "$ws_url" -x '{"type":"ping"}' &>/dev/null; then
            echo -e "${GREEN}✅ CONNECTED${NC}"
            return 0
        else
            echo -e "${RED}❌ FAILED${NC}"
            return 1
        fi
    elif command -v node &> /dev/null && [ -f "tests/monitoring/websocket-realtime-test.js" ]; then
        if timeout 10 node tests/monitoring/websocket-realtime-test.js current &>/dev/null; then
            echo -e "${GREEN}✅ CONNECTED${NC}"
            return 0
        else
            echo -e "${RED}❌ FAILED${NC}"
            return 1
        fi
    else
        echo -e "${YELLOW}⚠️  SKIPPED${NC} (no test tools)"
        return 0  # Don't fail health check if we can't test WebSocket
    fi
}

# Function to perform comprehensive health check
perform_health_check() {
    local check_time=$(date '+%Y-%m-%d %H:%M:%S')
    local current_time=$(date +%s)
    local elapsed=$((current_time - MONITORING_START))
    
    ((HEALTH_CHECKS++))
    
    echo -e "${BLUE}🔍 Health Check #$HEALTH_CHECKS${NC} at $check_time (${elapsed}s elapsed)"
    echo "=============================================="
    
    local all_healthy=true
    local service_results=()
    local machine_results=()
    
    # Check HTTP services
    echo "📡 HTTP Services:"
    for service in "${SERVICES[@]}"; do
        IFS=':' read -r name url <<< "$service"
        if check_http_health "$name" "$url"; then
            check_health_endpoints "$name" "$url"
            service_results+=("pass")
        else
            service_results+=("fail")
            all_healthy=false
        fi
    done
    
    # Check Fly machines
    echo ""
    echo "🤖 Fly Machines:"
    for machine in "${MACHINES[@]}"; do
        IFS=':' read -r app_name machine_id <<< "$machine"
        if check_machine_health "$app_name" "$machine_id"; then
            machine_results+=("pass")
        else
            machine_results+=("fail")
            all_healthy=false
        fi
    done
    
    # Check WebSocket connectivity
    echo ""
    echo "🔌 Real-time Connectivity:"
    local websocket_healthy=true
    if ! check_websocket_health; then
        websocket_healthy=false
        all_healthy=false
    fi
    
    # Overall health assessment
    echo ""
    if $all_healthy; then
        ((CONSECUTIVE_PASSES++))
        echo -e "🎯 Overall Status: ${GREEN}✅ ALL SYSTEMS HEALTHY${NC}"
        echo -e "🔥 Consecutive passes: ${CONSECUTIVE_PASSES}/${REQUIRED_CONSECUTIVE_PASSES}"
        
        if [ $CONSECUTIVE_PASSES -ge $REQUIRED_CONSECUTIVE_PASSES ]; then
            echo ""
            echo -e "${GREEN}🎉 HEALTH MONITORING COMPLETE!${NC}"
            echo -e "${GREEN}All systems have been healthy for $REQUIRED_CONSECUTIVE_PASSES consecutive checks.${NC}"
            return 2  # Special return code for completion
        fi
    else
        CONSECUTIVE_PASSES=0
        echo -e "🚨 Overall Status: ${RED}❌ SOME SYSTEMS UNHEALTHY${NC}"
        echo -e "📊 Service health: $(IFS=,; echo "${service_results[*]}")"
        echo -e "🤖 Machine health: $(IFS=,; echo "${machine_results[*]}")"
        echo -e "🔌 WebSocket health: $([ "$websocket_healthy" = true ] && echo "pass" || echo "fail")"
    fi
    
    echo ""
    return $($all_healthy && echo 0 || echo 1)
}

# Function to generate monitoring summary
generate_summary() {
    local end_time=$(date +%s)
    local total_duration=$((end_time - MONITORING_START))
    local avg_interval=$((total_duration / HEALTH_CHECKS))
    
    echo ""
    echo "📊 Monitoring Summary"
    echo "===================="
    echo "⏱️  Total duration: ${total_duration}s"
    echo "🔄 Health checks performed: $HEALTH_CHECKS"
    echo "📏 Average check interval: ${avg_interval}s"
    echo "✅ Consecutive passes achieved: $CONSECUTIVE_PASSES"
    echo "🎯 Required for completion: $REQUIRED_CONSECUTIVE_PASSES"
}

# Function to save monitoring results
save_results() {
    local results_file="monitoring-results-$(date +%Y%m%d-%H%M%S).json"
    local end_time=$(date +%s)
    
    cat > "$results_file" << EOF
{
  "monitoring": {
    "start_time": "$MONITORING_START",
    "end_time": "$end_time",
    "duration": $((end_time - MONITORING_START)),
    "health_checks": $HEALTH_CHECKS,
    "consecutive_passes": $CONSECUTIVE_PASSES,
    "required_passes": $REQUIRED_CONSECUTIVE_PASSES,
    "completed": $([ $CONSECUTIVE_PASSES -ge $REQUIRED_CONSECUTIVE_PASSES ] && echo "true" || echo "false")
  },
  "services": $(printf '%s\n' "${SERVICES[@]}" | jq -R 'split(":") | {name: .[0], url: .[1]}' | jq -s),
  "machines": $(printf '%s\n' "${MACHINES[@]}" | jq -R 'split(":") | {app: .[0], machine_id: .[1]}' | jq -s)
}
EOF
    
    echo "💾 Results saved to: $results_file"
}

# Main monitoring loop
main() {
    echo "🚀 Starting continuous health monitoring..."
    echo ""
    
    # Check dependencies
    if ! command -v curl &> /dev/null; then
        echo -e "${RED}❌ curl is required but not installed${NC}"
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        echo -e "${YELLOW}⚠️  jq not found - some features may be limited${NC}"
    fi
    
    if ! command -v bc &> /dev/null; then
        echo -e "${YELLOW}⚠️  bc not found - response time comparisons may be limited${NC}"
    fi
    
    # Main monitoring loop
    while should_continue; do
        local health_result
        perform_health_check
        health_result=$?
        
        # Check if monitoring is complete
        if [ $health_result -eq 2 ]; then
            generate_summary
            save_results
            echo -e "${GREEN}🎉 Monitoring completed successfully!${NC}"
            exit 0
        fi
        
        # Wait for next check
        if should_continue; then
            echo -e "${BLUE}⏳ Waiting ${INTERVAL}s until next check...${NC}"
            echo ""
            sleep "$INTERVAL"
        fi
    done
    
    # Monitoring ended due to timeout
    generate_summary
    save_results
    echo -e "${YELLOW}⚠️  Monitoring ended due to timeout${NC}"
    
    if [ $CONSECUTIVE_PASSES -ge $REQUIRED_CONSECUTIVE_PASSES ]; then
        exit 0
    else
        exit 1
    fi
}

# Signal handlers for graceful shutdown
trap 'echo ""; echo "🛑 Monitoring interrupted"; generate_summary; save_results; exit 130' INT
trap 'echo ""; echo "🛑 Monitoring terminated"; generate_summary; save_results; exit 143' TERM

# Run main function
main "$@"