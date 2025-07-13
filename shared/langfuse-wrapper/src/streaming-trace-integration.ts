/**
 * Streaming Trace Integration
 * Integrates real-time observations with Langfuse tracing and swarm coordination
 */

import { EventEmitter } from 'events';
import { LangfuseWrapper } from './index';
import { RealTimeObserver, RealTimeObservation } from './real-time-observer';
import { performance } from 'perf_hooks';
import * as os from 'os';

export interface TraceStreamConfig {
  enableRealTimeUpdates: boolean;
  updateIntervalMs: number;
  bufferSize: number;
  enablePerformanceMetrics: boolean;
  enableAnomalyDetection: boolean;
  enableSwarmCoordination: boolean;
  adaptiveThresholds: boolean;
}

export interface TraceUpdate {
  traceId: string;
  spanId?: string;
  updateType: 'start' | 'progress' | 'complete' | 'error';
  timestamp: number;
  data: any;
  performanceSnapshot: PerformanceSnapshot;
  coordination?: CoordinationInfo;
}

export interface PerformanceSnapshot {
  latencyMs: number;
  memoryUsageMB: number;
  cpuUsagePercent: number;
  tokensPerSecond: number;
  throughputScore: number;
  efficiencyRating: 'excellent' | 'good' | 'average' | 'poor' | 'critical';
}

export interface CoordinationInfo {
  swarmId: string;
  agentId: string;
  agentRole: string;
  coordinationLatency: number;
  syncStatus: 'synced' | 'syncing' | 'out_of_sync' | 'error';
  activeAgents: string[];
  coordinationScore: number;
}

export interface AdaptiveThreshold {
  metric: string;
  baselineValue: number;
  currentThreshold: number;
  adaptationRate: number;
  lastUpdated: number;
  violations: number;
}

export class StreamingTraceIntegration extends EventEmitter {
  private langfuseWrapper: LangfuseWrapper;
  private realTimeObserver: RealTimeObserver;
  private config: TraceStreamConfig;
  private activeTraces: Map<string, TraceStreamInfo> = new Map();
  private updateBuffer: TraceUpdate[] = [];
  private updateTimer?: NodeJS.Timeout;
  private performanceBaseline: Map<string, number> = new Map();
  private adaptiveThresholds: Map<string, AdaptiveThreshold> = new Map();
  private coordinationState: Map<string, CoordinationInfo> = new Map();
  private lastResourceCheck = 0;

  constructor(
    langfuseWrapper: LangfuseWrapper,
    realTimeObserver: RealTimeObserver,
    config: Partial<TraceStreamConfig> = {}
  ) {
    super();
    
    this.langfuseWrapper = langfuseWrapper;
    this.realTimeObserver = realTimeObserver;
    
    this.config = {
      enableRealTimeUpdates: true,
      updateIntervalMs: 1000,
      bufferSize: 100,
      enablePerformanceMetrics: true,
      enableAnomalyDetection: true,
      enableSwarmCoordination: true,
      adaptiveThresholds: true,
      ...config
    };

    this.initializeAdaptiveThresholds();
    this.setupEventHandlers();
    this.startStreamingUpdates();
  }

  private initializeAdaptiveThresholds(): void {
    if (!this.config.adaptiveThresholds) return;

    // Initialize baseline thresholds
    const thresholds = [
      { metric: 'latency', baseline: 100, threshold: 200, rate: 0.1 },
      { metric: 'memory', baseline: 100, threshold: 500, rate: 0.05 },
      { metric: 'cpu', baseline: 20, threshold: 80, rate: 0.1 },
      { metric: 'error_rate', baseline: 0.01, threshold: 0.1, rate: 0.2 },
      { metric: 'coordination_latency', baseline: 50, threshold: 200, rate: 0.15 }
    ];

    for (const t of thresholds) {
      this.adaptiveThresholds.set(t.metric, {
        metric: t.metric,
        baselineValue: t.baseline,
        currentThreshold: t.threshold,
        adaptationRate: t.rate,
        lastUpdated: Date.now(),
        violations: 0
      });
    }
  }

