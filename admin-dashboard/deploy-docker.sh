#!/bin/bash

echo "🚀 Deploying swarm-admin dashboard to Fly.io via Docker..."

# Set token from environment or parameter
if [ -n "$1" ]; then
    export FLY_API_TOKEN="$1"
elif [ -z "$FLY_API_TOKEN" ]; then
    echo "❌ No Fly.io token provided. Usage: ./deploy-docker.sh <token>"
    exit 1
fi

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

# Check if app exists, if not try to create it
APP_NAME="swarm-admin-dashboard"
echo "🔍 Checking if app '$APP_NAME' exists..."

fly apps list | grep -q "$APP_NAME"
if [ $? -ne 0 ]; then
    echo "📱 Creating app '$APP_NAME'..."
    fly apps create "$APP_NAME" || {
        echo "⚠️  App creation failed, trying with generated name..."
        APP_NAME="swarm-admin-$(date +%s)"
        fly apps create "$APP_NAME" || {
            echo "❌ Could not create app. Please check authentication."
            exit 1
        }
        # Update fly.toml with the new app name
        sed -i.bak "s/app = \"swarm-admin-dashboard\"/app = \"$APP_NAME\"/" fly.toml
    }
fi

echo "✅ App '$APP_NAME' ready!"

# Deploy to Fly.io
echo "🚁 Deploying to Fly.io..."
fly deploy --remote-only

if [ $? -eq 0 ]; then
    echo "✅ Deployment successful!"
    echo "🌐 Your swarm-admin dashboard is available at: https://$APP_NAME.fly.dev"
    echo ""
    echo "📋 Next steps:"
    echo "  1. Test the dashboard: curl https://$APP_NAME.fly.dev/health"
    echo "  2. Visit: https://$APP_NAME.fly.dev"
    echo "  3. Optional: Set up custom domain with 'fly certs create your-domain.com'"
else
    echo "❌ Deployment failed. Check the logs above for details."
    exit 1
fi