/**
 * Langfuse Flush Monitoring and Alerting System
 * Provides real-time monitoring, metrics, and alerting for flush operations
 */

import { EventEmitter } from 'events';

// Types for monitoring
interface FlushMetrics {
  totalFlushes: number;
  successfulFlushes: number;
  failedFlushes: number;
  totalTraces: number;
  deliveredTraces: number;
  averageFlushTime: number;
  averageBatchSize: number;
  currentBufferSize: number;
  lastFlushTime: number;
  operationsPerMinute: number;
  errorRate: number;
  retryRate: number;
  throughput: number;
  latency: {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  };
}

interface Alert {
  id: string;
  timestamp: number;
  severity: 'info' | 'warning' | 'error' | 'critical';
  type: string;
  message: string;
  metrics: Record<string, number>;
  acknowledged: boolean;
  resolved: boolean;
  resolvedAt?: number;
}

interface MonitoringConfig {
  alertThresholds: {
    errorRate: number;
    latency: number;
    bufferSize: number;
    retryRate: number;
    throughput: number;
  };
  metricsRetentionDays: number;
  alertRetentionDays: number;
  enableRealTimeAlerts: boolean;
  enableMetricsCollection: boolean;
  enablePerformanceTracking: boolean;
}

interface PerformanceSnapshot {
  timestamp: number;
  metrics: FlushMetrics;
  systemHealth: {
    memoryUsage: number;
    cpuUsage: number;
    networkLatency: number;
    diskSpace: number;
  };
  operationalStatus: {
    circuitBreakerOpen: boolean;
    bufferHealthy: boolean;
    flushSystemHealthy: boolean;
    errorHandlerHealthy: boolean;
  };
}

/**
 * Comprehensive monitoring system for Langfuse flush operations
 */
export class LangfuseFlushMonitor extends EventEmitter {
  private config: MonitoringConfig;
  private metrics: FlushMetrics;
  private alerts: Alert[] = [];
  private performanceHistory: PerformanceSnapshot[] = [];
  private latencyHistory: number[] = [];
  private throughputHistory: number[] = [];
  private monitoringTimer: NodeJS.Timeout | null = null;
  private alertTimer: NodeJS.Timeout | null = null;
  private isMonitoring: boolean = false;

  constructor(config?: Partial<MonitoringConfig>) {
    super();
    
    this.config = {
      alertThresholds: {
        errorRate: config?.alertThresholds?.errorRate || 10, // 10%
        latency: config?.alertThresholds?.latency || 5000, // 5 seconds
        bufferSize: config?.alertThresholds?.bufferSize || 1000, // 1000 entries
        retryRate: config?.alertThresholds?.retryRate || 30, // 30%
        throughput: config?.alertThresholds?.throughput || 10, // 10 ops/min
      },
      metricsRetentionDays: config?.metricsRetentionDays || 7,
      alertRetentionDays: config?.alertRetentionDays || 30,
      enableRealTimeAlerts: config?.enableRealTimeAlerts !== false,
      enableMetricsCollection: config?.enableMetricsCollection !== false,
      enablePerformanceTracking: config?.enablePerformanceTracking !== false,
    };

    this.metrics = {
      totalFlushes: 0,
      successfulFlushes: 0,
      failedFlushes: 0,
      totalTraces: 0,
      deliveredTraces: 0,
      averageFlushTime: 0,
      averageBatchSize: 0,
      currentBufferSize: 0,
      lastFlushTime: 0,
      operationsPerMinute: 0,
      errorRate: 0,
      retryRate: 0,
      throughput: 0,
      latency: { p50: 0, p90: 0, p95: 0, p99: 0 },
    };

    this.startMonitoring();
  }

