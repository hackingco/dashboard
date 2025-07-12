#!/bin/bash
# Deploy Worker Template to Fly.io

set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
WORKER_NAME="${1:-worker}"
WORKER_TYPE="${2:-generic}"
WORKER_COUNT="${3:-1}"
REGION="${4:-ord}"

echo -e "${GREEN}🚀 Deploying Worker: ${WORKER_NAME} (Type: ${WORKER_TYPE})${NC}"

# Check if we're in the right directory
if [ ! -f "fly.toml" ]; then
    echo -e "${RED}❌ Error: fly.toml not found. Please run from the worker directory.${NC}"
    exit 1
fi

# Check if fly CLI is installed
if ! command -v fly &> /dev/null; then
    echo -e "${RED}❌ Error: Fly CLI not installed. Install from https://fly.io/docs/hands-on/install-flyctl/${NC}"
    exit 1
fi

# Generate unique app name
APP_NAME="worker-${WORKER_NAME}-$(date +%s)"
echo -e "${YELLOW}📋 Creating worker app: ${APP_NAME}${NC}"

# Create a copy of fly.toml with the new app name
cp fly.toml "fly-${WORKER_NAME}.toml"
sed -i.bak "s/app = \"worker-app-template\"/app = \"${APP_NAME}\"/" "fly-${WORKER_NAME}.toml"
sed -i.bak "s/WORKER_TYPE = \"generic\"/WORKER_TYPE = \"${WORKER_TYPE}\"/" "fly-${WORKER_NAME}.toml"

# Create the app first
echo -e "${YELLOW}🏗️  Creating Fly app...${NC}"
fly apps create "${APP_NAME}" --org personal || true

# Set worker-specific environment variables
echo -e "${YELLOW}🔐 Setting worker configuration...${NC}"
fly secrets set \
    WORKER_ID="${APP_NAME}" \
    WORKER_TYPE="${WORKER_TYPE}" \
    SWARM_ID="${SWARM_ID:-default}" \
    MANAGER_TOKEN="${MANAGER_TOKEN:-}" \
    --app "${APP_NAME}"

# Create volume if it doesn't exist
echo -e "${YELLOW}💾 Creating volume...${NC}"
fly volumes create worker_data --size 1 --region "${REGION}" --app "${APP_NAME}"

# Deploy the worker
echo -e "${GREEN}🏗️  Deploying worker...${NC}"
fly deploy \
    --app "${APP_NAME}" \
    --config "fly-${WORKER_NAME}.toml" \
    --strategy immediate

# Scale workers if count > 1
if [ "$WORKER_COUNT" -gt 1 ]; then
    echo -e "${YELLOW}⚖️  Scaling to ${WORKER_COUNT} instances...${NC}"
    fly scale count "${WORKER_COUNT}" --app "${APP_NAME}"
fi

# Register worker with manager
echo -e "${YELLOW}📝 Registering worker with manager...${NC}"
if [ -n "${MANAGER_TOKEN:-}" ]; then
    curl -X POST "https://manager-app.fly.dev/workers/register" \
        -H "Authorization: Bearer ${MANAGER_TOKEN}" \
        -H "Content-Type: application/json" \
        -d '{
            "workerId": "'"${APP_NAME}"'",
            "workerType": "'"${WORKER_TYPE}"'",
            "region": "'"${REGION}"'",
            "capabilities": ["task-execution", "data-processing"],
            "internalUrl": "http://'"${APP_NAME}"'.internal:3000"
        }' || echo -e "${YELLOW}⚠️  Failed to register with manager (manager may not be running)${NC}"
fi

# Check deployment status
echo -e "${YELLOW}🔍 Checking deployment status...${NC}"
fly status --app "${APP_NAME}"

# Output summary
echo -e "${GREEN}✅ Worker deployed successfully!${NC}"
echo -e "${BLUE}📋 Worker Details:${NC}"
echo -e "  - App Name: ${APP_NAME}"
echo -e "  - Type: ${WORKER_TYPE}"
echo -e "  - Region: ${REGION}"
echo -e "  - Instances: ${WORKER_COUNT}"
echo -e "  - Internal URL: http://${APP_NAME}.internal:3000"

# Cleanup
rm -f "fly-${WORKER_NAME}.toml" "fly-${WORKER_NAME}.toml.bak"

# Show logs
echo -e "${YELLOW}📜 Recent logs:${NC}"
fly logs --app "${APP_NAME}" --limit 20