#!/bin/bash

# Supabase Backend Setup Script
# Sets up the complete Supabase backend infrastructure for the Swarm Dashboard

set -e

echo "🚀 Setting up Supabase Backend for Swarm Dashboard..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SUPABASE_DIR="./supabase"
ENV_FILE=".env.supabase"
COMPOSE_FILE="docker-compose.supabase.yml"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker first.${NC}"
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ docker-compose not found. Please install docker-compose.${NC}"
    exit 1
fi

echo -e "${BLUE}📋 Checking prerequisites...${NC}"

# Create Supabase directory structure
echo -e "${YELLOW}📁 Creating Supabase directory structure...${NC}"
mkdir -p "$SUPABASE_DIR/config"
mkdir -p "$SUPABASE_DIR/migrations"
mkdir -p "$SUPABASE_DIR/functions"
mkdir -p "$SUPABASE_DIR/storage"

# Copy environment file if it doesn't exist
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}⚙️  Creating environment configuration...${NC}"
    cp .env.supabase.example "$ENV_FILE"
    echo -e "${GREEN}✅ Created $ENV_FILE from example${NC}"
    echo -e "${YELLOW}⚠️  Please review and update the environment variables in $ENV_FILE${NC}"
else
    echo -e "${GREEN}✅ Environment file already exists${NC}"
fi

# Source environment variables
if [ -f "$ENV_FILE" ]; then
    echo -e "${BLUE}📖 Loading environment variables...${NC}"
    export $(grep -v '^#' "$ENV_FILE" | xargs)
fi

# Create Docker network if it doesn't exist
echo -e "${YELLOW}🌐 Setting up Docker network...${NC}"
if ! docker network inspect swarm-network >/dev/null 2>&1; then
    docker network create swarm-network
    echo -e "${GREEN}✅ Created swarm-network${NC}"
else
    echo -e "${GREEN}✅ Network swarm-network already exists${NC}"
fi

# Check if Kong config exists
if [ ! -f "$SUPABASE_DIR/config/kong.yml" ]; then
    echo -e "${RED}❌ Kong configuration file not found at $SUPABASE_DIR/config/kong.yml${NC}"
    echo -e "${YELLOW}Please ensure the Kong configuration is properly set up.${NC}"
    exit 1
fi

echo -e "${YELLOW}🐳 Starting Supabase services...${NC}"

# Start Supabase services
docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d

# Wait for database to be ready
echo -e "${BLUE}⏳ Waiting for database to be ready...${NC}"
sleep 10

# Check if database is accessible
DB_READY=false
for i in {1..30}; do
    if docker-compose -f "$COMPOSE_FILE" exec -T supabase-db pg_isready -U "${SUPABASE_DB_USER:-supabase}" > /dev/null 2>&1; then
        DB_READY=true
        break
    fi
    echo -e "${YELLOW}⏳ Waiting for database... (attempt $i/30)${NC}"
    sleep 2
done

if [ "$DB_READY" = false ]; then
    echo -e "${RED}❌ Database failed to start. Check Docker logs:${NC}"
    echo -e "${YELLOW}docker-compose -f $COMPOSE_FILE logs supabase-db${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Database is ready${NC}"