  /**
   * Record flush operation metrics
   */
  public recordFlushOperation(operation: {
    success: boolean;
    duration: number;
    traceCount: number;
    retryCount: number;
    batchSize: number;
    bufferSize: number;
    error?: Error;
  }): void {
    if (!this.config.enableMetricsCollection) return;

    const now = Date.now();
    
    // Update basic metrics
    this.metrics.totalFlushes++;
    this.metrics.totalTraces += operation.traceCount;
    this.metrics.lastFlushTime = now;
    
    if (operation.success) {
      this.metrics.successfulFlushes++;
      this.metrics.deliveredTraces += operation.traceCount;
      
      // Record latency
      this.latencyHistory.push(operation.duration);
      if (this.latencyHistory.length > 1000) {
        this.latencyHistory.shift();
      }
      
      // Update average flush time
      this.metrics.averageFlushTime = 
        (this.metrics.averageFlushTime * (this.metrics.successfulFlushes - 1) + operation.duration) / 
        this.metrics.successfulFlushes;
    } else {
      this.metrics.failedFlushes++;
    }

    // Update rates
    this.metrics.errorRate = (this.metrics.failedFlushes / this.metrics.totalFlushes) * 100;
    this.metrics.retryRate = operation.retryCount > 0 ? 
      ((this.metrics.retryRate * (this.metrics.totalFlushes - 1)) + operation.retryCount) / this.metrics.totalFlushes : 
      this.metrics.retryRate;

    // Update averages
    this.metrics.averageBatchSize = 
      (this.metrics.averageBatchSize * (this.metrics.totalFlushes - 1) + operation.batchSize) / 
      this.metrics.totalFlushes;
    
    this.metrics.currentBufferSize = operation.bufferSize;

    // Calculate throughput
    this.calculateThroughput();
    
    // Update latency percentiles
    this.updateLatencyPercentiles();

    // Check for alerts
    this.checkAlerts();

    // Log metrics
    this.logMetrics(operation);

    // Emit metrics update
    this.emit('metrics-updated', {
      timestamp: now,
      metrics: { ...this.metrics },
      operation,
    });
  }

  /**
   * Get current metrics
   */
  public getMetrics(): FlushMetrics {
    return { ...this.metrics };
  }

  /**
   * Get active alerts
   */
  public getActiveAlerts(): Alert[] {
    return this.alerts.filter(alert => !alert.resolved);
  }

