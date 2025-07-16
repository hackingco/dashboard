#!/bin/bash

# Docker Setup Validation Script
# Validates the complete Docker Compose setup for Langfuse testing

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Validation functions
validate_files() {
    log "Validating required files..."
    
    local required_files=(
        "docker-compose.langfuse.yml"
        ".env.docker"
        "Dockerfile.swarm"
        "scripts/docker-deploy.sh"
        "config/postgres/init-langfuse.sql"
        "monitoring/prometheus.yml"
        "monitoring/grafana/provisioning/datasources/prometheus.yml"
        ".dockerignore"
    )
    
    local missing_files=0
    
    for file in "${required_files[@]}"; do
        if [ ! -f "$file" ]; then
            error "Missing required file: $file"
            ((missing_files++))
        else
            echo "  ✓ $file"
        fi
    done
    
    if [ $missing_files -eq 0 ]; then
        success "All required files present"
    else
        error "$missing_files files missing"
        return 1
    fi
}

validate_docker() {
    log "Validating Docker installation..."
    
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed"
        return 1
    fi
    
    if ! docker info &> /dev/null; then
        error "Docker daemon is not running"
        return 1
    fi
    
    local docker_version=$(docker --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')
    echo "  ✓ Docker version: $docker_version"
    
    if ! command -v docker compose &> /dev/null && ! docker compose version &> /dev/null; then
        error "Docker Compose is not installed"
        return 1
    fi
    
    success "Docker installation validated"
}

validate_ports() {
    log "Validating port availability..."
    
    local required_ports=(3000 5432 6379 8001 8002 8003 9090 3001)
    local occupied_ports=0
    
    for port in "${required_ports[@]}"; do
        if lsof -i ":$port" &> /dev/null; then
            warning "Port $port is already in use"
            ((occupied_ports++))
        else
            echo "  ✓ Port $port available"
        fi
    done
    
    if [ $occupied_ports -eq 0 ]; then
        success "All ports available"
    else
        warning "$occupied_ports ports are occupied (may cause conflicts)"
    fi
}

validate_compose_syntax() {
    log "Validating Docker Compose syntax..."
    
    if docker compose -f docker-compose.langfuse.yml config &> /dev/null; then
        success "Docker Compose syntax is valid"
    else
        error "Docker Compose syntax validation failed"
        docker compose -f docker-compose.langfuse.yml config
        return 1
    fi
}

validate_environment() {
    log "Validating environment configuration..."
    
    if [ ! -f ".env.docker" ]; then
        error "Environment file .env.docker not found"
        return 1
    fi
    
    # Check for critical environment variables
    local required_vars=(
        "LANGFUSE_PUBLIC_KEY"
        "LANGFUSE_SECRET_KEY"
        "LANGFUSE_HOST"
        "SWARM_ID"
        "POSTGRES_PASSWORD"
    )
    
    local missing_vars=0
    
    for var in "${required_vars[@]}"; do
        if ! grep -q "^${var}=" .env.docker; then
            error "Missing environment variable: $var"
            ((missing_vars++))
        else
            echo "  ✓ $var configured"
        fi
    done
    
    if [ $missing_vars -eq 0 ]; then
        success "Environment configuration validated"
    else
        error "$missing_vars environment variables missing"
        return 1
    fi
}

validate_permissions() {
    log "Validating file permissions..."
    
    if [ ! -x "scripts/docker-deploy.sh" ]; then
        warning "docker-deploy.sh is not executable, fixing..."
        chmod +x scripts/docker-deploy.sh
    fi
    
    if [ ! -x "scripts/validate-docker-setup.sh" ]; then
        warning "validate-docker-setup.sh is not executable, fixing..."
        chmod +x scripts/validate-docker-setup.sh
    fi
    
    success "File permissions validated"
}

validate_langfuse_wrapper() {
    log "Validating Langfuse wrapper..."
    
    if [ ! -d "shared/langfuse-wrapper" ]; then
        error "Langfuse wrapper directory not found"
        return 1
    fi
    
    if [ ! -f "shared/langfuse-wrapper/package.json" ]; then
        error "Langfuse wrapper package.json not found"
        return 1
    fi
    
    if [ ! -f "shared/langfuse-wrapper/src/index.ts" ]; then
        error "Langfuse wrapper main file not found"
        return 1
    fi
    
    success "Langfuse wrapper validated"
}

show_usage_instructions() {
    log "Setup validation completed successfully!"
    echo
    echo "🚀 Next Steps:"
    echo
    echo "1. Start the environment:"
    echo "   ./scripts/docker-deploy.sh start"
    echo
    echo "2. Check service status:"
    echo "   ./scripts/docker-deploy.sh status"
    echo
    echo "3. Run tests:"
    echo "   ./scripts/docker-deploy.sh test"
    echo
    echo "4. Setup monitoring (optional):"
    echo "   ./scripts/docker-deploy.sh monitoring"
    echo
    echo "5. View logs:"
    echo "   ./scripts/docker-deploy.sh logs"
    echo
    echo "🔗 Service URLs (after starting):"
    echo "   Langfuse UI:      http://localhost:3000"
    echo "   Swarm Manager:    http://localhost:8001"
    echo "   Prometheus:       http://localhost:9090"
    echo "   Grafana:          http://localhost:3001"
    echo
    echo "📚 Documentation: DOCKER_SETUP_README.md"
    echo
}

# Main validation
main() {
    echo "🐳 Docker Setup Validation for Langfuse Wrapper Testing"
    echo "======================================================"
    echo
    
    local validation_passed=true
    
    validate_files || validation_passed=false
    echo
    
    validate_docker || validation_passed=false
    echo
    
    validate_compose_syntax || validation_passed=false
    echo
    
    validate_environment || validation_passed=false
    echo
    
    validate_permissions || validation_passed=false
    echo
    
    validate_langfuse_wrapper || validation_passed=false
    echo
    
    validate_ports
    echo
    
    if [ "$validation_passed" = true ]; then
        success "🎉 All validations passed!"
        show_usage_instructions
        exit 0
    else
        error "❌ Some validations failed. Please fix the issues and run again."
        exit 1
    fi
}

# Run validation
main "$@"