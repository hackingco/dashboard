#!/bin/bash
set -e

echo "🚀 Deploying dashboard to Fly.io..."

# Load authentication if available
if [ -f "../manager/fly-auth-env.sh" ]; then
    echo "🔐 Loading Fly.io authentication..."
    source ../manager/fly-auth-env.sh
elif [ -f "../../fly-auth-env.sh" ]; then
    source ../../fly-auth-env.sh
fi

# Verify authentication
echo "🔍 Verifying authentication..."
if ! fly auth whoami > /dev/null 2>&1; then
    echo "❌ Authentication failed. Running setup..."
    if [ -f "../manager/setup-fly-auth.sh" ]; then
        cd ../manager && ./setup-fly-auth.sh && cd - > /dev/null
        source ../manager/fly-auth-env.sh
    else
        echo "❌ Please ensure authentication is set up first"
        exit 1
    fi
fi

echo "✅ Authenticated as: $(fly auth whoami)"

# Deploy
fly deploy --app swarm-admin --remote-only

echo "✅ Deployment complete!"
echo "🌐 Your app is available at: https://swarm-admin.fly.dev"