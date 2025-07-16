# Production Docker Deployment Guide

This directory contains the production-ready Docker deployment configuration for the Swarm platform. The setup includes multi-stage Dockerfiles, comprehensive Docker Compose orchestration, load balancing, monitoring, and security hardening.

## 🏗️ Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Nginx (SSL)   │────▶│    HAProxy      │────▶│  Application    │
│  Static Assets  │     │  Load Balancer  │     │    Services     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                │                         │
                                ├── Langfuse Cluster ────┤
                                ├── Swarm Manager ───────┤
                                ├── Swarm Workers (1-3) ─┤
                                └── Dashboard ───────────┘
                                          │
                        ┌─────────────────┴─────────────────┐
                        │                                   │
                  ┌─────▼─────┐                     ┌──────▼──────┐
                  │ PostgreSQL │                     │    Redis    │
                  │  Primary/  │                     │Master/Slave │
                  │  Replica   │                     └─────────────┘
                  └────────────┘
```

## 📋 Features

### 🔒 Security
- Non-root containers with minimal attack surface
- SSL/TLS termination with modern cipher suites
- Network isolation and segmentation
- Secret management through environment variables
- Regular security scanning with Trivy
- HSTS and security headers enabled

### 🚀 Performance
- Multi-stage builds for optimized image sizes
- Health checks for all services
- Connection pooling with PgBouncer
- Redis caching layer
- Static asset caching with Nginx
- Horizontal scaling support

### 📊 Monitoring
- Prometheus metrics collection
- Grafana dashboards
- Loki log aggregation
- Alertmanager notifications
- Custom Swarm metrics
- Real-time performance tracking

### 🔄 High Availability
- Database replication (PostgreSQL)
- Redis master-slave setup
- Load balancing with HAProxy
- Multiple Langfuse instances
- Auto-scaling worker nodes
- Zero-downtime deployments

## 🚀 Quick Start

### Prerequisites
- Docker Engine 20.10+
- Docker Compose 2.0+
- 16GB+ RAM recommended
- 100GB+ disk space
- Domain with SSL certificate

### 1. Environment Setup

```bash
# Copy the production environment template
cp docker/production/.env.production .env

# Edit the environment file with your values
vim .env
```

**Critical environment variables to update:**
- `DOMAIN` - Your production domain
- All password fields (`*_PASSWORD`)
- All secret/key fields (`*_SECRET`, `*_KEY`)
- AWS credentials for backups
- Data directory paths

### 2. SSL Certificate Setup

Place your SSL certificates in the appropriate directories:

```bash
# For HAProxy
mkdir -p config/ssl
cat your-cert.pem your-key.pem > config/ssl/swarm.pem

# For Nginx
cp your-cert.pem config/ssl/cert.pem
cp your-key.pem config/ssl/key.pem
cp your-chain.pem config/ssl/chain.pem
```

### 3. Deploy

```bash
# Run the deployment script
./docker/production/deploy-production.sh

# Or deploy manually
docker-compose -f docker/production/docker-compose.production.yml up -d
```

## 📁 Directory Structure

```
docker/production/
├── Dockerfile.manager      # Optimized Swarm Manager image
├── Dockerfile.worker       # Optimized Swarm Worker image  
├── Dockerfile.dashboard    # Optimized Dashboard image
├── docker-compose.production.yml  # Full production stack
├── .env.production        # Environment template
├── deploy-production.sh   # Automated deployment script
└── README.md             # This file

config/
├── haproxy/
│   ├── haproxy-production.cfg  # Load balancer config
│   └── errors/                  # Custom error pages
├── nginx/
│   ├── nginx-production.conf    # Web server config
│   └── conf.d/                  # Additional configs
├── postgres/
│   ├── init-langfuse.sql        # Database initialization
│   ├── production-tuning.sql    # Performance tuning
│   └── replication-setup.sql    # Replication config
└── redis/
    └── production.conf          # Redis configuration

monitoring/
├── prometheus-production.yml    # Metrics configuration
├── alerts-production.yml        # Alert rules
├── grafana/
│   ├── provisioning/           # Datasources & dashboards
│   └── dashboards/             # Custom dashboards
└── alertmanager/
    └── config.yml              # Alert routing
