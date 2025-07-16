#!/bin/bash

# Test script for Langfuse wrapper Docker environment
# This script sets up and runs comprehensive tests for the Langfuse wrapper

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.langfuse-test.yml"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

# Help function
show_help() {
    cat << EOF
Langfuse Wrapper Test Environment

USAGE:
    $0 [OPTIONS] [COMMAND]

COMMANDS:
    full        Run full test suite with Langfuse enabled (default)
    fallback    Run tests in fallback mode (Langfuse disabled)
    unit        Run only unit tests
    build       Build the test environment
    clean       Clean up Docker resources
    logs        Show logs from the test environment
    status      Check the status of services

OPTIONS:
    -h, --help      Show this help message
    -v, --verbose   Enable verbose output
    -d, --detach    Run in detached mode (background)
    --no-cache      Build without Docker cache

EXAMPLES:
    $0 full                 # Run complete test suite
    $0 fallback            # Test graceful degradation
    $0 build --no-cache    # Rebuild from scratch
    $0 logs                # View test logs
    $0 clean               # Clean up resources

EOF
}

# Parse command line arguments
VERBOSE=false
DETACH=false
NO_CACHE=""
COMMAND="full"

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -d|--detach)
            DETACH=true
            shift
            ;;
        --no-cache)
            NO_CACHE="--no-cache"
            shift
            ;;
        full|fallback|unit|build|clean|logs|status)
            COMMAND=$1
            shift
            ;;
        *)
            error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Change to project root
cd "${PROJECT_ROOT}"

# Ensure Docker is running
if ! docker info &> /dev/null; then
    error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Function to run Docker Compose commands
run_compose() {
    local cmd="$1"
    shift
    
    if [[ "$VERBOSE" == "true" ]]; then
        docker-compose -f "$COMPOSE_FILE" "$cmd" "$@"
    else
        docker-compose -f "$COMPOSE_FILE" "$cmd" "$@" 2>/dev/null
    fi
}

# Function to wait for services
wait_for_services() {
    log "Waiting for services to be ready..."
    
    local max_attempts=30
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if run_compose ps | grep -q "healthy"; then
            success "Services are ready"
            return 0
        fi
        
        log "Attempt $attempt/$max_attempts - waiting for services..."
        sleep 2
        ((attempt++))
    done
    
    error "Services failed to start within $max_attempts attempts"
    return 1
}

# Function to collect test results
collect_results() {
    log "Collecting test results..."
    
    local results_dir="${PROJECT_ROOT}/test-results"
    mkdir -p "$results_dir"
    
    # Copy results from Docker volume
    local container_id=$(docker-compose -f "$COMPOSE_FILE" ps -q langfuse-wrapper-test 2>/dev/null || echo "")
    
    if [[ -n "$container_id" ]]; then
        docker cp "${container_id}:/app/test-results/." "$results_dir/" 2>/dev/null || true
        
        if [[ -f "$results_dir/test-summary.txt" ]]; then
            log "Test Summary:"
            cat "$results_dir/test-summary.txt"
        fi
        
        if [[ -f "$results_dir/langfuse-wrapper-test-report.json" ]]; then
            success "Detailed test report available at: $results_dir/langfuse-wrapper-test-report.json"
        fi
    else
        warning "Could not find test container to collect results"
    fi
}

# Command implementations
cmd_full() {
    log "Running full Langfuse wrapper test suite..."
    
    # Start services
    log "Starting test environment..."
    run_compose up -d postgres langfuse-server
    
    if wait_for_services; then
        log "Running comprehensive tests with Langfuse enabled..."
        
        if [[ "$DETACH" == "true" ]]; then
            run_compose up -d langfuse-wrapper-test
        else
            run_compose run --rm langfuse-wrapper-test
        fi
        
        collect_results
        success "Full test suite completed"
    else
        error "Failed to start services"
        exit 1
    fi
}

cmd_fallback() {
    log "Running fallback mode tests (Langfuse disabled)..."
    
    # Override environment to disable Langfuse
    export LANGFUSE_ENABLED_OVERRIDE=false
    
    log "Running tests in graceful degradation mode..."
    
    if [[ "$DETACH" == "true" ]]; then
        run_compose --profile test-fallback up -d wrapper-test-fallback
    else
        run_compose --profile test-fallback run --rm wrapper-test-fallback
    fi
    
    collect_results
    success "Fallback mode tests completed"
}

cmd_unit() {
    log "Running unit tests only..."
    
    # Build the test image
    run_compose build $NO_CACHE langfuse-wrapper-test
    
    # Run just the unit tests
    run_compose run --rm langfuse-wrapper-test npm run test:unit
    
    success "Unit tests completed"
}

cmd_build() {
    log "Building test environment..."
    
    run_compose build $NO_CACHE
    
    success "Build completed"
}

cmd_clean() {
    log "Cleaning up Docker resources..."
    
    # Stop all services
    run_compose down -v --remove-orphans
    
    # Remove images
    docker-compose -f "$COMPOSE_FILE" down --rmi local 2>/dev/null || true
    
    # Clean up test results
    if [[ -d "${PROJECT_ROOT}/test-results" ]]; then
        rm -rf "${PROJECT_ROOT}/test-results"
        log "Removed test results directory"
    fi
    
    success "Cleanup completed"
}

cmd_logs() {
    log "Showing logs from test environment..."
    
    if [[ "$VERBOSE" == "true" ]]; then
        run_compose logs -f
    else
        run_compose logs -f langfuse-wrapper-test
    fi
}

cmd_status() {
    log "Checking service status..."
    
    echo ""
    echo "Service Status:"
    echo "==============="
    run_compose ps
    
    echo ""
    echo "Health Checks:"
    echo "=============="
    
    # Check Langfuse
    if curl -f http://localhost:3000/api/public/health &>/dev/null; then
        success "Langfuse server is healthy"
    else
        warning "Langfuse server is not responding"
    fi
    
    # Check PostgreSQL
    if docker-compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U langfuse &>/dev/null; then
        success "PostgreSQL is healthy"
    else
        warning "PostgreSQL is not responding"
    fi
}

# Execute the command
case $COMMAND in
    full)
        cmd_full
        ;;
    fallback)
        cmd_fallback
        ;;
    unit)
        cmd_unit
        ;;
    build)
        cmd_build
        ;;
    clean)
        cmd_clean
        ;;
    logs)
        cmd_logs
        ;;
    status)
        cmd_status
        ;;
    *)
        error "Unknown command: $COMMAND"
        show_help
        exit 1
        ;;
esac

# Cleanup on exit
trap 'cmd_clean' EXIT