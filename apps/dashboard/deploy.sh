#!/bin/bash
set -e

echo "🚀 Deploying dashboard to Fly.io..."

# Deploy
fly deploy --app swarm-admin --remote-only

echo "✅ Deployment complete!"
echo "🌐 Your app is available at: https://swarm-admin.fly.dev"