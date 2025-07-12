#!/bin/bash
set -e

echo "🌐 Fly.io Direct API Deployment Script"
echo "====================================="

# Load authentication
if [ -f "fly-auth-env.sh" ]; then
    source fly-auth-env.sh
else
    echo "❌ No authentication found"
    exit 1
fi

APP_NAME="swarm-manager-live"
API_BASE="https://api.fly.io"

echo "🔧 Configuration:"
echo "  App: $APP_NAME"
echo "  API: $API_BASE"
echo "  Token: ${FLY_API_TOKEN:0:10}..."

# Function to make API calls
api_call() {
    local method=$1
    local endpoint=$2
    local data=$3
    
    if [ -z "$data" ]; then
        curl -s -X $method \
            -H "Authorization: Bearer $FLY_API_TOKEN" \
            -H "Content-Type: application/json" \
            "$API_BASE$endpoint"
    else
        curl -s -X $method \
            -H "Authorization: Bearer $FLY_API_TOKEN" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$API_BASE$endpoint"
    fi
}

# Method 1: Check app status via API
echo ""
echo "🔍 Checking app status via API..."
APP_INFO=$(api_call GET "/v1/apps/$APP_NAME" 2>/dev/null || echo "{}")
if echo "$APP_INFO" | grep -q "\"name\":\"$APP_NAME\""; then
    echo "✅ App exists!"
    echo "$APP_INFO" | jq . 2>/dev/null || echo "$APP_INFO"
else
    echo "⚠️ App not found or not accessible"
fi

# Method 2: Try to get machines list
echo ""
echo "🖥️ Checking machines..."
MACHINES=$(api_call GET "/v1/apps/$APP_NAME/machines" 2>/dev/null || echo "[]")
echo "Machines found: $(echo "$MACHINES" | jq length 2>/dev/null || echo "0")"

# Method 3: Try GraphQL with minimal query
echo ""
echo "🔄 Testing GraphQL endpoint..."
GRAPHQL_QUERY='{
  "query": "query { viewer { email } }"
}'

VIEWER_INFO=$(curl -s -X POST \
    -H "Authorization: Bearer $FLY_API_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$GRAPHQL_QUERY" \
    "https://api.fly.io/graphql")

echo "GraphQL response: $VIEWER_INFO" | jq . 2>/dev/null || echo "$VIEWER_INFO"

# Method 4: Use fly CLI with debug mode
echo ""
echo "🐛 Running fly CLI in debug mode..."
export LOG_LEVEL=debug
fly version

# Try deployment with maximum verbosity
echo ""
echo "🚀 Attempting deployment with debug output..."
fly deploy --app $APP_NAME \
    --config fly.toml \
    --dockerfile Dockerfile \
    --yes \
    --remote-only \
    --verbose \
    2>&1 | tee deploy-debug.log

# Parse errors from debug log
echo ""
echo "📋 Analyzing deployment errors..."
if [ -f deploy-debug.log ]; then
    echo "=== Authorization Errors ==="
    grep -i "auth\|401\|403" deploy-debug.log || echo "No auth errors found"
    
    echo ""
    echo "=== GraphQL Errors ==="
    grep -i "graphql\|query" deploy-debug.log || echo "No GraphQL errors found"
    
    echo ""
    echo "=== General Errors ==="
    grep -i "error\|fail" deploy-debug.log | head -10 || echo "No general errors found"
fi

# Method 5: Alternative using flyctl config
echo ""
echo "🔧 Checking flyctl configuration..."
flyctl config show

echo ""
echo "📊 Diagnostic Summary:"
echo "===================="
echo "1. Authentication: $(fly auth whoami 2>&1 || echo "Not authenticated")"
echo "2. Organization: $(fly orgs list 2>&1 | head -1 || echo "No orgs accessible")"
echo "3. Apps accessible: $(fly apps list 2>&1 | wc -l || echo "0") apps"
echo "4. Current context: $(pwd)"

echo ""
echo "💡 Recommendations:"
echo "=================="
echo "1. If authentication fails:"
echo "   - Run: fly auth login"
echo "   - Or: fly auth token"
echo ""
echo "2. If app doesn't exist:"
echo "   - Create via web dashboard: https://fly.io/apps"
echo "   - Or try: fly launch --generate-name"
echo ""
echo "3. If permissions issue:"
echo "   - Check organization membership"
echo "   - Verify billing is active"
echo "   - Contact support@fly.io"

# Clean up
rm -f deploy-debug.log