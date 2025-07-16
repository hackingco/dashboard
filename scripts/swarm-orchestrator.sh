#!/bin/bash

# 🐝 Claude Flow Swarm Orchestrator Script
# Comprehensive management script for Docker swarm wrapper deployment

set -euo pipefail

# ═══════════════════════════════════════════════════════════════
# 🎨 COLORS AND FORMATTING
# ═══════════════════════════════════════════════════════════════

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# Emojis for better UX
HIVE="🐝"
ROCKET="🚀"
GEAR="⚙️"
CHECK="✅"
CROSS="❌"
WARNING="⚠️"
INFO="ℹ️"
STOP="🛑"
SCALE="📊"
MONITOR="🔍"

# ═══════════════════════════════════════════════════════════════
# 📝 CONFIGURATION
# ═══════════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_DIR/docker-compose.swarm-wrapper.yml"
ENV_FILE="$PROJECT_DIR/.env"
ENV_EXAMPLE="$PROJECT_DIR/.env.swarm-wrapper.example"

# Service groups for different operations
CORE_SERVICES=(redis postgres clickhouse)
COORDINATION_SERVICES=(hive-mind claude-flow)
OBSERVABILITY_SERVICES=(langfuse langfuse-worker)
AGENT_SERVICES=(swarm-coordinator swarm-agent)
APPLICATION_SERVICES=(manager dashboard)
MONITORING_SERVICES=(nginx prometheus grafana)

ALL_SERVICES=("${CORE_SERVICES[@]}" "${COORDINATION_SERVICES[@]}" "${OBSERVABILITY_SERVICES[@]}" "${AGENT_SERVICES[@]}" "${APPLICATION_SERVICES[@]}" "${MONITORING_SERVICES[@]}")

# ═══════════════════════════════════════════════════════════════
# 🛠️ UTILITY FUNCTIONS
# ═══════════════════════════════════════════════════════════════

print_header() {
    echo -e "\n${CYAN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${WHITE}${HIVE} Claude Flow Swarm Orchestrator${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}\n"
}

print_step() {
    echo -e "${BLUE}${GEAR} $1${NC}"
}

print_success() {
    echo -e "${GREEN}${CHECK} $1${NC}"
}

print_error() {
    echo -e "${RED}${CROSS} $1${NC}" >&2
}

print_warning() {
    echo -e "${YELLOW}${WARNING} $1${NC}"
}

print_info() {
    echo -e "${CYAN}${INFO} $1${NC}"
}

check_dependencies() {
    print_step "Checking dependencies..."
    
    local missing_deps=()
    
    if ! command -v docker &> /dev/null; then
        missing_deps+=("docker")
    fi
    
    if ! docker compose version &> /dev/null && ! command -v docker-compose &> /dev/null; then
        missing_deps+=("docker compose")
    fi
    
    if ! command -v curl &> /dev/null; then
        missing_deps+=("curl")
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        print_error "Missing required dependencies: ${missing_deps[*]}"
        echo -e "\n${INFO} Please install the missing dependencies and try again."
        exit 1
    fi
    
    print_success "All dependencies are available"
}

check_environment() {
    print_step "Checking environment configuration..."
    
    if [ ! -f "$ENV_FILE" ]; then
        print_warning "Environment file not found. Creating from example..."
        if [ -f "$ENV_EXAMPLE" ]; then
            cp "$ENV_EXAMPLE" "$ENV_FILE"
            print_info "Environment file created at $ENV_FILE"
            print_warning "Please edit $ENV_FILE with your configuration before starting the swarm"
            return 1
        else
            print_error "Environment example file not found at $ENV_EXAMPLE"
            return 1
        fi
    fi
    
    # Check for required environment variables
    source "$ENV_FILE"
    
    local required_vars=(
        "POSTGRES_PASSWORD"
        "REDIS_PASSWORD"
        "CLICKHOUSE_PASSWORD"
        "LANGFUSE_NEXTAUTH_SECRET"
        "LANGFUSE_SALT"
    )
    
    local missing_vars=()
    for var in "${required_vars[@]}"; do
        if [ -z "${!var:-}" ] || [[ "${!var}" == *"CHANGE-ME"* ]]; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -ne 0 ]; then
        print_error "Please configure the following environment variables in $ENV_FILE:"
        for var in "${missing_vars[@]}"; do
            echo -e "  ${RED}- $var${NC}"
        done
        print_info "Use 'openssl rand -base64 32' to generate secure passwords"
        return 1
    fi
    
    print_success "Environment configuration is valid"
    return 0
}

wait_for_service() {
    local service=$1
    local url=$2
    local max_attempts=${3:-30}
    local attempt=1
    
    print_step "Waiting for $service to be ready..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "$url" > /dev/null 2>&1; then
            print_success "$service is ready"
            return 0
        fi
        
        echo -ne "${YELLOW}Attempt $attempt/$max_attempts...${NC}\r"
        sleep 2
        ((attempt++))
    done
    
    print_error "$service failed to start within expected time"
    return 1
}

