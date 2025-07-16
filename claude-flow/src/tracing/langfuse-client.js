/**
 * Langfuse Tracing Client for Claude-Flow
 * Native SDK integration for comprehensive tracing
 */

import { Langfuse } from 'langfuse';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';

export class LangfuseClient {
  constructor(options = {}) {
    this.config = {
      secretKey: options.secretKey || process.env.LANGFUSE_SECRET_KEY,
      publicKey: options.publicKey || process.env.LANGFUSE_PUBLIC_KEY,
      baseUrl: options.baseUrl || process.env.LANGFUSE_HOST || 'https://cloud.langfuse.com',
      debug: options.debug || process.env.LANGFUSE_DEBUG === 'true',
      enabled: options.enabled !== false && process.env.LANGFUSE_ENABLED !== 'false'
    };

    this.initialized = false;
    this.client = null;
    this.activeTraces = new Map();
    this.activeSpans = new Map();
    this.sessionId = null;
    this.swarmId = null;
    this.agentId = null;

    if (this.config.enabled) {
      this.initialize();
    }
  }

  /**
   * Initialize the Langfuse client
   */
  initialize() {
    if (!this.config.secretKey || !this.config.publicKey) {
      logger.warn('Langfuse credentials not provided, tracing disabled');
      this.config.enabled = false;
      return;
    }

    try {
      this.client = new Langfuse({
        secretKey: this.config.secretKey,
        publicKey: this.config.publicKey,
        baseUrl: this.config.baseUrl,
        debug: this.config.debug,
        flushAt: 10,
        flushInterval: 1000,
        requestTimeout: 10000
      });

      this.initialized = true;
      logger.info('Langfuse client initialized successfully', {
        baseUrl: this.config.baseUrl,
        debug: this.config.debug
      });
    } catch (error) {
      logger.error('Failed to initialize Langfuse client', error);
      this.config.enabled = false;
    }
  }

  /**
   * Set context for all subsequent traces
   */
  setContext(context) {
    this.sessionId = context.sessionId;
    this.swarmId = context.swarmId;
    this.agentId = context.agentId;
  }

  /**
   * Create a new trace
   */
  async createTrace(name, input = {}, metadata = {}) {
    if (!this.isEnabled()) return null;

    try {
      const traceId = uuidv4();
      const trace = this.client.trace({
        id: traceId,
        name,
        input,
        metadata: {
          ...metadata,
          sessionId: this.sessionId,
          swarmId: this.swarmId,
          agentId: this.agentId,
          claudeFlowVersion: '2.0.0',
          timestamp: new Date().toISOString()
        },
        tags: ['claude-flow', 'mcp', 'swarm']
      });

      this.activeTraces.set(traceId, trace);
      
      logger.debug(`Created trace: ${traceId} (${name})`);
      return { traceId, trace };
    } catch (error) {
      logger.error('Failed to create trace', error);
      return null;
    }
  }

  /**
   * Update a trace with output and status
   */
  async updateTrace(traceId, output = {}, status = 'completed', metadata = {}) {
    if (!this.isEnabled()) return;

    try {
      const trace = this.activeTraces.get(traceId);
      if (!trace) {
        logger.warn(`Trace ${traceId} not found`);
        return;
      }

      trace.update({
        output,
        level: status === 'error' ? 'ERROR' : 'DEFAULT',
        statusMessage: status,
        metadata: {
          ...metadata,
          endTime: new Date().toISOString(),
          status
        }
      });

      logger.debug(`Updated trace: ${traceId} (${status})`);
    } catch (error) {
      logger.error('Failed to update trace', error);
    }
  }

