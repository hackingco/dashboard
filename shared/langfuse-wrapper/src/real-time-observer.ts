/**
 * Real-Time Observation System for Langfuse Wrapper
 * Provides streaming trace updates with WebSocket integration and live monitoring
 */

import { EventEmitter } from 'events';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { performance } from 'perf_hooks';
import Database from 'better-sqlite3';
import * as path from 'path';

export interface RealTimeObservation {
  id: string;
  timestamp: number;
  type: 'trace_start' | 'trace_update' | 'trace_complete' | 'span_start' | 'span_complete' | 'error' | 'anomaly';
  traceId: string;
  spanId?: string;
  swarmId?: string;
  agentId?: string;
  agentRole?: string;
  data: any;
  performanceMetrics: {
    latencyMs: number;
    tokensPerSecond?: number;
    memoryUsageMB?: number;
    cpuUsagePercent?: number;
  };
  anomalyScore?: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface StreamingMetrics {
  totalTraces: number;
  activeTraces: number;
  tracesPerSecond: number;
  averageLatency: number;
  tokenThroughput: number;
  errorRate: number;
  anomalyCount: number;
  swarmCoordination: {
    activeAgents: number;
    coordinationLatency: number;
    syncErrors: number;
  };
}

export interface AnomalyPattern {
  id: string;
  type: 'performance_degradation' | 'high_error_rate' | 'coordination_failure' | 'resource_exhaustion';
  threshold: number;
  windowSizeMs: number;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export class RealTimeObserver extends EventEmitter {
  private wsServer: WebSocketServer | null = null;
  private httpServer: any = null;
  private clients: Set<WebSocket> = new Set();
  private db: Database.Database;
  private observations: Map<string, RealTimeObservation> = new Map();
  private metrics: StreamingMetrics;
  private anomalyPatterns: Map<string, AnomalyPattern> = new Map();
  private performanceWindow: number[] = [];
  private readonly WINDOW_SIZE = 100;
  private readonly ANOMALY_CHECK_INTERVAL = 5000;
  private anomalyCheckTimer?: NodeJS.Timeout;
  private isRunning = false;

  constructor(private port: number = 8080, private dbPath: string = '.swarm/realtime-observations.db') {
    super();
    this.initializeDatabase();
    this.initializeMetrics();
    this.setupAnomalyPatterns();
  }

  private initializeDatabase(): void {
    try {
      this.db = new Database(this.dbPath);
      
      // Create observations table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS observations (
          id TEXT PRIMARY KEY,
          timestamp INTEGER,
          type TEXT,
          trace_id TEXT,
          span_id TEXT,
          swarm_id TEXT,
          agent_id TEXT,
          agent_role TEXT,
          data TEXT,
          performance_metrics TEXT,
          anomaly_score REAL,
          severity TEXT
        )
      `);

      // Create metrics snapshots table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS metrics_snapshots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp INTEGER,
          metrics TEXT
        )
      `);

      // Create anomaly events table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS anomaly_events (
          id TEXT PRIMARY KEY,
          timestamp INTEGER,
          pattern_id TEXT,
          trace_id TEXT,
          severity TEXT,
          description TEXT,
          data TEXT
        )
      `);

      // Create indices for better performance
      this.db.exec(`CREATE INDEX IF NOT EXISTS idx_observations_timestamp ON observations(timestamp)`);
      this.db.exec(`CREATE INDEX IF NOT EXISTS idx_observations_trace ON observations(trace_id)`);
      this.db.exec(`CREATE INDEX IF NOT EXISTS idx_observations_swarm ON observations(swarm_id)`);
      this.db.exec(`CREATE INDEX IF NOT EXISTS idx_anomaly_timestamp ON anomaly_events(timestamp)`);

    } catch (error) {
      console.error('Failed to initialize real-time observations database:', error);
      throw error;
    }
  }

  private initializeMetrics(): void {
    this.metrics = {
      totalTraces: 0,
      activeTraces: 0,
      tracesPerSecond: 0,
      averageLatency: 0,
      tokenThroughput: 0,
      errorRate: 0,
      anomalyCount: 0,
      swarmCoordination: {
        activeAgents: 0,
        coordinationLatency: 0,
        syncErrors: 0
      }
    };
  }

  private setupAnomalyPatterns(): void {
    // Performance degradation pattern
    this.anomalyPatterns.set('perf_degradation', {
      id: 'perf_degradation',
      type: 'performance_degradation',
      threshold: 0.5, // 50% increase in latency
      windowSizeMs: 30000, // 30 seconds
      description: 'Performance degradation detected',
      severity: 'medium'
    });

    // High error rate pattern
    this.anomalyPatterns.set('high_error_rate', {
      id: 'high_error_rate',
      type: 'high_error_rate',
      threshold: 0.1, // 10% error rate
      windowSizeMs: 60000, // 1 minute
      description: 'High error rate detected',
      severity: 'high'
    });

    // Coordination failure pattern
    this.anomalyPatterns.set('coordination_failure', {
      id: 'coordination_failure',
      type: 'coordination_failure',
      threshold: 1000, // 1 second coordination latency
      windowSizeMs: 15000, // 15 seconds
      description: 'Swarm coordination latency high',
      severity: 'critical'
    });

    // Resource exhaustion pattern
    this.anomalyPatterns.set('resource_exhaustion', {
      id: 'resource_exhaustion',
      type: 'resource_exhaustion',
      threshold: 0.9, // 90% resource usage
      windowSizeMs: 45000, // 45 seconds
      description: 'Resource usage critically high',
      severity: 'critical'
    });
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Real-time observer already running');
      return;
    }

    try {
      // Create HTTP server for WebSocket upgrade
      this.httpServer = createServer((req, res) => {
        if (req.url === '/health') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            status: 'healthy', 
            clients: this.clients.size,
            observations: this.observations.size,
            metrics: this.metrics
          }));
        } else if (req.url === '/metrics') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(this.metrics));
        } else {
          res.writeHead(404);
          res.end('Not Found');
        }
      });

      // Create WebSocket server
      this.wsServer = new WebSocketServer({ server: this.httpServer });
      
      this.wsServer.on('connection', (ws: WebSocket) => {
        this.clients.add(ws);
        console.log(`Client connected. Total clients: ${this.clients.size}`);
        
        // Send current metrics to new client
        this.sendToClient(ws, {
          type: 'metrics_update',
          data: this.metrics,
          timestamp: Date.now()
        });

        ws.on('close', () => {
          this.clients.delete(ws);
          console.log(`Client disconnected. Total clients: ${this.clients.size}`);
        });

        ws.on('error', (error) => {
          console.error('WebSocket error:', error);
          this.clients.delete(ws);
        });
      });

      // Start HTTP server
      await new Promise<void>((resolve, reject) => {
        this.httpServer.listen(this.port, (error?: Error) => {
          if (error) reject(error);
          else resolve();
        });
      });

      // Start anomaly detection
      this.startAnomalyDetection();
      
      this.isRunning = true;
      console.log(`Real-time observer started on port ${this.port}`);
      this.emit('started');

    } catch (error) {
      console.error('Failed to start real-time observer:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    try {
      // Stop anomaly detection
      if (this.anomalyCheckTimer) {
        clearInterval(this.anomalyCheckTimer);
      }

      // Close all WebSocket connections
      for (const client of this.clients) {
        client.close();
      }
      this.clients.clear();

      // Close WebSocket server
      if (this.wsServer) {
        this.wsServer.close();
      }

      // Close HTTP server
      if (this.httpServer) {
        await new Promise<void>((resolve) => {
          this.httpServer.close(() => resolve());
        });
      }

      // Close database
      this.db.close();

      this.isRunning = false;
      console.log('Real-time observer stopped');
      this.emit('stopped');

    } catch (error) {
      console.error('Error stopping real-time observer:', error);
    }
  }

  recordObservation(observation: Partial<RealTimeObservation>): void {
    const fullObservation: RealTimeObservation = {
      id: observation.id || `obs-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: observation.timestamp || Date.now(),
      type: observation.type || 'trace_update',
      traceId: observation.traceId || 'unknown',
      spanId: observation.spanId,
      swarmId: observation.swarmId,
      agentId: observation.agentId,
      agentRole: observation.agentRole,
      data: observation.data || {},
      performanceMetrics: observation.performanceMetrics || {
        latencyMs: 0,
        tokensPerSecond: 0,
        memoryUsageMB: 0,
        cpuUsagePercent: 0
      },
      anomalyScore: observation.anomalyScore,
      severity: observation.severity || 'low'
    };

