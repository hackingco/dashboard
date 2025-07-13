import { EventEmitter } from 'events';
import { logger } from '../lib/logger';
import { observabilityOrchestrator } from './observability-orchestrator.service';
import { FlyService } from './fly.service';

// Create flyService instance
const flyService = new FlyService();
import { langfuseService } from './langfuse/langfuse.service';
import { supabaseRealtimeService } from './supabase-realtime.service';

export interface DeploymentMetrics {
  deployment_id: string;
  service_name: string;
  version: string;
  environment: string;
  started_at: Date;
  health_checks: HealthCheckResult[];
  performance_metrics: PerformanceMetric[];
  error_count: number;
  success_rate: number;
  rollback_triggered: boolean;
  rollback_reason?: string;
  status: 'deploying' | 'healthy' | 'degraded' | 'failed' | 'rolled_back';
}

export interface HealthCheckResult {
  timestamp: Date;
  endpoint: string;
  status_code: number;
  response_time_ms: number;
  success: boolean;
  error?: string;
  details?: Record<string, any>;
}

export interface PerformanceMetric {
  timestamp: Date;
  metric_name: string;
  value: number;
  unit: string;
  threshold?: number;
  breached: boolean;
}

export interface DeploymentAlert {
  deployment_id: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: Date;
  metric?: string;
  current_value?: number;
  threshold?: number;
  action_required?: string;
}

/**
 * Monitors deployment health, performance, and automatically triggers rollbacks
 * Integrates with observability stack for comprehensive monitoring
 */
export class DeploymentMonitorService extends EventEmitter {
  private activeDeployments: Map<string, DeploymentMetrics> = new Map();
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();
  private alertThresholds = {
    response_time_ms: 2000,
    error_rate_percent: 5,
    success_rate_percent: 95,
    memory_usage_mb: 1000,
    cpu_usage_percent: 80,
  };
  private monitoringInterval = 30000; // 30 seconds
  private rollbackCooldown = 300000; // 5 minutes

  constructor() {
    super();
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Listen to observability events
    observabilityOrchestrator.on('health_check', (health) => {
      this.processHealthCheckData(health);
    });

    observabilityOrchestrator.on('metrics_collected', (metrics) => {
      this.processMetricsData(metrics);
    });

    // Listen to Fly.io events if available
    // Note: FlyService doesn't emit events yet, placeholder for future implementation
    // flyService.on?.('machine_event', (event) => {
    //   this.processFlyEvent(event);
    // });
  }

  /**
   * Start monitoring a new deployment
   */
  async startDeploymentMonitoring(
    deploymentId: string,
    serviceName: string,
    version: string,
    environment: string = 'production'
  ): Promise<void> {
    logger.info('Starting deployment monitoring', {
      deploymentId,
      serviceName,
      version,
      environment,
    });

    const deployment: DeploymentMetrics = {
      deployment_id: deploymentId,
      service_name: serviceName,
      version,
      environment,
      started_at: new Date(),
      health_checks: [],
      performance_metrics: [],
      error_count: 0,
      success_rate: 100,
      rollback_triggered: false,
      status: 'deploying',
    };

    this.activeDeployments.set(deploymentId, deployment);

    // Start observability session for this deployment
    await observabilityOrchestrator.startObservabilitySession(
      `deployment-${deploymentId}`,
      'deployment_monitoring',
      {
        deployment_id: deploymentId,
        service_name: serviceName,
        version,
        environment,
      }
    );

    // Start monitoring interval
    const interval = setInterval(() => {
      this.performDeploymentHealthCheck(deploymentId);
    }, this.monitoringInterval);

    this.monitoringIntervals.set(deploymentId, interval);

    // Initial health check
    setTimeout(() => {
      this.performDeploymentHealthCheck(deploymentId);
    }, 5000); // Wait 5 seconds before first check

    this.emit('deployment_monitoring_started', deployment);
  }

  /**
   * Stop monitoring a deployment
   */
  async stopDeploymentMonitoring(
    deploymentId: string,
    status: 'healthy' | 'failed' | 'rolled_back' = 'healthy'
  ): Promise<void> {
    const deployment = this.activeDeployments.get(deploymentId);
    if (!deployment) {
      logger.warn('Attempted to stop monitoring non-existent deployment', { deploymentId });
      return;
    }

    logger.info('Stopping deployment monitoring', { deploymentId, status });

    // Clear monitoring interval
    const interval = this.monitoringIntervals.get(deploymentId);
    if (interval) {
      clearInterval(interval);
      this.monitoringIntervals.delete(deploymentId);
    }

    // Update deployment status
    deployment.status = status;

    // End observability session
    await observabilityOrchestrator.endObservabilitySession(
      `deployment-${deploymentId}`,
      status === 'healthy' ? 'completed' : 'failed'
    );

    // Store final deployment metrics
    await this.storeDeploymentMetrics(deployment);

    this.activeDeployments.delete(deploymentId);
    this.emit('deployment_monitoring_stopped', deployment);
  }

