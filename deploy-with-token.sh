#!/bin/bash

# Deploy with explicit token authentication
# This script fixes the authentication token persistence issue

set -e

echo "🚀 Deployment with Token Authentication"
echo "======================================"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_status() { echo -e "${GREEN}✅ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }

# Extract token from fly config
if [ -f ~/.fly/config.yml ]; then
    export FLY_API_TOKEN=$(grep 'access_token:' ~/.fly/config.yml | cut -d' ' -f2 | cut -d',' -f1)
    print_status "Extracted Fly API token from config"
else
    print_error "Fly config not found. Please run: fly auth login"
    exit 1
fi

# Verify token works
if ! FLY_API_TOKEN=$FLY_API_TOKEN fly auth whoami >/dev/null 2>&1; then
    print_error "Token authentication failed. Please re-run: fly auth login"
    exit 1
fi

print_status "Authentication verified with token"

# Create apps if they don't exist
print_status "Creating Fly.io applications..."

# Redis
FLY_API_TOKEN=$FLY_API_TOKEN fly apps create swarm-redis --org hackingco || print_warning "swarm-redis app might already exist"

# Manager
FLY_API_TOKEN=$FLY_API_TOKEN fly apps create swarm-manager --org hackingco || print_warning "swarm-manager app might already exist"

# Dashboard
FLY_API_TOKEN=$FLY_API_TOKEN fly apps create swarm-admin --org hackingco || print_warning "swarm-admin app might already exist"

# Worker
FLY_API_TOKEN=$FLY_API_TOKEN fly apps create swarm-worker --org hackingco || print_warning "swarm-worker app might already exist"

print_status "Applications created/verified"

# Deploy Redis first
print_status "Deploying Redis..."
cat > /tmp/redis-fly.toml << 'EOF'
app = "swarm-redis"
primary_region = "ord"

[build]
  image = "redis:7-alpine"

[[services]]
  internal_port = 6379
  protocol = "tcp"

  [[services.ports]]
    port = 6379

[env]
  REDIS_URL = "redis://swarm-redis.internal:6379"
EOF

FLY_API_TOKEN=$FLY_API_TOKEN fly deploy --config /tmp/redis-fly.toml --image redis:7-alpine --app swarm-redis

print_status "Redis deployed successfully"

# Deploy Manager
print_status "Deploying Manager service..."
cd apps/manager

# Set required environment variables
FLY_API_TOKEN=$FLY_API_TOKEN fly secrets set \
  NODE_ENV=production \
  REDIS_URL="redis://swarm-redis.internal:6379" \
  --app swarm-manager

FLY_API_TOKEN=$FLY_API_TOKEN fly deploy --app swarm-manager

print_status "Manager service deployed"

# Deploy Dashboard
print_status "Deploying Dashboard..."
cd ../../admin-dashboard

FLY_API_TOKEN=$FLY_API_TOKEN fly secrets set \
  VITE_API_URL="https://swarm-manager.fly.dev" \
  --app swarm-admin

FLY_API_TOKEN=$FLY_API_TOKEN fly deploy --app swarm-admin

print_status "Dashboard deployed"

# Deploy Worker template
print_status "Deploying Worker template..."
cd ../apps/worker

FLY_API_TOKEN=$FLY_API_TOKEN fly secrets set \
  NODE_ENV=production \
  REDIS_URL="redis://swarm-redis.internal:6379" \
  MANAGER_URL="https://swarm-manager.fly.dev" \
  --app swarm-worker

FLY_API_TOKEN=$FLY_API_TOKEN fly deploy --app swarm-worker

print_status "Worker template deployed"

# Final status check
print_status "Deployment completed! Checking service status..."

echo ""
echo "🎯 Service URLs:"
echo "  Manager API: https://swarm-manager.fly.dev"
echo "  Admin Dashboard: https://swarm-admin.fly.dev" 
echo "  Worker Template: https://swarm-worker.fly.dev"
echo "  Redis: redis://swarm-redis.internal:6379"
echo ""

# Test endpoints
print_status "Testing endpoints..."
if curl -s https://swarm-manager.fly.dev/health >/dev/null 2>&1; then
    print_status "Manager API is responding"
else
    print_warning "Manager API may still be starting up"
fi

if curl -s https://swarm-admin.fly.dev >/dev/null 2>&1; then
    print_status "Dashboard is responding"
else
    print_warning "Dashboard may still be starting up"
fi

print_status "🎉 Deployment complete! All services are deployed to Fly.io"