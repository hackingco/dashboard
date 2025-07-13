import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { deploymentMonitorService } from '../services/deployment-monitor.service';
import { observabilityOrchestrator } from '../services/observability-orchestrator.service';
import { FlyService } from '../services/fly.service';

// Create flyService instance
const flyService = new FlyService();
import { z } from 'zod';

export const deploymentRouter = Router();

// Validation schemas
const startMonitoringSchema = z.object({
  deployment_id: z.string().min(1),
  service: z.enum(['manager', 'worker', 'dashboard']),
  version: z.string().min(1),
  environment: z.enum(['production', 'staging']).default('production'),
  github_run_id: z.string().optional(),
});

const completeDeploymentSchema = z.object({
  deployment_id: z.string().min(1),
  status: z.enum(['success', 'failure']),
  manager_deployed: z.boolean().optional(),
  worker_deployed: z.boolean().optional(),
  dashboard_deployed: z.boolean().optional(),
});

const rollbackSchema = z.object({
  deployment_id: z.string().min(1),
  service: z.enum(['manager', 'worker', 'all']),
  reason: z.string().min(1),
  target_version: z.string().optional(),
});

/**
 * Start deployment monitoring
 * Called by GitHub Actions when deployment begins
 */
deploymentRouter.post('/monitoring/start', async (req: Request, res: Response) => {
  try {
    const validation = startMonitoringSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request body',
        details: validation.error.issues,
      });
    }

    const { deployment_id, service, version, environment, github_run_id } = validation.data;

    logger.info('Starting deployment monitoring', {
      deployment_id,
      service,
      version,
      environment,
      github_run_id,
    });

    // Start monitoring for the service
    await deploymentMonitorService.startDeploymentMonitoring(
      deployment_id,
      service,
      version,
      environment
    );

    // Set up monitoring event handlers for this deployment
    const handleAlert = (alert: any) => {
      if (alert.deployment_id === deployment_id) {
        logger.warn('Deployment alert', alert);
        
        // Trigger GitHub workflow notification if needed
        if (alert.severity === 'critical') {
          // Could trigger GitHub API notification here
          logger.error('Critical deployment alert - consider manual intervention', {
            deployment_id,
            alert: alert.message,
          });
        }
      }
    };

    const handleRollback = (rollbackData: any) => {
      if (rollbackData.deployment_id === deployment_id) {
        logger.warn('Automatic rollback triggered', rollbackData);
        
        // Log rollback event for GitHub Actions to pick up
        observabilityOrchestrator.emit('deployment_rollback', {
          deployment_id,
          service,
          reason: rollbackData.reason,
          success: rollbackData.success,
          timestamp: new Date().toISOString(),
        });
      }
    };

    // Set up temporary event listeners
    deploymentMonitorService.once('alert_raised', handleAlert);
    deploymentMonitorService.once('rollback_triggered', handleRollback);

    // Clean up listeners after 30 minutes
    setTimeout(() => {
      deploymentMonitorService.removeListener('alert_raised', handleAlert);
      deploymentMonitorService.removeListener('rollback_triggered', handleRollback);
    }, 30 * 60 * 1000);

    res.json({
      message: 'Deployment monitoring started',
      deployment_id,
      service,
      monitoring_duration: '30 minutes',
      endpoints: {
        status: `/api/deployment/monitoring/${deployment_id}/status`,
        metrics: `/api/deployment/monitoring/${deployment_id}/metrics`,
        stop: `/api/deployment/monitoring/${deployment_id}/stop`,
      },
    });

  } catch (error) {
    logger.error('Failed to start deployment monitoring', { error });
    res.status(500).json({
      error: 'Failed to start deployment monitoring',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get deployment monitoring status
 */
deploymentRouter.get('/monitoring/:deploymentId/status', async (req: Request, res: Response) => {
  try {
    const deploymentId = req.params.deploymentId;
    const deployment = deploymentMonitorService.getDeployment(deploymentId);

    if (!deployment) {
      return res.status(404).json({
        error: 'Deployment not found',
        deployment_id: deploymentId,
      });
    }

    // Calculate additional metrics
    const recentHealthChecks = deployment.health_checks.slice(-10);
    const avgResponseTime = recentHealthChecks.length > 0
      ? recentHealthChecks.reduce((sum, check) => sum + check.response_time_ms, 0) / recentHealthChecks.length
      : 0;

    const monitoring_duration = Date.now() - deployment.started_at.getTime();

    res.json({
      deployment_id: deploymentId,
      status: deployment.status,
      service_name: deployment.service_name,
      version: deployment.version,
      environment: deployment.environment,
      started_at: deployment.started_at,
      monitoring_duration_ms: monitoring_duration,
      health_summary: {
        success_rate: deployment.success_rate,
        error_count: deployment.error_count,
        total_checks: deployment.health_checks.length,
        avg_response_time_ms: avgResponseTime,
        last_check: recentHealthChecks[recentHealthChecks.length - 1]?.timestamp || null,
      },
      rollback_info: {
        triggered: deployment.rollback_triggered,
        reason: deployment.rollback_reason,
      },
      recent_health_checks: recentHealthChecks.map(check => ({
        timestamp: check.timestamp,
        endpoint: check.endpoint,
        success: check.success,
        response_time_ms: check.response_time_ms,
        status_code: check.status_code,
      })),
    });

  } catch (error) {
    logger.error('Failed to get deployment status', { error });
    res.status(500).json({
      error: 'Failed to get deployment status',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get detailed deployment metrics
 */
deploymentRouter.get('/monitoring/:deploymentId/metrics', async (req: Request, res: Response) => {
  try {
    const deploymentId = req.params.deploymentId;
    const deployment = deploymentMonitorService.getDeployment(deploymentId);

    if (!deployment) {
      return res.status(404).json({
        error: 'Deployment not found',
        deployment_id: deploymentId,
      });
    }

    // Get observability metrics for this deployment
    const observabilityData = await observabilityOrchestrator.getSwarmObservabilityData(
      `deployment-${deploymentId}`
    );

    res.json({
      deployment_id: deploymentId,
      metrics: {
        deployment: deployment,
        observability: observabilityData,
        performance_trends: {
          response_time_trend: deployment.health_checks.slice(-20).map(check => ({
            timestamp: check.timestamp,
            response_time_ms: check.response_time_ms,
          })),
          success_rate_trend: calculateSuccessRateTrend(deployment.health_checks),
          error_rate_trend: calculateErrorRateTrend(deployment.health_checks),
        },
      },
    });

  } catch (error) {
    logger.error('Failed to get deployment metrics', { error });
    res.status(500).json({
      error: 'Failed to get deployment metrics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Stop deployment monitoring
 * Called by GitHub Actions when deployment is complete
 */
deploymentRouter.post('/monitoring/:deploymentId/stop', async (req: Request, res: Response) => {
  try {
    const deploymentId = req.params.deploymentId;
    const { status = 'healthy' } = req.body;

    const deployment = deploymentMonitorService.getDeployment(deploymentId);
    if (!deployment) {
      return res.status(404).json({
        error: 'Deployment not found',
        deployment_id: deploymentId,
      });
    }

    await deploymentMonitorService.stopDeploymentMonitoring(deploymentId, status);

    res.json({
      message: 'Deployment monitoring stopped',
      deployment_id: deploymentId,
      final_status: status,
      summary: {
        duration_ms: Date.now() - deployment.started_at.getTime(),
        total_health_checks: deployment.health_checks.length,
        success_rate: deployment.success_rate,
        error_count: deployment.error_count,
        rollback_triggered: deployment.rollback_triggered,
      },
    });

  } catch (error) {
    logger.error('Failed to stop deployment monitoring', { error });
    res.status(500).json({
      error: 'Failed to stop deployment monitoring',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Trigger manual rollback
 */
deploymentRouter.post('/rollback', async (req: Request, res: Response) => {
  try {
    const validation = rollbackSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request body',
        details: validation.error.issues,
      });
    }

    const { deployment_id, service, reason, target_version } = validation.data;

    logger.info('Manual rollback requested', {
      deployment_id,
      service,
      reason,
      target_version,
    });

    // Get app names for rollback
    const appNames = service === 'all' 
      ? ['swarm-manager-live', 'swarm-worker']
      : service === 'manager' 
        ? ['swarm-manager-live']
        : ['swarm-worker'];

    const rollbackResults = [];

    for (const appName of appNames) {
      try {
        if (target_version) {
          await flyService.rollbackToRelease(appName, target_version);
        } else {
          // Rollback to previous release
          const releases = await flyService.getReleases(appName);
          if (releases && releases.length >= 2) {
            await flyService.rollbackToRelease(appName, releases[1].version);
          } else {
            throw new Error('No previous release found');
          }
        }

        rollbackResults.push({
          app: appName,
          success: true,
          target_version: target_version || 'previous',
        });

        logger.info('Manual rollback completed', { appName, target_version });

      } catch (error) {
        rollbackResults.push({
          app: appName,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        logger.error('Manual rollback failed', { appName, error });
      }
    }

    // Stop monitoring if deployment exists
    const deployment = deploymentMonitorService.getDeployment(deployment_id);
    if (deployment) {
      await deploymentMonitorService.stopDeploymentMonitoring(deployment_id, 'rolled_back');
    }

    // Log rollback event
    await observabilityOrchestrator.startObservabilitySession(
      `rollback-${deployment_id}`,
      'manual_rollback',
      {
        deployment_id,
        service,
        reason,
        target_version,
        results: rollbackResults,
      }
    );

    const allSuccessful = rollbackResults.every(result => result.success);

    res.status(allSuccessful ? 200 : 207).json({
      message: allSuccessful ? 'Rollback completed successfully' : 'Rollback completed with errors',
      deployment_id,
      service,
      reason,
      results: rollbackResults,
      overall_success: allSuccessful,
    });

  } catch (error) {
    logger.error('Manual rollback failed', { error });
    res.status(500).json({
      error: 'Manual rollback failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Deployment completion webhook
 * Called by GitHub Actions to mark deployment as complete
 */
deploymentRouter.post('/complete', async (req: Request, res: Response) => {
  try {
    const validation = completeDeploymentSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request body',
        details: validation.error.issues,
      });
    }

    const { deployment_id, status, manager_deployed, worker_deployed, dashboard_deployed } = validation.data;

    logger.info('Deployment completion notification received', {
      deployment_id,
      status,
      services: { manager_deployed, worker_deployed, dashboard_deployed },
    });

    // Log deployment completion in observability
    await observabilityOrchestrator.startObservabilitySession(
      `deployment-complete-${deployment_id}`,
      'deployment_completion',
      {
        deployment_id,
        status,
        services_deployed: {
          manager: manager_deployed,
          worker: worker_deployed,
          dashboard: dashboard_deployed,
        },
        timestamp: new Date().toISOString(),
      }
    );

    // If deployment was successful, continue monitoring for a bit longer
    const deployment = deploymentMonitorService.getDeployment(deployment_id);
    if (deployment && status === 'success') {
      // Continue monitoring for 15 more minutes after successful deployment
      setTimeout(async () => {
        const finalDeployment = deploymentMonitorService.getDeployment(deployment_id);
        if (finalDeployment && !finalDeployment.rollback_triggered) {
          await deploymentMonitorService.stopDeploymentMonitoring(deployment_id, 'healthy');
        }
      }, 15 * 60 * 1000);
    } else if (deployment && status === 'failure') {
      // Stop monitoring immediately on failure
      await deploymentMonitorService.stopDeploymentMonitoring(deployment_id, 'failed');
    }

    res.json({
      message: 'Deployment completion processed',
      deployment_id,
      status,
      next_steps: status === 'success' 
        ? 'Monitoring will continue for 15 more minutes'
        : 'Monitoring stopped due to deployment failure',
    });

  } catch (error) {
    logger.error('Failed to process deployment completion', { error });
    res.status(500).json({
      error: 'Failed to process deployment completion',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get all active deployments
 */
deploymentRouter.get('/monitoring/active', async (req: Request, res: Response) => {
  try {
    const activeDeployments = deploymentMonitorService.getActiveDeployments();

    const deploymentSummaries = activeDeployments.map(deployment => ({
      deployment_id: deployment.deployment_id,
      service_name: deployment.service_name,
      version: deployment.version,
      environment: deployment.environment,
      status: deployment.status,
      started_at: deployment.started_at,
      success_rate: deployment.success_rate,
      error_count: deployment.error_count,
      rollback_triggered: deployment.rollback_triggered,
      monitoring_duration_ms: Date.now() - deployment.started_at.getTime(),
    }));

    res.json({
      active_deployments: deploymentSummaries,
      count: deploymentSummaries.length,
    });

  } catch (error) {
    logger.error('Failed to get active deployments', { error });
    res.status(500).json({
      error: 'Failed to get active deployments',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Helper functions
function calculateSuccessRateTrend(healthChecks: any[]): Array<{ timestamp: Date; success_rate: number }> {
  const windowSize = 5;
  const trend = [];
  
  for (let i = windowSize - 1; i < healthChecks.length; i++) {
    const window = healthChecks.slice(i - windowSize + 1, i + 1);
    const successCount = window.filter(check => check.success).length;
    const successRate = (successCount / windowSize) * 100;
    
    trend.push({
      timestamp: healthChecks[i].timestamp,
      success_rate: successRate,
    });
  }
  
  return trend;
}

function calculateErrorRateTrend(healthChecks: any[]): Array<{ timestamp: Date; error_rate: number }> {
  const windowSize = 5;
  const trend = [];
  
  for (let i = windowSize - 1; i < healthChecks.length; i++) {
    const window = healthChecks.slice(i - windowSize + 1, i + 1);
    const errorCount = window.filter(check => !check.success).length;
    const errorRate = (errorCount / windowSize) * 100;
    
    trend.push({
      timestamp: healthChecks[i].timestamp,
      error_rate: errorRate,
    });
  }
  
  return trend;
}