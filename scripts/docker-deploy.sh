#!/bin/bash

# Docker Deployment Script for Langfuse Wrapper Testing
# Usage: ./scripts/docker-deploy.sh [command] [options]

set -e

# Configuration
COMPOSE_FILE="docker-compose.langfuse.yml"
ENV_FILE=".env.docker"
PROJECT_NAME="langfuse-swarm-test"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Function to check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed or not in PATH"
        exit 1
    fi
    
    if ! command -v docker compose &> /dev/null && ! docker compose version &> /dev/null; then
        error "Docker Compose is not installed or not in PATH"
        exit 1
    fi
    
    if [ ! -f "$COMPOSE_FILE" ]; then
        error "Compose file $COMPOSE_FILE not found"
        exit 1
    fi
    
    if [ ! -f "$ENV_FILE" ]; then
        warning "Environment file $ENV_FILE not found. Using defaults."
    fi
    
    success "Prerequisites check passed"
}

# Function to start services
start_services() {
    log "Starting Langfuse Swarm services..."
    
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" -p "$PROJECT_NAME" up -d
    
    log "Waiting for services to be healthy..."
    
    # Wait for PostgreSQL
    log "Waiting for PostgreSQL..."
    while ! docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" exec postgres pg_isready -U langfuse -d langfuse > /dev/null 2>&1; do
        sleep 2
        echo -n "."
    done
    echo
    
    # Wait for Langfuse server
    log "Waiting for Langfuse server..."
    while ! curl -f http://localhost:3000/api/public/health > /dev/null 2>&1; do
        sleep 2
        echo -n "."
    done
    echo
    
    # Wait for Swarm Manager
    log "Waiting for Swarm Manager..."
    while ! curl -f http://localhost:8001/health > /dev/null 2>&1; do
        sleep 2
        echo -n "."
    done
    echo
    
    success "All services are running and healthy!"
    
    # Display service status
    show_status
}

# Function to stop services
stop_services() {
    log "Stopping Langfuse Swarm services..."
    docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" down
    success "Services stopped"
}

# Function to restart services
restart_services() {
    log "Restarting Langfuse Swarm services..."
    stop_services
    start_services
}

# Function to show service status
show_status() {
    log "Service Status:"
    echo
    docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" ps
    echo
    
    log "Service URLs:"
    echo "  🔗 Langfuse UI:      http://localhost:3000"
    echo "  🔗 Swarm Manager:    http://localhost:8001"
    echo "  🔗 Swarm Worker 1:   http://localhost:8002"
    echo "  🔗 Swarm Worker 2:   http://localhost:8003"
    echo "  🔗 Redis:            localhost:6379"
    echo "  🔗 PostgreSQL:       localhost:5432"
    echo
}

# Function to run tests
run_tests() {
    log "Running Langfuse wrapper tests..."
    
    # Check if services are running
    if ! docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" ps | grep -q "Up"; then
        error "Services are not running. Please start them first with: $0 start"
        exit 1
    fi
    
    # Run test runner
    docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" --profile testing up test-runner
    
    success "Tests completed"
}

# Function to view logs
view_logs() {
    local service=${1:-""}
    
    if [ -z "$service" ]; then
        log "Following all service logs..."
        docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" logs -f
    else
        log "Following logs for service: $service"
        docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" logs -f "$service"
    fi
}

# Function to clean up
cleanup() {
    log "Cleaning up Docker resources..."
    
    # Stop and remove containers
    docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" down --volumes --remove-orphans
    
    # Remove project-specific volumes (optional)
    read -p "Remove persistent volumes? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker volume ls -q | grep "^${PROJECT_NAME}_" | xargs -r docker volume rm
        success "Volumes removed"
    fi
    
    # Remove unused images (optional)
    read -p "Remove unused Docker images? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker image prune -f
        success "Unused images removed"
    fi
    
    success "Cleanup completed"
}

