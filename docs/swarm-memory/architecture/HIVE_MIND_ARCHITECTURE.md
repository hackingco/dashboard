# Hive Mind Architecture Design Document

## Executive Summary

This document outlines the architecture for integrating Hive Mind functionality into the existing Swarm Orchestrator system. The system already has three core components (Dashboard, Manager, Worker) deployed on Fly.io with Redis/BullMQ for task management. The goal is to complete Supabase integration and add Claude Flow's Hive Mind capabilities for AI-powered swarm coordination.

## Current State Analysis

### Existing Components

1. **Dashboard (Frontend)**
   - Technology: Next.js 14, React 18, Tailwind CSS
   - State Management: React Query
   - Real-time: Partially configured for Supabase Realtime
   - Deployment: Fly.io (swarm-admin.fly.dev)
   - Status: Running with mock data, needs Supabase integration

2. **Manager Service (API)**
   - Technology: Express.js with TypeScript
   - Queue: BullMQ with Redis
   - Database: Supabase client configured but not fully integrated
   - Deployment: Fly.io (swarm-manager.fly.dev)
   - Features: Swarm creation, task orchestration, worker management
   - Status: Deployed and running, needs Supabase data persistence

3. **Worker Service**
   - Technology: Node.js with TypeScript
   - Communication: Redis pub/sub + BullMQ
   - Deployment: Dynamic Fly.io machines
   - Status: Basic structure exists, needs Hive Mind integration

4. **Infrastructure**
   - Redis: Deployed on Fly.io (swarm-redis-1752266040)
   - Supabase: Tables created, RLS policies defined, needs integration
   - Fly.io: All apps created and configured

### Missing Components

1. **Supabase Integration**
   - Manager service not persisting data to Supabase
   - Dashboard not reading from Supabase
   - Real-time subscriptions not implemented

2. **Hive Mind Functionality**
   - Claude Flow integration not connected
   - Neural pattern storage not implemented
   - Agent coordination not using Hive Mind
   - Memory persistence not leveraging .hive-mind database

## Proposed Architecture

### Component Integration Map

```
┌─────────────────────────────────────────────────────────────────┐
│                        Dashboard (Next.js)                        │
│  - Real-time Supabase subscriptions                             │
│  - Hive Mind status visualization                                │
│  - Neural pattern insights                                       │
└─────────────────────┬───────────────────────────────────────────┘
                      │ REST API + WebSocket
┌─────────────────────┴───────────────────────────────────────────┐
│                    Manager Service (Express)                      │
│  - Supabase data persistence                                     │
│  - Hive Mind coordination API                                    │
│  - Claude Flow MCP integration                                   │
│  - BullMQ task orchestration                                     │
└──────┬──────────────────────┬──────────────────────┬────────────┘
       │                      │                      │
       │ Supabase            │ Redis/BullMQ        │ Claude Flow
       │                      │                      │ MCP
┌──────┴────────┐    ┌───────┴────────┐    ┌───────┴────────────┐
│   Supabase    │    │     Redis      │    │   Hive Mind DB    │
│  PostgreSQL   │    │   Pub/Sub &    │    │  (.hive-mind/)    │
│               │    │    Queues      │    │  Neural Patterns  │
└───────────────┘    └────────────────┘    └───────────────────┘
                              │
                    ┌─────────┴──────────────┐
                    │   Worker Swarm         │
                    │  - Hive Mind agents    │
                    │  - Task execution      │
                    │  - Pattern learning    │
                    └────────────────────────┘
```

### Data Flow Architecture

1. **User Action Flow**
   ```
   User → Dashboard → Manager API → Supabase (persist) 
                                  → BullMQ (queue task)
                                  → Claude Flow (coordinate)
   ```

2. **Worker Execution Flow**
   ```
   BullMQ → Worker → Hive Mind (get strategy)
                   → Execute Task
                   → Update Supabase
                   → Learn Pattern → Hive Mind DB
   ```

3. **Real-time Update Flow**
   ```
   Supabase Changes → Realtime Subscription → Dashboard UI Update
   Worker Updates → Supabase → Broadcast → All Dashboards
   ```

## Implementation Plan

### Phase 1: Complete Supabase Integration (Priority: HIGH)

1. **Manager Service Updates**
   - Implement Supabase service layer for all CRUD operations
   - Replace in-memory storage with Supabase persistence
   - Add transaction support for complex operations
   - Implement proper error handling and retries

2. **Dashboard Integration**
   - Create Supabase provider with real-time subscriptions
   - Replace mock data with Supabase queries
   - Implement optimistic updates with React Query
   - Add connection status indicators

3. **Database Schema Updates**
   - Add hive_mind_patterns table for neural storage
   - Add agent_memories table for coordination data
   - Create indexes for performance optimization
   - Set up database triggers for audit trails

### Phase 2: Hive Mind Integration (Priority: HIGH)

1. **Claude Flow MCP Connection**
   - Integrate mcp__claude-flow__swarm_init in Manager
   - Implement agent spawning with Hive Mind coordination
   - Connect neural pattern training to worker execution
   - Store coordination data in .hive-mind database

2. **Worker Hive Mind Enhancement**
   - Add Claude Flow hooks to worker lifecycle
   - Implement pattern-based task execution
   - Enable cross-worker memory sharing
   - Add learning feedback loops

3. **Dashboard Hive Mind Visualization**
   - Create Hive Mind status component
   - Visualize neural patterns and effectiveness
   - Show agent coordination in real-time
   - Display learning progress metrics

