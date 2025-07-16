#!/bin/bash

# Performance Benchmarking Script for Optimized Docker Setup
set -e

echo "🚀 Swarm Performance Benchmarking Tool"
echo "====================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
COMPOSE_FILE=${1:-"docker-compose.optimized.yml"}
DURATION=${2:-60}
CONCURRENT_USERS=${3:-10}

echo -e "${YELLOW}Configuration:${NC}"
echo "- Compose file: $COMPOSE_FILE"
echo "- Test duration: ${DURATION}s"
echo "- Concurrent users: $CONCURRENT_USERS"
echo ""

# Function to check if services are ready
check_services() {
    echo -e "${YELLOW}Checking service health...${NC}"
    
    # Check manager health
    if curl -s -f http://localhost:8080/health > /dev/null; then
        echo -e "${GREEN}✓ Manager API is healthy${NC}"
    else
        echo -e "${RED}✗ Manager API is not responding${NC}"
        return 1
    fi
    
    # Check dashboard health
    if curl -s -f http://localhost:3000/api/health > /dev/null; then
        echo -e "${GREEN}✓ Dashboard is healthy${NC}"
    else
        echo -e "${RED}✗ Dashboard is not responding${NC}"
        return 1
    fi
    
    # Check Redis
    if docker-compose -f $COMPOSE_FILE exec -T redis redis-cli ping > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Redis is healthy${NC}"
    else
        echo -e "${RED}✗ Redis is not responding${NC}"
        return 1
    fi
    
    return 0
}

# Function to measure container resource usage
measure_resources() {
    echo -e "\n${YELLOW}Container Resource Usage:${NC}"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
}

# Function to run API load test
api_load_test() {
    echo -e "\n${YELLOW}Running API Load Test...${NC}"
    
    # Install hey if not present
    if ! command -v hey &> /dev/null; then
        echo "Installing hey load testing tool..."
        go install github.com/rakyll/hey@latest || {
            echo -e "${RED}Failed to install hey. Please install Go first.${NC}"
            return 1
        }
    fi
    
    # Test Manager API endpoints
    echo -e "\n${GREEN}Testing Manager API:${NC}"
    hey -z ${DURATION}s -c $CONCURRENT_USERS -q 10 http://localhost:8080/api/health || true
    
    # Test Dashboard
    echo -e "\n${GREEN}Testing Dashboard:${NC}"
    hey -z ${DURATION}s -c $CONCURRENT_USERS -q 10 http://localhost:3000/ || true
}

# Function to measure cold start time
measure_cold_start() {
    echo -e "\n${YELLOW}Measuring Cold Start Times...${NC}"
    
    # Stop services
    docker-compose -f $COMPOSE_FILE down
    
    # Clear caches
    docker system prune -f > /dev/null 2>&1
    
    # Measure startup time
    START_TIME=$(date +%s)
    docker-compose -f $COMPOSE_FILE up -d
    
    # Wait for services to be ready
    while ! check_services > /dev/null 2>&1; do
        sleep 1
    done
    
    END_TIME=$(date +%s)
    STARTUP_TIME=$((END_TIME - START_TIME))
    
    echo -e "${GREEN}✓ Cold start time: ${STARTUP_TIME}s${NC}"
}

# Function to test Langfuse batching
test_langfuse_batching() {
    echo -e "\n${YELLOW}Testing Langfuse Batch Performance...${NC}"
    
    # Create test script
    cat > /tmp/test-langfuse-batch.js << 'EOF'
const traces = [];
const batchSizes = [10, 50, 100, 500];

for (const size of batchSizes) {
    const start = Date.now();
    
    // Simulate batch of traces
    const batch = [];
    for (let i = 0; i < size; i++) {
        batch.push({
            id: `test-${Date.now()}-${i}`,
            name: `Test Trace ${i}`,
            timestamp: new Date().toISOString(),
            metadata: {
                batchTest: true,
                batchSize: size
            }
        });
    }
    
    // Send batch (simulated)
    const payload = JSON.stringify({ batch });
    const elapsed = Date.now() - start;
    
    console.log(`Batch size ${size}: ${elapsed}ms (${(size/elapsed*1000).toFixed(2)} traces/sec)`);
}
EOF

    node /tmp/test-langfuse-batch.js
    rm /tmp/test-langfuse-batch.js
}

# Function to generate performance report
generate_report() {
    echo -e "\n${YELLOW}Generating Performance Report...${NC}"
    
    REPORT_FILE="performance-report-$(date +%Y%m%d-%H%M%S).md"
    
    cat > $REPORT_FILE << EOF
# Performance Benchmark Report

**Date:** $(date)
**Configuration:** $COMPOSE_FILE

## Container Resource Usage
\`\`\`
$(docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}")
\`\`\`

## Docker Image Sizes
\`\`\`
$(docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" | grep -E "(swarm|dashboard|manager|redis|nginx)")
\`\`\`

## Network Performance
\`\`\`
$(docker network inspect swarm-network -f '{{json .}}' | jq -r '.Containers | to_entries | map("\(.value.Name): \(.value.IPv4Address)") | .[]' 2>/dev/null || echo "Network info not available")
\`\`\`

## Optimizations Applied
- Multi-stage Docker builds with cache optimization
- Resource limits and reservations configured
- Nginx caching and compression enabled
- Redis memory optimization with LRU eviction
- Langfuse batching with configurable size
- Health checks and graceful shutdowns
- Logging optimization with compression

## Recommendations
1. Monitor actual production workload to fine-tune resource limits
2. Consider implementing horizontal scaling for high traffic
3. Use external Redis cluster for better performance
4. Enable CDN for static assets in production
5. Implement proper monitoring and alerting
EOF

    echo -e "${GREEN}✓ Report saved to: $REPORT_FILE${NC}"
}

# Main execution
main() {
    echo -e "\n${YELLOW}Starting performance benchmark...${NC}\n"
    
    # Ensure services are running
    if ! docker-compose -f $COMPOSE_FILE ps | grep -q "Up"; then
        echo "Starting services..."
        docker-compose -f $COMPOSE_FILE up -d
        sleep 10
    fi
    
    # Run benchmarks
    check_services || exit 1
    measure_resources
    api_load_test
    test_langfuse_batching
    
    # Optional: measure cold start
    read -p "Measure cold start time? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        measure_cold_start
    fi
    
    # Generate report
    generate_report
    
    echo -e "\n${GREEN}✓ Performance benchmark completed!${NC}"
}

# Run main function
main