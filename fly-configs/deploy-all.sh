#!/bin/bash
# Deploy all Hive Mind components to Fly.io

set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🐝 Hive Mind Deployment Script${NC}"
echo -e "${BLUE}================================${NC}"

# Base directory
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$BASE_DIR")"

# Check prerequisites
echo -e "${YELLOW}📋 Checking prerequisites...${NC}"

if ! command -v fly &> /dev/null; then
    echo -e "${RED}❌ Error: Fly CLI not installed. Install from https://fly.io/docs/hands-on/install-flyctl/${NC}"
    exit 1
fi

if ! fly auth whoami &> /dev/null; then
    echo -e "${RED}❌ Error: Not logged in to Fly.io. Run 'fly auth login'${NC}"
    exit 1
fi

# Load environment variables if .env exists
if [ -f "${PROJECT_ROOT}/.env" ]; then
    echo -e "${YELLOW}📄 Loading environment variables...${NC}"
    export $(cat "${PROJECT_ROOT}/.env" | grep -v '^#' | xargs)
fi

# Prompt for required secrets if not set
if [ -z "${SUPABASE_URL:-}" ]; then
    read -p "Enter Supabase URL: " SUPABASE_URL
    export SUPABASE_URL
fi

if [ -z "${SUPABASE_SERVICE_KEY:-}" ]; then
    read -p "Enter Supabase Service Key: " SUPABASE_SERVICE_KEY
    export SUPABASE_SERVICE_KEY
fi

if [ -z "${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}" ]; then
    read -p "Enter Supabase Anon Key: " NEXT_PUBLIC_SUPABASE_ANON_KEY
    export NEXT_PUBLIC_SUPABASE_ANON_KEY
fi

if [ -z "${FLY_API_TOKEN:-}" ]; then
    read -p "Enter Fly API Token: " FLY_API_TOKEN
    export FLY_API_TOKEN
fi

# Optional: Langfuse keys
if [ -z "${LANGFUSE_PUBLIC_KEY:-}" ]; then
    read -p "Enter Langfuse Public Key (optional, press Enter to skip): " LANGFUSE_PUBLIC_KEY
    export LANGFUSE_PUBLIC_KEY
fi

# Create apps if they don't exist
echo -e "${YELLOW}🏗️  Creating Fly apps...${NC}"

fly apps list | grep -q "manager-app" || fly apps create manager-app --org personal
fly apps list | grep -q "dashboard-app" || fly apps create dashboard-app --org personal

# Deploy Manager first (other services depend on it)
echo -e "${GREEN}🚀 Deploying Manager API...${NC}"
cd "${PROJECT_ROOT}/apps/manager"

# Copy Fly config
cp "${BASE_DIR}/manager/fly.toml" .
cp "${BASE_DIR}/manager/Dockerfile" .

# Run deployment script
export NEXT_PUBLIC_SUPABASE_URL="$SUPABASE_URL"
bash "${BASE_DIR}/deploy-manager.sh"

# Wait for manager to be ready
echo -e "${YELLOW}⏳ Waiting for Manager API to be ready...${NC}"
sleep 10

# Deploy Dashboard
echo -e "${GREEN}🚀 Deploying Dashboard...${NC}"
cd "${PROJECT_ROOT}/apps/dashboard"

# Copy Fly config
cp "${BASE_DIR}/dashboard/fly.toml" .
cp "${BASE_DIR}/dashboard/Dockerfile" .

# Run deployment script
bash "${BASE_DIR}/deploy-dashboard.sh"

# Deploy a sample worker
echo -e "${GREEN}🚀 Deploying Sample Worker...${NC}"
cd "${PROJECT_ROOT}/apps/worker"

# Copy Fly config
cp "${BASE_DIR}/worker/fly.toml" .
cp "${BASE_DIR}/worker/Dockerfile" .

# Generate manager token for worker registration
MANAGER_TOKEN=$(fly ssh console -a manager-app -C "node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"" 2>/dev/null || echo "")
export MANAGER_TOKEN

# Deploy worker
bash "${BASE_DIR}/deploy-worker.sh" "sample" "data-processor" 2

# Summary
echo -e "${GREEN}✅ Hive Mind deployment complete!${NC}"
echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}📋 Deployment Summary:${NC}"
echo -e "  Manager API: https://manager-app.fly.dev"
echo -e "  Dashboard: https://dashboard-app.fly.dev"
echo -e "  Workers: 2 instances deployed"
echo -e ""
echo -e "${YELLOW}📝 Next Steps:${NC}"
echo -e "  1. Visit the dashboard to monitor your swarm"
echo -e "  2. Use the API to spawn more workers"
echo -e "  3. Check logs with: fly logs -a <app-name>"
echo -e ""
echo -e "${YELLOW}🔧 Useful Commands:${NC}"
echo -e "  - Scale workers: fly scale count N -a worker-sample-*"
echo -e "  - View status: fly status -a <app-name>"
echo -e "  - SSH into app: fly ssh console -a <app-name>"
echo -e "  - View secrets: fly secrets list -a <app-name>"

# Save deployment info
echo -e "${YELLOW}💾 Saving deployment information...${NC}"
cat > "${PROJECT_ROOT}/deployment-info.json" <<EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "apps": {
    "manager": {
      "name": "manager-app",
      "url": "https://manager-app.fly.dev",
      "internal": "http://manager-app.internal:8080"
    },
    "dashboard": {
      "name": "dashboard-app", 
      "url": "https://dashboard-app.fly.dev"
    },
    "workers": [
      {
        "type": "data-processor",
        "count": 2,
        "prefix": "worker-sample"
      }
    ]
  },
  "regions": ["ord"],
  "volumes": {
    "manager_data": "5GB",
    "dashboard_data": "1GB",
    "worker_data": "1GB per worker"
  }
}
EOF

echo -e "${GREEN}🎉 Deployment complete! Info saved to deployment-info.json${NC}"