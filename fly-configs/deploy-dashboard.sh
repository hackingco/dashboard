#!/bin/bash
# Deploy Dashboard to Fly.io

set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Deploying Dashboard to Fly.io${NC}"

# Check if we're in the right directory
if [ ! -f "fly.toml" ]; then
    echo -e "${RED}❌ Error: fly.toml not found. Please run from the dashboard directory.${NC}"
    exit 1
fi

# Check if fly CLI is installed
if ! command -v fly &> /dev/null; then
    echo -e "${RED}❌ Error: Fly CLI not installed. Install from https://fly.io/docs/hands-on/install-flyctl/${NC}"
    exit 1
fi

# Validate environment variables
echo -e "${YELLOW}📋 Checking environment configuration...${NC}"

# Set secrets if provided
if [ -n "${NEXT_PUBLIC_SUPABASE_URL:-}" ]; then
    echo -e "${YELLOW}🔐 Setting Supabase URL secret...${NC}"
    fly secrets set NEXT_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" --app dashboard-app
fi

if [ -n "${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}" ]; then
    echo -e "${YELLOW}🔐 Setting Supabase Anon Key secret...${NC}"
    fly secrets set NEXT_PUBLIC_SUPABASE_ANON_KEY="$NEXT_PUBLIC_SUPABASE_ANON_KEY" --app dashboard-app
fi

# Create volume if it doesn't exist
echo -e "${YELLOW}💾 Ensuring volume exists...${NC}"
fly volumes list --app dashboard-app | grep -q dashboard_data || \
    fly volumes create dashboard_data --size 1 --region ord --app dashboard-app

# Build and deploy
echo -e "${GREEN}🏗️  Building and deploying dashboard...${NC}"

# Deploy with build args
fly deploy \
    --app dashboard-app \
    --config fly.toml \
    --build-arg NEXT_PUBLIC_API_URL=https://manager-app.fly.dev \
    --build-arg NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-placeholder}" \
    --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-placeholder}" \
    --strategy rolling

# Check deployment status
echo -e "${YELLOW}🔍 Checking deployment status...${NC}"
fly status --app dashboard-app

# Get the app URL
APP_URL=$(fly info --app dashboard-app --json | jq -r '.App.Hostname // empty')
if [ -n "$APP_URL" ]; then
    echo -e "${GREEN}✅ Dashboard deployed successfully!${NC}"
    echo -e "${GREEN}🌐 URL: https://${APP_URL}${NC}"
else
    echo -e "${GREEN}✅ Dashboard deployed successfully!${NC}"
    echo -e "${YELLOW}Run 'fly open --app dashboard-app' to view your dashboard${NC}"
fi

# Show logs
echo -e "${YELLOW}📜 Recent logs:${NC}"
fly logs --app dashboard-app --limit 20