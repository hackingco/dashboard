/**
 * Example integration showing how to use Langfuse wrapper with Claude Flow
 */

import { langfuseWrapper, HookContext } from './index';
import { enhanceHook, createHookEnhancer, langfuseTracingMiddleware } from './hook-enhancer';
import { autoRegisterLangfuse, createLangfusePlugin } from './auto-register';

// Example 1: Manual tracing in a Claude Flow hook
export async function exampleManualTracing() {
  // Start a trace
  const context: HookContext = {
    hookType: 'example-task',
    swarmId: 'swarm-123',
    agentId: 'agent-456',
    agentRole: 'coder',
    metadata: {
      task: 'implement-feature',
      priority: 'high'
    }
  };

  const traceId = await langfuseWrapper.preHook(context);

  try {
    // Do some work...
    const result = await performTask();

    // Track token usage
    await langfuseWrapper.postHook(traceId, result, {
      input: 150,
      output: 250
    }, {
      feature: 'authentication',
      language: 'typescript'
    });
  } catch (error) {
    // Track errors
    await langfuseWrapper.errorHook(traceId, error as Error);
  }
}

// Example 2: Using the hook enhancer
export function exampleHookEnhancer() {
  // Original hook function
  async function myCustomHook(options: any) {
    console.log('Executing custom hook with options:', options);
    // Do some work...
    return { success: true, data: 'result' };
  }

  // Enhance it with tracing
  const tracedHook = enhanceHook('my-custom-hook', myCustomHook, {
    enableTracing: true,
    estimateTokens: true,
    traceMetadata: {
      category: 'custom',
      version: '1.0.0'
    }
  });

  // Use the enhanced hook
  return tracedHook({ taskId: 'task-789' });
}

// Example 3: Batch enhancing multiple hooks
export function exampleBatchEnhancement() {
  const myHooks = {
    preProcess: async (data: any) => {
      console.log('Pre-processing:', data);
      return { processed: true };
    },
    
    mainProcess: async (data: any) => {
      console.log('Main processing:', data);
      return { result: 'completed' };
    },
    
    postProcess: async (data: any) => {
      console.log('Post-processing:', data);
      return { finalized: true };
    }
  };

  // Create enhancer with default options
  const enhancer = createHookEnhancer({
    enableTracing: true,
    estimateTokens: false,
    traceMetadata: {
      pipeline: 'data-processing'
    }
  });

  // Enhance all hooks
  const tracedHooks = enhancer.enhanceAll(myHooks);
  
  return tracedHooks;
}

// Example 4: Claude Flow initialization with auto-registration
export function exampleClaudeFlowInit() {
  const claudeFlowConfig = {
    hooks: {
      'pre-task': async (options: any) => {
        console.log('Pre-task hook:', options);
        return { taskId: 'generated-id' };
      },
      'post-task': async (options: any) => {
        console.log('Post-task hook:', options);
        return { completed: true };
      }
    },
    enableLangfuse: true,
    langfuseConfig: {
      publicKey: process.env.LANGFUSE_PUBLIC_KEY,
      secretKey: process.env.LANGFUSE_SECRET_KEY
    }
  };

  // Auto-register will enhance all hooks
  const enhancedConfig = autoRegisterLangfuse(claudeFlowConfig);
  
  return enhancedConfig;
}

// Example 5: Using as Express middleware
export function exampleExpressApp() {
  const express = require('express');
  const app = express();

  // Add Langfuse tracing middleware
  app.use(langfuseTracingMiddleware);

  app.get('/api/swarms/:id', async (req: any, res: any) => {
    // Your endpoint logic here
    // Tracing is automatic!
    res.json({ swarmId: req.params.id, status: 'active' });
  });

  return app;
}

// Example 6: Using the plugin system
export async function examplePluginUsage() {
  // Create Claude Flow instance (mock)
  const claudeFlow = {
    hooks: {},
    hookManager: {
      executeHook: async (type: string, _options: any) => {
        console.log(`Executing ${type} hook`);
        return { success: true };
      }
    },
    plugins: [] as any[]
  };

  // Create and register Langfuse plugin
  const langfusePlugin = createLangfusePlugin();
  (claudeFlow.plugins as any[]).push(langfusePlugin);

  // Initialize plugins
  for (const plugin of claudeFlow.plugins as any[]) {
    await plugin.initialize(claudeFlow);
  }

  return claudeFlow;
}

// Example 7: Custom span creation
export async function exampleCustomSpans() {
  const traceId = await langfuseWrapper.preHook({
    hookType: 'complex-operation',
    metadata: { operation: 'multi-step' }
  });

  // Create custom spans for sub-operations
  const span1 = await langfuseWrapper.createSpan(traceId!, 'step-1-validation', {
    input: 'user-data'
  });

  // Do validation...
  await langfuseWrapper.endSpan(span1!, { valid: true });

  const span2 = await langfuseWrapper.createSpan(traceId!, 'step-2-processing', {
    validated: true
  });

  // Do processing...
  await langfuseWrapper.endSpan(span2!, { processed: 'result' });

  // Complete the trace
  await langfuseWrapper.postHook(traceId, { 
    success: true,
    steps: 2 
  });
}

// Helper function for examples
async function performTask() {
  return { success: true, result: 'task completed' };
}

// Export all examples
export const examples = {
  manualTracing: exampleManualTracing,
  hookEnhancer: exampleHookEnhancer,
  batchEnhancement: exampleBatchEnhancement,
  claudeFlowInit: exampleClaudeFlowInit,
  expressApp: exampleExpressApp,
  pluginUsage: examplePluginUsage,
  customSpans: exampleCustomSpans
};