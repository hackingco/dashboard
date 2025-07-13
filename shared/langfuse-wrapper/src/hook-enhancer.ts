/**
 * Hook Enhancer for Claude Flow
 * Enhances Claude Flow hooks with automatic Langfuse tracing
 */

import { langfuseWrapper, HookContext } from './index';

export interface EnhancedHookOptions {
  enableTracing?: boolean;
  traceMetadata?: Record<string, any>;
  estimateTokens?: boolean;
}

/**
 * Enhances a hook function with Langfuse tracing
 */
export function enhanceHook<T extends (...args: any[]) => any>(
  hookName: string,
  hookFn: T,
  options: EnhancedHookOptions = {}
): T {
  if (!options.enableTracing || !langfuseWrapper.isEnabled()) {
    return hookFn;
  }

  return (async (...args: any[]) => {
    // Extract context from arguments
    const context: HookContext = {
      hookType: hookName,
      metadata: {
        ...options.traceMetadata,
        args_count: args.length,
        timestamp: Date.now()
      }
    };

    // Extract swarm/agent info from args if available
    if (args[0] && typeof args[0] === 'object') {
      const firstArg = args[0];
      context.swarmId = firstArg.swarmId || firstArg.swarm_id;
      context.agentId = firstArg.agentId || firstArg.agent_id;
      context.agentRole = firstArg.agentRole || firstArg.agent_role;
      context.taskId = firstArg.taskId || firstArg.task_id;
    }

    // Start trace
    const traceId = await langfuseWrapper.preHook(context);

    try {
      // Execute original hook
      const result = await hookFn(...args);

      // Estimate tokens if requested
      let tokenUsage;
      if (options.estimateTokens && result) {
        tokenUsage = estimateTokenUsage(args, result);
      }

      // Complete trace
      await langfuseWrapper.postHook(traceId, result, tokenUsage, {
        hook_name: hookName,
        execution_time: Date.now() - context.metadata!.timestamp
      });

      return result;
    } catch (error) {
      // Record error
      await langfuseWrapper.errorHook(traceId, error as Error, {
        hook_name: hookName,
        args: args
      });

      throw error;
    }
  }) as T;
}

/**
 * Batch enhance multiple hooks
 */
export function enhanceHooks(
  hooks: Record<string, (...args: any[]) => any>,
  options: EnhancedHookOptions = {}
): Record<string, (...args: any[]) => any> {
  const enhanced: Record<string, (...args: any[]) => any> = {};

  for (const [name, hook] of Object.entries(hooks)) {
    enhanced[name] = enhanceHook(name, hook, options);
  }

  return enhanced;
}

/**
 * Create a hook enhancer with preset options
 */
export function createHookEnhancer(defaultOptions: EnhancedHookOptions) {
  return {
    enhance: <T extends (...args: any[]) => any>(
      hookName: string,
      hookFn: T,
      overrides?: EnhancedHookOptions
    ) => enhanceHook(hookName, hookFn, { ...defaultOptions, ...overrides }),

    enhanceAll: (
      hooks: Record<string, (...args: any[]) => any>,
      overrides?: EnhancedHookOptions
    ) => enhanceHooks(hooks, { ...defaultOptions, ...overrides })
  };
}

/**
 * Estimate token usage based on input/output
 */
function estimateTokenUsage(input: any[], output: any): { input: number; output: number } {
  // Simple estimation based on JSON string length
  // Real implementation would use proper tokenizer
  const inputStr = JSON.stringify(input);
  const outputStr = JSON.stringify(output);

  return {
    input: Math.ceil(inputStr.length / 4), // Rough estimate: 4 chars per token
    output: Math.ceil(outputStr.length / 4)
  };
}

/**
 * Create traced versions of common Claude Flow hooks
 */
export const tracedHooks = {
  preTask: (originalHook: (...args: any[]) => any) => enhanceHook('pre-task', originalHook, {
    enableTracing: true,
    estimateTokens: true
  }),

  postTask: (originalHook: (...args: any[]) => any) => enhanceHook('post-task', originalHook, {
    enableTracing: true,
    estimateTokens: true
  }),

  preEdit: (originalHook: (...args: any[]) => any) => enhanceHook('pre-edit', originalHook, {
    enableTracing: true,
    traceMetadata: { operation: 'file_edit' }
  }),

  postEdit: (originalHook: (...args: any[]) => any) => enhanceHook('post-edit', originalHook, {
    enableTracing: true,
    traceMetadata: { operation: 'file_edit_complete' }
  }),

  notification: (originalHook: (...args: any[]) => any) => enhanceHook('notification', originalHook, {
    enableTracing: true,
    traceMetadata: { operation: 'notification' }
  }),

  preSearch: (originalHook: (...args: any[]) => any) => enhanceHook('pre-search', originalHook, {
    enableTracing: true,
    traceMetadata: { operation: 'search' }
  }),

  sessionStart: (originalHook: (...args: any[]) => any) => enhanceHook('session-start', originalHook, {
    enableTracing: true,
    traceMetadata: { operation: 'session_management' }
  }),

  sessionEnd: (originalHook: (...args: any[]) => any) => enhanceHook('session-end', originalHook, {
    enableTracing: true,
    traceMetadata: { operation: 'session_management' }
  })
};

/**
 * Middleware for Express/HTTP endpoints
 */
export function langfuseTracingMiddleware(req: any, res: any, next: any): void {
  if (!langfuseWrapper.isEnabled()) {
    return next();
  }

  const context: HookContext = {
    hookType: 'http-request',
    metadata: {
      method: req.method,
      path: req.path,
      query: req.query,
      headers: {
        'user-agent': req.headers['user-agent'],
        'content-type': req.headers['content-type']
      }
    }
  };

  const traceId = langfuseWrapper.preHook(context);
  const startTime = Date.now();

  // Wrap response methods
  const originalSend = res.send;
  const originalJson = res.json;

  const completeTrace = async (data: any) => {
    const duration = Date.now() - startTime;
    
    langfuseWrapper.postHook(await traceId, {
      status: res.statusCode,
      duration_ms: duration,
      response_size: data ? JSON.stringify(data).length : 0
    }).catch(err => {
      console.error('Failed to complete Langfuse trace:', err);
    });
  };

  res.send = function(data: any) {
    completeTrace(data);
    return originalSend.call(this, data);
  };

  res.json = function(data: any) {
    completeTrace(data);
    return originalJson.call(this, data);
  };

  // Handle errors
  res.on('error', async (error: Error) => {
    langfuseWrapper.errorHook(await traceId, error).catch(err => {
      console.error('Failed to track error in Langfuse:', err);
    });
  });

  next();
}