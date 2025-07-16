/**
 * Auto-registration module for Claude Flow
 * Automatically integrates Langfuse tracing when Claude Flow initializes
 */

import { langfuseWrapper } from './index';
import { createHookEnhancer } from './hook-enhancer';
import { claudeFlowIntegration } from './claude-flow-integration';

export interface ClaudeFlowConfig {
  hooks?: Record<string, (...args: any[]) => any>;
  hookManager?: any;
  enableLangfuse?: boolean;
  langfuseConfig?: {
    publicKey?: string;
    secretKey?: string;
    host?: string;
  };
}

/**
 * Auto-register Langfuse with Claude Flow during initialization
 */
export function autoRegisterLangfuse(claudeFlowConfig: ClaudeFlowConfig): ClaudeFlowConfig {
  // Check if Langfuse should be enabled
  const shouldEnable = claudeFlowConfig.enableLangfuse !== false && 
    (process.env.LANGFUSE_PUBLIC_KEY || claudeFlowConfig.langfuseConfig?.publicKey);

  if (!shouldEnable) {
    console.log('Langfuse auto-registration skipped - no API keys found');
    return claudeFlowConfig;
  }

  // Initialize Langfuse if config provided
  if (claudeFlowConfig.langfuseConfig) {
    const wrapper = new (require('./index').LangfuseWrapper)(claudeFlowConfig.langfuseConfig);
    // Replace singleton if custom config provided
    Object.setPrototypeOf(langfuseWrapper, wrapper);
  }

  console.log('Auto-registering Langfuse with Claude Flow...');

  // Enhance hooks if provided
  if (claudeFlowConfig.hooks) {
    const enhancer = createHookEnhancer({
      enableTracing: true,
      estimateTokens: true,
      traceMetadata: {
        source: 'claude-flow',
        auto_registered: true
      }
    });

    claudeFlowConfig.hooks = enhancer.enhanceAll(claudeFlowConfig.hooks as Record<string, (...args: any[]) => any>);
    console.log(`Enhanced ${Object.keys(claudeFlowConfig.hooks).length} hooks with Langfuse tracing`);
  }

  // Register with hook manager if provided
  if (claudeFlowConfig.hookManager) {
    claudeFlowIntegration.registerWithClaudeFlow(claudeFlowConfig.hookManager);
    console.log('Registered Langfuse integration with hook manager');
  }

  // Add shutdown handler
  process.on('SIGINT', async () => {
    console.log('Shutting down Langfuse...');
    await langfuseWrapper.shutdown();
  });

  process.on('SIGTERM', async () => {
    console.log('Shutting down Langfuse...');
    await langfuseWrapper.shutdown();
  });

  return claudeFlowConfig;
}

/**
 * Create a Claude Flow plugin for Langfuse
 */
export function createLangfusePlugin() {
  return {
    name: 'langfuse-tracing',
    version: '1.0.0',
    
    initialize: async (claudeFlow: any) => {
      console.log('Initializing Langfuse plugin for Claude Flow');
      
      // Auto-register if environment variables are set
      if (process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY) {
        autoRegisterLangfuse({
          hooks: claudeFlow.hooks,
          hookManager: claudeFlow.hookManager,
          enableLangfuse: true
        });
      }
    },
    
    beforeHook: async (hookType: string, options: any) => {
      // Add trace context to hook options
      if (langfuseWrapper.isEnabled()) {
        options._langfuseContext = {
          hookType,
          timestamp: Date.now()
        };
      }
    },
    
    afterHook: async (hookType: string, options: any, _result: any) => {
      // Log hook execution metrics
      if (options._langfuseContext) {
        const duration = Date.now() - options._langfuseContext.timestamp;
        console.debug(`Hook ${hookType} completed in ${duration}ms`);
      }
    },
    
    shutdown: async () => {
      console.log('Shutting down Langfuse plugin');
      await langfuseWrapper.shutdown();
    }
  };
}

/**
 * Helper to check if Langfuse is properly configured
 */
export function isLangfuseConfigured(): boolean {
  return !!(process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY);
}

/**
 * Get Langfuse configuration from environment
 */
export function getLangfuseConfig() {
  return {
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    host: process.env.LANGFUSE_HOST || 'https://cloud.langfuse.com',
    enabled: isLangfuseConfigured()
  };
}

/**
 * Export convenience method for Claude Flow init files
 */
export function withLangfuseTracing(claudeFlowInit: Function) {
  return async (...args: any[]) => {
    // Initialize Claude Flow
    const result = await claudeFlowInit(...args);
    
    // Auto-register Langfuse if configured
    if (isLangfuseConfigured()) {
      autoRegisterLangfuse({
        hooks: result.hooks,
        hookManager: result.hookManager,
        enableLangfuse: true
      });
    }
    
    return result;
  };
}