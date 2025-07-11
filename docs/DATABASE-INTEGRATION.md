# Claude-Flow Database Integration Layer

## Overview

The database integration layer provides a clean abstraction over Supabase, mapping swarm concepts to the existing database schema while enabling real-time synchronization and distributed persistence.

## Architecture

```typescript
// Database Client Architecture
class DatabaseClient {
  private supabase: SupabaseClient;
  private repositories: RepositoryRegistry;
  private cache: CacheManager;
  private realtime: RealtimeManager;
  
  constructor(config: DatabaseConfig) {
    this.supabase = createClient(config.url, config.key);
    this.repositories = new RepositoryRegistry(this.supabase);
    this.cache = new CacheManager();
    this.realtime = new RealtimeManager(this.supabase);
  }
  
  // Repository access
  get swarms() { return this.repositories.get(SwarmRepository); }
  get workers() { return this.repositories.get(WorkerRepository); }
  get tasks() { return this.repositories.get(TaskRepository); }
  get logs() { return this.repositories.get(LogRepository); }
  get metrics() { return this.repositories.get(MetricsRepository); }
  get templates() { return this.repositories.get(TemplateRepository); }
}
```

## Repository Pattern Implementation

### Base Repository

```typescript
abstract class BaseRepository<T> {
  protected table: string;
  protected supabase: SupabaseClient;
  protected cache: CacheManager;
  
  constructor(supabase: SupabaseClient, cache: CacheManager) {
    this.supabase = supabase;
    this.cache = cache;
  }
  
  async findById(id: string): Promise<T | null> {
    // Check cache first
    const cached = await this.cache.get(`${this.table}:${id}`);
    if (cached) return cached;
    
    // Query database
    const { data, error } = await this.supabase
      .from(this.table)
      .select('*')
      .eq('id', id)
      .single();
      
    if (error) throw new DatabaseError(error);
    
    // Cache result
    if (data) {
      await this.cache.set(`${this.table}:${id}`, data);
    }
    
    return data;
  }
  
  async create(entity: Partial<T>): Promise<T> {
    const { data, error } = await this.supabase
      .from(this.table)
      .insert(entity)
      .select()
      .single();
      
    if (error) throw new DatabaseError(error);
    
    // Invalidate relevant caches
    await this.cache.invalidatePattern(`${this.table}:*`);
    
    return data;
  }
  
  async update(id: string, updates: Partial<T>): Promise<T> {
    const { data, error } = await this.supabase
      .from(this.table)
      .update(updates)
      .eq('id', id)
      .select()
      .single();
      
    if (error) throw new DatabaseError(error);
    
    // Update cache
    await this.cache.set(`${this.table}:${id}`, data);
    
    return data;
  }
  
  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from(this.table)
      .delete()
      .eq('id', id);
      
    if (error) throw new DatabaseError(error);
    
    // Remove from cache
    await this.cache.delete(`${this.table}:${id}`);
  }
}
```

### Swarm Repository

```typescript
class SwarmRepository extends BaseRepository<Swarm> {
  table = 'swarms';
  
  async findActive(): Promise<Swarm[]> {
    const { data, error } = await this.supabase
      .from(this.table)
      .select('*')
      .in('status', ['initializing', 'active', 'scaling'])
      .order('created_at', { ascending: false });
      
    if (error) throw new DatabaseError(error);
    return data || [];
  }
  
  async updateMetrics(id: string, metrics: SwarmMetrics): Promise<void> {
    const { error } = await this.supabase
      .from(this.table)
      .update({ 
        metrics: metrics,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);
      
    if (error) throw new DatabaseError(error);
  }
  
  async getWithStats(id: string): Promise<SwarmWithStats> {
    // Use the swarm_stats view
    const { data, error } = await this.supabase
      .from('swarm_stats')
      .select('*')
      .eq('id', id)
      .single();
      
    if (error) throw new DatabaseError(error);
    return data;
  }
  
  async scale(id: string, targetSize: number): Promise<Swarm> {
    return await this.update(id, {
      worker_count: targetSize,
      status: 'scaling'
    });
  }
}
```

### Worker Repository

