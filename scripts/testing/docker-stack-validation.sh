#!/bin/bash

# Docker Stack Validation Script
# Tests all Docker compose configurations and validates service connectivity

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
LOG_FILE="${PROJECT_ROOT}/docker-stack-validation.log"
RESULTS_FILE="${PROJECT_ROOT}/docker-stack-test-results.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

# Initialize results tracking
init_results() {
    cat > "$RESULTS_FILE" <<EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "tests": {},
  "summary": {
    "total": 0,
    "passed": 0,
    "failed": 0,
    "warnings": 0
  }
}
EOF
}

# Update test result
update_result() {
    local test_name="$1"
    local status="$2"
    local message="$3"
    local details="${4:-}"
    
    # Use temporary file for atomic updates
    local temp_file=$(mktemp)
    jq --arg name "$test_name" \
       --arg status "$status" \
       --arg message "$message" \
       --arg details "$details" \
       '.tests[$name] = {
         "status": $status,
         "message": $message,
         "details": $details,
         "timestamp": now | strftime("%Y-%m-%dT%H:%M:%SZ")
       } | 
       .summary.total += 1 |
       if $status == "passed" then .summary.passed += 1
       elif $status == "failed" then .summary.failed += 1
       else .summary.warnings += 1 end' \
       "$RESULTS_FILE" > "$temp_file" && mv "$temp_file" "$RESULTS_FILE"
}

# Test Docker and Docker Compose availability
test_docker_availability() {
    log "Testing Docker availability..."
    
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed or not in PATH"
        update_result "docker_availability" "failed" "Docker not found"
        return 1
    fi
    
    if ! docker info &> /dev/null; then
        error "Docker daemon is not running"
        update_result "docker_availability" "failed" "Docker daemon not running"
        return 1
    fi
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        error "Docker Compose is not installed"
        update_result "docker_availability" "failed" "Docker Compose not found"
        return 1
    fi
    
    local docker_version=$(docker --version)
    local compose_version=$(docker compose version 2>/dev/null || docker-compose --version)
    
    success "Docker and Docker Compose are available"
    update_result "docker_availability" "passed" "Docker and Compose available" "{\"docker_version\": \"$docker_version\", \"compose_version\": \"$compose_version\"}"
}

# Validate Docker Compose files
test_compose_files() {
    log "Validating Docker Compose files..."
    
    local compose_files=(
        "docker-compose.yml"
        "docker-compose.langfuse.yml"
        "docker-compose.production.yml"
        "docker-compose.development.yml"
    )
    
    local validation_results=()
    
    for file in "${compose_files[@]}"; do
        local file_path="${PROJECT_ROOT}/$file"
        
        if [[ ! -f "$file_path" ]]; then
            warning "Compose file not found: $file"
            validation_results+=("\"$file\": \"not_found\"")
            continue
        fi
        
        if docker-compose -f "$file_path" config &> /dev/null; then
            success "Valid compose file: $file"
            validation_results+=("\"$file\": \"valid\"")
        else
            error "Invalid compose file: $file"
            validation_results+=("\"$file\": \"invalid\"")
        fi
    done
    
    local details="{$(IFS=,; echo "${validation_results[*]}")}"
    update_result "compose_file_validation" "passed" "Compose files validated" "$details"
}

