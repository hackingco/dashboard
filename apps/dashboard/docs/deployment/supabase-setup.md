# Supabase Backend Setup Guide

This guide explains how to set up the Supabase backend for the Swarm Dashboard with real-time capabilities.

## Quick Setup

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your project URL and API keys
3. Copy the connection details

### 2. Environment Configuration

Copy the environment template:
```bash
cp .env.example .env.local
```

Update `.env.local` with your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 3. Database Schema Setup

Run the SQL scripts in your Supabase SQL editor:

1. **Main Schema**: Copy and run `/supabase-schema.sql`
2. **RLS Policies**: Copy and run `/lib/supabase-rls-policies.sql`

### 4. Test Connection

1. Start the dashboard: `npm run dev`
2. Open `http://localhost:3004`
3. Navigate to the Supabase traces component
4. Click "Demo Trace" to test real-time functionality

## Backend Architecture

### Database Schema

#### Tables

1. **swarm_sessions**: Main session tracking
   - Stores session metadata, status, and performance metrics
   - Linked to traces and metrics via foreign keys

2. **swarm_traces**: Individual operation traces
   - Stores execution details, input/output data
   - Real-time updates for live monitoring

3. **swarm_agents**: Agent status and performance
   - Tracks agent health, tasks, and resource usage
   - Live status updates with WebSocket sync

4. **swarm_metrics**: Time-series performance data
   - Historical metrics for dashboard analytics
   - Aggregated data for charts and insights

#### Indexes

- Performance indexes on session_id, timestamp, status
- GIN indexes for JSON metadata queries
- Real-time optimized indexes for subscriptions

### API Endpoints

#### `/api/traces`
- **GET**: Fetch traces with filtering and pagination
- **POST**: Create new trace records
- **PUT**: Update existing traces
- **DELETE**: Remove traces (soft delete recommended)

#### `/api/agents`
- **GET**: Get agent status and metrics
- **POST**: Register new agents
- **PUT**: Update agent status/performance
- **DELETE**: Deactivate agents

#### `/api/sessions`
- **GET**: List sessions with optional stats
- **POST**: Create new sessions
- **PUT**: Update session status/metadata
- **DELETE**: Complete sessions

#### `/api/metrics`
- **GET**: Time-series metrics with aggregation
- **POST**: Record single metric
- **PUT**: Batch insert metrics

#### `/api/realtime`
- **GET**: WebSocket connection info
- **POST**: Subscription management
- **PUT**: Real-time event processing
- **DELETE**: Cleanup subscriptions

### Real-time Features

#### Supabase Realtime

Uses Supabase's built-in real-time subscriptions:

```typescript
// Traces subscription
const channel = supabase
  .channel(`traces-${sessionId}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'swarm_traces',
    filter: `session_id=eq.${sessionId}`
  }, (payload) => {
    // Handle real-time updates
  })
  .subscribe()
```

#### Event Broadcasting

Custom events for coordination:

```typescript
// Broadcast updates
await supabase
  .channel('swarm-updates')
  .send({
    type: 'broadcast',
    event: 'agent_status_change',
    payload: { agentId, status }
  })
```

### Security (RLS Policies)

#### Authentication Levels

1. **Anonymous**: Read-only demo access
2. **Authenticated**: Full CRUD for owned resources
3. **Service Role**: Full admin access for API routes

#### Row Level Security

- Session ownership based on metadata.user_id
- Trace access controlled by session ownership
- Agent management by metadata.manager_id
- Demo mode for public access

#### Example Policy

```sql
CREATE POLICY "Enable read for session owners" ON public.swarm_traces
  FOR SELECT USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM public.swarm_sessions s 
      WHERE s.id = session_id AND 
      s.metadata->>'user_id' = auth.uid()::text
    )
  );
```

## Frontend Integration

### React Hook Usage

```typescript
import { useRealtimeSwarm } from '@/lib/hooks/use-realtime-swarm'

function MyComponent() {
  const {
    traces,
    agents,
    aggregatedMetrics,
    isConnected,
    addTrace,
    updateAgentStatus
  } = useRealtimeSwarm({
    sessionId: 'your-session-id',
    enableTraces: true,
    enableAgents: true,
    autoRefresh: true
  })

  return (
    <div>
      <p>Connected: {isConnected ? '✅' : '❌'}</p>
      <p>Traces: {traces.length}</p>
      <p>Active Agents: {aggregatedMetrics?.activeAgents}</p>
    </div>
  )
}
```

### Component Integration

```typescript
import { SupabaseTraces } from '@/components/observability/SupabaseTraces'

function Dashboard() {
  return (
    <SupabaseTraces 
      sessionId="your-session-id"
      swarmId="your-swarm-id"
      autoRefresh={true}
      refreshInterval={3000}
    />
  )
}
```

## Performance Optimizations

### Database

1. **Indexes**: Optimized for common queries
2. **Partitioning**: Consider for large metrics tables
3. **Archiving**: Move old data to separate tables
4. **Connection Pooling**: Use Supabase's built-in pooling

### Real-time

1. **Channel Management**: Unsubscribe when not needed
2. **Filtering**: Use RLS and filters to limit data
3. **Batching**: Group related updates
4. **Throttling**: Limit update frequency

### Frontend

1. **Virtualization**: For large trace lists
2. **Pagination**: Limit initial data load
3. **Debouncing**: For search and filters
4. **Memoization**: Cache computed values

## Monitoring & Debugging

### Health Checks

```typescript
// Test database connection
const { data, error } = await supabase
  .from('swarm_sessions')
  .select('count')
  .single()

// Test real-time connection
const channel = supabase.channel('test')
const status = channel.state // Should be 'joined'
```

### Common Issues

1. **RLS Blocking Queries**: Check user permissions
2. **Real-time Not Working**: Verify table publications
3. **Performance Issues**: Check indexes and query plans
4. **Connection Errors**: Verify environment variables

### Debug Mode

Enable debug logging:

```env
NEXT_PUBLIC_DEBUG_MODE=true
```

Check browser console and network tabs for detailed logs.

## Scaling Considerations

### Database Scaling

1. **Read Replicas**: For high-read workloads
2. **Sharding**: Partition by session_id or date
3. **Caching**: Redis for frequently accessed data
4. **Background Jobs**: For heavy processing

### Real-time Scaling

1. **Channel Limits**: Supabase has per-project limits
2. **Message Rate**: Consider throttling updates
3. **Connection Management**: Pool WebSocket connections
4. **Fallback Polling**: If real-time fails

## Security Best Practices

### Data Protection

1. **Encryption**: Enable at rest and in transit
2. **Access Control**: Strict RLS policies
3. **API Keys**: Rotate regularly
4. **Input Validation**: Sanitize all inputs

### Monitoring

1. **Audit Logs**: Track data access
2. **Rate Limiting**: Prevent abuse
3. **Error Tracking**: Monitor for attacks
4. **Backup Strategy**: Regular automated backups

## Deployment

### Production Setup

1. **Environment Variables**: Secure key management
2. **Database Migrations**: Version controlled schema
3. **Monitoring**: Set up alerts and dashboards
4. **Backup/Recovery**: Automated and tested

### CI/CD Integration

```yaml
# Example GitHub Actions workflow
- name: Run Supabase Migrations
  run: |
    npx supabase db push
    npx supabase db seed
```

For detailed deployment instructions, see the main project README.