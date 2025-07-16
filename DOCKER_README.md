# Claude Flow Docker Infrastructure

This directory contains the complete Docker infrastructure for Claude Flow, including multi-stage builds, swarm orchestration, and integrated monitoring.

## 🚀 Quick Start

### Prerequisites
- Docker 20.10+ with Docker Compose v2
- 8GB RAM minimum (16GB recommended)
- 20GB free disk space

### Basic Setup

1. **Copy environment file:**
   ```bash
   cp .env.claude-flow.example .env
   # Edit .env with your configuration
   ```

2. **Deploy the stack:**
   ```bash
   ./docker-swarm-orchestrator.sh deploy
   ```

3. **Check health:**
   ```bash
   ./docker-health-check.sh
   ```

## 📋 Available Services

| Service | Port | Description |
|---------|------|-------------|
| Dashboard | 3000 | Web UI for swarm monitoring |
| Manager API | 8080 | REST API and WebSocket server |
| Langfuse | 3001 | Tracing and observability |
| Prometheus | 9090 | Metrics collection |
| Grafana | 3002 | Metrics visualization |
| Redis | 6379 | Cache and pub/sub |
| PostgreSQL | 5432 | Primary database |
| Swarm Agent | 8888 | Trace generator |

## 🛠️ Docker Files

### Core Files
- `Dockerfile.claude-flow` - Multi-stage build for all services
- `docker-compose.claude-flow.yml` - Full stack composition
- `.env.claude-flow.example` - Environment template
- `docker-swarm-orchestrator.sh` - Orchestration script
- `docker-health-check.sh` - Health monitoring

### Service Targets
- `manager` - API service
- `dashboard` - Next.js UI
- `worker` - Background workers
- `claude-flow-cli` - CLI tool
- `development` - All-in-one dev image

## 🎯 Common Operations

### Deploy Stack
```bash
# Full deployment with build
./docker-swarm-orchestrator.sh deploy

# Just start services
docker-compose -f docker-compose.claude-flow.yml up -d
```

### Scale Workers
```bash
# Scale to 5 workers
./docker-swarm-orchestrator.sh scale 5

# Or using docker-compose
docker-compose -f docker-compose.claude-flow.yml up -d --scale worker=5
```

### View Logs
```bash
# All services
./docker-swarm-orchestrator.sh logs

# Specific service
./docker-swarm-orchestrator.sh logs manager
docker-compose -f docker-compose.claude-flow.yml logs -f dashboard
```

### Stop Services
```bash
# Using orchestrator
./docker-swarm-orchestrator.sh stop

# Using docker-compose
docker-compose -f docker-compose.claude-flow.yml down
```

### Clean Up
```bash
# Remove everything including volumes
./docker-swarm-orchestrator.sh cleanup

# Or manually
docker-compose -f docker-compose.claude-flow.yml down -v
```

## 🔧 Configuration

### Environment Variables

Key variables in `.env`:
```bash
# Database
POSTGRES_PASSWORD=your-secure-password
REDIS_PASSWORD=your-redis-password

# Langfuse
LANGFUSE_PUBLIC_KEY=pk-lf-xxxxx
LANGFUSE_SECRET_KEY=sk-lf-xxxxx

# JWT
JWT_SECRET=your-jwt-secret-min-32-chars

# Workers
WORKER_REPLICAS=2
WORKER_CONCURRENCY=5
```

### Networking

The stack uses a custom bridge network `claude-flow-network` with:
- Service discovery via DNS
- Isolated communication
- Load balancing for scaled services

### Volumes

Persistent data stored in named volumes:
- `claude-flow-postgres-data` - Database
- `claude-flow-redis-data` - Cache
- `claude-flow-worker-data` - Worker state
- `claude-flow-hive-mind-data` - Swarm memory

## 🏗️ Building Images

### Build All
```bash
docker-compose -f docker-compose.claude-flow.yml build
```

### Build Specific Service
```bash
docker-compose -f docker-compose.claude-flow.yml build manager
```

### Multi-platform Build
```bash
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --target manager \
  -t claude-flow-manager:latest \
  -f Dockerfile.claude-flow .
```

## 📊 Monitoring

### Prometheus Metrics
Access at http://localhost:9090
- Service health metrics
- Performance counters
- Resource usage

### Grafana Dashboards
Access at http://localhost:3002 (admin/admin)
- Real-time visualizations
- Historical trends
- Alert configuration

### Langfuse Tracing
Access at http://localhost:3001
- Request traces
- Performance analysis
- Error tracking

## 🐛 Troubleshooting

### Check Service Health
```bash
./docker-health-check.sh
```

### Debug Container
```bash
# Enter container shell
docker exec -it claude-flow-manager sh

# Check logs
docker logs claude-flow-dashboard --tail 100 -f
```

### Common Issues

1. **Port conflicts:**
   ```bash
   # Check ports
   netstat -tulpn | grep -E "(3000|8080|3001)"
   ```

2. **Memory issues:**
   ```bash
   # Increase Docker memory
   # Docker Desktop: Preferences > Resources > Memory
   ```

3. **Build failures:**
   ```bash
   # Clean build cache
   docker builder prune -f
   docker-compose -f docker-compose.claude-flow.yml build --no-cache
   ```

## 🔒 Security

### Production Checklist
- [ ] Change all default passwords in `.env`
- [ ] Enable TLS/SSL via nginx
- [ ] Restrict exposed ports
- [ ] Set up firewall rules
- [ ] Enable container security scanning
- [ ] Configure log rotation
- [ ] Set resource limits

### SSL Setup
```bash
# Generate certificates
mkdir -p nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/key.pem \
  -out nginx/ssl/cert.pem
```

## 🚀 Production Deployment

### Docker Swarm Mode
```bash
# Initialize swarm
docker swarm init

# Deploy stack
docker stack deploy -c docker-compose.claude-flow.yml claude-flow

# Scale service
docker service scale claude-flow_worker=10
```

### Kubernetes
Helm charts available in `/k8s/helm/`

## 📚 Additional Resources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Docker Swarm Guide](https://docs.docker.com/engine/swarm/)
- [Langfuse Documentation](https://langfuse.com/docs)
- [Claude Flow Documentation](https://github.com/ruvnet/claude-flow)