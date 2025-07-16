/**
 * Tracing Module Entry Point for Claude-Flow
 * Provides unified access to all tracing functionality
 */

import TracingConfig from './config.js';
import LangfuseClient from './langfuse-client.js';
import Instrumentation from './instrumentation.js';
import logger from '../utils/logger.js';

export class TracingManager {
  constructor(options = {}) {
    this.config = new TracingConfig(options);
    this.client = null;
    this.instrumentation = null;
    this.initialized = false;
    this.context = {
      sessionId: null,
      swarmId: null,
      agentId: null
    };
  }

  /**
   * Initialize tracing system
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // Initialize Langfuse client
      this.client = new LangfuseClient(this.config.getClientConfig());
      
      // Initialize instrumentation
      this.instrumentation = new Instrumentation(this.config.getClientConfig());
      
      // Set up default hooks
      this.setupDefaultHooks();
      
      this.initialized = true;
      
      logger.info('Tracing manager initialized successfully', {
        enabled: this.config.getConfig().enabled,
        baseUrl: this.config.getConfig().baseUrl
      });
      
      // Store initialization info
      await this.client.createTrace('tracing.initialized', {
        config: this.config.getConfig(),
        timestamp: new Date().toISOString()
      }, {
        type: 'system_initialization',
        version: this.config.getConfig().version
      });
      
    } catch (error) {
      logger.error('Failed to initialize tracing manager', error);
      throw error;
    }
  }

  /**
   * Set up default hooks for common operations
   */
  setupDefaultHooks() {
    // Hook for performance monitoring
    this.instrumentation.addHook('afterOperation', async (data) => {
      if (data.duration > 5000) { // Log slow operations
        logger.warn(`Slow operation detected: ${data.type}`, {
          operation: data.name || data.method,
          duration: data.duration
        });
      }
    });

    // Hook for error tracking
    this.instrumentation.addHook('onError', async (data) => {
      logger.error(`Operation failed: ${data.type}`, {
        operation: data.name || data.method,
        error: data.error?.message,
        duration: data.duration
      });
    });

    // Hook for memory usage tracking
    this.instrumentation.addHook('afterOperation', async (data) => {
      if (data.type === 'memory_operation') {
        const memUsage = process.memoryUsage();
        if (memUsage.heapUsed > 500 * 1024 * 1024) { // 500MB
          logger.warn('High memory usage detected', {
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
            operation: data.operation
          });
        }
      }
    });
  }

  /**
   * Set context for all traces
   */
  setContext(context) {
    this.context = { ...this.context, ...context };
    
    if (this.client) {
      this.client.setContext(this.context);
    }
    
    if (this.instrumentation) {
      this.instrumentation.setContext(this.context);
    }
  }

  /**
   * Instrument a component
   */
  async instrument(component, type) {
    if (!this.initialized) {
      await this.initialize();
    }

    const config = this.config.getInstrumentationConfig();
    
    switch (type) {
      case 'mcp':
        if (config.instrumentMCP) {
          this.instrumentation.instrumentMCPServer(component);
        }
        break;
        
      case 'swarm':
        if (config.instrumentSwarm) {
          this.instrumentation.instrumentSwarmOrchestrator(component);
        }
        break;
        
      case 'hooks':
        if (config.instrumentHooks) {
          this.instrumentation.instrumentHooksManager(component);
        }
        break;
        
      case 'memory':
        if (config.instrumentMemory) {
          this.instrumentation.instrumentMemoryStore(component);
        }
        break;
        
      default:
        logger.warn(`Unknown instrumentation type: ${type}`);
    }
  }

  /**
   * Create a manual trace
   */
  async trace(name, fn, metadata = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    const result = await this.instrumentation.startTrace(name, {}, metadata);
    if (!result) {
      return await fn();
    }

    const { traceId } = result;
    
    try {
      const output = await fn();
      await this.instrumentation.endTrace(traceId, { output }, true);
      return output;
    } catch (error) {
      await this.instrumentation.endTrace(traceId, { error: error.message }, false);
      throw error;
    }
  }

  /**
   * Add a score to the current trace
   */
  async addScore(traceId, name, value, comment = null) {
    if (!this.initialized) return;
    await this.instrumentation.addScore(traceId, name, value, comment);
  }

