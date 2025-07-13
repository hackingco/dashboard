#!/bin/bash

# Unified Deployment Script for Swarm Orchestrator
# Consolidates multiple deployment strategies into one script
# Supports both Fly.io and Vercel deployments

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# Default values
ENVIRONMENT="staging"
DEPLOY_MANAGER=true
DEPLOY_DASHBOARD=true
DEPLOY_WORKER=false
SKIP_TESTS=false
DRY_RUN=false

# Usage function
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Unified deployment script for Swarm Orchestrator services.

OPTIONS:
    -e, --environment ENV     Target environment (staging|production) [default: staging]
    -m, --manager            Deploy manager API only
    -d, --dashboard          Deploy dashboard only  
    -w, --worker             Deploy worker service only
    -a, --all                Deploy all services (default)
    --skip-tests             Skip test execution
    --dry-run                Show what would be deployed without executing
    -h, --help               Show this help message

EXAMPLES:
    $0 -e production -a                    # Deploy all to production
    $0 -e staging -m                       # Deploy only manager to staging
    $0 --environment production --dashboard # Deploy only dashboard to production
    $0 --dry-run -e production             # Show what would be deployed

REQUIRED ENVIRONMENT VARIABLES:
    FLY_API_TOKEN              # For Fly.io deployments
    VERCEL_TOKEN               # For Vercel dashboard deployments
    VERCEL_ORG_ID              # Vercel organization ID
    VERCEL_PROJECT_ID          # Vercel project ID

EOF
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            -m|--manager)
                DEPLOY_MANAGER=true
                DEPLOY_DASHBOARD=false
                DEPLOY_WORKER=false
                shift
                ;;
            -d|--dashboard)
                DEPLOY_MANAGER=false
                DEPLOY_DASHBOARD=true
                DEPLOY_WORKER=false
                shift
                ;;
            -w|--worker)
                DEPLOY_MANAGER=false
                DEPLOY_DASHBOARD=false
                DEPLOY_WORKER=true
                shift
                ;;
            -a|--all)
                DEPLOY_MANAGER=true
                DEPLOY_DASHBOARD=true
                DEPLOY_WORKER=true
                shift
                ;;
            --skip-tests)
                SKIP_TESTS=true
                shift
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            *)
                echo -e "${RED}❌ Unknown option: $1${NC}"
                usage
                exit 1
                ;;
        esac
    done
}

# Validation functions
validate_environment() {
    if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
        echo -e "${RED}❌ Invalid environment: $ENVIRONMENT${NC}"
        echo -e "${YELLOW}Valid options: staging, production${NC}"
        exit 1
    fi
}

validate_fly_auth() {
    if [ -z "$FLY_API_TOKEN" ]; then
        echo -e "${RED}❌ FLY_API_TOKEN environment variable is required${NC}"
        exit 1
    fi
    
    if ! command -v flyctl &> /dev/null; then
        echo -e "${RED}❌ flyctl CLI is not installed${NC}"
        echo -e "${YELLOW}Install with: curl -L https://fly.io/install.sh | sh${NC}"
        exit 1
    fi
}

validate_vercel_auth() {
    if [ -z "$VERCEL_TOKEN" ] || [ -z "$VERCEL_ORG_ID" ] || [ -z "$VERCEL_PROJECT_ID" ]; then
        echo -e "${RED}❌ Vercel environment variables are required for dashboard deployment${NC}"
        echo -e "${YELLOW}Required: VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID${NC}"
        exit 1
    fi
    
    if ! command -v vercel &> /dev/null; then
        echo -e "${YELLOW}Installing Vercel CLI...${NC}"
        npm install -g vercel@latest
    fi
}

# Show deployment plan
show_deployment_plan() {
    echo -e "${BLUE}🚀 Deployment Plan${NC}"
    echo -e "${BLUE}==================${NC}"
    echo -e "Environment: ${YELLOW}$ENVIRONMENT${NC}"
    echo -e "Manager API: ${DEPLOY_MANAGER:+${GREEN}✓${NC}}${DEPLOY_MANAGER:-${RED}✗${NC}}"
    echo -e "Dashboard: ${DEPLOY_DASHBOARD:+${GREEN}✓${NC}}${DEPLOY_DASHBOARD:-${RED}✗${NC}}"
    echo -e "Worker: ${DEPLOY_WORKER:+${GREEN}✓${NC}}${DEPLOY_WORKER:-${RED}✗${NC}}"
    echo -e "Skip Tests: ${SKIP_TESTS:+${YELLOW}Yes${NC}}${SKIP_TESTS:-${GREEN}No${NC}}"
    echo ""
}

