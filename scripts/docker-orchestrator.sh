#!/bin/bash

# Docker Orchestrator Script for Claude Flow Swarm
# Manages different deployment scenarios with composable Docker stack

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="${PROJECT_ROOT}/.env"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
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

# Load environment variables
load_env() {
    if [[ -f "$ENV_FILE" ]]; then
        log_info "Loading environment from $ENV_FILE"
        set -o allexport
        source "$ENV_FILE"
        set +o allexport
    else
        log_warning "No .env file found. Using defaults."
    fi
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed or not in PATH"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed or not in PATH"
        exit 1
    fi
    
    # Check Docker daemon
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Display available deployment modes
show_deployment_modes() {
    cat << EOF

Available Deployment Modes:
═══════════════════════════

🏗️  BASIC MODES:
   core          - Core infrastructure only (Redis, PostgreSQL, Hive Mind)
   minimal       - Core + Basic services (Manager, Dashboard, Worker)
   complete      - Core + Services + Langfuse integration
   full          - Complete + Monitoring stack

🚀 SPECIALIZED MODES:
   development   - Development mode with hot reload and debugging tools
   production    - Production-ready with SSL, load balancing, and security
   scaling       - High-availability mode with clustering and replicas
   monitoring    - Observability-focused with full monitoring stack

🧪 TESTING MODES:
   test          - Testing environment with sample data
   langfuse-only - Langfuse + dependencies for tracing evaluation
   services-only - Application services without infrastructure

EOF
}

# Compose file combinations for different modes
get_compose_files() {
    local mode="$1"
    local files=""
    
    case "$mode" in
        "core")
            files="docker-compose.swarm-core.yml"
            ;;
        "minimal")
            files="docker-compose.swarm-core.yml docker-compose.claude-flow-services.yml"
            ;;
        "complete")
            files="docker-compose.swarm-core.yml docker-compose.claude-flow-services.yml docker-compose.langfuse.yml"
            ;;
        "full")
            files="docker-compose.swarm-core.yml docker-compose.claude-flow-services.yml docker-compose.langfuse.yml docker-compose.monitoring.yml"
            ;;
        "development")
            files="docker-compose.swarm-core.yml docker-compose.claude-flow-services.yml docker-compose.langfuse.yml docker-compose.development.override.yml"
            ;;
        "production")
            files="docker-compose.swarm-core.yml docker-compose.claude-flow-services.yml docker-compose.langfuse.yml docker-compose.monitoring.yml"
            ;;
        "scaling")
            files="docker-compose.swarm-core.yml docker-compose.claude-flow-services.yml docker-compose.langfuse.yml docker-compose.scaling.yml"
            ;;
        "monitoring")
            files="docker-compose.swarm-core.yml docker-compose.monitoring.yml"
            ;;
        "test")
            files="docker-compose.swarm-core.yml docker-compose.claude-flow-services.yml docker-compose.development.override.yml"
            ;;
        "langfuse-only")
            files="docker-compose.swarm-core.yml docker-compose.langfuse.yml"
            ;;
        "services-only")
            files="docker-compose.claude-flow-services.yml"
            ;;
        *)
            log_error "Unknown deployment mode: $mode"
            show_deployment_modes
            exit 1
            ;;
    esac
    
    echo "$files"
}

# Build compose command
build_compose_command() {
    local mode="$1"
    local action="$2"
    local files
    local cmd="docker-compose"
    
    files=$(get_compose_files "$mode")
    
    # Add -f flag for each compose file
    for file in $files; do
        if [[ -f "$PROJECT_ROOT/$file" ]]; then
            cmd="$cmd -f $file"
        else
            log_error "Compose file not found: $file"
            exit 1
        fi
    done
    
    cmd="$cmd $action"
    echo "$cmd"
}

# Deploy stack
deploy() {
    local mode="$1"
    local options="${2:-}"
    
    log_info "Deploying in $mode mode..."
    
    cd "$PROJECT_ROOT"
    
    # Build and start services
    local cmd
    cmd=$(build_compose_command "$mode" "up -d $options")
    
    log_info "Running: $cmd"
    eval "$cmd"
    
    # Wait for services to be healthy
    wait_for_health "$mode"
    
    log_success "Deployment completed successfully!"
    show_service_urls "$mode"
}

# Stop stack
stop() {
    local mode="$1"
    
    log_info "Stopping $mode stack..."
    
    cd "$PROJECT_ROOT"
    
    local cmd
    cmd=$(build_compose_command "$mode" "down")
    
    log_info "Running: $cmd"
    eval "$cmd"
    
    log_success "Stack stopped successfully!"
}

# Show status
status() {
    local mode="$1"
    
    cd "$PROJECT_ROOT"
    
    local cmd
    cmd=$(build_compose_command "$mode" "ps")
    
    eval "$cmd"
}

