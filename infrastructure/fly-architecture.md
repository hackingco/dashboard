# Fly.io Infrastructure Architecture for Swarm with Langfuse

## 🏗️ Multi-Service Architecture Overview

This document outlines the complete Fly.io deployment architecture for the swarm orchestration platform with integrated Langfuse instrumentation.

### 🎯 Core Services Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     FLY.IO INFRASTRUCTURE                   │
├─────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   SWARM      │  │  LANGFUSE    │  │ POSTGRESQL   │     │
│  │   MANAGER    │  │  INSTANCE    │  │  DATABASE    │     │
│  │              │  │              │  │              │     │
│  │ Port: 8080   │  │ Port: 3000   │  │ Port: 5432   │     │
│  │ HA: 2+ nodes │  │ HA: 1-2 nodes│  │ HA: 1 primary│     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│           │                │                │             │
│           └──── Network ────┴──── Internal ──┴─────────────│
│                                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ DASHBOARD    │  │   WORKERS    │  │    REDIS     │     │
│  │  (NEXT.JS)   │  │ (DYNAMIC)    │  │   CACHE      │     │
│  │              │  │              │  │              │     │
│  │ Port: 3000   │  │ Port: 3000   │  │ Port: 6379   │     │
│  │ Auto-scale   │  │ 0-10 per type│  │ Single node  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                            │
└─────────────────────────────────────────────────────────────┘
```

## 🌍 Multi-Region Deployment Strategy

### Primary Region: Chicago (ORD)
- **Reason**: Central US location, excellent connectivity
- **Services**: All core services for low latency
- **Database**: Primary PostgreSQL instance

### Secondary Regions: East/West Coast
- **East Coast (IAD)**: Dashboard replicas for faster loading
- **West Coast (SJC)**: Worker replicas for distributed processing
- **Cross-region connectivity**: Fly.io private networking

### Edge Deployment Plan
```yaml
regions:
  primary: "ord"      # Chicago - Main services
  secondary:
    - "iad"           # Virginia - Dashboard
    - "sjc"           # San Jose - Workers
  database: "ord"     # PostgreSQL primary only
```

## 📊 Service Specifications

### 1. Swarm Manager (Core Service)
- **App Name**: `swarm-manager-prod`
- **Regions**: `ord` (primary), `iad` (standby)
- **Instances**: 2-4 (always running)
- **Resources**: 2 CPU, 2GB RAM
- **Storage**: 10GB volume for SQLite coordination
- **Network**: Public + Private
- **Health**: `/health` endpoint
- **Metrics**: Prometheus on `:9090`

### 2. Langfuse Observability
- **App Name**: `langfuse-swarm`
- **Regions**: `ord` only
- **Instances**: 1-2 (auto-scale)
- **Resources**: 1 CPU, 1GB RAM
- **Database**: PostgreSQL connection
- **Network**: Private only (accessed via manager)
- **Health**: `/api/health`

### 3. PostgreSQL Database
- **Service**: Fly.io Postgres
- **Name**: `swarm-postgres`
- **Region**: `ord` only
- **Size**: `shared-cpu-1x` (2GB RAM)
- **Storage**: 50GB volume
- **Backup**: Daily automated
- **Extensions**: `uuid-ossp`, `pg_stat_statements`

### 4. Dashboard Interface
- **App Name**: `swarm-dashboard`
- **Regions**: `ord`, `iad` (multi-region)
- **Instances**: 1-3 (auto-scale)
- **Resources**: 1 CPU, 512MB RAM
- **Framework**: Next.js standalone
- **CDN**: Fly.io edge caching
- **Health**: `/api/health`

### 5. Dynamic Workers
- **Template Name**: `swarm-worker-template`
- **Regions**: `ord`, `sjc` (distributed)
- **Instances**: 0-10 per type (on-demand)
- **Resources**: 1 CPU, 256MB RAM
- **Scaling**: Based on queue depth
- **Registration**: Auto with manager

### 6. Redis Cache
- **Service**: Fly.io Redis (Upstash)
- **Name**: `swarm-redis`
- **Region**: `ord` only
- **Size**: 512MB
- **Usage**: Session cache, worker coordination
- **Network**: Private only

## 🔗 Network Architecture

### Internal Service Discovery
```
swarm-manager-prod.internal:8080     -> Manager API
langfuse-swarm.internal:3000         -> Langfuse Web UI
swarm-postgres.internal:5432         -> PostgreSQL
swarm-redis.internal:6379            -> Redis Cache
```

### External Access Points
```
https://swarm-manager-prod.fly.dev   -> Manager API (public)
https://swarm-dashboard.fly.dev      -> Dashboard UI (public)
https://langfuse-swarm.fly.dev       -> Langfuse UI (restricted)
```

### Cross-Service Communication
- **Dashboard → Manager**: HTTPS public API
- **Manager → Langfuse**: HTTP private network
- **Manager → Workers**: HTTP private network
- **Manager → Database**: PostgreSQL private
- **All → Redis**: Private network cache

## 💾 Persistent Storage Strategy

### SQLite Coordination Volumes
```yaml
manager_volumes:
  - name: "manager_coordination"
    size: "10gb"
    path: "/data/coordination"
    purpose: "Swarm state, agent memory"
    
  - name: "manager_logs"
    size: "5gb" 
    path: "/data/logs"
    purpose: "Persistent logging"
