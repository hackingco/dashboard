# Manual Deployment Guide for Swarm Management System

## Prerequisites

1. **Install Fly CLI**:
   ```bash
   curl -L https://fly.io/install.sh | sh
   export PATH="$HOME/.fly/bin:$PATH"
   ```

2. **Authenticate with Fly.io**:
   ```bash
   fly auth login
   ```

## Step-by-Step Deployment

### 1. Create Redis Instance

```bash
# Create Redis app
fly apps create swarm-redis --org personal

# Create temporary Redis directory
mkdir temp-redis && cd temp-redis

# Create Redis fly.toml
cat > fly.toml << 'EOF'
app = "swarm-redis"
primary_region = "sjc"

[[services]]
  protocol = "tcp"
  internal_port = 6379
  
  [[services.ports]]
    port = 6379

[mounts]
  source = "redis_data"
  destination = "/data"
EOF

# Create Redis Dockerfile
cat > Dockerfile << 'EOF'
FROM redis:7-alpine
EXPOSE 6379
CMD ["redis-server", "--appendonly", "yes"]
EOF

# Create volume and deploy
fly volumes create redis_data --region sjc --size 1 --app swarm-redis
fly deploy --app swarm-redis

# Cleanup
cd .. && rm -rf temp-redis
```

### 2. Set Environment Variables

**For Manager (swarm-manager):**
```bash
fly secrets set \
  NODE_ENV="production" \
  PORT="8080" \
  REDIS_URL="redis://swarm-redis.internal:6379" \
  DATABASE_URL="sqlite:///data/swarm.db" \
  --app swarm-manager
```

**For Dashboard (swarm-admin):**
```bash
fly secrets set \
  NODE_ENV="production" \
  PORT="3000" \
  NEXT_PUBLIC_API_URL="https://swarm-manager.fly.dev" \
  --app swarm-admin
```

### 3. Build Project

```bash
# From project root
pnpm run build
```

### 4. Prepare Manager for Deployment

```bash
cd apps/manager

# Create shared packages directory
mkdir -p shared/types shared/utils shared/supabase node_modules/@swarm

# Copy built shared packages
cp -r ../../shared/types/dist shared/types/
cp ../../shared/types/package.json shared/types/
cp -r ../../shared/utils/dist shared/utils/
cp ../../shared/utils/package.json shared/utils/
cp -r ../../shared/supabase/dist shared/supabase/
cp ../../shared/supabase/package.json shared/supabase/

# Copy to node_modules structure
cp -r shared/types node_modules/@swarm/
cp -r shared/utils node_modules/@swarm/
cp -r shared/supabase node_modules/@swarm/
```

### 5. Deploy Manager

```bash
cd apps/manager

# Create volume for SQLite database
fly volumes create swarm_data --region sjc --size 1 --app swarm-manager

# Deploy with standalone Dockerfile
fly deploy --app swarm-manager --dockerfile Dockerfile.standalone
```

### 6. Deploy Dashboard

```bash
cd apps/dashboard
fly deploy --app swarm-admin
```

### 7. Test Services

```bash
# Test Manager API
curl https://swarm-manager.fly.dev/health
curl https://swarm-manager.fly.dev/api/swarms

# Test Dashboard
curl https://swarm-admin.fly.dev/
```

## Service URLs

- **Manager API**: https://swarm-manager.fly.dev
- **Dashboard**: https://swarm-admin.fly.dev
- **Redis**: redis://swarm-redis.internal:6379

## Troubleshooting

### Check Application Status
```bash
fly status --app swarm-manager
fly status --app swarm-admin
fly status --app swarm-redis
```

### View Logs
```bash
fly logs --app swarm-manager
fly logs --app swarm-admin
fly logs --app swarm-redis
```

### SSH into Applications
```bash
fly ssh console --app swarm-manager
```

### Common Issues

1. **Manager fails to start**: Check if @supabase dependencies are properly installed
   - Solution: Ensure package.standalone.json is used and shared packages are copied

2. **Database connection issues**: Verify SQLite database is accessible
   - Solution: Ensure volume is mounted and writable

3. **Redis connection fails**: Check Redis app is running
   - Solution: `fly status --app swarm-redis`

4. **Dashboard can't reach API**: Verify API URL environment variable
   - Solution: Check NEXT_PUBLIC_API_URL points to correct manager URL

## Current Deployment Status

### ✅ Completed Infrastructure
- Fly.io apps created: swarm-manager, swarm-admin, swarm-worker
- Basic configuration files ready
- Standalone Dockerfiles prepared

### 🚧 Pending Tasks
1. Redis instance creation and deployment
2. Environment variables configuration
3. Manager deployment with fixed dependencies
4. Dashboard deployment
5. Service health verification

### 🎯 Expected Results
After successful deployment:
- Manager API available at https://swarm-manager.fly.dev
- Dashboard UI available at https://swarm-admin.fly.dev
- Redis accessible internally for session management
- Health endpoints responding correctly
- Swarm management functionality operational