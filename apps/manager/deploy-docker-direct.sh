#!/bin/bash
set -e

echo "🐳 Docker Direct Deployment Script"
echo "=================================="

# Load authentication
if [ -f "fly-auth-env.sh" ]; then
    source fly-auth-env.sh
else
    echo "❌ No authentication found"
    exit 1
fi

APP_NAME="swarm-manager-live"
REGION="ord"

echo "🔧 Configuration:"
echo "  App: $APP_NAME"
echo "  Region: $REGION"
echo "  Token: ${FLY_API_TOKEN:0:10}..."

# Build the Docker image locally first
echo ""
echo "🏗️ Building Docker image locally..."
docker build -t $APP_NAME:latest .

# Tag for Fly.io registry
echo ""
echo "🏷️ Tagging for Fly.io registry..."
docker tag $APP_NAME:latest registry.fly.io/$APP_NAME:latest

# Method 1: Direct registry push
echo ""
echo "🚀 Method 1: Direct registry push..."
echo "📤 Pushing to Fly.io registry..."
if docker push registry.fly.io/$APP_NAME:latest; then
    echo "✅ Image pushed successfully!"
    
    # Try to deploy the pushed image
    echo "🎯 Deploying pushed image..."
    fly deploy --app $APP_NAME --image registry.fly.io/$APP_NAME:latest --yes --remote-only
else
    echo "⚠️ Registry push failed, trying alternative..."
fi

# Method 2: Use fly machine commands directly
echo ""
echo "🎯 Method 2: Using fly machine commands..."
cat > machine-config.json << EOF
{
  "image": "registry.fly.io/$APP_NAME:latest",
  "env": {
    "PORT": "8080",
    "NODE_ENV": "production"
  },
  "services": [
    {
      "ports": [
        {
          "port": 80,
          "handlers": ["http"]
        },
        {
          "port": 443,
          "handlers": ["tls", "http"]
        }
      ],
      "protocol": "tcp",
      "internal_port": 8080
    }
  ]
}
EOF

# Try to create a machine directly
echo "🖥️ Creating machine..."
if fly machine run registry.fly.io/$APP_NAME:latest \
    --app $APP_NAME \
    --region $REGION \
    --port 80:8080 \
    --port 443:8080 \
    --env PORT=8080 \
    --env NODE_ENV=production; then
    echo "✅ Machine created successfully!"
else
    echo "⚠️ Machine creation failed"
fi

# Method 3: Alternative deployment using buildpacks
echo ""
echo "🎯 Method 3: Using buildpacks..."
cat > project.toml << EOF
[[build.env]]
name = "NODE_ENV"
value = "production"

[build]
builder = "heroku/buildpacks:20"

[[build.buildpacks]]
uri = "heroku/nodejs"
EOF

if fly deploy --app $APP_NAME --config fly.toml --yes --remote-only --buildpacks; then
    echo "✅ Buildpack deployment successful!"
else
    echo "⚠️ Buildpack deployment failed"
fi

# Clean up
rm -f machine-config.json project.toml

echo ""
echo "📊 Deployment Summary:"
echo "====================="
fly apps list | grep $APP_NAME || echo "App not found in your apps list"

echo ""
echo "🔍 Alternative approaches if all methods fail:"
echo "1. Use the Fly.io web dashboard to create the app first"
echo "2. Try a different app name that doesn't exist"
echo "3. Deploy to a personal organization instead of default"
echo "4. Contact Fly.io support about account permissions"