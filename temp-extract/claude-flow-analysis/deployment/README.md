# Claude Flow Deployment Automation System

Complete production-ready deployment automation for the Claude Flow ecosystem with enterprise-grade features including high availability, monitoring, backup, and disaster recovery.

## 🚀 Quick Start

### One-Command Deployment

```bash
# Production deployment with all features
./deploy-all.sh

# Staging deployment
./deploy-all.sh -e staging -t kubernetes

# Development deployment
./deploy-all.sh -e development --basic-setup
```

### Prerequisites

- **Docker & Docker Compose** (for Docker deployments)
- **Kubernetes & kubectl** (for Kubernetes deployments)
- **AWS CLI** (for S3 backups)
- **Domain name & SSL certificates** (for production)

## 📁 Project Structure

```
deployment/
├── deploy-all.sh                     # Main deployment automation script
├── README.md                         # This documentation
├── config/                           # Configuration files
│   ├── nginx/                        # NGINX load balancer configs
│   ├── prometheus/                   # Monitoring configurations
│   ├── grafana/                      # Dashboard configurations
│   ├── redis/                        # Redis cluster configs
│   └── postgres/                     # Database configurations
├── docker/                           # Docker configurations
│   ├── Dockerfile.claude-flow        # Application container
│   ├── Dockerfile.langfuse           # Langfuse container
│   └── Dockerfile.backup             # Backup service container
├── environments/                     # Environment-specific configs
│   ├── .env.production               # Production environment
│   ├── .env.staging                  # Staging environment
│   └── .env.development              # Development environment
├── infrastructure/                   # Infrastructure as Code
│   ├── docker-compose.production.yml # Production Docker Compose
│   └── docker-compose.override.yml   # Environment overrides
├── kubernetes/                       # Kubernetes manifests
│   ├── namespace.yaml               # Namespaces
│   ├── configmaps.yaml              # Configuration
│   ├── secrets.yaml                 # Secrets management
│   ├── claude-flow-deployment.yaml  # Application deployment
│   └── storage/                     # Persistent storage
└── scripts/                         # Management scripts
    ├── deploy.sh                    # Core deployment script
    ├── rollback.sh                  # Rollback automation
    ├── status.sh                    # System status check
    ├── logs.sh                      # Log management
    ├── scale.sh                     # Scaling operations
    └── backup/                      # Backup & restore
        ├── backup.sh                # Automated backup
        └── restore.sh               # Disaster recovery
```

## 🏗️ Architecture Overview

### Core Components

1. **Claude Flow Application** - Main AI orchestration platform
2. **Langfuse** - Observability and tracing
3. **PostgreSQL** - Primary database with replication
4. **Redis** - Caching and session management
5. **ClickHouse** - Analytics and metrics storage
6. **NGINX** - Load balancer and reverse proxy

### Monitoring Stack

1. **Prometheus** - Metrics collection and alerting
2. **Grafana** - Visualization and dashboards
3. **Alertmanager** - Alert routing and management
4. **Node Exporter** - System metrics

### High Availability Features

- **Database replication** (Primary/Replica)
- **Redis clustering** with Sentinel
- **Load balancing** with health checks
- **Auto-scaling** (Kubernetes HPA)
- **Multi-zone deployment** support

## 🔧 Configuration

### Environment Setup

1. **Copy environment template:**
   ```bash
   cp deployment/environments/.env.production.example deployment/environments/.env.production
   ```

2. **Configure required variables:**
   ```bash
   # Security (REQUIRED - Change these!)
   POSTGRES_PASSWORD=your_secure_postgres_password
   ENCRYPTION_KEY=your_64_character_encryption_key
   JWT_SECRET=your_jwt_secret
   NEXTAUTH_SECRET=your_nextauth_secret
   
   # Langfuse (REQUIRED)
   LANGFUSE_PUBLIC_KEY=your_langfuse_public_key
   LANGFUSE_SECRET_KEY=your_langfuse_secret_key
   
   # Domain (for production)
   DOMAIN_NAME=your-domain.com
   
   # AWS (for backups)
   AWS_ACCESS_KEY_ID=your_aws_access_key
   AWS_SECRET_ACCESS_KEY=your_aws_secret_key
   BACKUP_S3_BUCKET=your-backup-bucket
   ```

### SSL Certificate Setup

For production with SSL:

```bash
# Place your certificates in:
deployment/secrets/ssl/server.crt
deployment/secrets/ssl/server.key

# Or use Let's Encrypt:
certbot certonly --webroot -w /var/www/html -d your-domain.com
```

## 🚀 Deployment Options

### Docker Deployment (Recommended for most use cases)

```bash
# Production
./deploy-all.sh -e production -t docker

# With custom domain and SSL
./deploy-all.sh -e production --domain myapp.com --enable-ssl

# Staging environment
./deploy-all.sh -e staging -t docker
```

### Kubernetes Deployment

```bash
# Production with auto-scaling
./deploy-all.sh -e production -t kubernetes

# Custom replicas
./deploy-all.sh -e production -t kubernetes --replicas 5
```

### Development Setup

```bash
# Basic development setup
./deploy-all.sh -e development --basic-setup

# Development with monitoring
./deploy-all.sh -e development --no-backup
```

## 📊 Monitoring & Observability