```typescript
class WorkerRepository extends BaseRepository<Worker> {
  table = 'workers';
  
  async findBySwarmId(swarmId: string): Promise<Worker[]> {
    const { data, error } = await this.supabase
      .from(this.table)
      .select('*')
      .eq('swarm_id', swarmId)
      .order('created_at');
      
    if (error) throw new DatabaseError(error);
    return data || [];
  }
  
  async findAvailable(swarmId: string): Promise<Worker[]> {
    const { data, error } = await this.supabase
      .from(this.table)
      .select('*')
      .eq('swarm_id', swarmId)
      .eq('status', 'idle')
      .order('last_heartbeat', { ascending: false });
      
    if (error) throw new DatabaseError(error);
    return data || [];
  }
  
  async updateHeartbeat(id: string): Promise<void> {
    const { error } = await this.supabase
      .from(this.table)
      .update({ 
        last_heartbeat: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id);
      
    if (error) throw new DatabaseError(error);
  }
  
  async assignTask(workerId: string, taskId: string): Promise<void> {
    const { error } = await this.supabase
      .from(this.table)
      .update({ 
        status: 'busy',
        updated_at: new Date().toISOString()
      })
      .eq('id', workerId);
      
    if (error) throw new DatabaseError(error);
  }
}
```

### Task Repository

```typescript
class TaskRepository extends BaseRepository<Task> {
  table = 'tasks';
  
  async findPending(swarmId: string): Promise<Task[]> {
    const { data, error } = await this.supabase
      .from(this.table)
      .select('*')
      .eq('swarm_id', swarmId)
      .eq('status', 'pending')
      .order('priority', { ascending: false })
      .order('created_at');
      
    if (error) throw new DatabaseError(error);
    return data || [];
  }
  
  async assignToWorker(taskId: string, workerId: string): Promise<Task> {
    return await this.update(taskId, {
      worker_id: workerId,
      status: 'in_progress',
      started_at: new Date().toISOString()
    });
  }
  
  async complete(taskId: string, output: any): Promise<Task> {
    return await this.update(taskId, {
      status: 'completed',
      output: output,
      completed_at: new Date().toISOString()
    });
  }
  
  async fail(taskId: string, error: string): Promise<Task> {
    const task = await this.findById(taskId);
    if (!task) throw new Error('Task not found');
    
    const shouldRetry = task.retry_count < task.max_retries;
    
    return await this.update(taskId, {
      status: shouldRetry ? 'pending' : 'failed',
      error: error,
      retry_count: task.retry_count + 1
    });
  }
  
  async getSwarmStats(swarmId: string): Promise<TaskStats> {
    const { data, error } = await this.supabase
      .rpc('get_task_stats', { swarm_id: swarmId });
      
    if (error) throw new DatabaseError(error);
    return data;
  }
  
  async getSuccessfulPatterns(pattern?: string): Promise<TaskPattern[]> {
    let query = this.supabase
      .from(this.table)
      .select('type, input, output, completed_at - started_at as duration')
      .eq('status', 'completed')
      .not('output', 'is', null);
      
    if (pattern) {
      query = query.ilike('type', `%${pattern}%`);
    }
    
    const { data, error } = await query.limit(100);
    
    if (error) throw new DatabaseError(error);
    return data || [];
  }
}
```

### Memory Repository (Using Logs Table)

