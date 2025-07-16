# 🐝 Claude Flow Swarm Wrapper - Docker Deployment Guide

The complete Docker-based swarm system with individual agent containers, Langfuse v3 tracing, and ClickHouse/Prisma integration.

## 🚀 Quick Start

### 1. Setup Environment
```bash
# Copy environment template
cp .env.swarm-wrapper.example .env

# Generate secure passwords
openssl rand -base64 32  # Use for each password field in .env

# Edit .env with your configuration
vim .env
```

### 2. Start the Swarm
```bash
# Make the orchestrator script executable
chmod +x scripts/swarm-orchestrator.sh

# Start the complete swarm
./scripts/swarm-orchestrator.sh start

# Or use docker-compose directly
docker-compose -f docker-compose.swarm-wrapper.yml up -d
```

### 3. Scale Agents
```bash
# Scale to 10 agent instances
./scripts/swarm-orchestrator.sh scale 10

# Or with docker-compose
docker-compose -f docker-compose.swarm-wrapper.yml up -d --scale swarm-agent=10
```

## 🏗️ Architecture Overview

### **Layered Service Architecture**

```
🌐 External Layer (Port 80/443)
├── Nginx Load Balancer
└── SSL Termination

📊 Monitoring Layer
├── Prometheus (Port 9090)
├── Grafana (Port 3030)
└── Health Checks

🎛️ Application Layer
├── Dashboard (Port 3000)
├── Manager API (Port 8080)
└── Web Interface

🤖 Agent Layer
├── Swarm Coordinator (Port 8890)
├── Scalable Agents (Dynamic)
└── Task Processing

📊 Observability Layer
├── Langfuse v3 (Port 3001)
├── Langfuse Worker (Background)
└── Ultra High-Throughput Ingestion

🧠 Coordination Layer
├── Hive Mind (Port 8888)
├── Claude Flow MCP (Port 8889)
└── Neural Patterns

🏗️ Infrastructure Layer
├── Redis (Port 6379)
├── PostgreSQL (Port 5432)
└── ClickHouse (Ports 8123, 9000, 9004)
```

### **Multi-Network Security**
- **swarm-infrastructure**: Core services communication
- **swarm-coordination**: Internal agent coordination (isolated)
- **swarm-agents**: Agent-to-agent communication (isolated)
- **swarm-data**: Database connections (isolated)
- **swarm-analytics**: Langfuse and ClickHouse (isolated)
- **swarm-monitoring**: Prometheus and Grafana (isolated)
- **swarm-external**: Public access

## 🔧 Service Details

### **Core Infrastructure**
- **Redis**: High-performance caching and pub/sub with authentication
- **PostgreSQL**: Primary database with Prisma ORM integration
- **ClickHouse**: Analytics database for Langfuse v3 (24.3 with optimizations)

### **Swarm Coordination**
- **Hive Mind**: Central swarm intelligence with neural patterns
- **Claude Flow**: MCP server integration with coordination APIs

### **Langfuse v3 Observability**
- **Langfuse Web**: Main application with ClickHouse backend
- **Langfuse Worker**: Background processing (3 replicas)
- **High-Throughput**: 10,000+ traces/second ingestion capability

### **Agent System**
- **Swarm Coordinator**: Master coordination agent
- **Scalable Agents**: Individual containers for each agent type
  - 🧑‍💻 **Coder**: Code generation and debugging
  - 🔍 **Researcher**: Information gathering and analysis
  - 📊 **Analyst**: Data analysis and metrics
  - 🧪 **Tester**: Testing and validation
  - ⚡ **Optimizer**: Performance optimization

### **Application Services**
- **Manager API**: Core application API with swarm integration
- **Dashboard**: Web interface with real-time swarm monitoring

### **Monitoring Stack**
- **Nginx**: Load balancer and reverse proxy
- **Prometheus**: Metrics collection from all services
- **Grafana**: Visualization with pre-configured dashboards

## 🎯 Environment Configuration

### **Required Variables**
```bash
# Database Security
POSTGRES_PASSWORD=your-secure-password-here
REDIS_PASSWORD=your-redis-password-here
CLICKHOUSE_PASSWORD=your-clickhouse-password-here

# Langfuse v3 Security
LANGFUSE_NEXTAUTH_SECRET=32-char-secret-minimum
LANGFUSE_SALT=32-char-salt-minimum

# Langfuse API Keys (from https://langfuse.com)
LANGFUSE_PUBLIC_KEY=pk-lf-your-public-key
LANGFUSE_SECRET_KEY=sk-lf-your-secret-key
```

### **Performance Tuning**
```bash
# Swarm Configuration
SWARM_MAX_AGENTS=50
SWARM_COORDINATION_MODE=hierarchical
NEURAL_PATTERNS_ENABLED=true

# Langfuse v3 Performance
LANGFUSE_WORKER_CONCURRENCY=20
LANGFUSE_BATCH_SIZE=10000
LANGFUSE_FLUSH_INTERVAL=1000
LANGFUSE_WORKER_REPLICAS=3
```

## 🛠️ Management Commands

### **Orchestrator Script Usage**
```bash
# Service Management
./scripts/swarm-orchestrator.sh start      # Start the swarm
./scripts/swarm-orchestrator.sh stop       # Stop the swarm
./scripts/swarm-orchestrator.sh restart    # Restart the swarm
./scripts/swarm-orchestrator.sh status     # Show status and health

# Scaling Operations
./scripts/swarm-orchestrator.sh scale 15   # Scale to 15 agents

# Monitoring
./scripts/swarm-orchestrator.sh logs langfuse 100   # Show Langfuse logs
./scripts/swarm-orchestrator.sh urls                # Show service URLs

# Maintenance
./scripts/swarm-orchestrator.sh update     # Update all images
./scripts/swarm-orchestrator.sh backup     # Backup data
./scripts/swarm-orchestrator.sh cleanup    # Full cleanup
```

