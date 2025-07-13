/**
 * Claude Flow Integration for Langfuse Wrapper
 * Automatically registers Langfuse tracing with Claude Flow hooks
 */

import { langfuseWrapper, LangfuseWrapper, HookContext, TokenUsage } from './index';

export interface ClaudeFlowHookResult {
  success: boolean;
  data?: any;
  error?: string;
  duration?: number;
}

export interface ClaudeFlowHookManager {
  executeHook(hookType: string, options: any): Promise<ClaudeFlowHookResult>;
}

/**
 * Integration class that wraps Claude Flow hooks with Langfuse tracing
 */
export class ClaudeFlowLangfuseIntegration {
  private wrapper: LangfuseWrapper;
  // Storing original hook manager for potential restoration
  // private _originalHookManager: ClaudeFlowHookManager | null = null;
  private traceMap: Map<string, string> = new Map(); // Maps hook execution ID to trace ID

  constructor(wrapper: LangfuseWrapper = langfuseWrapper) {
    this.wrapper = wrapper;
  }

  /**
   * Register Langfuse tracing with Claude Flow hooks
   */
  registerWithClaudeFlow(hookManager: ClaudeFlowHookManager): void {
    if (!this.wrapper.isEnabled()) {
      console.log('Langfuse is not enabled, skipping Claude Flow integration');
      return;
    }

    // this._originalHookManager = hookManager;
    
    // Wrap the executeHook method
    const originalExecuteHook = hookManager.executeHook.bind(hookManager);
    
    hookManager.executeHook = async (hookType: string, options: any): Promise<ClaudeFlowHookResult> => {
      // Create context for Langfuse
      const context: HookContext = {
        hookType,
        swarmId: options.swarmId,
        agentId: options.agentId,
        agentRole: options.agentRole,
        taskId: options.taskId,
        operationType: hookType,
        metadata: {
          ...options,
          claude_flow_hook: true
        }
      };

      // Start trace
      const traceId = await this.wrapper.preHook(context);
      
      try {
        // Execute original hook
        const result = await originalExecuteHook(hookType, options);
        
        // Extract token usage if available
        const tokenUsage = this.extractTokenUsage(result);
        
        // Complete trace with results
        await this.wrapper.postHook(traceId, result.data, tokenUsage, {
          success: result.success,
          duration_ms: result.duration,
          hook_type: hookType
        });
        
        return result;
      } catch (error) {
        // Record error
        await this.wrapper.errorHook(traceId, error as Error, {
          hook_type: hookType,
          options
        });
        
        throw error;
      }
    };

    console.log('Langfuse tracing registered with Claude Flow hooks');
  }

  /**
   * Create wrapped hook handlers for specific hook types
   */
  createHookHandlers() {
    return {
      'pre-task': async (options: any) => this.wrapPreTaskHook(options),
      'post-task': async (options: any) => this.wrapPostTaskHook(options),
      'pre-edit': async (options: any) => this.wrapPreEditHook(options),
      'post-edit': async (options: any) => this.wrapPostEditHook(options),
      'notification': async (options: any) => this.wrapNotificationHook(options),
      'pre-search': async (options: any) => this.wrapPreSearchHook(options),
      'session-start': async (options: any) => this.wrapSessionStartHook(options),
      'session-end': async (options: any) => this.wrapSessionEndHook(options),
      'session-restore': async (options: any) => this.wrapSessionRestoreHook(options)
    };
  }

  /**
   * Wrap pre-task hook
   */
  private async wrapPreTaskHook(options: any) {
    const spanId = await this.wrapper.createSpan(
      this.getCurrentTraceId() || 'standalone',
      'pre-task',
      options,
      {
        task_description: options.description,
        auto_spawn_agents: options.autoSpawnAgents,
        load_previous_context: options.loadPreviousContext
      }
    );

    if (spanId && options.taskId) {
      this.traceMap.set(`task-${options.taskId}`, spanId);
    }

    return { spanId };
  }

  /**
   * Wrap post-task hook
   */
  private async wrapPostTaskHook(options: any) {
    const spanId = this.traceMap.get(`task-${options.taskId}`);
    
    if (spanId) {
      await this.wrapper.endSpan(spanId, options, {
        analyze_performance: options.analyzePerformance,
        generate_summary: options.generateSummary
      });
      
      this.traceMap.delete(`task-${options.taskId}`);
    }

    return { completed: true };
  }

