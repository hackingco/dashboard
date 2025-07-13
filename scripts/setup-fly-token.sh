#!/bin/bash

# Script to set up Fly.io API token for the swarm manager
# This script helps configure the FLY_ACCESS_TOKEN for production use

set -e

echo "🚀 Fly.io API Token Setup Script"
echo "================================"
echo ""

# Check if running in CI/CD environment
if [ ! -z "$CI" ]; then
    echo "ℹ️  Running in CI/CD environment. Skipping interactive setup."
    echo "Please set FLY_ACCESS_TOKEN as an environment variable."
    exit 0
fi

# Function to validate token format
validate_token() {
    local token=$1
    # Fly tokens typically start with "fo1_" or similar pattern
    if [[ ! "$token" =~ ^[a-zA-Z0-9_-]{20,}$ ]]; then
        return 1
    fi
    return 0
}

# Function to test token validity
test_token() {
    local token=$1
    echo "🔍 Testing token validity..."
    
    # Test the token with a simple API call
    response=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $token" https://api.machines.dev/v1/apps 2>/dev/null | tail -n1)
    
    if [ "$response" = "200" ] || [ "$response" = "401" ]; then
        # 200 = valid token, 401 = invalid token (but API is reachable)
        if [ "$response" = "200" ]; then
            echo "✅ Token is valid!"
            return 0
        else
            echo "❌ Token is invalid or expired."
            return 1
        fi
    else
        echo "⚠️  Could not validate token (API might be down). Response: $response"
        return 2
    fi
}

# Check for existing token
existing_token=""
if [ -f .env ]; then
    existing_token=$(grep -E "^FLY_ACCESS_TOKEN=" .env 2>/dev/null | cut -d'=' -f2- || true)
    if [ -z "$existing_token" ]; then
        existing_token=$(grep -E "^FLY_API_TOKEN=" .env 2>/dev/null | cut -d'=' -f2- || true)
    fi
fi

if [ ! -z "$existing_token" ]; then
    echo "ℹ️  Found existing token in .env file"
    echo ""
    read -p "Do you want to test the existing token? (y/N) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if test_token "$existing_token"; then
            echo "✅ Existing token is working. No changes needed."
            exit 0
        fi
    fi
fi

# Get token from user
echo ""
echo "📝 To get your Fly.io API token:"
echo "   1. Run: fly auth token"
echo "   2. Or visit: https://fly.io/user/personal_access_tokens"
echo ""
echo "⚠️  Note: The token will not be displayed as you type for security reasons."
echo ""

read -s -p "Enter your Fly.io API token: " FLY_TOKEN
echo ""

# Validate token format
if ! validate_token "$FLY_TOKEN"; then
    echo "❌ Invalid token format. Fly.io tokens should be at least 20 characters."
    exit 1
fi

# Test token
if ! test_token "$FLY_TOKEN"; then
    echo "❌ Token validation failed. Please check your token and try again."
    exit 1
fi

# Update .env files
echo ""
echo "📝 Updating configuration files..."

# Function to update or add token to a file
update_env_file() {
    local file=$1
    local backup_file="${file}.backup.$(date +%Y%m%d_%H%M%S)"
    
    if [ -f "$file" ]; then
        # Create backup
        cp "$file" "$backup_file"
        echo "   📋 Backed up $file to $backup_file"
        
        # Remove old token entries
        grep -v -E "^FLY_ACCESS_TOKEN=" "$file" | grep -v -E "^FLY_API_TOKEN=" > "$file.tmp" || true
        mv "$file.tmp" "$file"
        
        # Add new token
        echo "FLY_ACCESS_TOKEN=$FLY_TOKEN" >> "$file"
        echo "   ✅ Updated $file"
    else
        # Create new file
        echo "FLY_ACCESS_TOKEN=$FLY_TOKEN" > "$file"
        echo "   ✅ Created $file"
    fi
}

# Update root .env
update_env_file ".env"

# Update apps/manager/.env if it exists
if [ -d "apps/manager" ]; then
    update_env_file "apps/manager/.env"
fi

# Create .env.fly if it doesn't exist
if [ ! -f ".env.fly" ]; then
    cp .env.fly.example .env.fly 2>/dev/null || true
    if [ -f ".env.fly" ]; then
        sed -i.bak "s/your_fly_api_token_here/$FLY_TOKEN/" .env.fly
        rm -f .env.fly.bak
        echo "   ✅ Created .env.fly from template"
    fi
fi

echo ""
echo "🎉 Fly.io token setup complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Deploy the manager: cd apps/manager && fly deploy"
echo "   2. Set the token as a secret: fly secrets set FLY_ACCESS_TOKEN=$FLY_TOKEN"
echo "   3. Verify deployment: fly status"
echo ""
echo "⚠️  Security reminder:"
echo "   - Never commit .env files to version control"
echo "   - Use 'fly secrets' for production deployments"
echo "   - Rotate tokens regularly"
echo ""