  private setupEventHandlers(): void {
    // Listen to Langfuse wrapper events
    this.langfuseWrapper.on('initialized', () => {
      this.emit('streaming_ready');
    });

    // Listen to real-time observer events
    this.realTimeObserver.on('anomaly', (anomaly) => {
      this.handleAnomaly(anomaly);
    });

    this.realTimeObserver.on('started', () => {
      console.log('Real-time observer connected to streaming integration');
    });
  }

  private startStreamingUpdates(): void {
    if (!this.config.enableRealTimeUpdates) return;

    this.updateTimer = setInterval(() => {
      this.processUpdateBuffer();
      this.updatePerformanceBaselines();
      this.adaptThresholds();
    }, this.config.updateIntervalMs);
  }

  async startTrace(context: any): Promise<string | null> {
    const traceId = await this.langfuseWrapper.preHook(context);
    
    if (traceId) {
      const performanceSnapshot = await this.capturePerformanceSnapshot();
      const coordinationInfo = await this.captureCoordinationInfo(context);

      // Create trace stream info
      const traceInfo: TraceStreamInfo = {
        traceId,
        startTime: Date.now(),
        context,
        updateCount: 0,
        lastUpdate: Date.now(),
        performanceHistory: [performanceSnapshot],
        coordinationHistory: coordinationInfo ? [coordinationInfo] : []
      };

      this.activeTraces.set(traceId, traceInfo);

      // Record real-time observation
      this.realTimeObserver.recordObservation({
        type: 'trace_start',
        traceId,
        swarmId: context.swarmId,
        agentId: context.agentId,
        agentRole: context.agentRole,
        data: context,
        performanceMetrics: {
          latencyMs: 0,
          tokensPerSecond: performanceSnapshot.tokensPerSecond,
          memoryUsageMB: performanceSnapshot.memoryUsageMB,
          cpuUsagePercent: performanceSnapshot.cpuUsagePercent
        },
        severity: 'low'
      });

      // Queue streaming update
      this.queueUpdate({
        traceId,
        updateType: 'start',
        timestamp: Date.now(),
        data: context,
        performanceSnapshot,
        coordination: coordinationInfo
      });

      this.emit('trace_started', { traceId, context, performance: performanceSnapshot });
    }

    return traceId;
  }

  async updateTrace(traceId: string, data: any, spanId?: string): Promise<void> {
    const traceInfo = this.activeTraces.get(traceId);
    if (!traceInfo) return;

    const performanceSnapshot = await this.capturePerformanceSnapshot();
    const coordinationInfo = await this.captureCoordinationInfo(traceInfo.context);

    // Update trace info
    traceInfo.updateCount++;
    traceInfo.lastUpdate = Date.now();
    traceInfo.performanceHistory.push(performanceSnapshot);
    if (coordinationInfo) {
      traceInfo.coordinationHistory.push(coordinationInfo);
    }

    // Calculate performance trends
    const performanceTrend = this.analyzePerformanceTrend(traceInfo.performanceHistory);

    // Record real-time observation
    this.realTimeObserver.recordObservation({
      type: 'trace_update',
      traceId,
      spanId,
      swarmId: traceInfo.context.swarmId,
      agentId: traceInfo.context.agentId,
      agentRole: traceInfo.context.agentRole,
      data: { ...data, performanceTrend },
      performanceMetrics: {
        latencyMs: Date.now() - traceInfo.startTime,
        tokensPerSecond: performanceSnapshot.tokensPerSecond,
        memoryUsageMB: performanceSnapshot.memoryUsageMB,
        cpuUsagePercent: performanceSnapshot.cpuUsagePercent
      },
      severity: this.assessSeverity(performanceSnapshot, performanceTrend)
    });

    // Queue streaming update
    this.queueUpdate({
      traceId,
      spanId,
      updateType: 'progress',
      timestamp: Date.now(),
      data: { ...data, trend: performanceTrend },
      performanceSnapshot,
      coordination: coordinationInfo
    });

    this.emit('trace_updated', { traceId, data, performance: performanceSnapshot, trend: performanceTrend });
  }

