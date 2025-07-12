#!/bin/bash
set -e

echo "🚀 Fly.io Deployment Bypass Script"
echo "================================"

# Load authentication token
if [ -f "fly-auth-env.sh" ]; then
    echo "🔐 Loading authentication..."
    source fly-auth-env.sh
else
    echo "❌ No authentication found. Please run setup-fly-auth.sh first"
    exit 1
fi

# Export the token for fly commands
export FLY_API_TOKEN="${FLY_API_TOKEN}"

echo "📍 Current directory: $(pwd)"
echo "🔑 Using token: ${FLY_API_TOKEN:0:10}..."

# Method 1: Try to deploy to existing app with force flag
echo ""
echo "🎯 Method 1: Deploy to existing app with force..."
if fly deploy --app swarm-manager-live --config fly.toml --dockerfile Dockerfile --yes --force --remote-only 2>&1 | tee deploy.log; then
    echo "✅ Deployment successful!"
    fly status --app swarm-manager-live
    exit 0
else
    echo "⚠️ Method 1 failed, trying next method..."
fi

# Method 2: Try with minimal config
echo ""
echo "🎯 Method 2: Deploy with minimal config..."
cat > fly.minimal.toml << EOF
app = "swarm-manager-live"
primary_region = "ord"

[build]
  dockerfile = "Dockerfile"

[env]
  PORT = "8080"
  NODE_ENV = "production"

[[services]]
  protocol = "tcp"
  internal_port = 8080

  [[services.ports]]
    port = 80
    handlers = ["http"]

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]
EOF

if fly deploy --app swarm-manager-live --config fly.minimal.toml --yes --remote-only 2>&1 | tee deploy-minimal.log; then
    echo "✅ Deployment successful with minimal config!"
    fly status --app swarm-manager-live
    exit 0
else
    echo "⚠️ Method 2 failed, trying next method..."
fi

# Method 3: Try using flyctl directly with raw commands
echo ""
echo "🎯 Method 3: Using raw flyctl commands..."
export FLYCTL_DISABLE_UPDATE_CHECK=1
export FLY_FORCE_LEGACY_DEPLOY=1

if flyctl deploy --app swarm-manager-live --config fly.toml --yes --remote-only --strategy immediate 2>&1 | tee deploy-raw.log; then
    echo "✅ Deployment successful with raw commands!"
    flyctl status --app swarm-manager-live
    exit 0
else
    echo "⚠️ Method 3 failed"
fi

# Method 4: Check if app exists and get its status
echo ""
echo "🎯 Method 4: Checking app status..."
if fly apps list | grep -q "swarm-manager-live"; then
    echo "✅ App exists! Checking status..."
    fly status --app swarm-manager-live
    
    # Try to restart existing deployment
    echo "🔄 Attempting to restart existing deployment..."
    if fly apps restart swarm-manager-live; then
        echo "✅ App restarted successfully!"
    fi
else
    echo "❌ App does not exist in your account"
fi

# Display any errors from logs
echo ""
echo "📋 Deployment attempt logs:"
echo "=========================="
if [ -f deploy.log ]; then
    echo "Standard deploy errors:"
    grep -i "error\|fail\|unauthorized" deploy.log || echo "No specific errors found"
fi

echo ""
echo "🔍 Troubleshooting tips:"
echo "1. Verify the app name 'swarm-manager-live' exists in your Fly.io account"
echo "2. Check if you have permissions to deploy to this app"
echo "3. Try creating the app first: fly apps create swarm-manager-live"
echo "4. Check your account status: fly auth whoami"
echo "5. Verify billing is active on your account"

# Clean up temporary files
rm -f fly.minimal.toml deploy.log deploy-minimal.log deploy-raw.log