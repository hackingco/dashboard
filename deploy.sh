#!/bin/bash

# Backward Compatibility Wrapper for Deploy
# This script redirects to the new unified deployment system

echo "⚠️  DEPRECATED: deploy.sh has been moved and improved"
echo "📍 New location: ./scripts/unified-deploy.sh"
echo "🔗 Redirecting to new deployment script..."
echo ""

# Check if new script exists
if [ -f "./scripts/unified-deploy.sh" ]; then
    echo "✅ Executing unified deployment script..."
    exec ./scripts/unified-deploy.sh "$@"
else
    echo "❌ Error: New deployment script not found at ./scripts/unified-deploy.sh"
    echo "💡 Please use the scripts in ./scripts/ directory for deployment"
    exit 1
fi