  async completeTrace(traceId: string, result: any, tokenUsage?: any): Promise<void> {
    const traceInfo = this.activeTraces.get(traceId);
    if (!traceInfo) return;

    const performanceSnapshot = await this.capturePerformanceSnapshot();
    const coordinationInfo = await this.captureCoordinationInfo(traceInfo.context);
    const duration = Date.now() - traceInfo.startTime;

    // Complete Langfuse trace
    await this.langfuseWrapper.postHook(traceId, result, tokenUsage, {
      duration,
      updateCount: traceInfo.updateCount,
      performanceHistory: traceInfo.performanceHistory,
      coordinationHistory: traceInfo.coordinationHistory
    });

    // Record final observation
    this.realTimeObserver.recordObservation({
      type: 'trace_complete',
      traceId,
      swarmId: traceInfo.context.swarmId,
      agentId: traceInfo.context.agentId,
      agentRole: traceInfo.context.agentRole,
      data: { result, tokenUsage, duration, updateCount: traceInfo.updateCount },
      performanceMetrics: {
        latencyMs: duration,
        tokensPerSecond: performanceSnapshot.tokensPerSecond,
        memoryUsageMB: performanceSnapshot.memoryUsageMB,
        cpuUsagePercent: performanceSnapshot.cpuUsagePercent
      },
      severity: 'low'
    });

    // Queue final update
    this.queueUpdate({
      traceId,
      updateType: 'complete',
      timestamp: Date.now(),
      data: { result, tokenUsage, duration },
      performanceSnapshot,
      coordination: coordinationInfo
    });

    // Update performance baselines
    this.updatePerformanceBaseline('trace_duration', duration);
    if (tokenUsage) {
      const tokensPerSecond = tokenUsage.total / (duration / 1000);
      this.updatePerformanceBaseline('tokens_per_second', tokensPerSecond);
    }

    // Cleanup
    this.activeTraces.delete(traceId);

    this.emit('trace_completed', { traceId, result, duration, performance: performanceSnapshot });
  }

  async errorTrace(traceId: string, error: Error): Promise<void> {
    const traceInfo = this.activeTraces.get(traceId);
    if (!traceInfo) return;

    const performanceSnapshot = await this.capturePerformanceSnapshot();
    const coordinationInfo = await this.captureCoordinationInfo(traceInfo.context);

    // Error Langfuse trace
    await this.langfuseWrapper.errorHook(traceId, error);

    // Record error observation
    this.realTimeObserver.recordObservation({
      type: 'error',
      traceId,
      swarmId: traceInfo.context.swarmId,
      agentId: traceInfo.context.agentId,
      agentRole: traceInfo.context.agentRole,
      data: { error: error.message, stack: error.stack },
      performanceMetrics: {
        latencyMs: Date.now() - traceInfo.startTime,
        tokensPerSecond: performanceSnapshot.tokensPerSecond,
        memoryUsageMB: performanceSnapshot.memoryUsageMB,
        cpuUsagePercent: performanceSnapshot.cpuUsagePercent
      },
      severity: 'critical'
    });

    // Queue error update
    this.queueUpdate({
      traceId,
      updateType: 'error',
      timestamp: Date.now(),
      data: { error: error.message, stack: error.stack },
      performanceSnapshot,
      coordination: coordinationInfo
    });

    // Cleanup
    this.activeTraces.delete(traceId);

    this.emit('trace_error', { traceId, error, performance: performanceSnapshot });
  }

