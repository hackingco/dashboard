#!/bin/bash
set -e

echo "🚀 Simple Fly.io Deployment Script"
echo "================================="
echo ""
echo "This script uses the simplest possible deployment method"
echo ""

# Load authentication
if [ -f "fly-auth-env.sh" ]; then
    source fly-auth-env.sh
    echo "✅ Authentication loaded"
else
    echo "❌ No authentication found. Please run:"
    echo "   ./setup-fly-auth.sh"
    exit 1
fi

# Configuration
APP_NAME="swarm-manager-$(date +%s)" # Unique name with timestamp
REGION="ord"

echo "📋 Configuration:"
echo "  New App Name: $APP_NAME"
echo "  Region: $REGION"
echo ""

# Step 1: Create minimal fly.toml
echo "1️⃣ Creating minimal fly.toml..."
cat > fly.simple.toml << EOF
app = "$APP_NAME"
primary_region = "$REGION"

[build]
  dockerfile = "Dockerfile"

[env]
  PORT = "8080"

[[services]]
  internal_port = 8080
  protocol = "tcp"

  [[services.ports]]
    port = 80
    handlers = ["http"]

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]
EOF

echo "✅ Created fly.simple.toml"

# Step 2: Launch the app
echo ""
echo "2️⃣ Launching new app..."
echo "   This will create a brand new app with a unique name"
echo ""

fly launch \
    --config fly.simple.toml \
    --dockerfile Dockerfile \
    --name "$APP_NAME" \
    --region "$REGION" \
    --yes \
    --remote-only \
    --now

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deployment successful!"
    echo ""
    echo "🌐 Your app is deployed at:"
    echo "   https://$APP_NAME.fly.dev"
    echo ""
    echo "📊 Check status with:"
    echo "   fly status --app $APP_NAME"
    echo ""
    echo "📝 View logs with:"
    echo "   fly logs --app $APP_NAME"
    echo ""
    echo "🔧 SSH into the app:"
    echo "   fly ssh console --app $APP_NAME"
    echo ""
    echo "💡 To use this app name in the future, update fly.toml with:"
    echo "   app = \"$APP_NAME\""
else
    echo ""
    echo "❌ Deployment failed"
    echo ""
    echo "🔍 Troubleshooting steps:"
    echo "1. Check authentication: fly auth whoami"
    echo "2. Try logging in again: fly auth login"
    echo "3. Check if the app was partially created: fly apps list | grep $APP_NAME"
    echo "4. Try with a different region: --region iad"
    echo "5. Contact support if billing/permissions issue"
fi

# Cleanup
rm -f fly.simple.toml

echo ""
echo "📋 Deployment Summary"
echo "==================="
echo "App Name: $APP_NAME"
echo "Region: $REGION"
echo "URL: https://$APP_NAME.fly.dev"
echo ""

# Save the app name for future reference
echo "export FLY_APP_NAME=$APP_NAME" > deployed-app.sh
echo "✅ App name saved to deployed-app.sh for future use"