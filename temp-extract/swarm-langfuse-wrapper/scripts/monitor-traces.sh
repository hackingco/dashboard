#!/bin/bash

# Real-time Trace Monitoring Script
# Monitors Langfuse traces and system health in real-time

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
MONITOR_INTERVAL="${MONITOR_INTERVAL:-10}"  # seconds
MAX_TRACES_DISPLAY="${MAX_TRACES_DISPLAY:-10}"
LOG_FILE="${LOG_FILE:-trace-monitor.log}"

# Default values
LANGFUSE_URL="${LANGFUSE_BASE_URL:-http://localhost:3000}"
ALERT_THRESHOLD_CPU="${ALERT_THRESHOLD_CPU:-80}"
ALERT_THRESHOLD_MEMORY="${ALERT_THRESHOLD_MEMORY:-85}"
ALERT_THRESHOLD_ERROR_RATE="${ALERT_THRESHOLD_ERROR_RATE:-5}"

# State tracking
LAST_TRACE_COUNT=0
LAST_CHECK_TIME=$(date +%s)
CONSECUTIVE_ERRORS=0
MAX_CONSECUTIVE_ERRORS=3

# Log functions
log_info() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[$(date +'%H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

log_alert() {
    echo -e "${RED}${BOLD}[$(date +'%H:%M:%S')] 🚨 ALERT:${NC} $1" | tee -a "$LOG_FILE"
}

# Clear screen and show header
show_header() {
    clear
    echo -e "${CYAN}${BOLD}================================${NC}"
    echo -e "${CYAN}${BOLD}    Real-time Trace Monitor${NC}"
    echo -e "${CYAN}${BOLD}================================${NC}"
    echo -e "Langfuse URL: ${LANGFUSE_URL}"
    echo -e "Monitor Interval: ${MONITOR_INTERVAL}s"
    echo -e "Started: $(date)"
    echo -e "Log File: ${LOG_FILE}"
    echo ""
}

# Check if required tools are available
check_dependencies() {
    local missing_deps=()
    
    if ! command -v curl &> /dev/null; then
        missing_deps+=("curl")
    fi
    
    if ! command -v docker &> /dev/null; then
        missing_deps+=("docker")
    fi
    
    if ! command -v jq &> /dev/null; then
        log_warning "jq not found - JSON parsing will be limited"
    fi
    
    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        log_error "Missing required dependencies: ${missing_deps[*]}"
        exit 1
    fi
}

# Get basic auth header
get_auth_header() {
    if [[ -z "$LANGFUSE_PUBLIC_KEY" || -z "$LANGFUSE_SECRET_KEY" ]]; then
        log_error "LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY must be set"
        exit 1
    fi
    
    echo -n "$LANGFUSE_PUBLIC_KEY:$LANGFUSE_SECRET_KEY" | base64
}

# Check Langfuse API health
check_api_health() {
    local health_url="$LANGFUSE_URL/api/public/health"
    local response=$(curl -s -w "%{http_code}" -o /dev/null --max-time 10 "$health_url" 2>/dev/null)
    
    if [[ "$response" == "200" ]]; then
        echo "healthy"
    else
        echo "unhealthy"
    fi
}

# Get trace count
get_trace_count() {
    local auth_header=$(get_auth_header)
    local traces_url="$LANGFUSE_URL/api/public/traces?limit=1"
    
    local response=$(curl -s --max-time 10 \
        -H "Authorization: Basic $auth_header" \
        "$traces_url" 2>/dev/null)
    
    if command -v jq &> /dev/null && echo "$response" | jq -e . &>/dev/null; then
        echo "$response" | jq -r '.meta.totalCount // 0'
    else
        # Fallback parsing without jq
        echo "$response" | grep -o '"totalCount":[0-9]*' | cut -d: -f2 | head -1 || echo "0"
    fi
}

# Get recent traces
get_recent_traces() {
    local auth_header=$(get_auth_header)
    local limit=${1:-$MAX_TRACES_DISPLAY}
    local traces_url="$LANGFUSE_URL/api/public/traces?limit=$limit&orderBy=timestamp&orderDirection=desc"
    
    local response=$(curl -s --max-time 10 \
        -H "Authorization: Basic $auth_header" \
        "$traces_url" 2>/dev/null)
    
    if command -v jq &> /dev/null && echo "$response" | jq -e . &>/dev/null; then
        echo "$response" | jq -r '.data[]? | "\(.timestamp // "unknown") | \(.id // "no-id") | \(.name // "unnamed") | \(.userId // "no-user")"'
    else
        # Fallback - just show that we got a response
        if [[ -n "$response" && "$response" != "null" ]]; then
            echo "Recent traces available (install jq for detailed view)"
        fi
    fi
}

# Get Docker container stats
get_container_stats() {
    local container_name=${1:-"langfuse"}
    
    if docker ps --filter "name=$container_name" --format "{{.Names}}" | grep -q "$container_name"; then
        local stats=$(docker stats "$container_name" --no-stream --format "{{.CPUPerc}}\t{{.MemPerc}}" 2>/dev/null || echo "0%\t0%")
        echo "$stats"
    else
        echo "N/A\tN/A"
    fi
}

# Monitor system metrics
monitor_system_metrics() {
    local langfuse_stats=$(get_container_stats "langfuse")
    local postgres_stats=$(get_container_stats "postgres")
    
    local langfuse_cpu=$(echo "$langfuse_stats" | cut -f1 | sed 's/%//')
    local langfuse_mem=$(echo "$langfuse_stats" | cut -f2 | sed 's/%//')
    local postgres_cpu=$(echo "$postgres_stats" | cut -f1 | sed 's/%//')
    local postgres_mem=$(echo "$postgres_stats" | cut -f2 | sed 's/%//')
    
    echo -e "${BOLD}Container Metrics:${NC}"
    echo -e "  Langfuse: CPU ${langfuse_cpu}%, Memory ${langfuse_mem}%"
    echo -e "  Postgres: CPU ${postgres_cpu}%, Memory ${postgres_mem}%"
    
    # Check for alerts
    if [[ "$langfuse_cpu" != "N/A" ]] && (( $(echo "$langfuse_cpu > $ALERT_THRESHOLD_CPU" | bc -l 2>/dev/null || echo 0) )); then
        log_alert "Langfuse CPU usage high: ${langfuse_cpu}%"
    fi
    
    if [[ "$langfuse_mem" != "N/A" ]] && (( $(echo "$langfuse_mem > $ALERT_THRESHOLD_MEMORY" | bc -l 2>/dev/null || echo 0) )); then
        log_alert "Langfuse memory usage high: ${langfuse_mem}%"
    fi
}

# Monitor trace activity
monitor_trace_activity() {
    local current_count=$(get_trace_count)
    local current_time=$(date +%s)
    local time_diff=$((current_time - LAST_CHECK_TIME))
    
    if [[ "$current_count" =~ ^[0-9]+$ ]]; then
        local new_traces=$((current_count - LAST_TRACE_COUNT))
        
        echo -e "${BOLD}Trace Activity:${NC}"
        echo -e "  Total Traces: $current_count"
        
        if [[ $time_diff -gt 0 && $new_traces -gt 0 ]]; then
            local rate=$(echo "scale=2; $new_traces / $time_diff" | bc -l 2>/dev/null || echo "0")
            echo -e "  New Traces: $new_traces (${rate} traces/sec)"
            log_success "New traces detected: $new_traces"
            CONSECUTIVE_ERRORS=0
        elif [[ $time_diff -gt 60 && $new_traces -eq 0 ]]; then
            log_warning "No new traces in the last $time_diff seconds"
        fi
        
        LAST_TRACE_COUNT=$current_count
    else
        log_error "Failed to get trace count"
        CONSECUTIVE_ERRORS=$((CONSECUTIVE_ERRORS + 1))
        
        if [[ $CONSECUTIVE_ERRORS -ge $MAX_CONSECUTIVE_ERRORS ]]; then
            log_alert "Failed to get trace data $CONSECUTIVE_ERRORS consecutive times"
        fi
    fi
    
    LAST_CHECK_TIME=$current_time
}

# Display recent traces
display_recent_traces() {
    echo -e "\n${BOLD}Recent Traces:${NC}"
    echo -e "${CYAN}Timestamp                | ID       | Name                     | User${NC}"
    echo -e "${CYAN}-------------------------|----------|--------------------------|----------${NC}"
    
    local traces=$(get_recent_traces 5)
    if [[ -n "$traces" ]]; then
        echo "$traces" | while IFS='|' read -r timestamp id name user; do
            # Truncate long values for display
            timestamp=$(echo "$timestamp" | cut -c1-24)
            id=$(echo "$id" | cut -c1-8)
            name=$(echo "$name" | cut -c1-24)
            user=$(echo "$user" | cut -c1-10)
            
            printf "%-24s | %-8s | %-24s | %-10s\n" "$timestamp" "$id" "$name" "$user"
        done
    else
        echo "No recent traces found"
    fi
}

# Check for specific trace patterns
check_trace_patterns() {
    local auth_header=$(get_auth_header)
    local recent_url="$LANGFUSE_URL/api/public/traces?limit=50&fromTimestamp=$(($(date +%s) - 300))000"  # Last 5 minutes
    
    local response=$(curl -s --max-time 10 \
        -H "Authorization: Basic $auth_header" \
        "$recent_url" 2>/dev/null)
    
    if command -v jq &> /dev/null && echo "$response" | jq -e . &>/dev/null; then
        local error_count=$(echo "$response" | jq '[.data[]? | select(.metadata.error or .status == "error")] | length')
        local total_count=$(echo "$response" | jq '.data | length')
        
        if [[ "$total_count" -gt 0 && "$error_count" -gt 0 ]]; then
            local error_rate=$(echo "scale=2; $error_count * 100 / $total_count" | bc -l 2>/dev/null || echo "0")
            
            echo -e "\n${BOLD}Error Analysis:${NC}"
            echo -e "  Errors in last 5min: $error_count/$total_count (${error_rate}%)"
            
            if (( $(echo "$error_rate > $ALERT_THRESHOLD_ERROR_RATE" | bc -l 2>/dev/null || echo 0) )); then
                log_alert "High error rate detected: ${error_rate}%"
            fi
        fi
    fi
}

# Run health checks using monitoring tools
run_health_checks() {
    if [[ -f "$PROJECT_ROOT/monitoring/swarm-health.ts" ]] && command -v npx &> /dev/null; then
        local health_output=$(npx ts-node "$PROJECT_ROOT/monitoring/swarm-health.ts" 2>/dev/null | tail -5)
        if [[ -n "$health_output" ]]; then
            echo -e "\n${BOLD}System Health:${NC}"
            echo "$health_output"
        fi
    fi
}

# Main monitoring loop
start_monitoring() {
    log_info "Starting real-time trace monitoring..."
    log_info "Press Ctrl+C to stop"
    
    # Initial trace count
    LAST_TRACE_COUNT=$(get_trace_count)
    
    while true; do
        show_header
        
        # Check API health
        local api_health=$(check_api_health)
        if [[ "$api_health" == "healthy" ]]; then
            echo -e "${GREEN}✅ API Status: Healthy${NC}"
        else
            echo -e "${RED}❌ API Status: Unhealthy${NC}"
            log_error "Langfuse API is not responding"
        fi
        
        echo ""
        
        # Monitor different aspects
        monitor_system_metrics
        echo ""
        monitor_trace_activity
        display_recent_traces
        check_trace_patterns
        
        # Run periodic health checks (every 5 cycles)
        if (( $(date +%s) % (MONITOR_INTERVAL * 5) < MONITOR_INTERVAL )); then
            run_health_checks
        fi
        
        echo ""
        echo -e "${CYAN}Next update in ${MONITOR_INTERVAL}s... (Ctrl+C to stop)${NC}"
        
        sleep "$MONITOR_INTERVAL"
    done
}

# Handle cleanup on exit
cleanup() {
    log_info "Monitoring stopped"
    echo ""
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Print usage information
show_usage() {
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --help, -h              Show this help message"
    echo "  --interval SECONDS      Set monitoring interval (default: $MONITOR_INTERVAL)"
    echo "  --max-traces NUM        Max traces to display (default: $MAX_TRACES_DISPLAY)"
    echo "  --log-file FILE         Log file path (default: $LOG_FILE)"
    echo "  --validate              Run validation before monitoring"
    echo ""
    echo "Environment variables:"
    echo "  LANGFUSE_BASE_URL       Langfuse server URL (default: http://localhost:3000)"
    echo "  LANGFUSE_PUBLIC_KEY     Required: Langfuse public key"
    echo "  LANGFUSE_SECRET_KEY     Required: Langfuse secret key"
    echo "  MONITOR_INTERVAL        Monitor interval in seconds (default: 10)"
    echo "  ALERT_THRESHOLD_CPU     CPU alert threshold % (default: 80)"
    echo "  ALERT_THRESHOLD_MEMORY  Memory alert threshold % (default: 85)"
    echo ""
    echo "Examples:"
    echo "  $0                          # Start monitoring with defaults"
    echo "  $0 --interval 5             # Monitor every 5 seconds"
    echo "  $0 --validate               # Validate deployment first"
    echo "  MONITOR_INTERVAL=30 $0      # Monitor every 30 seconds"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --help|-h)
            show_usage
            exit 0
            ;;
        --interval)
            MONITOR_INTERVAL="$2"
            shift 2
            ;;
        --max-traces)
            MAX_TRACES_DISPLAY="$2"
            shift 2
            ;;
        --log-file)
            LOG_FILE="$2"
            shift 2
            ;;
        --validate)
            log_info "Running deployment validation first..."
            if [[ -x "$SCRIPT_DIR/validate-deployment.sh" ]]; then
                "$SCRIPT_DIR/validate-deployment.sh"
                if [[ $? -ne 0 ]]; then
                    log_error "Validation failed. Fix issues before monitoring."
                    exit 1
                fi
            else
                log_warning "Validation script not found or not executable"
            fi
            shift
            ;;
        *)
            log_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Main execution
main() {
    # Initialize log file
    echo "Trace monitoring started at $(date)" > "$LOG_FILE"
    
    # Check dependencies
    check_dependencies
    
    # Start monitoring
    start_monitoring
}

# Run main function
main