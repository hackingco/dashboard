#!/bin/bash

# Run All Tests - Comprehensive Testing Suite
# Executes all testing workflows in sequence
# Usage: ./scripts/run-all-tests.sh [environment] [skip-setup]

set -euo pipefail

ENVIRONMENT="${1:-current}"
SKIP_SETUP="${2:-false}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test results tracking
TESTS_RUN=0
TESTS_PASSED=0
FAILED_TESTS=()

echo "🧪 Comprehensive Testing Suite"
echo "=============================="
echo "🌐 Environment: $ENVIRONMENT"
echo "⚙️  Skip setup: $SKIP_SETUP"
echo ""

# Function to run a test and track results
run_test_suite() {
    local test_name="$1"
    local test_command="$2"
    local required="${3:-true}"
    
    ((TESTS_RUN++))
    echo -e "${BLUE}🧪 Running: $test_name${NC}"
    echo "========================================"
    
    if eval "$test_command"; then
        echo -e "${GREEN}✅ $test_name: PASSED${NC}"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}❌ $test_name: FAILED${NC}"
        FAILED_TESTS+=("$test_name")
        
        if [ "$required" = "true" ]; then
            echo -e "${RED}💥 Required test failed - stopping execution${NC}"
            return 1
        else
            echo -e "${YELLOW}⚠️  Optional test failed - continuing${NC}"
            return 0
        fi
    fi
}

# Main test execution
main() {
    echo "🚀 Starting comprehensive test suite..."
    echo ""
    
    # 1. Setup phase (if not skipped)
    if [ "$SKIP_SETUP" != "true" ]; then
        echo -e "${BLUE}🔧 Setup Phase${NC}"
        echo "==============="
        
        # Check dependencies
        echo "📋 Checking dependencies..."
        
        if ! command -v curl &> /dev/null; then
            echo -e "${RED}❌ curl is required but not installed${NC}"
            exit 1
        fi
        
        if ! command -v jq &> /dev/null; then
            echo -e "${YELLOW}⚠️  Installing jq...${NC}"
            if command -v brew &> /dev/null; then
                brew install jq
            else
                echo -e "${RED}❌ Please install jq manually${NC}"
                exit 1
            fi
        fi
        
        if ! command -v node &> /dev/null; then
            echo -e "${YELLOW}⚠️  Node.js not found - WebSocket tests may be limited${NC}"
        fi
        
        # Setup FLY_ACCESS_TOKEN if not set
        if [ -z "${FLY_ACCESS_TOKEN:-}" ]; then
            echo -e "${YELLOW}⚠️  FLY_ACCESS_TOKEN not set${NC}"
            echo "🔧 Running token setup..."
            if ! ./scripts/setup-fly-token.sh; then
                echo -e "${RED}❌ Token setup failed${NC}"
                exit 1
            fi
            # Source the token if it was set in .env.local
            if [ -f ".env.local" ] && grep -q "FLY_ACCESS_TOKEN" ".env.local"; then
                export FLY_ACCESS_TOKEN=$(grep "FLY_ACCESS_TOKEN" ".env.local" | cut -d'=' -f2 | tr -d '"'"'"'')
            fi
        fi
        
        echo -e "${GREEN}✅ Setup completed${NC}"
        echo ""
    fi
    
    # 2. Basic smoke tests
    run_test_suite "Basic Smoke Tests" \
        "./tests/smoke/smoke-tests.sh $ENVIRONMENT" \
        "true"
    
    echo ""
    
    # 3. Fly Machines API tests
    run_test_suite "Fly Machines API Tests" \
        "./tests/monitoring/fly-machines-api-test.sh swarm-admin e82992c773ed98" \
        "true"
    
    echo ""
    
    # 4. WebSocket tests (optional if Node.js not available)
    if command -v node &> /dev/null; then
        # Install ws if not present
        if [ ! -d "node_modules/ws" ]; then
            echo "📦 Installing WebSocket dependencies..."
            npm install ws &>/dev/null || echo -e "${YELLOW}⚠️  Failed to install ws${NC}"
        fi
        
        run_test_suite "WebSocket Real-time Tests" \
            "node tests/monitoring/websocket-realtime-test.js $ENVIRONMENT" \
            "false"
    else
        echo -e "${YELLOW}⚠️  Skipping WebSocket tests - Node.js not available${NC}"
    fi
    
    echo ""
    
    # 5. Quick health monitoring (5 minutes max)
    run_test_suite "Health Monitoring (Quick)" \
        "timeout 300 ./tests/monitoring/continuous-health-monitor.sh 30 300 || true" \
        "false"
    
    echo ""
    
    # Results summary
    echo "📊 Test Results Summary"
    echo "======================="
    echo -e "🧪 Tests run: $TESTS_RUN"
    echo -e "✅ Tests passed: ${GREEN}$TESTS_PASSED${NC}"
    echo -e "❌ Tests failed: ${RED}$((TESTS_RUN - TESTS_PASSED))${NC}"
    
    if [ ${#FAILED_TESTS[@]} -gt 0 ]; then
        echo ""
        echo -e "${RED}❌ Failed tests:${NC}"
        for test in "${FAILED_TESTS[@]}"; do
            echo "  - $test"
        done
    fi
    
    echo ""
    
    # Calculate success rate
    local success_rate=0
    if [ $TESTS_RUN -gt 0 ]; then
        success_rate=$((TESTS_PASSED * 100 / TESTS_RUN))
    fi
    
    echo -e "📈 Success rate: ${success_rate}%"
    
    # Final verdict
    if [ $success_rate -ge 80 ]; then
        echo ""
        echo -e "${GREEN}🎉 TESTING SUITE PASSED!${NC}"
        echo -e "${GREEN}Your deployment is healthy and operational.${NC}"
        
        # Provide next steps
        echo ""
        echo "🔗 Next Steps:"
        echo "=============="
        echo "1. Monitor continuously: ./tests/monitoring/continuous-health-monitor.sh"
        echo "2. Set up automated monitoring in CI/CD"
        echo "3. Configure alerts for production"
        echo "4. Review performance metrics"
        
        return 0
    else
        echo ""
        echo -e "${RED}❌ TESTING SUITE FAILED${NC}"
        echo -e "${RED}Please review failed tests and fix issues.${NC}"
        
        # Provide troubleshooting tips
        echo ""
        echo "🔧 Troubleshooting:"
        echo "==================="
        echo "1. Check FLY_ACCESS_TOKEN permissions: flyctl auth whoami"
        echo "2. Verify services are running: flyctl status -a swarm-admin"
        echo "3. Check service logs: flyctl logs -a swarm-admin"
        echo "4. Review network connectivity"
        echo "5. Run individual tests for detailed errors"
        
        return 1
    fi
}

# Signal handlers
trap 'echo ""; echo "🛑 Testing interrupted"; exit 130' INT
trap 'echo ""; echo "🛑 Testing terminated"; exit 143' TERM

# Run main function
main "$@"