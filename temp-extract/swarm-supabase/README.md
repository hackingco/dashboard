# @swarm-orchestration/supabase

> Supabase client and database operations for the Swarm Orchestration Platform

## Overview

The `@swarm-orchestration/supabase` package provides a comprehensive Supabase client with pre-built operations for managing swarms, workers, tasks, logs, and metrics. It includes both client-side and service-role configurations with full TypeScript support.

## Features

- **Type-safe database operations** - Full TypeScript schema definitions
- **Client and service configurations** - Browser and server-side support
- **Real-time subscriptions** - Live updates for swarms, workers, and logs
- **Pre-built operations** - CRUD operations for all platform entities
- **Metrics and analytics** - Built-in performance tracking
- **Connection management** - Automatic client instantiation and caching

## Installation

```bash
npm install @swarm-orchestration/supabase
```

## Environment Variables

Configure your environment with the following variables:

```bash
# Required for client operations
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Alternative environment variable names
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# Required for service role operations
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Usage

### Basic Client Setup

```typescript
import { getSupabaseClient, getSupabaseServiceClient } from '@swarm-orchestration/supabase';

// Client-side operations (browser/frontend)
const client = getSupabaseClient();

// Service role operations (server-side)
const serviceClient = getSupabaseServiceClient();
```

### Swarm Operations

```typescript
import { swarmOperations } from '@swarm-orchestration/supabase';

// Create a new swarm
const swarm = await swarmOperations.create({
  name: 'Data Processing Swarm',
  purpose: 'Process large datasets in parallel',
  worker_count: 5,
  config: {
    maxWorkers: 10,
    timeout: 300000
  }
});

// List all swarms
const swarms = await swarmOperations.list();

// Get specific swarm
const swarm = await swarmOperations.get('swarm-id');

// Update swarm
const updatedSwarm = await swarmOperations.update('swarm-id', {
  status: 'running',
  worker_count: 8
});

// Delete swarm
await swarmOperations.delete('swarm-id');

// Subscribe to real-time changes
const subscription = swarmOperations.subscribe((payload) => {
  console.log('Swarm change:', payload);
});
```

### Worker Operations

```typescript
import { workerOperations } from '@swarm-orchestration/supabase';

// Create a worker
const worker = await workerOperations.create({
  swarm_id: 'swarm-123',
  name: 'Worker-1',
  type: 'processor',
  status: 'idle',
  machine_id: 'machine-456'
});

// List workers for a swarm
const workers = await workerOperations.listBySwarm('swarm-123');

// Update worker heartbeat
await workerOperations.updateHeartbeat('worker-id');

// Subscribe to worker changes for a swarm
const workerSub = workerOperations.subscribeToSwarm('swarm-123', (payload) => {
  console.log('Worker update:', payload);
});
```

### Task Operations

```typescript
import { taskOperations } from '@swarm-orchestration/supabase';

// Create a task
const task = await taskOperations.create({
  swarm_id: 'swarm-123',
  type: 'data-transform',
  input: { dataset: 'users', operation: 'aggregate' },
  priority: 1,
  max_retries: 3
});

// List tasks for a swarm
const tasks = await taskOperations.listBySwarm('swarm-123');

// List only pending tasks
const pendingTasks = await taskOperations.listBySwarm('swarm-123', 'pending');

// Assign task to worker
const assignedTask = await taskOperations.assignToWorker('task-id', 'worker-id');

// Complete a task
const completedTask = await taskOperations.complete('task-id', {
  result: 'processed',
  records: 1500
});

// Mark task as failed
const failedTask = await taskOperations.fail('task-id', 'Processing timeout');
```

### Logging Operations

```typescript
import { logOperations } from '@swarm-orchestration/supabase';

// Create log entry
await logOperations.create({
  swarm_id: 'swarm-123',
  worker_id: 'worker-456',
  level: 'info',
  message: 'Task processing started',
  metadata: { taskId: 'task-789' }
});

// Get logs for a swarm
const logs = await logOperations.listBySwarm('swarm-123', 50);

// Subscribe to real-time logs
const logSub = logOperations.subscribeToSwarm('swarm-123', (payload) => {
  console.log('New log:', payload.new);
});
```

### Metrics Operations

```typescript
import { metricsOperations } from '@swarm-orchestration/supabase';

// Record a metric
await metricsOperations.record({
  swarm_id: 'swarm-123',
  worker_id: 'worker-456',
  metric_name: 'cpu_usage',
  metric_value: 75.5,
  tags: { region: 'us-east-1' }
});

