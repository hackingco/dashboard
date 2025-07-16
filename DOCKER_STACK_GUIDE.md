# Claude Flow Docker Stack Guide

## 🏗️ Composable Architecture Overview

The Claude Flow Docker stack is designed with a modular, composable architecture that allows you to deploy exactly what you need for different scenarios. Each module can be combined to create powerful, scalable deployments.

## 📦 Stack Modules

### Core Infrastructure (`docker-compose.swarm-core.yml`)
**Required for all deployments**
- **Redis**: Caching, pub/sub, and session storage
- **PostgreSQL**: Primary database with multiple database support
- **Hive Mind**: Swarm coordination and memory management
- **Network**: Unified `swarm-network` for all services

### Claude Flow Services (`docker-compose.claude-flow-services.yml`)
**Main application services**
- **Manager**: API server and swarm coordination
- **Dashboard**: Web UI for monitoring and control
- **Worker**: Scalable agent execution engine
- **Agent Generator**: Automated trace generation for Langfuse

### Langfuse Integration (`docker-compose.langfuse.yml`)
**Observability and tracing**
- **Langfuse**: Main tracing and observability platform
- **Langfuse Worker**: Background processing for traces
- **Langfuse Ingestion**: High-throughput trace ingestion API

### Monitoring Stack (`docker-compose.monitoring.yml`)
**Complete observability platform**
- **NGINX**: Reverse proxy and load balancer
- **Prometheus**: Metrics collection and alerting
- **Grafana**: Visualization and dashboards
- **Exporters**: Node, Redis, and PostgreSQL metrics
- **Alertmanager**: Alert routing and management
- **Jaeger**: Alternative distributed tracing
- **Loki + Promtail**: Log aggregation and analysis

### Development Tools (`docker-compose.development.override.yml`)
**Development and debugging enhancements**
- **Hot Reload**: Live code updates for all services
- **pgAdmin**: Database management interface
- **Redis Commander**: Redis management UI
- **MailHog**: Email testing service
- **DevTools**: Development utilities container
- **File Watcher**: Automatic rebuild triggers

### Scaling Configuration (`docker-compose.scaling.yml`)
**High-availability and scaling**
- **Redis Cluster**: Master-replica setup with Sentinel
- **PostgreSQL Replicas**: Read replicas for scaling
- **Multiple Manager Instances**: Load-balanced API servers
- **HAProxy**: Load balancer with SSL termination
- **Consul**: Service discovery and coordination
- **Worker Scaling**: Multiple worker instances

## 🚀 Deployment Modes

### Quick Start Modes

#### 1. **Development Mode**
Perfect for local development with hot reload and debugging tools.
```bash
./scripts/docker-orchestrator.sh deploy development
```
**Includes**: Core + Services + Langfuse + Development Tools

#### 2. **Production Mode**
Production-ready deployment with monitoring and security.
```bash
./scripts/docker-orchestrator.sh deploy production
```
**Includes**: Core + Services + Langfuse + Monitoring

#### 3. **Minimal Mode**
Lightweight deployment with essential services only.
```bash
./scripts/docker-orchestrator.sh deploy minimal
```
**Includes**: Core + Services

### Specialized Modes

#### 4. **Scaling Mode**
High-availability setup with clustering and load balancing.
```bash
./scripts/docker-orchestrator.sh deploy scaling
```
**Includes**: Core + Services + Langfuse + Scaling Infrastructure

#### 5. **Monitoring Mode**
Observability-focused deployment for infrastructure monitoring.
```bash
./scripts/docker-orchestrator.sh deploy monitoring
```
**Includes**: Core + Monitoring Stack

#### 6. **Langfuse-Only Mode**
Standalone Langfuse deployment for tracing evaluation.
```bash
./scripts/docker-orchestrator.sh deploy langfuse-only
```
**Includes**: Core + Langfuse

### Custom Combinations

You can also manually combine modules for custom deployments:

```bash
# Core + Services only
docker-compose -f docker-compose.swarm-core.yml -f docker-compose.claude-flow-services.yml up -d

# Core + Langfuse + Monitoring
docker-compose -f docker-compose.swarm-core.yml -f docker-compose.langfuse.yml -f docker-compose.monitoring.yml up -d

# All modules
docker-compose -f docker-compose.swarm-core.yml -f docker-compose.claude-flow-services.yml -f docker-compose.langfuse.yml -f docker-compose.monitoring.yml -f docker-compose.scaling.yml up -d
```

## ⚙️ Configuration

### Environment Setup

1. **Copy environment template:**
   ```bash
   cp .env.docker.example .env
   ```

2. **Customize for your deployment:**
   ```bash
   # Edit .env file with your specific configuration
   nano .env
   ```

3. **Key configuration sections:**
   - **Database credentials**: PostgreSQL and Redis passwords
   - **Langfuse API keys**: Get from your Langfuse instance
   - **Security settings**: JWT secrets, encryption keys
   - **Resource limits**: Memory and CPU allocations
   - **Feature flags**: Enable/disable specific features

### Required Environment Variables

#### Minimal Configuration
```env
POSTGRES_PASSWORD=your-secure-password
REDIS_PASSWORD=your-redis-password
JWT_SECRET=your-jwt-secret-min-32-chars
LANGFUSE_PUBLIC_KEY=pk-lf-your-key
LANGFUSE_SECRET_KEY=sk-lf-your-key
LANGFUSE_NEXTAUTH_SECRET=your-nextauth-secret
LANGFUSE_SALT=your-salt-key
```

#### Production Configuration
```env
# Add SSL certificates
SSL_CERT_PATH=/path/to/cert.pem
SSL_KEY_PATH=/path/to/key.pem

# Security
SECURITY_HEADERS_ENABLED=true
RATE_LIMITING_ENABLED=true

# Monitoring
GRAFANA_PASSWORD=your-secure-grafana-password
```

## 🔧 Service URLs

### Development Mode
- **Dashboard**: http://localhost:3000
- **Manager API**: http://localhost:8080
- **Langfuse**: http://localhost:3001
- **pgAdmin**: http://localhost:5050
- **Redis Commander**: http://localhost:8081
- **MailHog**: http://localhost:8025

### Production Mode
- **Dashboard**: http://localhost:3000
- **Manager API**: http://localhost:8080
- **Langfuse**: http://localhost:3001
- **Grafana**: http://localhost:3002
- **Prometheus**: http://localhost:9090

### Scaling Mode
- **Load Balancer**: http://localhost:80
- **HAProxy Stats**: http://localhost:8404
- **Consul**: http://localhost:8500

## 📊 Monitoring and Observability

### Grafana Dashboards
Pre-configured dashboards for:
- **Swarm Overview**: Agent performance and coordination
- **Infrastructure**: Redis, PostgreSQL, system metrics
- **Application**: Manager API, Dashboard, Worker metrics
- **Langfuse**: Trace analysis and performance

### Prometheus Metrics
Automatic collection of:
- **System metrics**: CPU, memory, disk, network
- **Application metrics**: Request rates, response times, errors
- **Database metrics**: Connection pools, query performance
- **Redis metrics**: Cache hit rates, memory usage

### Alerting
Pre-configured alerts for:
- **High CPU/Memory usage**
- **Database connection issues**
- **Service health check failures**
- **Error rate spikes**

## 🔄 Operations

### Starting Services
```bash
# Start in development mode
./scripts/docker-orchestrator.sh deploy development

# Start with rebuild
./scripts/docker-orchestrator.sh deploy production --build

# Start specific profile
./scripts/docker-orchestrator.sh deploy scaling
```

### Stopping Services
```bash
# Stop services (preserve data)
./scripts/docker-orchestrator.sh stop development

# Stop and remove volumes
./scripts/docker-orchestrator.sh cleanup development true
```

### Viewing Logs
```bash
# All services
./scripts/docker-orchestrator.sh logs development

# Specific service
./scripts/docker-orchestrator.sh logs development manager

# Follow logs with custom options
./scripts/docker-orchestrator.sh logs development manager "-f --tail=50"
```

