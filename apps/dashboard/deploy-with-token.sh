#!/bin/bash
set -e

echo "🚀 Deploying dashboard with API token..."

# Get the Fly API token
FLY_API_TOKEN=$(fly auth token)

if [ -z "$FLY_API_TOKEN" ]; then
    echo "❌ Error: Could not get Fly API token. Please run 'fly auth login' first."
    exit 1
fi

echo "📝 Setting API token as environment variable..."

# Deploy with the API token as an environment variable
fly deploy --app swarm-admin \
  --env NEXT_PUBLIC_FLY_API_TOKEN="$FLY_API_TOKEN" \
  --remote-only

echo "✅ Deployment complete!"
echo "🌐 Your app is available at: https://swarm-admin.fly.dev"
echo "📊 Machines UI: https://swarm-admin.fly.dev/machines"
echo "🔍 Swarm Status: https://swarm-admin.fly.dev/swarm-automated"