# Function to setup monitoring
setup_monitoring() {
    log "Setting up monitoring stack..."
    
    # Create monitoring directories
    mkdir -p monitoring/prometheus
    mkdir -p monitoring/grafana/provisioning/datasources
    mkdir -p monitoring/grafana/provisioning/dashboards
    mkdir -p monitoring/grafana/dashboards
    
    # Create Prometheus configuration
    cat > monitoring/prometheus.yml << EOF
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'langfuse-server'
    static_configs:
      - targets: ['langfuse-server:3000']
    metrics_path: '/api/public/metrics'
    
  - job_name: 'swarm-manager'
    static_configs:
      - targets: ['swarm-manager:8001']
    metrics_path: '/metrics'
    
  - job_name: 'swarm-workers'
    static_configs:
      - targets: ['swarm-worker-1:8002', 'swarm-worker-2:8003']
    metrics_path: '/metrics'
EOF
    
    # Start monitoring services
    docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" --profile monitoring up -d
    
    success "Monitoring stack is running!"
    log "Prometheus UI: http://localhost:9090"
    log "Grafana UI: http://localhost:3001 (admin/grafana_secret)"
}

# Function to backup data
backup_data() {
    local backup_dir="backups/$(date +%Y%m%d_%H%M%S)"
    
    log "Creating backup in $backup_dir..."
    
    mkdir -p "$backup_dir"
    
    # Backup PostgreSQL
    docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" exec postgres pg_dump -U langfuse langfuse > "$backup_dir/langfuse_db.sql"
    
    # Backup volumes
    docker run --rm -v "${PROJECT_NAME}_swarm_data:/source:ro" -v "$(pwd)/$backup_dir:/backup" alpine tar czf /backup/swarm_data.tar.gz -C /source .
    docker run --rm -v "${PROJECT_NAME}_langfuse_data:/source:ro" -v "$(pwd)/$backup_dir:/backup" alpine tar czf /backup/langfuse_data.tar.gz -C /source .
    
    success "Backup created in $backup_dir"
}

# Function to restore data
restore_data() {
    local backup_dir="$1"
    
    if [ -z "$backup_dir" ] || [ ! -d "$backup_dir" ]; then
        error "Backup directory not specified or does not exist"
        echo "Usage: $0 restore <backup_directory>"
        exit 1
    fi
    
    log "Restoring data from $backup_dir..."
    
    # Stop services first
    docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" down
    
    # Restore PostgreSQL
    docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" up -d postgres
    sleep 10
    cat "$backup_dir/langfuse_db.sql" | docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" exec -T postgres psql -U langfuse langfuse
    
    # Restore volumes
    docker run --rm -v "${PROJECT_NAME}_swarm_data:/target" -v "$(pwd)/$backup_dir:/backup:ro" alpine tar xzf /backup/swarm_data.tar.gz -C /target
    docker run --rm -v "${PROJECT_NAME}_langfuse_data:/target" -v "$(pwd)/$backup_dir:/backup:ro" alpine tar xzf /backup/langfuse_data.tar.gz -C /target
    
    # Start all services
    start_services
    
    success "Data restored from $backup_dir"
}

# Function to show help
show_help() {
    echo "Docker deployment script for Langfuse Wrapper Testing"
    echo
    echo "Usage: $0 <command> [options]"
    echo
    echo "Commands:"
    echo "  start         Start all services"
    echo "  stop          Stop all services"
    echo "  restart       Restart all services"
    echo "  status        Show service status"
    echo "  test          Run tests"
    echo "  logs [service] Show logs (optionally for specific service)"
    echo "  cleanup       Clean up Docker resources"
    echo "  monitoring    Setup monitoring stack"
    echo "  backup        Backup persistent data"
    echo "  restore <dir> Restore data from backup"
    echo "  help          Show this help message"
    echo
    echo "Examples:"
    echo "  $0 start                  # Start all services"
    echo "  $0 logs langfuse-server   # Show Langfuse server logs"
    echo "  $0 test                   # Run the test suite"
    echo "  $0 cleanup                # Clean up everything"
    echo
}

# Main script logic
main() {
    case "${1:-}" in
        start)
            check_prerequisites
            start_services
            ;;
        stop)
            stop_services
            ;;
        restart)
            check_prerequisites
            restart_services
            ;;
        status)
            show_status
            ;;
        test)
            run_tests
            ;;
        logs)
            view_logs "$2"
            ;;
        cleanup)
            cleanup
            ;;
        monitoring)
            setup_monitoring
            ;;
        backup)
            backup_data
            ;;
        restore)
            restore_data "$2"
            ;;
        help|--help|-h)
            show_help
            ;;
        "")
            error "No command specified"
            show_help
            exit 1
            ;;
        *)
            error "Unknown command: $1"
            show_help
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"