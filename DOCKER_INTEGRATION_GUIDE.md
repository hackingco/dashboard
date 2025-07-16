# Docker Integration Guide

This guide covers the complete Docker infrastructure for the Swarm Platform, including development, testing, and production environments.

## 🚀 Quick Start

### Development Environment
```bash
# Start development environment with hot reload
./docker-orchestrator.sh start dev

# View all service logs
./docker-orchestrator.sh logs

# Check service health
./docker-orchestrator.sh health
```

### Production Environment
```bash
# Start production environment
./docker-orchestrator.sh start prod

# Check status
./docker-orchestrator.sh status
```

## 📁 Docker Configuration Files

### Main Compose Files
- `docker-compose.yml` - Base configuration with Supabase stack
- `docker-compose.development.yml` - Development environment with hot reload
- `docker-compose.production.yml` - Production environment with NGINX

### Dockerfiles
- `apps/dashboard/Dockerfile` - Production Next.js dashboard
- `apps/dashboard/Dockerfile.dev` - Development dashboard with hot reload
- `apps/manager/Dockerfile.dev` - Development manager API with debugging

### Environment Files
- `.env` - Local development configuration
- `.env.production` - Production template
- `.env.local` - Local overrides (gitignored)

## 🔧 Services Overview

### Core Services

#### Redis Cache
- **Port**: 6379
- **Purpose**: Caching, pub/sub, session storage
- **Health Check**: Redis PING command
- **Data Persistence**: Volume mounted for persistence

#### Manager API
- **Port**: 8080
- **Debug Port**: 9229 (development only)
- **Purpose**: Main API server for swarm operations
- **Features**:
  - Fly.io integration
  - Supabase connectivity
  - Langfuse tracing
  - WebSocket support

#### Dashboard (Next.js)
- **Port**: 3000
- **Purpose**: Real-time swarm monitoring dashboard
- **Features**:
  - Real-time metrics
  - Langfuse integration
  - Supabase real-time
  - Responsive design

#### PostgreSQL (Development)
- **Port**: 5432
- **Purpose**: Local development database
- **Default DB**: swarm_dev
- **Credentials**: postgres/postgres

### Optional Services

#### Supabase Local Stack
- **Profiles**: `supabase`
- **Ports**: 54321-54324
- **Purpose**: Complete local Supabase environment

#### Langfuse Local
- **Profiles**: `langfuse-local`
- **Port**: 3001
- **Purpose**: Local Langfuse instance for development

#### NGINX (Production)
- **Ports**: 80, 443
- **Purpose**: Reverse proxy, SSL termination
- **SSL**: Certbot integration for auto-renewal

## 🛠️ Docker Orchestrator Script

The `docker-orchestrator.sh` script provides simplified management:

### Commands
```bash
# Service Management
./docker-orchestrator.sh start <env>      # Start services (dev/prod)
./docker-orchestrator.sh stop            # Stop all services
./docker-orchestrator.sh restart <service> # Restart specific service

# Monitoring
./docker-orchestrator.sh status          # Show service status
./docker-orchestrator.sh logs [service]  # View logs
./docker-orchestrator.sh health          # Run health checks

# Maintenance
./docker-orchestrator.sh cleanup [deep]  # Clean up resources
./docker-orchestrator.sh backup          # Backup data volumes
```

### Environment Options
- `dev` / `development` - Uses development compose file
- `prod` / `production` - Uses production compose file

## 🔍 Service Integration

### Real-Time Data Flow
```
Dashboard ←→ Manager API ←→ Redis ←→ Supabase
    ↓           ↓                ↓
Langfuse    Fly.io API      PostgreSQL
```

### Network Architecture
- **Network**: `swarm-network` (bridge)
- **Subnet**: 172.20.0.0/16 (production), 172.21.0.0/16 (development)
- **Service Discovery**: Docker DNS resolution
- **Load Balancing**: NGINX (production)

### Environment Variable Mapping

#### Dashboard Environment
```bash
# Client-side (NEXT_PUBLIC_)
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_WS_URL=ws://localhost:8080
NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}

# Server-side
LANGFUSE_PUBLIC_KEY=${LANGFUSE_PUBLIC_KEY}
LANGFUSE_SECRET_KEY=${LANGFUSE_SECRET_KEY}
```

#### Manager Environment
```bash
# Database
DATABASE_URL=${DATABASE_URL}
REDIS_URL=redis://redis:6379

# External APIs
FLY_API_TOKEN=${FLY_API_TOKEN}
SUPABASE_URL=${SUPABASE_URL}
LANGFUSE_HOST=${LANGFUSE_HOST}

# Service URLs
DASHBOARD_URL=http://dashboard:3000
```

## 🔄 Development Workflow

### Hot Reload Development
1. Start development environment:
   ```bash
   ./docker-orchestrator.sh start dev
   ```

2. Code changes trigger automatic rebuilds:
   - Dashboard: Next.js hot reload
   - Manager: tsx watch mode
   - Shared packages: Built on startup

