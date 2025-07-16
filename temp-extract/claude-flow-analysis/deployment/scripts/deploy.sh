#!/bin/bash

# Claude Flow Deployment Script
# Supports Docker Compose and Kubernetes deployments

set -euo pipefail

# Default values
ENVIRONMENT="production"
DEPLOYMENT_TYPE="docker"
CONFIG_DIR="$(dirname "$0")/../"
FORCE_REBUILD=false
DRY_RUN=false
VERBOSE=false

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
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

# Usage function
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Deploy Claude Flow ecosystem to production, staging, or development.

OPTIONS:
    -e, --environment ENV    Environment (production|staging|development) [default: production]
    -t, --type TYPE         Deployment type (docker|kubernetes) [default: docker]
    -f, --force            Force rebuild of all containers
    -d, --dry-run          Show what would be deployed without executing
    -v, --verbose          Enable verbose output
    -h, --help             Show this help message

EXAMPLES:
    $0                                    # Deploy to production using Docker
    $0 -e staging -t kubernetes          # Deploy to staging using Kubernetes
    $0 -e development -f                  # Deploy to development, force rebuild
    $0 -d -v                             # Dry run with verbose output

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -t|--type)
            DEPLOYMENT_TYPE="$2"
            shift 2
            ;;
        -f|--force)
            FORCE_REBUILD=true
            shift
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(production|staging|development)$ ]]; then
    log_error "Invalid environment: $ENVIRONMENT"
    log_error "Must be one of: production, staging, development"
    exit 1
fi

# Validate deployment type
if [[ ! "$DEPLOYMENT_TYPE" =~ ^(docker|kubernetes)$ ]]; then
    log_error "Invalid deployment type: $DEPLOYMENT_TYPE"
    log_error "Must be one of: docker, kubernetes"
    exit 1
fi

# Set verbose mode
if [[ "$VERBOSE" == "true" ]]; then
    set -x
fi

log_info "Starting Claude Flow deployment..."
log_info "Environment: $ENVIRONMENT"
log_info "Deployment Type: $DEPLOYMENT_TYPE"
log_info "Force Rebuild: $FORCE_REBUILD"
log_info "Dry Run: $DRY_RUN"

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if [[ "$DEPLOYMENT_TYPE" == "docker" ]]; then
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
    fi
    
    if [[ "$DEPLOYMENT_TYPE" == "kubernetes" ]]; then
        if ! command -v kubectl &> /dev/null; then
            log_error "kubectl is not installed or not in PATH"
            exit 1
        fi
        
        # Check Kubernetes connection
        if ! kubectl cluster-info &> /dev/null; then
            log_error "Cannot connect to Kubernetes cluster"
            exit 1
        fi
    fi
    
    log_success "Prerequisites check passed"
}

# Load environment configuration
load_environment() {
    local env_file="${CONFIG_DIR}/environments/.env.${ENVIRONMENT}"
    
    if [[ ! -f "$env_file" ]]; then
        log_error "Environment file not found: $env_file"
        exit 1
    fi
    
    log_info "Loading environment configuration from $env_file"
    
    # Source the environment file
    set -a
    source "$env_file"
    set +a
    
    log_success "Environment configuration loaded"
}

# Deploy using Docker Compose
deploy_docker() {
    log_info "Deploying using Docker Compose..."
    
    local compose_file="${CONFIG_DIR}/infrastructure/docker-compose.${ENVIRONMENT}.yml"
    local override_file="${CONFIG_DIR}/infrastructure/docker-compose.override.yml"
    
    if [[ ! -f "$compose_file" ]]; then
        log_error "Compose file not found: $compose_file"
        exit 1
    fi
    
    local compose_args="-f $compose_file"
    
    if [[ -f "$override_file" ]]; then
        compose_args="$compose_args -f $override_file"
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "Dry run - would execute: docker-compose $compose_args config"
        docker-compose $compose_args config
        return
    fi
    
    # Build containers if force rebuild or first deployment
    if [[ "$FORCE_REBUILD" == "true" ]]; then
        log_info "Building containers..."
        docker-compose $compose_args build --no-cache
    fi
    
    # Start services
    log_info "Starting services..."
    docker-compose $compose_args up -d
    
    # Wait for services to be healthy
    log_info "Waiting for services to be healthy..."
    sleep 30
    
    # Verify deployment
    verify_docker_deployment "$compose_args"
}

