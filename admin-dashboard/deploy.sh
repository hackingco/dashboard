#!/bin/bash

echo "🚀 Deploying admin dashboard to Fly.io..."

# Check if fly is installed
if ! command -v fly &> /dev/null; then
    echo "❌ Fly CLI not found. Please install it first: https://fly.io/docs/hands-on/install-flyctl/"
    exit 1
fi

# Build the project locally first to catch any errors
echo "📦 Building project locally..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed. Please fix the errors and try again."
    exit 1
fi

echo "✅ Local build successful!"

# Deploy to Fly.io
echo "🚁 Deploying to Fly.io..."
fly deploy --remote-only

if [ $? -eq 0 ]; then
    echo "✅ Deployment successful!"
    echo "🌐 Your admin dashboard should be available at: https://swarm-admin-dashboard.fly.dev"
    echo "🔗 To map to admin.hacking.co, add a CNAME record pointing to swarm-admin-dashboard.fly.dev"
else
    echo "❌ Deployment failed. Check the logs above for details."
    exit 1
fi