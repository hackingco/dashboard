# Swarm Relationship Schema - Supabase Implementation

## 📋 Overview

This directory contains a comprehensive Supabase implementation for the Swarm Intelligence Dashboard, featuring advanced relationship schema, real-time coordination, and observability infrastructure.

## 🗂️ Directory Structure

```
supabase/
├── migrations/          # Database schema migrations
├── policies/           # Row Level Security (RLS) policies
├── types/             # TypeScript type definitions
├── functions/         # Advanced database functions
├── utils/            # Utility functions and operations
└── README.md         # This documentation
```

## 🚀 Quick Start

### Prerequisites

- Supabase project with PostgreSQL database
- Node.js and TypeScript environment
- Proper environment variables configured

### Environment Variables

```bash
# Required Supabase configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Optional configuration
SUPABASE_JWT_SECRET=your_jwt_secret
```

### Installation Steps

1. **Run Schema Migration**
   ```sql
   -- Execute in Supabase SQL Editor
   \i migrations/20250714_001_swarm_relationship_schema.sql
   ```

2. **Apply RLS Policies**
   ```sql
   -- Execute in Supabase SQL Editor
   \i policies/20250714_002_swarm_rls_policies.sql
   ```

3. **Install Database Functions**
   ```sql
   -- Execute in Supabase SQL Editor
   \i functions/20250714_005_swarm_functions.sql
   ```

4. **Import Types and Utils**
   ```typescript
   import { SwarmOperations } from './supabase/utils/swarm-operations';
   import { SwarmNetwork, SwarmAgent } from './supabase/types/swarm-relationship-types';
   ```

## 📊 Schema Overview

### Core Tables

#### 🕸️ Swarm Networks (`swarm_networks`)
Central coordination hub for swarm intelligence networks.

**Key Features:**
- Topology management (mesh, hierarchical, ring, star)
- Strategy configuration (balanced, specialized, adaptive)
- Real-time scaling and status tracking
- Organization-level multi-tenancy

#### 🤖 Swarm Agents (`swarm_agents`)
Individual intelligent agents within swarm networks.

**Key Features:**
- Multiple agent types (coordinator, researcher, coder, analyst, etc.)
- Performance metrics and efficiency scoring
- Capability-based task assignment
- Real-time health monitoring

#### 🔗 Agent Relationships (`agent_relationships`)
Coordination relationships between agents.

**Key Features:**
- Multiple relationship types (coordination, supervision, collaboration, etc.)
- Dynamic strength and communication protocols
- Conflict detection and resolution
- Trust scoring and reliability metrics

#### 📋 Task Orchestration (`task_orchestration`)
Task management and orchestration across swarm networks.

**Key Features:**
- Multiple execution strategies (parallel, sequential, adaptive)
- Dependency management and critical path analysis
- Progress tracking and performance optimization
- Automatic retry and error handling

#### 🧠 Neural Patterns (`neural_patterns`)
Learning patterns and adaptation algorithms.

**Key Features:**
- Pattern type classification and effectiveness scoring
- Training data management and model versioning
- Cross-network pattern sharing and adaptation
- Performance-based pattern evolution

#### 💾 Swarm Memory (`swarm_memory`)
Persistent memory bank for swarm coordination.

**Key Features:**
- Namespace-based memory organization
- TTL and priority-based memory management
- Encrypted memory support for sensitive data
- Tag-based memory search and retrieval

### Observability Tables

#### 📡 Coordination Events (`coordination_events`)
Real-time coordination and communication events.

#### 📈 Performance Metrics (`performance_metrics`)
Performance metrics aggregation for monitoring.

#### 🏥 Health Checks (`health_checks`)
Health monitoring and system diagnostics.

## 🔐 Security Implementation

### Row Level Security (RLS)

All tables implement comprehensive RLS policies with:

- **User-based access control**: Users can only access their own networks and organizations
- **Service role bypass**: Service role has full access for API operations
- **Demo access**: Anonymous users can access demo data
- **Organization multi-tenancy**: Proper isolation between organizations

### Security Functions

- `is_network_owner()`: Check network ownership
- `can_access_agent()`: Validate agent access permissions
- `can_access_memory()`: Validate memory access permissions

## 📡 Real-time Features

### Supabase Realtime

All critical tables are configured for real-time subscriptions:

```typescript
// Example: Subscribe to network events
const subscription = swarmOps.subscribeToNetworkEvents(networkId, {
  onAgentChange: (payload) => {
    console.log('Agent updated:', payload);
  },
  onTaskChange: (payload) => {
    console.log('Task updated:', payload);
  },
  onEventLog: (payload) => {
    console.log('New event:', payload);
  }
});
```

### Performance Optimizations

- **Efficient indexing**: Comprehensive indexes for all query patterns
- **Automatic cleanup**: TTL-based cleanup for temporary data
- **Batch operations**: Optimized for high-throughput scenarios
- **Connection pooling**: Supabase connection pooling enabled

## 🛠️ Utility Functions

### SwarmOperations Class

The `SwarmOperations` class provides a comprehensive API for swarm management:

```typescript
const swarmOps = new SwarmOperations({
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  enableRealtime: true
});

// Create a new swarm network
const network = await swarmOps.createNetwork({
  name: 'Development Swarm',
  topology: 'mesh',
  strategy: 'adaptive',
  max_agents: 8
});

// Spawn agents
const agent = await swarmOps.spawnAgent({
  network_id: network.id,
  name: 'Lead Coordinator',
  type: 'coordinator',
  capabilities: ['coordination', 'task_management']
});

// Orchestrate tasks
const task = await swarmOps.orchestrateTask({
  network_id: network.id,
  task_name: 'Build Authentication System',
  strategy: 'parallel',
  priority: 'high',
  assigned_agents: [agent.id]
});
```

### Key Operations

- **Network Management**: Create, configure, and monitor swarm networks
- **Agent Lifecycle**: Spawn, manage, and monitor intelligent agents
- **Task Orchestration**: Create, assign, and track task execution
- **Memory Operations**: Store, retrieve, and manage swarm memory
- **Performance Monitoring**: Record and analyze performance metrics
- **Health Monitoring**: Track system health and diagnose issues

## 📊 Database Functions

### Analytics Functions

- `get_network_stats()`: Comprehensive network statistics
- `generate_performance_report()`: Detailed performance reporting
- `calculate_agent_efficiency()`: Agent efficiency scoring

### Optimization Functions

- `auto_scale_network()`: Automatic scaling recommendations
- `find_optimal_agent_for_task()`: Optimal agent selection
- `optimize_task_assignment()`: Task assignment optimization
- `optimize_memory_usage()`: Memory usage optimization

### Maintenance Functions

- `cleanup_expired_memory()`: Clean up expired memory entries
- `archive_old_events()`: Archive old coordination events
- `maintain_swarm_tables()`: Table maintenance recommendations

## 🎯 Performance Considerations

### Indexing Strategy

All tables include comprehensive indexes optimized for:

- **Real-time queries**: Fast lookups for dashboard updates
- **Analytics queries**: Efficient aggregations for reporting
- **Relationship queries**: Optimized joins between related tables
- **Time-series queries**: Efficient time-based filtering

### Query Optimization

- **Prepared statements**: Reduced parsing overhead
- **Connection pooling**: Efficient connection management
- **Batch operations**: Reduced round-trip latency
- **Materialized views**: Pre-computed analytics

### Scalability Features

- **Horizontal partitioning**: Ready for table partitioning
- **Archive strategies**: Automated data lifecycle management
- **Cache-friendly design**: Optimized for Redis/Memcached
- **CDN compatibility**: Static data optimized for CDN

## 🧪 Testing Strategy

### Unit Tests

```typescript
// Example: Test agent spawning
describe('SwarmOperations', () => {
  it('should spawn agent with correct configuration', async () => {
    const agent = await swarmOps.spawnAgent({
      network_id: testNetworkId,
      name: 'Test Agent',
      type: 'researcher',
      capabilities: ['research', 'analysis']
    });
    
    expect(agent.name).toBe('Test Agent');
    expect(agent.type).toBe('researcher');
    expect(agent.status).toBe('spawning');
  });
});
```

### Integration Tests

```typescript
// Example: Test real-time coordination
describe('Real-time Coordination', () => {
  it('should broadcast agent status changes', async () => {
    const events: any[] = [];
    
    const subscription = swarmOps.subscribeToNetworkEvents(networkId, {
      onAgentChange: (payload) => events.push(payload)
    });
    
    await swarmOps.updateAgent(agentId, { status: 'busy' });
    
    expect(events).toHaveLength(1);
    expect(events[0].new.status).toBe('busy');
  });
});
```