```

### PostgreSQL Schema
```sql
-- Langfuse core tables
- traces, spans, observations
- generations, scores, datasets
- sessions, users, projects

-- Custom swarm tables  
- swarm_instances
- agent_registrations
- task_executions
- performance_metrics
```

### Backup Strategy
- **PostgreSQL**: Daily automated snapshots
- **SQLite volumes**: Weekly snapshots via Fly.io
- **Application logs**: Centralized via Fly logging
- **Metrics data**: 30-day retention in Prometheus

## 🔐 Secrets Management Architecture

### Manager Secrets
```yaml
SUPABASE_URL: "Database connection"
SUPABASE_SERVICE_KEY: "Full access key"
FLY_API_TOKEN: "Machine management"
LANGFUSE_SECRET_KEY: "Observability access"
POSTGRES_URL: "Direct DB connection"
REDIS_URL: "Cache connection"
```

### Dashboard Secrets (Public)
```yaml
NEXT_PUBLIC_SUPABASE_URL: "Client connection"
NEXT_PUBLIC_SUPABASE_ANON_KEY: "Public access"
NEXT_PUBLIC_LANGFUSE_URL: "Telemetry endpoint"
```

### Worker Secrets (Dynamic)
```yaml
MANAGER_URL: "Service discovery"
WORKER_TOKEN: "Authentication"
REDIS_URL: "Shared cache access"
```

## 🏥 Health Check Strategy

### Multi-Layer Health Monitoring
```yaml
infrastructure:
  - vm_health: "CPU, memory, disk"
  - network_health: "Connectivity, DNS"
  - volume_health: "Disk I/O, space"

application:
  - service_health: "/health endpoints"
  - database_health: "Connection pools"
  - cache_health: "Redis connectivity"

business:
  - swarm_health: "Active agents"
  - task_health: "Queue processing"
  - performance: "Response times"
```

### Health Check Endpoints
```javascript
// Manager health check
GET /health
{
  "status": "healthy",
  "services": {
    "database": "connected",
    "redis": "connected", 
    "langfuse": "connected",
    "swarm": "3_agents_active"
  },
  "uptime": 86400,
  "memory_usage": "45%"
}
```

## 📈 Auto-Scaling Configuration

### Manager Service (HA)
```toml
min_machines_running = 2
max_machines_running = 4

[autoscaling.metrics]
  type = "requests"
  soft_limit = 50
  hard_limit = 100
```

### Dashboard Service (Traffic-based)
```toml
min_machines_running = 1
max_machines_running = 3

[autoscaling.metrics]
  type = "connections"
  soft_limit = 25
  hard_limit = 50
```

### Worker Services (Queue-based)
```toml
min_machines_running = 0
max_machines_running = 10

[autoscaling.metrics]
  type = "queue_depth"
  soft_limit = 5
  hard_limit = 15
```

## 🔧 Deployment Pipeline Architecture

### 1. Build Strategy
- **Multi-stage Dockerfiles**: Minimize image size
- **Layer caching**: Speed up builds
- **Security scanning**: Built-in vulnerability checks
- **Dependency optimization**: Production-only packages

### 2. Deployment Strategy
- **Rolling deployments**: Zero downtime
- **Health check gates**: Don't proceed if unhealthy
- **Automatic rollback**: On failure detection
- **Blue-green capable**: For major updates

### 3. Configuration Management
- **Environment-based**: dev/staging/prod
- **Secret rotation**: Automated credential updates
- **Feature flags**: Runtime behavior control
- **A/B testing**: Traffic splitting

## 🚨 Monitoring & Alerting

### Observability Stack
```yaml
metrics:
  - prometheus: "Application metrics"
  - fly_metrics: "Infrastructure metrics"
  - langfuse: "LLM observability"

logging:
  - fly_logs: "Centralized logging"
  - structured: "JSON format"
  - retention: "30 days"

tracing:
  - langfuse_traces: "Request tracing"
  - performance: "Response times"
  - errors: "Error tracking"
```

### Alert Conditions
```yaml
critical:
  - service_down: "Any service unavailable >5min"
  - database_down: "PostgreSQL unreachable"
  - high_error_rate: ">5% in 10min window"

warning:
  - high_latency: ">2s response time"
  - high_cpu: ">80% for 15min"
  - disk_space: "<10% remaining"
```

## 📋 Deployment Checklist

### Pre-Deployment
- [ ] Fly CLI authenticated
- [ ] PostgreSQL instance created
- [ ] Redis instance provisioned
- [ ] Secrets configured
- [ ] DNS records set (if custom domain)

### Deployment Order
1. [ ] PostgreSQL database
2. [ ] Redis cache
3. [ ] Langfuse service
4. [ ] Manager service
5. [ ] Dashboard service
6. [ ] Worker templates

### Post-Deployment
- [ ] Health checks passing
- [ ] Service discovery working
- [ ] Database migrations complete
- [ ] Monitoring configured
- [ ] Load testing performed

This architecture provides a robust, scalable foundation for the swarm orchestration platform with comprehensive observability through Langfuse integration.