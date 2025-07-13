#!/bin/bash

# Container build script for Enterprise Swarm Platform
# Built by Builder-2 Agent with Langfuse Integration

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REGISTRY="${REGISTRY:-swarm}"
TAG="${TAG:-latest}"
BUILD_ARGS="${BUILD_ARGS:-}"
PUSH_IMAGES="${PUSH_IMAGES:-false}"
BUILD_PARALLEL="${BUILD_PARALLEL:-true}"
CACHE_FROM="${CACHE_FROM:-}"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

header() {
    echo
    echo -e "${BOLD}${BLUE}=====================================${NC}"
    echo -e "${BOLD}${BLUE} $1 ${NC}"
    echo -e "${BOLD}${BLUE}=====================================${NC}"
    echo
}

# Function to check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if Docker is installed and running
    if ! command -v docker >/dev/null 2>&1; then
        error "Docker is not installed"
        exit 1
    fi
    
    if ! docker info >/dev/null 2>&1; then
        error "Docker daemon is not running"
        exit 1
    fi
    
    # Check if we're in the correct directory
    if [[ ! -f "$PROJECT_ROOT/package.json" ]]; then
        error "Not in project root directory (package.json not found)"
        exit 1
    fi
    
    # Check if Docker files exist
    for dockerfile in "Dockerfile.manager" "Dockerfile.worker"; do
        if [[ ! -f "$PROJECT_ROOT/$dockerfile" ]]; then
            error "Required Dockerfile not found: $dockerfile"
            exit 1
        fi
    done
    
    # Check if docker scripts exist
    for script in "entrypoint.sh" "health-check.sh"; do
        if [[ ! -f "$PROJECT_ROOT/docker/$script" ]]; then
            error "Required Docker script not found: docker/$script"
            exit 1
        fi
    done
    
    success "Prerequisites check passed"
}

# Function to display build information
show_build_info() {
    header "BUILD INFORMATION"
    
    log "Project Root: $PROJECT_ROOT"
    log "Registry: $REGISTRY"
    log "Tag: $TAG"
    log "Build Timestamp: $BUILD_TIMESTAMP"
    log "Parallel Build: $BUILD_PARALLEL"
    log "Push Images: $PUSH_IMAGES"
    
    if [[ -n "$BUILD_ARGS" ]]; then
        log "Build Args: $BUILD_ARGS"
    fi
    
    if [[ -n "$CACHE_FROM" ]]; then
        log "Cache From: $CACHE_FROM"
    fi
    
    echo
}

# Function to prepare build context
prepare_build_context() {
    log "Preparing build context..."
    
    cd "$PROJECT_ROOT"
    
    # Ensure docker scripts are executable
    chmod +x docker/entrypoint.sh docker/health-check.sh
    
    # Create .dockerignore if it doesn't exist
    if [[ ! -f ".dockerignore" ]]; then
        log "Creating .dockerignore..."
        cat > .dockerignore << 'EOF'
# Git
.git
.gitignore
.github

# Node.js
node_modules
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Build outputs
dist
build
.next
.nuxt

# Development files
.env.local
.env.development.local
.env.test.local
.env.production.local

# Testing
coverage
.nyc_output
test-results

# IDE
.vscode
.idea
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
logs
*.log

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage

# Dependency directories
jspm_packages/

# Optional npm cache directory
.npm

# Optional REPL history
.node_repl_history

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# Docker
Dockerfile*
docker-compose*.yml

# Documentation
docs/
*.md
!README.md

# Temporary files
tmp/
temp/
EOF
        success "Created .dockerignore"
    fi
    
    success "Build context prepared"
}

# Function to build a single image
build_image() {
    local service=$1
    local dockerfile=$2
    local image_name="$REGISTRY/$service:$TAG"
    local build_start=$(date +%s)
    
    log "Building $service image: $image_name"
    
    # Prepare build command
    local build_cmd="docker build"
    build_cmd+=" -f $dockerfile"
    build_cmd+=" -t $image_name"
    build_cmd+=" --label build.timestamp=$BUILD_TIMESTAMP"
    build_cmd+=" --label build.service=$service"
    build_cmd+=" --label build.version=$TAG"
    
    # Add build args if specified
    if [[ -n "$BUILD_ARGS" ]]; then
        build_cmd+=" $BUILD_ARGS"
    fi
    
    # Add cache from if specified
    if [[ -n "$CACHE_FROM" ]]; then
        build_cmd+=" --cache-from $CACHE_FROM"
    fi
    
    # Add build context
    build_cmd+=" ."
    
    log "Build command: $build_cmd"
    
    # Execute build
    if eval "$build_cmd"; then
        local build_end=$(date +%s)
        local build_duration=$((build_end - build_start))
        success "Built $service in ${build_duration}s"
        
        # Display image information
        log "Image details:"
        docker images "$image_name" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
        
        return 0
    else
        error "Failed to build $service"
        return 1
    fi
}

