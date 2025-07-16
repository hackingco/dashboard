/**
 * Trace Manager for Claude Flow
 * Manages Langfuse trace lifecycle, hierarchy, and context propagation
 */

import { AsyncLocalStorage } from 'async_hooks';
import { v4 as uuidv4 } from 'uuid';
import { performance } from 'perf_hooks';
import { Langfuse } from 'langfuse';
import { tracingConfig } from '../config/tracing-config.js';
import logger from '../utils/logger.js';

export class TraceManager {
  constructor() {
    this.config = tracingConfig;
    this.contextStorage = new AsyncLocalStorage();
    this.activeTraces = new Map();
    this.activeSpans = new Map();
    this.langfuse = null;
    this.batchQueue = [];
    this.flushTimer = null;
    this.isShuttingDown = false;
    
    this.initializeLangfuse();
    this.startPerformanceMonitoring();
  }

  /**
   * Initialize Langfuse client
   */
  initializeLangfuse() {
    const langfuseConfig = this.config.getLangfuseConfig();
    
    if (!langfuseConfig.enabled) {
      logger.info('Langfuse tracing disabled');
      return;
    }

    try {
      this.langfuse = new Langfuse({
        publicKey: langfuseConfig.publicKey,
        secretKey: langfuseConfig.secretKey,
        baseUrl: langfuseConfig.host,
        flushAt: langfuseConfig.batchSize,
        flushInterval: langfuseConfig.flushInterval,
        release: langfuseConfig.release,
        debug: langfuseConfig.debug
      });

      logger.info('Langfuse client initialized', {
        host: langfuseConfig.host,
        batchSize: langfuseConfig.batchSize,
        flushInterval: langfuseConfig.flushInterval
      });

      // Setup graceful shutdown
      process.on('SIGTERM', () => this.shutdown());
      process.on('SIGINT', () => this.shutdown());
    } catch (error) {
      logger.error('Failed to initialize Langfuse client:', error.message);
      this.langfuse = null;
    }
  }

  /**
   * Create a new trace
   */
  async createTrace(traceData) {
    if (!this.isEnabled()) {
      return this.createMockTrace(traceData);
    }

    if (!this.config.shouldSample()) {
      return this.createMockTrace(traceData);
    }

    try {
      const traceId = uuidv4();
      const context = this.getCurrentContext();
      
      const trace = {
        id: traceId,
        name: traceData.name,
        sessionId: traceData.sessionId || context?.sessionId || uuidv4(),
        userId: traceData.userId || context?.userId,
        metadata: {
          ...this.config.getBaseMetadata(),
          ...traceData.metadata,
          trace_id: traceId,
          parent_trace_id: context?.traceId,
          trace_depth: (context?.traceDepth || 0) + 1
        },
        input: this.sanitizeInput(traceData.input),
        tags: [
          ...this.config.getTraceTags(traceData.metadata || {}),
          ...(traceData.tags || [])
        ],
        startTime: performance.now(),
        timestamp: new Date().toISOString()
      };

      // Store trace context
      this.activeTraces.set(traceId, trace);

      // Send to Langfuse
      if (this.langfuse) {
        const langfuseTrace = this.langfuse.trace({
          id: traceId,
          name: trace.name,
          sessionId: trace.sessionId,
          userId: trace.userId,
          metadata: trace.metadata,
          input: trace.input,
          tags: trace.tags
        });

        trace.langfuseTrace = langfuseTrace;
      }

      logger.debug('Created trace', {
        traceId,
        name: trace.name,
        sessionId: trace.sessionId
      });

      return trace;
    } catch (error) {
      logger.error('Failed to create trace:', error.message);
      return this.createMockTrace(traceData);
    }
  }