# Show logs
logs() {
    local mode="$1"
    local service="${2:-}"
    local options="${3:--f --tail=100}"
    
    cd "$PROJECT_ROOT"
    
    local cmd
    cmd=$(build_compose_command "$mode" "logs $options $service")
    
    eval "$cmd"
}

# Wait for services to be healthy
wait_for_health() {
    local mode="$1"
    local max_attempts=60
    local attempt=1
    
    log_info "Waiting for services to be healthy..."
    
    while [[ $attempt -le $max_attempts ]]; do
        local healthy=true
        
        # Check core services
        if [[ "$mode" =~ ^(core|minimal|complete|full|development|production|scaling|test|langfuse-only)$ ]]; then
            check_service_health "redis" || healthy=false
            check_service_health "postgres" || healthy=false
        fi
        
        # Check application services
        if [[ "$mode" =~ ^(minimal|complete|full|development|production|scaling|test)$ ]]; then
            check_service_health "manager" || healthy=false
            check_service_health "dashboard" || healthy=false
        fi
        
        # Check Langfuse
        if [[ "$mode" =~ ^(complete|full|development|production|langfuse-only)$ ]]; then
            check_service_health "langfuse" || healthy=false
        fi
        
        if $healthy; then
            log_success "All services are healthy!"
            return 0
        fi
        
        log_info "Attempt $attempt/$max_attempts: Some services not ready yet..."
        sleep 10
        ((attempt++))
    done
    
    log_warning "Timed out waiting for all services to be healthy"
    return 1
}

# Check individual service health
check_service_health() {
    local service="$1"
    local container_name
    
    case "$service" in
        "redis") container_name="swarm-redis" ;;
        "postgres") container_name="swarm-postgres" ;;
        "manager") container_name="swarm-manager" ;;
        "dashboard") container_name="swarm-dashboard" ;;
        "langfuse") container_name="swarm-langfuse" ;;
        "hive-mind") container_name="swarm-hive-mind" ;;
        *) container_name="$service" ;;
    esac
    
    if docker ps --filter "name=$container_name" --filter "health=healthy" --format "table {{.Names}}" | grep -q "$container_name"; then
        return 0
    else
        return 1
    fi
}

# Show service URLs
show_service_urls() {
    local mode="$1"
    
    cat << EOF

🌐 Service URLs:
══════════════

EOF
    
    # Core services URLs
    if [[ "$mode" =~ ^(minimal|complete|full|development|production|scaling|test)$ ]]; then
        echo "📱 Dashboard:     http://localhost:${DASHBOARD_PORT:-3000}"
        echo "🔗 Manager API:   http://localhost:${MANAGER_PORT:-8080}"
        echo "🔗 API Docs:      http://localhost:${MANAGER_PORT:-8080}/docs"
    fi
    
    # Langfuse URLs
    if [[ "$mode" =~ ^(complete|full|development|production|langfuse-only)$ ]]; then
        echo "📊 Langfuse:      http://localhost:${LANGFUSE_PORT:-3001}"
    fi
    
    # Monitoring URLs
    if [[ "$mode" =~ ^(full|monitoring|development)$ ]]; then
        echo "📈 Grafana:       http://localhost:${GRAFANA_PORT:-3002}"
        echo "📊 Prometheus:    http://localhost:${PROMETHEUS_PORT:-9090}"
    fi
    
    # Development tools
    if [[ "$mode" == "development" ]]; then
        echo "🗄️  pgAdmin:       http://localhost:5050"
        echo "🔴 Redis UI:      http://localhost:8081"
        echo "📧 MailHog:       http://localhost:8025"
        echo "📚 Docs:          http://localhost:8082"
    fi
    
    # Scaling tools
    if [[ "$mode" == "scaling" ]]; then
        echo "⚖️  HAProxy Stats: http://localhost:8404"
        echo "🔍 Consul:        http://localhost:8500"
    fi
    
    echo ""
}

# Clean up resources
cleanup() {
    local mode="$1"
    local remove_volumes="${2:-false}"
    
    log_info "Cleaning up $mode stack..."
    
    cd "$PROJECT_ROOT"
    
    local cmd
    if [[ "$remove_volumes" == "true" ]]; then
        cmd=$(build_compose_command "$mode" "down -v --remove-orphans")
        log_warning "This will remove all volumes and data!"
    else
        cmd=$(build_compose_command "$mode" "down --remove-orphans")
    fi
    
    eval "$cmd"
    
    # Clean up dangling images
    if docker images -f "dangling=true" -q | grep -q .; then
        log_info "Removing dangling images..."
        docker rmi $(docker images -f "dangling=true" -q) || true
    fi
    
    log_success "Cleanup completed!"
}

