#!/bin/bash

# Deploy bundled apps to Fly.io

set -e

echo "🚀 Deploying bundled apps to Fly.io..."

# Check if bundled
if [ ! -d "apps/manager/.deploy" ]; then
    echo "❌ Apps not bundled yet. Run ./scripts/bundle-for-deploy.sh first"
    exit 1
fi

# Export Fly token
export FLY_ACCESS_TOKEN="${FLY_ACCESS_TOKEN:-$(fly auth token 2>/dev/null || echo "")}"

if [ -z "$FLY_ACCESS_TOKEN" ]; then
    echo "❌ Not authenticated with Fly.io. Please run: fly auth login"
    exit 1
fi

# Deploy Manager
echo ""
echo "📦 Deploying Manager API..."
cd apps/manager/.deploy
fly deploy --app swarm-manager --remote-only
cd ../../..

# Deploy Dashboard
echo ""
echo "🎨 Deploying Dashboard..."
cd apps/dashboard
fly deploy --app swarm-admin --remote-only
cd ../..

# Deploy Worker
echo ""
echo "⚙️ Deploying Worker..."
cd apps/worker/.deploy
fly deploy --app swarm-worker --remote-only
cd ../../..

echo ""
echo "✅ All apps deployed!"
echo ""
echo "📊 App URLs:"
echo "  Dashboard: https://swarm-admin.fly.dev"
echo "  Manager API: https://swarm-manager.fly.dev"
echo "  Worker: https://swarm-worker.fly.dev"
echo ""
echo "🔍 Check status with:"
echo "  fly status --app swarm-admin"
echo "  fly status --app swarm-manager"
echo "  fly status --app swarm-worker"