  /**
   * Perform comprehensive health check for a deployment
   */
  private async performDeploymentHealthCheck(deploymentId: string): Promise<void> {
    const deployment = this.activeDeployments.get(deploymentId);
    if (!deployment) return;

    try {
      logger.debug('Performing deployment health check', { deploymentId });

      // Get service URL based on service name
      const serviceUrl = this.getServiceUrl(deployment.service_name);
      if (!serviceUrl) {
        logger.warn('No URL configured for service', { serviceName: deployment.service_name });
        return;
      }

      // Perform health checks
      const healthChecks = await Promise.allSettled([
        this.checkEndpoint(`${serviceUrl}/health`, 'basic_health'),
        this.checkEndpoint(`${serviceUrl}/health/ready`, 'readiness'),
        this.checkEndpoint(`${serviceUrl}/health/live`, 'liveness'),
        this.checkEndpoint(`${serviceUrl}/health/detailed`, 'detailed_health'),
      ]);

      // Process health check results
      healthChecks.forEach((result, index) => {
        const endpoints = ['basic_health', 'readiness', 'liveness', 'detailed_health'];
        const endpointName = endpoints[index];

        if (result.status === 'fulfilled') {
          deployment.health_checks.push(result.value);
          
          // Check for performance issues
          if (result.value.response_time_ms > this.alertThresholds.response_time_ms) {
            this.raiseAlert(deploymentId, 'warning', 
              `High response time for ${endpointName}: ${result.value.response_time_ms}ms`,
              'response_time_ms',
              result.value.response_time_ms,
              this.alertThresholds.response_time_ms
            );
          }

          if (!result.value.success) {
            deployment.error_count++;
            this.raiseAlert(deploymentId, 'critical',
              `Health check failed for ${endpointName}`,
              undefined,
              undefined,
              undefined,
              'Investigate service health immediately'
            );
          }
        } else {
          deployment.error_count++;
          deployment.health_checks.push({
            timestamp: new Date(),
            endpoint: endpointName,
            status_code: 0,
            response_time_ms: 0,
            success: false,
            error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
          });

          this.raiseAlert(deploymentId, 'critical',
            `Health check error for ${endpointName}`,
            undefined,
            undefined,
            undefined,
            'Check service availability'
          );
        }
      });

      // Calculate success rate
      const recentChecks = deployment.health_checks.slice(-20); // Last 20 checks
      const successfulChecks = recentChecks.filter(check => check.success).length;
      deployment.success_rate = recentChecks.length > 0 
        ? (successfulChecks / recentChecks.length) * 100 
        : 100;

      // Check if rollback is needed
      await this.evaluateRollbackConditions(deployment);

      // Update deployment status
      this.updateDeploymentStatus(deployment);

      // Emit health check event
      this.emit('health_check_completed', {
        deployment_id: deploymentId,
        success_rate: deployment.success_rate,
        error_count: deployment.error_count,
        status: deployment.status,
      });

    } catch (error) {
      logger.error('Deployment health check failed', { deploymentId, error });
      deployment.error_count++;
    }
  }

  /**
   * Check a specific endpoint
   */
  private async checkEndpoint(url: string, name: string): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'DeploymentMonitor/1.0',
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      const responseTime = Date.now() - startTime;
      const success = response.ok;
      
