#!/bin/bash

# Bundle apps for Fly.io deployment
# This script creates standalone versions of each app with dependencies bundled

set -e

echo "🚀 Bundling apps for Fly.io deployment..."

# Function to bundle shared types
bundle_shared_types() {
    local target_dir=$1
    echo "  📦 Bundling @swarm/types..."
    mkdir -p "$target_dir/bundled/@swarm/types"
    if [ -d "../../shared/types/dist" ]; then
        cp -r ../../shared/types/dist "$target_dir/bundled/@swarm/types/"
        cp ../../shared/types/package.json "$target_dir/bundled/@swarm/types/"
    fi
}

# Function to bundle shared utils
bundle_shared_utils() {
    local target_dir=$1
    echo "  📦 Bundling @swarm/utils..."
    mkdir -p "$target_dir/bundled/@swarm/utils"
    if [ -d "../../shared/utils/dist" ]; then
        cp -r ../../shared/utils/dist "$target_dir/bundled/@swarm/utils/"
        cp ../../shared/utils/package.json "$target_dir/bundled/@swarm/utils/"
    fi
}

# Build all packages first
echo "📨 Building all packages..."
pnpm run build

# Bundle Manager API
echo ""
echo "🎯 Bundling Manager API..."
cd apps/manager

# Create deploy directory
rm -rf .deploy
mkdir -p .deploy

# Copy built files
cp -r dist .deploy/
cp package.json .deploy/

# Bundle shared dependencies
bundle_shared_types .deploy
bundle_shared_utils .deploy

# Update package.json to remove workspace references
cat > .deploy/package.json << 'EOF'
{
  "name": "@swarm/manager",
  "version": "0.1.0",
  "description": "Swarm Manager API",
  "main": "dist/index.js",
  "scripts": {
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@bull-board/api": "^6.11.0",
    "@bull-board/express": "^6.11.0",
    "@supabase/supabase-js": "^2.38.0",
    "bullmq": "^4.14.0",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express": "^4.18.2",
    "express-rate-limit": "^7.1.4",
    "helmet": "^7.1.0",
    "redis": "^4.6.10",
    "uuid": "^11.1.0",
    "winston": "^3.11.0",
    "zod": "^3.22.4"
  }
}
EOF

# Create Dockerfile
cat > .deploy/Dockerfile << 'EOF'
FROM node:18-alpine

WORKDIR /app

# Copy package.json and install dependencies
COPY package.json ./
RUN npm install --production

# Copy application files
COPY dist ./dist
COPY bundled ./node_modules

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

EXPOSE 8080

CMD ["node", "dist/index.js"]
EOF

# Copy fly.toml
cp fly.toml .deploy/

cd ../..

# Bundle Worker
echo ""
echo "⚙️ Bundling Worker..."
cd apps/worker

# Create deploy directory
rm -rf .deploy
mkdir -p .deploy

# Copy built files
cp -r dist .deploy/
cp package.json .deploy/

# Bundle shared dependencies
bundle_shared_types .deploy
bundle_shared_utils .deploy

# Update package.json
cat > .deploy/package.json << 'EOF'
{
  "name": "@swarm/worker",
  "version": "0.1.0",
  "description": "Swarm Worker Service",
  "main": "dist/index.js",
  "scripts": {
    "start": "node dist/index.js"
  },
  "dependencies": {
    "bullmq": "^4.14.0",
    "dotenv": "^16.3.1",
    "express": "^4.18.2",
    "redis": "^4.6.10",
    "winston": "^3.11.0"
  }
}
EOF

# Create Dockerfile
cat > .deploy/Dockerfile << 'EOF'
FROM node:18-alpine

WORKDIR /app

# Copy package.json and install dependencies
COPY package.json ./
RUN npm install --production

# Copy application files
COPY dist ./dist
COPY bundled ./node_modules

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

EXPOSE 8000

CMD ["node", "dist/index.js"]
EOF

# Copy fly.toml
cp fly.toml .deploy/

cd ../..

# Dashboard uses Next.js standalone build
echo ""
echo "🎨 Preparing Dashboard..."
cd apps/dashboard

# Ensure .dockerignore exists
if [ ! -f .dockerignore ]; then
    echo "node_modules" > .dockerignore
    echo ".next" >> .dockerignore
fi

cd ../..

echo ""
echo "✅ Apps bundled and ready for deployment!"
echo ""
echo "📋 Deploy commands:"
echo "  cd apps/manager/.deploy && fly deploy --app swarm-manager"
echo "  cd apps/dashboard && fly deploy --app swarm-admin"
echo "  cd apps/worker/.deploy && fly deploy --app swarm-worker"
echo ""
echo "💡 Or use the automated script:"
echo "  ./scripts/deploy-bundled.sh"