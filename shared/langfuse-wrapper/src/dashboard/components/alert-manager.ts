/**
 * Alert Manager for Enhanced Live Dashboard
 * Handles advanced alerting with severity-based actions and intelligent thresholds
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

export interface Alert {
  id: string;
  timestamp: number;
  severity: 'info' | 'warning' | 'critical';
  category: 'performance' | 'coordination' | 'system' | 'error';
  message: string;
  details: any;
  resolved: boolean;
  acknowledged: boolean;
  escalated: boolean;
  actions?: AlertAction[];
  metadata?: AlertMetadata;
}

export interface AlertAction {
  id: string;
  label: string;
  action: 'acknowledge' | 'resolve' | 'escalate' | 'snooze' | 'custom';
  handler?: (alert: Alert) => void;
  enabled?: boolean;
  cooldown?: number;
}

export interface AlertMetadata {
  source?: string;
  correlationId?: string;
  affectedAgents?: string[];
  affectedSwarms?: string[];
  impactScore?: number;
  suggestedActions?: string[];
  autoResolveTimeout?: number;
}

export interface AlertThresholds {
  errorRate: number;
  latency: number;
  memoryUsage: number;
  cpuUsage: number;
  tokenThroughput: number;
  [key: string]: number;
}

export interface AlertRule {
  id: string;
  name: string;
  condition: (metrics: any) => boolean;
  severity: Alert['severity'];
  category: Alert['category'];
  message: string;
  cooldownMs: number;
  lastTriggered?: number;
  enabled: boolean;
}

export interface AlertStatistics {
  total: number;
  bySeverity: Record<Alert['severity'], number>;
  byCategory: Record<Alert['category'], number>;
  resolved: number;
  acknowledged: number;
  escalated: number;
  avgResolutionTime: number;
  topSources: Array<{ source: string; count: number }>;
}

export class AlertManager extends EventEmitter {
  private alerts: Map<string, Alert> = new Map();
  private rules: Map<string, AlertRule> = new Map();
  private thresholds: AlertThresholds;
  private alertHistory: Alert[] = [];
  private correlationMap: Map<string, Set<string>> = new Map();
  private actionCooldowns: Map<string, number> = new Map();
  private statistics: AlertStatistics;

  constructor(thresholds: AlertThresholds) {
    super();
    this.thresholds = thresholds;
    this.initializeStatistics();
    this.setupDefaultRules();
    this.startMaintenanceTimer();
  }

  private initializeStatistics(): void {
    this.statistics = {
      total: 0,
      bySeverity: { info: 0, warning: 0, critical: 0 },
      byCategory: { performance: 0, coordination: 0, system: 0, error: 0 },
      resolved: 0,
      acknowledged: 0,
      escalated: 0,
      avgResolutionTime: 0,
      topSources: []
    };
  }

  private setupDefaultRules(): void {
    // High Error Rate Rule
    this.addRule({
      id: 'high-error-rate',
      name: 'High Error Rate',
      condition: (metrics) => metrics.traces?.errorRate > this.thresholds.errorRate,
      severity: 'critical',
      category: 'error',
      message: 'Error rate exceeded threshold',
      cooldownMs: 300000, // 5 minutes
      enabled: true
    });

    // High Latency Rule
    this.addRule({
      id: 'high-latency',
      name: 'High Latency',
      condition: (metrics) => metrics.traces?.averageLatency > this.thresholds.latency,
      severity: 'warning',
      category: 'performance',
      message: 'Average latency exceeded threshold',
      cooldownMs: 180000, // 3 minutes
      enabled: true
    });

    // Memory Usage Rule
    this.addRule({
      id: 'high-memory',
      name: 'High Memory Usage',
      condition: (metrics) => metrics.system?.memoryUsage > this.thresholds.memoryUsage,
      severity: 'warning',
      category: 'system',
      message: 'Memory usage exceeded threshold',
      cooldownMs: 600000, // 10 minutes
      enabled: true
    });

    // CPU Usage Rule
    this.addRule({
      id: 'high-cpu',
      name: 'High CPU Usage',
      condition: (metrics) => metrics.system?.cpuUsage > this.thresholds.cpuUsage,
      severity: 'warning',
      category: 'system',
      message: 'CPU usage exceeded threshold',
      cooldownMs: 600000, // 10 minutes
      enabled: true
    });

    // Low Token Throughput Rule
    this.addRule({
      id: 'low-throughput',
      name: 'Low Token Throughput',
      condition: (metrics) => 
        metrics.traces?.tokenThroughput > 0 && 
        metrics.traces?.tokenThroughput < this.thresholds.tokenThroughput,
      severity: 'info',
      category: 'performance',
      message: 'Token throughput below expected levels',
      cooldownMs: 900000, // 15 minutes
      enabled: true
    });

    // Coordination Failure Rule
    this.addRule({
      id: 'coordination-failure',
      name: 'Coordination Failure',
      condition: (metrics) => metrics.swarm?.syncSuccessRate < 50,
      severity: 'critical',
      category: 'coordination',
      message: 'Swarm coordination sync rate critically low',
      cooldownMs: 120000, // 2 minutes
      enabled: true
    });

    // Anomaly Detection Rule
    this.addRule({
      id: 'anomaly-detected',
      name: 'Anomaly Detected',
      condition: (metrics) => metrics.performance?.anomalyCount > 5,
      severity: 'warning',
      category: 'performance',
      message: 'Multiple anomalies detected',
      cooldownMs: 300000, // 5 minutes
      enabled: true
    });
  }

  createAlert(
    severity: Alert['severity'],
    category: Alert['category'],
    message: string,
    details: any,
    actions?: AlertAction[],
    metadata?: AlertMetadata
  ): Alert {
    const alert: Alert = {
      id: uuidv4(),
      timestamp: Date.now(),
      severity,
      category,
      message,
      details,
      resolved: false,
      acknowledged: false,
      escalated: false,
      actions: actions || this.getDefaultActions(severity),
      metadata: metadata || {}
    };

    // Add correlation tracking
    if (metadata?.correlationId) {
      if (!this.correlationMap.has(metadata.correlationId)) {
        this.correlationMap.set(metadata.correlationId, new Set());
      }
      this.correlationMap.get(metadata.correlationId)!.add(alert.id);
    }

    this.alerts.set(alert.id, alert);
    this.alertHistory.push(alert);
    this.updateStatistics('created', alert);

    // Set auto-resolve timeout if specified
    if (metadata?.autoResolveTimeout) {
      setTimeout(() => {
        if (!alert.resolved) {
          this.resolveAlert(alert.id, 'Auto-resolved by timeout');
        }
      }, metadata.autoResolveTimeout);
    }

    this.emit('alert_created', alert);
    return alert;
  }

  private getDefaultActions(severity: Alert['severity']): AlertAction[] {
    const baseActions: AlertAction[] = [
      {
        id: 'acknowledge',
        label: 'Acknowledge',
        action: 'acknowledge',
        enabled: true
      },
      {
        id: 'resolve',
        label: 'Resolve',
        action: 'resolve',
        enabled: true
      }
    ];

    if (severity === 'critical') {
      baseActions.push({
        id: 'escalate',
        label: 'Escalate',
        action: 'escalate',
        enabled: true,
        cooldown: 300000 // 5 minutes
      });
    }

    if (severity !== 'critical') {
      baseActions.push({
        id: 'snooze',
        label: 'Snooze (30m)',
        action: 'snooze',
        enabled: true
      });
    }

    return baseActions;
  }

  checkThresholds(metrics: any): void {
    for (const [ruleId, rule] of this.rules) {
      if (!rule.enabled) continue;

      // Check cooldown
      if (rule.lastTriggered && Date.now() - rule.lastTriggered < rule.cooldownMs) {
        continue;
      }

      try {
        if (rule.condition(metrics)) {
          rule.lastTriggered = Date.now();
          
          const alert = this.createAlert(
            rule.severity,
            rule.category,
            rule.message,
            {
              rule: rule.name,
              metrics: this.extractRelevantMetrics(metrics, rule.category),
              threshold: this.getRelevantThreshold(rule.id)
            },
            undefined,
            {
              source: `rule:${rule.id}`,
              impactScore: this.calculateImpactScore(rule.severity, metrics)
            }
          );

          this.emit('threshold_exceeded', {
            alert,
            rule,
            metrics
          });
        }
      } catch (error) {
        console.error(`Error checking rule ${rule.id}:`, error);
      }
    }
  }

  private extractRelevantMetrics(metrics: any, category: Alert['category']): any {
    switch (category) {
      case 'performance':
        return {
          latency: metrics.traces?.averageLatency,
          throughput: metrics.traces?.tokenThroughput,
          efficiency: metrics.performance?.efficiency
        };
      case 'system':
        return {
          memory: metrics.system?.memoryUsage,
          cpu: metrics.system?.cpuUsage,
          connections: metrics.system?.connections
        };
      case 'coordination':
        return {
          syncRate: metrics.swarm?.syncSuccessRate,
          activeSwarms: metrics.swarm?.activeSwarms,
          agents: metrics.swarm?.totalAgents
        };
      case 'error':
        return {
          errorRate: metrics.traces?.errorRate,
          anomalies: metrics.performance?.anomalyCount
        };
      default:
        return metrics;
    }
  }

  private getRelevantThreshold(ruleId: string): number | undefined {
    const thresholdMap: Record<string, keyof AlertThresholds> = {
      'high-error-rate': 'errorRate',
      'high-latency': 'latency',
      'high-memory': 'memoryUsage',
      'high-cpu': 'cpuUsage',
      'low-throughput': 'tokenThroughput'
    };

    const key = thresholdMap[ruleId];
    return key ? this.thresholds[key] : undefined;
  }

  private calculateImpactScore(severity: Alert['severity'], metrics: any): number {
    let score = 0;

    // Base score by severity
    switch (severity) {
      case 'critical': score = 80; break;
      case 'warning': score = 40; break;
      case 'info': score = 10; break;
    }

    // Adjust based on metrics
    if (metrics.swarm?.activeSwarms > 5) score += 10;
    if (metrics.traces?.errorRate > 0.1) score += 15;
    if (metrics.performance?.efficiency < 50) score += 10;

    return Math.min(100, score);
  }

  handleAlertAction(alertId: string, action: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) return false;

    // Check action cooldown
    const cooldownKey = `${alertId}:${action}`;
    if (this.actionCooldowns.has(cooldownKey)) {
      const cooldownEnd = this.actionCooldowns.get(cooldownKey)!;
      if (Date.now() < cooldownEnd) {
        return false;
      }
    }

    switch (action) {
      case 'acknowledge':
        return this.acknowledgeAlert(alertId);
      case 'resolve':
        return this.resolveAlert(alertId);
      case 'escalate':
        return this.escalateAlert(alertId);
      case 'snooze':
        return this.snoozeAlert(alertId, 1800000); // 30 minutes
      default:
        // Handle custom actions
        const customAction = alert.actions?.find(a => a.id === action);
        if (customAction?.handler) {
          customAction.handler(alert);
          return true;
        }
        return false;
    }
  }

  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert || alert.acknowledged) return false;

    alert.acknowledged = true;
    this.updateStatistics('acknowledged', alert);
    this.emit('alert_acknowledged', alert);
    return true;
  }

  resolveAlert(alertId: string, reason?: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert || alert.resolved) return false;

    alert.resolved = true;
    const resolutionTime = Date.now() - alert.timestamp;
    
    this.updateStatistics('resolved', alert, resolutionTime);
    this.emit('alert_resolved', { alert, reason, resolutionTime });
    
    // Clean up correlation
    if (alert.metadata?.correlationId) {
      const correlated = this.correlationMap.get(alert.metadata.correlationId);
      if (correlated) {
        correlated.delete(alertId);
        if (correlated.size === 0) {
          this.correlationMap.delete(alert.metadata.correlationId);
        }
      }
    }

    return true;
  }

  escalateAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert || alert.escalated) return false;

    alert.escalated = true;
    alert.severity = 'critical'; // Upgrade severity
    
    // Set cooldown
    const action = alert.actions?.find(a => a.action === 'escalate');
    if (action?.cooldown) {
      this.actionCooldowns.set(`${alertId}:escalate`, Date.now() + action.cooldown);
    }

    this.updateStatistics('escalated', alert);
    this.emit('alert_escalated', alert);
    return true;
  }

  snoozeAlert(alertId: string, duration: number): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert || alert.resolved) return false;

    // Temporarily hide alert
    setTimeout(() => {
      if (!alert.resolved) {
        this.emit('alert_unsnoozed', alert);
      }
    }, duration);

    this.emit('alert_snoozed', { alert, duration });
    return true;
  }

  private updateStatistics(action: string, alert: Alert, resolutionTime?: number): void {
    this.statistics.total++;
    this.statistics.bySeverity[alert.severity]++;
    this.statistics.byCategory[alert.category]++;

    switch (action) {
      case 'acknowledged':
        this.statistics.acknowledged++;
        break;
      case 'resolved':
        this.statistics.resolved++;
        if (resolutionTime) {
          // Update average resolution time
          const total = this.statistics.resolved;
          const currentAvg = this.statistics.avgResolutionTime;
          this.statistics.avgResolutionTime = 
            (currentAvg * (total - 1) + resolutionTime) / total;
        }
        break;
      case 'escalated':
        this.statistics.escalated++;
        break;
    }

    // Update top sources
    const source = alert.metadata?.source || 'unknown';
    const sourceStats = this.statistics.topSources.find(s => s.source === source);
    if (sourceStats) {
      sourceStats.count++;
    } else {
      this.statistics.topSources.push({ source, count: 1 });
    }
    
    // Keep only top 10 sources
    this.statistics.topSources.sort((a, b) => b.count - a.count);
    this.statistics.topSources = this.statistics.topSources.slice(0, 10);
  }

  private startMaintenanceTimer(): void {
    setInterval(() => {
      // Clean up old resolved alerts
      const cutoff = Date.now() - 86400000; // 24 hours
      for (const [id, alert] of this.alerts) {
        if (alert.resolved && alert.timestamp < cutoff) {
          this.alerts.delete(id);
        }
      }

      // Clean up old alert history
      this.alertHistory = this.alertHistory.filter(a => a.timestamp > cutoff);

      // Clean up expired cooldowns
      for (const [key, expiry] of this.actionCooldowns) {
        if (Date.now() > expiry) {
          this.actionCooldowns.delete(key);
        }
      }
    }, 3600000); // Run every hour
  }

  // Public API

  addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
  }

  removeRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  updateRule(ruleId: string, updates: Partial<AlertRule>): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) return false;

    Object.assign(rule, updates);
    return true;
  }

  getRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  updateThresholds(updates: Partial<AlertThresholds>): void {
    this.thresholds = { ...this.thresholds, ...updates };
    this.emit('thresholds_updated', this.thresholds);
  }

  getAlertMetrics(): AlertMetrics {
    const activeAlerts = this.getActiveAlerts();
    return {
      criticalAlerts: activeAlerts.filter(a => a.severity === 'critical').length,
      warningAlerts: activeAlerts.filter(a => a.severity === 'warning').length,
      infoAlerts: activeAlerts.filter(a => a.severity === 'info').length,
      recentAlerts: activeAlerts.slice(0, 10)
    };
  }

  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values())
      .filter(a => !a.resolved)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  getAllAlerts(): Alert[] {
    return Array.from(this.alerts.values())
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  getCorrelatedAlerts(correlationId: string): Alert[] {
    const alertIds = this.correlationMap.get(correlationId);
    if (!alertIds) return [];

    return Array.from(alertIds)
      .map(id => this.alerts.get(id))
      .filter((a): a is Alert => a !== undefined);
  }

  getStatistics(): AlertStatistics {
    return { ...this.statistics };
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
}

interface AlertMetrics {
  criticalAlerts: number;
  warningAlerts: number;
  infoAlerts: number;
  recentAlerts: Alert[];
}

export { AlertManager };