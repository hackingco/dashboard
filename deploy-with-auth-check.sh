#!/bin/bash

# Automated Fly.io Deployment with Authentication Check
# This script handles authentication and runs the complete deployment

set -e

echo "🚀 Swarm Management System - Fly.io Deployment"
echo "=============================================="

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${GREEN}✅ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }

# Check Fly CLI installation
check_fly_cli() {
    if ! command -v fly &> /dev/null && ! command -v flyctl &> /dev/null; then
        print_warning "Fly CLI not found. Installing..."
        curl -L https://fly.io/install.sh | sh
        export PATH="$HOME/.fly/bin:$PATH"
        
        if ! command -v fly &> /dev/null; then
            print_error "Failed to install Fly CLI. Please install manually:"
            echo "  curl -L https://fly.io/install.sh | sh"
            echo "  export PATH=\"\$HOME/.fly/bin:\$PATH\""
            exit 1
        fi
    fi
    print_status "Fly CLI is available"
}

# Check and handle authentication
check_and_authenticate() {
    print_info "Checking Fly.io authentication..."
    
    if fly auth whoami &> /dev/null; then
        USER=$(fly auth whoami)
        print_status "Already authenticated as: $USER"
        return 0
    fi
    
    print_warning "Not authenticated with Fly.io"
    print_info "Opening browser for authentication..."
    
    # Attempt to authenticate
    fly auth login
    
    # Verify authentication worked
    if fly auth whoami &> /dev/null; then
        USER=$(fly auth whoami)
        print_status "Successfully authenticated as: $USER"
    else
        print_error "Authentication failed. Please try manually:"
        echo "  fly auth login"
        exit 1
    fi
}

# Create Fly.io applications
create_apps() {
    print_info "Creating Fly.io applications..."
    
    local apps=("swarm-manager" "swarm-admin" "swarm-worker" "swarm-redis")
    
    for app in "${apps[@]}"; do
        if fly apps list | grep -q "^$app"; then
            print_status "App $app already exists"
        else
            print_info "Creating app: $app"
            fly apps create "$app" --org personal
            print_status "Created app: $app"
        fi
    done
}

# Deploy Redis instance
deploy_redis() {
    print_info "Deploying Redis instance..."
    
    local redis_app="swarm-redis"
    
    # Create temporary Redis deployment directory
    mkdir -p .temp-redis
    cd .temp-redis
    
    # Create Redis fly.toml
    cat > fly.toml << EOF
app = "$redis_app"
primary_region = "sjc"

[[services]]
  protocol = "tcp"
  internal_port = 6379

  [[services.ports]]
    port = 6379

[mounts]
  source = "redis_data"
  destination = "/data"
EOF

    # Create Redis Dockerfile
    cat > Dockerfile << EOF
FROM redis:7-alpine
EXPOSE 6379
CMD ["redis-server", "--appendonly", "yes"]
EOF

    # Create volume and deploy
    print_info "Creating Redis volume..."
    fly volumes create redis_data --region sjc --size 1 --app "$redis_app" || print_warning "Volume might already exist"
    
    print_info "Deploying Redis..."
    fly deploy --app "$redis_app"
    
    cd ..
    rm -rf .temp-redis
    
    print_status "Redis deployed successfully"
}

# Set application secrets
set_app_secrets() {
    print_info "Setting application secrets..."
    
    local redis_url="redis://swarm-redis.internal:6379"
    
    # Manager secrets
    print_info "Setting manager secrets..."
    fly secrets set \
        NODE_ENV="production" \
        PORT="8080" \
        REDIS_URL="$redis_url" \
        DATABASE_URL="sqlite:///data/swarm.db" \
        FLY_API_TOKEN="${FLY_API_TOKEN:-}" \
        --app swarm-manager
    
    # Admin dashboard secrets
    print_info "Setting admin dashboard secrets..."
    fly secrets set \
        NODE_ENV="production" \
        PORT="80" \
        NEXT_PUBLIC_API_URL="https://swarm-manager.fly.dev" \
        REDIS_URL="$redis_url" \
        --app swarm-admin
    
    # Worker secrets
    print_info "Setting worker secrets..."
    fly secrets set \
        NODE_ENV="production" \
        PORT="3000" \
        WORKER_TYPE="generic" \
        MANAGER_URL="http://swarm-manager.internal:8080" \
        TELEMETRY_ENDPOINT="http://swarm-manager.internal:8080/telemetry" \
        REDIS_URL="$redis_url" \
        --app swarm-worker
    
    print_status "All secrets configured"
}

