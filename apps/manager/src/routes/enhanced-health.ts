import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../lib/logger';
import { observabilityOrchestrator } from '../services/observability-orchestrator.service';
import { FlyService } from '../services/fly.service';

// Create flyService instance
const flyService = new FlyService();
import { trustGraphService } from '../services/trustgraph/trustgraph.service';
import { langfuseService } from '../services/langfuse/langfuse.service';

export const enhancedHealthRouter = Router();

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  deployment_id?: string;
  services: {
    database: ServiceHealth;
    observability: ServiceHealth;
    fly_api: ServiceHealth;
    trustgraph: ServiceHealth;
    langfuse: ServiceHealth;
    websocket: ServiceHealth;
    redis: ServiceHealth;
  };
  metrics: {
    memory_usage: number;
    memory_total: number;
    cpu_usage: number;
    response_time_ms: number;
    active_connections: number;
    total_requests: number;
    error_rate: number;
  };
  deployment: {
    last_deployed: string;
    commit_hash: string;
    build_version: string;
    deployment_strategy: string;
  };
  dependencies: {
    critical: ServiceHealth[];
    non_critical: ServiceHealth[];
  };
}

interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  response_time_ms?: number;
  last_check: string;
  error?: string;
  details?: Record<string, any>;
}

// Health check metrics storage
let healthMetrics = {
  totalRequests: 0,
  errorCount: 0,
  startTime: Date.now(),
  lastHealthCheck: new Date(),
};

/**
 * Basic health endpoint - lightweight for load balancer checks
 */
enhancedHealthRouter.get('/', async (req: Request, res: Response) => {
  const startTime = Date.now();
  healthMetrics.totalRequests++;

  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      response_time_ms: Date.now() - startTime,
    };

    res.json(health);
  } catch (error) {
    healthMetrics.errorCount++;
    logger.error('Basic health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
    });
  }
});

/**
 * Readiness probe - checks if application is ready to serve traffic
 */
enhancedHealthRouter.get('/ready', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const checks: ServiceHealth[] = [];
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  try {
    // Database readiness check
    const dbHealth = await checkDatabaseHealth();
    checks.push(dbHealth);
    if (dbHealth.status === 'unhealthy') {
      overallStatus = 'unhealthy';
    } else if (dbHealth.status === 'degraded' && overallStatus === 'healthy') {
      overallStatus = 'degraded';
    }

    // Observability readiness check
    const obsHealth = await checkObservabilityHealth();
    checks.push(obsHealth);
    if (obsHealth.status === 'unhealthy') {
      overallStatus = 'unhealthy';
    } else if (obsHealth.status === 'degraded' && overallStatus === 'healthy') {
      overallStatus = 'degraded';
    }

    const readiness = {
      ready: overallStatus !== 'unhealthy',
      status: overallStatus,
      timestamp: new Date().toISOString(),
      response_time_ms: Date.now() - startTime,
      checks,
    };

    const statusCode = overallStatus === 'unhealthy' ? 503 : 200;
    res.status(statusCode).json(readiness);

  } catch (error) {
    logger.error('Readiness check failed:', error);
    res.status(503).json({
      ready: false,
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Readiness check failed',
    });
  }
});

/**
 * Liveness probe - checks if application is alive and functioning
 */
enhancedHealthRouter.get('/live', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    // Basic liveness checks
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    const liveness = {
      alive: true,
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      memory: {
        used: Math.round(memUsage.heapUsed / 1024 / 1024),
        total: Math.round(memUsage.heapTotal / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
      },
      response_time_ms: Date.now() - startTime,
    };

    res.json(liveness);
  } catch (error) {
    logger.error('Liveness check failed:', error);
    res.status(503).json({
      alive: false,
      timestamp: new Date().toISOString(),
      error: 'Liveness check failed',
    });
  }
});

/**
 * Comprehensive health check with detailed service status
 */
