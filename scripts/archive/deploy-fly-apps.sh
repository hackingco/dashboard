#!/bin/bash

# Fly.io Deployment Script for Swarm Orchestrator
# This script creates and deploys all three Fly.io apps

set -e

echo "🚀 Fly.io Swarm Orchestrator Deployment Script"
echo "=============================================="

# Check if fly CLI is installed
if ! command -v fly &> /dev/null; then
    echo "❌ Error: fly CLI is not installed. Please install it first:"
    echo "   curl -L https://fly.io/install.sh | sh"
    exit 1
fi

# Check if user is authenticated
FLY_ACCESS_TOKEN="${FLY_ACCESS_TOKEN:-$(fly auth token 2>/dev/null || echo "")}"

if [ -z "$FLY_ACCESS_TOKEN" ]; then
    echo "❌ Error: Not authenticated with Fly.io. Please run: fly auth login"
    echo "   Or set FLY_ACCESS_TOKEN environment variable"
    exit 1
fi

# Export token for subshells
export FLY_ACCESS_TOKEN

echo "✅ Authenticated with Fly.io"

# Function to create or launch app
create_or_launch_app() {
    local app_name=$1
    local app_dir=$2
    
    echo ""
    echo "📦 Processing $app_name..."
    cd "$app_dir"
    
    # Check if app exists
    if fly apps list | grep -q "^$app_name"; then
        echo "✅ App $app_name already exists"
    else
        echo "🆕 Creating app $app_name..."
        fly apps create "$app_name" --org personal || {
            echo "⚠️  App creation failed. It might already exist in another org."
        }
    fi
    
    # Check if app has been deployed before
    if fly status --app "$app_name" &> /dev/null; then
        echo "🔄 Deploying update to $app_name..."
        fly deploy --app "$app_name"
    else
        echo "🚀 Initial deployment to $app_name..."
        # For initial deployment, we might need to set secrets first
        case $app_name in
            "admin")
                echo "Setting dashboard secrets..."
                # Add any required secrets here
                # fly secrets set NEXT_PUBLIC_API_URL=https://swarm-manager.fly.dev --app "$app_name"
                ;;
            "swarm-manager")
                echo "Setting manager secrets..."
                # fly secrets set DATABASE_URL=your_database_url --app "$app_name"
                # fly secrets set FLY_API_TOKEN=your_fly_token --app "$app_name"
                ;;
            "swarm-worker")
                echo "Setting worker secrets..."
                # fly secrets set REDIS_URL=your_redis_url --app "$app_name"
                ;;
        esac
        
        fly deploy --app "$app_name"
    fi
    
    cd - > /dev/null
}

# Get the root directory
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo ""
echo "🏗️  Building all applications..."
cd "$ROOT_DIR"
npm run build

echo ""
echo "🚁 Deploying Fly.io applications..."

# Deploy each app
create_or_launch_app "swarm-admin" "$ROOT_DIR/apps/dashboard"
create_or_launch_app "swarm-manager" "$ROOT_DIR/apps/manager"
create_or_launch_app "swarm-worker" "$ROOT_DIR/apps/worker"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 App URLs:"
echo "   Dashboard: https://swarm-admin.fly.dev"
echo "   Manager API: https://swarm-manager.fly.dev"
echo "   Worker: https://swarm-worker.fly.dev"
echo ""
echo "💡 Next steps:"
echo "   1. Set up environment variables using: fly secrets set"
echo "   2. Configure database connection"
echo "   3. Set up monitoring and logging"
echo "   4. Test the deployment"