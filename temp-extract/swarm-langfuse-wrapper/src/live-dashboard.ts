/**
 * Live Dashboard for Swarm Coordination Monitoring
 * Provides real-time visualization and monitoring of swarm activities
 */

import { EventEmitter } from 'events';
import { createServer } from 'http';
import { parse } from 'url';
import * as path from 'path';
import * as fs from 'fs';
import { RealTimeObserver } from './real-time-observer';
import { StreamingTraceIntegration } from './streaming-trace-integration';

export interface DashboardConfig {
  port: number;
  refreshIntervalMs: number;
  enableMetricsExport: boolean;
  enableAlerts: boolean;
  theme: 'light' | 'dark' | 'auto';
  maxDataPoints: number;
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
}

export class LiveDashboard extends EventEmitter {
  private server: any;
  private realTimeObserver: RealTimeObserver;
  private streamingIntegration: StreamingTraceIntegration;
  private config: DashboardConfig;
  private metricsHistory: DashboardMetrics[] = [];
  private alerts: Map<string, Alert> = new Map();
  private isRunning = false;
  private metricsTimer?: NodeJS.Timeout;
  private startTime = Date.now();

  constructor(
    realTimeObserver: RealTimeObserver,
    streamingIntegration: StreamingTraceIntegration,
    config: Partial<DashboardConfig> = {}
  ) {
    super();
    
    this.realTimeObserver = realTimeObserver;
    this.streamingIntegration = streamingIntegration;
    
    this.config = {
      port: 3001,
      refreshIntervalMs: 2000,
      enableMetricsExport: true,
      enableAlerts: true,
      theme: 'dark',
      maxDataPoints: 1000,
      ...config
    };

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Listen to real-time observer events
    this.realTimeObserver.on('anomaly', (anomaly) => {
      this.createAlert('critical', 'performance', `Anomaly detected: ${anomaly.description}`, anomaly);
    });

    // Listen to streaming integration events
    this.streamingIntegration.on('streaming_anomaly', (event) => {
      this.createAlert('warning', 'performance', `Streaming anomaly: ${event.anomaly.description}`, event);
    });

    this.streamingIntegration.on('trace_error', (event) => {
      this.createAlert('critical', 'error', `Trace error: ${event.error.message}`, event);
    });
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Live dashboard already running');
      return;
    }

    try {
      this.server = createServer((req, res) => {
        this.handleRequest(req, res);
      });

      await new Promise<void>((resolve, reject) => {
        this.server.listen(this.config.port, (error?: Error) => {
          if (error) reject(error);
          else resolve();
        });
      });

      // Start metrics collection
      this.startMetricsCollection();

      this.isRunning = true;
      console.log(`🎯 Live Dashboard started on http://localhost:${this.config.port}`);
      this.emit('started');

    } catch (error) {
      console.error('Failed to start live dashboard:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    try {
      if (this.metricsTimer) {
        clearInterval(this.metricsTimer);
      }

      if (this.server) {
        await new Promise<void>((resolve) => {
          this.server.close(() => resolve());
        });
      }

      this.isRunning = false;
      console.log('Live dashboard stopped');
      this.emit('stopped');

    } catch (error) {
      console.error('Error stopping live dashboard:', error);
    }
  }

  private startMetricsCollection(): void {
    this.metricsTimer = setInterval(() => {
      this.collectMetrics();
    }, this.config.refreshIntervalMs);

    // Initial collection
    this.collectMetrics();
  }

  private collectMetrics(): void {
    try {
      const metrics: DashboardMetrics = {
        system: this.collectSystemMetrics(),
        swarm: this.collectSwarmMetrics(),
        traces: this.collectTraceMetrics(),
        performance: this.collectPerformanceMetrics(),
        alerts: this.collectAlertMetrics(),
        timestamp: Date.now()
      };

      this.metricsHistory.push(metrics);
      
      // Keep only recent metrics
      if (this.metricsHistory.length > this.config.maxDataPoints) {
        this.metricsHistory = this.metricsHistory.slice(-this.config.maxDataPoints);
      }

      this.emit('metrics_updated', metrics);

    } catch (error) {
      console.error('Failed to collect metrics:', error);
    }
  }

