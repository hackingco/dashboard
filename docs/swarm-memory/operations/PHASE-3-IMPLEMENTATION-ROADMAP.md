# Phase 3 Implementation Roadmap: Data Foundation & Real-Time Infrastructure

## Week 1: Supabase Setup & Core Data Models

### Day 1-2: Supabase Project Setup
- [ ] Create Supabase account and new project
- [ ] Set up authentication configuration
- [ ] Configure database access policies
- [ ] Create development and production environments
- [ ] Document connection strings and API keys

### Day 3-4: Database Schema Implementation
```sql
-- Execute the following schema in Supabase SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Swarms table
CREATE TABLE swarms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  purpose TEXT,
  status VARCHAR(50) DEFAULT 'initializing',
  config JSONB DEFAULT '{}',
  metrics JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Workers table
CREATE TABLE workers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  swarm_id UUID REFERENCES swarms(id) ON DELETE CASCADE,
  machine_id VARCHAR(255) UNIQUE,
  status VARCHAR(50) DEFAULT 'created',
  region VARCHAR(50),
  type VARCHAR(50) DEFAULT 'general',
  config JSONB DEFAULT '{}',
  metrics JSONB DEFAULT '{}',
  last_heartbeat TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks table
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  swarm_id UUID REFERENCES swarms(id) ON DELETE CASCADE,
  worker_id UUID REFERENCES workers(id) ON DELETE SET NULL,
  type VARCHAR(100) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  priority INTEGER DEFAULT 0,
  payload JSONB DEFAULT '{}',
  result JSONB,
  error TEXT,
  retries INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Logs table (partitioned by day for performance)
CREATE TABLE logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  swarm_id UUID REFERENCES swarms(id) ON DELETE CASCADE,
  worker_id UUID REFERENCES workers(id) ON DELETE SET NULL,
  level VARCHAR(20) NOT NULL,
  source VARCHAR(100),
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (timestamp);

-- Create log partitions for the next 30 days
-- (Add partition creation logic here)

-- Metrics table (time-series data)
CREATE TABLE metrics (
  time TIMESTAMPTZ NOT NULL,
  swarm_id UUID REFERENCES swarms(id) ON DELETE CASCADE,
  worker_id UUID REFERENCES workers(id) ON DELETE CASCADE,
  metric_name VARCHAR(100) NOT NULL,
  value NUMERIC NOT NULL,
  tags JSONB DEFAULT '{}'
);

-- Create hypertable for metrics if using TimescaleDB
-- SELECT create_hypertable('metrics', 'time');

-- Indexes for performance
CREATE INDEX idx_workers_swarm_id ON workers(swarm_id);
CREATE INDEX idx_tasks_swarm_id ON tasks(swarm_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_logs_swarm_id_timestamp ON logs(swarm_id, timestamp);
CREATE INDEX idx_metrics_time ON metrics(time DESC);

-- Row Level Security policies
ALTER TABLE swarms ENABLE ROW LEVEL SECURITY;
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE metrics ENABLE ROW LEVEL SECURITY;

-- Create update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_swarms_updated_at BEFORE UPDATE ON swarms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_workers_updated_at BEFORE UPDATE ON workers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### Day 5: TypeScript SDK Setup
```typescript
// Create shared/supabase-client/src/index.ts
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