  private async capturePerformanceSnapshot(): Promise<PerformanceSnapshot> {
    const now = Date.now();
    let memoryUsageMB = 0;
    let cpuUsagePercent = 0;

    try {
      // Memory usage
      const memUsage = process.memoryUsage();
      memoryUsageMB = memUsage.heapUsed / 1024 / 1024;

      // CPU usage (approximation)
      if (now - this.lastResourceCheck > 1000) {
        const cpus = os.cpus();
        let totalIdle = 0;
        let totalTick = 0;

        for (const cpu of cpus) {
          for (const type in cpu.times) {
            totalTick += cpu.times[type as keyof typeof cpu.times];
          }
          totalIdle += cpu.times.idle;
        }

        cpuUsagePercent = Math.max(0, 100 - (100 * totalIdle / totalTick));
        this.lastResourceCheck = now;
      }
    } catch (error) {
      console.warn('Failed to capture resource metrics:', error);
    }

    // Calculate tokens per second (estimated)
    const recentTraces = Array.from(this.activeTraces.values())
      .filter(trace => now - trace.lastUpdate < 5000);
    
    let tokensPerSecond = 0;
    if (recentTraces.length > 0) {
      const totalDuration = recentTraces.reduce((sum, trace) => sum + (now - trace.startTime), 0);
      const avgDuration = totalDuration / recentTraces.length;
      tokensPerSecond = avgDuration > 0 ? (1000 / avgDuration) * 100 : 0; // Rough estimation
    }

    // Calculate throughput score
    const throughputScore = this.calculateThroughputScore(tokensPerSecond, memoryUsageMB, cpuUsagePercent);

    // Assess efficiency rating
    const efficiencyRating = this.assessEfficiencyRating(throughputScore, memoryUsageMB, cpuUsagePercent);

    return {
      latencyMs: 0, // Will be filled by caller
      memoryUsageMB,
      cpuUsagePercent,
      tokensPerSecond,
      throughputScore,
      efficiencyRating
    };
  }

  private async captureCoordinationInfo(context: any): Promise<CoordinationInfo | null> {
    if (!this.config.enableSwarmCoordination || !context.swarmId) return null;

    try {
      const swarmActivity = this.realTimeObserver.getSwarmActivity(context.swarmId, 0.25); // Last 15 minutes
      const coordinationLatency = this.calculateCoordinationLatency(context.swarmId);
      const syncStatus = this.assessSyncStatus(coordinationLatency, swarmActivity);
      const coordinationScore = this.calculateCoordinationScore(swarmActivity, coordinationLatency);

      const coordinationInfo: CoordinationInfo = {
        swarmId: context.swarmId,
        agentId: context.agentId || 'unknown',
        agentRole: context.agentRole || 'unknown',
        coordinationLatency,
        syncStatus,
        activeAgents: swarmActivity.agentActivity.map((a: any) => a.agentId),
        coordinationScore
      };

      this.coordinationState.set(context.swarmId, coordinationInfo);
      return coordinationInfo;

    } catch (error) {
      console.warn('Failed to capture coordination info:', error);
      return null;
    }
  }

  private calculateCoordinationLatency(swarmId: string): number {
    const recentObservations = this.realTimeObserver.getRecentObservations(50)
      .filter(obs => obs.swarmId === swarmId);

    if (recentObservations.length < 2) return 0;

    const intervals = [];
    for (let i = 1; i < recentObservations.length; i++) {
      intervals.push(recentObservations[i-1].timestamp - recentObservations[i].timestamp);
    }

    return intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
  }

  private assessSyncStatus(latency: number, activity: any): CoordinationInfo['syncStatus'] {
    if (latency === 0) return 'error';
    if (latency < 100) return 'synced';
    if (latency < 500) return 'syncing';
    return 'out_of_sync';
  }

  private calculateCoordinationScore(activity: any, latency: number): number {
    const agentCount = activity.uniqueAgents;
    const observationRate = activity.totalObservations / Math.max(1, activity.timeRange || 15);
    const latencyScore = Math.max(0, 100 - (latency / 10));
    const activityScore = Math.min(100, observationRate * 10);
    const collaborationScore = Math.min(100, agentCount * 20);

    return (latencyScore + activityScore + collaborationScore) / 3;
  }

