/**
 * Session Management System for Trace Coordination
 * 
 * This system manages trace sessions with:
 * - Session lifecycle management
 * - Cross-trace coordination
 * - Session-wide metrics aggregation
 * - Persistent session storage
 * - Session restoration capabilities
 * - Real-time session monitoring
 */

import { EventEmitter } from 'events';
import { TraceMetadata, SessionContext, TraceHierarchy } from './trace-structure-system';
import { TraceIdGenerator } from './trace-structure-system';

export interface SessionMetrics {
  sessionId: string;
  totalTraces: number;
  activeTraces: number;
  completedTraces: number;
  errorTraces: number;
  totalDuration: number;
  averageDuration: number;
  totalTokens: number;
  totalCost: number;
  agentCount: number;
  swarmCount: number;
  operationTypes: Record<string, number>;
  statusDistribution: Record<string, number>;
  tagDistribution: Record<string, number>;
  performanceMetrics: {
    averageMemoryUsage: number;
    averageCpuUsage: number;
    peakMemoryUsage: number;
    peakCpuUsage: number;
  };
}

export interface SessionSnapshot {
  sessionId: string;
  timestamp: number;
  context: SessionContext;
  metrics: SessionMetrics;
  traces: TraceMetadata[];
  hierarchies: TraceHierarchy[];
  customData: Record<string, any>;
}

export class SessionManager extends EventEmitter {
  private sessions: Map<string, SessionContext> = new Map();
  private sessionTraces: Map<string, TraceMetadata[]> = new Map();
  private sessionHierarchies: Map<string, TraceHierarchy[]> = new Map();
  private sessionMetrics: Map<string, SessionMetrics> = new Map();
  private sessionStorage: Map<string, SessionSnapshot> = new Map();
  private metricsUpdateInterval: NodeJS.Timeout | null = null;
  
  constructor() {
    super();
    this.startMetricsUpdateLoop();
  }
  
  /**
   * Create a new session
   */
  createSession(
    sessionType: 'swarm_execution' | 'agent_workflow' | 'api_session' | 'test_run' | 'custom',
    sessionName?: string,
    metadata: Record<string, any> = {}
  ): SessionContext {
    const sessionId = TraceIdGenerator.generateSessionId(sessionType, metadata);
    
    const session: SessionContext = {
      sessionId,
      sessionName: sessionName || `${sessionType}_${Date.now()}`,
      sessionType,
      startTime: Date.now(),
      totalTraces: 0,
      activeTraces: 0,
      metadata: {
        ...metadata,
        createdAt: new Date().toISOString(),
        createdBy: 'session-manager',
      },
    };
    
    this.sessions.set(sessionId, session);
    this.sessionTraces.set(sessionId, []);
    this.sessionHierarchies.set(sessionId, []);
    this.initializeSessionMetrics(sessionId);
    
    this.emit('session-created', session);
    return session;
  }
  
  /**
   * Get session by ID
   */
  getSession(sessionId: string): SessionContext | null {
    return this.sessions.get(sessionId) || null;
  }
  
  /**
   * Get all active sessions
   */
  getActiveSessions(): SessionContext[] {
    return Array.from(this.sessions.values()).filter(session => !session.endTime);
  }
  
  /**
   * Add trace to session
   */
  addTraceToSession(sessionId: string, trace: TraceMetadata): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    const traces = this.sessionTraces.get(sessionId) || [];
    traces.push(trace);
    this.sessionTraces.set(sessionId, traces);
    
    // Update session context
    session.totalTraces++;
    if (trace.status === 'running' || trace.status === 'pending') {
      session.activeTraces++;
    }
    
    // Update session metadata
    if (trace.swarmId && !session.swarmId) {
      session.swarmId = trace.swarmId;
    }
    if (trace.agentId) {
      session.metadata.lastAgentId = trace.agentId;
    }
    
