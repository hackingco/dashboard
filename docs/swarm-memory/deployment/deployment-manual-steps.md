# Manual Fly.io Deployment Steps

## Prerequisites

1. Ensure you're authenticated with Fly.io:
   ```bash
   fly auth login
   ```

2. Verify authentication:
   ```bash
   fly auth whoami
   ```

## Step 1: Create Apps

```bash
# Create the three main applications
fly apps create swarm-manager --org personal
fly apps create swarm-admin --org personal  
fly apps create swarm-worker --org personal
```

## Step 2: Create Redis Instance

```bash
# Create Redis app
fly apps create swarm-redis --org personal

# Create Redis volume
fly volumes create redis_data --region sjc --size 1 --app swarm-redis

# Deploy Redis (from project root)
cd /Users/shaight/claude-projects/swarm03
mkdir -p .temp-redis && cd .temp-redis

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

# Deploy Redis
fly deploy --app swarm-redis

# Cleanup
cd .. && rm -rf .temp-redis
```

## Step 3: Set Environment Variables

```bash
# Manager app secrets
fly secrets set \
  NODE_ENV="production" \
  PORT="8080" \
  REDIS_URL="redis://swarm-redis.internal:6379" \
  DATABASE_URL="sqlite:///data/swarm.db" \
  FLY_API_TOKEN="${FLY_API_TOKEN}" \
  --app swarm-manager

# Admin dashboard secrets
fly secrets set \
  NODE_ENV="production" \
  PORT="3000" \
  NEXT_PUBLIC_API_URL="https://swarm-manager.fly.dev" \
  REDIS_URL="redis://swarm-redis.internal:6379" \
  --app swarm-admin

# Worker template secrets
fly secrets set \
  NODE_ENV="production" \
  PORT="3000" \
  WORKER_TYPE="generic" \
  MANAGER_URL="http://swarm-manager.internal:8080" \
  TELEMETRY_ENDPOINT="http://swarm-manager.internal:8080/telemetry" \
  REDIS_URL="redis://swarm-redis.internal:6379" \
  --app swarm-worker
```

## Step 4: Deploy Manager Service

```bash
cd /Users/shaight/claude-projects/swarm03/apps/manager

# Create volume for SQLite database
fly volumes create swarm_data --region sjc --size 1 --app swarm-manager

# Deploy with standalone dockerfile
fly deploy --app swarm-manager --dockerfile Dockerfile.standalone
```

## Step 5: Deploy Admin Dashboard

```bash
cd /Users/shaight/claude-projects/swarm03/admin-dashboard

# Deploy the admin dashboard
fly deploy --app swarm-admin
```

## Step 6: Deploy Worker Template

```bash
cd /Users/shaight/claude-projects/swarm03/apps/worker

# Deploy worker template
fly deploy --app swarm-worker
```

## Step 7: Verify Deployments

```bash
# Check app statuses
fly status --app swarm-manager
fly status --app swarm-admin
fly status --app swarm-worker
fly status --app swarm-redis

# Test endpoints
curl https://swarm-manager.fly.dev/health
curl https://swarm-admin.fly.dev/
```

## Service URLs

- **Manager API**: https://swarm-manager.fly.dev
- **Admin Dashboard**: https://swarm-admin.fly.dev  
- **Worker Template**: https://swarm-worker.fly.dev
- **Redis**: redis://swarm-redis.internal:6379

## Useful Commands

```bash
# View logs
fly logs --app swarm-manager
fly logs --app swarm-admin
fly logs --app swarm-worker

# SSH into containers
fly ssh console --app swarm-manager
fly ssh console --app swarm-admin

# Scale applications
fly scale count 2 --app swarm-manager
fly scale count 1 --app swarm-admin
```

## Troubleshooting

1. If build fails, check Dockerfile paths and shared dependencies
2. If services don't start, check environment variables and secrets
3. If networking issues, verify internal URLs and Redis connectivity
4. Use `fly logs` to debug startup issues