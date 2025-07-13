#!/bin/bash
set -euo pipefail

# Unified Fly.io Deployment Script
# Consolidates functionality from all existing deployment scripts
# Usage: ./scripts/deployment/unified-deploy.sh [OPTIONS]

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Default configuration
APP_NAME="swarm-manager-live"
REGION="ord"
METHOD="standard"
DOCKERFILE="Dockerfile.simple"
CONFIG_FILE="fly.toml"
FORCE="false"
BYPASS_HEALTHCHECK="false"
GENERATE_NAME="false"
DRY_RUN="false"
VERBOSE="false"
TROUBLESHOOT="false"
USE_DOCKER_DIRECT="false"
USE_API_DIRECT="false"

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_header() {
    echo -e "${CYAN}"
    echo "=================================================================="
    echo "🚀 UNIFIED FLY.IO DEPLOYMENT SCRIPT"
    echo "=================================================================="
    echo -e "${NC}"
}

# Function to show usage
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Unified Fly.io deployment script combining all deployment methods.

OPTIONS:
    --method <method>       Deployment method (standard|bypass|docker|api|simple)
    --app-name <name>       App name (default: swarm-manager-live)
    --region <region>       Deployment region (default: ord)
    --dockerfile <file>     Dockerfile to use (default: Dockerfile.simple)
    --config <file>         Fly config file (default: fly.toml)
    --force                 Force deployment
    --bypass-healthcheck    Skip health checks
    --generate-name         Generate unique app name with timestamp
    --dry-run              Show what would be done without executing
    --verbose              Enable verbose output
    --troubleshoot         Run diagnostic checks first
    --help                 Show this help message

DEPLOYMENT METHODS:
    standard               Standard fly deploy (default)
    bypass                 Multi-method deployment with fallbacks
    docker                 Docker-focused deployment with registry push
    api                    Direct API testing and debugging
    simple                 Create new app with unique name

EXAMPLES:
    # Standard deployment
    $0 --method standard

    # Force deployment with bypass methods
    $0 --method bypass --force

    # Docker direct deployment
    $0 --method docker --dockerfile Dockerfile

    # Create new app with unique name
    $0 --method simple --generate-name

    # Troubleshoot deployment issues
    $0 --troubleshoot

    # Dry run to see what would happen
    $0 --method bypass --dry-run

AUTHENTICATION:
    Script will automatically load authentication from:
    - fly-auth-env.sh (if exists)
    - .env file (if exists)
    - Or prompt to run setup-fly-auth.sh

EOF
}

# Function to parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --method)
                METHOD="$2"
                shift 2
                ;;
            --app-name)
                APP_NAME="$2"
                shift 2
                ;;
            --region)
                REGION="$2"
                shift 2
                ;;
            --dockerfile)
                DOCKERFILE="$2"
                shift 2
                ;;
            --config)
                CONFIG_FILE="$2"
                shift 2
                ;;
            --force)
                FORCE="true"
                shift
                ;;
            --bypass-healthcheck)
                BYPASS_HEALTHCHECK="true"
                shift
                ;;
            --generate-name)
                GENERATE_NAME="true"
                shift
                ;;
            --dry-run)
                DRY_RUN="true"
                shift
                ;;
            --verbose)
                VERBOSE="true"
                shift
                ;;
            --troubleshoot)
                TROUBLESHOOT="true"
                shift
                ;;
            --help)
                show_usage
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
}

# Function to validate inputs
validate_inputs() {
    if [[ "$METHOD" != "standard" && "$METHOD" != "bypass" && "$METHOD" != "docker" && "$METHOD" != "api" && "$METHOD" != "simple" ]]; then
        print_error "Invalid method. Must be one of: standard, bypass, docker, api, simple"
        exit 1
    fi
    
    if [[ "$GENERATE_NAME" == "true" ]]; then
        APP_NAME="swarm-manager-$(date +%s)"
        print_info "Generated unique app name: $APP_NAME"
    fi
}