  /**
   * Wrap pre-edit hook
   */
  private async wrapPreEditHook(options: any) {
    const spanId = await this.wrapper.createSpan(
      this.getCurrentTraceId() || 'standalone',
      'pre-edit',
      options,
      {
        file: options.file,
        auto_assign_agent: options.autoAssignAgent
      }
    );

    return { spanId };
  }

  /**
   * Wrap post-edit hook
   */
  private async wrapPostEditHook(options: any) {
    const context: HookContext = {
      hookType: 'post-edit',
      metadata: {
        file: options.file,
        memory_key: options.memoryKey,
        auto_format: options.autoFormat,
        track_changes: options.trackChanges
      }
    };

    // Create a quick trace for the edit operation
    const traceId = await this.wrapper.preHook(context);
    
    await this.wrapper.postHook(traceId, {
      file: options.file,
      formatted: options.autoFormat,
      memoryKey: options.memoryKey
    });

    return { traced: true };
  }

  /**
   * Wrap notification hook
   */
  private async wrapNotificationHook(options: any) {
    const context: HookContext = {
      hookType: 'notification',
      metadata: {
        message: options.message,
        category: options.category,
        telemetry: options.telemetry
      }
    };

    const traceId = await this.wrapper.preHook(context);
    
    await this.wrapper.postHook(traceId, {
      message: options.message,
      stored: true
    });

    return { traced: true };
  }

  /**
   * Wrap pre-search hook
   */
  private async wrapPreSearchHook(options: any) {
    const spanId = await this.wrapper.createSpan(
      this.getCurrentTraceId() || 'standalone',
      'pre-search',
      options,
      {
        query: options.query,
        cache_results: options.cacheResults,
        suggest_optimizations: options.suggestOptimizations
      }
    );

    return { spanId };
  }

  /**
   * Wrap session-start hook
   */
  private async wrapSessionStartHook(options: any) {
    const context: HookContext = {
      hookType: 'session-start',
      metadata: {
        session_name: options.sessionName
      }
    };

    const traceId = await this.wrapper.preHook(context);
    
    // Store the trace ID for the session
    if (options.sessionId) {
      this.traceMap.set(`session-${options.sessionId}`, traceId || '');
    }

    return { traceId };
  }

  /**
   * Wrap session-end hook
   */
  private async wrapSessionEndHook(options: any) {
    const traceId = this.traceMap.get(`session-${options.sessionId}`);
    
    if (traceId) {
      await this.wrapper.postHook(traceId, {
        export_metrics: options.exportMetrics,
        generate_summary: options.generateSummary
      });
      
      this.traceMap.delete(`session-${options.sessionId}`);
    }

    return { completed: true };
  }

  /**
   * Wrap session-restore hook
   */
  private async wrapSessionRestoreHook(options: any) {
    const context: HookContext = {
      hookType: 'session-restore',
      metadata: {
        session_id: options.sessionId,
        load_memory: options.loadMemory
      }
    };

    const traceId = await this.wrapper.preHook(context);
    
    await this.wrapper.postHook(traceId, {
      restored: true,
      sessionId: options.sessionId
    });

    return { traced: true };
  }

  /**
   * Extract token usage from hook result
   */
  private extractTokenUsage(result: ClaudeFlowHookResult): TokenUsage | undefined {
    if (!result.data) return undefined;

    // Check for token usage in various formats
    if (result.data.tokens) {
      return result.data.tokens;
    }

    if (result.data.tokenUsage) {
      return result.data.tokenUsage;
    }

    if (result.data.metrics?.tokens) {
      return result.data.metrics.tokens;
    }

    // Estimate based on text length if available
    if (result.data.prompt && result.data.response) {
      return {
        input: Math.ceil(result.data.prompt.length / 4), // Rough estimation
        output: Math.ceil(result.data.response.length / 4)
      };
    }

    return undefined;
  }

  /**
   * Get current trace ID (if in an active trace context)
   */
  private getCurrentTraceId(): string | null {
    // This would need to be implemented based on Claude Flow's context management
    // For now, return null to create standalone traces
    return null;
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    await this.wrapper.shutdown();
    this.traceMap.clear();
  }
}

// Export singleton integration instance
export const claudeFlowIntegration = new ClaudeFlowLangfuseIntegration();

// Auto-registration helper
export function autoRegisterLangfuse(hookManager: ClaudeFlowHookManager): void {
  if (process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY) {
    claudeFlowIntegration.registerWithClaudeFlow(hookManager);
  }
}