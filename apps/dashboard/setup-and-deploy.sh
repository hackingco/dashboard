#!/bin/bash
set -e

echo "🚀 Setting up and deploying dashboard..."

# Check if app exists
if fly apps list 2>/dev/null | grep -q "swarm-admin"; then
    echo "✅ App swarm-admin already exists"
else
    echo "📱 Creating app swarm-admin..."
    fly apps create swarm-admin
fi

echo "📝 Please enter your Fly API token:"
echo "   (Get it by running 'fly auth token' in another terminal)"
read -s FLY_API_TOKEN

if [ -z "$FLY_API_TOKEN" ]; then
    echo "❌ Error: API token is required"
    exit 1
fi

echo ""
echo "🔐 Setting API token as a secret..."
echo "$FLY_API_TOKEN" | fly secrets set NEXT_PUBLIC_FLY_API_TOKEN --app swarm-admin --stage

echo "🚀 Deploying the app..."
fly deploy --app swarm-admin --remote-only

echo "✅ Deployment complete!"
echo "🌐 Your app is available at: https://swarm-admin.fly.dev"
echo "📊 Machines UI: https://swarm-admin.fly.dev/machines"
echo "🔍 Swarm Status: https://swarm-admin.fly.dev/swarm-automated"