export const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Add real-time subscriptions
export const subscribeToSwarmUpdates = (swarmId: string, callback: Function) => {
  return supabase
    .channel(`swarm:${swarmId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'swarms',
      filter: `id=eq.${swarmId}`
    }, callback)
    .subscribe()
}
```

## Week 2: Manager API Integration & Dashboard Updates

### Day 6-7: Manager Service Supabase Integration
- [ ] Add Supabase client to manager service
- [ ] Replace in-memory storage with database calls
- [ ] Implement pagination helpers
- [ ] Add transaction support for complex operations
- [ ] Create database connection pool

### Day 8-9: Dashboard Data Integration
- [ ] Update dashboard to use Supabase client
- [ ] Replace mock data with real queries
- [ ] Add loading and error states
- [ ] Implement optimistic updates
- [ ] Add data caching layer

### Day 10: Real-Time Features
- [ ] Set up Supabase real-time subscriptions
- [ ] Update SwarmOverview for live updates
- [ ] Implement live log streaming
- [ ] Add presence features (who's viewing what)
- [ ] Create connection status indicator

## Week 3: Worker Implementation & Task System

### Day 11-12: Worker Core Development
```typescript
// apps/worker/src/worker.ts
export class SwarmWorker {
  private supabase: SupabaseClient
  private queue: Queue
  private workerId: string
  
  async start() {
    // Register worker in database
    // Start heartbeat
    // Begin processing tasks
    // Set up graceful shutdown
  }
  
  async processTask(task: Task) {
    // Update task status
    // Execute task logic
    // Report results
    // Handle errors
  }
}
```

### Day 13-14: Task Queue Implementation
- [ ] Set up Redis connection
- [ ] Configure BullMQ queues
- [ ] Implement task distribution algorithm
- [ ] Add retry logic with exponential backoff
- [ ] Create dead letter queue

### Day 15: Worker Health & Monitoring
- [ ] Implement health check endpoint
- [ ] Add Prometheus metrics
- [ ] Create performance tracking
- [ ] Set up log aggregation
- [ ] Add crash recovery

## Week 4: Observability & Polish

### Day 16-17: Observability Integration
- [ ] Integrate Langfuse for LLM tracing
- [ ] Set up distributed tracing
- [ ] Create custom dashboards
- [ ] Implement cost tracking
- [ ] Add performance profiling

### Day 18-19: Testing & Documentation
- [ ] Write integration tests
- [ ] Create API documentation
- [ ] Add user guides
- [ ] Document deployment process
- [ ] Create troubleshooting guide

### Day 20: Production Readiness
- [ ] Performance optimization
- [ ] Security audit
- [ ] Load testing
- [ ] Disaster recovery plan
- [ ] Monitoring alerts setup

## Implementation Checklist

### Environment Setup
```bash
# Required services
- [ ] Supabase account (free tier)
- [ ] Redis instance (Upstash free tier)
- [ ] Fly.io account
- [ ] GitHub repository
- [ ] Monitoring service (optional)
```

### Configuration Files
```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key
REDIS_URL=your-redis-url
FLY_API_TOKEN=your-fly-token
```

### Key Deliverables

1. **Functional Dashboard**
   - Real-time swarm status
   - Live log streaming
   - Task progress tracking
   - Performance metrics

2. **Robust API**
   - Full CRUD operations
   - WebSocket support
   - Rate limiting
   - Authentication

3. **Working Workers**
   - Task execution
   - Health monitoring
   - Auto-scaling
   - Error recovery

4. **Observability**
   - Centralized logging
   - Distributed tracing
   - Performance metrics
   - Cost tracking

## Risk Mitigation

1. **Database Performance**
   - Use connection pooling
   - Implement caching
   - Add read replicas if needed

2. **Real-time Scalability**
   - Use presence for connection management
   - Implement backpressure
   - Add circuit breakers

3. **Worker Reliability**
   - Implement supervision trees
   - Add health checks
   - Use container orchestration

4. **Data Consistency**
   - Use transactions
   - Implement idempotency
   - Add conflict resolution

## Success Criteria

- [ ] All CRUD operations working with < 200ms latency
- [ ] Real-time updates with < 100ms latency
- [ ] Workers processing tasks successfully
- [ ] 99.9% uptime for critical services
- [ ] Complete observability coverage
- [ ] Comprehensive test coverage (> 80%)
- [ ] Full documentation available
- [ ] Deployment takes < 10 minutes

## Next Steps After Phase 3

1. **Advanced Features**
   - Multi-swarm coordination
   - Template marketplace
   - AI-powered optimization

2. **Enterprise Features**
   - SSO/SAML support
   - Audit logging
   - Compliance tools

3. **Performance Optimization**
   - Edge deployment
   - Caching strategy
   - Database sharding