      let details: Record<string, any> = {};
      try {
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          details = await response.json() as Record<string, any>;
        }
      } catch {
        // Ignore JSON parsing errors
      }

      return {
        timestamp: new Date(),
        endpoint: name,
        status_code: response.status,
        response_time_ms: responseTime,
        success,
        details,
      };
    } catch (error) {
      return {
        timestamp: new Date(),
        endpoint: name,
        status_code: 0,
        response_time_ms: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Request failed',
      };
    }
  }

  /**
   * Evaluate if deployment should be rolled back
   */
  private async evaluateRollbackConditions(deployment: DeploymentMetrics): Promise<void> {
    if (deployment.rollback_triggered) return;

    const timeSinceDeployment = Date.now() - deployment.started_at.getTime();
    
    // Don't trigger rollback too early or during cooldown
    if (timeSinceDeployment < 60000) return; // Wait at least 1 minute

    let shouldRollback = false;
    let rollbackReason = '';

    // Check success rate
    if (deployment.success_rate < this.alertThresholds.success_rate_percent) {
      shouldRollback = true;
      rollbackReason = `Low success rate: ${deployment.success_rate.toFixed(1)}%`;
    }

    // Check error count
    const recentErrors = deployment.health_checks
      .filter(check => 
        !check.success && 
        Date.now() - check.timestamp.getTime() < 300000 // Last 5 minutes
      ).length;

    if (recentErrors >= 5) {
      shouldRollback = true;
      rollbackReason = `High error count: ${recentErrors} errors in 5 minutes`;
    }

    // Check for consecutive failures
    const recentChecks = deployment.health_checks.slice(-5);
    const consecutiveFailures = recentChecks.every(check => !check.success) && recentChecks.length >= 5;

    if (consecutiveFailures) {
      shouldRollback = true;
      rollbackReason = 'Consecutive health check failures';
    }

    if (shouldRollback) {
      await this.triggerAutomaticRollback(deployment.deployment_id, rollbackReason);
    }
  }

  /**
   * Trigger automatic rollback
   */
  private async triggerAutomaticRollback(deploymentId: string, reason: string): Promise<void> {
    const deployment = this.activeDeployments.get(deploymentId);
    if (!deployment || deployment.rollback_triggered) return;

    logger.warn('Triggering automatic rollback', { deploymentId, reason });

    deployment.rollback_triggered = true;
    deployment.rollback_reason = reason;
    deployment.status = 'failed';

    // Raise critical alert
    this.raiseAlert(deploymentId, 'critical',
      `Automatic rollback triggered: ${reason}`,
      undefined,
      undefined,
      undefined,
      'Rollback in progress - monitor service recovery'
    );

    try {
      // Trigger rollback via Fly.io
      const success = await this.executeFlyRollback(deployment);
      
      if (success) {
        deployment.status = 'rolled_back';
        logger.info('Automatic rollback completed successfully', { deploymentId });
        
        this.raiseAlert(deploymentId, 'info',
          'Automatic rollback completed successfully',
          undefined,
          undefined,
          undefined,
          'Verify service is functioning normally'
        );
      } else {
        logger.error('Automatic rollback failed', { deploymentId });
        
        this.raiseAlert(deploymentId, 'critical',
          'Automatic rollback failed - manual intervention required',
          undefined,
          undefined,
          undefined,
          'Execute manual rollback immediately'
        );
      }

      this.emit('rollback_triggered', {
        deployment_id: deploymentId,
        reason,
        success,
      });

    } catch (error) {
      logger.error('Rollback execution failed', { deploymentId, error });
      
      this.raiseAlert(deploymentId, 'critical',
        'Rollback execution error - manual intervention required',
        undefined,
        undefined,
        undefined,
        'Check rollback status and execute manually if needed'
      );
    }
  }

  /**
   * Execute rollback via Fly.io
   */
  private async executeFlyRollback(deployment: DeploymentMetrics): Promise<boolean> {
    try {
      // Get app name from service name
      const appName = this.getAppName(deployment.service_name);
      if (!appName) {
        logger.error('Cannot determine app name for rollback', { 
          serviceName: deployment.service_name 
        });
        return false;
      }

      // Get recent releases to find previous version
      const releases = await flyService.getReleases(appName);
      if (!releases || releases.length < 2) {
        logger.error('No previous release found for rollback', { appName });
        return false;
      }

      // Rollback to previous release
      const previousRelease = releases[1]; // Second latest release
      await flyService.rollbackToRelease(appName, previousRelease.version);

      logger.info('Rollback command executed', { 
        appName, 
        targetVersion: previousRelease.version 
      });

      return true;
    } catch (error) {
      logger.error('Fly.io rollback failed', { error });
      return false;
    }
  }

  /**
   * Raise an alert
   */
  private raiseAlert(
    deploymentId: string,
    severity: 'info' | 'warning' | 'critical',
    message: string,
    metric?: string,
    currentValue?: number,
    threshold?: number,
    actionRequired?: string
  ): void {
    const alert: DeploymentAlert = {
      deployment_id: deploymentId,
      severity,
      message,
      timestamp: new Date(),
      metric,
      current_value: currentValue,
      threshold,
      action_required: actionRequired,
    };

    logger.warn('Deployment alert raised', alert);
    this.emit('alert_raised', alert);

    // Store alert in observability system
    observabilityOrchestrator.emit('deployment_alert', alert);
  }

  /**
   * Update deployment status based on health metrics
   */
  private updateDeploymentStatus(deployment: DeploymentMetrics): void {
    if (deployment.rollback_triggered) return;

    const timeSinceDeployment = Date.now() - deployment.started_at.getTime();
    
    if (timeSinceDeployment < 120000) { // First 2 minutes
      deployment.status = 'deploying';
    } else if (deployment.success_rate >= 98 && deployment.error_count === 0) {
      deployment.status = 'healthy';
    } else if (deployment.success_rate >= 90) {
      deployment.status = 'degraded';
    } else {
      deployment.status = 'failed';
    }
  }

  /**
   * Store deployment metrics in database
   */
  private async storeDeploymentMetrics(deployment: DeploymentMetrics): Promise<void> {
    try {
      const client = supabaseRealtimeService.getClient();
      
      const { error } = await client
        .from('deployment_metrics')
        .insert({
          deployment_id: deployment.deployment_id,
          service_name: deployment.service_name,
          version: deployment.version,
          environment: deployment.environment,
          started_at: deployment.started_at.toISOString(),
          final_status: deployment.status,
          total_health_checks: deployment.health_checks.length,
          success_rate: deployment.success_rate,
          error_count: deployment.error_count,
          rollback_triggered: deployment.rollback_triggered,
          rollback_reason: deployment.rollback_reason,
          metrics_data: JSON.stringify({
            health_checks: deployment.health_checks.slice(-10), // Last 10 checks
            performance_metrics: deployment.performance_metrics.slice(-10),
          }),
        });

      if (error) {
        logger.error('Failed to store deployment metrics', { error, deploymentId: deployment.deployment_id });
      }
    } catch (error) {
      logger.error('Error storing deployment metrics', { error });
    }
  }

  /**
   * Process health check data from observability
   */
  private processHealthCheckData(health: any): void {
    // Process health data from observability orchestrator
    logger.debug('Processing health check data', { health });
  }

  /**
   * Process metrics data from observability
   */
  private processMetricsData(metrics: any): void {
    // Process metrics from observability orchestrator
    logger.debug('Processing metrics data', { metrics });
  }

  /**
   * Process Fly.io events
   */
  private processFlyEvent(event: any): void {
    // Process events from Fly.io service
    logger.debug('Processing Fly event', { event });
  }

  /**
   * Get service URL for health checks
   */
  private getServiceUrl(serviceName: string): string | null {
    const urlMap: Record<string, string> = {
      'manager': 'https://swarm-manager-live.fly.dev',
      'worker': 'https://swarm-worker.fly.dev',
      'dashboard': 'https://admin-dashboard-l0e1w6ivz-hackingco.vercel.app',
    };

    return urlMap[serviceName] || null;
  }

  /**
   * Get Fly.io app name from service name
   */
  private getAppName(serviceName: string): string | null {
    const appMap: Record<string, string> = {
      'manager': 'swarm-manager-live',
      'worker': 'swarm-worker',
    };

    return appMap[serviceName] || null;
  }

  /**
   * Get active deployments
   */
  getActiveDeployments(): DeploymentMetrics[] {
    return Array.from(this.activeDeployments.values());
  }

  /**
   * Get deployment by ID
   */
  getDeployment(deploymentId: string): DeploymentMetrics | undefined {
    return this.activeDeployments.get(deploymentId);
  }

  /**
   * Update alert thresholds
   */
  updateAlertThresholds(thresholds: Partial<typeof this.alertThresholds>): void {
    this.alertThresholds = { ...this.alertThresholds, ...thresholds };
    logger.info('Alert thresholds updated', { thresholds: this.alertThresholds });
  }

  /**
   * Cleanup and shutdown
   */
  async destroy(): Promise<void> {
    logger.info('Shutting down deployment monitor service');

    // Stop all monitoring intervals
    for (const [deploymentId, interval] of this.monitoringIntervals) {
      clearInterval(interval);
      await this.stopDeploymentMonitoring(deploymentId, 'failed');
    }

    this.monitoringIntervals.clear();
    this.activeDeployments.clear();
    this.removeAllListeners();
  }
}

// Export singleton instance
export const deploymentMonitorService = new DeploymentMonitorService();