# Deploy manager service
deploy_manager() {
    print_info "Deploying Manager service..."
    
    cd apps/manager
    
    # Create volume for database
    print_info "Creating manager data volume..."
    fly volumes create swarm_data --region sjc --size 1 --app swarm-manager || print_warning "Volume might already exist"
    
    # Deploy with standalone dockerfile
    if [ -f "Dockerfile.standalone" ]; then
        print_info "Deploying with Dockerfile.standalone..."
        fly deploy --app swarm-manager --dockerfile Dockerfile.standalone
    else
        print_info "Deploying with default Dockerfile..."
        fly deploy --app swarm-manager
    fi
    
    cd ../..
    print_status "Manager service deployed"
}

# Deploy admin dashboard
deploy_dashboard() {
    print_info "Deploying Admin Dashboard..."
    
    cd admin-dashboard
    
    print_info "Building and deploying dashboard..."
    fly deploy --app swarm-admin
    
    cd ..
    print_status "Admin Dashboard deployed"
}

# Deploy worker template
deploy_worker() {
    print_info "Deploying Worker template..."
    
    cd apps/worker
    
    print_info "Deploying worker template..."
    fly deploy --app swarm-worker
    
    cd ../..
    print_status "Worker template deployed"
}

# Test deployments
test_deployments() {
    print_info "Testing deployed services..."
    
    sleep 15  # Wait for services to start
    
    local manager_url="https://swarm-manager.fly.dev"
    local dashboard_url="https://swarm-admin.fly.dev"
    
    # Test manager
    if curl -f -s "$manager_url/health" > /dev/null 2>&1; then
        print_status "Manager health check passed"
    elif curl -f -s "$manager_url/" > /dev/null 2>&1; then
        print_status "Manager responding"
    else
        print_warning "Manager might not be responding. Check logs: fly logs --app swarm-manager"
    fi
    
    # Test dashboard
    if curl -f -s "$dashboard_url/" > /dev/null 2>&1; then
        print_status "Dashboard responding"
    else
        print_warning "Dashboard might not be responding. Check logs: fly logs --app swarm-admin"
    fi
}

# Main deployment function
main() {
    print_info "Starting complete Fly.io deployment..."
    
    # Get to project root
    cd "$(dirname "$0")"
    
    # Step 1: Prerequisites
    check_fly_cli
    check_and_authenticate
    
    # Step 2: Create applications
    create_apps
    
    # Step 3: Deploy Redis
    deploy_redis
    
    # Step 4: Set secrets
    set_app_secrets
    
    # Step 5: Build project (if build script exists)
    if [ -f "package.json" ] && grep -q '"build"' package.json; then
        print_info "Building project..."
        if command -v pnpm &> /dev/null; then
            pnpm run build
        else
            npm run build
        fi
        print_status "Project built"
    fi
    
    # Step 6: Deploy services
    deploy_manager
    deploy_dashboard
    deploy_worker
    
    # Step 7: Test deployments
    test_deployments
    
    # Step 8: Final status
    print_status "Deployment completed successfully!"
    echo ""
    echo "📊 Deployed Services:"
    echo "  🎯 Manager API:    https://swarm-manager.fly.dev"
    echo "  🎨 Dashboard:      https://swarm-admin.fly.dev"
    echo "  👷 Worker:         https://swarm-worker.fly.dev"
    echo "  🔴 Redis:          redis://swarm-redis.internal:6379"
    echo ""
    echo "🔧 Management Commands:"
    echo "  fly logs --app swarm-manager"
    echo "  fly logs --app swarm-admin"
    echo "  fly status --app swarm-manager"
    echo "  fly ssh console --app swarm-manager"
    echo ""
    echo "🧪 Test Endpoints:"
    echo "  curl https://swarm-manager.fly.dev/health"
    echo "  curl https://swarm-manager.fly.dev/api/swarms"
    echo "  open https://swarm-admin.fly.dev"
    echo ""
    echo "🎉 All services are now live!"
}

# Run main function
main "$@"