  private calculateThroughputScore(tokensPerSecond: number, memoryMB: number, cpuPercent: number): number {
    const tokenScore = Math.min(100, tokensPerSecond);
    const memoryScore = Math.max(0, 100 - (memoryMB / 10));
    const cpuScore = Math.max(0, 100 - cpuPercent);

    return (tokenScore + memoryScore + cpuScore) / 3;
  }

  private assessEfficiencyRating(throughputScore: number, memoryMB: number, cpuPercent: number): PerformanceSnapshot['efficiencyRating'] {
    if (throughputScore > 80 && memoryMB < 200 && cpuPercent < 30) return 'excellent';
    if (throughputScore > 60 && memoryMB < 400 && cpuPercent < 60) return 'good';
    if (throughputScore > 40 && memoryMB < 600 && cpuPercent < 80) return 'average';
    if (throughputScore > 20) return 'poor';
    return 'critical';
  }

  private analyzePerformanceTrend(history: PerformanceSnapshot[]): any {
    if (history.length < 2) return { trend: 'stable', confidence: 0 };

    const recent = history.slice(-5);
    const throughputTrend = this.calculateTrend(recent.map(h => h.throughputScore));
    const memoryTrend = this.calculateTrend(recent.map(h => h.memoryUsageMB));
    const cpuTrend = this.calculateTrend(recent.map(h => h.cpuUsagePercent));

    return {
      throughput: throughputTrend,
      memory: memoryTrend,
      cpu: cpuTrend,
      overall: this.assessOverallTrend(throughputTrend, memoryTrend, cpuTrend),
      confidence: Math.min(1, recent.length / 5)
    };
  }

  private calculateTrend(values: number[]): string {
    if (values.length < 2) return 'stable';

    const first = values[0];
    const last = values[values.length - 1];
    const change = (last - first) / first;

    if (change > 0.1) return 'increasing';
    if (change < -0.1) return 'decreasing';
    return 'stable';
  }

  private assessOverallTrend(throughput: string, memory: string, cpu: string): string {
    if (throughput === 'increasing' && memory === 'stable' && cpu === 'stable') return 'improving';
    if (throughput === 'decreasing' || memory === 'increasing' || cpu === 'increasing') return 'degrading';
    return 'stable';
  }

  private assessSeverity(performance: PerformanceSnapshot, trend: any): RealTimeObservation['severity'] {
    if (performance.efficiencyRating === 'critical' || trend.overall === 'degrading') return 'critical';
    if (performance.efficiencyRating === 'poor' || performance.memoryUsageMB > 500) return 'high';
    if (performance.efficiencyRating === 'average') return 'medium';
    return 'low';
  }

  private queueUpdate(update: TraceUpdate): void {
    this.updateBuffer.push(update);
    
    if (this.updateBuffer.length >= this.config.bufferSize) {
      this.processUpdateBuffer();
    }
  }

  private processUpdateBuffer(): void {
    if (this.updateBuffer.length === 0) return;

    const updates = [...this.updateBuffer];
    this.updateBuffer = [];

    // Group updates by trace
    const traceGroups = new Map<string, TraceUpdate[]>();
    for (const update of updates) {
      const existing = traceGroups.get(update.traceId) || [];
      existing.push(update);
      traceGroups.set(update.traceId, existing);
    }

    // Emit grouped updates
    for (const [traceId, traceUpdates] of traceGroups) {
      this.emit('trace_stream_update', {
        traceId,
        updates: traceUpdates,
        summary: this.summarizeUpdates(traceUpdates)
      });
    }
  }

