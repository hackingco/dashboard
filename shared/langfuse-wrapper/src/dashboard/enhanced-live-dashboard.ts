/**
 * Enhanced Live Dashboard for Swarm Coordination Monitoring
 * Features WebSocket streaming, Chart.js visualizations, and advanced alerts
 */

import { EventEmitter } from 'events';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { performance } from 'perf_hooks';
import * as path from 'path';
import * as fs from 'fs';
import { RealTimeObserver } from '../real-time-observer';
import { StreamingTraceIntegration } from '../streaming-trace-integration';
import { DashboardWebSocketHandler } from './websocket/websocket-handler';
import { MetricsAggregator } from './utils/metrics-aggregator';
import { AlertManager } from './components/alert-manager';
import { ChartDataProvider } from './utils/chart-data-provider';

export interface EnhancedDashboardConfig {
  port: number;
  wsPort: number;
  refreshIntervalMs: number;
  enableWebSocket: boolean;
  enableCharts: boolean;
  enableAlerts: boolean;
  enableMobileOptimization: boolean;
  theme: 'light' | 'dark' | 'auto';
  maxDataPoints: number;
  compressionEnabled: boolean;
  rateLimitMs: number;
  alertThresholds: AlertThresholds;
}

export interface AlertThresholds {
  errorRate: number;
  latency: number;
  memoryUsage: number;
  cpuUsage: number;
  tokenThroughput: number;
}

export interface EnhancedMetrics extends DashboardMetrics {
  charts: ChartData;
  deltaUpdates: DeltaUpdate[];
  compressionRatio: number;
}

export interface ChartData {
  performanceTrend: TimeSeriesData[];
  swarmActivity: TimeSeriesData[];
  errorDistribution: PieChartData[];
  latencyHistogram: HistogramData[];
  tokenFlow: TimeSeriesData[];
}

export interface TimeSeriesData {
  timestamp: number;
  value: number;
  label?: string;
}

export interface PieChartData {
  label: string;
  value: number;
  color: string;
}

export interface HistogramData {
  range: string;
  count: number;
}

export interface DeltaUpdate {
  path: string;
  operation: 'add' | 'update' | 'remove';
  value: any;
  timestamp: number;
}

export interface DashboardMetrics {
  system: SystemMetrics;
  swarm: SwarmMetrics;
  traces: TraceMetrics;
  performance: PerformanceMetrics;
  alerts: AlertMetrics;
  timestamp: number;
}

export interface SystemMetrics {
  uptime: number;
  memoryUsage: number;
  cpuUsage: number;
  connections: number;
  version: string;
}

export interface SwarmMetrics {
  activeSwarms: number;
  totalAgents: number;
  coordinationLatency: number;
  syncSuccessRate: number;
  crossAgentCommunication: number;
}

export interface TraceMetrics {
  activeTraces: number;
  totalTraces: number;
  averageLatency: number;
  tokenThroughput: number;
  errorRate: number;
  completionRate: number;
}

export interface PerformanceMetrics {
  efficiency: number;
  throughputScore: number;
  resourceUtilization: number;
  anomalyCount: number;
  adaptiveThresholds: Record<string, number>;
}

export interface AlertMetrics {
  criticalAlerts: number;
  warningAlerts: number;
  infoAlerts: number;
  recentAlerts: Alert[];
}

export interface Alert {
  id: string;
  timestamp: number;
  severity: 'info' | 'warning' | 'critical';
  category: 'performance' | 'coordination' | 'system' | 'error';
  message: string;
  details: any;
  resolved: boolean;
  actions?: AlertAction[];
}

export interface AlertAction {
  id: string;
  label: string;
  action: 'acknowledge' | 'resolve' | 'escalate' | 'custom';
  handler?: (alert: Alert) => void;
}

export class EnhancedLiveDashboard extends EventEmitter {
  private httpServer: any;
  private wsServer: WebSocketServer | null = null;
  private wsHandler: DashboardWebSocketHandler;
  private metricsAggregator: MetricsAggregator;
  private alertManager: AlertManager;
  private chartDataProvider: ChartDataProvider;
  
  private realTimeObserver: RealTimeObserver;
  private streamingIntegration: StreamingTraceIntegration;
  private config: EnhancedDashboardConfig;
  
