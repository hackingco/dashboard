#!/bin/bash
# Claude Flow Docker Health Check Script

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Service endpoints
declare -A services=(
    ["Manager API"]="http://localhost:8080/health"
    ["Dashboard"]="http://localhost:3000/api/health"
    ["Langfuse"]="http://localhost:3001/api/health"
    ["Swarm Agent"]="http://localhost:8888"
    ["Redis"]="redis-cli -h localhost -p 6379 ping"
    ["PostgreSQL"]="pg_isready -h localhost -p 5432"
    ["Prometheus"]="http://localhost:9090/-/healthy"
    ["Grafana"]="http://localhost:3002/api/health"
)

echo -e "${BLUE}Claude Flow Health Check${NC}"
echo -e "${BLUE}========================${NC}\n"

# Function to check HTTP endpoint
check_http() {
    local name=$1
    local url=$2
    
    if curl -s -f -o /dev/null "$url"; then
        echo -e "${GREEN}✓${NC} $name: ${GREEN}Healthy${NC}"
        return 0
    else
        echo -e "${RED}✗${NC} $name: ${RED}Unhealthy${NC}"
        return 1
    fi
}

# Function to check command
check_command() {
    local name=$1
    local cmd=$2
    
    if eval "$cmd" &>/dev/null; then
        echo -e "${GREEN}✓${NC} $name: ${GREEN}Healthy${NC}"
        return 0
    else
        echo -e "${RED}✗${NC} $name: ${RED}Unhealthy${NC}"
        return 1
    fi
}

# Check all services
total=0
healthy=0

for service in "${!services[@]}"; do
    endpoint="${services[$service]}"
    ((total++))
    
    if [[ $endpoint == http* ]]; then
        if check_http "$service" "$endpoint"; then
            ((healthy++))
        fi
    else
        if check_command "$service" "$endpoint"; then
            ((healthy++))
        fi
    fi
done

echo -e "\n${BLUE}Summary:${NC} $healthy/$total services healthy"

# Check Docker containers
echo -e "\n${BLUE}Docker Containers:${NC}"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "(claude-flow|swarm)" || echo "No Claude Flow containers running"

# Check resource usage
echo -e "\n${BLUE}Resource Usage:${NC}"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}" | grep -E "(claude-flow|swarm)" || echo "No resource data available"

# Exit with appropriate code
if [ $healthy -eq $total ]; then
    echo -e "\n${GREEN}All systems operational!${NC}"
    exit 0
else
    echo -e "\n${YELLOW}Some services are unhealthy${NC}"
    exit 1
fi