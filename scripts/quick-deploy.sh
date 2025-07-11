#!/bin/bash

# Quick deployment script - builds locally and deploys pre-built files

set -e

echo "🚀 Quick deployment to Fly.io..."

# Check authentication
export FLY_ACCESS_TOKEN="${FLY_ACCESS_TOKEN:-$(fly auth token 2>/dev/null || echo "")}"

if [ -z "$FLY_ACCESS_TOKEN" ]; then
    echo "❌ Not authenticated with Fly.io. Please run: fly auth login"
    exit 1
fi

# Build everything locally first
echo "📦 Building all packages locally..."
pnpm install
pnpm run build

# Check that manager built successfully
if [ ! -d "apps/manager/dist" ]; then
    echo "⚠️  Manager build failed, trying direct build..."
    cd apps/manager
    npx tsc || echo "Build may have warnings"
    cd ../..
fi

# Deploy Dashboard (Next.js)
echo ""
echo "🎨 Deploying Dashboard..."
cd apps/dashboard

# Ensure standalone mode
cat > next.config.deploy.js << 'EOF'
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  images: {
    unoptimized: true
  },
  async rewrites() {
    return [
      {
        source: '/api/manager/:path*',
        destination: 'https://swarm-manager.fly.dev/:path*',
      },
    ]
  },
}

module.exports = nextConfig
EOF

# Deploy
fly deploy --app swarm-admin --remote-only --config fly.toml

# Clean up
rm next.config.deploy.js

cd ../..

echo ""
echo "✅ Dashboard deployed!"

# For Manager and Worker, let's create simple Node.js deployments
echo ""
echo "📋 Next steps for Manager and Worker:"
echo ""
echo "1. Manager API can be deployed using:"
echo "   cd apps/manager"
echo "   fly launch --app swarm-manager"
echo "   # Choose 'No' for Postgres and Redis"
echo "   # Then deploy with: fly deploy"
echo ""
echo "2. Worker can be deployed using:"
echo "   cd apps/worker"
echo "   fly launch --app swarm-worker"
echo "   # Choose 'No' for Postgres and Redis"
echo "   # Then deploy with: fly deploy"
echo ""
echo "Or use a service like Railway (railway.app) for easier monorepo deployment."