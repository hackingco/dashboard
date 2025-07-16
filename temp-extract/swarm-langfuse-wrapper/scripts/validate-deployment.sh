#!/bin/bash

# Deployment Validation Script
# Comprehensive validation of Docker deployment and services

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TIMEOUT=30
RETRY_COUNT=3
WAIT_TIME=10

# Default values
LANGFUSE_URL="${LANGFUSE_BASE_URL:-http://localhost:3000}"
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_DB="${POSTGRES_DB:-langfuse}"

# Log functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}   Deployment Validation${NC}"
    echo -e "${BLUE}================================${NC}"
    echo ""
}

# Validation functions
validate_environment() {
    log_info "Validating environment variables..."
    
    local required_vars=("LANGFUSE_PUBLIC_KEY" "LANGFUSE_SECRET_KEY" "POSTGRES_PASSWORD")
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            missing_vars+=("$var")
        fi
    done
    
    if [[ ${#missing_vars[@]} -eq 0 ]]; then
        log_success "All required environment variables are set"
        return 0
    else
        log_error "Missing required environment variables: ${missing_vars[*]}"
        return 1
    fi
}

validate_docker() {
    log_info "Validating Docker installation..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed or not in PATH"
        return 1
    fi
    
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running"
        return 1
    fi
    
    log_success "Docker is available and running"
    return 0
}

validate_docker_compose() {
    log_info "Validating Docker Compose..."
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not available"
        return 1
    fi
    
    # Check for docker-compose.yml
    if [[ ! -f "$PROJECT_ROOT/docker-compose.yml" ]]; then
        log_error "docker-compose.yml not found in $PROJECT_ROOT"
        return 1
    fi
    
    # Validate compose file syntax
    if docker-compose -f "$PROJECT_ROOT/docker-compose.yml" config &> /dev/null; then
        log_success "Docker Compose file is valid"
        return 0
    else
        log_error "Docker Compose file has syntax errors"
        return 1
    fi
}

validate_containers() {
    log_info "Validating container status..."
    
    local expected_containers=("langfuse" "postgres")
    local running_containers=()
    local failed_containers=()
    
    for container in "${expected_containers[@]}"; do
        if docker ps --filter "name=$container" --filter "status=running" --format "{{.Names}}" | grep -q "$container"; then
            running_containers+=("$container")
            log_success "Container $container is running"
        else
            failed_containers+=("$container")
            log_error "Container $container is not running"
        fi
    done
    
    if [[ ${#failed_containers[@]} -eq 0 ]]; then
        return 0
    else
        log_error "Failed containers: ${failed_containers[*]}"
        return 1
    fi
}

validate_database_connectivity() {
    log_info "Validating database connectivity..."
    
    # Try to connect to PostgreSQL
    for i in $(seq 1 $RETRY_COUNT); do
        if docker exec -it postgres-container pg_isready -h localhost -p 5432 -U postgres &> /dev/null; then
            log_success "Database is accepting connections"
            return 0
        else
            if [[ $i -lt $RETRY_COUNT ]]; then
                log_warning "Database connection attempt $i failed, retrying in ${WAIT_TIME}s..."
                sleep $WAIT_TIME
            fi
        fi
    done
    
    log_error "Database is not accepting connections after $RETRY_COUNT attempts"
    return 1
}

validate_langfuse_api() {
    log_info "Validating Langfuse API connectivity..."
    
    local health_endpoint="$LANGFUSE_URL/api/public/health"
    
    for i in $(seq 1 $RETRY_COUNT); do
        if curl -s --max-time $TIMEOUT "$health_endpoint" | grep -q "ok\|healthy" &> /dev/null; then
            log_success "Langfuse API is responding"
            return 0
        else
            if [[ $i -lt $RETRY_COUNT ]]; then
                log_warning "Langfuse API attempt $i failed, retrying in ${WAIT_TIME}s..."
                sleep $WAIT_TIME
            fi
        fi
    done
    
    log_error "Langfuse API is not responding after $RETRY_COUNT attempts"
    return 1
}

validate_authentication() {
    log_info "Validating Langfuse authentication..."
    
    if [[ -z "$LANGFUSE_PUBLIC_KEY" || -z "$LANGFUSE_SECRET_KEY" ]]; then
        log_error "Authentication keys not provided"
        return 1
    fi
    
    # Test authentication with a simple API call
    local auth_header=$(echo -n "$LANGFUSE_PUBLIC_KEY:$LANGFUSE_SECRET_KEY" | base64)
    local response=$(curl -s -w "%{http_code}" -o /dev/null --max-time $TIMEOUT \
        -H "Authorization: Basic $auth_header" \
        "$LANGFUSE_URL/api/public/projects")
    
    if [[ "$response" == "200" ]]; then
        log_success "Authentication is working"
        return 0
    elif [[ "$response" == "401" ]]; then
        log_error "Authentication failed - invalid credentials"
        return 1
    else
        log_warning "Authentication test returned HTTP $response"
        return 1
    fi
}

validate_trace_ingestion() {
    log_info "Validating trace ingestion..."
    
    # Create a test trace
    local test_trace_id="validation-test-$(date +%s)"
    local auth_header=$(echo -n "$LANGFUSE_PUBLIC_KEY:$LANGFUSE_SECRET_KEY" | base64)
    
    local trace_data='{
        "id": "'$test_trace_id'",
        "name": "Validation Test Trace",
        "userId": "validator",
        "metadata": {
            "purpose": "deployment-validation",
            "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'"
        }
    }'
    
    local response=$(curl -s -w "%{http_code}" -o /dev/null --max-time $TIMEOUT \
        -X POST \
        -H "Content-Type: application/json" \
        -H "Authorization: Basic $auth_header" \
        -d "$trace_data" \
        "$LANGFUSE_URL/api/public/traces")
    
    if [[ "$response" == "200" || "$response" == "201" ]]; then
        log_success "Trace ingestion is working"
        
        # Try to retrieve the trace after a short delay
        sleep 2
        local get_response=$(curl -s -w "%{http_code}" -o /dev/null --max-time $TIMEOUT \
            -H "Authorization: Basic $auth_header" \
            "$LANGFUSE_URL/api/public/traces/$test_trace_id")
        
        if [[ "$get_response" == "200" ]]; then
            log_success "Trace retrieval is working"
        else
            log_warning "Trace retrieval returned HTTP $get_response"
        fi
        
        return 0
    else
        log_error "Trace ingestion failed - HTTP $response"
        return 1
    fi
}

validate_monitoring_tools() {
    log_info "Validating monitoring tools..."
    
    # Check if monitoring scripts exist
    local monitoring_files=(
        "$PROJECT_ROOT/monitoring/docker-metrics.ts"
        "$PROJECT_ROOT/monitoring/langfuse-validator.ts" 
        "$PROJECT_ROOT/monitoring/swarm-health.ts"
    )
    
    local missing_files=()
    for file in "${monitoring_files[@]}"; do
        if [[ ! -f "$file" ]]; then
            missing_files+=("$(basename "$file")")
        fi
    done
    
    if [[ ${#missing_files[@]} -eq 0 ]]; then
        log_success "All monitoring tools are available"
        return 0
    else
        log_warning "Missing monitoring files: ${missing_files[*]}"
        return 1
    fi
}

validate_node_environment() {
    log_info "Validating Node.js environment..."
    
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        return 1
    fi
    
    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed"
        return 1
    fi
    
    # Check if required packages are available
    if [[ -f "$PROJECT_ROOT/package.json" ]]; then
        if npm list typescript > /dev/null 2>&1; then
            log_success "TypeScript environment is ready"
        else
            log_warning "TypeScript not found in dependencies"
        fi
    fi
    
    log_success "Node.js environment is available"
    return 0
}

run_comprehensive_validation() {
    log_info "Running comprehensive validation with monitoring tools..."
    
    # Run Docker metrics collection
    if [[ -f "$PROJECT_ROOT/monitoring/docker-metrics.ts" ]] && command -v npx &> /dev/null; then
        log_info "Running Docker metrics collection..."
        if npx ts-node "$PROJECT_ROOT/monitoring/docker-metrics.ts" &> /dev/null; then
            log_success "Docker metrics collection successful"
        else
            log_warning "Docker metrics collection failed"
        fi
    fi
    
    # Run Langfuse validation
    if [[ -f "$PROJECT_ROOT/monitoring/langfuse-validator.ts" ]] && command -v npx &> /dev/null; then
        log_info "Running Langfuse validation..."
        if LANGFUSE_PUBLIC_KEY="$LANGFUSE_PUBLIC_KEY" \
           LANGFUSE_SECRET_KEY="$LANGFUSE_SECRET_KEY" \
           LANGFUSE_BASE_URL="$LANGFUSE_URL" \
           npx ts-node "$PROJECT_ROOT/monitoring/langfuse-validator.ts" &> /dev/null; then
            log_success "Langfuse validation successful"
        else
            log_warning "Langfuse validation failed"
        fi
    fi
    
    # Run swarm health check
    if [[ -f "$PROJECT_ROOT/monitoring/swarm-health.ts" ]] && command -v npx &> /dev/null; then
        log_info "Running swarm health check..."
        if npx ts-node "$PROJECT_ROOT/monitoring/swarm-health.ts" &> /dev/null; then
            log_success "Swarm health check successful"
        else
            log_warning "Swarm health check failed"
        fi
    fi
}

generate_report() {
    local report_file="validation-report-$(date +%Y%m%d-%H%M%S).json"
    local total_tests=0
    local passed_tests=0
    local failed_tests=0
    
    log_info "Generating validation report..."
    
    # Create report structure
    cat > "$report_file" << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)",
    "deployment": {
        "langfuse_url": "$LANGFUSE_URL",
        "postgres_host": "$POSTGRES_HOST",
        "postgres_port": "$POSTGRES_PORT"
    },
    "validation_results": {
        "environment": "$(validate_environment &> /dev/null && echo "PASS" || echo "FAIL")",
        "docker": "$(validate_docker &> /dev/null && echo "PASS" || echo "FAIL")",
        "docker_compose": "$(validate_docker_compose &> /dev/null && echo "PASS" || echo "FAIL")",
        "containers": "$(validate_containers &> /dev/null && echo "PASS" || echo "FAIL")",
        "database": "$(validate_database_connectivity &> /dev/null && echo "PASS" || echo "FAIL")",
        "langfuse_api": "$(validate_langfuse_api &> /dev/null && echo "PASS" || echo "FAIL")",
        "authentication": "$(validate_authentication &> /dev/null && echo "PASS" || echo "FAIL")",
        "trace_ingestion": "$(validate_trace_ingestion &> /dev/null && echo "PASS" || echo "FAIL")",
        "monitoring_tools": "$(validate_monitoring_tools &> /dev/null && echo "PASS" || echo "FAIL")",
        "node_environment": "$(validate_node_environment &> /dev/null && echo "PASS" || echo "FAIL")"
    }
}
EOF
    
    log_success "Validation report saved to $report_file"
}

# Main execution
main() {
    print_header
    
    local exit_code=0
    
    # Run all validations
    validate_environment || exit_code=1
    validate_docker || exit_code=1
    validate_docker_compose || exit_code=1
    validate_containers || exit_code=1
    validate_database_connectivity || exit_code=1
    validate_langfuse_api || exit_code=1
    validate_authentication || exit_code=1
    validate_trace_ingestion || exit_code=1
    validate_monitoring_tools || exit_code=1
    validate_node_environment || exit_code=1
    
    # Run comprehensive validation with tools
    run_comprehensive_validation
    
    # Generate report
    generate_report
    
    echo ""
    if [[ $exit_code -eq 0 ]]; then
        log_success "🎉 All validations passed! Deployment is ready."
    else
        log_error "❌ Some validations failed. Check the logs above for details."
    fi
    
    echo ""
    log_info "For continuous monitoring, run: ./scripts/monitor-traces.sh"
    
    exit $exit_code
}

# Handle command line arguments
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [options]"
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --report-only  Generate report only (no validation)"
        echo ""
        echo "Environment variables:"
        echo "  LANGFUSE_BASE_URL   Langfuse server URL (default: http://localhost:3000)"
        echo "  LANGFUSE_PUBLIC_KEY Required: Langfuse public key"
        echo "  LANGFUSE_SECRET_KEY Required: Langfuse secret key"
        echo "  POSTGRES_HOST       PostgreSQL host (default: localhost)"
        echo "  POSTGRES_PORT       PostgreSQL port (default: 5432)"
        echo "  POSTGRES_DB         PostgreSQL database (default: langfuse)"
        exit 0
        ;;
    --report-only)
        generate_report
        exit 0
        ;;
    *)
        main
        ;;
esac