# Function to load authentication
load_authentication() {
    print_info "Loading authentication..."
    
    # Load environment variables if .env exists
    if [ -f ".env" ]; then
        print_info "Loading environment from .env file..."
        source .env
    fi
    
    # Load token from fly-auth-env.sh if available
    if [ -f "fly-auth-env.sh" ]; then
        print_info "Loading Fly.io authentication from fly-auth-env.sh..."
        source fly-auth-env.sh
    fi
    
    # Ensure we have authentication using FLY_API_TOKEN
    if [ -z "${FLY_API_TOKEN:-}" ]; then
        print_warning "FLY_API_TOKEN not set. Running authentication setup..."
        if [ -f "setup-fly-auth.sh" ]; then
            ./setup-fly-auth.sh
            if [ -f "fly-auth-env.sh" ]; then
                source fly-auth-env.sh
            fi
        else
            print_error "Please run: ./setup-fly-auth.sh first"
            exit 1
        fi
    fi
    
    # Verify authentication
    print_info "Verifying authentication..."
    if [[ "$DRY_RUN" == "false" ]]; then
        if ! fly auth whoami > /dev/null 2>&1; then
            print_error "Authentication failed. Please check your token."
            exit 1
        fi
        print_success "Authenticated as: $(fly auth whoami)"
    else
        print_info "[DRY RUN] Would verify authentication"
    fi
}

# Function to run diagnostics (from deploy-troubleshoot.sh)
run_diagnostics() {
    print_info "Running deployment diagnostics..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        print_info "[DRY RUN] Would run full diagnostic checks"
        return 0
    fi
    
    # Check Fly CLI
    if command -v fly &> /dev/null; then
        print_success "Fly CLI installed: $(fly version | head -1)"
    else
        print_error "Fly CLI not found"
        return 1
    fi
    
    # Check Docker
    if command -v docker &> /dev/null; then
        print_success "Docker installed"
        if docker ps &> /dev/null; then
            print_success "Docker daemon running"
        else
            print_warning "Docker daemon not running"
        fi
    else
        print_warning "Docker not installed"
    fi
    
    # Check project files
    local files=("$CONFIG_FILE" "$DOCKERFILE" "package.json")
    for file in "${files[@]}"; do
        if [ -f "$file" ]; then
            print_success "Found: $file"
        else
            print_warning "Missing: $file"
        fi
    done
    
    # Check existing apps
    if fly apps list &> /dev/null; then
        local app_count=$(fly apps list | wc -l)
        print_info "Can access $app_count apps"
        
        if fly apps list | grep -q "$APP_NAME"; then
            print_success "App '$APP_NAME' exists"
        else
            print_warning "App '$APP_NAME' not found"
        fi
    else
        print_error "Cannot list apps"
        return 1
    fi
    
    return 0
}

# Standard deployment method (from deploy.sh)
deploy_standard() {
    print_info "Executing standard deployment..."
    
    local deploy_cmd="fly deploy --app $APP_NAME --dockerfile $DOCKERFILE --remote-only"
    
    if [[ "$FORCE" == "true" ]]; then
        deploy_cmd="$deploy_cmd --force --yes"
    fi
    
    if [[ "$VERBOSE" == "true" ]]; then
        deploy_cmd="$deploy_cmd --verbose"
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        print_info "[DRY RUN] Would execute: $deploy_cmd"
        return 0
    fi
    
    print_info "Executing: $deploy_cmd"
    eval "$deploy_cmd"
}

# Bypass deployment with multiple methods (from deploy-bypass.sh)
deploy_bypass() {
    print_info "Executing bypass deployment with multiple fallback methods..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        print_info "[DRY RUN] Would try multiple deployment methods:"
        print_info "  Method 1: Standard deploy with force"
        print_info "  Method 2: Deploy with minimal config"
        print_info "  Method 3: Raw flyctl commands"
        print_info "  Method 4: Check app status and restart"
        return 0
    fi
    
    # Method 1: Deploy to existing app with force
    print_info "Method 1: Deploy to existing app with force..."
    if fly deploy --app "$APP_NAME" --config "$CONFIG_FILE" --dockerfile "$DOCKERFILE" --yes --force --remote-only 2>&1 | tee deploy.log; then
        print_success "Method 1 successful!"
        fly status --app "$APP_NAME"
        return 0
    else
        print_warning "Method 1 failed, trying next method..."
    fi
    
    # Method 2: Deploy with minimal config
    print_info "Method 2: Deploy with minimal config..."
    cat > fly.minimal.toml << EOF
app = "$APP_NAME"
primary_region = "$REGION"

[build]
  dockerfile = "$DOCKERFILE"

[env]
  PORT = "8080"
  NODE_ENV = "production"

[[services]]
  protocol = "tcp"
  internal_port = 8080

  [[services.ports]]
    port = 80
    handlers = ["http"]

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]
EOF
    
    if fly deploy --app "$APP_NAME" --config fly.minimal.toml --yes --remote-only 2>&1 | tee deploy-minimal.log; then
        print_success "Method 2 successful with minimal config!"
        fly status --app "$APP_NAME"
        rm -f fly.minimal.toml
        return 0
    else
        print_warning "Method 2 failed, trying next method..."
        rm -f fly.minimal.toml
    fi
    
    # Method 3: Raw flyctl commands
    print_info "Method 3: Using raw flyctl commands..."
    export FLYCTL_DISABLE_UPDATE_CHECK=1
    export FLY_FORCE_LEGACY_DEPLOY=1
    
    if flyctl deploy --app "$APP_NAME" --config "$CONFIG_FILE" --yes --remote-only --strategy immediate 2>&1 | tee deploy-raw.log; then
        print_success "Method 3 successful with raw commands!"
        flyctl status --app "$APP_NAME"
        return 0
    else
        print_warning "Method 3 failed, trying next method..."
    fi
    
    # Method 4: Check app status and restart
    print_info "Method 4: Checking app status and restart..."
    if fly apps list | grep -q "$APP_NAME"; then
        print_success "App exists! Checking status..."
        fly status --app "$APP_NAME"
        
        print_info "Attempting to restart existing deployment..."
        if fly apps restart "$APP_NAME"; then
            print_success "App restarted successfully!"
            return 0
        fi
    else
        print_error "App does not exist in your account"
    fi
    
    # Clean up log files
    rm -f deploy.log deploy-minimal.log deploy-raw.log
    
    print_error "All bypass methods failed"
    return 1
}

