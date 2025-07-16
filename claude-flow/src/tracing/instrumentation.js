/**
 * Instrumentation module for Claude-Flow
 * Provides automatic tracing for MCP operations, swarm coordination, and neural training
 */

import logger from '../utils/logger.js';
import LangfuseClient from './langfuse-client.js';

export class Instrumentation {
  constructor(options = {}) {
    this.langfuse = new LangfuseClient(options);
    this.instrumentedMethods = new Set();
    this.activeOperations = new Map();
    this.hooks = {
      beforeOperation: [],
      afterOperation: [],
      onError: []
    };
  }

  /**
   * Set context for all traces
   */
  setContext(context) {
    this.langfuse.setContext(context);
  }

  /**
   * Add a hook for operation lifecycle events
   */
  addHook(event, callback) {
    if (this.hooks[event]) {
      this.hooks[event].push(callback);
    }
  }

  /**
   * Execute hooks for an event
   */
  async executeHooks(event, data) {
    const hooks = this.hooks[event] || [];
    for (const hook of hooks) {
      try {
        await hook(data);
      } catch (error) {
        logger.error(`Hook execution failed for ${event}`, error);
      }
    }
  }

  /**
   * Instrument MCP server methods
   */
  instrumentMCPServer(mcpServer) {
    if (!mcpServer || !this.langfuse.isEnabled()) return;

    logger.info('Instrumenting MCP server with Langfuse tracing');

    // Override handleToolCall method
    const originalHandleToolCall = mcpServer.handleToolCall.bind(mcpServer);
    mcpServer.handleToolCall = async (name, args) => {
      const startTime = Date.now();
      
      // Start tracing
      const { traceId, spanId } = await this.langfuse.instrumentMCPCall(name, args);
      
      try {
        // Execute hooks
        await this.executeHooks('beforeOperation', { type: 'mcp_tool', name, args });
        
        // Execute original method
        const result = await originalHandleToolCall(name, args);
        
        // Complete tracing
        const duration = Date.now() - startTime;
        await this.langfuse.completeMCPCall(traceId, spanId, result, true, null, { duration });
        
        // Execute hooks
        await this.executeHooks('afterOperation', { 
          type: 'mcp_tool', 
          name, 
          args, 
          result, 
          duration 
        });
        
        return result;
      } catch (error) {
        // Complete tracing with error
        const duration = Date.now() - startTime;
        await this.langfuse.completeMCPCall(traceId, spanId, null, false, error, { duration });
        
        // Execute error hooks
        await this.executeHooks('onError', { type: 'mcp_tool', name, args, error, duration });
        
        throw error;
      }
    };

    logger.info('MCP server instrumentation complete');
  }

  /**
   * Instrument swarm orchestrator methods
   */
  instrumentSwarmOrchestrator(orchestrator) {
    if (!orchestrator || !this.langfuse.isEnabled()) return;

    logger.info('Instrumenting swarm orchestrator with Langfuse tracing');

    // List of methods to instrument
    const methodsToInstrument = [
      'initSwarm',
      'spawnAgent',
      'orchestrateTask',
      'monitorSwarm',
      'runBenchmark',
      'trainNeural'
    ];

    methodsToInstrument.forEach(methodName => {
      if (typeof orchestrator[methodName] === 'function') {
        const originalMethod = orchestrator[methodName].bind(orchestrator);
        
        orchestrator[methodName] = async (...args) => {
          const startTime = Date.now();
          
          // Start tracing
          const { traceId, spanId } = await this.langfuse.instrumentSwarmOperation(methodName, {
            args: args.length > 0 ? args[0] : {}
          });
          
          try {
            // Execute hooks
            await this.executeHooks('beforeOperation', { 
              type: 'swarm_operation', 
              method: methodName, 
              args 
            });
            
            // Execute original method
            const result = await originalMethod(...args);
            
            // Complete tracing
            const duration = Date.now() - startTime;
            await this.langfuse.completeMCPCall(traceId, spanId, result, true, null, { duration });
            
            // Execute hooks
            await this.executeHooks('afterOperation', { 
              type: 'swarm_operation', 
              method: methodName, 
              args, 
              result, 
              duration 
            });
            
            return result;
          } catch (error) {
            // Complete tracing with error
            const duration = Date.now() - startTime;
            await this.langfuse.completeMCPCall(traceId, spanId, null, false, error, { duration });
            
            // Execute error hooks
            await this.executeHooks('onError', { 
              type: 'swarm_operation', 
              method: methodName, 
              args, 
              error, 
              duration 
            });
            
            throw error;
          }
        };
      }
    });

    logger.info('Swarm orchestrator instrumentation complete');
  }

  /**
   * Instrument hooks manager
   */
  instrumentHooksManager(hooksManager) {
    if (!hooksManager || !this.langfuse.isEnabled()) return;

    logger.info('Instrumenting hooks manager with Langfuse tracing');

    const originalExecuteHook = hooksManager.executeHook.bind(hooksManager);
    hooksManager.executeHook = async (hookType, options) => {
      const startTime = Date.now();
      
      // Start tracing
      const { traceId, spanId } = await this.langfuse.instrumentSwarmOperation('hook_execution', {
        hookType,
        options
      });
      
      try {
        // Execute hooks
        await this.executeHooks('beforeOperation', { type: 'hook', hookType, options });
        
        // Execute original method
        const result = await originalExecuteHook(hookType, options);
        
        // Complete tracing
        const duration = Date.now() - startTime;
        await this.langfuse.completeMCPCall(traceId, spanId, result, true, null, { duration });
        
        // Execute hooks
        await this.executeHooks('afterOperation', { 
          type: 'hook', 
          hookType, 
          options, 
          result, 
          duration 
        });
        
        return result;
      } catch (error) {
        // Complete tracing with error
        const duration = Date.now() - startTime;
        await this.langfuse.completeMCPCall(traceId, spanId, null, false, error, { duration });
        
        // Execute error hooks
        await this.executeHooks('onError', { type: 'hook', hookType, options, error, duration });
        
        throw error;
      }
    };

    logger.info('Hooks manager instrumentation complete');
  }