    // Store observation
    this.observations.set(fullObservation.id, fullObservation);
    
    // Persist to database
    this.persistObservation(fullObservation);
    
    // Update metrics
    this.updateMetrics(fullObservation);
    
    // Check for anomalies
    this.checkForAnomalies(fullObservation);
    
    // Broadcast to clients
    this.broadcastObservation(fullObservation);
    
    // Cleanup old observations
    this.cleanupOldObservations();
  }

  private persistObservation(observation: RealTimeObservation): void {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO observations (
          id, timestamp, type, trace_id, span_id, swarm_id, agent_id, agent_role,
          data, performance_metrics, anomaly_score, severity
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        observation.id,
        observation.timestamp,
        observation.type,
        observation.traceId,
        observation.spanId,
        observation.swarmId,
        observation.agentId,
        observation.agentRole,
        JSON.stringify(observation.data),
        JSON.stringify(observation.performanceMetrics),
        observation.anomalyScore,
        observation.severity
      );
    } catch (error) {
      console.error('Failed to persist observation:', error);
    }
  }

  private updateMetrics(observation: RealTimeObservation): void {
    // Update basic counters
    if (observation.type === 'trace_start') {
      this.metrics.totalTraces++;
      this.metrics.activeTraces++;
    } else if (observation.type === 'trace_complete') {
      this.metrics.activeTraces = Math.max(0, this.metrics.activeTraces - 1);
    }

    // Update performance window
    this.performanceWindow.push(observation.performanceMetrics.latencyMs);
    if (this.performanceWindow.length > this.WINDOW_SIZE) {
      this.performanceWindow.shift();
    }

    // Calculate average latency
    if (this.performanceWindow.length > 0) {
      this.metrics.averageLatency = this.performanceWindow.reduce((sum, val) => sum + val, 0) / this.performanceWindow.length;
    }

    // Update token throughput
    if (observation.performanceMetrics.tokensPerSecond) {
      this.metrics.tokenThroughput = (this.metrics.tokenThroughput * 0.9) + (observation.performanceMetrics.tokensPerSecond * 0.1);
    }

    // Update error rate
    if (observation.type === 'error') {
      const recentObservations = Array.from(this.observations.values())
        .filter(obs => obs.timestamp > Date.now() - 60000); // Last minute
      const errorCount = recentObservations.filter(obs => obs.type === 'error').length;
      this.metrics.errorRate = errorCount / Math.max(1, recentObservations.length);
    }

    // Update swarm coordination metrics
    if (observation.swarmId) {
      const swarmObservations = Array.from(this.observations.values())
        .filter(obs => obs.swarmId === observation.swarmId && obs.timestamp > Date.now() - 30000);
      
      const uniqueAgents = new Set(swarmObservations.map(obs => obs.agentId).filter(Boolean));
      this.metrics.swarmCoordination.activeAgents = uniqueAgents.size;
      
      // Calculate coordination latency (time between observations from same swarm)
      if (swarmObservations.length > 1) {
        const sortedObs = swarmObservations.sort((a, b) => a.timestamp - b.timestamp);
        const intervals = [];
        for (let i = 1; i < sortedObs.length; i++) {
          intervals.push(sortedObs[i].timestamp - sortedObs[i-1].timestamp);
        }
        this.metrics.swarmCoordination.coordinationLatency = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
      }
    }

    // Persist metrics snapshot every 5 seconds
    if (Date.now() % 5000 < 100) {
      this.persistMetricsSnapshot();
    }
  }

  private persistMetricsSnapshot(): void {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO metrics_snapshots (timestamp, metrics) VALUES (?, ?)
      `);
      stmt.run(Date.now(), JSON.stringify(this.metrics));
    } catch (error) {
      console.error('Failed to persist metrics snapshot:', error);
    }
  }

  private checkForAnomalies(observation: RealTimeObservation): void {
    for (const [patternId, pattern] of this.anomalyPatterns) {
      const anomalyScore = this.calculateAnomalyScore(observation, pattern);
      
      if (anomalyScore > pattern.threshold) {
        this.reportAnomaly(patternId, pattern, observation, anomalyScore);
      }
    }
  }

  private calculateAnomalyScore(observation: RealTimeObservation, pattern: AnomalyPattern): number {
    const windowStart = Date.now() - pattern.windowSizeMs;
    const recentObservations = Array.from(this.observations.values())
      .filter(obs => obs.timestamp > windowStart);

    switch (pattern.type) {
      case 'performance_degradation':
        const currentLatency = observation.performanceMetrics.latencyMs;
        const avgLatency = this.metrics.averageLatency;
        return avgLatency > 0 ? (currentLatency - avgLatency) / avgLatency : 0;

      case 'high_error_rate':
        const errorCount = recentObservations.filter(obs => obs.type === 'error').length;
        return errorCount / Math.max(1, recentObservations.length);

      case 'coordination_failure':
        return this.metrics.swarmCoordination.coordinationLatency / 1000; // Convert to seconds

      case 'resource_exhaustion':
        const memoryUsage = observation.performanceMetrics.memoryUsageMB || 0;
        const cpuUsage = observation.performanceMetrics.cpuUsagePercent || 0;
        return Math.max(memoryUsage / 1000, cpuUsage / 100); // Normalize to 0-1

      default:
        return 0;
    }
  }

  private reportAnomaly(patternId: string, pattern: AnomalyPattern, observation: RealTimeObservation, score: number): void {
    const anomalyEvent = {
      id: `anomaly-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      pattern_id: patternId,
      trace_id: observation.traceId,
      severity: pattern.severity,
      description: pattern.description,
      data: JSON.stringify({
        observation: observation,
        anomaly_score: score,
        threshold: pattern.threshold,
        pattern: pattern
      })
    };

    // Persist anomaly
    try {
      const stmt = this.db.prepare(`
        INSERT INTO anomaly_events (id, timestamp, pattern_id, trace_id, severity, description, data)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        anomalyEvent.id,
        anomalyEvent.timestamp,
        anomalyEvent.pattern_id,
        anomalyEvent.trace_id,
        anomalyEvent.severity,
        anomalyEvent.description,
        anomalyEvent.data
      );
    } catch (error) {
      console.error('Failed to persist anomaly event:', error);
    }

    // Update metrics
    this.metrics.anomalyCount++;

    // Broadcast anomaly
    this.broadcastAnomaly(anomalyEvent);

    // Emit event
    this.emit('anomaly', anomalyEvent);

    console.warn(`🚨 ANOMALY DETECTED: ${pattern.description} (Score: ${score.toFixed(3)}, Threshold: ${pattern.threshold})`);
  }

  private startAnomalyDetection(): void {
    this.anomalyCheckTimer = setInterval(() => {
      this.performPeriodicAnomalyCheck();
    }, this.ANOMALY_CHECK_INTERVAL);
  }

  private performPeriodicAnomalyCheck(): void {
    // Check overall system health
    const now = Date.now();
    const recentObservations = Array.from(this.observations.values())
      .filter(obs => obs.timestamp > now - 60000); // Last minute

    // Calculate traces per second
    this.metrics.tracesPerSecond = recentObservations.filter(obs => obs.type === 'trace_start').length / 60;

    // Check for silence (no observations)
    if (recentObservations.length === 0 && this.observations.size > 0) {
      this.reportAnomaly('system_silence', {
        id: 'system_silence',
        type: 'coordination_failure',
        threshold: 0,
        windowSizeMs: 60000,
        description: 'System appears to be silent - no recent observations',
        severity: 'high'
      }, {
        id: 'silence-check',
        timestamp: now,
        type: 'anomaly',
        traceId: 'system',
        data: { reason: 'no_recent_activity' },
        performanceMetrics: { latencyMs: 0 },
        severity: 'high'
      } as RealTimeObservation, 1.0);
    }
  }

  private broadcastObservation(observation: RealTimeObservation): void {
    const message = {
      type: 'observation',
      data: observation,
      timestamp: Date.now()
    };

    this.broadcastToClients(message);
  }

  private broadcastAnomaly(anomaly: any): void {
    const message = {
      type: 'anomaly',
      data: anomaly,
      timestamp: Date.now()
    };

    this.broadcastToClients(message);
  }

  private broadcastToClients(message: any): void {
    const messageStr = JSON.stringify(message);
    
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(messageStr);
        } catch (error) {
          console.error('Failed to send message to client:', error);
          this.clients.delete(client);
        }
      }
    }
  }

  private sendToClient(client: WebSocket, message: any): void {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(JSON.stringify(message));
      } catch (error) {
        console.error('Failed to send message to specific client:', error);
        this.clients.delete(client);
      }
    }
  }

  private cleanupOldObservations(): void {
    // Keep only observations from last hour
    const cutoff = Date.now() - (60 * 60 * 1000);
    const toDelete = [];
    
    for (const [id, obs] of this.observations) {
      if (obs.timestamp < cutoff) {
        toDelete.push(id);
      }
    }
    
    for (const id of toDelete) {
      this.observations.delete(id);
    }

    // Cleanup database periodically (keep last 24 hours)
    if (Date.now() % 300000 < 100) { // Every 5 minutes
      try {
        const dbCutoff = Date.now() - (24 * 60 * 60 * 1000);
        this.db.prepare('DELETE FROM observations WHERE timestamp < ?').run(dbCutoff);
        this.db.prepare('DELETE FROM metrics_snapshots WHERE timestamp < ?').run(dbCutoff);
        this.db.prepare('DELETE FROM anomaly_events WHERE timestamp < ?').run(dbCutoff);
      } catch (error) {
        console.error('Failed to cleanup old database records:', error);
      }
    }
  }

  // Public API methods

  getMetrics(): StreamingMetrics {
    return { ...this.metrics };
  }

  getRecentObservations(limit: number = 100): RealTimeObservation[] {
    return Array.from(this.observations.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  getAnomalies(hours: number = 1): any[] {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    const stmt = this.db.prepare('SELECT * FROM anomaly_events WHERE timestamp > ? ORDER BY timestamp DESC');
    return stmt.all(cutoff);
  }

  getObservationsForTrace(traceId: string): RealTimeObservation[] {
    return Array.from(this.observations.values())
      .filter(obs => obs.traceId === traceId)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  getSwarmActivity(swarmId: string, hours: number = 1): any {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    const observations = Array.from(this.observations.values())
      .filter(obs => obs.swarmId === swarmId && obs.timestamp > cutoff);

    const agents = new Set(observations.map(obs => obs.agentId).filter(Boolean));
    const traces = new Set(observations.map(obs => obs.traceId));

    return {
      swarmId,
      timeRange: `${hours}h`,
      totalObservations: observations.length,
      uniqueAgents: agents.size,
      uniqueTraces: traces.size,
      averageLatency: observations.length > 0 
        ? observations.reduce((sum, obs) => sum + obs.performanceMetrics.latencyMs, 0) / observations.length 
        : 0,
      errorRate: observations.filter(obs => obs.type === 'error').length / Math.max(1, observations.length),
      agentActivity: Array.from(agents).map(agentId => ({
        agentId,
        observations: observations.filter(obs => obs.agentId === agentId).length,
        lastSeen: Math.max(...observations.filter(obs => obs.agentId === agentId).map(obs => obs.timestamp))
      }))
    };
  }

  isRunning(): boolean {
    return this.isRunning;
  }

  getClientCount(): number {
    return this.clients.size;
  }
}

// Singleton instance for global access
export const realTimeObserver = new RealTimeObserver();