# Docker direct deployment (from deploy-docker-direct.sh)
deploy_docker() {
    print_info "Executing Docker direct deployment..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        print_info "[DRY RUN] Would execute Docker deployment:"
        print_info "  1. Build Docker image locally"
        print_info "  2. Tag for Fly.io registry"
        print_info "  3. Push to registry"
        print_info "  4. Deploy using image"
        return 0
    fi
    
    # Build the Docker image locally
    print_info "Building Docker image locally..."
    docker build -t "$APP_NAME":latest -f "$DOCKERFILE" .
    
    # Tag for Fly.io registry
    print_info "Tagging for Fly.io registry..."
    docker tag "$APP_NAME":latest registry.fly.io/"$APP_NAME":latest
    
    # Push to registry
    print_info "Pushing to Fly.io registry..."
    if docker push registry.fly.io/"$APP_NAME":latest; then
        print_success "Image pushed successfully!"
        
        # Deploy the pushed image
        print_info "Deploying pushed image..."
        fly deploy --app "$APP_NAME" --image registry.fly.io/"$APP_NAME":latest --yes --remote-only
        return 0
    else
        print_error "Registry push failed"
        return 1
    fi
}

# API direct deployment with debugging (from deploy-api-direct.sh)
deploy_api() {
    print_info "Executing API direct deployment with debugging..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        print_info "[DRY RUN] Would execute API deployment with debugging"
        return 0
    fi
    
    local api_base="https://api.fly.io"
    
    # Function to make API calls
    api_call() {
        local method=$1
        local endpoint=$2
        local data=$3
        
        if [ -z "$data" ]; then
            curl -s -X "$method" \
                -H "Authorization: Bearer $FLY_API_TOKEN" \
                -H "Content-Type: application/json" \
                "$api_base$endpoint"
        else
            curl -s -X "$method" \
                -H "Authorization: Bearer $FLY_API_TOKEN" \
                -H "Content-Type: application/json" \
                -d "$data" \
                "$api_base$endpoint"
        fi
    }
    
    # Check app status via API
    print_info "Checking app status via API..."
    local app_info
    app_info=$(api_call GET "/v1/apps/$APP_NAME" 2>/dev/null || echo "{}")
    if echo "$app_info" | grep -q "\"name\":\"$APP_NAME\""; then
        print_success "App exists!"
        echo "$app_info" | jq . 2>/dev/null || echo "$app_info"
    else
        print_warning "App not found or not accessible"
    fi
    
    # Try standard deployment with debug output
    print_info "Attempting deployment with debug output..."
    export LOG_LEVEL=debug
    fly deploy --app "$APP_NAME" \
        --config "$CONFIG_FILE" \
        --dockerfile "$DOCKERFILE" \
        --yes \
        --remote-only \
        --verbose \
        2>&1 | tee deploy-debug.log
    
    # Analyze errors
    if [ -f deploy-debug.log ]; then
        print_info "Analyzing deployment errors..."
        print_info "Authorization Errors:"
        grep -i "auth\|401\|403" deploy-debug.log || echo "No auth errors found"
        
        print_info "GraphQL Errors:"
        grep -i "graphql\|query" deploy-debug.log || echo "No GraphQL errors found"
        
        print_info "General Errors:"
        grep -i "error\|fail" deploy-debug.log | head -10 || echo "No general errors found"
        
        rm -f deploy-debug.log
    fi
}