  /**
   * Instrument memory store operations
   */
  instrumentMemoryStore(memoryStore) {
    if (!memoryStore || !this.langfuse.isEnabled()) return;

    logger.info('Instrumenting memory store with Langfuse tracing');

    const methodsToInstrument = ['store', 'retrieve', 'search', 'delete', 'storeBatch'];

    methodsToInstrument.forEach(methodName => {
      if (typeof memoryStore[methodName] === 'function') {
        const originalMethod = memoryStore[methodName].bind(memoryStore);
        
        memoryStore[methodName] = async (...args) => {
          const startTime = Date.now();
          
          // Start tracing
          const { traceId, spanId } = await this.langfuse.instrumentSwarmOperation(`memory.${methodName}`, {
            operation: methodName,
            key: args[0],
            namespace: args[2] || 'default'
          });
          
          try {
            // Execute hooks
            await this.executeHooks('beforeOperation', { 
              type: 'memory_operation', 
              operation: methodName, 
              args 
            });
            
            // Execute original method
            const result = await originalMethod(...args);
            
            // Complete tracing
            const duration = Date.now() - startTime;
            await this.langfuse.completeMCPCall(traceId, spanId, result, true, null, { duration });
            
            // Execute hooks
            await this.executeHooks('afterOperation', { 
              type: 'memory_operation', 
              operation: methodName, 
              args, 
              result, 
              duration 
            });
            
            return result;
          } catch (error) {
            // Complete tracing with error
            const duration = Date.now() - startTime;
            await this.langfuse.completeMCPCall(traceId, spanId, null, false, error, { duration });
            
            // Execute error hooks
            await this.executeHooks('onError', { 
              type: 'memory_operation', 
              operation: methodName, 
              args, 
              error, 
              duration 
            });
            
            throw error;
          }
        };
      }
    });

    logger.info('Memory store instrumentation complete');
  }

  /**
   * Create a performance monitoring decorator
   */
  createPerformanceDecorator() {
    return (target, propertyKey, descriptor) => {
      const originalMethod = descriptor.value;
      
      descriptor.value = async function(...args) {
        if (!this.instrumentation?.langfuse?.isEnabled()) {
          return originalMethod.apply(this, args);
        }

        const startTime = Date.now();
        const { traceId } = await this.instrumentation.langfuse.createTrace(
          `${target.constructor.name}.${propertyKey}`,
          { args }
        );
        
        try {
          const result = await originalMethod.apply(this, args);
          const duration = Date.now() - startTime;
          
          await this.instrumentation.langfuse.updateTrace(traceId, { result }, 'completed', { duration });
          
          // Add performance score
          await this.instrumentation.langfuse.score(traceId, null, 'performance', 
            duration < 1000 ? 1 : 0, `Duration: ${duration}ms`);
          
          return result;
        } catch (error) {
          const duration = Date.now() - startTime;
          await this.instrumentation.langfuse.updateTrace(traceId, { error: error.message }, 'error', { duration });
          throw error;
        }
      };
      
      return descriptor;
    };
  }

  /**
   * Start a manual trace
   */
  async startTrace(name, input, metadata) {
    if (!this.langfuse.isEnabled()) return null;
    
    const result = await this.langfuse.createTrace(name, input, metadata);
    if (result) {
      this.activeOperations.set(result.traceId, {
        name,
        startTime: Date.now(),
        type: 'manual'
      });
    }
    return result;
  }

  /**
   * End a manual trace
   */
  async endTrace(traceId, output, success = true, metadata = {}) {
    if (!this.langfuse.isEnabled()) return;
    
    const operation = this.activeOperations.get(traceId);
    if (operation) {
      const duration = Date.now() - operation.startTime;
      metadata.duration = duration;
      this.activeOperations.delete(traceId);
    }
    
    await this.langfuse.updateTrace(traceId, output, success ? 'completed' : 'error', metadata);
  }

  /**
   * Add a score to a trace
   */
  async addScore(traceId, name, value, comment = null) {
    if (!this.langfuse.isEnabled()) return;
    await this.langfuse.score(traceId, null, name, value, comment);
  }

  /**
   * Get instrumentation status
   */
  getStatus() {
    return {
      enabled: this.langfuse.isEnabled(),
      langfuse: this.langfuse.getStatus(),
      instrumentedMethods: Array.from(this.instrumentedMethods),
      activeOperations: this.activeOperations.size,
      hooks: Object.keys(this.hooks).map(key => ({ 
        event: key, 
        count: this.hooks[key].length 
      }))
    };
  }

  /**
   * Flush all traces
   */
  async flush() {
    await this.langfuse.flush();
  }

  /**
   * Shutdown instrumentation
   */
  async shutdown() {
    await this.langfuse.shutdown();
  }
}

export default Instrumentation;