### Performance Tests

```typescript
// Example: Test batch operations
describe('Performance', () => {
  it('should handle high-throughput agent spawning', async () => {
    const startTime = Date.now();
    
    const promises = Array.from({ length: 100 }, (_, i) => 
      swarmOps.spawnAgent({
        network_id: testNetworkId,
        name: `Agent ${i}`,
        type: 'worker',
        capabilities: ['general']
      })
    );
    
    await Promise.all(promises);
    
    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(5000); // 5 seconds
  });
});
```

## 📈 Monitoring and Observability

### Key Metrics

- **Agent Performance**: Efficiency scores, response times, success rates
- **Network Health**: Overall health scores, coordination quality
- **Task Execution**: Completion rates, duration analysis, bottlenecks
- **System Resources**: Memory usage, CPU utilization, throughput

### Alerting

Configure alerts for:

- **Critical health issues**: Agent failures, network errors
- **Performance degradation**: High response times, low efficiency
- **Resource exhaustion**: Memory limits, connection limits
- **Security events**: Unauthorized access, policy violations

### Dashboard Integration

The schema supports rich dashboard visualizations:

- **Real-time network topology**: Live agent relationships
- **Performance trends**: Historical metrics and predictions
- **Task execution timelines**: Gantt charts and critical paths
- **Health monitoring**: System status and issue tracking

## 🔄 Migration Strategy

### Version Control

All migrations are versioned with timestamps:

- `20250714_001_swarm_relationship_schema.sql`: Core schema
- `20250714_002_swarm_rls_policies.sql`: Security policies
- `20250714_005_swarm_functions.sql`: Database functions

### Rollback Strategy

Each migration includes rollback scripts:

```sql
-- Rollback script example
DROP TABLE IF EXISTS public.swarm_networks CASCADE;
DROP TABLE IF EXISTS public.swarm_agents CASCADE;
-- ... additional cleanup
```

### Zero-Downtime Deployment

- **Blue-green deployments**: Seamless version transitions
- **Feature flags**: Gradual feature rollout
- **Backward compatibility**: Maintain API compatibility

## 🤝 Contributing

### Development Workflow

1. **Create feature branch**: `git checkout -b feature/new-schema-feature`
2. **Make changes**: Update schema, types, and functions
3. **Test thoroughly**: Run all test suites
4. **Update documentation**: Keep README current
5. **Submit PR**: Include migration scripts and rollback plans

### Code Standards

- **TypeScript strict mode**: Full type safety
- **ESLint configuration**: Consistent code style
- **Prettier formatting**: Automated code formatting
- **JSDoc comments**: Comprehensive API documentation

## 📚 Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Performance Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [Real-time Subscriptions Guide](https://supabase.com/docs/guides/realtime)
- [Row Level Security Best Practices](https://supabase.com/docs/guides/auth/row-level-security)

## 🆘 Troubleshooting

### Common Issues

1. **Migration Failures**
   ```bash
   # Check for missing dependencies
   SELECT * FROM pg_extension WHERE extname IN ('uuid-ossp', 'pgcrypto');
   
   # Verify permissions
   SELECT grantee, privilege_type FROM information_schema.role_table_grants 
   WHERE table_name = 'swarm_networks';
   ```

2. **RLS Policy Issues**
   ```sql
   -- Debug RLS policies
   SET ROLE authenticated;
   SELECT * FROM public.swarm_networks; -- Should respect RLS
   
   -- Check policy definitions
   SELECT * FROM pg_policies WHERE tablename = 'swarm_networks';
   ```

3. **Performance Issues**
   ```sql
   -- Check index usage
   EXPLAIN ANALYZE SELECT * FROM swarm_agents WHERE network_id = 'uuid';
   
   -- Monitor query performance
   SELECT query, mean_time, calls FROM pg_stat_statements 
   WHERE query LIKE '%swarm_%' ORDER BY mean_time DESC;
   ```

### Support

For additional support:

- **GitHub Issues**: Report bugs and feature requests
- **Community Discord**: Real-time community support
- **Documentation**: Comprehensive guides and examples
- **Professional Support**: Enterprise support options

---

**Created by**: Schema Developer Agent  
**Version**: 20250714  
**Last Updated**: July 14, 2025  
**License**: MIT