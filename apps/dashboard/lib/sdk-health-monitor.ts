/**
 * Advanced SDK Health Monitoring System
 * Real-time monitoring, alerting, and performance tracking for Langfuse SDK
 */

import { EventEmitter } from 'events';
import { sdkConfig, type SDKHealthStatus, type PerformanceMetrics } from './sdk-config';

// Health Alert Types
export interface HealthAlert {
  id: string;
  type: 'error' | 'warning' | 'info';
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  timestamp: Date;
  resolved: boolean;
  metadata: Record<string, any>;
}

// Health Trends
export interface HealthTrend {
  metric: string;
  period: '1h' | '24h' | '7d';
  values: number[];
  trend: 'increasing' | 'decreasing' | 'stable';
  change: number;
}

// Health Dashboard Data
export interface HealthDashboard {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  alerts: HealthAlert[];
  trends: HealthTrend[];
  metrics: {
    responseTime: number;
    throughput: number;
    errorRate: number;
    availability: number;
  };
  components: {
    api: 'healthy' | 'degraded' | 'unhealthy';
    websocket: 'healthy' | 'degraded' | 'unhealthy';
    authentication: 'healthy' | 'degraded' | 'unhealthy';
    database: 'healthy' | 'degraded' | 'unhealthy';
  };
}

/**
 * Advanced Health Monitoring System
 * Provides comprehensive monitoring, alerting, and performance tracking
 */
export class SDKHealthMonitor extends EventEmitter {
  private isMonitoring: boolean = false;
  private alerts: HealthAlert[] = [];
  private healthHistory: SDKHealthStatus[] = [];
  private performanceHistory: PerformanceMetrics[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private alertThresholds: Map<string, number> = new Map();
  private uptimeStart: Date = new Date();

  constructor() {
    super();
    this.initializeThresholds();
    this.setupConfigListeners();
  }

  /**
   * Initialize alert thresholds
   */
  private initializeThresholds(): void {
    this.alertThresholds.set('response_time_critical', 10000); // 10s
    this.alertThresholds.set('response_time_warning', 5000); // 5s
    this.alertThresholds.set('error_rate_critical', 25); // 25%
    this.alertThresholds.set('error_rate_warning', 10); // 10%
    this.alertThresholds.set('throughput_critical', 10); // 10 req/min
    this.alertThresholds.set('throughput_warning', 25); // 25 req/min
    this.alertThresholds.set('availability_critical', 95); // 95%
    this.alertThresholds.set('availability_warning', 99); // 99%
  }

  /**
   * Setup configuration listeners
   */
  private setupConfigListeners(): void {
    sdkConfig.on('health-status', (status: SDKHealthStatus) => {
      this.processHealthStatus(status);
    });

    sdkConfig.on('performance-metrics', (metrics: PerformanceMetrics) => {
      this.processPerformanceMetrics(metrics);
    });

    sdkConfig.on('environment-changed', () => {
      this.resetMonitoring();
    });
  }

  /**
   * Start health monitoring
   */
  public startMonitoring(): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.uptimeStart = new Date();
    
    // Start SDK health checks
    sdkConfig.startHealthChecks();

    // Start advanced monitoring
    this.monitoringInterval = setInterval(() => {
      this.performAdvancedChecks();
    }, 30000); // Every 30 seconds

    this.emit('monitoring-started');
  }

  /**
   * Stop health monitoring
   */
  public stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    
    // Stop SDK health checks
    sdkConfig.stopHealthChecks();

