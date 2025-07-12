#!/bin/bash

# Install Fly CLI and Deploy Script
echo "🛠️  Installing Fly CLI and deploying applications"

# Install Fly CLI
echo "📥 Installing Fly CLI..."
curl -L https://fly.io/install.sh | sh

# Add to PATH
export PATH="$HOME/.fly/bin:$PATH"

# Verify installation
if command -v fly &> /dev/null; then
    echo "✅ Fly CLI installed successfully"
    fly version
else
    echo "❌ Failed to install Fly CLI"
    exit 1
fi

# Check if authenticated
if ! fly auth whoami &> /dev/null; then
    echo "🔐 Please authenticate with Fly.io:"
    echo "Run: fly auth login"
    echo "Then re-run this script"
    exit 1
fi

# Now run the deployment
echo "🚀 Starting deployment..."
exec ./quick-deploy.sh