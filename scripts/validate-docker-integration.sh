#!/bin/bash

# Docker Integration Validation Script
# Validates that all Docker services are properly configured and can communicate

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.development.yml"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log() { echo -e "${GREEN}[$(date +'%H:%M:%S')] ✅ $1${NC}"; }
warn() { echo -e "${YELLOW}[$(date +'%H:%M:%S')] ⚠️  $1${NC}"; }
error() { echo -e "${RED}[$(date +'%H:%M:%S')] ❌ $1${NC}"; }
info() { echo -e "${BLUE}[$(date +'%H:%M:%S')] ℹ️  $1${NC}"; }

# Test results
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run test
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_output="$3"
    
    info "Running test: $test_name"
    
    if eval "$test_command"; then
        log "✅ $test_name: PASSED"
        ((TESTS_PASSED++))
        return 0
    else
        error "❌ $test_name: FAILED"
        ((TESTS_FAILED++))
        return 1
    fi
}

# Function to wait for service
wait_for_service() {
    local service_name="$1"
    local health_check="$2"
    local timeout="${3:-60}"
    local interval="${4:-5}"
    
    info "Waiting for $service_name to be ready..."
    
    local count=0
    while [ $count -lt $((timeout / interval)) ]; do
        if eval "$health_check" >/dev/null 2>&1; then
            log "$service_name is ready"
            return 0
        fi
        sleep $interval
        ((count++))
        echo -n "."
    done
    
    error "$service_name failed to become ready within ${timeout}s"
    return 1
}

# Function to check Docker
check_docker() {
    info "Checking Docker installation..."
    
    if ! command -v docker >/dev/null 2>&1; then
        error "Docker is not installed"
        exit 1
    fi
    
    if ! docker info >/dev/null 2>&1; then
        error "Docker daemon is not running"
        exit 1
    fi
    
    log "Docker is installed and running"
    
    # Check Docker Compose
    if ! command -v docker-compose >/dev/null 2>&1; then
        error "Docker Compose is not installed"
        exit 1
    fi
    
    log "Docker Compose is available"
}

# Function to check files
check_files() {
    info "Checking required files..."
    
    local required_files=(
        "$PROJECT_ROOT/docker-compose.yml"
        "$PROJECT_ROOT/docker-compose.development.yml"
        "$PROJECT_ROOT/docker-compose.production.yml"
        "$PROJECT_ROOT/docker-orchestrator.sh"
        "$PROJECT_ROOT/.env"
        "$PROJECT_ROOT/apps/dashboard/Dockerfile"
        "$PROJECT_ROOT/apps/dashboard/Dockerfile.dev"
        "$PROJECT_ROOT/apps/manager/Dockerfile.dev"
    )
    
    for file in "${required_files[@]}"; do
        if [[ -f "$file" ]]; then
            log "Found: $(basename "$file")"
        else
            error "Missing: $file"
            exit 1
        fi
    done
}

# Function to validate compose files
validate_compose() {
    info "Validating Docker Compose files..."
    
    local compose_files=(
        "$PROJECT_ROOT/docker-compose.yml"
        "$PROJECT_ROOT/docker-compose.development.yml"
        "$PROJECT_ROOT/docker-compose.production.yml"
    )
    
    for compose_file in "${compose_files[@]}"; do
        if docker-compose -f "$compose_file" config >/dev/null 2>&1; then
            log "Valid compose file: $(basename "$compose_file")"
        else
            error "Invalid compose file: $compose_file"
            docker-compose -f "$compose_file" config
            exit 1
        fi
    done
}

# Function to start services
start_services() {
    info "Starting development services..."
    
    cd "$PROJECT_ROOT"
    
    # Stop any existing services
    docker-compose -f "$COMPOSE_FILE" down >/dev/null 2>&1 || true
    
    # Start services
    if docker-compose -f "$COMPOSE_FILE" up -d --build; then
        log "Services started successfully"
    else
        error "Failed to start services"
        exit 1
    fi
}

# Function to test service health
test_service_health() {
    info "Testing service health..."
    
    # Wait for Redis
    run_test "Redis connectivity" \
        "wait_for_service 'Redis' 'docker exec swarm-platform-redis-1 redis-cli ping | grep -q PONG'" \
        "PONG"
    
    # Wait for PostgreSQL
    run_test "PostgreSQL connectivity" \
        "wait_for_service 'PostgreSQL' 'docker exec swarm-platform-postgres-1 pg_isready -U postgres'" \
        "accepting connections"
    
    # Wait for Manager API
    run_test "Manager API health" \
        "wait_for_service 'Manager API' 'curl -f http://localhost:8080/health'" \
        "ok"
    
    # Wait for Dashboard
    run_test "Dashboard accessibility" \
        "wait_for_service 'Dashboard' 'curl -f http://localhost:3000'" \
        "200"
}

