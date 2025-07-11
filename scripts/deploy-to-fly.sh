#!/bin/bash

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🚀 Fly.io Deployment Script${NC}"
echo -e "${BLUE}=========================${NC}\n"

# Check if authenticated
echo -e "${YELLOW}Checking Fly.io authentication...${NC}"
if ! fly auth whoami &> /dev/null; then
    echo -e "${RED}❌ Not authenticated with Fly.io${NC}"
    echo -e "${YELLOW}Please run: fly auth login${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Authenticated as: $(fly auth whoami)${NC}\n"

# Function to deploy an app
deploy_app() {
    local app_name=$1
    local app_path=$2
    
    echo -e "${BLUE}📦 Deploying ${app_name}...${NC}"
    
    # Check if app exists
    if fly apps list | grep -q "$app_name"; then
        echo -e "${YELLOW}App $app_name already exists${NC}"
    else
        echo -e "${YELLOW}Creating app $app_name...${NC}"
        fly apps create "$app_name" --org personal || true
    fi
    
    # Deploy
    cd "$app_path"
    
    # Check if fly.toml exists
    if [ ! -f "fly.toml" ]; then
        echo -e "${RED}❌ No fly.toml found in $app_path${NC}"
        return 1
    fi
    
    # Update fly.toml with app name
    sed -i.bak "s/^app = .*/app = \"$app_name\"/" fly.toml
    
    # Deploy
    echo -e "${YELLOW}Deploying to Fly.io...${NC}"
    if fly deploy --remote-only; then
        echo -e "${GREEN}✅ $app_name deployed successfully!${NC}"
        
        # Show app info
        echo -e "${BLUE}App URL: https://$app_name.fly.dev${NC}"
        fly status --app "$app_name"
    else
        echo -e "${RED}❌ Failed to deploy $app_name${NC}"
        return 1
    fi
    
    cd - > /dev/null
    echo ""
}

# Check environment variables
echo -e "${YELLOW}Checking environment variables...${NC}"

# Manager environment
if [ -f "apps/manager/.env" ]; then
    echo -e "${GREEN}✅ Manager .env found${NC}"
    
    # Set secrets for manager
    echo -e "${YELLOW}Setting manager secrets...${NC}"
    while IFS='=' read -r key value; do
        if [[ ! -z "$key" && ! "$key" =~ ^# && ! -z "$value" ]]; then
            fly secrets set "$key=$value" --app swarm-manager-prod &> /dev/null && \
                echo -e "   ${GREEN}✓ $key${NC}"
        fi
    done < apps/manager/.env
else
    echo -e "${YELLOW}⚠️  No manager .env found${NC}"
fi

echo ""

# Deploy Manager
deploy_app "swarm-manager-prod" "apps/manager"

# Deploy Dashboard
echo -e "${YELLOW}Setting dashboard environment...${NC}"
if [ -f "apps/dashboard/.env.local" ]; then
    # Update manager URL for production
    export MANAGER_URL="https://swarm-manager-prod.fly.dev"
    echo -e "   ${GREEN}✓ MANAGER_URL set to production${NC}"
fi

deploy_app "swarm-dashboard-prod" "apps/dashboard"

# Summary
echo -e "${BLUE}🎉 Deployment Summary${NC}"
echo -e "${BLUE}====================${NC}\n"

echo -e "${GREEN}Manager API:${NC} https://swarm-manager-prod.fly.dev"
echo -e "${GREEN}Dashboard:${NC} https://swarm-dashboard-prod.fly.dev"
echo ""

echo -e "${YELLOW}Next steps:${NC}"
echo -e "1. Update your Supabase project to allow connections from Fly.io"
echo -e "2. Add your custom domain (optional): fly certs add yourdomain.com"
echo -e "3. Scale if needed: fly scale count 2 --app swarm-manager-prod"
echo -e "4. Monitor: fly logs --app swarm-manager-prod"
echo ""

echo -e "${GREEN}✅ Deployment complete!${NC}"