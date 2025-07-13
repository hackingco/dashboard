#!/bin/bash

# Swarm Admin Dashboard Deployment Verification Script

if [ -z "$1" ]; then
    echo "Usage: ./verify-deployment.sh <app-url>"
    echo "Example: ./verify-deployment.sh https://swarm-admin-dashboard.fly.dev"
    exit 1
fi

APP_URL="$1"
echo "🔍 Verifying deployment at: $APP_URL"
echo ""

# Test 1: Health Check
echo "1️⃣ Testing health check endpoint..."
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$APP_URL/health")
if [ "$HEALTH_RESPONSE" = "200" ]; then
    echo "   ✅ Health check passed (200 OK)"
else
    echo "   ❌ Health check failed (HTTP $HEALTH_RESPONSE)"
fi

# Test 2: Main Dashboard
echo ""
echo "2️⃣ Testing main dashboard..."
MAIN_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$APP_URL")
if [ "$MAIN_RESPONSE" = "200" ]; then
    echo "   ✅ Main dashboard accessible (200 OK)"
else
    echo "   ❌ Main dashboard failed (HTTP $MAIN_RESPONSE)"
fi

# Test 3: HTTPS Redirect
echo ""
echo "3️⃣ Testing HTTPS redirect..."
HTTP_URL=$(echo "$APP_URL" | sed 's/https:/http:/')
REDIRECT_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$HTTP_URL")
if [ "$REDIRECT_RESPONSE" = "301" ] || [ "$REDIRECT_RESPONSE" = "302" ]; then
    echo "   ✅ HTTPS redirect working ($REDIRECT_RESPONSE)"
else
    echo "   ⚠️  HTTPS redirect not detected (HTTP $REDIRECT_RESPONSE)"
fi

# Test 4: Static Assets
echo ""
echo "4️⃣ Testing static assets..."
ASSET_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$APP_URL/vite.svg")
if [ "$ASSET_RESPONSE" = "200" ]; then
    echo "   ✅ Static assets accessible (200 OK)"
else
    echo "   ❌ Static assets failed (HTTP $ASSET_RESPONSE)"
fi

# Test 5: SPA Routing
echo ""
echo "5️⃣ Testing SPA routing fallback..."
SPA_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$APP_URL/dashboard")
if [ "$SPA_RESPONSE" = "200" ]; then
    echo "   ✅ SPA routing working (200 OK)"
else
    echo "   ❌ SPA routing failed (HTTP $SPA_RESPONSE)"
fi

echo ""
echo "🏁 Verification complete!"
echo ""
echo "📋 Manual checks to perform:"
echo "   • Visit $APP_URL in browser"
echo "   • Check all navigation links work"
echo "   • Verify dark theme is applied"
echo "   • Test responsive design on mobile"
echo "   • Check browser console for errors"