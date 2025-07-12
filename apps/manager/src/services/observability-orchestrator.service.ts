import { EventEmitter } from 'events';
import logger from './logger';
import { langfuseService, LangfuseService } from './langfuse/langfuse.service';
import { trustGraphService, TrustGraphService } from './trustgraph/trustgraph.service';
import { supabaseRealtimeService, SupabaseRealtimeService } from './supabase-realtime.service';
import { flyObservabilityService, FlyObservabilityService } from './fly-observability.service';
import { v4 as uuidv4 } from 'uuid';

export interface ObservabilitySession {
  session_id: string;
  swarm_id: string;
  correlation_id: string;
  operation_type: string;
  started_at: Date;
  completed_at?: Date;
  status: 'active' | 'completed' | 'failed';
  langfuse_trace_id: string;
  trustgraph_nodes: string[];
  machine_states: string[];
  fly_operations: string[];
  metrics: {
    total_duration_ms?: number;
    api_calls_count: number;
    tokens_consumed: number;
    cost_total: number;
    broadcasts_sent: number;
    state_changes: number;
  };
}

export interface ObservabilityMetrics {
  session_count: number;
  active_sessions: number;
  total_api_calls: number;
  total_tokens: number;
  total_cost: number;
  average_session_duration: number;
  success_rate: number;
  top_operations: Array<{ operation: string; count: number; avg_duration: number }>;
  realtime_connections: number;
  trustgraph_nodes: number;
  langfuse_traces: number;
}

export interface StateChangeEvent {
  type: 'machine_state' | 'task_status' | 'swarm_health' | 'api_call' | 'broadcast';
  source: string;
  swarm_id: string;
  correlation_id: string;
  data: Record<string, any>;
  timestamp: Date;
}

/**
 * Orchestrates all observability services for comprehensive swarm monitoring
 * Coordinates Langfuse tracing, TrustGraph DAG tracking, Supabase real-time events,
 * and Fly.io API monitoring with full correlation tracking
 */
export class ObservabilityOrchestrator extends EventEmitter {
  private langfuse: LangfuseService;
  private trustGraph: TrustGraphService;
  private supabaseRealtime: SupabaseRealtimeService;
  private flyObservability: FlyObservabilityService;
  
  private activeSessions: Map<string, ObservabilitySession> = new Map();
  private realtimeSubscriptions: Map<string, string> = new Map();
  private metricsHistory: ObservabilityMetrics[] = [];
  private maxHistoryRetention: number = 100;
  
