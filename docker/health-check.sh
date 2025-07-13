#!/bin/bash

# Health check script for Swarm containers
# Built by Builder-2 Agent for Enterprise Swarm Platform

set -euo pipefail

# Configuration
HEALTH_CHECK_PORT="${PORT:-3000}"
HEALTH_CHECK_TIMEOUT="${HEALTH_CHECK_TIMEOUT:-10}"
HEALTH_CHECK_ENDPOINT="${HEALTH_CHECK_ENDPOINT:-/health}"
MAX_RETRIES="${MAX_RETRIES:-3}"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "[$(date +'%Y-%m-%d %H:%M:%S')] $1" >&2
}

success() {
    echo -e "${GREEN}[HEALTHY]${NC} $1" >&2
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" >&2
}

error() {
    echo -e "${RED}[UNHEALTHY]${NC} $1" >&2
}

# Function to check HTTP endpoint
check_http_endpoint() {
    local url="http://localhost:${HEALTH_CHECK_PORT}${HEALTH_CHECK_ENDPOINT}"
    local response
    local http_code
    
    log "Checking HTTP endpoint: $url"
    
    if command -v curl >/dev/null 2>&1; then
        response=$(curl -s -w "%{http_code}" --max-time "$HEALTH_CHECK_TIMEOUT" "$url" 2>/dev/null || echo "000")
        http_code="${response: -3}"
        
        if [[ "$http_code" == "200" ]]; then
            success "HTTP endpoint responding with 200 OK"
            return 0
        elif [[ "$http_code" == "000" ]]; then
            error "HTTP endpoint unreachable (connection failed)"
            return 1
        else
            error "HTTP endpoint returned status code: $http_code"
            return 1
        fi
    else
        warning "curl not available, skipping HTTP check"
        return 0
    fi
}

# Function to check port availability
check_port() {
    log "Checking if port $HEALTH_CHECK_PORT is listening..."
    
    if command -v netstat >/dev/null 2>&1; then
        if netstat -ln | grep -q ":$HEALTH_CHECK_PORT "; then
            success "Port $HEALTH_CHECK_PORT is listening"
            return 0
        else
            error "Port $HEALTH_CHECK_PORT is not listening"
            return 1
        fi
    elif command -v ss >/dev/null 2>&1; then
        if ss -ln | grep -q ":$HEALTH_CHECK_PORT "; then
            success "Port $HEALTH_CHECK_PORT is listening"
            return 0
        else
            error "Port $HEALTH_CHECK_PORT is not listening"
            return 1
        fi
    else
        # Fallback to nc if available
        if command -v nc >/dev/null 2>&1; then
            if nc -z localhost "$HEALTH_CHECK_PORT" 2>/dev/null; then
                success "Port $HEALTH_CHECK_PORT is reachable"
                return 0
            else
                error "Port $HEALTH_CHECK_PORT is not reachable"
                return 1
            fi
        else
            warning "No network tools available, skipping port check"
            return 0
        fi
    fi
}

# Function to check process
check_process() {
    log "Checking if Node.js process is running..."
    
    if pgrep -f "node.*dist/index.js" >/dev/null 2>&1; then
        success "Node.js process is running"
        return 0
    else
        error "Node.js process not found"
        return 1
    fi
}

# Function to check database connectivity
check_database() {
    local db_path="${DATABASE_PATH:-/app/data/swarm.db}"
    
    log "Checking database connectivity: $db_path"
    
    if [[ ! -f "$db_path" ]]; then
        error "Database file not found: $db_path"
        return 1
    fi
    
    if command -v sqlite3 >/dev/null 2>&1; then
        if sqlite3 "$db_path" "SELECT 1;" >/dev/null 2>&1; then
            success "Database is accessible"
            return 0
        else
            error "Database query failed"
            return 1
        fi
    else
        warning "sqlite3 not available, skipping database check"
        return 0
    fi
}

# Function to check Langfuse integration
check_langfuse() {
    if [[ "${LANGFUSE_ENABLED:-true}" != "true" ]]; then
        log "Langfuse integration disabled, skipping check"
        return 0
    fi
    
    log "Checking Langfuse integration..."
    
    # Check if environment variables are set
    if [[ -n "${LANGFUSE_PUBLIC_KEY:-}" && -n "${LANGFUSE_SECRET_KEY:-}" ]]; then
        success "Langfuse environment variables are configured"
    else
        warning "Langfuse environment variables not fully configured"
    fi
    
    # Test Langfuse host connectivity
    local langfuse_host="${LANGFUSE_HOST:-https://cloud.langfuse.com}"
    if command -v curl >/dev/null 2>&1; then
        if curl -s --max-time 5 "${langfuse_host}/api/public/health" >/dev/null 2>&1; then
            success "Langfuse host is reachable"
        else
            warning "Langfuse host connectivity check failed"
        fi
    fi
    
    return 0
}

