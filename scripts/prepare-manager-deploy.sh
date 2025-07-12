#!/bin/bash

# Prepare Manager for Standalone Deployment
# This script copies shared packages and prepares the manager for deployment

set -e

echo "🔧 Preparing Manager for Standalone Deployment"
echo "=============================================="

# Get the root directory
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MANAGER_DIR="$ROOT_DIR/apps/manager"

cd "$ROOT_DIR"

# Build everything first
echo "📦 Building all packages..."
if command -v pnpm &> /dev/null; then
    pnpm run build
else
    npm run build
fi

# Navigate to manager directory
cd "$MANAGER_DIR"

# Create shared directory and copy built packages
echo "📋 Copying shared packages..."
mkdir -p shared/types shared/utils shared/supabase

# Copy built shared packages
if [ -d "$ROOT_DIR/shared/types/dist" ]; then
    cp -r "$ROOT_DIR/shared/types/dist" shared/types/
    cp "$ROOT_DIR/shared/types/package.json" shared/types/
    echo "✅ Copied @swarm/types"
fi

if [ -d "$ROOT_DIR/shared/utils/dist" ]; then
    cp -r "$ROOT_DIR/shared/utils/dist" shared/utils/
    cp "$ROOT_DIR/shared/utils/package.json" shared/utils/
    echo "✅ Copied @swarm/utils"
fi

if [ -d "$ROOT_DIR/shared/supabase/dist" ]; then
    cp -r "$ROOT_DIR/shared/supabase/dist" shared/supabase/
    cp "$ROOT_DIR/shared/supabase/package.json" shared/supabase/
    echo "✅ Copied @swarm/supabase"
fi

# Update package.json to include shared packages in node_modules structure
echo "🔗 Setting up shared packages as node_modules..."
mkdir -p node_modules/@swarm

# Create symlinks or copy to node_modules structure for deployment
if [ -d "shared/types" ]; then
    cp -r shared/types node_modules/@swarm/types
fi

if [ -d "shared/utils" ]; then
    cp -r shared/utils node_modules/@swarm/utils
fi

if [ -d "shared/supabase" ]; then
    cp -r shared/supabase node_modules/@swarm/supabase
fi

echo "✅ Manager prepared for standalone deployment"
echo ""
echo "📁 Structure created:"
echo "  - dist/ (built TypeScript)"
echo "  - shared/ (local shared packages)"
echo "  - node_modules/@swarm/ (package structure)"
echo "  - package.standalone.json (no workspace deps)"
echo ""
echo "🚀 Ready for deployment with Dockerfile.standalone"