  private summarizeUpdates(updates: TraceUpdate[]): any {
    const latest = updates[updates.length - 1];
    const performance = latest.performanceSnapshot;
    
    return {
      updateCount: updates.length,
      latestUpdate: latest.updateType,
      timespan: updates.length > 1 ? updates[updates.length - 1].timestamp - updates[0].timestamp : 0,
      performance: {
        efficiency: performance.efficiencyRating,
        throughput: performance.throughputScore,
        memory: performance.memoryUsageMB,
        cpu: performance.cpuUsagePercent
      },
      coordination: latest.coordination ? {
        syncStatus: latest.coordination.syncStatus,
        score: latest.coordination.coordinationScore,
        activeAgents: latest.coordination.activeAgents.length
      } : null
    };
  }

  private updatePerformanceBaseline(metric: string, value: number): void {
    const current = this.performanceBaseline.get(metric) || value;
    const updated = (current * 0.9) + (value * 0.1); // Exponential moving average
    this.performanceBaseline.set(metric, updated);
  }

  private updatePerformanceBaselines(): void {
    const metrics = this.realTimeObserver.getMetrics();
    
    this.updatePerformanceBaseline('average_latency', metrics.averageLatency);
    this.updatePerformanceBaseline('tokens_per_second', metrics.tokenThroughput);
    this.updatePerformanceBaseline('error_rate', metrics.errorRate);
    this.updatePerformanceBaseline('coordination_latency', metrics.swarmCoordination.coordinationLatency);
  }

  private adaptThresholds(): void {
    if (!this.config.adaptiveThresholds) return;

    const now = Date.now();
    const metrics = this.realTimeObserver.getMetrics();

    for (const [metric, threshold] of this.adaptiveThresholds) {
      if (now - threshold.lastUpdated < 60000) continue; // Update max once per minute

      let currentValue = 0;
      switch (metric) {
        case 'latency':
          currentValue = metrics.averageLatency;
          break;
        case 'error_rate':
          currentValue = metrics.errorRate;
          break;
        case 'coordination_latency':
          currentValue = metrics.swarmCoordination.coordinationLatency;
          break;
      }

      // Adapt threshold based on recent performance
      if (currentValue > threshold.currentThreshold) {
        threshold.violations++;
        threshold.currentThreshold *= (1 + threshold.adaptationRate);
      } else if (threshold.violations > 0 && currentValue < threshold.currentThreshold * 0.8) {
        threshold.violations = Math.max(0, threshold.violations - 1);
        threshold.currentThreshold *= (1 - threshold.adaptationRate * 0.5);
      }

      threshold.lastUpdated = now;
    }
  }

  private handleAnomaly(anomaly: any): void {
    console.warn(`🚨 Streaming anomaly detected: ${anomaly.description}`);
    
    this.emit('streaming_anomaly', {
      anomaly,
      timestamp: Date.now(),
      context: {
        activeTraces: this.activeTraces.size,
        performanceBaselines: Object.fromEntries(this.performanceBaseline),
        adaptiveThresholds: Object.fromEntries(this.adaptiveThresholds)
      }
    });
  }

  // Public API

  getActiveTraces(): string[] {
    return Array.from(this.activeTraces.keys());
  }

  getTraceInfo(traceId: string): TraceStreamInfo | undefined {
    return this.activeTraces.get(traceId);
  }

  getPerformanceBaselines(): Map<string, number> {
    return new Map(this.performanceBaseline);
  }

  getAdaptiveThresholds(): Map<string, AdaptiveThreshold> {
    return new Map(this.adaptiveThresholds);
  }

  getCoordinationState(): Map<string, CoordinationInfo> {
    return new Map(this.coordinationState);
  }

  async shutdown(): Promise<void> {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }

    // Complete all active traces
    for (const [traceId, traceInfo] of this.activeTraces) {
      await this.completeTrace(traceId, { status: 'interrupted_by_shutdown' });
    }

    this.emit('shutdown');
  }
}

interface TraceStreamInfo {
  traceId: string;
  startTime: number;
  context: any;
  updateCount: number;
  lastUpdate: number;
  performanceHistory: PerformanceSnapshot[];
  coordinationHistory: CoordinationInfo[];
}

export { TraceStreamInfo };