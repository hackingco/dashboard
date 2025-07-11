#!/bin/bash
set -e

echo "🚀 Deploying dashboard with Fly API token as secret..."

# First, ensure we're logged in and get the token
echo "📝 Getting your Fly API token..."
FLY_TOKEN=$(fly auth token 2>/dev/null || echo "")

if [ -z "$FLY_TOKEN" ]; then
    echo "❌ Error: Not logged in to Fly. Please run 'fly auth login' first."
    exit 1
fi

echo "✅ Got API token"

# Check if app exists
if fly apps list 2>/dev/null | grep -q "swarm-admin"; then
    echo "✅ App swarm-admin already exists"
else
    echo "📱 Creating app swarm-admin..."
    fly apps create swarm-admin --org personal 2>/dev/null || true
fi

# Set the API token as a secret
echo "🔐 Setting FLY_API_TOKEN as a secret..."
echo "$FLY_TOKEN" | fly secrets set FLY_API_TOKEN --app swarm-admin --stage

# Deploy the app
echo "🚀 Deploying the app..."
fly deploy --app swarm-admin --remote-only

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🌐 Your app should be available at: https://swarm-admin.fly.dev"
echo "📊 Machines UI (no login needed): https://swarm-admin.fly.dev/machines"
echo "🔍 Swarm Status (no login needed): https://swarm-admin.fly.dev/swarm-automated"
echo ""
echo "The dashboard will automatically use the server-side API token, so no login is required!"