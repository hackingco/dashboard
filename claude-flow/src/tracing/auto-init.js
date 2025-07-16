/**
 * Auto-initialization for Claude-Flow Tracing
 * Automatically sets up tracing when claude-flow is imported
 */

import { tracing } from './index.js';
import logger from '../utils/logger.js';

let initialized = false;

/**
 * Initialize tracing with automatic component detection
 */
export async function autoInitTracing(components = {}) {
  if (initialized) return tracing;

  try {
    // Initialize tracing manager
    await tracing.initialize();
    
    // Set context if provided
    if (components.context) {
      tracing.setContext(components.context);
    }

    // Auto-instrument components
    if (components.mcpServer) {
      await tracing.instrument(components.mcpServer, 'mcp');
      logger.info('MCP server instrumented with tracing');
    }

    if (components.swarmOrchestrator) {
      await tracing.instrument(components.swarmOrchestrator, 'swarm');
      logger.info('Swarm orchestrator instrumented with tracing');
    }

    if (components.hooksManager) {
      await tracing.instrument(components.hooksManager, 'hooks');
      logger.info('Hooks manager instrumented with tracing');
    }

    if (components.memoryStore) {
      await tracing.instrument(components.memoryStore, 'memory');
      logger.info('Memory store instrumented with tracing');
    }

    // Set up graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down tracing...');
      await tracing.shutdown();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down tracing...');
      await tracing.shutdown();
      process.exit(0);
    });

    // Set up periodic health checks
    setInterval(async () => {
      const health = await tracing.healthCheck();
      if (health.status !== 'healthy') {
        logger.warn('Tracing health check failed', health);
      }
    }, 60000); // Check every minute

    initialized = true;
    logger.info('Claude-Flow tracing auto-initialization complete');
    
    return tracing;
  } catch (error) {
    logger.error('Failed to auto-initialize tracing', error);
    throw error;
  }
}

/**
 * Create a tracing-enabled wrapper for any function
 */
export function withTracing(name, fn, metadata = {}) {
  return async (...args) => {
    if (!tracing.isEnabled()) {
      return await fn(...args);
    }

    return await tracing.trace(name, () => fn(...args), metadata);
  };
}

/**
 * Create a decorator for automatic method tracing
 */
export function traced(name, metadata = {}) {
  return function(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function(...args) {
      if (!tracing.isEnabled()) {
        return originalMethod.apply(this, args);
      }

      const traceName = name || `${target.constructor.name}.${propertyKey}`;
      return await tracing.trace(traceName, () => originalMethod.apply(this, args), metadata);
    };
    
    return descriptor;
  };
}

/**
 * Express middleware factory with tracing
 */
export function createTracingMiddleware(options = {}) {
  return (req, res, next) => {
    if (!tracing.isEnabled()) {
      return next();
    }

    const middleware = tracing.getExpressMiddleware();
    middleware(req, res, next);
  };
}

/**
 * Get tracing status
 */
export function getTracingStatus() {
  return {
    initialized,
    enabled: tracing.isEnabled(),
    manager: tracing
  };
}

/**
 * Manual tracing controls
 */
export const controls = {
  async start(components) {
    return await autoInitTracing(components);
  },
  
  async stop() {
    await tracing.shutdown();
    initialized = false;
  },
  
  async restart(components) {
    await this.stop();
    return await this.start(components);
  },
  
  async flush() {
    await tracing.flush();
  },
  
  async healthCheck() {
    return await tracing.healthCheck();
  },
  
  async metrics() {
    return await tracing.generateMetrics();
  }
};

// Export singleton
export { tracing };
export default { autoInitTracing, withTracing, traced, createTracingMiddleware, getTracingStatus, controls, tracing };