#!/bin/bash
# Deploy Manager API to Fly.io

set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Deploying Manager API to Fly.io${NC}"

# Check if we're in the right directory
if [ ! -f "fly.toml" ]; then
    echo -e "${RED}❌ Error: fly.toml not found. Please run from the manager directory.${NC}"
    exit 1
fi

# Check if fly CLI is installed
if ! command -v fly &> /dev/null; then
    echo -e "${RED}❌ Error: Fly CLI not installed. Install from https://fly.io/docs/hands-on/install-flyctl/${NC}"
    exit 1
fi

# Validate required secrets
echo -e "${YELLOW}📋 Checking required secrets...${NC}"

REQUIRED_SECRETS=(
    "SUPABASE_URL"
    "SUPABASE_SERVICE_KEY"
    "FLY_API_TOKEN"
)

# Set secrets if provided via environment
for secret in "${REQUIRED_SECRETS[@]}"; do
    if [ -n "${!secret:-}" ]; then
        echo -e "${YELLOW}🔐 Setting ${secret}...${NC}"
        fly secrets set "$secret"="${!secret}" --app manager-app
    fi
done

# Set optional secrets if provided
if [ -n "${LANGFUSE_PUBLIC_KEY:-}" ]; then
    echo -e "${YELLOW}🔐 Setting Langfuse keys...${NC}"
    fly secrets set \
        LANGFUSE_PUBLIC_KEY="$LANGFUSE_PUBLIC_KEY" \
        LANGFUSE_SECRET_KEY="${LANGFUSE_SECRET_KEY:-}" \
        --app manager-app
fi

if [ -n "${REDIS_PASSWORD:-}" ]; then
    echo -e "${YELLOW}🔐 Setting Redis password...${NC}"
    fly secrets set REDIS_URL="redis://default:${REDIS_PASSWORD}@redis.internal:6379" --app manager-app
fi

# Create volume if it doesn't exist
echo -e "${YELLOW}💾 Ensuring volume exists...${NC}"
fly volumes list --app manager-app | grep -q manager_data || \
    fly volumes create manager_data --size 5 --region ord --app manager-app

# Create Redis instance if needed
if [ "${CREATE_REDIS:-false}" = "true" ]; then
    echo -e "${YELLOW}🔧 Creating Redis instance...${NC}"
    fly redis create --name manager-redis --region ord --no-replicas || true
fi

# Build and deploy
echo -e "${GREEN}🏗️  Building and deploying manager...${NC}"

fly deploy \
    --app manager-app \
    --config fly.toml \
    --strategy rolling \
    --wait-timeout 300

# Scale to minimum instances
echo -e "${YELLOW}⚖️  Scaling to minimum instances...${NC}"
fly scale count 2 --app manager-app

# Check deployment status
echo -e "${YELLOW}🔍 Checking deployment status...${NC}"
fly status --app manager-app

# Health check
echo -e "${YELLOW}🏥 Running health check...${NC}"
APP_URL=$(fly info --app manager-app --json | jq -r '.App.Hostname // empty')
if [ -n "$APP_URL" ]; then
    sleep 5
    curl -s -f "https://${APP_URL}/health" && echo -e "\n${GREEN}✅ Health check passed!${NC}" || echo -e "\n${YELLOW}⚠️  Health check failed (app may still be starting)${NC}"
fi

# Get the app URL
if [ -n "$APP_URL" ]; then
    echo -e "${GREEN}✅ Manager API deployed successfully!${NC}"
    echo -e "${GREEN}🌐 URL: https://${APP_URL}${NC}"
    echo -e "${GREEN}🔧 Internal URL: http://manager-app.internal:8080${NC}"
else
    echo -e "${GREEN}✅ Manager API deployed successfully!${NC}"
fi

# Show logs
echo -e "${YELLOW}📜 Recent logs:${NC}"
fly logs --app manager-app --limit 20