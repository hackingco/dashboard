#!/bin/bash

set -e

echo "🚀 Supabase Quick Setup"
echo "======================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if running from project root
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: Please run this script from the project root directory${NC}"
    exit 1
fi

# Create .env files if they don't exist
echo "📁 Setting up environment files..."

if [ ! -f "apps/dashboard/.env.local" ]; then
    cp apps/dashboard/.env.example apps/dashboard/.env.local
    echo -e "${GREEN}✓ Created apps/dashboard/.env.local${NC}"
else
    echo -e "${YELLOW}⚠ apps/dashboard/.env.local already exists${NC}"
fi

if [ ! -f "apps/manager/.env" ]; then
    cp apps/manager/.env.example apps/manager/.env
    echo -e "${GREEN}✓ Created apps/manager/.env${NC}"
else
    echo -e "${YELLOW}⚠ apps/manager/.env already exists${NC}"
fi

echo ""
echo -e "${BLUE}📋 Next Steps:${NC}"
echo ""
echo "1. Create a Supabase project:"
echo "   - Go to https://app.supabase.com"
echo "   - Click 'New project'"
echo "   - Name: swarm-orchestrator"
echo ""
echo "2. Get your credentials:"
echo "   - Settings → API"
echo "   - Copy: Project URL, anon key, service_role key"
echo ""
echo "3. Run the configuration wizard:"
echo -e "   ${GREEN}node scripts/supabase-wizard.js${NC}"
echo ""
echo "   Or manually update:"
echo "   - apps/dashboard/.env.local"
echo "   - apps/manager/.env"
echo ""
echo "4. Run the database migration:"
echo "   - Copy: supabase/migrations/001_initial_schema.sql"
echo "   - Paste in Supabase SQL Editor"
echo "   - Click RUN"
echo ""
echo "5. Enable realtime:"
echo "   - Database → Replication"
echo "   - Enable for: swarms, workers, tasks, logs, metrics"
echo ""
echo "6. Install and start:"
echo -e "   ${GREEN}pnpm install${NC}"
echo -e "   ${GREEN}pnpm --filter @swarm/supabase build${NC}"
echo -e "   ${GREEN}pnpm dev${NC}"
echo ""
echo -e "${YELLOW}💡 Tip: Run 'node scripts/supabase-wizard.js' for interactive setup${NC}"