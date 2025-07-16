#!/bin/bash

# Claude Flow Rollback Script
# Rollback to previous version or specific version

set -euo pipefail

# Default values
ENVIRONMENT="production"
DEPLOYMENT_TYPE="docker"
TARGET_VERSION=""
DRY_RUN=false
VERBOSE=false
BACKUP_BEFORE_ROLLBACK=true

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

Rollback Claude Flow deployment to a previous version.

OPTIONS:
    -e, --environment ENV    Environment (production|staging|development) [default: production]
    -t, --type TYPE         Deployment type (docker|kubernetes) [default: docker]
    -v, --version VERSION   Target version to rollback to (default: previous)
    -d, --dry-run          Show what would be rolled back without executing
    --verbose              Enable verbose output
    --no-backup            Skip backup before rollback
    -h, --help             Show this help message

EXAMPLES:
    $0                                    # Rollback to previous version
    $0 -e staging -v 1.9.0               # Rollback staging to version 1.9.0
    $0 -t kubernetes --dry-run           # Dry run rollback in Kubernetes

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
        -v|--version)
            TARGET_VERSION="$2"
            shift 2
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --no-backup)
            BACKUP_BEFORE_ROLLBACK=false
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

# Set verbose mode
if [[ "$VERBOSE" == "true" ]]; then
    set -x
fi

log_info "Starting Claude Flow rollback..."
log_info "Environment: $ENVIRONMENT"
log_info "Deployment Type: $DEPLOYMENT_TYPE"
log_info "Target Version: ${TARGET_VERSION:-previous}"
log_info "Dry Run: $DRY_RUN"

# Get current version
get_current_version() {
    local current_version=""
    
    if [[ "$DEPLOYMENT_TYPE" == "docker" ]]; then
        current_version=$(docker-compose ps claude-flow-app --format "table {{.Image}}" | tail -n 1 | cut -d: -f2)
    elif [[ "$DEPLOYMENT_TYPE" == "kubernetes" ]]; then
        current_version=$(kubectl get deployment claude-flow-deployment -n claude-flow -o jsonpath='{.spec.template.spec.containers[0].image}' | cut -d: -f2)
    fi
    
    echo "$current_version"
}

# Get available versions
get_available_versions() {
    local versions=()
    
    if [[ "$DEPLOYMENT_TYPE" == "docker" ]]; then
        # Get versions from Docker registry or local images
        mapfile -t versions < <(docker images --format "table {{.Tag}}" claude-flow | grep -E '^[0-9]+\.[0-9]+\.[0-9]+$' | sort -V -r)
    elif [[ "$DEPLOYMENT_TYPE" == "kubernetes" ]]; then
        # Get versions from deployment history
        mapfile -t versions < <(kubectl rollout history deployment/claude-flow-deployment -n claude-flow --output=json | jq -r '.items[].metadata.annotations."deployment.kubernetes.io/revision"' | sort -n -r)
    fi
    
    printf '%s\n' "${versions[@]}"
}