    // Stop advanced monitoring
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.emit('monitoring-stopped');
  }

  /**
   * Reset monitoring state
   */
  private resetMonitoring(): void {
    this.alerts = [];
    this.healthHistory = [];
    this.performanceHistory = [];
    this.uptimeStart = new Date();
  }

  /**
   * Process health status updates
   */
  private processHealthStatus(status: SDKHealthStatus): void {
    // Add to history
    this.healthHistory.push(status);
    
    // Keep only last 100 entries
    if (this.healthHistory.length > 100) {
      this.healthHistory = this.healthHistory.slice(-100);
    }

    // Generate alerts based on status
    this.generateHealthAlerts(status);

    // Emit health update
    this.emit('health-updated', status);
  }

  /**
   * Process performance metrics updates
   */
  private processPerformanceMetrics(metrics: PerformanceMetrics): void {
    // Add to history
    this.performanceHistory.push(metrics);
    
    // Keep only last 1000 entries
    if (this.performanceHistory.length > 1000) {
      this.performanceHistory = this.performanceHistory.slice(-1000);
    }

    // Generate performance alerts
    this.generatePerformanceAlerts(metrics);

    // Emit metrics update
    this.emit('metrics-updated', metrics);
  }

  /**
   * Generate health alerts
   */
  private generateHealthAlerts(status: SDKHealthStatus): void {
    // Critical alerts
    if (status.status === 'unhealthy') {
      this.createAlert({
        type: 'error',
        severity: 'critical',
        message: `SDK is unhealthy: ${status.errors.join(', ')}`,
        metadata: { errors: status.errors, responseTime: status.responseTime },
      });
    }

    // Response time alerts
    const responseTimeWarning = this.alertThresholds.get('response_time_warning')!;
    const responseTimeCritical = this.alertThresholds.get('response_time_critical')!;
    
    if (status.responseTime > responseTimeCritical) {
      this.createAlert({
        type: 'error',
        severity: 'critical',
        message: `Critical response time: ${status.responseTime}ms`,
        metadata: { responseTime: status.responseTime, threshold: responseTimeCritical },
      });
    } else if (status.responseTime > responseTimeWarning) {
      this.createAlert({
        type: 'warning',
        severity: 'high',
        message: `High response time: ${status.responseTime}ms`,
        metadata: { responseTime: status.responseTime, threshold: responseTimeWarning },
      });
    }

    // Error rate alerts
    const errorRateWarning = this.alertThresholds.get('error_rate_warning')!;
    const errorRateCritical = this.alertThresholds.get('error_rate_critical')!;
    
    const errorRate = status.metrics.totalRequests > 0 ? 
      (status.metrics.failedRequests / status.metrics.totalRequests) * 100 : 0;

    if (errorRate > errorRateCritical) {
      this.createAlert({
        type: 'error',
        severity: 'critical',
        message: `Critical error rate: ${errorRate.toFixed(1)}%`,
        metadata: { errorRate, threshold: errorRateCritical },
      });
    } else if (errorRate > errorRateWarning) {
      this.createAlert({
        type: 'warning',
        severity: 'high',
        message: `High error rate: ${errorRate.toFixed(1)}%`,
        metadata: { errorRate, threshold: errorRateWarning },
      });
    }

    // Warning alerts
    if (status.warnings.length > 0) {
      this.createAlert({
        type: 'warning',
        severity: 'medium',
        message: `SDK warnings: ${status.warnings.join(', ')}`,
        metadata: { warnings: status.warnings },
      });
    }
  }

  /**
   * Generate performance alerts
   */
  private generatePerformanceAlerts(metrics: PerformanceMetrics): void {
    // Throughput alerts
    const throughputWarning = this.alertThresholds.get('throughput_warning')!;
    const throughputCritical = this.alertThresholds.get('throughput_critical')!;
    
    if (metrics.throughput < throughputCritical) {
      this.createAlert({
        type: 'error',
        severity: 'critical',
        message: `Critical low throughput: ${metrics.throughput} req/min`,
        metadata: { throughput: metrics.throughput, threshold: throughputCritical },
      });
    } else if (metrics.throughput < throughputWarning) {
      this.createAlert({
        type: 'warning',
        severity: 'high',
        message: `Low throughput: ${metrics.throughput} req/min`,
        metadata: { throughput: metrics.throughput, threshold: throughputWarning },
      });
    }

    // Memory usage alerts
    if (metrics.memoryUsage > 90) {
      this.createAlert({
        type: 'error',
        severity: 'high',
        message: `High memory usage: ${metrics.memoryUsage.toFixed(1)}%`,
        metadata: { memoryUsage: metrics.memoryUsage },
      });
    } else if (metrics.memoryUsage > 80) {
      this.createAlert({
        type: 'warning',
        severity: 'medium',
        message: `Elevated memory usage: ${metrics.memoryUsage.toFixed(1)}%`,
        metadata: { memoryUsage: metrics.memoryUsage },
      });
    }

    // CPU usage alerts
    if (metrics.cpuUsage > 80) {
      this.createAlert({
        type: 'error',
        severity: 'high',
        message: `High CPU usage: ${metrics.cpuUsage.toFixed(1)}%`,
        metadata: { cpuUsage: metrics.cpuUsage },
      });
    } else if (metrics.cpuUsage > 70) {
      this.createAlert({
        type: 'warning',
        severity: 'medium',
        message: `Elevated CPU usage: ${metrics.cpuUsage.toFixed(1)}%`,
        metadata: { cpuUsage: metrics.cpuUsage },
      });
    }

    // Cache hit rate alerts
    if (metrics.cacheHitRate < 50) {
      this.createAlert({
        type: 'warning',
        severity: 'medium',
        message: `Low cache hit rate: ${metrics.cacheHitRate.toFixed(1)}%`,
        metadata: { cacheHitRate: metrics.cacheHitRate },
      });
    }
  }

  /**
   * Create an alert
   */
  private createAlert(alert: Omit<HealthAlert, 'id' | 'timestamp' | 'resolved'>): void {
    const fullAlert: HealthAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      resolved: false,
      ...alert,
    };

    this.alerts.push(fullAlert);
    
    // Keep only last 1000 alerts
    if (this.alerts.length > 1000) {
      this.alerts = this.alerts.slice(-1000);
    }

    this.emit('alert-created', fullAlert);
  }

  /**
   * Perform advanced health checks
   */
  private async performAdvancedChecks(): Promise<void> {
    try {
      // Check component health
      const components = await this.checkComponentHealth();
      
      // Calculate availability
      const availability = this.calculateAvailability();
      
      // Check for trends
      const trends = this.calculateTrends();
      
      // Emit advanced health data
      this.emit('advanced-health', {
        components,
        availability,
        trends,
        timestamp: new Date(),
      });

    } catch (error) {
      this.createAlert({
        type: 'error',
        severity: 'high',
        message: `Advanced health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' },
      });
    }
  }

  /**
   * Check individual component health
   */
  private async checkComponentHealth(): Promise<HealthDashboard['components']> {
    const config = sdkConfig.getCurrentConfig();
    
    const components: HealthDashboard['components'] = {
      api: 'healthy',
      websocket: 'healthy',
      authentication: 'healthy',
      database: 'healthy',
    };

    try {
      // Check API health
      const apiResponse = await fetch(`${config.baseUrl}/api/health`, {
        method: 'GET',
        timeout: 10000,
      });
      
      if (!apiResponse.ok) {
        components.api = apiResponse.status >= 500 ? 'unhealthy' : 'degraded';
      }

      // Check authentication
      if (config.publicKey && config.secretKey) {
        const authResponse = await fetch(`${config.baseUrl}/api/public/traces`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${config.publicKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        });

        if (authResponse.status === 401) {
          components.authentication = 'unhealthy';
        } else if (!authResponse.ok && authResponse.status >= 500) {
          components.authentication = 'degraded';
        }
      }

      // Check WebSocket (if enabled)
      if (config.enableRealtime && config.wsEndpoint) {
        // WebSocket health check would go here
        // For now, assume healthy if configuration is present
        components.websocket = 'healthy';
      }

      // Check database (through API)
      // Database health is implied by API health
      components.database = components.api;

    } catch (error) {
      components.api = 'unhealthy';
      components.database = 'unhealthy';
    }

    return components;
  }

  /**
   * Calculate availability percentage
   */
  private calculateAvailability(): number {
    if (this.healthHistory.length === 0) {
      return 100;
    }

    const healthyCount = this.healthHistory.filter(h => h.status === 'healthy').length;
    return (healthyCount / this.healthHistory.length) * 100;
  }

  /**
   * Calculate performance trends
   */
  private calculateTrends(): HealthTrend[] {
    if (this.performanceHistory.length < 2) {
      return [];
    }

    const trends: HealthTrend[] = [];
    
    // Response time trend
    const responseTimes = this.performanceHistory.map(m => m.responseTime);
    trends.push(this.calculateTrend('responseTime', responseTimes));

    // Throughput trend
    const throughputs = this.performanceHistory.map(m => m.throughput);
    trends.push(this.calculateTrend('throughput', throughputs));

    // Error rate trend
    const errorRates = this.performanceHistory.map(m => m.errorRate);
    trends.push(this.calculateTrend('errorRate', errorRates));

    return trends;
  }

  /**
   * Calculate trend for a specific metric
   */
  private calculateTrend(metric: string, values: number[]): HealthTrend {
    if (values.length < 2) {
      return {
        metric,
        period: '1h',
        values: [],
        trend: 'stable',
        change: 0,
      };
    }

    const recent = values.slice(-10);
    const older = values.slice(-20, -10);
    
    const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
    const olderAvg = older.length > 0 ? older.reduce((sum, val) => sum + val, 0) / older.length : recentAvg;
    
    const change = ((recentAvg - olderAvg) / olderAvg) * 100;
    
    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (Math.abs(change) > 5) {
      trend = change > 0 ? 'increasing' : 'decreasing';
    }

    return {
      metric,
      period: '1h',
      values: recent,
      trend,
      change,
    };
  }

  /**
   * Get health dashboard data
   */
  public getHealthDashboard(): HealthDashboard {
    const latestHealth = this.healthHistory[this.healthHistory.length - 1];
    const latestMetrics = this.performanceHistory[this.performanceHistory.length - 1];
    
    const availability = this.calculateAvailability();
    const trends = this.calculateTrends();
    
    return {
      overall: latestHealth?.status || 'healthy',
      uptime: Date.now() - this.uptimeStart.getTime(),
      alerts: this.alerts.filter(a => !a.resolved),
      trends,
      metrics: {
        responseTime: latestHealth?.responseTime || 0,
        throughput: latestMetrics?.throughput || 0,
        errorRate: latestMetrics?.errorRate || 0,
        availability,
      },
      components: {
        api: 'healthy',
        websocket: 'healthy',
        authentication: 'healthy',
        database: 'healthy',
      },
    };
  }

  /**
   * Get all alerts
   */
  public getAlerts(): HealthAlert[] {
    return this.alerts;
  }

  /**
   * Resolve an alert
   */
  public resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      this.emit('alert-resolved', alert);
      return true;
    }
    return false;
  }

  /**
   * Get health history
   */
  public getHealthHistory(): SDKHealthStatus[] {
    return this.healthHistory;
  }

  /**
   * Get performance history
   */
  public getPerformanceHistory(): PerformanceMetrics[] {
    return this.performanceHistory;
  }

  /**
   * Set alert threshold
   */
  public setAlertThreshold(metric: string, value: number): void {
    this.alertThresholds.set(metric, value);
  }

  /**
   * Get alert thresholds
   */
  public getAlertThresholds(): Map<string, number> {
    return new Map(this.alertThresholds);
  }
}

// Export singleton instance
export const healthMonitor = new SDKHealthMonitor();

// Export utility functions
export const HealthUtils = {
  /**
   * Format uptime duration
   */
  formatUptime(uptime: number): string {
    const seconds = Math.floor(uptime / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  },

  /**
   * Get health status color
   */
  getHealthColor(status: 'healthy' | 'degraded' | 'unhealthy'): string {
    switch (status) {
      case 'healthy': return '#22c55e';
      case 'degraded': return '#f59e0b';
      case 'unhealthy': return '#ef4444';
      default: return '#6b7280';
    }
  },

  /**
   * Get alert severity color
   */
  getAlertColor(severity: 'critical' | 'high' | 'medium' | 'low'): string {
    switch (severity) {
      case 'critical': return '#dc2626';
      case 'high': return '#ea580c';
      case 'medium': return '#ca8a04';
      case 'low': return '#65a30d';
      default: return '#6b7280';
    }
  },

  /**
   * Format response time
   */
  formatResponseTime(ms: number): string {
    if (ms < 1000) {
      return `${ms.toFixed(0)}ms`;
    } else {
      return `${(ms / 1000).toFixed(1)}s`;
    }
  },

  /**
   * Format percentage
   */
  formatPercentage(value: number): string {
    return `${value.toFixed(1)}%`;
  },
};

export default healthMonitor;