```typescript
class MemoryRepository extends BaseRepository<LogEntry> {
  table = 'logs';
  
  async store(key: string, value: any, options?: MemoryOptions): Promise<void> {
    const entry: Partial<LogEntry> = {
      level: 'info',
      source: 'memory',
      message: `Memory store: ${key}`,
      metadata: {
        type: 'memory',
        namespace: options?.namespace || 'default',
        key: key,
        value: value,
        ttl: options?.ttl,
        agent_id: options?.agentId,
        session_id: options?.sessionId,
        expires_at: options?.ttl 
          ? new Date(Date.now() + options.ttl * 1000).toISOString()
          : null
      }
    };
    
    if (options?.swarmId) {
      entry.swarm_id = options.swarmId;
    }
    
    await this.create(entry);
  }
  
  async retrieve(key: string, namespace: string = 'default'): Promise<any> {
    const { data, error } = await this.supabase
      .from(this.table)
      .select('*')
      .eq('source', 'memory')
      .eq('metadata->>type', 'memory')
      .eq('metadata->>namespace', namespace)
      .eq('metadata->>key', key)
      .order('created_at', { ascending: false })
      .limit(1);
      
    if (error) throw new DatabaseError(error);
    if (!data || data.length === 0) return null;
    
    const entry = data[0];
    const metadata = entry.metadata as MemoryMetadata;
    
    // Check TTL
    if (metadata.expires_at && new Date(metadata.expires_at) < new Date()) {
      return null;
    }
    
    return metadata.value;
  }
  
  async search(pattern: string, namespace: string = 'default'): Promise<MemoryEntry[]> {
    const { data, error } = await this.supabase
      .from(this.table)
      .select('*')
      .eq('source', 'memory')
      .eq('metadata->>type', 'memory')
      .eq('metadata->>namespace', namespace)
      .ilike('metadata->>key', pattern)
      .order('created_at', { ascending: false });
      
    if (error) throw new DatabaseError(error);
    
    return (data || [])
      .map(entry => ({
        key: entry.metadata.key,
        value: entry.metadata.value,
        namespace: entry.metadata.namespace,
        created_at: entry.created_at
      }))
      .filter(entry => {
        // Filter out expired entries
        if (entry.metadata.expires_at) {
          return new Date(entry.metadata.expires_at) > new Date();
        }
        return true;
      });
  }
  
  async deleteMemory(key: string, namespace: string = 'default'): Promise<void> {
    const { error } = await this.supabase
      .from(this.table)
      .delete()
      .eq('source', 'memory')
      .eq('metadata->>type', 'memory')
      .eq('metadata->>namespace', namespace)
      .eq('metadata->>key', key);
      
    if (error) throw new DatabaseError(error);
  }
}
```

### Metrics Repository

```typescript
class MetricsRepository extends BaseRepository<Metric> {
  table = 'metrics';
  
  async record(metric: MetricInput): Promise<void> {
    await this.create({
      swarm_id: metric.swarmId,
      worker_id: metric.workerId,
      metric_name: metric.name,
      metric_value: metric.value,
      tags: metric.tags || {}
    });
  }
  
  async getTimeSeries(
    swarmId: string, 
    metricName: string, 
    timeRange: TimeRange
  ): Promise<TimeSeriesData> {
    const { data, error } = await this.supabase
      .from(this.table)
      .select('metric_value, created_at')
      .eq('swarm_id', swarmId)
      .eq('metric_name', metricName)
      .gte('created_at', timeRange.start)
      .lte('created_at', timeRange.end)
      .order('created_at');
      
    if (error) throw new DatabaseError(error);
    
    return {
      metric: metricName,
      points: (data || []).map(point => ({
        value: point.metric_value,
        timestamp: point.created_at
      }))
    };
  }
  
  async getAggregates(
    swarmId: string,
    metricName: string,
    aggregation: 'avg' | 'sum' | 'min' | 'max' | 'count'
  ): Promise<number> {
    const { data, error } = await this.supabase
      .rpc(`get_metric_${aggregation}`, {
        swarm_id: swarmId,
        metric_name: metricName
      });
      
    if (error) throw new DatabaseError(error);
    return data;
  }
  
  async getAgentMetrics(
    agentId?: string,
    metric?: string
  ): Promise<AgentMetric[]> {
    let query = this.supabase
      .from(this.table)
      .select(`
        *,
        workers!inner(name)
      `);
      
    if (agentId) {
      query = query.eq('worker_id', agentId);
    }
    
    if (metric && metric !== 'all') {
      query = query.eq('metric_name', metric);
    }
    
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(100);
      
    if (error) throw new DatabaseError(error);
    
    return (data || []).map(item => ({
      agent_name: item.workers.name,
      metric_name: item.metric_name,
      metric_value: item.metric_value,
      created_at: item.created_at
    }));
  }
}
```

## Real-time Subscriptions