// Query metrics
const cpuMetrics = await metricsOperations.query(
  'swarm-123',
  'cpu_usage',
  new Date(Date.now() - 3600000) // Last hour
);
```

### Statistics and Analytics

```typescript
import { statsOperations } from '@swarm-orchestration/supabase';

// Get stats for all swarms
const allStats = await statsOperations.getSwarmStats();

// Get stats for specific swarm
const swarmStats = await statsOperations.getSwarmStats('swarm-123');

// Get recent activity
const recentActivity = await statsOperations.getRecentActivity(20);
```

## Real-time Subscriptions

The package provides comprehensive real-time capabilities:

### Swarm Changes
```typescript
import { swarmOperations } from '@swarm-orchestration/supabase';

const subscription = swarmOperations.subscribe((payload) => {
  console.log('Change type:', payload.eventType); // INSERT, UPDATE, DELETE
  console.log('New data:', payload.new);
  console.log('Old data:', payload.old);
});

// Unsubscribe when done
subscription.unsubscribe();
```

### Worker Monitoring
```typescript
import { workerOperations } from '@swarm-orchestration/supabase';

const workerSub = workerOperations.subscribeToSwarm('swarm-123', (payload) => {
  switch (payload.eventType) {
    case 'INSERT':
      console.log('New worker:', payload.new);
      break;
    case 'UPDATE':
      console.log('Worker updated:', payload.new);
      break;
    case 'DELETE':
      console.log('Worker removed:', payload.old);
      break;
  }
});
```

### Log Streaming
```typescript
import { logOperations } from '@swarm-orchestration/supabase';

const logSub = logOperations.subscribeToSwarm('swarm-123', (payload) => {
  const log = payload.new;
  console.log(`[${log.level.toUpperCase()}] ${log.message}`);
  
  if (log.level === 'error') {
    // Handle error logs specially
    handleError(log);
  }
});
```

## Database Schema

The package includes comprehensive TypeScript definitions for the database schema:

```typescript
import type { Database } from '@swarm-orchestration/supabase';

// Access table types
type Swarm = Database['public']['Tables']['swarms']['Row'];
type Worker = Database['public']['Tables']['workers']['Row'];
type Task = Database['public']['Tables']['tasks']['Row'];

// Access insert types
type SwarmInsert = Database['public']['Tables']['swarms']['Insert'];
type WorkerInsert = Database['public']['Tables']['workers']['Insert'];

// Access update types
type SwarmUpdate = Database['public']['Tables']['swarms']['Update'];
```

## Advanced Usage

### Custom Queries

```typescript
import { getSupabaseClient } from '@swarm-orchestration/supabase';

const client = getSupabaseClient();

// Custom query with filters
const { data, error } = await client
  .from('tasks')
  .select(`
    *,
    swarms (name),
    workers (name, status)
  `)
  .eq('status', 'completed')
  .gte('created_at', '2024-01-01')
  .order('completed_at', { ascending: false });
```

### Batch Operations

```typescript
import { getSupabaseClient } from '@swarm-orchestration/supabase';

const client = getSupabaseClient();

// Batch insert tasks
const tasks = [
  { swarm_id: 'swarm-123', type: 'process', input: { id: 1 } },
  { swarm_id: 'swarm-123', type: 'process', input: { id: 2 } },
  { swarm_id: 'swarm-123', type: 'process', input: { id: 3 } }
];

const { data, error } = await client
  .from('tasks')
  .insert(tasks)
  .select();
```

### Row Level Security

The package works with Supabase's Row Level Security (RLS):

```sql
-- Example RLS policy
CREATE POLICY "Users can view their own swarms"
ON swarms FOR SELECT
USING (auth.uid()::text = created_by);
```

## Error Handling

All operations throw errors that can be caught and handled:

```typescript
import { swarmOperations } from '@swarm-orchestration/supabase';

try {
  const swarm = await swarmOperations.create({
    name: 'Test Swarm',
    purpose: 'Testing'
  });
} catch (error) {
  console.error('Failed to create swarm:', error.message);
  
  if (error.code === '23505') {
    console.error('Swarm name already exists');
  }
}
```

## Performance Considerations

- **Connection pooling** - Clients are cached and reused
- **Real-time efficiency** - Subscriptions use minimal bandwidth
- **Query optimization** - Pre-built queries are optimized
- **Batch operations** - Use batch inserts/updates when possible

## License

MIT