  /**
   * Create a span within a trace
   */
  async createSpan(traceId, name, input = {}, metadata = {}) {
    if (!this.isEnabled()) return null;

    try {
      const trace = this.activeTraces.get(traceId);
      if (!trace) {
        logger.warn(`Trace ${traceId} not found for span creation`);
        return null;
      }

      const spanId = uuidv4();
      const span = trace.span({
        id: spanId,
        name,
        input,
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString()
        }
      });

      this.activeSpans.set(spanId, span);
      
      logger.debug(`Created span: ${spanId} (${name}) in trace ${traceId}`);
      return { spanId, span };
    } catch (error) {
      logger.error('Failed to create span', error);
      return null;
    }
  }

  /**
   * Update a span with output and status
   */
  async updateSpan(spanId, output = {}, status = 'completed', metadata = {}) {
    if (!this.isEnabled()) return;

    try {
      const span = this.activeSpans.get(spanId);
      if (!span) {
        logger.warn(`Span ${spanId} not found`);
        return;
      }

      span.update({
        output,
        level: status === 'error' ? 'ERROR' : 'DEFAULT',
        statusMessage: status,
        metadata: {
          ...metadata,
          endTime: new Date().toISOString(),
          status
        }
      });

      logger.debug(`Updated span: ${spanId} (${status})`);
    } catch (error) {
      logger.error('Failed to update span', error);
    }
  }

  /**
   * Create a generation (LLM call) within a trace
   */
  async createGeneration(traceId, name, input = {}, model = 'claude-3-5-sonnet-20241022', metadata = {}) {
    if (!this.isEnabled()) return null;

    try {
      const trace = this.activeTraces.get(traceId);
      if (!trace) {
        logger.warn(`Trace ${traceId} not found for generation creation`);
        return null;
      }

      const generationId = uuidv4();
      const generation = trace.generation({
        id: generationId,
        name,
        input,
        model,
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString()
        }
      });

      logger.debug(`Created generation: ${generationId} (${name}) in trace ${traceId}`);
      return { generationId, generation };
    } catch (error) {
      logger.error('Failed to create generation', error);
      return null;
    }
  }

  /**
   * Update a generation with output and usage
   */
  async updateGeneration(generationId, output = {}, usage = {}, metadata = {}) {
    if (!this.isEnabled()) return;

    try {
      // Note: In a real implementation, you would need to track generations
      // For now, we'll log the update
      logger.debug(`Updated generation: ${generationId}`, {
        output,
        usage,
        metadata
      });
    } catch (error) {
      logger.error('Failed to update generation', error);
    }
  }

  /**
   * Score a trace or span
   */
  async score(traceId, spanId = null, name, value, comment = null, metadata = {}) {
    if (!this.isEnabled()) return;

    try {
      this.client.score({
        traceId,
        spanId,
        name,
        value,
        comment,
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString()
        }
      });

      logger.debug(`Added score: ${name} = ${value} for trace ${traceId}`);
    } catch (error) {
      logger.error('Failed to add score', error);
    }
  }

  /**
   * Instrument MCP tool calls
   */
  async instrumentMCPCall(toolName, input, traceId = null) {
    if (!this.isEnabled()) return { traceId: null, spanId: null };

    try {
      let trace, span;
      
      if (traceId) {
        // Create span in existing trace
        const result = await this.createSpan(traceId, `mcp.${toolName}`, input, {
          type: 'mcp_tool_call',
          toolName
        });
        if (result) {
          span = result.span;
          return { traceId, spanId: result.spanId };
        }
      } else {
        // Create new trace
        const result = await this.createTrace(`mcp.${toolName}`, input, {
          type: 'mcp_tool_call',
          toolName
        });
        if (result) {
          trace = result.trace;
          traceId = result.traceId;
          return { traceId, spanId: null };
        }
      }
    } catch (error) {
      logger.error('Failed to instrument MCP call', error);
    }

    return { traceId: null, spanId: null };
  }

  /**
   * Complete MCP tool call instrumentation
   */
  async completeMCPCall(traceId, spanId, output, success = true, error = null, usage = {}) {
    if (!this.isEnabled()) return;

    try {
      const metadata = {
        success,
        error: error?.message || null,
        usage,
        completedAt: new Date().toISOString()
      };

      if (spanId) {
        await this.updateSpan(spanId, output, success ? 'completed' : 'error', metadata);
      } else {
        await this.updateTrace(traceId, output, success ? 'completed' : 'error', metadata);
      }

      // Add performance score
      if (usage.duration) {
        await this.score(traceId, spanId, 'performance', usage.duration < 1000 ? 1 : 0, 
          `Duration: ${usage.duration}ms`);
      }
    } catch (error) {
      logger.error('Failed to complete MCP call instrumentation', error);
    }
  }

  /**
   * Instrument swarm operations
   */
  async instrumentSwarmOperation(operationType, operationData, traceId = null) {
    if (!this.isEnabled()) return { traceId: null, spanId: null };

    try {
      const input = {
        operationType,
        ...operationData
      };

      const metadata = {
        type: 'swarm_operation',
        operationType,
        swarmId: this.swarmId,
        agentId: this.agentId
      };

      if (traceId) {
        const result = await this.createSpan(traceId, `swarm.${operationType}`, input, metadata);
        return result ? { traceId, spanId: result.spanId } : { traceId: null, spanId: null };
      } else {
        const result = await this.createTrace(`swarm.${operationType}`, input, metadata);
        return result ? { traceId: result.traceId, spanId: null } : { traceId: null, spanId: null };
      }
    } catch (error) {
      logger.error('Failed to instrument swarm operation', error);
      return { traceId: null, spanId: null };
    }
  }

  /**
   * Instrument neural training operations
   */
  async instrumentNeuralTraining(trainingData, traceId = null) {
    if (!this.isEnabled()) return { traceId: null, spanId: null };

    try {
      const input = {
        patternType: trainingData.patternType,
        dataSize: trainingData.dataSize || 'unknown',
        iterations: trainingData.iterations || 1
      };

      const metadata = {
        type: 'neural_training',
        agentId: this.agentId,
        neuralModel: trainingData.model || 'default'
      };

      if (traceId) {
        const result = await this.createSpan(traceId, 'neural.training', input, metadata);
        return result ? { traceId, spanId: result.spanId } : { traceId: null, spanId: null };
      } else {
        const result = await this.createTrace('neural.training', input, metadata);
        return result ? { traceId: result.traceId, spanId: null } : { traceId: null, spanId: null };
      }
    } catch (error) {
      logger.error('Failed to instrument neural training', error);
      return { traceId: null, spanId: null };
    }
  }

  /**
   * Flush all pending traces
   */
  async flush() {
    if (!this.isEnabled()) return;

    try {
      await this.client.flushAsync();
      logger.debug('Flushed all traces to Langfuse');
    } catch (error) {
      logger.error('Failed to flush traces', error);
    }
  }

  /**
   * Shutdown the client
   */
  async shutdown() {
    if (!this.isEnabled()) return;

    try {
      await this.flush();
      await this.client.shutdownAsync();
      this.initialized = false;
      logger.info('Langfuse client shutdown complete');
    } catch (error) {
      logger.error('Failed to shutdown Langfuse client', error);
    }
  }

  /**
   * Check if client is enabled and initialized
   */
  isEnabled() {
    return this.config.enabled && this.initialized && this.client;
  }

  /**
   * Get client status
   */
  getStatus() {
    return {
      enabled: this.config.enabled,
      initialized: this.initialized,
      baseUrl: this.config.baseUrl,
      activeTraces: this.activeTraces.size,
      activeSpans: this.activeSpans.size,
      context: {
        sessionId: this.sessionId,
        swarmId: this.swarmId,
        agentId: this.agentId
      }
    };
  }

  /**
   * Create a middleware for Express to automatically trace requests
   */
  expressMiddleware() {
    return async (req, res, next) => {
      if (!this.isEnabled()) return next();

      try {
        const traceId = uuidv4();
        const trace = await this.createTrace(`http.${req.method}.${req.path}`, {
          method: req.method,
          url: req.url,
          headers: req.headers,
          body: req.body
        }, {
          type: 'http_request',
          userAgent: req.get('User-Agent'),
          ip: req.ip
        });

        req.langfuseTrace = trace;
        
        // Intercept response
        const originalSend = res.send;
        res.send = function(data) {
          if (trace) {
            trace.trace.update({
              output: { status: res.statusCode, data },
              level: res.statusCode >= 400 ? 'ERROR' : 'DEFAULT'
            });
          }
          return originalSend.call(this, data);
        };

        next();
      } catch (error) {
        logger.error('Express middleware error', error);
        next();
      }
    };
  }

  /**
   * Create a decorator for automatic function tracing
   */
  trace(name) {
    return (target, propertyKey, descriptor) => {
      const originalMethod = descriptor.value;
      
      descriptor.value = async function(...args) {
        if (!this.langfuseClient?.isEnabled()) {
          return originalMethod.apply(this, args);
        }

        const { traceId } = await this.langfuseClient.createTrace(name, { args });
        
        try {
          const result = await originalMethod.apply(this, args);
          await this.langfuseClient.updateTrace(traceId, { result }, 'completed');
          return result;
        } catch (error) {
          await this.langfuseClient.updateTrace(traceId, { error: error.message }, 'error');
          throw error;
        }
      };
      
      return descriptor;
    };
  }
}

export default LangfuseClient;