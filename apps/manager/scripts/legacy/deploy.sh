#!/bin/bash
set -e

echo "🎯 Deploying Manager API..."

# Load environment variables if .env exists
if [ -f ".env" ]; then
    echo "📄 Loading environment from .env file..."
    source .env
fi

# Load token from fly-auth-env.sh if available
if [ -f "fly-auth-env.sh" ]; then
    echo "🔐 Loading Fly.io authentication..."
    source fly-auth-env.sh
fi

# Ensure we have authentication using FLY_API_TOKEN (not FLY_ACCESS_TOKEN)
if [ -z "$FLY_API_TOKEN" ]; then
    echo "❌ FLY_API_TOKEN not set. Running authentication setup..."
    if [ -f "setup-fly-auth.sh" ]; then
        ./setup-fly-auth.sh
        source fly-auth-env.sh
    else
        echo "❌ Please run: ./setup-fly-auth.sh first"
        exit 1
    fi
fi

# Verify authentication
echo "🔍 Verifying authentication..."
if ! fly auth whoami > /dev/null 2>&1; then
    echo "❌ Authentication failed. Please check your token."
    exit 1
fi

echo "✅ Authenticated as: $(fly auth whoami)"

# Deploy using the simple Dockerfile
fly deploy --app swarm-manager --dockerfile Dockerfile.simple --remote-only