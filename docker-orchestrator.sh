#!/bin/bash

# Docker Swarm Orchestrator
# Simplifies Docker operations for the swarm platform

set -e

# Configuration
COMPOSE_PROJECT_NAME="swarm-platform"
NETWORK_NAME="swarm-network"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

# Function to check if Docker is running
check_docker() {
    if ! docker info >/dev/null 2>&1; then
        error "Docker is not running. Please start Docker and try again."
    fi
}

# Function to check if required files exist
check_files() {
    local compose_file=$1
    if [[ ! -f "$compose_file" ]]; then
        error "Docker compose file not found: $compose_file"
    fi
    
    if [[ ! -f ".env" && ! -f ".env.local" ]]; then
        warn "No .env file found. Using default values."
        info "Consider creating a .env file from .env.production template"
    fi
}

# Function to create network if it doesn't exist
create_network() {
    if ! docker network ls | grep -q "$NETWORK_NAME"; then
        log "Creating Docker network: $NETWORK_NAME"
        docker network create "$NETWORK_NAME" --driver bridge --subnet=172.20.0.0/16
    fi
}

# Function to start services
start_services() {
    local env=$1
    local compose_file="docker-compose.yml"
    
    case $env in
        "dev"|"development")
            compose_file="docker-compose.development.yml"
            ;;
        "prod"|"production")
            compose_file="docker-compose.production.yml"
            ;;
        *)
            warn "Unknown environment: $env. Using default docker-compose.yml"
            ;;
    esac
    
    check_files "$compose_file"
    create_network
    
    log "Starting services with $compose_file..."
    
    # Build and start services
    COMPOSE_PROJECT_NAME="$COMPOSE_PROJECT_NAME" docker-compose -f "$compose_file" build
    COMPOSE_PROJECT_NAME="$COMPOSE_PROJECT_NAME" docker-compose -f "$compose_file" up -d
    
    log "Services started successfully!"
    
    # Show status
    show_status "$compose_file"
}

# Function to stop services
stop_services() {
    local compose_file=${1:-"docker-compose.yml"}
    
    log "Stopping services..."
    COMPOSE_PROJECT_NAME="$COMPOSE_PROJECT_NAME" docker-compose -f "$compose_file" down
    
    log "Services stopped successfully!"
}

# Function to show service status
show_status() {
    local compose_file=${1:-"docker-compose.yml"}
    
    info "Service Status:"
    COMPOSE_PROJECT_NAME="$COMPOSE_PROJECT_NAME" docker-compose -f "$compose_file" ps
    
    info "Service Health:"
    for service in $(COMPOSE_PROJECT_NAME="$COMPOSE_PROJECT_NAME" docker-compose -f "$compose_file" config --services); do
        container_id=$(docker ps -qf "name=${COMPOSE_PROJECT_NAME}-${service}")
        if [[ -n "$container_id" ]]; then
            health=$(docker inspect --format='{{.State.Health.Status}}' "$container_id" 2>/dev/null || echo "no-healthcheck")
            echo "  $service: $health"
        fi
    done
    
    info "Access URLs:"
    echo "  Dashboard: http://localhost:3000"
    echo "  Manager API: http://localhost:8080"
    echo "  API Health: http://localhost:8080/health"
    echo "  Redis: localhost:6379"
}

# Function to view logs
view_logs() {
    local service=$1
    local compose_file=${2:-"docker-compose.yml"}
    
    if [[ -n "$service" ]]; then
        log "Viewing logs for service: $service"
        COMPOSE_PROJECT_NAME="$COMPOSE_PROJECT_NAME" docker-compose -f "$compose_file" logs -f "$service"
    else
        log "Viewing logs for all services"
        COMPOSE_PROJECT_NAME="$COMPOSE_PROJECT_NAME" docker-compose -f "$compose_file" logs -f
    fi
}

# Function to restart specific service
restart_service() {
    local service=$1
    local compose_file=${2:-"docker-compose.yml"}
    
    log "Restarting service: $service"
    COMPOSE_PROJECT_NAME="$COMPOSE_PROJECT_NAME" docker-compose -f "$compose_file" restart "$service"
    log "Service $service restarted successfully!"
}