    this.updateSessionMetrics(sessionId);
    this.emit('trace-added', sessionId, trace);
  }
  
  /**
   * Add hierarchy to session
   */
  addHierarchyToSession(sessionId: string, hierarchy: TraceHierarchy): void {
    const hierarchies = this.sessionHierarchies.get(sessionId) || [];
    hierarchies.push(hierarchy);
    this.sessionHierarchies.set(sessionId, hierarchies);
    
    this.emit('hierarchy-added', sessionId, hierarchy);
  }
  
  /**
   * Update trace in session
   */
  updateTraceInSession(sessionId: string, traceId: string, updates: Partial<TraceMetadata>): boolean {
    const traces = this.sessionTraces.get(sessionId);
    if (!traces) return false;
    
    const traceIndex = traces.findIndex(t => t.traceId === traceId);
    if (traceIndex === -1) return false;
    
    const oldTrace = traces[traceIndex];
    const updatedTrace = { ...oldTrace, ...updates };
    traces[traceIndex] = updatedTrace;
    
    // Update session active traces count
    const session = this.sessions.get(sessionId);
    if (session) {
      if (oldTrace.status === 'running' && updatedTrace.status !== 'running') {
        session.activeTraces--;
      } else if (oldTrace.status !== 'running' && updatedTrace.status === 'running') {
        session.activeTraces++;
      }
    }
    
    this.updateSessionMetrics(sessionId);
    this.emit('trace-updated', sessionId, updatedTrace);
    return true;
  }
  
  /**
   * Complete a session
   */
  completeSession(sessionId: string, finalMetadata: Record<string, any> = {}): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    
    session.endTime = Date.now();
    session.metadata = {
      ...session.metadata,
      ...finalMetadata,
      completedAt: new Date().toISOString(),
    };
    
    this.updateSessionMetrics(sessionId);
    this.emit('session-completed', session);
    return true;
  }
  
  /**
   * Get session traces
   */
  getSessionTraces(sessionId: string): TraceMetadata[] {
    return this.sessionTraces.get(sessionId) || [];
  }
  
  /**
   * Get session hierarchies
   */
  getSessionHierarchies(sessionId: string): TraceHierarchy[] {
    return this.sessionHierarchies.get(sessionId) || [];
  }
  
  /**
   * Get session metrics
   */
  getSessionMetrics(sessionId: string): SessionMetrics | null {
    return this.sessionMetrics.get(sessionId) || null;
  }
  
  /**
   * Create session snapshot
   */
  createSessionSnapshot(sessionId: string): SessionSnapshot | null {
    const session = this.sessions.get(sessionId);
    const metrics = this.sessionMetrics.get(sessionId);
    const traces = this.sessionTraces.get(sessionId);
    const hierarchies = this.sessionHierarchies.get(sessionId);
    
    if (!session || !metrics || !traces || !hierarchies) return null;
    
    const snapshot: SessionSnapshot = {
      sessionId,
      timestamp: Date.now(),
      context: { ...session },
      metrics: { ...metrics },
      traces: [...traces],
      hierarchies: [...hierarchies],
      customData: {},
    };
    
    this.sessionStorage.set(`${sessionId}_${snapshot.timestamp}`, snapshot);
    this.emit('snapshot-created', snapshot);
    return snapshot;
  }
  
  /**
   * Restore session from snapshot
   */
  restoreSessionFromSnapshot(snapshotId: string): boolean {
    const snapshot = this.sessionStorage.get(snapshotId);
    if (!snapshot) return false;
    
    const { sessionId, context, metrics, traces, hierarchies } = snapshot;
    
    this.sessions.set(sessionId, context);
    this.sessionMetrics.set(sessionId, metrics);
    this.sessionTraces.set(sessionId, traces);
    this.sessionHierarchies.set(sessionId, hierarchies);
    
    this.emit('session-restored', sessionId, snapshot);
    return true;
  }
  
  /**
   * Get session snapshots
   */
  getSessionSnapshots(sessionId: string): SessionSnapshot[] {
    return Array.from(this.sessionStorage.values())
      .filter(snapshot => snapshot.sessionId === sessionId)
      .sort((a, b) => b.timestamp - a.timestamp);
  }
  
  /**
   * Initialize session metrics
   */
  private initializeSessionMetrics(sessionId: string): void {
    const metrics: SessionMetrics = {
      sessionId,
      totalTraces: 0,
      activeTraces: 0,
      completedTraces: 0,
      errorTraces: 0,
      totalDuration: 0,
      averageDuration: 0,
      totalTokens: 0,
      totalCost: 0,
      agentCount: 0,
      swarmCount: 0,
      operationTypes: {},
      statusDistribution: {},
      tagDistribution: {},
      performanceMetrics: {
        averageMemoryUsage: 0,
        averageCpuUsage: 0,
        peakMemoryUsage: 0,
        peakCpuUsage: 0,
      },
    };
    
    this.sessionMetrics.set(sessionId, metrics);
  }
  
  /**
   * Update session metrics
   */
  private updateSessionMetrics(sessionId: string): void {
    const traces = this.sessionTraces.get(sessionId) || [];
    const metrics = this.sessionMetrics.get(sessionId);
    if (!metrics) return;
    
    // Reset metrics
    Object.assign(metrics, {
      totalTraces: traces.length,
      activeTraces: traces.filter(t => t.status === 'running' || t.status === 'pending').length,
      completedTraces: traces.filter(t => t.status === 'success').length,
      errorTraces: traces.filter(t => t.status === 'error').length,
      totalDuration: 0,
      averageDuration: 0,
      totalTokens: 0,
      totalCost: 0,
      agentCount: 0,
      swarmCount: 0,
      operationTypes: {},
      statusDistribution: {},
      tagDistribution: {},
      performanceMetrics: {
        averageMemoryUsage: 0,
        averageCpuUsage: 0,
        peakMemoryUsage: 0,
        peakCpuUsage: 0,
      },
    });
    
    // Calculate metrics
    const uniqueAgents = new Set<string>();
    const uniqueSwarms = new Set<string>();
    let totalMemoryUsage = 0;
    let totalCpuUsage = 0;
    let memoryMeasurements = 0;
    let cpuMeasurements = 0;
    
    for (const trace of traces) {
      // Duration
      if (trace.duration) {
        metrics.totalDuration += trace.duration;
      }
      
      // Tokens and cost
      if (trace.tokenUsage) {
        metrics.totalTokens += trace.tokenUsage.totalTokens;
        if (trace.tokenUsage.cost) {
          metrics.totalCost += trace.tokenUsage.cost;
        }
      }
      
      // Agents and swarms
      if (trace.agentId) uniqueAgents.add(trace.agentId);
      if (trace.swarmId) uniqueSwarms.add(trace.swarmId);
      
      // Operation types
      metrics.operationTypes[trace.operationType] = (metrics.operationTypes[trace.operationType] || 0) + 1;
      
      // Status distribution
      metrics.statusDistribution[trace.status] = (metrics.statusDistribution[trace.status] || 0) + 1;
      
      // Tag distribution
      for (const tag of trace.tags) {
        metrics.tagDistribution[tag] = (metrics.tagDistribution[tag] || 0) + 1;
      }
      
      // Performance metrics
      if (trace.memoryUsage !== undefined) {
        totalMemoryUsage += trace.memoryUsage;
        memoryMeasurements++;
        metrics.performanceMetrics.peakMemoryUsage = Math.max(
          metrics.performanceMetrics.peakMemoryUsage,
          trace.memoryUsage
        );
      }
      
      if (trace.cpuUsage !== undefined) {
        totalCpuUsage += trace.cpuUsage;
        cpuMeasurements++;
        metrics.performanceMetrics.peakCpuUsage = Math.max(
          metrics.performanceMetrics.peakCpuUsage,
          trace.cpuUsage
        );
      }
    }
    
    // Calculate averages
    if (traces.length > 0) {
      metrics.averageDuration = metrics.totalDuration / traces.length;
    }
    
    if (memoryMeasurements > 0) {
      metrics.performanceMetrics.averageMemoryUsage = totalMemoryUsage / memoryMeasurements;
    }
    
    if (cpuMeasurements > 0) {
      metrics.performanceMetrics.averageCpuUsage = totalCpuUsage / cpuMeasurements;
    }
    
    metrics.agentCount = uniqueAgents.size;
    metrics.swarmCount = uniqueSwarms.size;
    
    this.emit('metrics-updated', sessionId, metrics);
  }
  
  /**
   * Start metrics update loop
   */
  private startMetricsUpdateLoop(): void {
    this.metricsUpdateInterval = setInterval(() => {
      for (const sessionId of this.sessions.keys()) {
        this.updateSessionMetrics(sessionId);
      }
    }, 5000); // Update every 5 seconds
  }
  
  /**
   * Stop metrics update loop
   */
  private stopMetricsUpdateLoop(): void {
    if (this.metricsUpdateInterval) {
      clearInterval(this.metricsUpdateInterval);
      this.metricsUpdateInterval = null;
    }
  }
  
  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions(maxAge: number = 24 * 60 * 60 * 1000): number {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [sessionId, session] of this.sessions.entries()) {
      const sessionAge = now - session.startTime;
      if (sessionAge > maxAge) {
        this.sessions.delete(sessionId);
        this.sessionTraces.delete(sessionId);
        this.sessionHierarchies.delete(sessionId);
        this.sessionMetrics.delete(sessionId);
        cleanedCount++;
      }
    }
    
    this.emit('cleanup-completed', cleanedCount);
    return cleanedCount;
  }
  
  /**
   * Export session data
   */
  exportSessionData(sessionId: string): any {
    const session = this.sessions.get(sessionId);
    const metrics = this.sessionMetrics.get(sessionId);
    const traces = this.sessionTraces.get(sessionId);
    const hierarchies = this.sessionHierarchies.get(sessionId);
    
    return {
      session,
      metrics,
      traces,
      hierarchies,
      exportedAt: new Date().toISOString(),
    };
  }
  
  /**
   * Import session data
   */
  importSessionData(data: any): boolean {
    try {
      const { session, metrics, traces, hierarchies } = data;
      
      if (session) this.sessions.set(session.sessionId, session);
      if (metrics) this.sessionMetrics.set(session.sessionId, metrics);
      if (traces) this.sessionTraces.set(session.sessionId, traces);
      if (hierarchies) this.sessionHierarchies.set(session.sessionId, hierarchies);
      
      this.emit('session-imported', session.sessionId);
      return true;
    } catch (error) {
      console.error('Failed to import session data:', error);
      return false;
    }
  }
  
  /**
   * Shutdown session manager
   */
  shutdown(): void {
    this.stopMetricsUpdateLoop();
    this.removeAllListeners();
    this.sessions.clear();
    this.sessionTraces.clear();
    this.sessionHierarchies.clear();
    this.sessionMetrics.clear();
    this.sessionStorage.clear();
  }
}

// Singleton instance
export const sessionManager = new SessionManager();

export default sessionManager;