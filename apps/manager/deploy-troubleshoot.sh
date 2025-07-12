#!/bin/bash

echo "🔍 Fly.io Deployment Troubleshooting Script"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Load authentication if available
if [ -f "fly-auth-env.sh" ]; then
    echo "📄 Loading authentication from fly-auth-env.sh..."
    source fly-auth-env.sh
    echo -e "${GREEN}✓${NC} Token loaded: ${FLY_API_TOKEN:0:10}..."
else
    echo -e "${RED}✗${NC} No fly-auth-env.sh found"
fi

echo ""
echo "1️⃣ Checking Fly CLI Installation"
echo "================================"
if command -v fly &> /dev/null; then
    echo -e "${GREEN}✓${NC} Fly CLI installed"
    fly version
else
    echo -e "${RED}✗${NC} Fly CLI not found"
    echo "   Install with: curl -L https://fly.io/install.sh | sh"
fi

echo ""
echo "2️⃣ Checking Authentication"
echo "========================="
if [ -n "$FLY_API_TOKEN" ]; then
    echo -e "${GREEN}✓${NC} FLY_API_TOKEN is set"
    
    # Test authentication
    if fly auth whoami &> /dev/null; then
        echo -e "${GREEN}✓${NC} Authentication valid"
        echo "   Logged in as: $(fly auth whoami)"
    else
        echo -e "${RED}✗${NC} Authentication failed"
        echo "   Token may be expired or invalid"
    fi
else
    echo -e "${RED}✗${NC} FLY_API_TOKEN not set"
    echo "   Run: ./setup-fly-auth.sh"
fi

echo ""
echo "3️⃣ Checking Organizations"
echo "========================"
if fly orgs list &> /dev/null; then
    echo -e "${GREEN}✓${NC} Can access organizations:"
    fly orgs list | head -5
else
    echo -e "${RED}✗${NC} Cannot list organizations"
fi

echo ""
echo "4️⃣ Checking Existing Apps"
echo "======================="
if fly apps list &> /dev/null; then
    APP_COUNT=$(fly apps list | wc -l)
    echo -e "${GREEN}✓${NC} Can list apps (found $APP_COUNT)"
    
    # Check for our specific app
    if fly apps list | grep -q "swarm-manager-live"; then
        echo -e "${GREEN}✓${NC} App 'swarm-manager-live' exists"
    else
        echo -e "${YELLOW}!${NC} App 'swarm-manager-live' not found"
    fi
else
    echo -e "${RED}✗${NC} Cannot list apps"
fi

echo ""
echo "5️⃣ Checking Docker"
echo "================="
if command -v docker &> /dev/null; then
    echo -e "${GREEN}✓${NC} Docker installed"
    
    if docker ps &> /dev/null; then
        echo -e "${GREEN}✓${NC} Docker daemon running"
    else
        echo -e "${RED}✗${NC} Docker daemon not running"
        echo "   Start Docker Desktop or run: sudo systemctl start docker"
    fi
else
    echo -e "${RED}✗${NC} Docker not installed"
fi

echo ""
echo "6️⃣ Checking Project Files"
echo "======================="
FILES=("fly.toml" "Dockerfile" "package.json" "dist/index.js")
for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} Found: $file"
    else
        echo -e "${RED}✗${NC} Missing: $file"
    fi
done

echo ""
echo "7️⃣ Testing Fly.io API Access"
echo "==========================="
if [ -n "$FLY_API_TOKEN" ]; then
    # Test API endpoint
    API_TEST=$(curl -s -H "Authorization: Bearer $FLY_API_TOKEN" https://api.fly.io/v1/apps 2>/dev/null)
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC} API accessible"
    else
        echo -e "${RED}✗${NC} API not accessible"
    fi
    
    # Test GraphQL endpoint
    GRAPHQL_TEST=$(curl -s -X POST \
        -H "Authorization: Bearer $FLY_API_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"query":"{ viewer { email } }"}' \
        https://api.fly.io/graphql 2>/dev/null)
    
    if echo "$GRAPHQL_TEST" | grep -q "email"; then
        echo -e "${GREEN}✓${NC} GraphQL accessible"
    else
        echo -e "${RED}✗${NC} GraphQL not accessible"
        echo "   Response: ${GRAPHQL_TEST:0:100}..."
    fi
fi

echo ""
echo "8️⃣ Deployment Options"
echo "==================="
echo ""
echo "Based on the checks above, here are your options:"
echo ""

# Provide recommendations based on findings
if fly auth whoami &> /dev/null; then
    echo "✅ You are authenticated. Try these deployment methods:"
    echo ""
    echo "Option 1 - Direct deployment:"
    echo "  fly deploy --app swarm-manager-live --remote-only"
    echo ""
    echo "Option 2 - Force deployment:"
    echo "  fly deploy --app swarm-manager-live --force --yes --remote-only"
    echo ""
    echo "Option 3 - Create new app with generated name:"
    echo "  fly launch --generate-name --remote-only"
else
    echo "❌ Authentication issue detected. Fix this first:"
    echo ""
    echo "Option 1 - Interactive login:"
    echo "  fly auth login"
    echo ""
    echo "Option 2 - Use existing token:"
    echo "  export FLY_API_TOKEN='your-token-here'"
    echo ""
    echo "Option 3 - Generate new token:"
    echo "  fly auth token"
fi

echo ""
echo "📝 Common Issues & Solutions"
echo "=========================="
echo ""
echo "1. ${YELLOW}GraphQL errors${NC}:"
echo "   - Try: fly deploy --remote-only (avoids some GraphQL calls)"
echo "   - Use: --force flag to override checks"
echo ""
echo "2. ${YELLOW}Authorization errors${NC}:"
echo "   - Verify account has app creation permissions"
echo "   - Check billing is active on Fly.io dashboard"
echo "   - Try creating app via web UI first"
echo ""
echo "3. ${YELLOW}App name conflicts${NC}:"
echo "   - Use: fly launch --generate-name"
echo "   - Or specify different name in fly.toml"
echo ""
echo "4. ${YELLOW}Build failures${NC}:"
echo "   - Ensure dist/ folder exists with built files"
echo "   - Run: npm run build (if needed)"
echo "   - Check Dockerfile syntax"

echo ""
echo "🚀 Quick Deploy Commands"
echo "======================"
echo ""
echo "# Standard deploy:"
echo "fly deploy --remote-only"
echo ""
echo "# Force deploy with custom config:"
echo "fly deploy --app swarm-manager-live --config fly.toml --force --yes --remote-only"
echo ""
echo "# Create and deploy new app:"
echo "fly launch --name my-swarm-app --region ord --yes --remote-only"
echo ""
echo "# Deploy with Docker push:"
echo "docker build -t myapp . && docker tag myapp registry.fly.io/swarm-manager-live && docker push registry.fly.io/swarm-manager-live && fly deploy --image registry.fly.io/swarm-manager-live"

echo ""
echo "---"
echo "Script completed. Check output above for issues and recommendations."