# Function to clean up Docker resources
cleanup() {
    local deep_clean=$1
    
    log "Cleaning up Docker resources..."
    
    # Stop all containers
    stop_services
    
    # Remove containers and networks
    COMPOSE_PROJECT_NAME="$COMPOSE_PROJECT_NAME" docker-compose down -v
    
    if [[ "$deep_clean" == "deep" ]]; then
        warn "Performing deep cleanup (removes images and volumes)..."
        
        # Remove images
        docker images | grep "$COMPOSE_PROJECT_NAME" | awk '{print $3}' | xargs -r docker rmi -f
        
        # Remove volumes
        docker volume ls | grep "$COMPOSE_PROJECT_NAME" | awk '{print $2}' | xargs -r docker volume rm
        
        # Remove unused resources
        docker system prune -f
    fi
    
    log "Cleanup completed!"
}

# Function to run health checks
health_check() {
    log "Running health checks..."
    
    # Check Redis
    if docker exec -it "${COMPOSE_PROJECT_NAME}-redis-1" redis-cli ping >/dev/null 2>&1; then
        echo "✅ Redis: healthy"
    else
        echo "❌ Redis: unhealthy"
    fi
    
    # Check Manager API
    if curl -f http://localhost:8080/health >/dev/null 2>&1; then
        echo "✅ Manager API: healthy"
    else
        echo "❌ Manager API: unhealthy"
    fi
    
    # Check Dashboard
    if curl -f http://localhost:3000 >/dev/null 2>&1; then
        echo "✅ Dashboard: healthy"
    else
        echo "❌ Dashboard: unhealthy"
    fi
}

# Function to backup data
backup_data() {
    local backup_dir="./backups/$(date +%Y%m%d_%H%M%S)"
    
    log "Creating backup in $backup_dir..."
    mkdir -p "$backup_dir"
    
    # Backup Redis data
    docker exec "${COMPOSE_PROJECT_NAME}-redis-1" redis-cli --rdb /tmp/backup.rdb
    docker cp "${COMPOSE_PROJECT_NAME}-redis-1:/tmp/backup.rdb" "$backup_dir/redis-backup.rdb"
    
    # Backup PostgreSQL data (if running)
    if docker ps | grep -q "${COMPOSE_PROJECT_NAME}-postgres"; then
        docker exec "${COMPOSE_PROJECT_NAME}-postgres-1" pg_dump -U postgres swarm_dev > "$backup_dir/postgres-backup.sql"
    fi
    
    log "Backup completed: $backup_dir"
}

# Function to show help
show_help() {
    cat << EOF
Docker Swarm Orchestrator

USAGE:
    ./docker-orchestrator.sh <command> [options]

COMMANDS:
    start <env>         Start services (env: dev|development|prod|production)
    stop [compose-file] Stop services
    restart <service>   Restart specific service
    status [compose-file] Show service status
    logs [service]      View logs (all services if no service specified)
    health              Run health checks
    cleanup [deep]      Clean up Docker resources (add 'deep' for complete cleanup)
    backup              Backup data volumes
    help                Show this help message

EXAMPLES:
    ./docker-orchestrator.sh start dev           # Start development environment
    ./docker-orchestrator.sh start prod          # Start production environment
    ./docker-orchestrator.sh logs manager        # View manager service logs
    ./docker-orchestrator.sh restart dashboard   # Restart dashboard service
    ./docker-orchestrator.sh cleanup deep        # Deep cleanup of all resources

ENVIRONMENT FILES:
    .env                Default environment
    .env.production     Production template
    .env.local          Local overrides (gitignored)

EOF
}

# Main script logic
main() {
    check_docker
    
    case "${1:-help}" in
        "start")
            start_services "${2:-dev}"
            ;;
        "stop")
            stop_services "$2"
            ;;
        "restart")
            restart_service "$2" "$3"
            ;;
        "status")
            show_status "$2"
            ;;
        "logs")
            view_logs "$2" "$3"
            ;;
        "health")
            health_check
            ;;
        "cleanup")
            cleanup "$2"
            ;;
        "backup")
            backup_data
            ;;
        "help"|*)
            show_help
            ;;
    esac
}

# Run main function with all arguments
main "$@"