# Function to test inter-service communication
test_communication() {
    info "Testing inter-service communication..."
    
    # Test Manager API can connect to Redis
    run_test "Manager -> Redis connection" \
        "docker exec swarm-platform-manager-1 node -e 'const Redis = require(\"ioredis\"); const redis = new Redis(\"redis://redis:6379\"); redis.ping().then(() => process.exit(0)).catch(() => process.exit(1));'" \
        ""
    
    # Test Manager API can connect to PostgreSQL
    run_test "Manager -> PostgreSQL connection" \
        "docker exec swarm-platform-manager-1 node -e 'const { Client } = require(\"pg\"); const client = new Client({connectionString: \"postgresql://postgres:postgres@postgres:5432/swarm_dev\"}); client.connect().then(() => client.end()).then(() => process.exit(0)).catch(() => process.exit(1));'" \
        ""
    
    # Test Dashboard can reach Manager API
    run_test "Dashboard -> Manager API connection" \
        "docker exec swarm-platform-dashboard-1 node -e 'const http = require(\"http\"); http.get(\"http://manager:8080/health\", (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on(\"error\", () => process.exit(1));'" \
        ""
}

# Function to test environment variables
test_environment() {
    info "Testing environment variables..."
    
    # Test Manager API environment
    run_test "Manager environment variables" \
        "docker exec swarm-platform-manager-1 node -e 'console.log(process.env.REDIS_URL, process.env.DATABASE_URL); process.exit(process.env.REDIS_URL && process.env.DATABASE_URL ? 0 : 1);'" \
        ""
    
    # Test Dashboard environment
    run_test "Dashboard environment variables" \
        "docker exec swarm-platform-dashboard-1 node -e 'console.log(process.env.NEXT_PUBLIC_API_URL); process.exit(process.env.NEXT_PUBLIC_API_URL ? 0 : 1);'" \
        ""
}

# Function to test API endpoints
test_api_endpoints() {
    info "Testing API endpoints..."
    
    # Test Manager API health endpoint
    run_test "Manager API /health endpoint" \
        "curl -s http://localhost:8080/health | grep -q '\"status\"'" \
        ""
    
    # Test Dashboard root endpoint
    run_test "Dashboard root endpoint" \
        "curl -s -o /dev/null -w '%{http_code}' http://localhost:3000 | grep -q '200'" \
        ""
    
    # Test WebSocket connection (if available)
    if command -v wscat >/dev/null 2>&1; then
        run_test "WebSocket connection" \
            "timeout 5 wscat -c ws://localhost:8080 --close" \
            ""
    else
        warn "wscat not available, skipping WebSocket test"
    fi
}

# Function to test data persistence
test_persistence() {
    info "Testing data persistence..."
    
    # Test Redis data persistence
    run_test "Redis data persistence" \
        "docker exec swarm-platform-redis-1 redis-cli set test-key test-value && docker exec swarm-platform-redis-1 redis-cli get test-key | grep -q 'test-value'" \
        ""
    
    # Test PostgreSQL data persistence
    run_test "PostgreSQL data persistence" \
        "docker exec swarm-platform-postgres-1 psql -U postgres -d swarm_dev -c \"CREATE TABLE IF NOT EXISTS test_table (id INT);\" && docker exec swarm-platform-postgres-1 psql -U postgres -d swarm_dev -c \"INSERT INTO test_table VALUES (1);\" && docker exec swarm-platform-postgres-1 psql -U postgres -d swarm_dev -c \"SELECT COUNT(*) FROM test_table;\" | grep -q '1'" \
        ""
}

# Function to cleanup
cleanup() {
    info "Cleaning up test environment..."
    
    cd "$PROJECT_ROOT"
    docker-compose -f "$COMPOSE_FILE" down -v >/dev/null 2>&1 || true
    
    log "Cleanup completed"
}

# Function to show results
show_results() {
    echo
    info "=== Test Results ==="
    log "Tests Passed: $TESTS_PASSED"
    
    if [ $TESTS_FAILED -gt 0 ]; then
        error "Tests Failed: $TESTS_FAILED"
        echo
        error "Docker integration validation FAILED"
        exit 1
    else
        echo
        log "🎉 Docker integration validation PASSED"
        echo
        info "All services are properly configured and communicating!"
        echo
        info "Access URLs:"
        echo "  Dashboard: http://localhost:3000"
        echo "  Manager API: http://localhost:8080"
        echo "  API Health: http://localhost:8080/health"
        echo
        exit 0
    fi
}

# Main execution
main() {
    echo
    info "🐳 Docker Integration Validation"
    echo "=================================="
    echo
    
    # Setup trap for cleanup
    trap cleanup EXIT
    
    # Run validation steps
    check_docker
    check_files
    validate_compose
    start_services
    
    # Wait a bit for services to stabilize
    sleep 10
    
    # Run tests
    test_service_health
    test_communication
    test_environment
    test_api_endpoints
    test_persistence
    
    # Show results
    show_results
}

# Help function
show_help() {
    cat << EOF
Docker Integration Validation Script

USAGE:
    $0 [OPTIONS]

OPTIONS:
    --help, -h          Show this help message
    --skip-cleanup      Don't clean up services after tests
    --compose-file FILE Use specific compose file (default: docker-compose.development.yml)

EXAMPLES:
    $0                                    # Run full validation
    $0 --skip-cleanup                     # Run tests but leave services running
    $0 --compose-file docker-compose.yml # Use main compose file

This script validates:
✅ Docker installation and setup
✅ Compose file validity
✅ Service startup and health
✅ Inter-service communication
✅ Environment variable configuration
✅ API endpoint accessibility
✅ Data persistence

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --help|-h)
            show_help
            exit 0
            ;;
        --skip-cleanup)
            trap - EXIT
            shift
            ;;
        --compose-file)
            COMPOSE_FILE="$2"
            shift 2
            ;;
        *)
            error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Run main function
main "$@"