# Function to build images in parallel
build_images_parallel() {
    header "BUILDING IMAGES (PARALLEL)"
    
    local pids=()
    local results=()
    
    # Start manager build in background
    (
        build_image "manager" "Dockerfile.manager"
        echo $? > "/tmp/build_manager.result"
    ) &
    pids[0]=$!
    
    # Start worker build in background
    (
        build_image "worker" "Dockerfile.worker"
        echo $? > "/tmp/build_worker.result"
    ) &
    pids[1]=$!
    
    # Wait for all builds to complete
    log "Waiting for parallel builds to complete..."
    for pid in "${pids[@]}"; do
        wait "$pid"
    done
    
    # Check results
    local manager_result=$(cat "/tmp/build_manager.result" 2>/dev/null || echo "1")
    local worker_result=$(cat "/tmp/build_worker.result" 2>/dev/null || echo "1")
    
    # Clean up temp files
    rm -f "/tmp/build_manager.result" "/tmp/build_worker.result"
    
    if [[ "$manager_result" -eq 0 && "$worker_result" -eq 0 ]]; then
        success "All images built successfully (parallel)"
        return 0
    else
        error "Some images failed to build"
        if [[ "$manager_result" -ne 0 ]]; then
            error "Manager build failed"
        fi
        if [[ "$worker_result" -ne 0 ]]; then
            error "Worker build failed"
        fi
        return 1
    fi
}