### Access Dashboards

| Service | URL | Purpose |
|---------|-----|---------|
| Claude Flow | http://localhost:8080 | Main application |
| Langfuse | http://localhost:3000 | Tracing & observability |
| Grafana | http://localhost:3001 | Metrics dashboards |
| Prometheus | http://localhost:9090 | Metrics & alerts |

### Default Credentials

- **Grafana**: admin / (configured in environment)
- **Langfuse**: Set up during first access

### Key Metrics Monitored

- Application response time and throughput
- Database performance and connections
- Cache hit rates and memory usage
- System resources (CPU, memory, disk)
- Error rates and availability
- Backup success/failure

## 🔄 Management Operations

### Check System Status

```bash
./scripts/status.sh
```

### View Logs

```bash
# All services
./scripts/logs.sh

# Specific service
./scripts/logs.sh claude-flow

# Follow logs
./scripts/logs.sh -f
```

### Scaling Operations

```bash
# Scale application
./scripts/scale.sh --service claude-flow --replicas 5

# Auto-scaling setup
./scripts/scale.sh --enable-auto-scaling
```

### Updates and Rollbacks

```bash
# Rolling update
./scripts/update.sh --version 2.1.0

# Rollback to previous version
./scripts/rollback.sh

# Rollback to specific version
./scripts/rollback.sh --version 2.0.0
```

## 💾 Backup & Disaster Recovery

### Automated Backups

Backups run automatically at 2 AM daily and include:

- PostgreSQL databases (full dump)
- Redis data snapshots
- ClickHouse analytics data
- Application configurations
- Encrypted secrets

### Manual Backup

```bash
# Full backup
./scripts/backup/backup.sh

# Configuration only
./scripts/backup/backup.sh --type config-only

# Upload to S3
./scripts/backup/backup.sh --environment production
```

### Disaster Recovery

```bash
# Restore from backup
./scripts/backup/restore.sh /path/to/backup.tar.gz

# Restore from S3
./scripts/backup/restore.sh s3://bucket/backup.tar.gz

# Restore specific components
./scripts/backup/restore.sh --type data-only backup.tar.gz
```

## 🔒 Security Features

### Security Measures Implemented

- **Encrypted secrets** management
- **Non-root containers** for all services
- **Network isolation** between services
- **Resource limits** and quotas
- **Health checks** and monitoring
- **Automated backups** with encryption
- **SSL/TLS termination** support

### Security Checklist

- [ ] Change all default passwords
- [ ] Configure proper SSL certificates
- [ ] Set up firewall rules
- [ ] Enable audit logging
- [ ] Configure backup encryption
- [ ] Set up monitoring alerts
- [ ] Review access permissions

## 🚨 Troubleshooting

### Common Issues

**Services not starting:**
```bash
# Check logs
./scripts/logs.sh

# Check system resources
./scripts/status.sh

# Restart services
./scripts/deploy.sh --force
```

**Database connection issues:**
```bash
# Check database status
docker exec postgres-primary pg_isready

# Check connection from application
docker exec claude-flow-app nc -zv postgres-primary 5432
```

**Monitoring not working:**
```bash
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Restart monitoring stack
docker-compose -f infrastructure/docker-compose.monitoring.yml restart
```

### Log Locations

- **Application logs**: `/app/logs/`
- **Container logs**: `docker logs <container-name>`
- **System logs**: `/var/log/`
- **Backup logs**: `/backups/logs/`

## 🔄 CI/CD Integration

### GitHub Actions Example

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
      - name: Deploy to staging
        run: ./deployment/deploy-all.sh -e staging
      - name: Run health checks
        run: ./deployment/scripts/status.sh
```

### Environment Promotion

```bash
# Deploy to staging
./deploy-all.sh -e staging

# Test staging environment
./scripts/test-suite.sh -e staging

# Promote to production
./deploy-all.sh -e production
```

## 📈 Performance Optimization

### Resource Requirements

| Component | CPU | Memory | Storage |
|-----------|-----|--------|---------|
| Claude Flow | 1-2 cores | 2-4 GB | 10 GB |
| PostgreSQL | 1-2 cores | 2-4 GB | 50 GB |
| Redis | 0.5-1 core | 1-2 GB | 5 GB |
| ClickHouse | 1-2 cores | 2-4 GB | 100 GB |
| Langfuse | 0.5-1 core | 1-2 GB | 10 GB |
| Monitoring | 1 core | 2 GB | 20 GB |

### Optimization Tips

1. **Enable connection pooling** for databases
2. **Configure Redis clustering** for high load
3. **Use SSD storage** for databases
4. **Set up CDN** for static assets
5. **Configure auto-scaling** based on metrics

## 🆘 Support & Documentation

### Additional Resources

- [Claude Flow Documentation](../docs/)
- [Kubernetes Best Practices](../docs/kubernetes/)
- [Monitoring Guide](../docs/monitoring/)
- [Backup Strategy](../docs/backup/)

### Getting Help

1. Check the troubleshooting section above
2. Review logs using `./scripts/logs.sh`
3. Check system status with `./scripts/status.sh`
4. Open an issue with:
   - Environment configuration
   - Error logs
   - System specifications
   - Deployment command used

---

## 📄 License

This deployment automation system is part of the Claude Flow project and is released under the MIT License.