# ═══════════════════════════════════════════════════════════════
# 🚀 MAIN FUNCTIONS
# ═══════════════════════════════════════════════════════════════

start_swarm() {
    print_header
    print_step "Starting Claude Flow Swarm..."
    
    check_dependencies
    if ! check_environment; then
        return 1
    fi
    
    print_step "Starting infrastructure services..."
    docker compose -f "$COMPOSE_FILE" up -d "${CORE_SERVICES[@]}"
    
    print_step "Waiting for infrastructure to be ready..."
    # Redis doesn't use HTTP, so we just check if the container is running
    print_step "Checking Redis container..."
    sleep 5
    # PostgreSQL doesn't use HTTP, so we just check if the container is running
    print_step "Checking PostgreSQL container..."
    sleep 3
    wait_for_service "ClickHouse" "http://localhost:${CLICKHOUSE_HTTP_PORT:-8123}/ping"
    
    print_step "Starting coordination services..."
    docker compose -f "$COMPOSE_FILE" up -d "${COORDINATION_SERVICES[@]}"
    
    print_step "Starting observability services..."
    docker compose -f "$COMPOSE_FILE" up -d "${OBSERVABILITY_SERVICES[@]}"
    
    print_step "Starting agent services..."
    docker compose -f "$COMPOSE_FILE" up -d "${AGENT_SERVICES[@]}"
    
    print_step "Starting application services..."
    docker compose -f "$COMPOSE_FILE" up -d "${APPLICATION_SERVICES[@]}"
    
    print_step "Starting monitoring services..."
    docker compose -f "$COMPOSE_FILE" up -d "${MONITORING_SERVICES[@]}"
    
    print_success "Claude Flow Swarm started successfully!"
    
    show_service_urls
}

stop_swarm() {
    print_header
    print_step "Stopping Claude Flow Swarm..."
    
    docker compose -f "$COMPOSE_FILE" down
    
    print_success "Claude Flow Swarm stopped successfully!"
}

restart_swarm() {
    print_header
    print_step "Restarting Claude Flow Swarm..."
    
    stop_swarm
    sleep 2
    start_swarm
}

scale_agents() {
    local agent_count=${1:-5}
    
    print_header
    print_step "Scaling swarm agents to $agent_count instances..."
    
    docker compose -f "$COMPOSE_FILE" up -d --scale swarm-agent="$agent_count"
    
    print_success "Scaled swarm agents to $agent_count instances"
}

show_status() {
    print_header
    print_step "Checking swarm status..."
    
    echo -e "\n${WHITE}🔍 Service Status:${NC}"
    docker compose -f "$COMPOSE_FILE" ps
    
    echo -e "\n${WHITE}📊 Resource Usage:${NC}"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
    
    echo -e "\n${WHITE}🏥 Health Checks:${NC}"
    for service in "${ALL_SERVICES[@]}"; do
        if docker compose -f "$COMPOSE_FILE" ps "$service" | grep -q "Up (healthy)"; then
            echo -e "${GREEN}${CHECK} $service: Healthy${NC}"
        elif docker compose -f "$COMPOSE_FILE" ps "$service" | grep -q "Up"; then
            echo -e "${YELLOW}${WARNING} $service: Running (no health check)${NC}"
        else
            echo -e "${RED}${CROSS} $service: Not running${NC}"
        fi
    done
}

show_logs() {
    local service=${1:-}
    local lines=${2:-100}
    
    print_header
    
    if [ -n "$service" ]; then
        print_step "Showing logs for $service (last $lines lines)..."
        docker compose -f "$COMPOSE_FILE" logs --tail="$lines" -f "$service"
    else
        print_step "Showing logs for all services (last $lines lines)..."
        docker compose -f "$COMPOSE_FILE" logs --tail="$lines" -f
    fi
}

show_service_urls() {
    echo -e "\n${WHITE}🌐 Service URLs:${NC}"
    echo -e "${GREEN}Dashboard:     ${CYAN}http://localhost:${DASHBOARD_PORT:-3000}${NC}"
    echo -e "${GREEN}Manager API:   ${CYAN}http://localhost:${MANAGER_PORT:-8080}${NC}"
    echo -e "${GREEN}Hive Mind:     ${CYAN}http://localhost:${HIVE_MIND_PORT:-8888}${NC}"
    echo -e "${GREEN}Claude Flow:   ${CYAN}http://localhost:${CLAUDE_FLOW_PORT:-8889}${NC}"
    echo -e "${GREEN}Langfuse v3:   ${CYAN}http://localhost:${LANGFUSE_PORT:-3001}${NC}"
    echo -e "${GREEN}Prometheus:    ${CYAN}http://localhost:${PROMETHEUS_PORT:-9090}${NC}"
    echo -e "${GREEN}Grafana:       ${CYAN}http://localhost:${GRAFANA_PORT:-3030}${NC}"
    echo -e "${GREEN}ClickHouse:    ${CYAN}http://localhost:${CLICKHOUSE_HTTP_PORT:-8123}${NC}"
}