3. Debugging:
   - Manager API: Connect debugger to port 9229
   - Dashboard: Browser dev tools
   - Logs: `./docker-orchestrator.sh logs <service>`

### Testing Integration
```bash
# Run tests inside containers
docker exec swarm-platform-manager-1 pnpm test
docker exec swarm-platform-dashboard-1 pnpm test

# Run integration tests
./docker-orchestrator.sh start dev
pnpm test:integration
```

## 🚀 Production Deployment

### Prerequisites
1. **Environment Configuration**:
   ```bash
   cp .env.production .env.local
   # Edit .env.local with actual values
   ```

2. **SSL Certificates** (if using NGINX):
   ```bash
   # Enable SSL profile
   docker-compose -f docker-compose.production.yml --profile ssl up certbot
   ```

### Deployment Steps
1. **Build and Start**:
   ```bash
   ./docker-orchestrator.sh start prod
   ```

2. **Verify Deployment**:
   ```bash
   ./docker-orchestrator.sh health
   ./docker-orchestrator.sh status
   ```

3. **Monitor Logs**:
   ```bash
   ./docker-orchestrator.sh logs
   ```

### Production Monitoring
- **Health Checks**: Automatic container health monitoring
- **Restart Policies**: `unless-stopped` for all services
- **Resource Limits**: Configured per service
- **Backup Strategy**: Automated with orchestrator script

## 🔧 Troubleshooting

### Common Issues

#### Port Conflicts
```bash
# Check port usage
lsof -i :3000
lsof -i :8080

# Stop conflicting services
./docker-orchestrator.sh stop
```

#### Permission Issues
```bash
# Fix Docker permissions
sudo chmod 666 /var/run/docker.sock

# Fix file permissions
sudo chown -R $USER:$USER .
```

#### Volume Issues
```bash
# Reset volumes (WARNING: destroys data)
./docker-orchestrator.sh cleanup deep

# Backup before cleanup
./docker-orchestrator.sh backup
```

#### Network Issues
```bash
# Recreate network
docker network rm swarm-network
./docker-orchestrator.sh start dev
```

### Debug Mode
Enable debug logging:
```bash
# Set in .env
DEBUG=swarm:*
LOG_LEVEL=debug

# Restart services
./docker-orchestrator.sh restart manager
```

### Performance Optimization
```bash
# Optimize Docker
docker system prune -f

# Monitor resource usage
docker stats

# Adjust resource limits in compose files
```

## 📊 Monitoring and Observability

### Health Checks
All services include health check endpoints:
- Manager API: `GET /health`
- Dashboard: `GET /api/health`
- Redis: `redis-cli ping`
- PostgreSQL: `pg_isready`

### Logging Strategy
- **Structured Logging**: JSON format for production
- **Log Aggregation**: Docker logs collected by orchestrator
- **Log Rotation**: Automatic with Docker daemon

### Metrics Collection
- **Langfuse Tracing**: Automatic trace collection
- **Supabase Analytics**: Real-time metrics
- **Docker Stats**: Resource usage monitoring

## 🔐 Security Configuration

### Network Security
- **Isolated Network**: Services communicate via internal network
- **Port Exposure**: Only necessary ports exposed to host
- **SSL/TLS**: NGINX handles SSL termination

### Secret Management
- **Environment Variables**: Secrets via .env files
- **Docker Secrets**: Production secret management
- **Rotation Strategy**: Regular credential updates

### Access Control
- **Database**: Role-based access control
- **API**: JWT authentication
- **Dashboard**: Supabase authentication

## 📈 Scaling and Performance

### Horizontal Scaling
```bash
# Scale specific services
docker-compose -f docker-compose.production.yml up -d --scale manager=3

# Load balancing with NGINX
# Configure upstream in nginx.conf
```

### Resource Optimization
- **Multi-stage Builds**: Optimized image sizes
- **Layer Caching**: Efficient Docker builds
- **Volume Mounts**: Persistent data storage

### Performance Monitoring
- **Container Stats**: `docker stats`
- **Health Metrics**: Built-in health checks
- **APM Integration**: Langfuse performance tracking

## 🚀 CI/CD Integration

### GitHub Actions
```yaml
# .github/workflows/docker.yml
name: Docker Build and Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Production
        run: ./docker-orchestrator.sh start prod
```

### Automated Testing
```bash
# Integration tests with Docker
./scripts/test-docker-integration.sh
```

## 📚 Additional Resources

- [Docker Compose Reference](https://docs.docker.com/compose/)
- [Next.js Docker Guide](https://nextjs.org/docs/deployment#docker-image)
- [Node.js Docker Best Practices](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/)
- [Redis Docker Documentation](https://hub.docker.com/_/redis)

## 🤝 Contributing

When adding new services or features:

1. **Update Compose Files**: Add service to all relevant compose files
2. **Environment Variables**: Document new variables in this guide
3. **Health Checks**: Include health check endpoints
4. **Documentation**: Update this guide with new information
5. **Testing**: Add integration tests for new services

---

For questions or issues, please check the troubleshooting section or open an issue in the repository.