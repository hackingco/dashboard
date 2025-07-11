#!/bin/bash

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${BOLD}${BLUE}🔍 SUPABASE VERIFICATION${NC}"
echo -e "${BOLD}${BLUE}=======================${NC}\n"

ALL_GOOD=true

# Check environment files
echo -e "${CYAN}📁 Checking Environment Files...${NC}"

if [ -f "apps/dashboard/.env.local" ]; then
    echo -e "${GREEN}✅ Found apps/dashboard/.env.local${NC}"
    
    # Check for required keys
    if grep -q "NEXT_PUBLIC_SUPABASE_URL=" "apps/dashboard/.env.local"; then
        echo -e "   ${GREEN}✓ NEXT_PUBLIC_SUPABASE_URL${NC}"
    else
        echo -e "   ${RED}✗ NEXT_PUBLIC_SUPABASE_URL missing${NC}"
        ALL_GOOD=false
    fi
    
    if grep -q "NEXT_PUBLIC_SUPABASE_ANON_KEY=" "apps/dashboard/.env.local"; then
        echo -e "   ${GREEN}✓ NEXT_PUBLIC_SUPABASE_ANON_KEY${NC}"
    else
        echo -e "   ${RED}✗ NEXT_PUBLIC_SUPABASE_ANON_KEY missing${NC}"
        ALL_GOOD=false
    fi
else
    echo -e "${RED}❌ Missing apps/dashboard/.env.local${NC}"
    ALL_GOOD=false
fi

echo ""

if [ -f "apps/manager/.env" ]; then
    echo -e "${GREEN}✅ Found apps/manager/.env${NC}"
    
    # Check for required keys
    if grep -q "SUPABASE_URL=" "apps/manager/.env"; then
        echo -e "   ${GREEN}✓ SUPABASE_URL${NC}"
    else
        echo -e "   ${RED}✗ SUPABASE_URL missing${NC}"
        ALL_GOOD=false
    fi
    
    if grep -q "SUPABASE_SERVICE_ROLE_KEY=" "apps/manager/.env"; then
        echo -e "   ${GREEN}✓ SUPABASE_SERVICE_ROLE_KEY${NC}"
    else
        echo -e "   ${RED}✗ SUPABASE_SERVICE_ROLE_KEY missing${NC}"
        ALL_GOOD=false
    fi
    
    if grep -q "FLY_API_TOKEN=" "apps/manager/.env"; then
        echo -e "   ${GREEN}✓ FLY_API_TOKEN${NC}"
    else
        echo -e "   ${YELLOW}⚠ FLY_API_TOKEN missing (optional)${NC}"
    fi
else
    echo -e "${RED}❌ Missing apps/manager/.env${NC}"
    ALL_GOOD=false
fi

echo ""

# Check if values are not just placeholders
echo -e "${CYAN}📋 Checking Configuration Values...${NC}"

if [ -f "apps/dashboard/.env.local" ]; then
    URL=$(grep "NEXT_PUBLIC_SUPABASE_URL=" "apps/dashboard/.env.local" | cut -d'=' -f2)
    if [[ "$URL" == *"supabase.co"* ]]; then
        echo -e "${GREEN}✅ Supabase URL looks valid${NC}"
    elif [[ "$URL" == *"your-project"* ]] || [ -z "$URL" ]; then
        echo -e "${RED}❌ Supabase URL is still a placeholder${NC}"
        ALL_GOOD=false
    fi
    
    KEY=$(grep "NEXT_PUBLIC_SUPABASE_ANON_KEY=" "apps/dashboard/.env.local" | cut -d'=' -f2)
    if [[ "$KEY" == "eyJ"* ]] && [ ${#KEY} -gt 50 ]; then
        echo -e "${GREEN}✅ Anon key looks valid${NC}"
    elif [[ "$KEY" == *"your-anon-key"* ]] || [ -z "$KEY" ]; then
        echo -e "${RED}❌ Anon key is still a placeholder${NC}"
        ALL_GOOD=false
    fi
fi

echo ""

# Check dependencies
echo -e "${CYAN}📦 Checking Dependencies...${NC}"

if [ -d "node_modules" ]; then
    echo -e "${GREEN}✅ node_modules exists${NC}"
    
    if [ -d "node_modules/@supabase/supabase-js" ]; then
        echo -e "   ${GREEN}✓ @supabase/supabase-js installed${NC}"
    else
        echo -e "   ${YELLOW}⚠ @supabase/supabase-js not installed${NC}"
        echo -e "   ${YELLOW}  Run: pnpm install${NC}"
    fi
else
    echo -e "${YELLOW}⚠️ Dependencies not installed${NC}"
    echo -e "   Run: ${CYAN}pnpm install${NC}"
fi

echo ""

# Check if shared packages are built
echo -e "${CYAN}🔨 Checking Built Packages...${NC}"

if [ -d "shared/supabase/dist" ]; then
    echo -e "${GREEN}✅ @swarm/supabase is built${NC}"
else
    echo -e "${YELLOW}⚠️ @swarm/supabase not built${NC}"
    echo -e "   Run: ${CYAN}pnpm --filter @swarm/supabase build${NC}"
fi

echo ""

# Summary
echo -e "${BOLD}${CYAN}📊 VERIFICATION SUMMARY${NC}"
echo -e "${CYAN}======================${NC}\n"

if [ "$ALL_GOOD" = true ]; then
    echo -e "${BOLD}${GREEN}✅ Basic configuration looks good!${NC}\n"
    echo -e "${BOLD}Next Steps:${NC}"
    echo -e "1. Install dependencies: ${CYAN}pnpm install${NC}"
    echo -e "2. Build packages: ${CYAN}pnpm --filter @swarm/supabase build${NC}"
    echo -e "3. Run full verification: ${CYAN}node scripts/verify-supabase.js${NC}"
    echo -e "4. Start services: ${CYAN}pnpm dev${NC}"
else
    echo -e "${BOLD}${YELLOW}⚠️  Configuration needs attention${NC}\n"
    echo -e "${BOLD}To fix:${NC}"
    echo -e "1. Run setup wizard: ${CYAN}node scripts/supabase-wizard.js${NC}"
    echo -e "2. Or manually update .env files with your Supabase credentials"
fi

echo ""
echo -e "${BOLD}Quick Checks:${NC}"
echo -e "• Supabase dashboard: ${CYAN}https://app.supabase.com${NC}"
echo -e "• Visual guide: ${CYAN}docs/SUPABASE_VISUAL_GUIDE.md${NC}"
echo -e "• Full setup: ${CYAN}SUPABASE_SETUP.md${NC}"
echo ""