# Fly Swarm Orchestrator

A distributed swarm orchestration system built on Fly.io infrastructure with collective intelligence capabilities.

## Architecture

The system consists of three main components:

### 1. Dashboard
- React/Next.js frontend with Tailwind CSS
- Real-time swarm monitoring and metrics
- Worker management interface
- Task queue visualization

### 2. Manager API
- Express.js REST API
- Fly.io integration for app deployment and scaling
- BullMQ for task queue management
- Supabase for data persistence
- Redis for caching and queue backend

### 3. Worker Swarms
- Distributed task processing nodes
- Auto-scaling based on workload
- Multiple worker types (researcher, coder, analyst, tester)
- Health monitoring and metrics export

## Setup

### Prerequisites
- Node.js 18+
- Fly.io account and CLI installed
- Redis instance
- Supabase project

### Environment Variables

Create `.env` files in each app directory:

#### Dashboard (.env.local)
```env
NEXT_PUBLIC_MANAGER_URL=https://swarm-manager.fly.dev
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

#### Manager API (.env)
```env
PORT=8080
FLY_API_TOKEN=your-fly-api-token
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_KEY=your-supabase-service-key
REDIS_HOST=your-redis-host
REDIS_PORT=6379
DASHBOARD_URL=https://hacking.co
```

#### Worker (.env)
```env
PORT=8000
REDIS_HOST=your-redis-host
REDIS_PORT=6379
WORKER_TYPE=generic
WORKER_CONCURRENCY=1
```

### Installation

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run in development
npm run dev
```

### Deployment

```bash
# Deploy all apps to Fly.io
npm run deploy

# Or deploy individually
cd apps/dashboard && npm run deploy
cd apps/manager && npm run deploy
cd apps/worker && npm run deploy
```

## API Endpoints

### Swarms
- `GET /api/swarms` - List all swarms
- `POST /api/swarms` - Create a new swarm
- `GET /api/swarms/:id` - Get swarm details
- `PUT /api/swarms/:id/scale` - Scale swarm workers
- `DELETE /api/swarms/:id` - Destroy swarm

### Workers
- `GET /api/workers` - List all workers
- `GET /api/workers/:id` - Get worker details
- `POST /api/workers/:id/restart` - Restart worker

### Tasks
- `GET /api/tasks` - List tasks
- `POST /api/tasks` - Create task
- `GET /api/tasks/:id` - Get task details
- `DELETE /api/tasks/:id` - Cancel task

## Future Integrations

### Claude-Flow Hive Mind
Integration points for collective intelligence:
- Consensus voting mechanisms
- Shared memory systems
- Neural synchronization
- Swarm thinking capabilities

### TrustGraph DAG
Workflow orchestration with:
- Dependency management
- Checkpoint validation
- Parallel execution paths
- State persistence

### Langfuse Tracing
LLM observability including:
- Request/response logging
- Performance metrics
- Cost tracking
- Error analysis

## Development

This is a monorepo using npm workspaces and Turborepo for build orchestration.

### Project Structure
```
.
├── apps/
│   ├── dashboard/      # Next.js admin interface
│   ├── manager/        # Express API server
│   └── worker/         # Task worker nodes
├── shared/
│   ├── types/          # TypeScript type definitions
│   └── utils/          # Shared utilities
└── infrastructure/     # Deployment configs
```

### Testing
```bash
# Run all tests
npm test

# Run specific app tests
cd apps/manager && npm test
```

## License

MIT