# Function to check Claude Flow integration
check_claude_flow() {
    log "Checking Claude Flow integration..."
    
    # Check if coordination database exists
    if [[ -f "/app/.swarm/coordination.db" ]]; then
        success "Claude Flow coordination database exists"
        
        # Test database accessibility
        if command -v sqlite3 >/dev/null 2>&1; then
            if sqlite3 "/app/.swarm/coordination.db" "SELECT COUNT(*) FROM coordination;" >/dev/null 2>&1; then
                success "Coordination database is accessible"
            else
                warning "Coordination database query failed"
            fi
        fi
    else
        warning "Claude Flow coordination database not found"
    fi
    
    # Check if Claude Flow CLI is available
    if command -v npx >/dev/null 2>&1; then
        if npx claude-flow@alpha --version >/dev/null 2>&1; then
            success "Claude Flow CLI is available"
        else
            warning "Claude Flow CLI not available"
        fi
    fi
    
    return 0
}

# Function to check disk space
check_disk_space() {
    log "Checking disk space..."
    
    local data_dir="/app/data"
    local logs_dir="/app/logs"
    
    for dir in "$data_dir" "$logs_dir"; do
        if [[ -d "$dir" ]]; then
            local usage
            if command -v df >/dev/null 2>&1; then
                usage=$(df "$dir" | awk 'NR==2 {print $5}' | sed 's/%//')
                if [[ "$usage" -gt 90 ]]; then
                    error "Disk usage for $dir is ${usage}% (critical)"
                    return 1
                elif [[ "$usage" -gt 80 ]]; then
                    warning "Disk usage for $dir is ${usage}% (high)"
                else
                    success "Disk usage for $dir is ${usage}% (normal)"
                fi
            fi
        fi
    done
    
    return 0
}

# Function to check memory usage
check_memory() {
    log "Checking memory usage..."
    
    if command -v free >/dev/null 2>&1; then
        local mem_usage
        mem_usage=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
        
        if [[ "$mem_usage" -gt 90 ]]; then
            error "Memory usage is ${mem_usage}% (critical)"
            return 1
        elif [[ "$mem_usage" -gt 80 ]]; then
            warning "Memory usage is ${mem_usage}% (high)"
        else
            success "Memory usage is ${mem_usage}% (normal)"
        fi
    elif [[ -f "/proc/meminfo" ]]; then
        # Alternative memory check for containers without free command
        local total_kb available_kb usage_percent
        total_kb=$(grep MemTotal /proc/meminfo | awk '{print $2}')
        available_kb=$(grep MemAvailable /proc/meminfo | awk '{print $2}')
        usage_percent=$(( (total_kb - available_kb) * 100 / total_kb ))
        
        if [[ "$usage_percent" -gt 90 ]]; then
            error "Memory usage is ${usage_percent}% (critical)"
            return 1
        elif [[ "$usage_percent" -gt 80 ]]; then
            warning "Memory usage is ${usage_percent}% (high)"
        else
            success "Memory usage is ${usage_percent}% (normal)"
        fi
    fi
    
    return 0
}

# Function to perform comprehensive health check
comprehensive_health_check() {
    local checks_passed=0
    local total_checks=0
    local critical_failed=0
    
    log "Starting comprehensive health check..."
    
    # Critical checks (must pass)
    log "=== CRITICAL CHECKS ==="
    
    ((total_checks++))
    if check_process; then
        ((checks_passed++))
    else
        ((critical_failed++))
    fi
    
    ((total_checks++))
    if check_port; then
        ((checks_passed++))
    else
        ((critical_failed++))
    fi
    
    ((total_checks++))
    if check_http_endpoint; then
        ((checks_passed++))
    else
        ((critical_failed++))
    fi
    
    ((total_checks++))
    if check_database; then
        ((checks_passed++))
    else
        ((critical_failed++))
    fi
    
    # Non-critical checks (warnings only)
    log "=== NON-CRITICAL CHECKS ==="
    
    ((total_checks++))
    if check_langfuse; then
        ((checks_passed++))
    fi
    
    ((total_checks++))
    if check_claude_flow; then
        ((checks_passed++))
    fi
    
    ((total_checks++))
    if check_disk_space; then
        ((checks_passed++))
    fi
    
    ((total_checks++))
    if check_memory; then
        ((checks_passed++))
    fi
    
    # Report results
    log "=== HEALTH CHECK SUMMARY ==="
    log "Checks passed: $checks_passed/$total_checks"
    log "Critical failures: $critical_failed"
    
    if [[ "$critical_failed" -eq 0 ]]; then
        success "Health check PASSED"
        return 0
    else
        error "Health check FAILED ($critical_failed critical failures)"
        return 1
    fi
}

# Main execution with retry logic
main() {
    local attempt=1
    
    while [[ $attempt -le $MAX_RETRIES ]]; do
        log "Health check attempt $attempt/$MAX_RETRIES"
        
        if comprehensive_health_check; then
            log "Health check completed successfully"
            exit 0
        fi
        
        if [[ $attempt -lt $MAX_RETRIES ]]; then
            warning "Health check failed, retrying in 2 seconds..."
            sleep 2
        fi
        
        ((attempt++))
    done
    
    error "Health check failed after $MAX_RETRIES attempts"
    exit 1
}

# Run main function
main "$@"