# Deploy using Kubernetes
deploy_kubernetes() {
    log_info "Deploying using Kubernetes..."
    
    local k8s_dir="${CONFIG_DIR}/kubernetes"
    
    if [[ ! -d "$k8s_dir" ]]; then
        log_error "Kubernetes manifests directory not found: $k8s_dir"
        exit 1
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "Dry run - would apply Kubernetes manifests:"
        kubectl apply --dry-run=client -f "$k8s_dir/" -R
        return
    fi
    
    # Apply manifests in order
    log_info "Creating namespaces..."
    kubectl apply -f "$k8s_dir/namespace.yaml"
    
    log_info "Creating secrets..."
    kubectl apply -f "$k8s_dir/secrets.yaml"
    
    log_info "Creating config maps..."
    kubectl apply -f "$k8s_dir/configmaps.yaml"
    
    log_info "Deploying storage..."
    kubectl apply -f "$k8s_dir/storage/"
    
    log_info "Deploying applications..."
    kubectl apply -f "$k8s_dir/" -R
    
    # Wait for deployments
    log_info "Waiting for deployments to be ready..."
    kubectl wait --for=condition=available --timeout=600s deployment --all -n claude-flow
    
    # Verify deployment
    verify_kubernetes_deployment
}

# Verify Docker deployment
verify_docker_deployment() {
    local compose_args="$1"
    
    log_info "Verifying Docker deployment..."
    
    # Check container status
    local failed_containers=$(docker-compose $compose_args ps --filter "status=exited" -q)
    
    if [[ -n "$failed_containers" ]]; then
        log_error "Some containers failed to start:"
        docker-compose $compose_args ps
        exit 1
    fi
    
    # Check health endpoints
    local health_checks=(
        "http://localhost:8080/health:Claude Flow"
        "http://localhost:3000/api/public/health:Langfuse"
        "http://localhost:9090/-/healthy:Prometheus"
        "http://localhost:3001/api/health:Grafana"
    )
    
    for check in "${health_checks[@]}"; do
        local url=$(echo "$check" | cut -d: -f1-2)
        local service=$(echo "$check" | cut -d: -f3)
        
        log_info "Checking $service health..."
        
        local retries=0
        local max_retries=30
        
        while [[ $retries -lt $max_retries ]]; do
            if curl -f -s "$url" > /dev/null; then
                log_success "$service is healthy"
                break
            fi
            
            retries=$((retries + 1))
            log_info "Waiting for $service (attempt $retries/$max_retries)..."
            sleep 10
        done
        
        if [[ $retries -eq $max_retries ]]; then
            log_error "$service health check failed"
            exit 1
        fi
    done
    
    log_success "Docker deployment verification completed"
}

# Verify Kubernetes deployment
verify_kubernetes_deployment() {
    log_info "Verifying Kubernetes deployment..."
    
    # Check pod status
    local failed_pods=$(kubectl get pods -n claude-flow --field-selector=status.phase!=Running,status.phase!=Succeeded -o name)
    
    if [[ -n "$failed_pods" ]]; then
        log_error "Some pods are not running:"
        kubectl get pods -n claude-flow
        exit 1
    fi
    
    # Check service endpoints
    log_info "Checking service endpoints..."
    kubectl get endpoints -n claude-flow
    
    log_success "Kubernetes deployment verification completed"
}

# Cleanup function
cleanup() {
    if [[ "$DRY_RUN" == "false" ]]; then
        log_info "Deployment completed. Check logs for any issues."
        log_info "Use './scripts/status.sh' to monitor the deployment."
    fi
}

# Main execution
main() {
    trap cleanup EXIT
    
    check_prerequisites
    load_environment
    
    case "$DEPLOYMENT_TYPE" in
        docker)
            deploy_docker
            ;;
        kubernetes)
            deploy_kubernetes
            ;;
        *)
            log_error "Unsupported deployment type: $DEPLOYMENT_TYPE"
            exit 1
            ;;
    esac
    
    log_success "Deployment completed successfully!"
    
    if [[ "$ENVIRONMENT" == "production" ]]; then
        log_warning "Production deployment complete. Monitor metrics at:"
        log_warning "  - Grafana: http://your-domain.com/grafana"
        log_warning "  - Prometheus: http://your-domain.com/prometheus"
        log_warning "  - Claude Flow: http://your-domain.com"
    fi
}

# Run main function
main "$@"