  /**
   * Get Express middleware for HTTP tracing
   */
  getExpressMiddleware() {
    if (!this.initialized || !this.client) {
      return (req, res, next) => next();
    }
    
    return this.client.expressMiddleware();
  }

  /**
   * Get performance decorator
   */
  getPerformanceDecorator() {
    if (!this.initialized || !this.instrumentation) {
      return (target, propertyKey, descriptor) => descriptor;
    }
    
    return this.instrumentation.createPerformanceDecorator();
  }

  /**
   * Generate system metrics
   */
  async generateMetrics() {
    if (!this.initialized) return {};

    const status = this.instrumentation.getStatus();
    const config = this.config.getConfig();
    
    return {
      tracing: {
        enabled: config.enabled,
        initialized: this.initialized,
        activeOperations: status.activeOperations,
        instrumentedMethods: status.instrumentedMethods,
        context: this.context
      },
      client: status.langfuse,
      config: {
        sampleRate: config.sampleRate,
        flushAt: config.flushAt,
        flushInterval: config.flushInterval,
        environment: config.environment,
        version: config.version
      },
      system: {
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        pid: process.pid,
        platform: process.platform,
        nodeVersion: process.version
      }
    };
  }

  /**
   * Export traces for analysis
   */
  async exportTraces(options = {}) {
    if (!this.initialized) return null;

    const metrics = await this.generateMetrics();
    const timestamp = new Date().toISOString();
    
    return {
      exportedAt: timestamp,
      metrics,
      config: this.config.getConfig(),
      context: this.context,
      format: options.format || 'json',
      version: '1.0.0'
    };
  }

  /**
   * Health check for tracing system
   */
  async healthCheck() {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {}
    };

    // Check if tracing is enabled
    health.checks.enabled = {
      status: this.config.getConfig().enabled ? 'pass' : 'warn',
      message: this.config.getConfig().enabled ? 'Tracing is enabled' : 'Tracing is disabled'
    };

    // Check if initialized
    health.checks.initialized = {
      status: this.initialized ? 'pass' : 'fail',
      message: this.initialized ? 'Tracing is initialized' : 'Tracing is not initialized'
    };

    // Check client connection
    if (this.client) {
      const clientStatus = this.client.getStatus();
      health.checks.client = {
        status: clientStatus.initialized ? 'pass' : 'fail',
        message: clientStatus.initialized ? 'Client connected' : 'Client not connected',
        details: clientStatus
      };
    }

    // Check instrumentation
    if (this.instrumentation) {
      const instrStatus = this.instrumentation.getStatus();
      health.checks.instrumentation = {
        status: instrStatus.enabled ? 'pass' : 'fail',
        message: instrStatus.enabled ? 'Instrumentation active' : 'Instrumentation inactive',
        details: instrStatus
      };
    }

    // Overall health
    const allChecks = Object.values(health.checks);
    const failedChecks = allChecks.filter(check => check.status === 'fail');
    
    if (failedChecks.length > 0) {
      health.status = 'unhealthy';
    } else if (allChecks.some(check => check.status === 'warn')) {
      health.status = 'degraded';
    }

    return health;
  }

  /**
   * Flush all traces
   */
  async flush() {
    if (!this.initialized) return;
    
    await this.instrumentation.flush();
    logger.debug('All traces flushed');
  }

  /**
   * Shutdown tracing system
   */
  async shutdown() {
    if (!this.initialized) return;

    try {
      await this.flush();
      await this.instrumentation.shutdown();
      this.initialized = false;
      
      logger.info('Tracing manager shutdown complete');
    } catch (error) {
      logger.error('Error during tracing shutdown', error);
      throw error;
    }
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return this.config.getConfig();
  }

  /**
   * Update configuration
   */
  updateConfig(updates) {
    this.config.updateConfig(updates);
  }

  /**
   * Check if tracing is enabled
   */
  isEnabled() {
    return this.config.getConfig().enabled && this.initialized;
  }

  /**
   * Get client instance (for advanced usage)
   */
  getClient() {
    return this.client;
  }

  /**
   * Get instrumentation instance (for advanced usage)
   */
  getInstrumentation() {
    return this.instrumentation;
  }
}

// Export classes for direct usage
export { TracingConfig, LangfuseClient, Instrumentation };

// Export singleton instance
export const tracing = new TracingManager();

export default TracingManager;