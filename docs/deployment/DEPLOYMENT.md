# Deployment Guide: API-First Architecture

## 🚀 Deployment Overview

The Fly Swarm Orchestrator uses a **hybrid deployment approach**:
- **CI/CD**: Uses `flyctl deploy` for building and deploying containers
- **Runtime**: Uses direct Fly.io API calls for all operational tasks
- **Containers**: Lightweight images without flyctl dependencies

## 🏗️ Architecture Separation

### Deployment Time (CI/CD)
- **Tools**: `flyctl deploy`, Docker build, GitHub Actions
- **Purpose**: Build containers, deploy to Fly.io infrastructure
- **Dependencies**: flyctl CLI, Docker, deployment scripts

### Runtime Operations  
- **Tools**: FlyAPIClient, Langfuse tracing, direct API calls
- **Purpose**: Manage machines, scale workloads, monitor health
- **Dependencies**: API tokens only, no CLI tools

## 📋 Prerequisites

### Required Accounts & Services
- [Fly.io account](https://fly.io/signup) with API token
- [Supabase project](https://supabase.com) for data persistence
- [Redis instance](https://upstash.com) for caching and queues
- [Langfuse account](https://langfuse.com) for observability (recommended)

### Development Tools
```bash
# Required for deployment only
curl -L https://fly.io/install.sh | sh
fly auth login

# Verify flyctl installation
fly version
```

### API Credentials
```bash
# Get your Fly.io API token
fly auth token

# Set environment variables
export FLY_API_TOKEN="your-fly-api-token"
export LANGFUSE_SECRET_KEY="your-langfuse-secret"
export LANGFUSE_PUBLIC_KEY="your-langfuse-public"
```

## 🛠️ Environment Configuration

### Manager API (.env)
```env
# Server Configuration
PORT=8080
NODE_ENV=production

# Fly.io API Integration (REQUIRED)
FLY_API_TOKEN=your-fly-api-token
FLY_ACCESS_TOKEN=your-fly-access-token  # Alternative name

# Database & Cache
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
REDIS_URL=redis://your-redis-host:6379

# Observability (Recommended)
LANGFUSE_SECRET_KEY=sk_lf_your-secret-key
LANGFUSE_PUBLIC_KEY=pk_lf_your-public-key
LANGFUSE_HOST=https://cloud.langfuse.com

# Optional: Enhanced Features
TRUSTGRAPH_API_KEY=your-trustgraph-key
TRUSTGRAPH_API_URL=https://your-trustgraph-instance.com

# Frontend Integration
DASHBOARD_URL=https://admin.hacking.co
CORS_ORIGINS=https://admin.hacking.co,http://localhost:3000
```

### Dashboard (.env.local)
```env
# API Integration
NEXT_PUBLIC_MANAGER_URL=https://swarm-manager.fly.dev
NEXT_PUBLIC_WS_URL=wss://swarm-manager.fly.dev

# Supabase Integration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Optional: Analytics
NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY=pk_lf_your-public-key
```

### Worker (.env)
```env
# Worker Configuration
PORT=8000
NODE_ENV=production
WORKER_TYPE=general
WORKER_CONCURRENCY=2

# Queue & Cache
REDIS_URL=redis://your-redis-host:6379

# API Integration (inherited from manager)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# Observability
LANGFUSE_SECRET_KEY=sk_lf_your-secret-key
LANGFUSE_PUBLIC_KEY=pk_lf_your-public-key
```

## 🚀 Deployment Process

### Step 1: Initial Setup

```bash
# Clone and install dependencies
git clone https://github.com/your-repo/fly-swarm-orchestrator
cd fly-swarm-orchestrator
npm install

# Build all packages
npm run build
```

### Step 2: Database Setup

```bash
# Set up Supabase tables
cd supabase
npx supabase db push

# Run migrations
npx supabase migration up
```

### Step 3: Deploy Manager API

```bash
cd apps/manager

# Deploy to Fly.io (uses flyctl for deployment)
fly deploy

# Verify deployment
fly status --app swarm-manager
fly logs --app swarm-manager
```

### Step 4: Deploy Dashboard

```bash
cd apps/dashboard

# Deploy frontend
fly deploy

# Verify deployment
fly status --app swarm-dashboard
```

### Step 5: Deploy Worker Template

```bash
cd apps/worker

# Deploy worker template (used for scaling)
fly deploy

# This creates the base image for dynamic workers
fly status --app swarm-worker
```

## 🔧 Production Configuration

### Fly.io App Configuration

#### Manager App (fly.toml)
```toml
app = "swarm-manager"
primary_region = "dfw"

[build]
  dockerfile = "Dockerfile"

[env]
  NODE_ENV = "production"
  PORT = "8080"

[[vm]]
  memory = "1gb"
  cpu_kind = "shared"
  cpus = 2

[[services]]
  internal_port = 8080
  protocol = "tcp"
  auto_stop_machines = false
  auto_start_machines = true

  [[services.ports]]
    port = 80
    handlers = ["http"]
    force_https = true

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = false
  auto_start_machines = true
```

#### Dashboard App (fly.toml)
```toml
app = "swarm-dashboard"
primary_region = "dfw"

[build]
  dockerfile = "Dockerfile"

[env]
  NODE_ENV = "production"

[[vm]]
  memory = "512mb"
  cpu_kind = "shared"
  cpus = 1

[[services]]
  internal_port = 3000
  protocol = "tcp"

  [[services.ports]]
    port = 80
    handlers = ["http"]
    force_https = true

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]
```

### Docker Configuration

#### Manager Dockerfile
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/manager/package*.json apps/manager/
COPY shared/types/package*.json shared/types/

# Install dependencies (production only)
RUN npm ci --only=production --workspaces

# Copy source code
COPY apps/manager apps/manager/
COPY shared shared/

# Build application
RUN npm run build --workspace=apps/manager

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

# Health check for Fly.io
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

EXPOSE 8080

CMD ["node", "apps/manager/dist/index.js"]
```

#### Worker Dockerfile (Template)
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY apps/worker/package*.json apps/worker/
RUN npm ci --only=production

# Copy application
COPY apps/worker apps/worker/
COPY shared shared/

# Build
RUN npm run build --workspace=apps/worker

# Non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8000/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

EXPOSE 8000

CMD ["node", "apps/worker/dist/index.js"]
```

## 🔄 CI/CD Pipeline

### GitHub Actions Workflow

```yaml
name: Deploy to Fly.io

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - run: npm ci
      - run: npm run build
      - run: npm test
      
      # Test API integration
      - run: npm run test:integration
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}

  deploy:
    if: github.ref == 'refs/heads/main'
    needs: test
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      - uses: superfly/flyctl-actions/setup-flyctl@master
        with:
          version: latest
      
      # Deploy Manager API
      - run: flyctl deploy --app swarm-manager
        working-directory: apps/manager
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
      
      # Deploy Dashboard  
      - run: flyctl deploy --app swarm-dashboard
        working-directory: apps/dashboard
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
      
      # Deploy Worker Template
      - run: flyctl deploy --app swarm-worker
        working-directory: apps/worker
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}

  verify:
    needs: deploy
    runs-on: ubuntu-latest
    steps:
      - name: Health Check
        run: |
          curl -f https://swarm-manager.fly.dev/health
          curl -f https://swarm-dashboard.fly.dev
      
      - name: API Integration Test
        run: |
          # Test API-first operations
          curl -X POST https://swarm-manager.fly.dev/api/swarms \
            -H "Content-Type: application/json" \
            -d '{"name": "test-swarm", "type": "general"}'
```

## 📊 Monitoring & Observability

### Health Checks

```typescript
// Manager API health endpoint
app.get('/health', async (req, res) => {
  try {
    // Check Fly.io API connectivity
    const apps = await flyApiClient.listApps();
    
    // Check database connectivity
    await supabase.from('swarms').select('count').limit(1);
    
    // Check Redis connectivity  
    await redis.ping();
    
    // Check Langfuse connectivity
    const traceId = langfuseService.startTrace('health-check', {});
    await langfuseService.endTrace(traceId, { status: 'healthy' });
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        flyApi: 'connected',
        database: 'connected',
        redis: 'connected',
        langfuse: 'connected'
      },
      version: process.env.npm_package_version
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});
```

### Performance Monitoring

```bash
# Monitor deployment metrics
fly metrics --app swarm-manager

# View real-time logs
fly logs --app swarm-manager -f

# Check machine status
fly status --app swarm-manager

# Monitor API performance in Langfuse
open https://cloud.langfuse.com/project/your-project
```

## 🔧 Scaling Configuration

### Auto-scaling Setup

```typescript
// Configure auto-scaling via API
const scalingConfig = {
  minMachines: 1,
  maxMachines: 10,
  targetCpuPercent: 70,
  scaleUpCooldown: 300,   // 5 minutes
  scaleDownCooldown: 600  // 10 minutes
};

// Apply via Fly.io API (not flyctl)
await flyService.configureAutoScaling('swarm-manager', scalingConfig);
```

### Load Balancing

```toml
# In fly.toml for load-balanced apps
[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = false
  auto_start_machines = true
  
  [http_service.concurrency]
    type = "requests"
    hard_limit = 1000
    soft_limit = 800
```

## 🚨 Troubleshooting

### Common Deployment Issues

#### 1. API Token Issues
```bash
# Verify token works
curl -H "Authorization: Bearer $FLY_API_TOKEN" \
  https://api.machines.dev/v1/apps

# Regenerate if needed
fly auth token
```

#### 2. Container Size Issues
```dockerfile
# Optimize Dockerfile for smaller images
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS runtime
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
CMD ["node", "dist/index.js"]
```

#### 3. Health Check Failures
```typescript
// Enhanced health check with timeouts
const healthCheck = timeout(5000, async () => {
  // Quick checks only
  await Promise.all([
    flyApiClient.listApps().then(apps => apps.slice(0, 1)),
    redis.ping(),
    supabase.from('swarms').select('id').limit(1)
  ]);
});
```

### Performance Optimization

#### Database Optimization
```sql
-- Add indexes for common queries
CREATE INDEX idx_swarms_status ON swarms(status);
CREATE INDEX idx_workers_app_name ON workers(app_name);
CREATE INDEX idx_tasks_created_at ON tasks(created_at DESC);
```

#### Redis Configuration
```bash
# Optimize Redis for high throughput
redis-cli CONFIG SET maxmemory-policy allkeys-lru
redis-cli CONFIG SET maxmemory 256mb
```

#### API Rate Limiting
```typescript
// Configure rate limiting for API endpoints
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP'
}));
```

## 🔒 Security Considerations

### API Token Security
```bash
# Store tokens securely
fly secrets set FLY_API_TOKEN=your-token --app swarm-manager
fly secrets set LANGFUSE_SECRET_KEY=your-key --app swarm-manager
```

### Network Security
```toml
# Restrict network access in fly.toml
[network]
  ipv4 = "dedicated"
  ipv6 = false
```

### Container Security
```dockerfile
# Run as non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

# Remove unnecessary packages
RUN apk del .build-deps
```

---

**Deployment Status**: ✅ **Production Ready** - API-first architecture with comprehensive observability, monitoring, and scaling capabilities.