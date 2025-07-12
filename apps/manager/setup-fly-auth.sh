#!/bin/bash

# Fly.io Authentication Setup Script
# This script extracts and sets the Fly.io authentication token for persistent authentication

echo "🔐 Setting up Fly.io authentication..."

# Extract the working token (third token in the config)
FLY_TOKEN=$(grep "access_token:" ~/.fly/config.yml | sed 's/access_token: //' | cut -d',' -f3)

if [ -z "$FLY_TOKEN" ]; then
    echo "❌ Error: Could not extract Fly.io token from ~/.fly/config.yml"
    exit 1
fi

# Set environment variable
export FLY_API_TOKEN="$FLY_TOKEN"

# Verify authentication
echo "🔍 Verifying authentication..."
if fly auth whoami > /dev/null 2>&1; then
    USER=$(fly auth whoami)
    echo "✅ Successfully authenticated as: $USER"
    echo "✅ Token: ${FLY_TOKEN:0:20}..."
else
    echo "❌ Authentication failed"
    exit 1
fi

# Create .env file for environment persistence
echo "📝 Creating .env file for token persistence..."
echo "FLY_API_TOKEN=$FLY_TOKEN" > .env
echo "✅ Token saved to .env file"

# Export for current session
echo "export FLY_API_TOKEN=$FLY_TOKEN" > fly-auth-env.sh
echo "✅ Run 'source fly-auth-env.sh' to set token in current shell"

echo "🎉 Fly.io authentication setup complete!"
echo "   User: $(fly auth whoami 2>/dev/null || echo 'Authentication check failed')"
echo "   Token length: ${#FLY_TOKEN} characters"