  private metricsHistory: EnhancedMetrics[] = [];
  private previousMetrics: EnhancedMetrics | null = null;
  private isRunning = false;
  private metricsTimer?: NodeJS.Timeout;
  private startTime = Date.now();
  private rateLimitTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    realTimeObserver: RealTimeObserver,
    streamingIntegration: StreamingTraceIntegration,
    config: Partial<EnhancedDashboardConfig> = {}
  ) {
    super();
    
    this.realTimeObserver = realTimeObserver;
    this.streamingIntegration = streamingIntegration;
    
    this.config = {
      port: 3001,
      wsPort: 3002,
      refreshIntervalMs: 1000,
      enableWebSocket: true,
      enableCharts: true,
      enableAlerts: true,
      enableMobileOptimization: true,
      theme: 'dark',
      maxDataPoints: 1000,
      compressionEnabled: true,
      rateLimitMs: 100,
      alertThresholds: {
        errorRate: 0.05,
        latency: 1000,
        memoryUsage: 80,
        cpuUsage: 80,
        tokenThroughput: 10
      },
      ...config
    };

    // Initialize components
    this.wsHandler = new DashboardWebSocketHandler(this.config);
    this.metricsAggregator = new MetricsAggregator(this.config.maxDataPoints);
    this.alertManager = new AlertManager(this.config.alertThresholds);
    this.chartDataProvider = new ChartDataProvider(this.metricsAggregator);

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Real-time observer events
    this.realTimeObserver.on('anomaly', (anomaly) => {
      const alert = this.alertManager.createAlert(
        'critical',
        'performance',
        `Anomaly detected: ${anomaly.description}`,
        anomaly,
        [
          { id: 'ack', label: 'Acknowledge', action: 'acknowledge' },
          { id: 'escalate', label: 'Escalate', action: 'escalate' }
        ]
      );
      this.broadcastAlert(alert);
    });

    // Streaming integration events
    this.streamingIntegration.on('streaming_anomaly', (event) => {
      const alert = this.alertManager.createAlert(
        'warning',
        'performance',
        `Streaming anomaly: ${event.anomaly.description}`,
        event
      );
      this.broadcastAlert(alert);
    });

    this.streamingIntegration.on('trace_error', (event) => {
      const alert = this.alertManager.createAlert(
        'critical',
        'error',
        `Trace error: ${event.error.message}`,
        event
      );
      this.broadcastAlert(alert);
    });

    // WebSocket handler events
    this.wsHandler.on('client_connected', (clientId: string) => {
      console.log(`Client connected: ${clientId}`);
      this.sendInitialData(clientId);
    });

    this.wsHandler.on('client_message', (clientId: string, message: any) => {
      this.handleClientMessage(clientId, message);
    });

    // Alert manager events
    this.alertManager.on('threshold_exceeded', (threshold) => {
      this.broadcastThresholdAlert(threshold);
    });
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Enhanced live dashboard already running');
      return;
    }

    try {
      // Start HTTP server
      this.httpServer = createServer((req, res) => {
        this.handleHttpRequest(req, res);
      });

      await new Promise<void>((resolve, reject) => {
        this.httpServer.listen(this.config.port, (error?: Error) => {
          if (error) reject(error);
          else resolve();
        });
      });

      // Start WebSocket server if enabled
      if (this.config.enableWebSocket) {
        await this.wsHandler.start(this.config.wsPort);
      }

      // Start metrics collection
      this.startMetricsCollection();

      this.isRunning = true;
      console.log(`🚀 Enhanced Live Dashboard started:`);
      console.log(`   📊 HTTP: http://localhost:${this.config.port}`);
      if (this.config.enableWebSocket) {
        console.log(`   🔌 WebSocket: ws://localhost:${this.config.wsPort}`);
      }
      this.emit('started');

    } catch (error) {
      console.error('Failed to start enhanced live dashboard:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    try {
      if (this.metricsTimer) {
        clearInterval(this.metricsTimer);
      }

      // Clear rate limit timers
      for (const timer of this.rateLimitTimers.values()) {
        clearTimeout(timer);
      }
      this.rateLimitTimers.clear();

      if (this.wsHandler) {
        await this.wsHandler.stop();
      }

      if (this.httpServer) {
        await new Promise<void>((resolve) => {
          this.httpServer.close(() => resolve());
        });
      }

      this.isRunning = false;
      console.log('Enhanced live dashboard stopped');
      this.emit('stopped');

    } catch (error) {
      console.error('Error stopping enhanced live dashboard:', error);
    }
  }

  private startMetricsCollection(): void {
    this.metricsTimer = setInterval(() => {
      this.collectAndBroadcastMetrics();
    }, this.config.refreshIntervalMs);

    // Initial collection
    this.collectAndBroadcastMetrics();
  }

  private collectAndBroadcastMetrics(): void {
    try {
      const metrics = this.collectEnhancedMetrics();
      
      // Store metrics
      this.metricsHistory.push(metrics);
      if (this.metricsHistory.length > this.config.maxDataPoints) {
        this.metricsHistory = this.metricsHistory.slice(-this.config.maxDataPoints);
      }

      // Calculate delta updates if compression is enabled
      if (this.config.compressionEnabled && this.previousMetrics) {
        const deltaUpdates = this.calculateDeltaUpdates(this.previousMetrics, metrics);
        metrics.deltaUpdates = deltaUpdates;
        metrics.compressionRatio = this.calculateCompressionRatio(metrics, deltaUpdates);
      }

      // Check alert thresholds
      this.alertManager.checkThresholds(metrics);

      // Broadcast to WebSocket clients
      if (this.config.enableWebSocket) {
        this.broadcastMetrics(metrics);
      }

      this.previousMetrics = metrics;
      this.emit('metrics_updated', metrics);

    } catch (error) {
      console.error('Failed to collect and broadcast metrics:', error);
    }
  }

  private collectEnhancedMetrics(): EnhancedMetrics {
    const baseMetrics: DashboardMetrics = {
      system: this.collectSystemMetrics(),
      swarm: this.collectSwarmMetrics(),
      traces: this.collectTraceMetrics(),
      performance: this.collectPerformanceMetrics(),
      alerts: this.alertManager.getAlertMetrics(),
      timestamp: Date.now()
    };

    const chartData = this.chartDataProvider.generateChartData(
      this.metricsHistory,
      baseMetrics
    );

    return {
      ...baseMetrics,
      charts: chartData,
      deltaUpdates: [],
      compressionRatio: 1.0
    };
  }

  private collectSystemMetrics(): SystemMetrics {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      uptime: Date.now() - this.startTime,
      memoryUsage: memUsage.heapUsed / 1024 / 1024, // MB
      cpuUsage: (cpuUsage.user + cpuUsage.system) / 1000000, // Rough approximation
      connections: this.wsHandler ? this.wsHandler.getClientCount() : 0,
      version: process.env.CLAUDE_FLOW_VERSION || '2.0.0'
    };
  }

  private collectSwarmMetrics(): SwarmMetrics {
    const observerMetrics = this.realTimeObserver.getMetrics();
    const coordinationState = this.streamingIntegration.getCoordinationState();
    
    const activeSwarms = new Set(Array.from(coordinationState.keys())).size;
    const totalAgents = observerMetrics.swarmCoordination.activeAgents;
    
    return {
      activeSwarms,
      totalAgents,
      coordinationLatency: observerMetrics.swarmCoordination.coordinationLatency,
      syncSuccessRate: this.calculateSyncSuccessRate(),
      crossAgentCommunication: this.calculateCrossAgentCommunication()
    };
  }

  private collectTraceMetrics(): TraceMetrics {
    const observerMetrics = this.realTimeObserver.getMetrics();
    const activeTraces = this.streamingIntegration.getActiveTraces();
    
    return {
      activeTraces: activeTraces.length,
      totalTraces: observerMetrics.totalTraces,
      averageLatency: observerMetrics.averageLatency,
      tokenThroughput: observerMetrics.tokenThroughput,
      errorRate: observerMetrics.errorRate,
      completionRate: this.calculateCompletionRate()
    };
  }

  private collectPerformanceMetrics(): PerformanceMetrics {
    const observerMetrics = this.realTimeObserver.getMetrics();
    const adaptiveThresholds = this.streamingIntegration.getAdaptiveThresholds();
    
    const thresholdValues: Record<string, number> = {};
    for (const [key, threshold] of adaptiveThresholds) {
      thresholdValues[key] = threshold.currentThreshold;
    }
    
    return {
      efficiency: this.calculateOverallEfficiency(),
      throughputScore: this.calculateThroughputScore(),
      resourceUtilization: this.calculateResourceUtilization(),
      anomalyCount: observerMetrics.anomalyCount,
      adaptiveThresholds: thresholdValues
    };
  }

  private calculateSyncSuccessRate(): number {
    const coordinationState = this.streamingIntegration.getCoordinationState();
    const synced = Array.from(coordinationState.values()).filter(s => s.syncStatus === 'synced').length;
    const total = coordinationState.size;
    return total > 0 ? (synced / total) * 100 : 100;
  }

  private calculateCrossAgentCommunication(): number {
    const recentObservations = this.realTimeObserver.getRecentObservations(100);
    const swarmGroups = new Map<string, Set<string>>();
    
    for (const obs of recentObservations) {
      if (obs.swarmId && obs.agentId) {
        if (!swarmGroups.has(obs.swarmId)) {
          swarmGroups.set(obs.swarmId, new Set());
        }
        swarmGroups.get(obs.swarmId)!.add(obs.agentId);
      }
    }
    
    let totalCommunications = 0;
    for (const agents of swarmGroups.values()) {
      const n = agents.size;
      totalCommunications += n * (n - 1);
    }
    
    return totalCommunications;
  }

  private calculateCompletionRate(): number {
    const recentObservations = this.realTimeObserver.getRecentObservations(200);
    const started = recentObservations.filter(obs => obs.type === 'trace_start').length;
    const completed = recentObservations.filter(obs => obs.type === 'trace_complete').length;
    return started > 0 ? (completed / started) * 100 : 100;
  }

  private calculateOverallEfficiency(): number {
    const observerMetrics = this.realTimeObserver.getMetrics();
    const tokenEfficiency = observerMetrics.tokenThroughput > 0 ? Math.min(100, observerMetrics.tokenThroughput) : 0;
    const latencyEfficiency = observerMetrics.averageLatency > 0 ? Math.max(0, 100 - (observerMetrics.averageLatency / 10)) : 100;
    const errorEfficiency = Math.max(0, 100 - (observerMetrics.errorRate * 100));
    
    return (tokenEfficiency + latencyEfficiency + errorEfficiency) / 3;
  }

  private calculateThroughputScore(): number {
    const observerMetrics = this.realTimeObserver.getMetrics();
    const baseScore = Math.min(100, observerMetrics.tokenThroughput);
    const latencyPenalty = Math.min(50, observerMetrics.averageLatency / 10);
    const errorPenalty = Math.min(30, observerMetrics.errorRate * 100);
    
    return Math.max(0, baseScore - latencyPenalty - errorPenalty);
  }

  private calculateResourceUtilization(): number {
    const memUsage = process.memoryUsage();
    const memUtilization = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    const connectionUtilization = Math.min(100, (this.wsHandler.getClientCount() / 10) * 100);
    
    return (memUtilization + connectionUtilization) / 2;
  }

  private calculateDeltaUpdates(previous: EnhancedMetrics, current: EnhancedMetrics): DeltaUpdate[] {
    const updates: DeltaUpdate[] = [];
    const timestamp = Date.now();

    // Compare and generate delta updates
    const compareObjects = (prevObj: any, currObj: any, path: string) => {
      for (const key in currObj) {
        const newPath = path ? `${path}.${key}` : key;
        if (typeof currObj[key] === 'object' && currObj[key] !== null) {
          if (prevObj && prevObj[key]) {
            compareObjects(prevObj[key], currObj[key], newPath);
          } else {
            updates.push({
              path: newPath,
              operation: 'add',
              value: currObj[key],
              timestamp
            });
          }
        } else if (!prevObj || prevObj[key] !== currObj[key]) {
          updates.push({
            path: newPath,
            operation: prevObj && prevObj.hasOwnProperty(key) ? 'update' : 'add',
            value: currObj[key],
            timestamp
          });
        }
      }
    };

    compareObjects(previous, current, '');
    return updates;
  }

  private calculateCompressionRatio(full: EnhancedMetrics, delta: DeltaUpdate[]): number {
    const fullSize = JSON.stringify(full).length;
    const deltaSize = JSON.stringify(delta).length;
    return deltaSize > 0 ? fullSize / deltaSize : 1;
  }

  private broadcastMetrics(metrics: EnhancedMetrics): void {
    if (!this.applyRateLimit('metrics')) return;

    const message = {
      type: 'metrics_update',
      data: this.config.compressionEnabled && metrics.deltaUpdates.length > 0
        ? { delta: metrics.deltaUpdates, compressionRatio: metrics.compressionRatio }
        : metrics,
      timestamp: Date.now()
    };

    this.wsHandler.broadcast(message);
  }

  private broadcastAlert(alert: Alert): void {
    const message = {
      type: 'alert',
      data: alert,
      timestamp: Date.now()
    };

    this.wsHandler.broadcast(message);
  }

  private broadcastThresholdAlert(threshold: any): void {
    const alert = this.alertManager.createAlert(
      'warning',
      'system',
      `Threshold exceeded: ${threshold.metric}`,
      threshold
    );
    this.broadcastAlert(alert);
  }

  private applyRateLimit(key: string): boolean {
    if (!this.config.rateLimitMs) return true;

    if (this.rateLimitTimers.has(key)) {
      return false;
    }

    this.rateLimitTimers.set(key, setTimeout(() => {
      this.rateLimitTimers.delete(key);
    }, this.config.rateLimitMs));

    return true;
  }

  private sendInitialData(clientId: string): void {
    const initialData = {
      type: 'initial_data',
      data: {
        config: {
          theme: this.config.theme,
          enableCharts: this.config.enableCharts,
          enableAlerts: this.config.enableAlerts,
          refreshInterval: this.config.refreshIntervalMs
        },
        currentMetrics: this.metricsHistory[this.metricsHistory.length - 1] || null,
        recentMetrics: this.metricsHistory.slice(-50),
        alerts: this.alertManager.getActiveAlerts()
      },
      timestamp: Date.now()
    };

    this.wsHandler.sendToClient(clientId, initialData);
  }

  private handleClientMessage(clientId: string, message: any): void {
    switch (message.type) {
      case 'alert_action':
        this.handleAlertAction(clientId, message.data);
        break;
      case 'request_metrics':
        this.sendMetricsToClient(clientId, message.data);
        break;
      case 'update_config':
        this.handleConfigUpdate(clientId, message.data);
        break;
      case 'subscribe':
        this.handleSubscription(clientId, message.data);
        break;
      default:
        console.warn(`Unknown client message type: ${message.type}`);
    }
  }

  private handleAlertAction(clientId: string, data: any): void {
    const { alertId, action } = data;
    const result = this.alertManager.handleAlertAction(alertId, action);
    
    this.wsHandler.sendToClient(clientId, {
      type: 'alert_action_result',
      data: { alertId, action, success: result },
      timestamp: Date.now()
    });
  }

  private sendMetricsToClient(clientId: string, data: any): void {
    const { range, type } = data;
    let metrics;

    switch (type) {
      case 'current':
        metrics = this.metricsHistory[this.metricsHistory.length - 1];
        break;
      case 'history':
        const count = range || 100;
        metrics = this.metricsHistory.slice(-count);
        break;
      case 'export':
        metrics = this.exportMetrics();
        break;
      default:
        metrics = null;
    }

    this.wsHandler.sendToClient(clientId, {
      type: 'metrics_response',
      data: metrics,
      timestamp: Date.now()
    });
  }

  private handleConfigUpdate(clientId: string, data: any): void {
    // Update configuration dynamically
    if (data.theme && ['light', 'dark', 'auto'].includes(data.theme)) {
      this.config.theme = data.theme;
    }

    if (data.refreshInterval && data.refreshInterval >= 100) {
      this.config.refreshIntervalMs = data.refreshInterval;
      // Restart metrics collection with new interval
      if (this.metricsTimer) {
        clearInterval(this.metricsTimer);
        this.startMetricsCollection();
      }
    }

    this.wsHandler.sendToClient(clientId, {
      type: 'config_updated',
      data: { success: true, config: this.config },
      timestamp: Date.now()
    });
  }

  private handleSubscription(clientId: string, data: any): void {
    // Handle specific metric subscriptions
    const { metrics, interval } = data;
    
    // Implementation would handle custom subscriptions
    this.wsHandler.sendToClient(clientId, {
      type: 'subscription_confirmed',
      data: { metrics, interval },
      timestamp: Date.now()
    });
  }

  private handleHttpRequest(req: any, res: any): void {
    const url = new URL(req.url, `http://localhost:${this.config.port}`);
    const pathname = url.pathname;

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      switch (pathname) {
        case '/':
          this.serveDashboard(res);
          break;
        case '/api/metrics':
          this.serveMetrics(res);
          break;
        case '/api/metrics/current':
          this.serveCurrentMetrics(res);
          break;
        case '/api/metrics/history':
          this.serveMetricsHistory(res);
          break;
        case '/api/alerts':
          this.serveAlerts(res);
          break;
        case '/api/swarms':
          this.serveSwarmData(res);
          break;
        case '/api/traces':
          this.serveTraceData(res);
          break;
        case '/api/health':
          this.serveHealth(res);
          break;
        case '/api/export':
          this.serveExport(res);
          break;
        case '/api/ws-config':
          this.serveWebSocketConfig(res);
          break;
        default:
          this.serve404(res);
      }
    } catch (error) {
      console.error('Request handling error:', error);
      this.serveError(res, error);
    }
  }

  private serveDashboard(res: any): void {
    const html = this.generateEnhancedDashboardHTML();
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  }

  private serveMetrics(res: any): void {
    const latest = this.metricsHistory[this.metricsHistory.length - 1];
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(latest || {}));
  }

  private serveCurrentMetrics(res: any): void {
    this.collectAndBroadcastMetrics();
    const latest = this.metricsHistory[this.metricsHistory.length - 1];
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(latest || {}));
  }

  private serveMetricsHistory(res: any): void {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(this.metricsHistory));
  }

  private serveAlerts(res: any): void {
    const alerts = this.alertManager.getAllAlerts();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(alerts));
  }

  private serveSwarmData(res: any): void {
    const coordinationState = this.streamingIntegration.getCoordinationState();
    const swarmData = Array.from(coordinationState.entries()).map(([swarmId, info]) => ({
      swarmId,
      ...info,
      activity: this.realTimeObserver.getSwarmActivity(swarmId, 1)
    }));
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(swarmData));
  }

  private serveTraceData(res: any): void {
    const activeTraces = this.streamingIntegration.getActiveTraces();
    const traceData = activeTraces.map(traceId => ({
      traceId,
      info: this.streamingIntegration.getTraceInfo(traceId),
      observations: this.realTimeObserver.getObservationsForTrace(traceId)
    }));
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(traceData));
  }

  private serveHealth(res: any): void {
    const health = {
      status: 'healthy',
      uptime: Date.now() - this.startTime,
      dashboard: this.isRunning,
      observer: this.realTimeObserver.isRunning(),
      streaming: this.streamingIntegration.getActiveTraces().length >= 0,
      websocket: this.wsHandler ? this.wsHandler.isRunning() : false,
      timestamp: Date.now()
    };
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(health));
  }

  private serveExport(res: any): void {
    const exportData = this.exportMetrics();

    res.writeHead(200, { 
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="dashboard-export-${Date.now()}.json"`
    });
    res.end(JSON.stringify(exportData, null, 2));
  }

  private serveWebSocketConfig(res: any): void {
    const config = {
      enabled: this.config.enableWebSocket,
      port: this.config.wsPort,
      url: `ws://localhost:${this.config.wsPort}`
    };
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(config));
  }

  private serve404(res: any): void {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }

  private serveError(res: any, error: any): void {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message || 'Internal server error' }));
  }

  private generateEnhancedDashboardHTML(): string {
    // This would be moved to a separate template file in production
    const dashboardTemplate = fs.readFileSync(
      path.join(__dirname, 'assets', 'dashboard-template.html'),
      'utf-8'
    );

    // Replace template variables
    return dashboardTemplate
      .replace(/{{THEME}}/g, this.config.theme)
      .replace(/{{WS_PORT}}/g, this.config.wsPort.toString())
      .replace(/{{ENABLE_CHARTS}}/g, this.config.enableCharts.toString())
      .replace(/{{ENABLE_MOBILE}}/g, this.config.enableMobileOptimization.toString());
  }

  // Public API

  isRunning(): boolean {
    return this.isRunning;
  }

  getMetricsHistory(): EnhancedMetrics[] {
    return [...this.metricsHistory];
  }

  getAlerts(): Alert[] {
    return this.alertManager.getAllAlerts();
  }

  resolveAlert(alertId: string): boolean {
    return this.alertManager.resolveAlert(alertId);
  }

  clearResolvedAlerts(): number {
    return this.alertManager.clearResolvedAlerts();
  }

  exportMetrics(): any {
    return {
      metrics: this.metricsHistory,
      alerts: this.alertManager.getAllAlerts(),
      config: this.config,
      timestamp: Date.now(),
      version: '2.0.0'
    };
  }

  updateConfig(updates: Partial<EnhancedDashboardConfig>): void {
    this.config = { ...this.config, ...updates };
    this.emit('config_updated', this.config);
  }
}

export { EnhancedLiveDashboard };