  private collectSystemMetrics(): SystemMetrics {
    const memUsage = process.memoryUsage();
    
    return {
      uptime: Date.now() - this.startTime,
      memoryUsage: memUsage.heapUsed / 1024 / 1024, // MB
      cpuUsage: process.cpuUsage().user / 1000000, // Rough approximation
      connections: this.realTimeObserver.getClientCount(),
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

  private collectAlertMetrics(): AlertMetrics {
    const recentAlerts = Array.from(this.alerts.values())
      .filter(alert => Date.now() - alert.timestamp < 3600000) // Last hour
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10);

    return {
      criticalAlerts: recentAlerts.filter(a => a.severity === 'critical' && !a.resolved).length,
      warningAlerts: recentAlerts.filter(a => a.severity === 'warning' && !a.resolved).length,
      infoAlerts: recentAlerts.filter(a => a.severity === 'info' && !a.resolved).length,
      recentAlerts
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
      // Calculate potential communications (n*(n-1))
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
    const connectionUtilization = Math.min(100, (this.realTimeObserver.getClientCount() / 10) * 100);
    
    return (memUtilization + connectionUtilization) / 2;
  }

  private createAlert(severity: Alert['severity'], category: Alert['category'], message: string, details: any): void {
    if (!this.config.enableAlerts) return;

    const alert: Alert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      severity,
      category,
      message,
      details,
      resolved: false
    };

    this.alerts.set(alert.id, alert);
    this.emit('alert_created', alert);

    // Auto-resolve info alerts after 5 minutes
    if (severity === 'info') {
      setTimeout(() => {
        this.resolveAlert(alert.id);
      }, 300000);
    }

    console.log(`🚨 [${severity.toUpperCase()}] ${category}: ${message}`);
  }

  private resolveAlert(alertId: string): void {
    const alert = this.alerts.get(alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      this.emit('alert_resolved', alert);
    }
  }

  private handleRequest(req: any, res: any): void {
    const urlParts = parse(req.url, true);
    const pathname = urlParts.pathname;

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
        default:
          this.serve404(res);
      }
    } catch (error) {
      console.error('Request handling error:', error);
      this.serveError(res, error);
    }
  }

  private serveDashboard(res: any): void {
    const html = this.generateDashboardHTML();
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  }

  private serveMetrics(res: any): void {
    const latest = this.metricsHistory[this.metricsHistory.length - 1];
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(latest || {}));
  }

  private serveCurrentMetrics(res: any): void {
    this.collectMetrics();
    const latest = this.metricsHistory[this.metricsHistory.length - 1];
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(latest || {}));
  }

  private serveMetricsHistory(res: any): void {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(this.metricsHistory));
  }

  private serveAlerts(res: any): void {
    const alerts = Array.from(this.alerts.values())
      .sort((a, b) => b.timestamp - a.timestamp);
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
      timestamp: Date.now()
    };
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(health));
  }

  private serveExport(res: any): void {
    if (!this.config.enableMetricsExport) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Metrics export disabled' }));
      return;
    }

    const exportData = {
      metrics: this.metricsHistory,
      alerts: Array.from(this.alerts.values()),
      config: this.config,
      timestamp: Date.now(),
      version: '1.0.0'
    };

    res.writeHead(200, { 
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="dashboard-export-${Date.now()}.json"`
    });
    res.end(JSON.stringify(exportData, null, 2));
  }

  private serve404(res: any): void {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }

  private serveError(res: any, error: any): void {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message || 'Internal server error' }));
  }

  private generateDashboardHTML(): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🎯 Swarm Coordination Live Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: ${this.config.theme === 'dark' ? '#0a0a0a' : '#f5f5f5'};
            color: ${this.config.theme === 'dark' ? '#e0e0e0' : '#333'};
            line-height: 1.6;
        }
        
        .dashboard {
            padding: 20px;
            max-width: 1400px;
            margin: 0 auto;
        }
        
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding: 20px;
            background: ${this.config.theme === 'dark' ? '#1a1a1a' : '#fff'};
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        }
        
        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        
        .status-indicator {
            display: inline-block;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            margin-right: 8px;
            animation: pulse 2s infinite;
        }
        
        .status-healthy { background: #4ade80; }
        .status-warning { background: #fbbf24; }
        .status-critical { background: #ef4444; }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .metric-card {
            background: ${this.config.theme === 'dark' ? '#1a1a1a' : '#fff'};
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            border: 1px solid ${this.config.theme === 'dark' ? '#333' : '#e5e7eb'};
        }
        
        .metric-title {
            font-size: 1.1em;
            font-weight: 600;
            margin-bottom: 15px;
            color: ${this.config.theme === 'dark' ? '#a855f7' : '#7c3aed'};
        }
        
        .metric-value {
            font-size: 2.5em;
            font-weight: 700;
            margin-bottom: 5px;
        }
        
        .metric-label {
            font-size: 0.9em;
            opacity: 0.7;
        }
        
        .chart-container {
            background: ${this.config.theme === 'dark' ? '#1a1a1a' : '#fff'};
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            border: 1px solid ${this.config.theme === 'dark' ? '#333' : '#e5e7eb'};
        }
        
        .alert-item {
            background: ${this.config.theme === 'dark' ? '#1a1a1a' : '#fff'};
            border-left: 4px solid;
            padding: 12px;
            margin-bottom: 8px;
            border-radius: 0 8px 8px 0;
        }
        
        .alert-critical { border-left-color: #ef4444; }
        .alert-warning { border-left-color: #fbbf24; }
        .alert-info { border-left-color: #3b82f6; }
        
        .refresh-indicator {
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4ade80;
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 0.9em;
            animation: fadeInOut 1s ease-in-out;
        }
        
        @keyframes fadeInOut {
            0%, 100% { opacity: 0; }
            50% { opacity: 1; }
        }
        
        .data-loading {
            text-align: center;
            padding: 40px;
            opacity: 0.6;
        }
        
        .timestamp {
            font-size: 0.8em;
            opacity: 0.6;
            margin-top: 5px;
        }
    </style>
</head>
<body>
    <div class="dashboard">
        <div class="header">
            <h1>🎯 Swarm Coordination Live Dashboard</h1>
            <div id="status">
                <span class="status-indicator status-healthy"></span>
                <span>System Operational</span>
                <div id="last-update" class="timestamp"></div>
            </div>
        </div>
        
        <div class="metrics-grid" id="metrics-grid">
            <div class="data-loading">Loading metrics...</div>
        </div>
        
        <div class="chart-container">
            <h3 class="metric-title">Performance Trends</h3>
            <div id="performance-chart" class="data-loading">Loading chart...</div>
        </div>
        
        <div class="chart-container">
            <h3 class="metric-title">Recent Alerts</h3>
            <div id="alerts-list" class="data-loading">Loading alerts...</div>
        </div>
    </div>
    
    <script>
        let refreshIndicator = null;
        
        function showRefreshIndicator() {
            if (refreshIndicator) document.body.removeChild(refreshIndicator);
            refreshIndicator = document.createElement('div');
            refreshIndicator.className = 'refresh-indicator';
            refreshIndicator.textContent = '🔄 Refreshing...';
            document.body.appendChild(refreshIndicator);
            setTimeout(() => {
                if (refreshIndicator && document.body.contains(refreshIndicator)) {
                    document.body.removeChild(refreshIndicator);
                }
            }, 1000);
        }
        
        function updateMetrics(data) {
            if (!data) return;
            
            const grid = document.getElementById('metrics-grid');
            const timestamp = new Date(data.timestamp).toLocaleString();
            
            grid.innerHTML = \`
                <div class="metric-card">
                    <div class="metric-title">🏗️ System</div>
                    <div class="metric-value">\${Math.round(data.system.memoryUsage)}MB</div>
                    <div class="metric-label">Memory Usage</div>
                    <div class="timestamp">Uptime: \${Math.round(data.system.uptime/1000/60)}m</div>
                </div>
                
                <div class="metric-card">
                    <div class="metric-title">🐝 Swarms</div>
                    <div class="metric-value">\${data.swarm.activeSwarms}</div>
                    <div class="metric-label">Active Swarms</div>
                    <div class="timestamp">\${data.swarm.totalAgents} agents</div>
                </div>
                
                <div class="metric-card">
                    <div class="metric-title">📊 Traces</div>
                    <div class="metric-value">\${data.traces.activeTraces}</div>
                    <div class="metric-label">Active Traces</div>
                    <div class="timestamp">\${data.traces.totalTraces} total</div>
                </div>
                
                <div class="metric-card">
                    <div class="metric-title">⚡ Performance</div>
                    <div class="metric-value">\${Math.round(data.performance.efficiency)}%</div>
                    <div class="metric-label">Efficiency Score</div>
                    <div class="timestamp">\${Math.round(data.traces.averageLatency)}ms avg latency</div>
                </div>
                
                <div class="metric-card">
                    <div class="metric-title">🔗 Coordination</div>
                    <div class="metric-value">\${Math.round(data.swarm.syncSuccessRate)}%</div>
                    <div class="metric-label">Sync Success Rate</div>
                    <div class="timestamp">\${Math.round(data.swarm.coordinationLatency)}ms latency</div>
                </div>
                
                <div class="metric-card">
                    <div class="metric-title">🚨 Alerts</div>
                    <div class="metric-value">\${data.alerts.criticalAlerts + data.alerts.warningAlerts}</div>
                    <div class="metric-label">Active Alerts</div>
                    <div class="timestamp">\${data.alerts.criticalAlerts} critical</div>
                </div>
            \`;
            
            document.getElementById('last-update').textContent = \`Last updated: \${timestamp}\`;
        }
        
        function updateAlerts(alerts) {
            const alertsList = document.getElementById('alerts-list');
            
            if (!alerts || alerts.length === 0) {
                alertsList.innerHTML = '<div style="text-align: center; opacity: 0.6;">No recent alerts</div>';
                return;
            }
            
            alertsList.innerHTML = alerts.slice(0, 10).map(alert => \`
                <div class="alert-item alert-\${alert.severity}">
                    <strong>[\${alert.severity.toUpperCase()}] \${alert.category}</strong>: \${alert.message}
                    <div class="timestamp">\${new Date(alert.timestamp).toLocaleString()}</div>
                </div>
            \`).join('');
        }
        
        async function refreshData() {
            showRefreshIndicator();
            
            try {
                const [metricsResponse, alertsResponse] = await Promise.all([
                    fetch('/api/metrics/current'),
                    fetch('/api/alerts')
                ]);
                
                const metrics = await metricsResponse.json();
                const alerts = await alertsResponse.json();
                
                updateMetrics(metrics);
                updateAlerts(alerts);
                
            } catch (error) {
                console.error('Failed to refresh data:', error);
                document.getElementById('status').innerHTML = \`
                    <span class="status-indicator status-critical"></span>
                    <span>Connection Error</span>
                \`;
            }
        }
        
        // Initial load
        refreshData();
        
        // Auto-refresh every 2 seconds
        setInterval(refreshData, 2000);
        
        // Manual refresh on click
        document.addEventListener('click', (e) => {
            if (e.target.closest('.header')) {
                refreshData();
            }
        });
    </script>
</body>
</html>`;
  }

  // Public API

  isRunning(): boolean {
    return this.isRunning;
  }

  getMetricsHistory(): DashboardMetrics[] {
    return [...this.metricsHistory];
  }

  getAlerts(): Alert[] {
    return Array.from(this.alerts.values());
  }

  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      this.emit('alert_resolved', alert);
      return true;
    }
    return false;
  }

  clearResolvedAlerts(): number {
    let cleared = 0;
    for (const [id, alert] of this.alerts) {
      if (alert.resolved) {
        this.alerts.delete(id);
        cleared++;
      }
    }
    return cleared;
  }

  exportMetrics(): any {
    return {
      metrics: this.metricsHistory,
      alerts: Array.from(this.alerts.values()),
      config: this.config,
      timestamp: Date.now()
    };
  }
}

export { LiveDashboard };