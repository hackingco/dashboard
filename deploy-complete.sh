#!/bin/bash

# Complete Fly.io Deployment Script for Swarm Management System
# This script handles Redis creation, environment setup, and deployment

set -e

echo "🚀 Complete Fly.io Swarm Management System Deployment"
echo "====================================================="

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if fly CLI is installed
check_fly_cli() {
    if ! command -v fly &> /dev/null && ! command -v flyctl &> /dev/null; then
        print_warning "Fly CLI not found. Installing..."
        curl -L https://fly.io/install.sh | sh
        
        # Add to PATH for current session
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

# Check authentication
check_auth() {
    if ! fly auth whoami &> /dev/null; then
        print_error "Not authenticated with Fly.io. Please run: fly auth login"
        exit 1
    fi
    print_status "Authenticated with Fly.io"
}

# Create Redis instance
create_redis() {
    local redis_app="swarm-redis"
    
    print_info "Creating Redis instance: $redis_app"
    
    # Check if Redis app exists
    if fly apps list | grep -q "^$redis_app"; then
        print_status "Redis app $redis_app already exists"
    else
        print_info "Creating Redis app..."
        fly apps create "$redis_app" --org personal
        
        # Deploy Redis
        print_info "Deploying Redis instance..."
        cd "$(dirname "$0")"
        
        # Create temporary Redis directory and files
        mkdir -p .temp-redis
        cd .temp-redis
        
        # Create Redis fly.toml
        cat > fly.toml << EOF
app = "$redis_app"
primary_region = "sjc"

[env]
  REDIS_PASSWORD = ""

[[services]]
  protocol = "tcp"
  internal_port = 6379

  [[services.ports]]
    port = 6379
    handlers = []

[mounts]
  source = "redis_data"
  destination = "/data"
EOF

        # Create Redis Dockerfile
        cat > Dockerfile << EOF
FROM redis:7-alpine

# Create data directory
RUN mkdir -p /data && chown redis:redis /data

# Copy custom redis.conf if needed
# COPY redis.conf /usr/local/etc/redis/redis.conf

EXPOSE 6379

# Use default redis-server command
CMD ["redis-server", "--appendonly", "yes", "--dir", "/data"]
EOF

        # Create volume
        fly volumes create redis_data --region sjc --size 1 --app "$redis_app" || true
        
        # Deploy Redis
        fly deploy --app "$redis_app"
        
        cd ..
        rm -rf .temp-redis
        
        print_status "Redis instance created and deployed"
    fi
    
    # Return Redis URL
    echo "redis://$redis_app.internal:6379"
}

# Set environment variables for an app
set_app_secrets() {
    local app_name=$1
    local redis_url=$2
    
    print_info "Setting environment variables for $app_name"
    
    case $app_name in
        "swarm-manager")
            fly secrets set \
                NODE_ENV="production" \
                PORT="8080" \
                REDIS_URL="$redis_url" \
                FLY_API_TOKEN="${FLY_API_TOKEN:-}" \
                DATABASE_URL="${DATABASE_URL:-sqlite:///data/swarm.db}" \
                --app "$app_name"
            ;;
        "swarm-admin")
            fly secrets set \
                NODE_ENV="production" \
                PORT="3000" \
                NEXT_PUBLIC_API_URL="https://swarm-manager.fly.dev" \
                REDIS_URL="$redis_url" \
                --app "$app_name"
            ;;
    esac
    
    print_status "Environment variables set for $app_name"
}

# Deploy an application
deploy_app() {
    local app_name=$1
    local app_dir=$2
    local dockerfile=$3
    
    print_info "Deploying $app_name from $app_dir"
    
    cd "$app_dir"
    
    # Check if app exists
    if ! fly apps list | grep -q "^$app_name"; then
        print_info "Creating app $app_name..."
        fly apps create "$app_name" --org personal
    fi
    
    # Create volume for manager app (for SQLite database)
    if [ "$app_name" = "swarm-manager" ]; then
        print_info "Creating volume for database..."
        fly volumes create swarm_data --region sjc --size 1 --app "$app_name" || print_warning "Volume might already exist"
    fi
    
    # Deploy using specified dockerfile
    if [ -n "$dockerfile" ] && [ -f "$dockerfile" ]; then
        print_info "Deploying with custom Dockerfile: $dockerfile"
        fly deploy --app "$app_name" --dockerfile "$dockerfile"
    else
        print_info "Deploying with default Dockerfile"
        fly deploy --app "$app_name"
    fi
    
    print_status "$app_name deployed successfully"
    cd - > /dev/null
}

# Test service health
test_service() {
    local app_name=$1
    local url="https://$app_name.fly.dev"
    
    print_info "Testing $app_name at $url"
    
    # Wait a moment for the service to start
    sleep 10
    
    # Test health endpoint or root
    if curl -f -s "$url/health" > /dev/null 2>&1; then
        print_status "$app_name health check passed"
    elif curl -f -s "$url/" > /dev/null 2>&1; then
        print_status "$app_name root endpoint responding"
    else
        print_warning "$app_name might not be responding correctly"
        print_info "Check logs with: fly logs --app $app_name"
    fi
}

# Main deployment process
main() {
    print_info "Starting complete deployment process..."
    
    # Step 1: Check prerequisites
    check_fly_cli
    check_auth
    
    # Step 2: Create Redis instance
    print_info "Step 1: Creating Redis instance..."
    REDIS_URL=$(create_redis)
    print_status "Redis URL: $REDIS_URL"
    
    # Step 3: Set environment variables
    print_info "Step 2: Setting environment variables..."
    set_app_secrets "swarm-manager" "$REDIS_URL"
    set_app_secrets "swarm-admin" "$REDIS_URL"
    
    # Step 4: Build project
    print_info "Step 3: Building project..."
    cd "$(dirname "$0")"
    if command -v pnpm &> /dev/null; then
        pnpm run build
    else
        npm run build
    fi
    print_status "Project built successfully"
    
    # Step 5: Deploy applications
    print_info "Step 4: Deploying applications..."
    
    # Deploy manager with standalone dockerfile
    deploy_app "swarm-manager" "apps/manager" "Dockerfile.standalone"
    
    # Deploy dashboard
    deploy_app "swarm-admin" "apps/dashboard" ""
    
    # Step 6: Test services
    print_info "Step 5: Testing deployed services..."
    test_service "swarm-manager"
    test_service "swarm-admin"
    
    # Step 7: Final status report
    print_status "Deployment completed successfully!"
    echo ""
    echo "📊 Deployed Services:"
    echo "  🎯 Manager API:    https://swarm-manager.fly.dev"
    echo "  🎨 Dashboard:      https://swarm-admin.fly.dev"
    echo "  🔴 Redis:          redis://swarm-redis.internal:6379"
    echo ""
    echo "🔧 Useful Commands:"
    echo "  fly logs --app swarm-manager"
    echo "  fly logs --app swarm-admin"
    echo "  fly ssh console --app swarm-manager"
    echo "  fly status --app swarm-manager"
    echo ""
    echo "💡 Next Steps:"
    echo "  1. Test the API: curl https://swarm-manager.fly.dev/health"
    echo "  2. Visit dashboard: https://swarm-admin.fly.dev"
    echo "  3. Check logs if any issues occur"
    echo "  4. Set up monitoring and alerts"
}

# Run main function
main "$@"