#!/bin/bash

# Test Fly.io Authentication Script
echo "🧪 Testing Fly.io Authentication Setup"
echo "======================================="

# Test 1: Check if authentication files exist
echo "📋 Test 1: Checking authentication files..."
if [ -f ".env" ]; then
    echo "✅ .env file exists"
    if grep -q "FLY_API_TOKEN" .env; then
        echo "✅ FLY_API_TOKEN found in .env"
    else
        echo "❌ FLY_API_TOKEN not found in .env"
    fi
else
    echo "❌ .env file not found"
fi

if [ -f "fly-auth-env.sh" ]; then
    echo "✅ fly-auth-env.sh exists"
else
    echo "❌ fly-auth-env.sh not found"
fi

# Test 2: Load environment and test authentication
echo ""
echo "📋 Test 2: Testing authentication..."
source fly-auth-env.sh 2>/dev/null || echo "⚠️  Could not source fly-auth-env.sh"

if [ -n "$FLY_API_TOKEN" ]; then
    echo "✅ FLY_API_TOKEN environment variable is set"
    echo "   Token length: ${#FLY_API_TOKEN} characters"
    echo "   Token prefix: ${FLY_API_TOKEN:0:20}..."
else
    echo "❌ FLY_API_TOKEN environment variable not set"
fi

# Test 3: Test fly CLI authentication
echo ""
echo "📋 Test 3: Testing fly CLI authentication..."
if command -v fly &> /dev/null; then
    echo "✅ Fly CLI is available"
    
    if fly auth whoami > /dev/null 2>&1; then
        USER=$(fly auth whoami)
        echo "✅ Successfully authenticated as: $USER"
        
        # Test a simple fly command
        echo ""
        echo "📋 Test 4: Testing fly CLI functionality..."
        if fly orgs list > /dev/null 2>&1; then
            echo "✅ Fly CLI commands working correctly"
            fly orgs list | head -5
        else
            echo "⚠️  Fly CLI authentication working, but some commands may have restrictions"
        fi
    else
        echo "❌ Fly CLI authentication failed"
        echo "   Please verify the token is correct"
    fi
else
    echo "❌ Fly CLI not found"
fi

# Test 5: Test deployment readiness
echo ""
echo "📋 Test 5: Testing deployment readiness..."
if [ -f "deploy.sh" ]; then
    echo "✅ deploy.sh script exists"
    if grep -q "source.*fly-auth-env.sh" deploy.sh; then
        echo "✅ deploy.sh loads authentication properly"
    else
        echo "⚠️  deploy.sh may not load authentication correctly"
    fi
else
    echo "❌ deploy.sh script not found"
fi

echo ""
echo "🎯 Authentication Test Summary:"
echo "==============================="

# Overall status
if [ -n "$FLY_API_TOKEN" ] && fly auth whoami > /dev/null 2>&1; then
    echo "✅ PASSED: Authentication is working correctly"
    echo ""
    echo "✨ Ready for deployment!"
    echo "   User: $(fly auth whoami)"
    echo "   Run: ./deploy.sh to deploy with authentication"
else
    echo "❌ FAILED: Authentication setup incomplete"
    echo ""
    echo "🔧 Fix by running: ./setup-fly-auth.sh"
fi