# Function to build images sequentially
build_images_sequential() {
    header "BUILDING IMAGES (SEQUENTIAL)"
    
    local failed_builds=()
    
    # Build manager
    if ! build_image "manager" "Dockerfile.manager"; then
        failed_builds+=("manager")
    fi
    
    # Build worker
    if ! build_image "worker" "Dockerfile.worker"; then
        failed_builds+=("worker")
    fi
    
    if [[ ${#failed_builds[@]} -eq 0 ]]; then
        success "All images built successfully (sequential)"
        return 0
    else
        error "Failed to build: ${failed_builds[*]}"
        return 1
    fi
}

# Function to run security scan
security_scan() {
    header "SECURITY SCANNING"
    
    if ! command -v docker >/dev/null 2>&1; then
        warning "Docker not available for security scanning"
        return 0
    fi
    
    # Basic security checks
    local images=("$REGISTRY/manager:$TAG" "$REGISTRY/worker:$TAG")
    
    for image in "${images[@]}"; do
        log "Scanning $image for security issues..."
        
        # Check for non-root user
        local user_check
        user_check=$(docker run --rm "$image" whoami 2>/dev/null || echo "root")
        
        if [[ "$user_check" == "root" ]]; then
            warning "$image is running as root user"
        else
            success "$image is running as non-root user: $user_check"
        fi
        
        # Check image size
        local image_size
        image_size=$(docker images "$image" --format "{{.Size}}")
        log "$image size: $image_size"
        
        # Check for known vulnerabilities if trivy is available
        if command -v trivy >/dev/null 2>&1; then
            log "Running Trivy security scan on $image..."
            trivy image --severity HIGH,CRITICAL "$image" || warning "Trivy scan failed for $image"
        fi
    done
}

# Function to test built images
test_images() {
    header "TESTING IMAGES"
    
    local images=("$REGISTRY/manager:$TAG" "$REGISTRY/worker:$TAG")
    
    for image in "${images[@]}"; do
        log "Testing $image..."
        
        # Test image can start
        local container_id
        container_id=$(docker run -d --rm "$image" sleep 30)
        
        if [[ -n "$container_id" ]]; then
            sleep 5  # Give container time to start
            
            # Check if container is running
            if docker ps | grep -q "$container_id"; then
                success "$image started successfully"
                
                # Test health check if available
                log "Testing health check for $image..."
                if docker exec "$container_id" ./health-check.sh >/dev/null 2>&1; then
                    success "$image health check passed"
                else
                    warning "$image health check failed or not available"
                fi
            else
                error "$image failed to start"
            fi
            
            # Clean up
            docker stop "$container_id" >/dev/null 2>&1 || true
        else
            error "Failed to start $image"
        fi
    done
}

# Function to push images
push_images() {
    if [[ "$PUSH_IMAGES" != "true" ]]; then
        log "Skipping image push (PUSH_IMAGES=false)"
        return 0
    fi
    
    header "PUSHING IMAGES"
    
    local images=("$REGISTRY/manager:$TAG" "$REGISTRY/worker:$TAG")
    
    for image in "${images[@]}"; do
        log "Pushing $image..."
        
        if docker push "$image"; then
            success "Pushed $image"
        else
            error "Failed to push $image"
            return 1
        fi
    done
    
    success "All images pushed successfully"
}

# Function to generate build report
generate_build_report() {
    header "BUILD REPORT"
    
    local report_file="$PROJECT_ROOT/build-report-$BUILD_TIMESTAMP.txt"
    
    {
        echo "=================================="
        echo "SWARM CONTAINER BUILD REPORT"
        echo "=================================="
        echo
        echo "Build Timestamp: $BUILD_TIMESTAMP"
        echo "Registry: $REGISTRY"
        echo "Tag: $TAG"
        echo "Build Host: $(hostname)"
        echo "Docker Version: $(docker --version)"
        echo
        echo "Built Images:"
        docker images "$REGISTRY/*:$TAG" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
        echo
        echo "Image Details:"
        for image in "$REGISTRY/manager:$TAG" "$REGISTRY/worker:$TAG"; do
            echo
            echo "--- $image ---"
            docker inspect "$image" --format '{{.Config.Labels}}' | tr ',' '\n' || echo "Inspection failed"
        done
        echo
        echo "Build completed at: $(date)"
    } > "$report_file"
    
    success "Build report generated: $report_file"
    
    # Display summary
    echo
    log "=== BUILD SUMMARY ==="
    docker images "$REGISTRY/*:$TAG" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"
}

# Function to clean up build artifacts
cleanup() {
    log "Cleaning up build artifacts..."
    
    # Remove dangling images
    local dangling_images
    dangling_images=$(docker images -f "dangling=true" -q)
    
    if [[ -n "$dangling_images" ]]; then
        log "Removing dangling images..."
        docker rmi $dangling_images || warning "Failed to remove some dangling images"
    fi
    
    # Remove temporary files
    rm -f /tmp/build_*.result
    
    success "Cleanup completed"
}

# Function to display usage
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Container build script for Enterprise Swarm Platform with Langfuse Integration

OPTIONS:
    -r, --registry REGISTRY     Container registry (default: swarm)
    -t, --tag TAG              Image tag (default: latest)
    -p, --push                 Push images after building
    -s, --sequential           Build images sequentially (default: parallel)
    --build-args ARGS          Additional build arguments
    --cache-from IMAGE         Use image as cache source
    --no-test                  Skip image testing
    --no-scan                  Skip security scanning
    -h, --help                 Show this help message

EXAMPLES:
    # Basic build
    $0

    # Build with custom registry and tag
    $0 -r myregistry.com/swarm -t v1.2.3

    # Build and push to registry
    $0 -r myregistry.com/swarm -t v1.2.3 --push

    # Build with custom build args
    $0 --build-args "--build-arg NODE_ENV=production"

    # Sequential build with cache
    $0 --sequential --cache-from myregistry.com/swarm/manager:latest

ENVIRONMENT VARIABLES:
    REGISTRY        Container registry prefix
    TAG             Image tag
    PUSH_IMAGES     Push images after building (true/false)
    BUILD_PARALLEL  Build images in parallel (true/false)
    BUILD_ARGS      Additional Docker build arguments
    CACHE_FROM      Image to use as cache source

EOF
}

# Main function
main() {
    local skip_test=false
    local skip_scan=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -r|--registry)
                REGISTRY="$2"
                shift 2
                ;;
            -t|--tag)
                TAG="$2"
                shift 2
                ;;
            -p|--push)
                PUSH_IMAGES="true"
                shift
                ;;
            -s|--sequential)
                BUILD_PARALLEL="false"
                shift
                ;;
            --build-args)
                BUILD_ARGS="$2"
                shift 2
                ;;
            --cache-from)
                CACHE_FROM="$2"
                shift 2
                ;;
            --no-test)
                skip_test=true
                shift
                ;;
            --no-scan)
                skip_scan=true
                shift
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            *)
                error "Unknown argument: $1"
                usage
                exit 1
                ;;
        esac
    done
    
    # Set trap for cleanup
    trap cleanup EXIT
    
    # Main execution flow
    header "ENTERPRISE SWARM CONTAINER BUILD"
    
    check_prerequisites
    show_build_info
    prepare_build_context
    
    # Build images
    if [[ "$BUILD_PARALLEL" == "true" ]]; then
        build_images_parallel
    else
        build_images_sequential
    fi
    
    # Run tests if not skipped
    if [[ "$skip_test" != "true" ]]; then
        test_images
    fi
    
    # Run security scan if not skipped
    if [[ "$skip_scan" != "true" ]]; then
        security_scan
    fi
    
    # Push images if requested
    push_images
    
    # Generate report
    generate_build_report
    
    success "Container build completed successfully!"
}

# Run main function with all arguments
main "$@"