# Determine target version
determine_target_version() {
    local current_version=$(get_current_version)
    log_info "Current version: $current_version"
    
    if [[ -z "$TARGET_VERSION" ]]; then
        log_info "No target version specified, finding previous version..."
        
        local versions=($(get_available_versions))
        
        if [[ ${#versions[@]} -lt 2 ]]; then
            log_error "No previous version available for rollback"
            exit 1
        fi
        
        # Find the version before current
        for i in "${!versions[@]}"; do
            if [[ "${versions[$i]}" == "$current_version" && $((i + 1)) -lt ${#versions[@]} ]]; then
                TARGET_VERSION="${versions[$((i + 1))]}"
                break
            fi
        done
        
        if [[ -z "$TARGET_VERSION" ]]; then
            TARGET_VERSION="${versions[1]}"  # Use second version as fallback
        fi
    fi
    
    log_info "Target rollback version: $TARGET_VERSION"
    
    # Verify target version exists
    local versions=($(get_available_versions))
    local version_exists=false
    
    for version in "${versions[@]}"; do
        if [[ "$version" == "$TARGET_VERSION" ]]; then
            version_exists=true
            break
        fi
    done
    
    if [[ "$version_exists" == "false" ]]; then
        log_error "Target version $TARGET_VERSION not found"
        log_error "Available versions:"
        printf '%s\n' "${versions[@]}"
        exit 1
    fi
}

# Create backup before rollback
create_backup() {
    if [[ "$BACKUP_BEFORE_ROLLBACK" == "false" ]]; then
        log_info "Skipping backup as requested"
        return
    fi
    
    log_info "Creating backup before rollback..."
    
    local backup_timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_name="pre_rollback_${backup_timestamp}"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "Dry run - would create backup: $backup_name"
        return
    fi
    
    # Call backup script
    local backup_script="$(dirname "$0")/backup.sh"
    
    if [[ -f "$backup_script" ]]; then
        "$backup_script" --name "$backup_name" --environment "$ENVIRONMENT"
        log_success "Backup created: $backup_name"
    else
        log_warning "Backup script not found, proceeding without backup"
    fi
}

# Rollback Docker deployment
rollback_docker() {
    log_info "Rolling back Docker deployment..."
    
    local compose_file="$(dirname "$0")/../infrastructure/docker-compose.${ENVIRONMENT}.yml"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "Dry run - would rollback to version: $TARGET_VERSION"
        return
    fi
    
    # Update environment variable for target version
    export CLAUDE_FLOW_VERSION="$TARGET_VERSION"
    export LANGFUSE_VERSION="$TARGET_VERSION"
    
    # Pull the target version images
    log_info "Pulling target version images..."
    docker-compose -f "$compose_file" pull claude-flow-app langfuse-server
    
    # Perform rolling update
    log_info "Performing rolling update..."
    docker-compose -f "$compose_file" up -d --force-recreate claude-flow-app langfuse-server
    
    # Wait for services to be healthy
    log_info "Waiting for services to be healthy..."
    sleep 30
    
    # Verify rollback
    verify_rollback
}

# Rollback Kubernetes deployment
rollback_kubernetes() {
    log_info "Rolling back Kubernetes deployment..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "Dry run - would rollback to version: $TARGET_VERSION"
        kubectl rollout history deployment/claude-flow-deployment -n claude-flow
        return
    fi
    
    if [[ "$TARGET_VERSION" =~ ^[0-9]+$ ]]; then
        # Target version is a revision number
        log_info "Rolling back to revision: $TARGET_VERSION"
        kubectl rollout undo deployment/claude-flow-deployment -n claude-flow --to-revision="$TARGET_VERSION"
    else
        # Target version is a semantic version, update image tag
        log_info "Updating image to version: $TARGET_VERSION"
        kubectl set image deployment/claude-flow-deployment -n claude-flow claude-flow="claude-flow:$TARGET_VERSION"
    fi
    
    # Wait for rollout to complete
    log_info "Waiting for rollout to complete..."
    kubectl rollout status deployment/claude-flow-deployment -n claude-flow --timeout=600s
    
    # Verify rollback
    verify_rollback
}

# Verify rollback success
verify_rollback() {
    log_info "Verifying rollback..."
    
    local current_version=$(get_current_version)
    
    if [[ "$current_version" == "$TARGET_VERSION" ]]; then
        log_success "Rollback successful! Current version: $current_version"
    else
        log_error "Rollback failed! Current version: $current_version, Expected: $TARGET_VERSION"
        exit 1
    fi
    
    # Health check
    local health_url=""
    
    if [[ "$ENVIRONMENT" == "production" ]]; then
        health_url="http://your-domain.com/health"
    else
        health_url="http://localhost:8080/health"
    fi
    
    log_info "Performing health check..."
    
    local retries=0
    local max_retries=30
    
    while [[ $retries -lt $max_retries ]]; do
        if curl -f -s "$health_url" > /dev/null; then
            log_success "Health check passed"
            break
        fi
        
        retries=$((retries + 1))
        log_info "Health check attempt $retries/$max_retries..."
        sleep 10
    done
    
    if [[ $retries -eq $max_retries ]]; then
        log_error "Health check failed after rollback"
        log_error "Manual intervention may be required"
        exit 1
    fi
}

# Cleanup function
cleanup() {
    log_info "Rollback process completed"
    
    if [[ "$DRY_RUN" == "false" ]]; then
        log_info "Monitor the application for stability"
        log_info "Use './scripts/status.sh' to check deployment status"
    fi
}

# Main execution
main() {
    trap cleanup EXIT
    
    determine_target_version
    
    # Confirmation prompt for production
    if [[ "$ENVIRONMENT" == "production" && "$DRY_RUN" == "false" ]]; then
        log_warning "You are about to rollback PRODUCTION environment!"
        log_warning "Target version: $TARGET_VERSION"
        read -p "Are you sure you want to proceed? (yes/no): " -r
        
        if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
            log_info "Rollback cancelled"
            exit 0
        fi
    fi
    
    create_backup
    
    case "$DEPLOYMENT_TYPE" in
        docker)
            rollback_docker
            ;;
        kubernetes)
            rollback_kubernetes
            ;;
        *)
            log_error "Unsupported deployment type: $DEPLOYMENT_TYPE"
            exit 1
            ;;
    esac
    
    log_success "Rollback completed successfully!"
}

# Run main function
main "$@"