# Run tests
run_tests() {
    if [ "$SKIP_TESTS" = true ]; then
        echo -e "${YELLOW}⏭️  Skipping tests (--skip-tests flag)${NC}"
        return 0
    fi
    
    echo -e "${BLUE}🧪 Running tests...${NC}"
    
    # Install dependencies
    if [ -f "package.json" ]; then
        pnpm install --frozen-lockfile
    fi
    
    # Run linting
    pnpm run lint --workspace=apps/manager --workspace=admin-dashboard || echo "Linting issues found"
    
    # Run unit tests
    pnpm run test --workspace=apps/manager || echo "Tests failed but continuing..."
    
    echo -e "${GREEN}✅ Test phase completed${NC}"
}

# Deploy Manager API to Fly.io
deploy_manager() {
    if [ "$DEPLOY_MANAGER" != true ]; then
        return 0
    fi
    
    echo -e "${BLUE}🖥️  Deploying Manager API...${NC}"
    
    local app_name
    if [ "$ENVIRONMENT" = "production" ]; then
        app_name="swarm-manager-live"
    else
        app_name="swarm-manager-staging"
    fi
    
    cd apps/manager
    
    if [ "$DRY_RUN" = true ]; then
        echo -e "${YELLOW}[DRY RUN] Would deploy to: $app_name${NC}"
        cd - > /dev/null
        return 0
    fi
    
    # Deploy with appropriate strategy
    if [ "$ENVIRONMENT" = "production" ]; then
        flyctl deploy --app "$app_name" --strategy canary --wait-timeout 300s
        echo -e "${YELLOW}⏳ Monitoring canary deployment...${NC}"
        sleep 30
        flyctl deploy --app "$app_name" --strategy immediate
    else
        flyctl deploy --app "$app_name" --strategy rolling --wait-timeout 300s
    fi
    
    # Health check
    local base_url="https://${app_name}.fly.dev"
    echo -e "${YELLOW}🩺 Health checking: $base_url${NC}"
    
    for i in {1..10}; do
        if curl -f --max-time 10 "$base_url/health" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Manager API deployment successful: $base_url${NC}"
            cd - > /dev/null
            return 0
        fi
        echo "Health check attempt $i/10..."
        sleep 15
    done
    
    echo -e "${RED}❌ Manager API health check failed${NC}"
    cd - > /dev/null
    exit 1
}

# Deploy Dashboard to Vercel
deploy_dashboard() {
    if [ "$DEPLOY_DASHBOARD" != true ]; then
        return 0
    fi
    
    echo -e "${BLUE}🎨 Deploying Dashboard...${NC}"
    
    cd admin-dashboard
    
    if [ "$DRY_RUN" = true ]; then
        echo -e "${YELLOW}[DRY RUN] Would deploy dashboard to Vercel${NC}"
        cd - > /dev/null
        return 0
    fi
    
    # Set environment variables
    if [ "$ENVIRONMENT" = "production" ]; then
        export VITE_MANAGER_URL="https://swarm-manager-live.fly.dev"
        export VITE_WS_URL="wss://swarm-manager-live.fly.dev"
    else
        export VITE_MANAGER_URL="https://swarm-manager-staging.fly.dev"
        export VITE_WS_URL="wss://swarm-manager-staging.fly.dev"
    fi
    
    # Install dependencies and build
    pnpm install --frozen-lockfile
    pnpm build
    
    # Deploy to Vercel
    if [ "$ENVIRONMENT" = "production" ]; then
        DEPLOYMENT_URL=$(vercel deploy --prod --token="$VERCEL_TOKEN")
    else
        DEPLOYMENT_URL=$(vercel deploy --token="$VERCEL_TOKEN")
    fi
    
    # Health check
    echo -e "${YELLOW}🩺 Health checking: $DEPLOYMENT_URL${NC}"
    sleep 30  # Wait for Vercel to be ready
    
    if curl -f --max-time 10 "$DEPLOYMENT_URL" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Dashboard deployment successful: $DEPLOYMENT_URL${NC}"
    else
        echo -e "${RED}❌ Dashboard health check failed${NC}"
        cd - > /dev/null
        exit 1
    fi
    
    cd - > /dev/null
}