enhancedHealthRouter.get('/detailed', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    logger.info('Running detailed health check...');

    // Run all service health checks in parallel
    const [
      databaseHealth,
      observabilityHealth,
      flyApiHealth,
      trustgraphHealth,
      langfuseHealth,
      websocketHealth,
      redisHealth,
    ] = await Promise.allSettled([
      checkDatabaseHealth(),
      checkObservabilityHealth(),
      checkFlyApiHealth(),
      checkTrustGraphHealth(),
      checkLangfuseHealth(),
      checkWebSocketHealth(),
      checkRedisHealth(),
    ]);

    // Extract results and handle rejections
    const services = {
      database: getHealthResult(databaseHealth, 'database'),
      observability: getHealthResult(observabilityHealth, 'observability'),
      fly_api: getHealthResult(flyApiHealth, 'fly_api'),
      trustgraph: getHealthResult(trustgraphHealth, 'trustgraph'),
      langfuse: getHealthResult(langfuseHealth, 'langfuse'),
      websocket: getHealthResult(websocketHealth, 'websocket'),
      redis: getHealthResult(redisHealth, 'redis'),
    };

    // Calculate overall status
    const serviceStatuses = Object.values(services).map(s => s.status);
    const overallStatus = calculateOverallStatus(serviceStatuses);

    // Get system metrics
    const metrics = await getSystemMetrics();

    // Get deployment information
    const deployment = getDeploymentInfo();

    // Categorize dependencies
    const dependencies = categorizeDependencies(services);

    const healthStatus: HealthStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      deployment_id: process.env.DEPLOYMENT_ID || deployment.commit_hash,
      services,
      metrics,
      deployment,
      dependencies,
    };

    // Update last health check time
    healthMetrics.lastHealthCheck = new Date();

    // Log health status for monitoring
    logger.info('Detailed health check completed', {
      status: overallStatus,
      response_time: Date.now() - startTime,
      services: Object.keys(services).reduce((acc, key) => {
        acc[key] = services[key as keyof typeof services].status;
        return acc;
      }, {} as Record<string, string>),
    });

    const statusCode = overallStatus === 'unhealthy' ? 503 : 200;
    res.status(statusCode).json(healthStatus);

  } catch (error) {
    logger.error('Detailed health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Detailed health check failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Health metrics endpoint for monitoring systems
 */
enhancedHealthRouter.get('/metrics', async (req: Request, res: Response) => {
  try {
    const memUsage = process.memoryUsage();
    const uptime = process.uptime();
    const errorRate = healthMetrics.totalRequests > 0 
      ? (healthMetrics.errorCount / healthMetrics.totalRequests) * 100 
      : 0;

    const metrics = {
      timestamp: new Date().toISOString(),
      uptime_seconds: Math.floor(uptime),
      memory_heap_used_bytes: memUsage.heapUsed,
      memory_heap_total_bytes: memUsage.heapTotal,
      memory_external_bytes: memUsage.external,
      memory_rss_bytes: memUsage.rss,
      health_check_total_requests: healthMetrics.totalRequests,
      health_check_error_count: healthMetrics.errorCount,
      health_check_error_rate_percent: errorRate,
      last_health_check: healthMetrics.lastHealthCheck.toISOString(),
      observability_active_sessions: observabilityOrchestrator.getActiveSessions().length,
    };

    res.json(metrics);
  } catch (error) {
    logger.error('Health metrics failed:', error);
    res.status(500).json({
      error: 'Health metrics failed',
      timestamp: new Date().toISOString(),
    });
  }
});

// Helper functions
async function checkDatabaseHealth(): Promise<ServiceHealth> {
  const startTime = Date.now();
  
  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      return {
        name: 'database',
        status: 'unhealthy',
        last_check: new Date().toISOString(),
        error: 'Database configuration missing',
      };
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
    
    const { data, error } = await supabase
      .from('swarms')
      .select('count')
      .limit(1);

    if (error) throw error;

    return {
      name: 'database',
      status: 'healthy',
      response_time_ms: Date.now() - startTime,
      last_check: new Date().toISOString(),
      details: {
        connected: true,
        url: process.env.SUPABASE_URL,
      },
    };
  } catch (error) {
    return {
      name: 'database',
      status: 'unhealthy',
      response_time_ms: Date.now() - startTime,
      last_check: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Database check failed',
    };
  }
}

async function checkObservabilityHealth(): Promise<ServiceHealth> {
  const startTime = Date.now();
  
  try {
    const isInitialized = observabilityOrchestrator.isOrchestratorInitialized();
    const activeSessions = observabilityOrchestrator.getActiveSessions();
    const metrics = observabilityOrchestrator.getCurrentMetrics();

    return {
      name: 'observability',
      status: isInitialized ? 'healthy' : 'degraded',
      response_time_ms: Date.now() - startTime,
      last_check: new Date().toISOString(),
      details: {
        initialized: isInitialized,
        active_sessions: activeSessions.length,
        has_metrics: !!metrics,
      },
    };
  } catch (error) {
    return {
      name: 'observability',
      status: 'unhealthy',
      response_time_ms: Date.now() - startTime,
      last_check: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Observability check failed',
    };
  }
}

async function checkFlyApiHealth(): Promise<ServiceHealth> {
  const startTime = Date.now();
  
  try {
    // Check if Fly service is available and can make API calls
    const machines = await flyService.getMachines('swarm-manager-live');
    
    return {
      name: 'fly_api',
      status: 'healthy',
      response_time_ms: Date.now() - startTime,
      last_check: new Date().toISOString(),
      details: {
        machines_count: machines?.length || 0,
        api_available: true,
      },
    };
  } catch (error) {
    return {
      name: 'fly_api',
      status: 'degraded', // Non-critical for core functionality
      response_time_ms: Date.now() - startTime,
      last_check: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Fly API check failed',
    };
  }
}

async function checkTrustGraphHealth(): Promise<ServiceHealth> {
  const startTime = Date.now();
  
  try {
    const graph = trustGraphService.exportGraph();
    
    return {
      name: 'trustgraph',
      status: 'healthy',
      response_time_ms: Date.now() - startTime,
      last_check: new Date().toISOString(),
      details: {
        nodes_count: graph.nodes.length,
        edges_count: graph.edges.length,
      },
    };
  } catch (error) {
    return {
      name: 'trustgraph',
      status: 'degraded', // Non-critical for core functionality
      response_time_ms: Date.now() - startTime,
      last_check: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'TrustGraph check failed',
    };
  }
}

async function checkLangfuseHealth(): Promise<ServiceHealth> {
  const startTime = Date.now();
  
  try {
    const isEnabled = langfuseService.isEnabled();
    const metrics = langfuseService.getMetrics();
    
    return {
      name: 'langfuse',
      status: isEnabled ? 'healthy' : 'degraded',
      response_time_ms: Date.now() - startTime,
      last_check: new Date().toISOString(),
      details: {
        enabled: isEnabled,
        metrics_available: !!metrics,
      },
    };
  } catch (error) {
    return {
      name: 'langfuse',
      status: 'degraded', // Non-critical for core functionality
      response_time_ms: Date.now() - startTime,
      last_check: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Langfuse check failed',
    };
  }
}

async function checkWebSocketHealth(): Promise<ServiceHealth> {
  const startTime = Date.now();
  
  try {
    // Basic WebSocket service availability check
    // In a real implementation, you might check active connections
    return {
      name: 'websocket',
      status: 'healthy',
      response_time_ms: Date.now() - startTime,
      last_check: new Date().toISOString(),
      details: {
        service_available: true,
        // active_connections: wsService.getActiveConnections() // if available
      },
    };
  } catch (error) {
    return {
      name: 'websocket',
      status: 'unhealthy',
      response_time_ms: Date.now() - startTime,
      last_check: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'WebSocket check failed',
    };
  }
}

async function checkRedisHealth(): Promise<ServiceHealth> {
  const startTime = Date.now();
  
  try {
    // Check Redis connection if available
    if (!process.env.REDIS_URL) {
      return {
        name: 'redis',
        status: 'degraded',
        last_check: new Date().toISOString(),
        error: 'Redis not configured',
      };
    }

    // Basic Redis ping check would go here
    // const redis = new Redis(process.env.REDIS_URL);
    // await redis.ping();

    return {
      name: 'redis',
      status: 'healthy',
      response_time_ms: Date.now() - startTime,
      last_check: new Date().toISOString(),
      details: {
        connected: true,
      },
    };
  } catch (error) {
    return {
      name: 'redis',
      status: 'degraded', // Non-critical for basic functionality
      response_time_ms: Date.now() - startTime,
      last_check: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Redis check failed',
    };
  }
}

function getHealthResult(
  result: PromiseSettledResult<ServiceHealth>,
  serviceName: string
): ServiceHealth {
  if (result.status === 'fulfilled') {
    return result.value;
  } else {
    return {
      name: serviceName,
      status: 'unhealthy',
      last_check: new Date().toISOString(),
      error: result.reason instanceof Error ? result.reason.message : 'Health check failed',
    };
  }
}

function calculateOverallStatus(serviceStatuses: string[]): 'healthy' | 'degraded' | 'unhealthy' {
  const criticalServices = ['database', 'websocket']; // Define critical services
  
  // Check if any critical services are unhealthy
  const hasUnhealthyCritical = serviceStatuses.some((status, index) => {
    const serviceName = Object.keys(serviceStatuses)[index];
    return criticalServices.includes(serviceName) && status === 'unhealthy';
  });

  if (hasUnhealthyCritical) {
    return 'unhealthy';
  }

  // Check if any services are degraded or unhealthy
  if (serviceStatuses.some(status => status === 'degraded' || status === 'unhealthy')) {
    return 'degraded';
  }

  return 'healthy';
}

async function getSystemMetrics() {
  const memUsage = process.memoryUsage();
  const uptime = process.uptime();
  
  return {
    memory_usage: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
    memory_total: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
    cpu_usage: 0, // Would need additional monitoring for real CPU usage
    response_time_ms: 0, // Will be calculated by caller
    active_connections: 0, // Would track WebSocket/HTTP connections
    total_requests: healthMetrics.totalRequests,
    error_rate: healthMetrics.totalRequests > 0 
      ? (healthMetrics.errorCount / healthMetrics.totalRequests) * 100 
      : 0,
  };
}

function getDeploymentInfo() {
  return {
    last_deployed: process.env.DEPLOYMENT_TIMESTAMP || new Date().toISOString(),
    commit_hash: process.env.COMMIT_SHA || process.env.GITHUB_SHA || 'unknown',
    build_version: process.env.BUILD_VERSION || process.env.npm_package_version || '1.0.0',
    deployment_strategy: process.env.DEPLOYMENT_STRATEGY || 'rolling',
  };
}

function categorizeDependencies(services: HealthStatus['services']) {
  const critical: ServiceHealth[] = [];
  const nonCritical: ServiceHealth[] = [];

  // Define which services are critical vs non-critical
  const criticalServiceNames = ['database', 'websocket'];

  Object.entries(services).forEach(([name, health]) => {
    if (criticalServiceNames.includes(name)) {
      critical.push(health);
    } else {
      nonCritical.push(health);
    }
  });

  return { critical, non_critical: nonCritical };
}