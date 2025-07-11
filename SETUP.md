# PromptDash - Setup Guide

## Initial Setup Complete ✅

The PromptDash codebase has been successfully created and committed to git.

## Next Steps

### 1. Create GitHub Repository

Create a new repository at https://github.com/hackingco/dashboard:

```bash
# Add remote origin
git remote add origin https://github.com/hackingco/dashboard.git

# Push to GitHub
git push -u origin master
```

### 2. Environment Setup

Create the following environment files:

#### apps/dashboard/.env.local
```
NEXT_PUBLIC_MANAGER_URL=http://localhost:8080
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

#### apps/manager/.env
```
PORT=8080
FLY_API_TOKEN=your-fly-api-token
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_KEY=your-supabase-service-key
REDIS_HOST=localhost
REDIS_PORT=6379
DASHBOARD_URL=http://localhost:3000
```

#### apps/worker/.env
```
PORT=8000
REDIS_HOST=localhost
REDIS_PORT=6379
WORKER_TYPE=generic
WORKER_CONCURRENCY=1
```

### 3. Supabase Setup

Create the following tables in your Supabase project:

```sql
-- Swarms table
CREATE TABLE swarms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) UNIQUE NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  worker_count INTEGER DEFAULT 1,
  worker_type VARCHAR(50) DEFAULT 'generic',
  fly_app_name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workers table
CREATE TABLE workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  swarm_id UUID REFERENCES swarms(id) ON DELETE CASCADE,
  machine_id VARCHAR(255),
  state VARCHAR(50),
  region VARCHAR(50),
  type VARCHAR(50),
  config JSONB,
  metrics JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tasks table
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(255) NOT NULL,
  swarm_id UUID REFERENCES swarms(id),
  worker_id UUID REFERENCES workers(id),
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  payload JSONB,
  result JSONB,
  error TEXT,
  priority INTEGER DEFAULT 5,
  retries INTEGER DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);
```

### 4. Local Development

```bash
# Install dependencies
npm install

# Start Redis (required for task queue)
docker run -d -p 6379:6379 redis:alpine

# Run development servers
npm run dev
```

### 5. Fly.io Deployment

```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Login to Fly
fly auth login

# Deploy each app
cd apps/dashboard && fly launch
cd apps/manager && fly launch
cd apps/worker && fly launch
```

### 6. Future Integrations

The following integrations are prepared but require additional setup:

#### Claude-Flow Hive Mind
- Install MCP claude-flow tools
- Configure collective intelligence parameters
- Set up consensus mechanisms

#### TrustGraph DAG
- Install TrustGraph library
- Configure workflow definitions
- Set up checkpoint storage

#### Langfuse LLM Tracing
- Create Langfuse account
- Add API keys to environment
- Configure trace collection

## Architecture Summary

```
┌─────────────────┐     ┌──────────────┐     ┌──────────────┐
│    Dashboard    │────▶│  Manager API │────▶│  Fly.io API  │
│  (Next.js/React)│     │  (Express.js)│     │              │
└─────────────────┘     └──────────────┘     └──────────────┘
                               │
                               ▼
                        ┌──────────────┐
                        │   BullMQ     │
                        │  Task Queue  │
                        └──────────────┘
                               │
                               ▼
                        ┌──────────────┐
                        │   Workers    │
                        │  (Swarm Nodes)│
                        └──────────────┘
```

## GitHub Issue Template

Create an issue at https://github.com/hackingco/dashboard/issues with:

**Title:** Initial PromptDash Setup

**Body:**
```markdown
## PromptDash - Initial Setup Complete

### Completed Tasks
- [x] Bootstrap Fly.io infrastructure (Dashboard, Manager, Worker apps)
- [x] Scaffold React/Tailwind admin dashboard
- [x] Implement Swarm-Manager API with Express.js
- [x] Integrate Fly.io CLI operations
- [x] Set up BullMQ task queue with Redis
- [x] Create shared TypeScript types and utilities
- [x] Configure monorepo with Turborepo

### Pending Tasks
- [ ] Deploy to Fly.io production
- [ ] Configure Supabase database
- [ ] Integrate Claude-Flow hive endpoints
- [ ] Add TrustGraph DAG orchestration
- [ ] Implement Langfuse LLM tracing

### Setup Instructions
See SETUP.md for detailed deployment instructions.

### Architecture
- Dashboard: React/Next.js with real-time monitoring
- Manager API: REST API for swarm orchestration
- Workers: Distributed task processing nodes
- Queue: BullMQ with Redis backend

### Next Steps
1. Configure environment variables
2. Deploy to Fly.io
3. Set up monitoring and logging
4. Integrate remaining services
```