### Phase 3: Advanced Features (Priority: MEDIUM)

1. **Autonomous Coordination**
   - Implement DAA (Decentralized Autonomous Agents)
   - Enable self-organizing swarm topologies
   - Add predictive task allocation
   - Implement fault-tolerant coordination

2. **Performance Optimization**
   - Add caching layer for frequent queries
   - Implement connection pooling
   - Optimize real-time subscription efficiency
   - Add performance monitoring

3. **Enhanced Observability**
   - Integrate Langfuse tracing throughout
   - Add TrustGraph DAG visualization
   - Implement comprehensive logging
   - Create performance dashboards

## Technical Specifications

### Supabase Integration Details

```typescript
// Manager Service - Supabase Service Layer
export class SupabaseSwarmService {
  async createSwarm(data: CreateSwarmDTO): Promise<Swarm> {
    const { data: swarm, error } = await supabase
      .from('swarms')
      .insert({
        name: data.name,
        purpose: data.purpose,
        config: data.config,
        status: 'initializing',
        fly_app_name: data.flyAppName
      })
      .select()
      .single();
    
    if (error) throw new SupabaseError(error);
    
    // Trigger Hive Mind initialization
    await this.hiveService.initializeSwarm(swarm.id);
    
    return swarm;
  }
  
  async subscribeToSwarmUpdates(swarmId: string) {
    return supabase
      .channel(`swarm:${swarmId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'swarms',
        filter: `id=eq.${swarmId}`
      }, (payload) => {
        this.broadcastUpdate(payload);
      })
      .subscribe();
  }
}
```

### Hive Mind Integration Details

```typescript
// Worker - Hive Mind Agent
export class HiveMindWorker {
  private claudeFlow: ClaudeFlowClient;
  private patterns: NeuralPatternStore;
  
  async executeTask(task: Task) {
    // Pre-task coordination
    await this.claudeFlow.hooks.preTask({
      description: task.type,
      context: await this.getSwarmContext()
    });
    
    // Get execution strategy from Hive Mind
    const strategy = await this.patterns.getOptimalStrategy(task);
    
    // Execute with pattern guidance
    const result = await this.executeWithStrategy(task, strategy);
    
    // Post-task learning
    await this.claudeFlow.hooks.postTask({
      taskId: task.id,
      result,
      performance: this.measurePerformance(result)
    });
    
    // Update neural patterns
    await this.patterns.updateFromExecution(task, result);
    
    return result;
  }
}
```

### Dashboard Real-time Integration

```typescript
// Dashboard - Supabase Provider
export function SwarmProvider({ children }) {
  const [swarms, setSwarms] = useState<Swarm[]>([]);
  
  useEffect(() => {
    // Initial load
    loadSwarms();
    
    // Real-time subscription
    const subscription = supabase
      .channel('swarms-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'swarms'
      }, handleSwarmChange)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'workers'
      }, handleWorkerChange)
      .subscribe();
    
    return () => {
      subscription.unsubscribe();
    };
  }, []);
  
  return (
    <SwarmContext.Provider value={{ swarms, ... }}>
      {children}
    </SwarmContext.Provider>
  );
}
```

## Security Considerations

1. **API Security**
   - Implement JWT authentication for Manager API
   - Use Supabase RLS for data access control
   - Encrypt sensitive Hive Mind patterns
   - Audit all coordination decisions

2. **Data Privacy**
   - Store only necessary data in Supabase
   - Implement data retention policies
   - Anonymize learning patterns
   - Secure worker-to-worker communication

3. **Infrastructure Security**
   - Use Fly.io secrets for sensitive config
   - Implement network isolation
   - Regular security audits
   - Monitoring for anomalous behavior

## Performance Requirements

1. **Response Times**
   - API responses: < 200ms (p95)
   - Dashboard updates: < 100ms (real-time)
   - Task allocation: < 50ms
   - Pattern retrieval: < 20ms

2. **Scalability**
   - Support 100+ concurrent swarms
   - Handle 10,000+ tasks/hour
   - Real-time updates for 1000+ clients
   - Hive Mind patterns: sub-second retrieval

3. **Reliability**
   - 99.9% uptime for Manager API
   - Zero data loss guarantee
   - Automatic failover for workers
   - Self-healing swarm coordination

## Success Metrics

1. **Technical Metrics**
   - Supabase integration completion: 100%
   - Hive Mind coordination accuracy: > 95%
   - Real-time update latency: < 100ms
   - Pattern learning improvement: > 20%

2. **Operational Metrics**
   - Deployment success rate: > 99%
   - Worker utilization: > 80%
   - Task completion rate: > 95%
   - Cost per task: < $0.001

3. **User Experience Metrics**
   - Dashboard responsiveness: < 100ms
   - Feature adoption rate: > 70%
   - User satisfaction: > 4.5/5
   - Time to first swarm: < 2 minutes

## Next Steps

1. **Immediate Actions**
   - Complete Supabase service layer in Manager
   - Implement real-time subscriptions in Dashboard
   - Test end-to-end data flow
   - Deploy initial Hive Mind integration

2. **Week 1 Goals**
   - Full Supabase CRUD operations
   - Basic Hive Mind coordination
   - Real-time dashboard updates
   - Worker pattern learning

3. **Month 1 Targets**
   - Complete DAA implementation
   - Advanced pattern recognition
   - Performance optimization
   - Production deployment

This architecture provides a solid foundation for building an AI-powered swarm orchestration system that leverages both traditional infrastructure (Supabase, Redis) and cutting-edge AI coordination (Claude Flow Hive Mind).