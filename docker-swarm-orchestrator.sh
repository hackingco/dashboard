#!/bin/bash
# Claude Flow Docker Swarm Orchestrator
# This script manages the complete Claude Flow stack with swarm mode

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
STACK_NAME="claude-flow"
COMPOSE_FILE="docker-compose.claude-flow.yml"
ENV_FILE=".env"
SWARM_NETWORK="claude-flow-network"

# Functions
print_header() {
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

check_prerequisites() {
    print_header "Checking Prerequisites"
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        exit 1
    fi
    print_success "Docker is installed"
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        print_error "Docker Compose is not installed"
        exit 1
    fi
    print_success "Docker Compose is installed"
    
    # Check if .env exists
    if [ ! -f "$ENV_FILE" ]; then
        print_warning ".env file not found, copying from .env.claude-flow.example"
        cp .env.claude-flow.example .env
        print_warning "Please update .env with your configuration values"
        exit 1
    fi
    print_success ".env file exists"
}

init_swarm() {
    print_header "Initializing Docker Swarm"
    
    if docker info | grep -q "Swarm: active"; then
        print_success "Docker Swarm is already initialized"
    else
        docker swarm init
        print_success "Docker Swarm initialized"
    fi
    
    # Create overlay network
    if docker network ls | grep -q "$SWARM_NETWORK"; then
        print_success "Network $SWARM_NETWORK already exists"
    else
        docker network create --driver overlay --attachable "$SWARM_NETWORK"
        print_success "Created overlay network: $SWARM_NETWORK"
    fi
}

build_images() {
    print_header "Building Docker Images"
    
    # Build all images
    docker compose -f "$COMPOSE_FILE" build --parallel
    print_success "All images built successfully"
}

deploy_stack() {
    print_header "Deploying Claude Flow Stack"
    
    # Convert docker-compose to stack deploy
    docker stack deploy -c "$COMPOSE_FILE" "$STACK_NAME"
    print_success "Stack deployed as: $STACK_NAME"
    
    # Wait for services to be ready
    print_header "Waiting for Services to Start"
    sleep 10
    
    # Check service status
    docker stack services "$STACK_NAME"
}

scale_workers() {
    local replicas=${1:-3}
    print_header "Scaling Workers to $replicas replicas"
    
    docker service scale "${STACK_NAME}_worker=$replicas"
    print_success "Workers scaled to $replicas replicas"
}

show_status() {
    print_header "Stack Status"
    
    echo -e "\n${BLUE}Services:${NC}"
    docker stack services "$STACK_NAME"
    
    echo -e "\n${BLUE}Running Containers:${NC}"
    docker stack ps "$STACK_NAME" --no-trunc
    
    echo -e "\n${BLUE}Access URLs:${NC}"
    echo "Dashboard: http://localhost:3000"
    echo "API: http://localhost:8080"
    echo "Langfuse: http://localhost:3001"
    echo "Prometheus: http://localhost:9090"
    echo "Grafana: http://localhost:3002"
    echo "Health Check: http://localhost:8888"
}

stop_stack() {
    print_header "Stopping Claude Flow Stack"
    
    docker stack rm "$STACK_NAME"
    print_success "Stack stopped"
}

cleanup() {
    print_header "Cleaning Up"
    
    # Remove stack
    docker stack rm "$STACK_NAME" 2>/dev/null || true
    
    # Remove unused images
    docker image prune -f
    
    # Remove unused volumes (careful with this)
    read -p "Remove unused volumes? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker volume prune -f
    fi
    
    print_success "Cleanup completed"
}

logs() {
    local service=${1:-""}
    
    if [ -z "$service" ]; then
        print_header "Showing logs for all services"
        docker stack services "$STACK_NAME" --format "table {{.Name}}" | tail -n +2 | while read svc; do
            echo -e "\n${BLUE}=== Logs for $svc ===${NC}"
            docker service logs "$svc" --tail 50
        done
    else
        print_header "Showing logs for $service"
        docker service logs "${STACK_NAME}_${service}" --follow
    fi
}

health_check() {
    print_header "Health Check"
    
    # Check each service
    services=("manager" "dashboard" "worker" "langfuse" "redis" "postgres")
    
    for service in "${services[@]}"; do
        if docker service ls | grep -q "${STACK_NAME}_${service}"; then
            replicas=$(docker service ls --filter "name=${STACK_NAME}_${service}" --format "{{.Replicas}}")
            echo -e "${service}: ${GREEN}${replicas}${NC}"
        else
            echo -e "${service}: ${RED}Not running${NC}"
        fi
    done
    
    # Test endpoints
    echo -e "\n${BLUE}Testing Endpoints:${NC}"
    
    endpoints=(
        "http://localhost:8080/health:Manager API"
        "http://localhost:3000/api/health:Dashboard"
        "http://localhost:3001/api/health:Langfuse"
        "http://localhost:8888:Swarm Agent"
    )
    
    for endpoint in "${endpoints[@]}"; do
        IFS=':' read -r url name <<< "$endpoint"
        if curl -s -f "$url" > /dev/null 2>&1; then
            echo -e "$name: ${GREEN}✓ Healthy${NC}"
        else
            echo -e "$name: ${RED}✗ Unreachable${NC}"
        fi
    done
}

# Main menu
case "${1:-help}" in
    init)
        check_prerequisites
        init_swarm
        ;;
    build)
        check_prerequisites
        build_images
        ;;
    deploy)
        check_prerequisites
        init_swarm
        build_images
        deploy_stack
        sleep 15
        show_status
        ;;
    scale)
        scale_workers "${2:-3}"
        ;;
    status)
        show_status
        ;;
    health)
        health_check
        ;;
    logs)
        logs "$2"
        ;;
    stop)
        stop_stack
        ;;
    cleanup)
        cleanup
        ;;
    restart)
        stop_stack
        sleep 5
        deploy_stack
        ;;
    help|*)
        print_header "Claude Flow Docker Swarm Orchestrator"
        echo "Usage: $0 [command] [options]"
        echo ""
        echo "Commands:"
        echo "  init      Initialize Docker Swarm mode"
        echo "  build     Build all Docker images"
        echo "  deploy    Deploy the complete stack"
        echo "  scale N   Scale worker services (default: 3)"
        echo "  status    Show stack status and URLs"
        echo "  health    Run health checks on all services"
        echo "  logs [service]  Show logs (all services or specific)"
        echo "  stop      Stop the stack"
        echo "  restart   Restart the stack"
        echo "  cleanup   Remove stack and cleanup resources"
        echo "  help      Show this help message"
        echo ""
        echo "Examples:"
        echo "  $0 deploy          # Deploy everything"
        echo "  $0 scale 5         # Scale to 5 workers"
        echo "  $0 logs worker     # Show worker logs"
        echo "  $0 health          # Check service health"
        ;;
esac