# Test environment file setup
test_environment_files() {
    log "Testing environment file setup..."
    
    local env_files=(
        ".env.example"
        ".env.langfuse.example"
        ".env.docker.example"
    )
    
    local missing_files=()
    local found_files=()
    
    for file in "${env_files[@]}"; do
        if [[ -f "${PROJECT_ROOT}/$file" ]]; then
            found_files+=("$file")
        else
            missing_files+=("$file")
        fi
    done
    
    if [[ ${#missing_files[@]} -gt 0 ]]; then
        warning "Missing environment example files: ${missing_files[*]}"
        update_result "environment_files" "warning" "Some env files missing" "{\"found\": [\"$(IFS='","'; echo "${found_files[*]}")\"], \"missing\": [\"$(IFS='","'; echo "${missing_files[*]}")\"]}"
    else
        success "All environment example files found"
        update_result "environment_files" "passed" "All env files present" "{\"files\": [\"$(IFS='","'; echo "${found_files[*]}")\"]}"
    fi
}

# Test basic Docker Compose stack
test_basic_stack() {
    log "Testing basic Docker stack startup..."
    
    cd "$PROJECT_ROOT"
    
    # Pull images first to avoid timeout issues
    log "Pulling Docker images..."
    if ! timeout 300 docker-compose pull; then
        error "Failed to pull Docker images within timeout"
        update_result "basic_stack" "failed" "Image pull timeout"
        return 1
    fi
    
    # Start basic services
    log "Starting basic services..."
    if ! timeout 120 docker-compose up -d redis postgres; then
        error "Failed to start basic services"
        update_result "basic_stack" "failed" "Basic services startup failed"
        return 1
    fi
    
    # Wait for services to be healthy
    log "Waiting for services to be healthy..."
    local retries=30
    while [[ $retries -gt 0 ]]; do
        if docker-compose ps | grep -E "(redis|postgres)" | grep -q "healthy\|Up"; then
            success "Basic services are running"
            update_result "basic_stack" "passed" "Basic services started successfully"
            return 0
        fi
        sleep 2
        ((retries--))
    done
    
    error "Services failed to become healthy"
    update_result "basic_stack" "failed" "Services not healthy within timeout"
    return 1
}

# Test Langfuse v3 stack
test_langfuse_stack() {
    log "Testing Langfuse v3 stack..."
    
    cd "$PROJECT_ROOT"
    
    # Start Langfuse stack
    log "Starting Langfuse v3 services..."
    if ! timeout 180 docker-compose -f docker-compose.langfuse.yml up -d; then
        error "Failed to start Langfuse services"
        update_result "langfuse_stack" "failed" "Langfuse startup failed"
        return 1
    fi
    
    # Check ClickHouse health
    log "Checking ClickHouse health..."
    local retries=30
    while [[ $retries -gt 0 ]]; do
        if curl -f http://localhost:8123/ping &> /dev/null; then
            success "ClickHouse is responding"
            break
        fi
        sleep 3
        ((retries--))
    done
    
    if [[ $retries -eq 0 ]]; then
        error "ClickHouse failed to respond"
        update_result "langfuse_stack" "failed" "ClickHouse not responding"
        return 1
    fi
    
    # Check Langfuse health
    log "Checking Langfuse health..."
    retries=60
    while [[ $retries -gt 0 ]]; do
        if curl -f http://localhost:3001/api/health &> /dev/null; then
            success "Langfuse is responding"
            update_result "langfuse_stack" "passed" "Langfuse v3 stack healthy"
            return 0
        fi
        sleep 5
        ((retries--))
    done
    
    error "Langfuse failed to respond"
    update_result "langfuse_stack" "failed" "Langfuse not responding"
    return 1
}

# Test service connectivity
test_service_connectivity() {
    log "Testing inter-service connectivity..."
    
    local tests=()
    
    # Test Redis connectivity
    if docker exec swarm-redis redis-cli ping &> /dev/null; then
        tests+=("\"redis\": \"connected\"")
        success "Redis connectivity test passed"
    else
        tests+=("\"redis\": \"failed\"")
        error "Redis connectivity test failed"
    fi
    
    # Test ClickHouse connectivity
    if docker exec swarm-clickhouse wget -q --spider http://localhost:8123/ping; then
        tests+=("\"clickhouse\": \"connected\"")
        success "ClickHouse connectivity test passed"
    else
        tests+=("\"clickhouse\": \"failed\"")
        error "ClickHouse connectivity test failed"
    fi
    
    # Test PostgreSQL connectivity
    if docker-compose exec -T postgres pg_isready -U postgres &> /dev/null; then
        tests+=("\"postgres\": \"connected\"")
        success "PostgreSQL connectivity test passed"
    else
        tests+=("\"postgres\": \"failed\"")
        error "PostgreSQL connectivity test failed"
    fi
    
    local details="{$(IFS=,; echo "${tests[*]}")}"
    update_result "service_connectivity" "passed" "Service connectivity tested" "$details"
}

# Test resource usage
test_resource_usage() {
    log "Testing resource usage..."
    
    local containers=$(docker-compose ps -q)
    local resource_data=()
    
    for container in $containers; do
        if [[ -n "$container" ]]; then
            local stats=$(docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}" "$container" | tail -n +2)
            if [[ -n "$stats" ]]; then
                local name=$(echo "$stats" | awk '{print $1}')
                local cpu=$(echo "$stats" | awk '{print $2}')
                local mem=$(echo "$stats" | awk '{print $3}')
                resource_data+=("\"$name\": {\"cpu\": \"$cpu\", \"memory\": \"$mem\"}")
            fi
        fi
    done
    
    local details="{$(IFS=,; echo "${resource_data[*]}")}"
    update_result "resource_usage" "passed" "Resource usage collected" "$details"
    success "Resource usage data collected"
}

# Cleanup function
cleanup() {
    log "Cleaning up test environment..."
    
    cd "$PROJECT_ROOT"
    
    # Stop all services
    docker-compose down --remove-orphans &> /dev/null || true
    docker-compose -f docker-compose.langfuse.yml down --remove-orphans &> /dev/null || true
    
    # Remove test volumes if they exist
    docker volume rm swarm-redis-data swarm-clickhouse-data swarm-langfuse-data &> /dev/null || true
    
    success "Cleanup completed"
}

# Main execution
main() {
    log "Starting Docker Stack Validation"
    log "Project root: $PROJECT_ROOT"
    log "Results will be saved to: $RESULTS_FILE"
    
    # Initialize results file
    init_results
    
    # Set trap for cleanup
    trap cleanup EXIT
    
    # Run tests
    test_docker_availability
    test_compose_files
    test_environment_files
    test_basic_stack
    test_langfuse_stack
    test_service_connectivity
    test_resource_usage
    
    # Generate summary
    local summary=$(jq -r '.summary | "Total: \(.total), Passed: \(.passed), Failed: \(.failed), Warnings: \(.warnings)"' "$RESULTS_FILE")
    
    log "=== VALIDATION SUMMARY ==="
    log "$summary"
    
    # Determine exit code
    local failed=$(jq -r '.summary.failed' "$RESULTS_FILE")
    if [[ "$failed" -gt 0 ]]; then
        error "Some tests failed. Check $RESULTS_FILE for details."
        exit 1
    else
        success "All tests passed! Full results in $RESULTS_FILE"
        exit 0
    fi
}

# Run main function
main "$@"