  /**
   * Create a span within a trace
   */
  async createSpan(traceId, spanData) {
    if (!this.isEnabled()) {
      return this.createMockSpan(traceId, spanData);
    }

    try {
      const trace = this.activeTraces.get(traceId);
      if (!trace) {
        logger.warn('Cannot create span - trace not found:', traceId);
        return this.createMockSpan(traceId, spanData);
      }

      const spanId = uuidv4();
      const context = this.getCurrentContext();
      
      const span = {
        id: spanId,
        traceId,
        name: spanData.name,
        parentSpanId: context?.spanId,
        metadata: {
          ...spanData.metadata,
          span_id: spanId,
          parent_span_id: context?.spanId,
          trace_id: traceId
        },
        input: this.sanitizeInput(spanData.input),
        startTime: performance.now(),
        timestamp: new Date().toISOString()
      };

      // Store span context
      this.activeSpans.set(spanId, span);

      // Send to Langfuse
      if (this.langfuse && trace.langfuseTrace) {
        const langfuseSpan = trace.langfuseTrace.span({
          id: spanId,
          name: span.name,
          input: span.input,
          metadata: span.metadata
        });

        span.langfuseSpan = langfuseSpan;
      }

      logger.debug('Created span', {
        spanId,
        traceId,
        name: span.name,
        parentSpanId: span.parentSpanId
      });

      return span;
    } catch (error) {
      logger.error('Failed to create span:', error.message);
      return this.createMockSpan(traceId, spanData);
    }
  }

  /**
   * End a span
   */
  async endSpan(spanId, output = null, metadata = {}) {
    if (!this.isEnabled()) {
      return;
    }

    try {
      const span = this.activeSpans.get(spanId);
      if (!span) {
        logger.warn('Cannot end span - span not found:', spanId);
        return;
      }

      const endTime = performance.now();
      const duration = endTime - span.startTime;

      const finalMetadata = {
        ...span.metadata,
        ...metadata,
        duration_ms: duration,
        end_time: new Date().toISOString()
      };

      // Update Langfuse span
      if (span.langfuseSpan) {
        span.langfuseSpan.end({
          output: this.sanitizeOutput(output),
          metadata: finalMetadata
        });
      }

      // Remove from active spans
      this.activeSpans.delete(spanId);

      logger.debug('Ended span', {
        spanId,
        traceId: span.traceId,
        duration: `${duration.toFixed(2)}ms`
      });
    } catch (error) {
      logger.error('Failed to end span:', error.message);
    }
  }

  /**
   * End a trace
   */
  async endTrace(traceId, output = null, metadata = {}) {
    if (!this.isEnabled()) {
      return;
    }

    try {
      const trace = this.activeTraces.get(traceId);
      if (!trace) {
        logger.warn('Cannot end trace - trace not found:', traceId);
        return;
      }

      const endTime = performance.now();
      const duration = endTime - trace.startTime;

      const finalMetadata = {
        ...trace.metadata,
        ...metadata,
        duration_ms: duration,
        end_time: new Date().toISOString()
      };

      // Update Langfuse trace
      if (trace.langfuseTrace) {
        trace.langfuseTrace.update({
          output: this.sanitizeOutput(output),
          metadata: finalMetadata
        });
      }

      // Remove from active traces
      this.activeTraces.delete(traceId);

      logger.debug('Ended trace', {
        traceId,
        name: trace.name,
        duration: `${duration.toFixed(2)}ms`
      });
    } catch (error) {
      logger.error('Failed to end trace:', error.message);
    }
  }

  /**
   * Run function with trace context
   */
  async runWithContext(context, fn) {
    return this.contextStorage.run(context, fn);
  }

  /**
   * Get current trace context
   */
  getCurrentContext() {
    return this.contextStorage.getStore();
  }

  /**
   * Create child context
   */
  createChildContext(parentContext, updates = {}) {
    return {
      ...parentContext,
      ...updates,
      parentSpanId: parentContext?.spanId,
      traceDepth: (parentContext?.traceDepth || 0) + 1
    };
  }

  /**
   * Sanitize input data
   */
  sanitizeInput(input) {
    if (!this.config.getConfig().features.sanitizeInputs) {
      return input;
    }

    if (typeof input === 'string' && input.length > 10000) {
      return input.substring(0, 10000) + '...[truncated]';
    }

    if (typeof input === 'object' && input !== null) {
      const sanitized = { ...input };
      
      // Remove sensitive fields
      const sensitiveKeys = ['password', 'secret', 'token', 'key', 'auth'];
      for (const key of Object.keys(sanitized)) {
        if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
          sanitized[key] = '***redacted***';
        }
      }
      
      return sanitized;
    }

