# Swarm Container Build Infrastructure

Built by Builder-2 Agent for Enterprise Swarm Platform with Langfuse Integration

## Overview

This container infrastructure provides comprehensive Docker support for the Swarm orchestration platform with:

- **Multi-stage Dockerfiles** for optimized builds
- **Health check system** with comprehensive monitoring
- **Langfuse integration** for observability tracing
- **Automated build scripts** with parallel building
- **Development environment** with Docker Compose
- **Production-ready configuration** with monitoring stack

## Files Created

### Core Container Files
- `Dockerfile.manager` - Multi-stage Dockerfile for Swarm Manager
- `Dockerfile.worker` - Multi-stage Dockerfile for Swarm Worker
- `docker/entrypoint.sh` - Smart startup script with initialization
- `docker/health-check.sh` - Comprehensive health monitoring
- `scripts/build-containers.sh` - Automated build script with parallel support

### Development Environment
- `docker-compose.containers.yml` - Complete development stack
- `.env.container` - Environment variables template
- `config/nginx/nginx.conf` - Reverse proxy configuration
- `config/postgres/init.sql` - Database initialization
- `monitoring/prometheus.yml` - Metrics collection configuration

## Quick Start

### 1. Build Containers
```bash
# Make build script executable
chmod +x scripts/build-containers.sh

# Build all containers
./scripts/build-containers.sh

# Build with custom registry and tag
./scripts/build-containers.sh -r myregistry.com/swarm -t v1.0.0

# Build and push to registry
./scripts/build-containers.sh -r myregistry.com/swarm -t v1.0.0 --push
```

### 2. Development Environment
```bash
# Copy environment template
cp .env.container .env

# Edit environment variables
nano .env

# Start development stack
docker-compose -f docker-compose.containers.yml up -d

# View logs
docker-compose -f docker-compose.containers.yml logs -f

# Stop stack
docker-compose -f docker-compose.containers.yml down
```

### 3. Production Deployment
```bash
# Build production images
./scripts/build-containers.sh -r production-registry.com/swarm -t v1.0.0 --push

# Deploy with production environment
docker-compose -f docker-compose.containers.yml --env-file .env.production up -d
```

## Container Features

### Manager Container (`Dockerfile.manager`)
- **Node.js 18 Alpine** base with security hardening
- **Multi-stage build** for optimized size and security
- **Langfuse wrapper** integration for tracing
- **SQLite database** for coordination
- **Health check endpoints** with comprehensive monitoring
- **Non-root user** for security
- **Signal handling** for graceful shutdown

### Worker Container (`Dockerfile.worker`)
- **Lightweight worker** optimized for task execution
- **Manager connectivity** with automatic discovery
- **Shared coordination** through volume mounts
- **Independent health monitoring**
- **Resource-optimized** configuration

### Smart Entrypoint (`docker/entrypoint.sh`)
- **Environment validation** with comprehensive checks
- **Database initialization** with automatic setup
- **Langfuse integration** with connection testing
- **Claude Flow hooks** integration
- **Graceful shutdown** handling
- **Logging setup** with rotation

### Health Check (`docker/health-check.sh`)
- **HTTP endpoint** monitoring
- **Port availability** checking
- **Process monitoring** verification
- **Database connectivity** testing
- **Langfuse integration** validation
- **Resource usage** monitoring (disk, memory)
- **Retry logic** with exponential backoff

## Build Script Features

### Parallel Building
```bash
# Build manager and worker simultaneously
./scripts/build-containers.sh --parallel

# Sequential building for resource-constrained environments
./scripts/build-containers.sh --sequential
```

### Security Scanning
```bash
# Include security scanning (requires trivy)
./scripts/build-containers.sh --scan

# Skip security scanning
./scripts/build-containers.sh --no-scan
```

### Image Testing
```bash
# Test built images
./scripts/build-containers.sh --test

# Skip testing
./scripts/build-containers.sh --no-test
```

### Cache Optimization
```bash
# Use cache from previous build
./scripts/build-containers.sh --cache-from myregistry.com/swarm/manager:latest

# Build with custom build args
./scripts/build-containers.sh --build-args "--build-arg NODE_ENV=production"
```

## Environment Configuration

### Required Environment Variables
```bash
# Core configuration
NODE_ENV=production
PORT=3000
SWARM_ROLE=manager|worker

# Langfuse integration
LANGFUSE_ENABLED=true
LANGFUSE_PUBLIC_KEY=pk_...
LANGFUSE_SECRET_KEY=sk_...
LANGFUSE_HOST=https://cloud.langfuse.com

# Database
DATABASE_PATH=/app/data/swarm.db
```

