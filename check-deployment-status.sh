#!/bin/bash

# Deployment Status Checker
echo "🔍 Checking Swarm Management System Deployment Status"
echo "===================================================="

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${GREEN}✅ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }

# Check if curl is available
if ! command -v curl &> /dev/null; then
    print_error "curl is required for health checks"
    exit 1
fi

echo ""
print_info "Testing service availability..."

# Service URLs
MANAGER_URL="https://swarm-manager.fly.dev"
DASHBOARD_URL="https://swarm-admin.fly.dev"
REDIS_URL="redis://swarm-redis.internal:6379"

# Test Manager API
echo ""
print_info "Testing Manager API at $MANAGER_URL"

# Test health endpoint
if curl -f -s -m 30 "$MANAGER_URL/health" > /dev/null 2>&1; then
    print_status "Manager health endpoint responding"
    MANAGER_HEALTH=$(curl -s "$MANAGER_URL/health" 2>/dev/null)
    echo "  Response: $MANAGER_HEALTH"
else
    # Test root endpoint
    if curl -f -s -m 30 "$MANAGER_URL/" > /dev/null 2>&1; then
        print_warning "Manager root endpoint responding (health endpoint may not exist)"
    else
        print_error "Manager API not responding"
        echo "  URL: $MANAGER_URL"
        echo "  Check deployment: fly status --app swarm-manager"
        echo "  Check logs: fly logs --app swarm-manager"
    fi
fi

# Test API endpoints
print_info "Testing Manager API endpoints..."
API_ENDPOINTS=("/api/swarms" "/api/tasks" "/api/health")

for endpoint in "${API_ENDPOINTS[@]}"; do
    if curl -f -s -m 10 "$MANAGER_URL$endpoint" > /dev/null 2>&1; then
        print_status "  $endpoint - OK"
    else
        print_warning "  $endpoint - Not responding"
    fi
done

# Test Dashboard
echo ""
print_info "Testing Dashboard at $DASHBOARD_URL"

if curl -f -s -m 30 "$DASHBOARD_URL/" > /dev/null 2>&1; then
    print_status "Dashboard responding"
    
    # Check if it's actually serving content
    RESPONSE=$(curl -s -m 10 "$DASHBOARD_URL/" 2>/dev/null)
    if echo "$RESPONSE" | grep -qi "html\|react\|next"; then
        print_status "Dashboard serving HTML content"
    else
        print_warning "Dashboard responding but may not be serving proper content"
    fi
else
    print_error "Dashboard not responding"
    echo "  URL: $DASHBOARD_URL"
    echo "  Check deployment: fly status --app swarm-admin"
    echo "  Check logs: fly logs --app swarm-admin"
fi

# Check fly CLI availability
echo ""
print_info "Checking Fly CLI availability..."

if command -v fly &> /dev/null; then
    FLY_CMD="fly"
    print_status "Fly CLI available"
elif command -v flyctl &> /dev/null; then
    FLY_CMD="flyctl"
    print_status "Flyctl CLI available"
else
    print_warning "Fly CLI not found in PATH"
    echo "  Install with: curl -L https://fly.io/install.sh | sh"
    echo "  Add to PATH: export PATH=\"\$HOME/.fly/bin:\$PATH\""
    FLY_CMD=""
fi

# If fly CLI is available, get detailed status
if [ -n "$FLY_CMD" ]; then
    echo ""
    print_info "Getting detailed application status..."
    
    # Load authentication if available
    if [ -f "apps/manager/fly-auth-env.sh" ]; then
        source apps/manager/fly-auth-env.sh
    elif [ -f "fly-auth-env.sh" ]; then
        source fly-auth-env.sh
    fi
    
    # Check if authenticated
    if $FLY_CMD auth whoami &> /dev/null; then
        print_status "Authenticated with Fly.io as $($FLY_CMD auth whoami)"
        
        # Get app statuses
        APPS=("swarm-manager" "swarm-admin" "swarm-redis")
        
        for app in "${APPS[@]}"; do
            echo ""
            print_info "Status for $app:"
            
            if $FLY_CMD status --app "$app" &> /dev/null; then
                # App exists, get basic status
                STATUS_OUTPUT=$($FLY_CMD status --app "$app" 2>/dev/null | head -20)
                echo "$STATUS_OUTPUT" | while read -r line; do
                    echo "  $line"
                done
            else
                print_warning "  App $app not found or not accessible"
                echo "    Create with: $FLY_CMD apps create $app"
            fi
        done
        
        # List all apps
        echo ""
        print_info "All Fly.io apps:"
        $FLY_CMD apps list | grep -E "(swarm-|NAME)" || print_warning "No swarm apps found"
        
    else
        print_warning "Not authenticated with Fly.io"
        echo "  Run: $FLY_CMD auth login"
    fi
fi

# Deployment recommendations
echo ""
echo "📋 Deployment Recommendations:"
echo "=============================="

# Check if services are fully deployed
MANAGER_OK=false
DASHBOARD_OK=false

if curl -f -s -m 10 "$MANAGER_URL/health" > /dev/null 2>&1 || curl -f -s -m 10 "$MANAGER_URL/" > /dev/null 2>&1; then
    MANAGER_OK=true
fi

if curl -f -s -m 10 "$DASHBOARD_URL/" > /dev/null 2>&1; then
    DASHBOARD_OK=true
fi

if [ "$MANAGER_OK" = true ] && [ "$DASHBOARD_OK" = true ]; then
    print_status "All services appear to be deployed and responding"
    echo ""
    echo "🎉 Deployment Status: SUCCESS"
    echo ""
    echo "📊 Service URLs:"
    echo "  🎯 Manager API:    $MANAGER_URL"
    echo "  🎨 Dashboard:      $DASHBOARD_URL"
    echo "  🔴 Redis:          $REDIS_URL (internal)"
    echo ""
    echo "🧪 Test commands:"
    echo "  curl $MANAGER_URL/health"
    echo "  curl $MANAGER_URL/api/swarms"
    
elif [ "$MANAGER_OK" = true ]; then
    print_warning "Manager API is working, but Dashboard needs attention"
    echo ""
    echo "🔧 Next steps:"
    echo "  1. Check dashboard logs: fly logs --app swarm-admin"
    echo "  2. Redeploy dashboard: cd apps/dashboard && fly deploy --app swarm-admin"
    
elif [ "$DASHBOARD_OK" = true ]; then
    print_warning "Dashboard is working, but Manager API needs attention"
    echo ""
    echo "🔧 Next steps:"
    echo "  1. Check manager logs: fly logs --app swarm-manager"
    echo "  2. Verify dependencies in Dockerfile.standalone"
    echo "  3. Redeploy manager: cd apps/manager && fly deploy --app swarm-manager"
    
else
    print_error "Both services need deployment or are not responding"
    echo ""
    echo "🚀 Deploy with:"
    echo "  1. Run ./quick-deploy.sh (if Fly CLI is installed)"
    echo "  2. Follow DEPLOYMENT_MANUAL.md for step-by-step instructions"
    echo "  3. Check Redis is deployed: fly status --app swarm-redis"
fi

echo ""
echo "🔧 Useful Commands:"
echo "  fly logs --app swarm-manager"
echo "  fly logs --app swarm-admin"
echo "  fly ssh console --app swarm-manager"
echo "  fly status --app swarm-manager"