    return input;
  }

  /**
   * Sanitize output data
   */
  sanitizeOutput(output) {
    return this.sanitizeInput(output);
  }

  /**
   * Create mock trace for when tracing is disabled
   */
  createMockTrace(traceData) {
    return {
      id: `mock-${uuidv4()}`,
      name: traceData.name,
      sessionId: traceData.sessionId || 'mock-session',
      mock: true,
      startTime: performance.now(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Create mock span for when tracing is disabled
   */
  createMockSpan(traceId, spanData) {
    return {
      id: `mock-${uuidv4()}`,
      traceId,
      name: spanData.name,
      mock: true,
      startTime: performance.now(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Check if tracing is enabled
   */
  isEnabled() {
    return this.config.isEnabled() && this.langfuse !== null;
  }

  /**
   * Force flush all pending traces
   */
  async flush() {
    if (this.langfuse) {
      try {
        await this.langfuse.flushAsync();
        logger.debug('Flushed traces to Langfuse');
      } catch (error) {
        logger.error('Failed to flush traces:', error.message);
      }
    }
  }

  /**
   * Get active trace count
   */
  getActiveTraceCount() {
    return this.activeTraces.size;
  }

  /**
   * Get active span count
   */
  getActiveSpanCount() {
    return this.activeSpans.size;
  }

  /**
   * Get performance metrics
   */
  async getMetrics() {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      activeTraces: this.activeTraces.size,
      activeSpans: this.activeSpans.size,
      memoryUsage: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external
      },
      cpuUsage: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      enabled: this.isEnabled(),
      langfuseConnected: this.langfuse !== null
    };
  }

  /**
   * Start performance monitoring
   */
  startPerformanceMonitoring() {
    if (!this.config.getConfig().performance.enableMetrics) {
      return;
    }

    const interval = this.config.getConfig().performance.metricsInterval;
    
    setInterval(async () => {
      const metrics = await this.getMetrics();
      const memoryThreshold = this.config.getConfig().performance.memoryThreshold;
      
      if (metrics.memoryUsage.heapUsed > memoryThreshold) {
        logger.warn('High memory usage detected', {
          heapUsed: metrics.memoryUsage.heapUsed,
          threshold: memoryThreshold,
          activeTraces: metrics.activeTraces,
          activeSpans: metrics.activeSpans
        });
        
        // Cleanup old traces
        await this.cleanup();
      }
    }, interval);
  }

  /**
   * Cleanup old traces and spans
   */
  async cleanup() {
    const cutoffTime = performance.now() - 300000; // 5 minutes
    
    // Cleanup old traces
    for (const [traceId, trace] of this.activeTraces) {
      if (trace.startTime < cutoffTime) {
        await this.endTrace(traceId, null, { cleanup: true });
      }
    }
    
    // Cleanup old spans
    for (const [spanId, span] of this.activeSpans) {
      if (span.startTime < cutoffTime) {
        await this.endSpan(spanId, null, { cleanup: true });
      }
    }
    
    logger.info('Trace cleanup completed', {
      remainingTraces: this.activeTraces.size,
      remainingSpans: this.activeSpans.size
    });
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    if (this.isShuttingDown) return;
    
    this.isShuttingDown = true;
    logger.info('Shutting down trace manager...');
    
    try {
      // End all active spans
      for (const [spanId] of this.activeSpans) {
        await this.endSpan(spanId, null, { shutdown: true });
      }
      
      // End all active traces
      for (const [traceId] of this.activeTraces) {
        await this.endTrace(traceId, null, { shutdown: true });
      }
      
      // Final flush
      await this.flush();
      
      // Shutdown Langfuse client
      if (this.langfuse) {
        await this.langfuse.shutdownAsync();
      }
      
      logger.info('Trace manager shutdown completed');
    } catch (error) {
      logger.error('Error during trace manager shutdown:', error.message);
    }
  }
}

// Create singleton instance
export const traceManager = new TraceManager();

// Export convenience functions
export const createTrace = (traceData) => traceManager.createTrace(traceData);
export const createSpan = (traceId, spanData) => traceManager.createSpan(traceId, spanData);
export const endSpan = (spanId, output, metadata) => traceManager.endSpan(spanId, output, metadata);
export const endTrace = (traceId, output, metadata) => traceManager.endTrace(traceId, output, metadata);
export const runWithContext = (context, fn) => traceManager.runWithContext(context, fn);
export const getCurrentContext = () => traceManager.getCurrentContext();
export const flush = () => traceManager.flush();