# Backup data
backup() {
    local backup_dir="${PROJECT_ROOT}/backups/$(date +%Y%m%d_%H%M%S)"
    
    log_info "Creating backup in $backup_dir..."
    
    mkdir -p "$backup_dir"
    
    # Backup PostgreSQL
    if docker ps --filter "name=swarm-postgres" --format "table {{.Names}}" | grep -q "swarm-postgres"; then
        log_info "Backing up PostgreSQL..."
        docker exec swarm-postgres pg_dumpall -U "${POSTGRES_USER:-postgres}" > "$backup_dir/postgres_backup.sql"
    fi
    
    # Backup Redis
    if docker ps --filter "name=swarm-redis" --format "table {{.Names}}" | grep -q "swarm-redis"; then
        log_info "Backing up Redis..."
        docker exec swarm-redis redis-cli --rdb - > "$backup_dir/redis_backup.rdb"
    fi
    
    # Backup volumes
    log_info "Backing up volumes..."
    docker run --rm -v swarm-hive-mind-data:/data -v "$backup_dir":/backup alpine tar czf /backup/hive-mind-data.tar.gz -C /data .
    docker run --rm -v swarm-memory-data:/data -v "$backup_dir":/backup alpine tar czf /backup/memory-data.tar.gz -C /data .
    
    log_success "Backup completed: $backup_dir"
}

# Restore data
restore() {
    local backup_dir="$1"
    
    if [[ ! -d "$backup_dir" ]]; then
        log_error "Backup directory not found: $backup_dir"
        exit 1
    fi
    
    log_info "Restoring from backup: $backup_dir"
    
    # Restore PostgreSQL
    if [[ -f "$backup_dir/postgres_backup.sql" ]]; then
        log_info "Restoring PostgreSQL..."
        docker exec -i swarm-postgres psql -U "${POSTGRES_USER:-postgres}" < "$backup_dir/postgres_backup.sql"
    fi
    
    # Restore Redis
    if [[ -f "$backup_dir/redis_backup.rdb" ]]; then
        log_info "Restoring Redis..."
        docker exec -i swarm-redis redis-cli --pipe < "$backup_dir/redis_backup.rdb"
    fi
    
    # Restore volumes
    if [[ -f "$backup_dir/hive-mind-data.tar.gz" ]]; then
        log_info "Restoring hive-mind data..."
        docker run --rm -v swarm-hive-mind-data:/data -v "$backup_dir":/backup alpine tar xzf /backup/hive-mind-data.tar.gz -C /data
    fi
    
    if [[ -f "$backup_dir/memory-data.tar.gz" ]]; then
        log_info "Restoring memory data..."
        docker run --rm -v swarm-memory-data:/data -v "$backup_dir":/backup alpine tar xzf /backup/memory-data.tar.gz -C /data
    fi
    
    log_success "Restore completed!"
}

# Main function
main() {
    local action="${1:-help}"
    local mode="${2:-}"
    
    case "$action" in
        "deploy"|"up")
            if [[ -z "$mode" ]]; then
                log_error "Deployment mode is required"
                show_deployment_modes
                exit 1
            fi
            load_env
            check_prerequisites
            deploy "$mode" "${3:-}"
            ;;
        "stop"|"down")
            if [[ -z "$mode" ]]; then
                log_error "Deployment mode is required"
                show_deployment_modes
                exit 1
            fi
            load_env
            stop "$mode"
            ;;
        "status"|"ps")
            if [[ -z "$mode" ]]; then
                log_error "Deployment mode is required"
                show_deployment_modes
                exit 1
            fi
            load_env
            status "$mode"
            ;;
        "logs")
            if [[ -z "$mode" ]]; then
                log_error "Deployment mode is required"
                show_deployment_modes
                exit 1
            fi
            load_env
            logs "$mode" "${3:-}" "${4:-}"
            ;;
        "cleanup")
            if [[ -z "$mode" ]]; then
                log_error "Deployment mode is required"
                show_deployment_modes
                exit 1
            fi
            load_env
            cleanup "$mode" "${3:-false}"
            ;;
        "backup")
            load_env
            backup
            ;;
        "restore")
            if [[ -z "$mode" ]]; then
                log_error "Backup directory is required"
                exit 1
            fi
            load_env
            restore "$mode"
            ;;
        "modes")
            show_deployment_modes
            ;;
        "help"|*)
            cat << EOF
Claude Flow Docker Orchestrator

Usage: $0 <action> [mode] [options]

Actions:
  deploy|up <mode> [options]    Deploy stack in specified mode
  stop|down <mode>              Stop stack
  status|ps <mode>              Show service status
  logs <mode> [service] [opts]  Show logs
  cleanup <mode> [volumes]      Clean up resources (volumes=true to remove data)
  backup                        Backup data
  restore <backup_dir>          Restore from backup
  modes                         Show available deployment modes
  help                          Show this help

Examples:
  $0 deploy development         # Deploy development environment
  $0 deploy production --build  # Deploy production with rebuild
  $0 logs development manager   # Show manager logs in development
  $0 cleanup development true   # Clean up with volume removal
  $0 backup                     # Create backup
  $0 modes                      # Show deployment modes

EOF
            ;;
    esac
}

# Run main function
main "$@"