# Simple deployment with unique name (from deploy-simple.sh)
deploy_simple() {
    print_info "Executing simple deployment with unique app name..."
    
    if [[ "$GENERATE_NAME" == "true" ]]; then
        APP_NAME="swarm-manager-$(date +%s)"
        print_info "Using unique app name: $APP_NAME"
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        print_info "[DRY RUN] Would create new app: $APP_NAME"
        print_info "[DRY RUN] Would launch with fly launch command"
        return 0
    fi
    
    # Create minimal fly.toml
    print_info "Creating minimal fly.toml..."
    cat > fly.simple.toml << EOF
app = "$APP_NAME"
primary_region = "$REGION"

[build]
  dockerfile = "$DOCKERFILE"

[env]
  PORT = "8080"

[[services]]
  internal_port = 8080
  protocol = "tcp"

  [[services.ports]]
    port = 80
    handlers = ["http"]

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]
EOF
    
    # Launch the app
    print_info "Launching new app..."
    if fly launch \
        --config fly.simple.toml \
        --dockerfile "$DOCKERFILE" \
        --name "$APP_NAME" \
        --region "$REGION" \
        --yes \
        --remote-only \
        --now; then
        
        print_success "Deployment successful!"
        print_info "App URL: https://$APP_NAME.fly.dev"
        
        # Save app name for future reference
        echo "export FLY_APP_NAME=$APP_NAME" > deployed-app.sh
        print_success "App name saved to deployed-app.sh"
        
        rm -f fly.simple.toml
        return 0
    else
        print_error "Simple deployment failed"
        rm -f fly.simple.toml
        return 1
    fi
}

# Function to run health check
run_health_check() {
    if [[ "$BYPASS_HEALTHCHECK" == "true" ]]; then
        print_warning "Skipping health check (--bypass-healthcheck)"
        return 0
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        print_info "[DRY RUN] Would run health check"
        return 0
    fi
    
    print_info "Running post-deployment health check..."
    local max_attempts=10
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if curl -f --max-time 10 "https://$APP_NAME.fly.dev/health" 2>/dev/null; then
            print_success "Health check passed!"
            return 0
        else
            print_warning "Health check failed (attempt $attempt/$max_attempts)"
            if [[ $attempt -eq $max_attempts ]]; then
                print_error "Health check failed after $max_attempts attempts"
                return 1
            fi
            sleep 10
            ((attempt++))
        fi
    done
}

# Function to display deployment summary
show_summary() {
    echo
    print_info "📊 Deployment Summary"
    print_info "====================="
    echo "App Name: $APP_NAME"
    echo "Region: $REGION"
    echo "Method: $METHOD"
    echo "Dockerfile: $DOCKERFILE"
    echo "Config: $CONFIG_FILE"
    echo "URL: https://$APP_NAME.fly.dev"
    echo
    
    if [[ "$DRY_RUN" == "false" ]]; then
        print_info "Post-deployment commands:"
        echo "  fly status --app $APP_NAME"
        echo "  fly logs --app $APP_NAME"
        echo "  fly ssh console --app $APP_NAME"
    fi
}

# Main execution function
main() {
    print_header
    
    parse_args "$@"
    validate_inputs
    
    if [[ "$TROUBLESHOOT" == "true" ]]; then
        if ! run_diagnostics; then
            print_error "Diagnostics failed. Fix issues before deploying."
            exit 1
        fi
        echo
    fi
    
    load_authentication
    
    # Execute deployment based on method
    local deployment_success=false
    case "$METHOD" in
        "standard")
            if deploy_standard; then
                deployment_success=true
            fi
            ;;
        "bypass")
            if deploy_bypass; then
                deployment_success=true
            fi
            ;;
        "docker")
            if deploy_docker; then
                deployment_success=true
            fi
            ;;
        "api")
            if deploy_api; then
                deployment_success=true
            fi
            ;;
        "simple")
            if deploy_simple; then
                deployment_success=true
            fi
            ;;
        *)
            print_error "Unknown deployment method: $METHOD"
            exit 1
            ;;
    esac
    
    if [[ "$deployment_success" == "true" ]]; then
        print_success "Deployment completed successfully!"
        
        if [[ "$METHOD" != "api" ]]; then
            run_health_check || print_warning "Health check failed, but deployment may still be successful"
        fi
        
        show_summary
    else
        print_error "Deployment failed!"
        print_info "Try a different method or run with --troubleshoot flag"
        exit 1
    fi
}

# Execute main function with all arguments
main "$@"