### Status Monitoring
```bash
# Service status
./scripts/docker-orchestrator.sh status development

# Health checks
docker ps --filter "health=healthy"
```

## 💾 Data Management

### Backup
```bash
# Create full backup
./scripts/docker-orchestrator.sh backup

# Manual database backup
docker exec swarm-postgres pg_dump -U postgres swarm_core > backup.sql
```

### Restore
```bash
# Restore from backup
./scripts/docker-orchestrator.sh restore /path/to/backup/directory

# Manual database restore
docker exec -i swarm-postgres psql -U postgres swarm_core < backup.sql
```

### Volume Management
```bash
# List volumes
docker volume ls | grep swarm

# Inspect volume
docker volume inspect swarm-postgres-data

# Backup volume
docker run --rm -v swarm-postgres-data:/data -v $(pwd):/backup alpine tar czf /backup/postgres-data.tar.gz -C /data .
```

## 🔧 Scaling Operations

### Horizontal Scaling
```bash
# Scale workers
docker-compose up -d --scale worker=4

# Scale Langfuse workers
docker-compose up -d --scale langfuse-worker=3
```

### Vertical Scaling
Edit resource limits in compose files:
```yaml
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 4G
    reservations:
      cpus: '1'
      memory: 1G
```

### Load Testing
```bash
# Install tools
npm install -g artillery

# Run load test
artillery run tests/load-test.yml
```

## 🐛 Troubleshooting

### Common Issues

#### Service Won't Start
```bash
# Check logs
docker-compose logs <service-name>

# Check resource usage
docker stats

# Verify configuration
docker-compose config
```

#### Database Connection Issues
```bash
# Check PostgreSQL logs
docker logs swarm-postgres

# Test connection
docker exec swarm-postgres pg_isready -U postgres

# Check Redis
docker exec swarm-redis redis-cli ping
```

#### Memory Issues
```bash
# Check memory usage
docker stats --no-stream

# Increase limits in docker-compose.yml
# Or add swap to host system
```

### Debug Mode
```bash
# Enable debug logging
export DEBUG=swarm:*
export LOG_LEVEL=debug

# Rebuild with debug
./scripts/docker-orchestrator.sh deploy development --build
```

## 🔒 Security Best Practices

### Production Security
1. **Change default passwords** in `.env`
2. **Use SSL certificates** for HTTPS
3. **Enable rate limiting** and security headers
4. **Regularly update images**
5. **Monitor security alerts**

### Network Security
```yaml
# Restrict external access
networks:
  swarm-network:
    internal: true  # No external access
```

### Secret Management
```bash
# Use Docker secrets
docker secret create postgres_password /path/to/password/file

# Reference in compose
external: true
secrets:
  - postgres_password
```

## 📈 Performance Optimization

### Resource Optimization
1. **Monitor metrics** in Grafana
2. **Optimize database queries**
3. **Tune Redis configuration**
4. **Adjust worker concurrency**
5. **Use connection pooling**

### Caching Strategy
- **Redis**: Session storage, API caching
- **Application**: In-memory caching for frequent data
- **CDN**: Static asset caching (production)

### Database Optimization
```sql
-- Create indexes for frequent queries
CREATE INDEX idx_traces_timestamp ON traces(timestamp);
CREATE INDEX idx_agents_status ON agents(status);

-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM traces WHERE timestamp > NOW() - INTERVAL '1 hour';
```

## 🔄 CI/CD Integration

### GitHub Actions
```yaml
name: Deploy Claude Flow
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy Stack
        run: |
          cp .env.production .env
          ./scripts/docker-orchestrator.sh deploy production
```

### Docker Registry
```bash
# Build and tag images
docker build -t myregistry/claude-flow-manager:latest apps/manager

# Push to registry
docker push myregistry/claude-flow-manager:latest

# Update compose to use registry images
```

This modular architecture provides maximum flexibility while maintaining simplicity for common deployment scenarios. Each module is designed to work independently or in combination with others, allowing you to build exactly the infrastructure you need.