### **Direct Docker Compose**
```bash
# Start with custom scaling
docker-compose -f docker-compose.swarm-wrapper.yml up -d --scale swarm-agent=8

# Check service status
docker-compose -f docker-compose.swarm-wrapper.yml ps

# View logs
docker-compose -f docker-compose.swarm-wrapper.yml logs -f langfuse

# Scale agents dynamically
docker-compose -f docker-compose.swarm-wrapper.yml up -d --scale swarm-agent=20
```

## 🌐 Service URLs

After startup, access these services:

| Service | URL | Description |
|---------|-----|-------------|
| **Dashboard** | http://localhost:3000 | Main web interface |
| **Manager API** | http://localhost:8080 | REST API endpoints |
| **Hive Mind** | http://localhost:8888 | Swarm coordination |
| **Claude Flow** | http://localhost:8889 | MCP server |
| **Langfuse v3** | http://localhost:3001 | Observability platform |
| **Prometheus** | http://localhost:9090 | Metrics collection |
| **Grafana** | http://localhost:3030 | Dashboards |
| **ClickHouse** | http://localhost:8123 | Analytics database |

## 📊 Performance Characteristics

### **Langfuse v3 with ClickHouse**
- **Ingestion Rate**: 10,000+ traces/second
- **Query Performance**: Sub-second analytics queries
- **Storage**: Columnar compression for efficient storage
- **Scalability**: Horizontal scaling with multiple workers

### **Swarm Agents**
- **Concurrent Agents**: Up to 50+ agents per swarm
- **Task Processing**: 10 concurrent tasks per agent
- **Memory Efficient**: 512MB per agent container
- **Auto-Scaling**: Dynamic scaling based on workload

### **Infrastructure**
- **Redis**: 1GB memory with LRU eviction
- **PostgreSQL**: 2GB memory with connection pooling
- **ClickHouse**: 4GB memory with 4 CPU cores

## 🔒 Security Features

### **Network Isolation**
- Internal networks for coordination and data
- External network only for public services
- Service mesh with encrypted communication

### **Authentication & Authorization**
- JWT-based API authentication
- Redis password protection
- Database role-based access control
- Langfuse API key management

### **Container Security**
- Non-root users in all containers
- Read-only file systems where possible
- Resource limits and quotas
- Health checks and monitoring

## 🚨 Troubleshooting

### **Common Issues**

1. **Environment Configuration**
   ```bash
   # Check environment file
   cat .env | grep -E "(PASSWORD|SECRET|KEY)"
   
   # Regenerate passwords
   openssl rand -base64 32
   ```

2. **Service Health**
   ```bash
   # Check all service health
   ./scripts/swarm-orchestrator.sh status
   
   # Check specific service logs
   docker-compose -f docker-compose.swarm-wrapper.yml logs langfuse
   ```

3. **Resource Issues**
   ```bash
   # Check resource usage
   docker stats
   
   # Scale down if needed
   ./scripts/swarm-orchestrator.sh scale 3
   ```

4. **Database Connectivity**
   ```bash
   # Test PostgreSQL
   docker-compose -f docker-compose.swarm-wrapper.yml exec postgres psql -U postgres -c "SELECT version();"
   
   # Test ClickHouse
   curl http://localhost:8123/ping
   ```

5. **Langfuse v3 Issues**
   ```bash
   # Check Langfuse health
   curl http://localhost:3001/api/health
   
   # Check ClickHouse migration
   docker-compose -f docker-compose.swarm-wrapper.yml logs langfuse | grep migration
   ```

### **Performance Optimization**

1. **Scale Workers Based on Load**
   ```bash
   # Monitor CPU usage
   docker stats --format "table {{.Container}}\t{{.CPUPerc}}"
   
   # Scale Langfuse workers
   docker-compose -f docker-compose.swarm-wrapper.yml up -d --scale langfuse-worker=5
   ```

2. **Adjust Batch Sizes**
   ```bash
   # Edit .env for high-throughput scenarios
   LANGFUSE_BATCH_SIZE=20000
   LANGFUSE_FLUSH_INTERVAL=500
   ```

3. **Memory Optimization**
   ```bash
   # Increase ClickHouse memory if needed
   # Edit docker-compose.swarm-wrapper.yml resources section
   ```

## 📚 Additional Resources

- **Claude Flow Documentation**: https://github.com/ruvnet/claude-flow
- **Langfuse v3 Docs**: https://langfuse.com/docs
- **ClickHouse Docs**: https://clickhouse.com/docs
- **Docker Compose Reference**: https://docs.docker.com/compose/

## 🎯 Production Deployment

### **Recommendations**
1. Use external managed databases for production
2. Configure SSL/TLS certificates for Nginx
3. Set up proper backup strategies
4. Monitor resource usage and scale accordingly
5. Use container orchestration (Kubernetes/Docker Swarm)
6. Implement proper logging aggregation
7. Set up alerting and monitoring

### **Scaling Considerations**
- Start with 5-10 agents and scale based on demand
- Monitor ClickHouse performance for analytics workloads
- Use multiple Langfuse worker replicas for high throughput
- Consider Redis clustering for large deployments
- Implement load balancing for multiple swarm instances

---

**🐝 The swarm is ready to coordinate and execute complex tasks with enterprise-grade observability!**