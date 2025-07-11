#!/bin/bash
set -e

echo "🎯 Deploying Manager API..."

# Ensure we have authentication
export FLY_ACCESS_TOKEN="${FLY_ACCESS_TOKEN:-$(fly auth token 2>/dev/null || echo "")}"

if [ -z "$FLY_ACCESS_TOKEN" ]; then
    echo "❌ Not authenticated with Fly.io. Please run: fly auth login"
    exit 1
fi

# Deploy using the simple Dockerfile
fly deploy --app swarm-manager --dockerfile Dockerfile.simple --remote-only