### Optional Environment Variables
```bash
# Supabase integration
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Fly.io integration
FLY_API_TOKEN=fly_...
FLY_APP_NAME=my-swarm-app

# Performance tuning
NODE_OPTIONS=--max-old-space-size=2048
UV_THREADPOOL_SIZE=4
```

## Docker Compose Services

### Core Services
- **swarm-manager** - Main orchestration service
- **swarm-worker** - Task execution service
- **redis** - Coordination and caching
- **postgres** - Persistent data storage

### Infrastructure Services
- **nginx** - Reverse proxy and load balancer
- **prometheus** - Metrics collection (optional)
- **grafana** - Metrics visualization (optional)

### Service Discovery
Services are accessible via hostnames:
- `swarm-manager:3000` - Manager API
- `swarm-worker:3002` - Worker API
- `redis:6379` - Redis cache
- `postgres:5432` - PostgreSQL database

## Monitoring and Observability

### Health Endpoints
- Manager: `http://localhost:3000/health`
- Worker: `http://localhost:3002/health`
- Nginx: `http://localhost/health`

### Metrics Collection
- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3080`
- Application metrics: `/metrics` endpoint on each service

### Langfuse Integration
- Automatic trace collection for all operations
- Performance monitoring and optimization
- Error tracking and analysis
- Token usage analytics

## Volume Management

### Persistent Volumes
- `swarm_manager_data` - Manager database and files
- `swarm_worker_data` - Worker data and cache
- `swarm_coordination` - Shared coordination data
- `swarm_postgres_data` - PostgreSQL database
- `swarm_redis_data` - Redis persistence

### Log Volumes
- `swarm_manager_logs` - Manager application logs
- `swarm_worker_logs` - Worker application logs
- `swarm_nginx_logs` - Nginx access and error logs

## Security Features

### Container Security
- **Non-root user** execution
- **Minimal base images** (Alpine Linux)
- **Security scanning** integration
- **Resource limits** configuration
- **Network isolation** with custom networks

### Access Control
- **Rate limiting** via Nginx
- **CORS configuration** for API access
- **Health check isolation**
- **Database permissions** with read-only users

## Troubleshooting

### Build Issues
```bash
# Check Docker daemon
docker info

# View build logs
./scripts/build-containers.sh --verbose

# Clean build cache
docker builder prune -f
```

### Runtime Issues
```bash
# Check container health
docker-compose -f docker-compose.containers.yml ps

# View container logs
docker-compose -f docker-compose.containers.yml logs swarm-manager

# Execute health check manually
docker exec swarm-manager ./health-check.sh

# Check coordination database
docker exec swarm-manager sqlite3 /app/.swarm/coordination.db ".tables"
```

### Performance Issues
```bash
# Monitor resource usage
docker stats

# Check Langfuse connectivity
docker exec swarm-manager curl -s https://cloud.langfuse.com/api/public/health

# View metrics
curl http://localhost:3000/metrics
```

## Development Workflow

### 1. Code Changes
```bash
# Rebuild specific service
docker-compose -f docker-compose.containers.yml build swarm-manager

# Restart service
docker-compose -f docker-compose.containers.yml restart swarm-manager
```

### 2. Testing
```bash
# Run test suite
./scripts/build-containers.sh --test

# Manual testing
curl http://localhost:3000/health
```

### 3. Deployment
```bash
# Build for production
./scripts/build-containers.sh -r production.registry.com/swarm -t $(git describe --tags)

# Deploy to production
docker-compose -f docker-compose.production.yml up -d
```

## Integration with Langfuse

### Automatic Tracing
- All API requests automatically traced
- Performance metrics collected
- Error tracking and analysis
- Token usage monitoring

### Custom Tracing
```javascript
// In application code
import { LangfuseWrapper } from '@swarm/langfuse-wrapper';

const tracer = new LangfuseWrapper({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY
});

// Trace custom operations
await tracer.trace('custom-operation', async () => {
  // Your operation here
});
```

## Support and Maintenance

### Log Rotation
- Automatic log rotation at 10MB
- 7-day retention policy
- Compressed archives

### Health Monitoring
- Automatic health checks every 30 seconds
- Graceful failure handling
- Restart policies for resilience

### Updates
```bash
# Update images
docker-compose -f docker-compose.containers.yml pull

# Restart with updated images
docker-compose -f docker-compose.containers.yml up -d
```

Built with enterprise-grade reliability and comprehensive observability for production swarm deployments.