```typescript
class RealtimeManager {
  private supabase: SupabaseClient;
  private subscriptions: Map<string, RealtimeChannel>;
  
  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.subscriptions = new Map();
  }
  
  subscribeToSwarm(swarmId: string, callbacks: SwarmCallbacks): void {
    const channel = this.supabase
      .channel(`swarm:${swarmId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'swarms',
          filter: `id=eq.${swarmId}`
        },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            callbacks.onUpdate?.(payload.new);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workers',
          filter: `swarm_id=eq.${swarmId}`
        },
        (payload) => {
          switch (payload.eventType) {
            case 'INSERT':
              callbacks.onAgentAdded?.(payload.new);
              break;
            case 'UPDATE':
              callbacks.onAgentUpdated?.(payload.new);
              break;
            case 'DELETE':
              callbacks.onAgentRemoved?.(payload.old);
              break;
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `swarm_id=eq.${swarmId}`
        },
        (payload) => {
          switch (payload.eventType) {
            case 'INSERT':
              callbacks.onTaskCreated?.(payload.new);
              break;
            case 'UPDATE':
              callbacks.onTaskUpdated?.(payload.new);
              break;
          }
        }
      )
      .subscribe();
      
    this.subscriptions.set(`swarm:${swarmId}`, channel);
  }
  
  unsubscribeFromSwarm(swarmId: string): void {
    const channel = this.subscriptions.get(`swarm:${swarmId}`);
    if (channel) {
      channel.unsubscribe();
      this.subscriptions.delete(`swarm:${swarmId}`);
    }
  }
}
```

## Cache Management

```typescript
class CacheManager {
  private cache: NodeCache;
  private hitRate: number = 0;
  private requests: number = 0;
  
  constructor(options: CacheOptions = {}) {
    this.cache = new NodeCache({
      stdTTL: options.ttl || 600, // 10 minutes default
      checkperiod: options.checkPeriod || 120,
      useClones: false // For performance
    });
  }
  
  async get<T>(key: string): Promise<T | null> {
    this.requests++;
    const value = this.cache.get<T>(key);
    
    if (value !== undefined) {
      this.hitRate = ((this.hitRate * (this.requests - 1)) + 1) / this.requests;
      return value;
    }
    
    this.hitRate = (this.hitRate * (this.requests - 1)) / this.requests;
    return null;
  }
  
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    this.cache.set(key, value, ttl);
  }
  
  async delete(key: string): Promise<void> {
    this.cache.del(key);
  }
  
  async invalidatePattern(pattern: string): Promise<void> {
    const regex = new RegExp(pattern.replace('*', '.*'));
    const keys = this.cache.keys();
    
    keys.forEach(key => {
      if (regex.test(key)) {
        this.cache.del(key);
      }
    });
  }
  
  getStats(): CacheStats {
    return {
      hitRate: this.hitRate,
      size: this.cache.keys().length,
      requests: this.requests
    };
  }
}
```

## Transaction Support

```typescript
class TransactionManager {
  async executeInTransaction<T>(
    operations: TransactionOperation[]
  ): Promise<T> {
    const results: any[] = [];
    
    try {
      // Supabase doesn't support traditional transactions
      // Use optimistic locking pattern instead
      for (const operation of operations) {
        const result = await operation.execute();
        results.push(result);
        operation.onSuccess?.(result);
      }
      
      return results as T;
    } catch (error) {
      // Rollback by executing compensation operations
      for (let i = results.length - 1; i >= 0; i--) {
        await operations[i].compensate?.(results[i]);
      }
      throw error;
    }
  }
}
```

## Migration Management

```typescript
class MigrationManager {
  private migrations: Migration[] = [
    {
      version: '002',
      name: 'add_coordination_columns',
      up: async (client) => {
        // Add coordination-specific columns
        await client.rpc('exec_sql', {
          sql: `
            ALTER TABLE workers 
            ADD COLUMN coordination_state JSONB DEFAULT '{}';
            
            ALTER TABLE tasks
            ADD COLUMN coordination_metadata JSONB DEFAULT '{}';
          `
        });
      },
      down: async (client) => {
        await client.rpc('exec_sql', {
          sql: `
            ALTER TABLE workers DROP COLUMN coordination_state;
            ALTER TABLE tasks DROP COLUMN coordination_metadata;
          `
        });
      }
    }
  ];
  
  async migrate(): Promise<void> {
    // Implementation of migration logic
  }
}
```

## Performance Considerations

1. **Connection Pooling**: Reuse Supabase client instance
2. **Batch Operations**: Use Supabase's batch insert/update
3. **Caching Strategy**: Cache frequently accessed data
4. **Index Usage**: Ensure queries use proper indexes
5. **Query Optimization**: Use views for complex queries
6. **Pagination**: Implement cursor-based pagination for large datasets