# Run database migrations
echo -e "${YELLOW}🗃️  Running database migrations...${NC}"
if [ -d "$SUPABASE_DIR/migrations" ] && [ "$(ls -A $SUPABASE_DIR/migrations)" ]; then
    for migration in "$SUPABASE_DIR/migrations"/*.sql; do
        if [ -f "$migration" ]; then
            echo -e "${BLUE}📄 Running migration: $(basename $migration)${NC}"
            docker-compose -f "$COMPOSE_FILE" exec -T supabase-db psql -U "${SUPABASE_DB_USER:-supabase}" -d "${SUPABASE_DB_NAME:-swarm_supabase}" -f "/docker-entrypoint-initdb.d/$(basename $migration)"
        fi
    done
    echo -e "${GREEN}✅ Database migrations completed${NC}"
else
    echo -e "${YELLOW}⚠️  No migration files found${NC}"
fi

# Wait for all services to be ready
echo -e "${BLUE}⏳ Waiting for all services to start...${NC}"
sleep 15

# Check service health
echo -e "${YELLOW}🏥 Checking service health...${NC}"

services=("supabase-db" "supabase-auth" "supabase-rest" "supabase-realtime" "supabase-storage" "supabase-kong")
all_healthy=true

for service in "${services[@]}"; do
    if docker-compose -f "$COMPOSE_FILE" ps "$service" | grep -q "Up"; then
        echo -e "${GREEN}✅ $service is running${NC}"
    else
        echo -e "${RED}❌ $service is not running${NC}"
        all_healthy=false
    fi
done

if [ "$all_healthy" = true ]; then
    echo -e "${GREEN}🎉 All Supabase services are running successfully!${NC}"
else
    echo -e "${RED}❌ Some services failed to start. Check the logs:${NC}"
    echo -e "${YELLOW}docker-compose -f $COMPOSE_FILE logs${NC}"
    exit 1
fi

# Display service URLs
echo -e "${BLUE}🔗 Service URLs:${NC}"
echo -e "${GREEN}📊 Supabase Studio (Admin Dashboard): http://localhost:${SUPABASE_STUDIO_PORT:-3005}${NC}"
echo -e "${GREEN}🔌 API Gateway (Kong): http://localhost:${SUPABASE_KONG_PORT:-8000}${NC}"
echo -e "${GREEN}🔑 Auth API: http://localhost:${SUPABASE_AUTH_PORT:-9999}${NC}"
echo -e "${GREEN}📡 REST API: http://localhost:${SUPABASE_REST_PORT:-3000}${NC}"
echo -e "${GREEN}⚡ Realtime API: http://localhost:${SUPABASE_REALTIME_PORT:-4000}${NC}"
echo -e "${GREEN}💾 Storage API: http://localhost:${SUPABASE_STORAGE_PORT:-5000}${NC}"
echo -e "${GREEN}🗄️  Database: localhost:${SUPABASE_DB_PORT:-5433}${NC}"

# Test API endpoints
echo -e "${YELLOW}🧪 Testing API endpoints...${NC}"

# Test Kong gateway
if curl -s "http://localhost:${SUPABASE_KONG_PORT:-8000}/rest/v1/" > /dev/null; then
    echo -e "${GREEN}✅ Kong API Gateway is accessible${NC}"
else
    echo -e "${RED}❌ Kong API Gateway is not accessible${NC}"
fi

# Test Auth API
if curl -s "http://localhost:${SUPABASE_AUTH_PORT:-9999}/health" > /dev/null; then
    echo -e "${GREEN}✅ Auth API is accessible${NC}"
else
    echo -e "${YELLOW}⚠️  Auth API health check failed (this might be normal)${NC}"
fi

# Display next steps
echo -e "${BLUE}📋 Next Steps:${NC}"
echo -e "${YELLOW}1. Update your dashboard environment variables:${NC}"
echo -e "   NEXT_PUBLIC_SUPABASE_URL=http://localhost:${SUPABASE_KONG_PORT:-8000}"
echo -e "   NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}"
echo -e "   SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}"
echo ""
echo -e "${YELLOW}2. Visit Supabase Studio: http://localhost:${SUPABASE_STUDIO_PORT:-3005}${NC}"
echo -e "${YELLOW}3. Start your dashboard: cd apps/dashboard && npm run dev${NC}"
echo -e "${YELLOW}4. Test the integration with the provided test scripts${NC}"
echo ""
echo -e "${GREEN}🚀 Supabase backend setup complete!${NC}"

# Optional: Run verification tests
read -p "Would you like to run verification tests? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}🧪 Running verification tests...${NC}"
    if [ -f "scripts/test-supabase-integration.js" ]; then
        node scripts/test-supabase-integration.js
    else
        echo -e "${YELLOW}⚠️  Test script not found. Skipping tests.${NC}"
    fi
fi