  private orchestratorInitialized: boolean = false;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private metricsInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    
    this.langfuse = langfuseService;
    this.trustGraph = trustGraphService;
    this.supabaseRealtime = supabaseRealtimeService;
    this.flyObservability = flyObservabilityService;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Observability orchestrator already initialized');
      return;
    }

    try {
      logger.info('Initializing observability orchestrator...');

      // Set up cross-service event handlers
      this.setupEventHandlers();
      
      // Start health monitoring
      this.startHealthCheck();
      
      // Start metrics collection
      this.startMetricsCollection();
      
      this.orchestratorInitialized = true;
      logger.info('Observability orchestrator initialized successfully');
      this.emit('initialized');
      
    } catch (error) {
      logger.error('Failed to initialize observability orchestrator', { error });
      throw error;
    }
  }

  private setupEventHandlers(): void {
    // Langfuse events
    this.langfuse.on('trace:ended', (data) => {
      this.handleLangfuseTraceEnded(data);
    });

    this.langfuse.on('generation:tracked', (data) => {
      this.handleLangfuseGeneration(data);
    });

    // TrustGraph events
    this.trustGraph.on('node:created', (node) => {
      this.handleTrustGraphNodeCreated(node);
    });

    this.trustGraph.on('ws_broadcast:emitted', (wsNode) => {
      this.handleTrustGraphWSBroadcast(wsNode);
    });

    // Supabase Realtime events
    this.supabaseRealtime.on('machine_state_change', (delta) => {
      this.handleMachineStateChange(delta);
    });

    this.supabaseRealtime.on('connected', () => {
      logger.info('Supabase Realtime connected - observability active');
    });

    this.supabaseRealtime.on('error', (error) => {
      logger.error('Supabase Realtime error in observability orchestrator', { error });
    });

    logger.debug('Observability event handlers configured');
  }

  // Session Management
  async startObservabilitySession(
    swarmId: string,
    operationType: string,
    metadata?: Record<string, any>
  ): Promise<ObservabilitySession> {
    const sessionId = uuidv4();
    const correlationId = uuidv4();
    
    // Start Langfuse trace
    const langfuseTraceId = this.langfuse.startTrace(`swarm_${operationType}`, {
      swarm_id: swarmId,
      operation_type: operationType,
      session_id: sessionId,
      correlation_id: correlationId,
      ...metadata
    });

    // Create TrustGraph node for session start
    await this.trustGraph.createNode({
      id: `session_${sessionId}`,
      type: 'swarm',
      label: `Swarm Session: ${operationType}`,
      metadata: {
        swarm_id: swarmId,
        session_id: sessionId,
        correlation_id: correlationId,
        operation_type: operationType,
        ...metadata
      }
    });

    // Create session record
    const session: ObservabilitySession = {
      session_id: sessionId,
      swarm_id: swarmId,
      correlation_id: correlationId,
      operation_type: operationType,
      started_at: new Date(),
      status: 'active',
      langfuse_trace_id: langfuseTraceId,
      trustgraph_nodes: [`session_${sessionId}`],
      machine_states: [],
      fly_operations: [],
      metrics: {
        api_calls_count: 0,
        tokens_consumed: 0,
        cost_total: 0,
        broadcasts_sent: 0,
        state_changes: 0
      }
    };

    this.activeSessions.set(sessionId, session);

    // Set up real-time subscription for this swarm if not already active
    if (!this.realtimeSubscriptions.has(swarmId)) {
      const channelName = await this.supabaseRealtime.subscribeToMachineStates(
        swarmId,
        (delta) => this.handleRealtimeDelta(swarmId, delta)
      );
      this.realtimeSubscriptions.set(swarmId, channelName);
    }

    // Store observability correlation in database
    await this.createObservabilityCorrelation(session);

    logger.info('Started observability session', {
      sessionId,
      swarmId,
      operationType,
      correlationId
    });

    this.emit('session:started', session);
    return session;
  }

  async endObservabilitySession(
    sessionId: string,
    status: 'completed' | 'failed' = 'completed',
    error?: Error
  ): Promise<ObservabilitySession | null> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      logger.warn('Attempted to end non-existent observability session', { sessionId });
      return null;
    }

    session.completed_at = new Date();
    session.status = status;
    session.metrics.total_duration_ms = session.completed_at.getTime() - session.started_at.getTime();

    // End Langfuse trace
    await this.langfuse.endTrace(session.langfuse_trace_id, {
      session_id: sessionId,
      status,
      total_duration_ms: session.metrics.total_duration_ms,
      metrics: session.metrics,
      error: error?.message
    });

    // Create completion TrustGraph node
    await this.trustGraph.createNode({
      id: `session_complete_${sessionId}`,
      type: 'swarm',
      label: `Session Complete: ${session.operation_type}`,
      metadata: {
        session_id: sessionId,
        status,
        duration_ms: session.metrics.total_duration_ms,
        correlation_id: session.correlation_id
      }
    });

    // Create edge from session start to completion
    await this.trustGraph.createEdge({
      source: `session_${sessionId}`,
      target: `session_complete_${sessionId}`,
      label: 'completes',
      type: 'executes'
    });

    // Update database correlation record
    await this.updateObservabilityCorrelation(session);

    this.activeSessions.delete(sessionId);

    logger.info('Ended observability session', {
      sessionId,
      status,
      duration: session.metrics.total_duration_ms,
      metrics: session.metrics
    });

    this.emit('session:ended', session);
    return session;
  }

  // Event Handlers
  private handleLangfuseTraceEnded(data: { traceId: string; duration: number }): void {
    // Find session by trace ID and update metrics
    for (const session of this.activeSessions.values()) {
      if (session.langfuse_trace_id === data.traceId) {
        session.metrics.tokens_consumed += 100; // Estimate from trace
        session.metrics.cost_total += 0.001; // Estimate
        break;
      }
    }
  }

  private handleLangfuseGeneration(data: any): void {
    // Update session metrics with generation data
    for (const session of this.activeSessions.values()) {
      if (session.langfuse_trace_id === data.traceId) {
        session.metrics.tokens_consumed += data.tokens.total || 0;
        session.metrics.cost_total += data.cost || 0;
        session.metrics.api_calls_count += 1;
        break;
      }
    }
  }

  private handleTrustGraphNodeCreated(node: any): void {
    // Link TrustGraph nodes to active sessions
    const swarmId = node.metadata?.swarm_id;
    const correlationId = node.metadata?.correlation_id;

    if (swarmId && correlationId) {
      for (const session of this.activeSessions.values()) {
        if (session.swarm_id === swarmId && session.correlation_id === correlationId) {
          session.trustgraph_nodes.push(node.id);
          break;
        }
      }
    }
  }

  private handleTrustGraphWSBroadcast(wsNode: any): void {
    // Track WebSocket broadcasts in session metrics
    const swarmId = wsNode.metadata?.swarm_id;
    
    if (swarmId) {
      for (const session of this.activeSessions.values()) {
        if (session.swarm_id === swarmId) {
          session.metrics.broadcasts_sent += 1;
          break;
        }
      }
    }
  }

  private handleMachineStateChange(delta: any): void {
    // Track machine state changes in session metrics
    const swarmId = delta.swarm_id;
    
    if (swarmId) {
      for (const session of this.activeSessions.values()) {
        if (session.swarm_id === swarmId) {
          session.metrics.state_changes += 1;
          session.machine_states.push(delta.machine_id);
          break;
        }
      }
    }

    // Emit state change event
    this.emit('state_change', {
      type: 'machine_state',
      source: 'supabase_realtime',
      swarm_id: swarmId,
      correlation_id: delta.correlation_id || 'unknown',
      data: delta,
      timestamp: new Date()
    } as StateChangeEvent);
  }

  private handleRealtimeDelta(swarmId: string, delta: any): void {
    this.handleMachineStateChange({ ...delta, swarm_id: swarmId });
  }

  // Database Operations
  private async createObservabilityCorrelation(session: ObservabilitySession): Promise<void> {
    try {
      const { error } = await this.supabaseRealtime.client
        .from('observability_correlations')
        .insert({
          correlation_id: session.correlation_id,
          swarm_id: session.swarm_id,
          langfuse_trace_id: session.langfuse_trace_id,
          operation_type: session.operation_type,
          operation_status: 'in_progress',
          started_at: session.started_at.toISOString(),
          total_api_calls: session.metrics.api_calls_count,
          total_tokens: session.metrics.tokens_consumed,
          total_cost: session.metrics.cost_total
        });

      if (error) throw error;
    } catch (error) {
      logger.error('Failed to create observability correlation', { error, session });
    }
  }

  private async updateObservabilityCorrelation(session: ObservabilitySession): Promise<void> {
    try {
      const { error } = await this.supabaseRealtime.client
        .from('observability_correlations')
        .update({
          operation_status: session.status,
          completed_at: session.completed_at?.toISOString(),
          total_duration_ms: session.metrics.total_duration_ms,
          total_api_calls: session.metrics.api_calls_count,
          total_tokens: session.metrics.tokens_consumed,
          total_cost: session.metrics.cost_total
        })
        .eq('correlation_id', session.correlation_id);

      if (error) throw error;
    } catch (error) {
      logger.error('Failed to update observability correlation', { error, session });
    }
  }

  // Monitoring and Health Checks
  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 30000); // Every 30 seconds
  }

  private async performHealthCheck(): Promise<void> {
    const health = {
      langfuse: this.langfuse.isEnabled(),
      supabase: this.supabaseRealtime.isConnected(),
      active_sessions: this.activeSessions.size,
      realtime_subscriptions: this.realtimeSubscriptions.size,
      timestamp: new Date()
    };

    this.emit('health_check', health);

    if (!health.supabase) {
      logger.warn('Supabase Realtime disconnected - attempting reconnection');
    }

    logger.debug('Observability health check', health);
  }

  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      this.collectMetrics();
    }, 60000); // Every minute
  }

  private async collectMetrics(): Promise<void> {
    try {
      const metrics: ObservabilityMetrics = {
        session_count: this.activeSessions.size,
        active_sessions: this.activeSessions.size,
        total_api_calls: Array.from(this.activeSessions.values())
          .reduce((sum, s) => sum + s.metrics.api_calls_count, 0),
        total_tokens: Array.from(this.activeSessions.values())
          .reduce((sum, s) => sum + s.metrics.tokens_consumed, 0),
        total_cost: Array.from(this.activeSessions.values())
          .reduce((sum, s) => sum + s.metrics.cost_total, 0),
        average_session_duration: this.calculateAverageSessionDuration(),
        success_rate: this.calculateSuccessRate(),
        top_operations: this.getTopOperations(),
        realtime_connections: this.realtimeSubscriptions.size,
        trustgraph_nodes: this.trustGraph.exportGraph().nodes.length,
        langfuse_traces: this.activeSessions.size
      };

      this.metricsHistory.push(metrics);
      
      // Keep only recent metrics
      if (this.metricsHistory.length > this.maxHistoryRetention) {
        this.metricsHistory = this.metricsHistory.slice(-this.maxHistoryRetention);
      }

      this.emit('metrics_collected', metrics);
      logger.debug('Collected observability metrics', metrics);

    } catch (error) {
      logger.error('Failed to collect observability metrics', { error });
    }
  }

  private calculateAverageSessionDuration(): number {
    const activeSessions = Array.from(this.activeSessions.values());
    if (activeSessions.length === 0) return 0;

    const now = Date.now();
    const totalDuration = activeSessions.reduce((sum, session) => {
      return sum + (now - session.started_at.getTime());
    }, 0);

    return totalDuration / activeSessions.length;
  }

  private calculateSuccessRate(): number {
    const sessions = Array.from(this.activeSessions.values());
    const completedSessions = sessions.filter(s => s.status === 'completed');
    
    if (sessions.length === 0) return 1;
    return completedSessions.length / sessions.length;
  }

  private getTopOperations(): Array<{ operation: string; count: number; avg_duration: number }> {
    const operationStats = new Map<string, { count: number; totalDuration: number }>();

    Array.from(this.activeSessions.values()).forEach(session => {
      const op = session.operation_type;
      const duration = session.metrics.total_duration_ms || 0;
      
      if (!operationStats.has(op)) {
        operationStats.set(op, { count: 0, totalDuration: 0 });
      }
      
      const stats = operationStats.get(op)!;
      stats.count += 1;
      stats.totalDuration += duration;
    });

    return Array.from(operationStats.entries())
      .map(([operation, stats]) => ({
        operation,
        count: stats.count,
        avg_duration: stats.count > 0 ? stats.totalDuration / stats.count : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  // Public API
  getActiveSessions(): ObservabilitySession[] {
    return Array.from(this.activeSessions.values());
  }

  getSessionById(sessionId: string): ObservabilitySession | null {
    return this.activeSessions.get(sessionId) || null;
  }

  getSessionsBySwarm(swarmId: string): ObservabilitySession[] {
    return Array.from(this.activeSessions.values())
      .filter(session => session.swarm_id === swarmId);
  }

  getCurrentMetrics(): ObservabilityMetrics | null {
    return this.metricsHistory[this.metricsHistory.length - 1] || null;
  }

  getMetricsHistory(): ObservabilityMetrics[] {
    return [...this.metricsHistory];
  }

  async getSwarmObservabilityData(swarmId: string): Promise<{
    sessions: ObservabilitySession[];
    trustgraph: any;
    machine_states: any[];
    langfuse_metrics: any;
    realtime_status: boolean;
  }> {
    const sessions = this.getSessionsBySwarm(swarmId);
    const trustgraph = this.trustGraph.getSwarmVisualizationData(swarmId);
    const machineStates = await this.supabaseRealtime.getSwarmMachineStates(swarmId);
    const langfuseMetrics = this.langfuse.getMetrics();
    const realtimeStatus = this.supabaseRealtime.isConnected();

    return {
      sessions,
      trustgraph,
      machine_states: machineStates,
      langfuseMetrics,
      realtime_status: realtimeStatus
    };
  }

  isOrchestratorInitialized(): boolean {
    return this.orchestratorInitialized;
  }

  // Cleanup
  async destroy(): Promise<void> {
    logger.info('Destroying observability orchestrator...');

    // End all active sessions
    const sessionPromises = Array.from(this.activeSessions.keys()).map(
      sessionId => this.endObservabilitySession(sessionId, 'completed')
    );
    await Promise.all(sessionPromises);

    // Clean up intervals
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }

    // Clean up subscriptions
    for (const [swarmId, channelName] of this.realtimeSubscriptions) {
      await this.supabaseRealtime.unsubscribe(channelName);
    }
    this.realtimeSubscriptions.clear();

    this.removeAllListeners();
    this.isInitialized = false;
    
    logger.info('Observability orchestrator destroyed');
  }
}

// Export singleton instance
export const observabilityOrchestrator = new ObservabilityOrchestrator();