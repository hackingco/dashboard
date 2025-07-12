# Swarm Platform Deployment Guide

## Current Status

✅ **Built Successfully**: All TypeScript packages compile without errors
✅ **Apps Created**: swarm-admin, swarm-manager, swarm-worker on Fly.io
✅ **Secrets Configured**: Environment variables set for all apps
✅ **Authentication**: Logged in as admin@hacking.co

## Quick Deployment

### Prerequisites
```bash
# 1. Set up Fly.io API token (required for API operations)
./scripts/setup-fly-token.sh

# 2. Ensure you're authenticated
fly auth whoami
# Should show: admin@hacking.co

# If not authenticated:
fly auth login
```

### Fly.io API Token Configuration

The swarm manager now uses the Fly.io Machines API for real-time machine management. 
You must configure the `FLY_ACCESS_TOKEN` environment variable:

```bash
# Option 1: Use the setup script (recommended)
./scripts/setup-fly-token.sh

# Option 2: Manual setup
export FLY_ACCESS_TOKEN=$(fly auth token)
echo "FLY_ACCESS_TOKEN=$FLY_ACCESS_TOKEN" >> .env
echo "FLY_ACCESS_TOKEN=$FLY_ACCESS_TOKEN" >> apps/manager/.env

# Option 3: Set as Fly secret (for production)
fly secrets set FLY_ACCESS_TOKEN=$(fly auth token) --app swarm-manager
```

### Deploy Manager API
```bash
cd apps/manager

# Use the simplified Dockerfile
FLY_ACCESS_TOKEN=$(fly auth token) fly deploy --app swarm-manager --dockerfile Dockerfile.simple --remote-only
```

### Deploy Dashboard
```bash
cd apps/dashboard

# Next.js handles deployment well
FLY_ACCESS_TOKEN=$(fly auth token) fly deploy --app swarm-admin --remote-only
```

### Deploy Worker
```bash
cd apps/worker

# Create simple Dockerfile first
cat > Dockerfile.simple << 'EOF'
FROM node:18-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --production --legacy-peer-deps
COPY dist ./dist
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs
EXPOSE 8000
CMD ["node", "dist/index.js"]
EOF

# Deploy
FLY_ACCESS_TOKEN=$(fly auth token) fly deploy --app swarm-worker --dockerfile Dockerfile.simple --remote-only
```

## Application URLs

- **Dashboard**: https://swarm-admin.fly.dev
- **Manager API**: https://swarm-manager.fly.dev
- **Worker**: https://swarm-worker.fly.dev

## Environment Variables (Already Set)

### swarm-manager
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `REDIS_URL`
- `FLY_ACCESS_TOKEN` (or `FLY_API_TOKEN` for backward compatibility)
- `JWT_SECRET`

### Enhanced Fly.io API Features

The updated FlyService now provides real-time machine management:

1. **Machine Launch**: Direct API calls to create machines
2. **Machine Scaling**: Scale individual machines (CPU/memory)
3. **Health Monitoring**: Automatic health check polling
4. **Machine Stats**: Real-time CPU, memory, disk, and network metrics
5. **Machine Control**: Start, stop, restart, and destroy machines

Example API endpoints:
- `POST /swarms/:id/machines` - Create new machine
- `PUT /swarms/:id/machines/:machineId/scale` - Scale machine resources
- `GET /swarms/:id/machines/:machineId/stats` - Get real-time stats
- `POST /swarms/:id/machines/:machineId/restart` - Restart machine

### swarm-admin
- `NEXT_PUBLIC_API_URL=https://swarm-manager.fly.dev`

### swarm-worker
- `REDIS_URL`
- `MANAGER_URL=https://swarm-manager.fly.dev`

## Troubleshooting

### Build Issues
```bash
# Rebuild all packages
pnpm run build

# Check TypeScript compilation
cd apps/manager && npx tsc
```

### Deployment Issues
1. **Remote builder issues**: Use `--local-only` if Docker is available
2. **Authentication**: Always use `FLY_ACCESS_TOKEN=$(fly auth token)` prefix
3. **Monorepo issues**: Use the simplified Dockerfiles that copy only dist folders

### Check Logs
```bash
fly logs --app swarm-manager
fly logs --app swarm-admin
fly logs --app swarm-worker
```

## Local Testing

Before deploying, test locally:
```bash
# Manager API
cd apps/manager
npm start

# Dashboard (in another terminal)
cd apps/dashboard
npm run dev

# Worker (in another terminal)
cd apps/worker
npm start
```

## Next Steps

1. **Database Setup**: Configure actual Supabase/PostgreSQL connection
2. **Redis Setup**: Connect to actual Redis instance
3. **Monitoring**: Set up Langfuse integration
4. **CI/CD**: Configure GitHub Actions
5. **Documentation**: Update README with usage instructions