```

## 🔧 Configuration Details

### Resource Limits

Each service has defined resource limits for stability:

| Service | CPU Limit | Memory Limit | CPU Reserve | Memory Reserve |
|---------|-----------|--------------|-------------|----------------|
| PostgreSQL Primary | 2.0 | 2GB | 1.0 | 1GB |
| PostgreSQL Replica | 1.5 | 1.5GB | 0.5 | 512MB |
| Redis Master | 1.0 | 1.5GB | 0.5 | 512MB |
| Langfuse | 2.0 | 3GB | 1.0 | 1GB |
| Swarm Manager | 2.0 | 2GB | 1.0 | 1GB |
| Swarm Worker | 1.0 | 1GB | 0.5 | 512MB |
| HAProxy | 1.0 | 512MB | 0.5 | 256MB |
| Nginx | 0.5 | 256MB | 0.25 | 128MB |

### Network Configuration

- Custom bridge network: `172.20.0.0/16`
- Service discovery via Docker DNS
- Internal service communication only
- External access through load balancers

### Volume Management

Persistent volumes with bind mounts:
- `/data` - Main data directory
- `/logs` - Centralized logging
- `/backups` - Automated backups

## 📊 Monitoring & Observability

### Access Points

- Main Application: `https://yourdomain.com`
- HAProxy Stats: `http://yourdomain.com:8404/stats`
- Prometheus: `https://yourdomain.com/prometheus`
- Grafana: `https://yourdomain.com/grafana`
- Alertmanager: `https://yourdomain.com/alertmanager`

### Key Metrics

Monitor these critical metrics:
- API response time (p95 < 500ms)
- Error rate (< 1%)
- CPU usage (< 80%)
- Memory usage (< 85%)
- Disk usage (< 90%)
- Task queue size (< 100)
- Token usage rate

### Dashboards

Pre-configured Grafana dashboards:
- System Overview
- Swarm Performance
- API Analytics
- Database Performance
- Redis Metrics
- Container Stats

## 🔄 Maintenance

### Backup Strategy

Automated daily backups at 2 AM:
- PostgreSQL full dumps
- Redis snapshots
- Volume backups
- S3 upload with retention

### Scaling

To scale workers horizontally:

```bash
# Scale worker replicas
docker-compose -f docker/production/docker-compose.production.yml \
  up -d --scale swarm-worker-1=3 --scale swarm-worker-2=3
```

### Updates

Zero-downtime update process:

```bash
# 1. Build new images
docker-compose -f docker/production/docker-compose.production.yml build

# 2. Rolling update
./docker/production/deploy-production.sh --skip-backup
```

### Troubleshooting

Common issues and solutions:

1. **Service not starting**
   ```bash
   docker-compose logs -f service-name
   docker exec service-name health-check-command
   ```

2. **Performance issues**
   - Check Grafana dashboards
   - Review container resource usage
   - Analyze slow query logs

3. **Connection issues**
   - Verify network connectivity
   - Check HAProxy backend status
   - Review security group rules

## 🔒 Security Considerations

1. **Secrets Management**
   - Use Docker secrets in Swarm mode
   - Rotate credentials regularly
   - Never commit .env files

2. **Network Security**
   - Implement firewall rules
   - Use VPN for admin access
   - Enable fail2ban for SSH

3. **Container Security**
   - Regular image updates
   - Security scanning with Trivy
   - Runtime protection with AppArmor/SELinux

## 📈 Performance Tuning

### Database Optimization
- Connection pooling via PgBouncer
- Optimized PostgreSQL settings
- Regular VACUUM and ANALYZE

### Caching Strategy
- Redis for session storage
- Nginx for static assets
- CDN integration ready

### Application Tuning
- Node.js memory limits
- Worker process optimization
- Connection pool sizing

## 🆘 Support

For issues or questions:
1. Check logs: `docker-compose logs -f`
2. Review monitoring dashboards
3. Consult alert history
4. Contact support team

## 📝 License

This deployment configuration is part of the Swarm platform and follows the project's licensing terms.