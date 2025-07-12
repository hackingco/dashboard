#!/bin/bash

# Quick Deployment Script - Deploy with current setup
# This script assumes Fly CLI is installed and authenticated

set -e

echo "🚀 Quick Deployment to Fly.io"
echo "============================="

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_status() { echo -e "${GREEN}✅ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }

# Check if fly command exists
if ! command -v fly &> /dev/null && ! command -v flyctl &> /dev/null; then
    print_error "Fly CLI not found. Please install it first:"
    echo "  curl -L https://fly.io/install.sh | sh"
    echo "  export PATH=\"\$HOME/.fly/bin:\$PATH\""
    exit 1
fi

# Use fly or flyctl
FLY_CMD="fly"
if command -v flyctl &> /dev/null; then
    FLY_CMD="flyctl"
fi

# Check authentication
if ! $FLY_CMD auth whoami &> /dev/null; then
    print_error "Not authenticated with Fly.io. Please run: $FLY_CMD auth login"
    exit 1
fi

print_status "Authenticated with Fly.io"

# Get current directory
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

# Step 1: Create Redis if needed
echo ""
echo "🔴 Setting up Redis..."
REDIS_APP="swarm-redis-$(date +%s)"

if $FLY_CMD apps list | grep -q "^$REDIS_APP"; then
    print_status "Redis app already exists"
else
    print_warning "Redis app not found. Creating it..."
    
    # Create Redis app
    $FLY_CMD apps create "$REDIS_APP" --org personal
    
    # Create temporary directory for Redis deployment
    mkdir -p .temp-redis
    cd .temp-redis
    
    # Create Redis configuration
    cat > fly.toml << EOF
app = "$REDIS_APP"
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

    cat > Dockerfile << EOF
FROM redis:7-alpine
EXPOSE 6379
CMD ["redis-server", "--appendonly", "yes"]
EOF

    # Create volume and deploy
    $FLY_CMD volumes create redis_data --region sjc --size 1 --app "$REDIS_APP" || true
    $FLY_CMD deploy --app "$REDIS_APP"
    
    cd ..
    rm -rf .temp-redis
    print_status "Redis deployed"
fi

REDIS_URL="redis://$REDIS_APP.internal:6379"

# Step 2: Set secrets for both apps
echo ""
echo "🔐 Setting application secrets..."

# Manager secrets
print_warning "Setting manager secrets..."
$FLY_CMD secrets set \
    NODE_ENV="production" \
    PORT="8080" \
    REDIS_URL="$REDIS_URL" \
    DATABASE_URL="sqlite:///data/swarm.db" \
    --app swarm-manager

# Dashboard secrets  
print_warning "Setting dashboard secrets..."
$FLY_CMD secrets set \
    NODE_ENV="production" \
    PORT="3000" \
    NEXT_PUBLIC_API_URL="https://swarm-manager.fly.dev" \
    --app swarm-admin

print_status "Secrets configured"

# Step 3: Build project
echo ""
echo "📦 Building project..."
if command -v pnpm &> /dev/null; then
    pnpm run build
else
    npm run build
fi
print_status "Build completed"

# Step 4: Prepare and deploy manager
echo ""
echo "🎯 Deploying Manager API..."
cd apps/manager

# Run preparation script if it exists
if [ -f "../../scripts/prepare-manager-deploy.sh" ]; then
    bash ../../scripts/prepare-manager-deploy.sh
fi

# Create volume for manager if needed
$FLY_CMD volumes create swarm_data --region sjc --size 1 --app swarm-manager || print_warning "Volume might already exist"

# Deploy with standalone dockerfile
if [ -f "Dockerfile.standalone" ]; then
    $FLY_CMD deploy --app swarm-manager --dockerfile Dockerfile.standalone
else
    $FLY_CMD deploy --app swarm-manager
fi

print_status "Manager deployed"
cd ../..

# Step 5: Deploy dashboard
echo ""
echo "🎨 Deploying Dashboard..."
cd apps/dashboard

$FLY_CMD deploy --app swarm-admin

print_status "Dashboard deployed"
cd ../..

# Step 6: Test services
echo ""
echo "🧪 Testing deployed services..."

sleep 15  # Wait for services to start

# Test manager
MANAGER_URL="https://swarm-manager.fly.dev"
if curl -f -s "$MANAGER_URL/health" > /dev/null 2>&1; then
    print_status "Manager health check passed"
elif curl -f -s "$MANAGER_URL/" > /dev/null 2>&1; then
    print_status "Manager responding"
else
    print_warning "Manager might not be responding. Check logs: $FLY_CMD logs --app swarm-manager"
fi

# Test dashboard
DASHBOARD_URL="https://swarm-admin.fly.dev"
if curl -f -s "$DASHBOARD_URL/" > /dev/null 2>&1; then
    print_status "Dashboard responding"
else
    print_warning "Dashboard might not be responding. Check logs: $FLY_CMD logs --app swarm-admin"
fi

# Final status
echo ""
print_status "Deployment completed!"
echo ""
echo "📊 Service URLs:"
echo "  🎯 Manager API:    $MANAGER_URL"
echo "  🎨 Dashboard:      $DASHBOARD_URL"  
echo "  🔴 Redis:          $REDIS_URL"
echo ""
echo "🔧 Useful commands:"
echo "  $FLY_CMD logs --app swarm-manager"
echo "  $FLY_CMD logs --app swarm-admin"
echo "  $FLY_CMD status --app swarm-manager"
echo "  $FLY_CMD ssh console --app swarm-manager"
echo ""
echo "🧪 Test endpoints:"
echo "  curl $MANAGER_URL/health"
echo "  curl $MANAGER_URL/api/swarms"
echo ""
echo "🎉 All services deployed successfully!"