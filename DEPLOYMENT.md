# Swarm Platform Deployment Guide

## Current Status

✅ **Built Successfully**: All TypeScript packages compile without errors
✅ **Apps Created**: swarm-admin, swarm-manager, swarm-worker on Fly.io
✅ **Secrets Configured**: Environment variables set for all apps
✅ **Authentication**: Logged in as admin@hacking.co

## Quick Deployment

### Prerequisites
```bash
# Ensure you're authenticated
fly auth whoami
# Should show: admin@hacking.co

# If not authenticated:
fly auth login
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
- `FLY_API_TOKEN`
- `JWT_SECRET`

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