  /**
   * Get alert history
   */
  public getAlertHistory(limit: number = 100): Alert[] {
    return this.alerts
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Acknowledge alert
   */
  public acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      console.log(`✅ Alert ${alertId} acknowledged`);
      this.emit('alert-acknowledged', alert);
      return true;
    }
    return false;
  }

  /**
   * Resolve alert
   */
  public resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolvedAt = Date.now();
      console.log(`✅ Alert ${alertId} resolved`);
      this.emit('alert-resolved', alert);
      return true;
    }
    return false;
  }

  /**
   * Get performance snapshot
   */
  public async getPerformanceSnapshot(): Promise<PerformanceSnapshot> {
    const systemHealth = await this.getSystemHealth();
    const operationalStatus = await this.getOperationalStatus();
    
    const snapshot: PerformanceSnapshot = {
      timestamp: Date.now(),
      metrics: { ...this.metrics },
      systemHealth,
      operationalStatus,
    };

    // Store snapshot
    this.performanceHistory.push(snapshot);
    
    // Limit history size
    const maxHistory = this.config.metricsRetentionDays * 24 * 60; // Minutes in retention period
    if (this.performanceHistory.length > maxHistory) {
      this.performanceHistory.shift();
    }

    return snapshot;
  }

  /**
   * Get performance trends
   */
  public getPerformanceTrends(durationHours: number = 24): {
    trend: 'improving' | 'stable' | 'degrading';
    metrics: {
      errorRate: { current: number; change: number };
      latency: { current: number; change: number };
      throughput: { current: number; change: number };
    };
    recommendations: string[];
  } {
    const now = Date.now();
    const cutoff = now - (durationHours * 60 * 60 * 1000);
    
    const recentSnapshots = this.performanceHistory
      .filter(s => s.timestamp > cutoff)
      .sort((a, b) => a.timestamp - b.timestamp);

    if (recentSnapshots.length < 2) {
      return {
        trend: 'stable',
        metrics: {
          errorRate: { current: this.metrics.errorRate, change: 0 },
          latency: { current: this.metrics.averageFlushTime, change: 0 },
          throughput: { current: this.metrics.throughput, change: 0 },
        },
        recommendations: ['Insufficient data for trend analysis'],
      };
    }

    const first = recentSnapshots[0];
    const last = recentSnapshots[recentSnapshots.length - 1];

    const errorRateChange = last.metrics.errorRate - first.metrics.errorRate;
    const latencyChange = last.metrics.averageFlushTime - first.metrics.averageFlushTime;
    const throughputChange = last.metrics.throughput - first.metrics.throughput;

    // Determine overall trend
    let trend: 'improving' | 'stable' | 'degrading' = 'stable';
    
    const negativeChanges = [
      errorRateChange > 2, // Error rate increased by >2%
      latencyChange > 500, // Latency increased by >500ms
      throughputChange < -5, // Throughput decreased by >5 ops/min
    ].filter(Boolean).length;

    const positiveChanges = [
      errorRateChange < -2, // Error rate decreased by >2%
      latencyChange < -500, // Latency decreased by >500ms
      throughputChange > 5, // Throughput increased by >5 ops/min
    ].filter(Boolean).length;

    if (negativeChanges > positiveChanges) {
      trend = 'degrading';
    } else if (positiveChanges > negativeChanges) {
      trend = 'improving';
    }

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (trend === 'degrading') {
      if (errorRateChange > 0) {
        recommendations.push('Error rate increasing - check error logs');
      }
      if (latencyChange > 0) {
        recommendations.push('Latency increasing - monitor system resources');
      }
      if (throughputChange < 0) {
        recommendations.push('Throughput decreasing - optimize batch sizes');
      }
    } else if (trend === 'improving') {
      recommendations.push('Performance improving - current configuration is optimal');
    }

    return {
      trend,
      metrics: {
        errorRate: { current: this.metrics.errorRate, change: errorRateChange },
        latency: { current: this.metrics.averageFlushTime, change: latencyChange },
        throughput: { current: this.metrics.throughput, change: throughputChange },
      },
      recommendations,
    };
  }

  /**
   * Generate monitoring report
   */
  public generateMonitoringReport(): {
    summary: string;
    metrics: FlushMetrics;
    alerts: { active: number; resolved: number; critical: number };
    performance: { trend: string; health: string };
    recommendations: string[];
  } {
    const activeAlerts = this.getActiveAlerts();
    const resolvedAlerts = this.alerts.filter(a => a.resolved);
    const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical');
    
    const trends = this.getPerformanceTrends();
    const health = this.getSystemHealthScore();
    
    const summary = `Langfuse Flush Monitoring Report
      Total Flushes: ${this.metrics.totalFlushes}
      Success Rate: ${((this.metrics.successfulFlushes / this.metrics.totalFlushes) * 100).toFixed(1)}%
      Average Latency: ${this.metrics.averageFlushTime.toFixed(0)}ms
      Throughput: ${this.metrics.throughput.toFixed(1)} ops/min
      Active Alerts: ${activeAlerts.length}
      Critical Alerts: ${criticalAlerts.length}
      System Health: ${health}`;

    return {
      summary,
      metrics: this.metrics,
      alerts: {
        active: activeAlerts.length,
        resolved: resolvedAlerts.length,
        critical: criticalAlerts.length,
      },
      performance: {
        trend: trends.trend,
        health,
      },
      recommendations: trends.recommendations,
    };
  }

  /**
   * Start real-time monitoring
   */
  public startRealTimeMonitoring(intervalMs: number = 30000): void {
    console.log('🔄 Starting real-time monitoring...');
    
    this.monitoringTimer = setInterval(async () => {
      const snapshot = await this.getPerformanceSnapshot();
      
      this.emit('performance-snapshot', snapshot);
      
      // Log performance summary
      console.log(`📊 Performance Summary:
        Success Rate: ${((this.metrics.successfulFlushes / this.metrics.totalFlushes) * 100).toFixed(1)}%
        Average Latency: ${this.metrics.averageFlushTime.toFixed(0)}ms
        Throughput: ${this.metrics.throughput.toFixed(1)} ops/min
        Buffer Size: ${this.metrics.currentBufferSize}
        Active Alerts: ${this.getActiveAlerts().length}`);
    }, intervalMs);

    this.isMonitoring = true;
  }

  /**
   * Stop monitoring
   */
  public stopMonitoring(): void {
    console.log('🔄 Stopping monitoring...');
    
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }
    
    if (this.alertTimer) {
      clearInterval(this.alertTimer);
      this.alertTimer = null;
    }
    
    this.isMonitoring = false;
  }

  // Private helper methods

  private startMonitoring(): void {
    if (this.config.enableRealTimeAlerts) {
      this.alertTimer = setInterval(() => {
        this.checkAlerts();
      }, 10000); // Check every 10 seconds
    }

    if (this.config.enablePerformanceTracking) {
      this.startRealTimeMonitoring();
    }
  }

  private checkAlerts(): void {
    const now = Date.now();
    
    // Error rate alert
    if (this.metrics.errorRate > this.config.alertThresholds.errorRate) {
      this.createAlert({
        type: 'error-rate',
        severity: this.metrics.errorRate > 50 ? 'critical' : 'error',
        message: `Error rate (${this.metrics.errorRate.toFixed(1)}%) exceeds threshold (${this.config.alertThresholds.errorRate}%)`,
        metrics: { errorRate: this.metrics.errorRate },
      });
    }

    // Latency alert
    if (this.metrics.averageFlushTime > this.config.alertThresholds.latency) {
      this.createAlert({
        type: 'latency',
        severity: this.metrics.averageFlushTime > 10000 ? 'critical' : 'warning',
        message: `Average flush time (${this.metrics.averageFlushTime.toFixed(0)}ms) exceeds threshold (${this.config.alertThresholds.latency}ms)`,
        metrics: { latency: this.metrics.averageFlushTime },
      });
    }

    // Buffer size alert
    if (this.metrics.currentBufferSize > this.config.alertThresholds.bufferSize) {
      this.createAlert({
        type: 'buffer-size',
        severity: this.metrics.currentBufferSize > 2000 ? 'critical' : 'warning',
        message: `Buffer size (${this.metrics.currentBufferSize}) exceeds threshold (${this.config.alertThresholds.bufferSize})`,
        metrics: { bufferSize: this.metrics.currentBufferSize },
      });
    }

    // Throughput alert
    if (this.metrics.throughput < this.config.alertThresholds.throughput) {
      this.createAlert({
        type: 'throughput',
        severity: this.metrics.throughput < 5 ? 'error' : 'warning',
        message: `Throughput (${this.metrics.throughput.toFixed(1)} ops/min) below threshold (${this.config.alertThresholds.throughput} ops/min)`,
        metrics: { throughput: this.metrics.throughput },
      });
    }
  }

  private createAlert(alert: {
    type: string;
    severity: 'info' | 'warning' | 'error' | 'critical';
    message: string;
    metrics: Record<string, number>;
  }): void {
    // Check if similar alert already exists
    const existingAlert = this.alerts.find(a => 
      a.type === alert.type && 
      !a.resolved && 
      Date.now() - a.timestamp < 300000 // 5 minutes
    );

    if (existingAlert) {
      return; // Don't create duplicate alerts
    }

    const newAlert: Alert = {
      id: this.generateAlertId(),
      timestamp: Date.now(),
      severity: alert.severity,
      type: alert.type,
      message: alert.message,
      metrics: alert.metrics,
      acknowledged: false,
      resolved: false,
    };

    this.alerts.push(newAlert);

    // Limit alert history
    const maxAlerts = this.config.alertRetentionDays * 100; // Approximate limit
    if (this.alerts.length > maxAlerts) {
      this.alerts.shift();
    }

    // Log alert
    const prefix = alert.severity === 'critical' ? '🚨' : 
                   alert.severity === 'error' ? '❌' : 
                   alert.severity === 'warning' ? '⚠️' : '🔔';
    
    console.log(`${prefix} ALERT [${alert.severity.toUpperCase()}]: ${alert.message}`);

    // Emit alert
    this.emit('alert-created', newAlert);
  }

  private calculateThroughput(): void {
    // Calculate operations per minute based on recent activity
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // This is a simplified calculation
    // In a real implementation, you'd track operations with timestamps
    this.metrics.operationsPerMinute = Math.max(0, this.metrics.totalFlushes / Math.max(1, (now - (this.metrics.lastFlushTime - 60000)) / 60000));
    this.metrics.throughput = this.metrics.operationsPerMinute;
  }

  private updateLatencyPercentiles(): void {
    if (this.latencyHistory.length === 0) return;

    const sorted = [...this.latencyHistory].sort((a, b) => a - b);
    const len = sorted.length;

    this.metrics.latency.p50 = sorted[Math.floor(len * 0.5)];
    this.metrics.latency.p90 = sorted[Math.floor(len * 0.9)];
    this.metrics.latency.p95 = sorted[Math.floor(len * 0.95)];
    this.metrics.latency.p99 = sorted[Math.floor(len * 0.99)];
  }

  private async getSystemHealth(): Promise<{
    memoryUsage: number;
    cpuUsage: number;
    networkLatency: number;
    diskSpace: number;
  }> {
    // Simple system health check
    const memoryUsage = process.memoryUsage();
    const memoryPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    
    return {
      memoryUsage: memoryPercent,
      cpuUsage: Math.random() * 100, // Mock CPU usage
      networkLatency: Math.random() * 200, // Mock network latency
      diskSpace: Math.random() * 100, // Mock disk space
    };
  }

  private async getOperationalStatus(): Promise<{
    circuitBreakerOpen: boolean;
    bufferHealthy: boolean;
    flushSystemHealthy: boolean;
    errorHandlerHealthy: boolean;
  }> {
    // Check operational status of components
    return {
      circuitBreakerOpen: false, // Would check actual circuit breaker
      bufferHealthy: this.metrics.currentBufferSize < 1000,
      flushSystemHealthy: this.metrics.errorRate < 10,
      errorHandlerHealthy: true,
    };
  }

  private getSystemHealthScore(): string {
    const errorRate = this.metrics.errorRate;
    const latency = this.metrics.averageFlushTime;
    const throughput = this.metrics.throughput;
    
    if (errorRate > 20 || latency > 5000 || throughput < 5) {
      return 'Poor';
    } else if (errorRate > 10 || latency > 2000 || throughput < 10) {
      return 'Fair';
    } else if (errorRate > 5 || latency > 1000 || throughput < 20) {
      return 'Good';
    } else {
      return 'Excellent';
    }
  }

  private logMetrics(operation: any): void {
    console.log(`📊 Flush Metrics Update:
      Operation: ${operation.success ? 'SUCCESS' : 'FAILURE'}
      Duration: ${operation.duration}ms
      Traces: ${operation.traceCount}
      Total Flushes: ${this.metrics.totalFlushes}
      Success Rate: ${((this.metrics.successfulFlushes / this.metrics.totalFlushes) * 100).toFixed(1)}%
      Error Rate: ${this.metrics.errorRate.toFixed(1)}%
      Average Latency: ${this.metrics.averageFlushTime.toFixed(0)}ms
      Throughput: ${this.metrics.throughput.toFixed(1)} ops/min`);
  }

  private generateAlertId(): string {
    return `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const flushMonitor = new LangfuseFlushMonitor();

// Export for testing
export default flushMonitor;