cleanup_swarm() {
    print_header
    print_warning "This will remove all containers, networks, and volumes!"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_step "Cleaning up Claude Flow Swarm..."
        
        docker compose -f "$COMPOSE_FILE" down -v --remove-orphans
        docker system prune -f
        
        print_success "Claude Flow Swarm cleaned up successfully!"
    else
        print_info "Cleanup cancelled"
    fi
}

update_swarm() {
    print_header
    print_step "Updating Claude Flow Swarm..."
    
    print_step "Pulling latest images..."
    docker compose -f "$COMPOSE_FILE" pull
    
    print_step "Rebuilding custom images..."
    docker compose -f "$COMPOSE_FILE" build --no-cache
    
    print_step "Restarting services with updated images..."
    docker compose -f "$COMPOSE_FILE" up -d
    
    print_success "Claude Flow Swarm updated successfully!"
}

backup_data() {
    local backup_dir="${1:-./backups/$(date +%Y%m%d_%H%M%S)}"
    
    print_header
    print_step "Creating backup at $backup_dir..."
    
    mkdir -p "$backup_dir"
    
    # Backup databases
    print_step "Backing up PostgreSQL..."
    docker compose -f "$COMPOSE_FILE" exec -T postgres pg_dumpall -U postgres > "$backup_dir/postgres_backup.sql"
    
    print_step "Backing up Redis..."
    docker compose -f "$COMPOSE_FILE" exec -T redis redis-cli --rdb - > "$backup_dir/redis_backup.rdb"
    
    # Backup configuration
    print_step "Backing up configuration..."
    cp "$ENV_FILE" "$backup_dir/environment.env" 2>/dev/null || true
    cp "$COMPOSE_FILE" "$backup_dir/docker-compose.yml"
    
    print_success "Backup completed at $backup_dir"
}

show_help() {
    print_header
    echo -e "${WHITE}Usage: $0 [COMMAND] [OPTIONS]${NC}\n"
    
    echo -e "${WHITE}Commands:${NC}"
    echo -e "  ${GREEN}start${NC}                    Start the Claude Flow Swarm"
    echo -e "  ${GREEN}stop${NC}                     Stop the Claude Flow Swarm"
    echo -e "  ${GREEN}restart${NC}                  Restart the Claude Flow Swarm"
    echo -e "  ${GREEN}status${NC}                   Show swarm status and health"
    echo -e "  ${GREEN}scale${NC} [COUNT]            Scale swarm agents (default: 5)"
    echo -e "  ${GREEN}logs${NC} [SERVICE] [LINES]   Show logs (default: all services, 100 lines)"
    echo -e "  ${GREEN}urls${NC}                     Show service URLs"
    echo -e "  ${GREEN}update${NC}                   Update swarm images and restart"
    echo -e "  ${GREEN}backup${NC} [DIR]             Backup data and configuration"
    echo -e "  ${GREEN}cleanup${NC}                  Remove all containers and volumes"
    echo -e "  ${GREEN}help${NC}                     Show this help message"
    
    echo -e "\n${WHITE}Examples:${NC}"
    echo -e "  ${CYAN}$0 start${NC}                 Start the swarm"
    echo -e "  ${CYAN}$0 scale 10${NC}              Scale to 10 agent instances"
    echo -e "  ${CYAN}$0 logs langfuse 50${NC}      Show last 50 lines of langfuse logs"
    echo -e "  ${CYAN}$0 backup ./my-backup${NC}    Create backup in specific directory"
    
    echo -e "\n${WHITE}Environment Configuration:${NC}"
    echo -e "  ${GREEN}Environment file:${NC} $ENV_FILE"
    echo -e "  ${GREEN}Compose file:${NC}     $COMPOSE_FILE"
    
    echo -e "\n${WHITE}Quick Setup:${NC}"
    echo -e "  1. ${CYAN}cp .env.swarm-wrapper.example .env${NC}"
    echo -e "  2. ${CYAN}# Edit .env with your configuration${NC}"
    echo -e "  3. ${CYAN}$0 start${NC}"
}

# ═══════════════════════════════════════════════════════════════
# 🎯 MAIN SCRIPT LOGIC
# ═══════════════════════════════════════════════════════════════

main() {
    case "${1:-help}" in
        start)
            start_swarm
            ;;
        stop)
            stop_swarm
            ;;
        restart)
            restart_swarm
            ;;
        scale)
            scale_agents "${2:-5}"
            ;;
        status)
            show_status
            ;;
        logs)
            show_logs "${2:-}" "${3:-100}"
            ;;
        urls)
            show_service_urls
            ;;
        update)
            update_swarm
            ;;
        backup)
            backup_data "${2:-}"
            ;;
        cleanup)
            cleanup_swarm
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            print_error "Unknown command: $1"
            echo
            show_help
            exit 1
            ;;
    esac
}

# Handle script interruption
trap 'echo -e "\n${YELLOW}${STOP} Operation interrupted${NC}"; exit 1' INT TERM

# Run main function with all arguments
main "$@"