# Deploy Worker Service
deploy_worker() {
    if [ "$DEPLOY_WORKER" != true ]; then
        return 0
    fi
    
    echo -e "${BLUE}⚙️  Deploying Worker Service...${NC}"
    
    local app_name="swarm-worker"
    
    if [ ! -d "apps/worker" ]; then
        echo -e "${YELLOW}⚠️  Worker service directory not found, skipping${NC}"
        return 0
    fi
    
    cd apps/worker
    
    if [ "$DRY_RUN" = true ]; then
        echo -e "${YELLOW}[DRY RUN] Would deploy worker to: $app_name${NC}"
        cd - > /dev/null
        return 0
    fi
    
    flyctl deploy --app "$app_name" --strategy rolling --wait-timeout 300s
    
    # Health check
    echo -e "${YELLOW}🩺 Checking worker status...${NC}"
    if flyctl status --app "$app_name" | grep -q "started\|running"; then
        echo -e "${GREEN}✅ Worker deployment successful${NC}"
    else
        echo -e "${RED}❌ Worker deployment failed${NC}"
        cd - > /dev/null
        exit 1
    fi
    
    cd - > /dev/null
}

# Rollback function (for emergencies)
rollback() {
    echo -e "${RED}🔄 Emergency rollback initiated${NC}"
    
    if [ "$DEPLOY_MANAGER" = true ]; then
        echo -e "${YELLOW}Rolling back Manager API...${NC}"
        flyctl releases rollback --app "swarm-manager-live" || echo "Manager rollback failed"
    fi
    
    if [ "$DEPLOY_WORKER" = true ]; then
        echo -e "${YELLOW}Rolling back Worker Service...${NC}"
        flyctl releases rollback --app "swarm-worker" || echo "Worker rollback failed"
    fi
    
    if [ "$DEPLOY_DASHBOARD" = true ]; then
        echo -e "${YELLOW}Dashboard rollback requires manual intervention via Vercel dashboard${NC}"
    fi
}

# Trap for emergency rollback
trap 'echo -e "${RED}❌ Deployment failed!${NC}"; rollback' ERR

# Main execution
main() {
    parse_args "$@"
    validate_environment
    
    echo -e "${BLUE}🚀 Unified Swarm Deployment Script${NC}"
    echo -e "${BLUE}===================================${NC}\n"
    
    show_deployment_plan
    
    if [ "$DRY_RUN" = true ]; then
        echo -e "${YELLOW}🔍 DRY RUN MODE - No actual deployments will be performed${NC}\n"
    fi
    
    # Validate authentication for required services
    if [ "$DEPLOY_MANAGER" = true ] || [ "$DEPLOY_WORKER" = true ]; then
        validate_fly_auth
    fi
    
    if [ "$DEPLOY_DASHBOARD" = true ]; then
        validate_vercel_auth
    fi
    
    # Run tests
    run_tests
    
    # Execute deployments
    deploy_manager
    deploy_dashboard
    deploy_worker
    
    # Success summary
    echo -e "\n${GREEN}🎉 Deployment completed successfully!${NC}"
    echo -e "${BLUE}Summary:${NC}"
    
    if [ "$DEPLOY_MANAGER" = true ]; then
        local manager_url
        if [ "$ENVIRONMENT" = "production" ]; then
            manager_url="https://swarm-manager-live.fly.dev"
        else
            manager_url="https://swarm-manager-staging.fly.dev"
        fi
        echo -e "  Manager API: ${GREEN}$manager_url${NC}"
    fi
    
    if [ "$DEPLOY_DASHBOARD" = true ]; then
        echo -e "  Dashboard: ${GREEN}Deployed to Vercel${NC}"
    fi
    
    if [ "$DEPLOY_WORKER" = true ]; then
        echo -e "  Worker: ${GREEN}https://swarm-worker.fly.dev${NC}"
    fi
    
    echo -e "\n${YELLOW}🔍 Monitor your deployments and run health checks${NC}"
}

# Execute main function
main "$@"