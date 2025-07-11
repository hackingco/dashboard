#!/bin/bash

# Simple deployment script for Fly.io that builds everything in place

set -e

echo "🚀 Simple deployment to Fly.io..."

# Check authentication
export FLY_ACCESS_TOKEN="${FLY_ACCESS_TOKEN:-$(fly auth token 2>/dev/null || echo "")}"

if [ -z "$FLY_ACCESS_TOKEN" ]; then
    echo "❌ Not authenticated with Fly.io. Please run: fly auth login"
    exit 1
fi

# Build everything first
echo "📦 Building all packages..."
pnpm run build

# Deploy Manager API
echo ""
echo "🎯 Deploying Manager API..."
cd apps/manager

# Create a temporary Dockerfile for deployment
cat > Dockerfile.deploy << 'EOF'
FROM node:18-alpine

WORKDIR /app

# Copy source files
COPY . .

# Install dependencies and build
RUN npm install -g pnpm && \
    pnpm install --production --ignore-scripts && \
    pnpm add typescript @types/node -D && \
    pnpm build && \
    rm -rf src

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

EXPOSE 8080

CMD ["node", "dist/index.js"]
EOF

# Deploy using the custom Dockerfile
fly deploy --app swarm-manager --dockerfile Dockerfile.deploy --remote-only

# Clean up
rm Dockerfile.deploy

cd ../..

# Deploy Dashboard (Next.js handles this well)
echo ""
echo "🎨 Deploying Dashboard..."
cd apps/dashboard
fly deploy --app swarm-admin --remote-only
cd ../..

# Deploy Worker
echo ""
echo "⚙️ Deploying Worker..."
cd apps/worker

# Create a temporary Dockerfile for deployment
cat > Dockerfile.deploy << 'EOF'
FROM node:18-alpine

WORKDIR /app

# Copy source files
COPY . .

# Install dependencies and build
RUN npm install -g pnpm && \
    pnpm install --production --ignore-scripts && \
    pnpm add typescript @types/node -D && \
    pnpm build && \
    rm -rf src

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

EXPOSE 8000

CMD ["node", "dist/index.js"]
EOF

# Deploy using the custom Dockerfile
fly deploy --app swarm-worker --dockerfile Dockerfile.deploy --remote-only

# Clean up
rm Dockerfile.deploy

cd ../..

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 App URLs:"
echo "  Dashboard: https://swarm-admin.fly.dev"
echo "  Manager API: https://swarm-manager.fly.dev"
echo "  Worker: https://swarm-worker.fly.dev"