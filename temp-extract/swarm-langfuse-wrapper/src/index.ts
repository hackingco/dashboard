/**
 * Langfuse Wrapper for Claude Flow Hooks Integration
 * Provides automatic observability for all swarm operations
 */

// Langfuse types (imported conditionally)
// Will be enabled when langfuse dependency is available
// type Langfuse = any;
// type LangfuseTraceClient = any;

import { EventEmitter } from 'events';

// Define types locally to avoid @swarm/types dependency
// Note: These interfaces are defined for future use when langfuse integration is fully enabled
/*interface ObservabilityContext {
  trace_id: string;
  span_id: string;
  correlation_id: string;
  swarm_id?: string;
  machine_id?: string;
  operation_type: string;
}*/

/*interface LangfuseFlySpan {
  id: string;
  trace_id: string;
  span_id: string;
  parent_span_id?: string;
  operation_type: string;
  fly_app_name?: string;
  machine_id?: string;
  swarm_id?: string;
  start_time: string;
  end_time?: string;
  duration_ms?: number;
  request_payload?: Record<string, any>;
  response_payload?: Record<string, any>;
  api_calls_count: number;
  tokens_consumed: number;
  estimated_cost: number;
  error_message?: string;
  error_code?: string;
  status: 'success' | 'error' | 'timeout' | 'in_progress';
  metadata: Record<string, any>;
  created_at: string;
}*/

/*interface ObservabilityCorrelation {
  id: string;
  correlation_id: string;
  swarm_id?: string;
  machine_state_id?: string;
  task_id?: string;
  langfuse_trace_id?: string;
  langfuse_span_id?: string;
  trustgraph_node_id?: string;
  operation_type: string;
  operation_status: 'in_progress' | 'completed' | 'failed';
  started_at: string;
  completed_at?: string;
  total_duration_ms?: number;
  total_api_calls: number;
  total_tokens: number;
  total_cost: number;
  created_at: string;
}*/

/*interface FlyAPIMetrics {
  operation: string;
  duration_ms: number;
  tokens_consumed: number;
  cost: number;
  success: boolean;
  error?: string;
  machine_id?: string;
  app_name?: string;
}*/

// Placeholder types until langfuse is available
// These types will be used when langfuse dependency is installed
// type LangfuseType = any;
// type LangfuseTraceClientType = any;

export interface LangfuseWrapperConfig {
  publicKey?: string;
  secretKey?: string;
  host?: string;
  enabled?: boolean;
  flushAt?: number;
  flushInterval?: number;
}

export interface HookContext {
  hookType: string;
  swarmId?: string;
  agentId?: string;
  agentRole?: string;
  taskId?: string;
  operationType?: string;
  metadata?: Record<string, any>;
}

export interface TokenUsage {
  input: number;
  output: number;
  total?: number;
}

export class LangfuseWrapper extends EventEmitter {
  private client: any | null = null;
  private activeTraces: Map<string, any> = new Map();
  private activeSpans: Map<string, any> = new Map();
  private enabled: boolean = false;
  private config: LangfuseWrapperConfig;

  constructor(config?: LangfuseWrapperConfig) {
    super();
    
    this.config = {
      publicKey: config?.publicKey || process.env.LANGFUSE_PUBLIC_KEY,
      secretKey: config?.secretKey || process.env.LANGFUSE_SECRET_KEY,
      host: config?.host || process.env.LANGFUSE_HOST || 'https://cloud.langfuse.com',
      enabled: config?.enabled !== false,
      flushAt: config?.flushAt || 20,
      flushInterval: config?.flushInterval || 10000
    };

    if (this.config.publicKey && this.config.secretKey && this.config.enabled) {
      this.initialize();
    }
  }

  /**
   * Initialize Langfuse client
   */
  private initialize(): void {
    try {
      // Dynamic import of Langfuse to avoid build dependency issues
      const LangfuseClass = require('langfuse').Langfuse;
      this.client = new LangfuseClass({
        publicKey: this.config.publicKey!,
        secretKey: this.config.secretKey!,
        baseUrl: this.config.host,
        flushAt: this.config.flushAt,
        flushInterval: this.config.flushInterval
      });
      
      this.enabled = true;
      this.emit('initialized');
    } catch (error) {
      console.error('Failed to initialize Langfuse client:', error);
      this.enabled = false;
    }
  }

  /**
   * Pre-hook: Start a trace for the operation with enhanced metadata
   */
  async preHook(context: HookContext): Promise<string | null> {
    if (!this.enabled || !this.client) {
      return null;
    }

    const traceId = `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Enhance metadata with comprehensive swarm information
      const enrichedMetadata = await this.enrichSpanWithMetadata({
        swarm_id: context.swarmId,
        agent_id: context.agentId,
        agent_role: context.agentRole,
        task_id: context.taskId,
        operation_type: context.operationType,
        hook_stage: 'pre',
        ...context.metadata
      }, context.metadata);

      const trace = this.client.trace({
        id: traceId,
        name: `${context.hookType}`,
        metadata: enrichedMetadata
      });

      this.activeTraces.set(traceId, trace);
      
      // Start a span for the operation with enhanced metadata
      const spanId = `span-${traceId}`;
      trace.span({
        id: spanId,
        name: context.hookType,
        startTime: new Date(),
        input: context,
        metadata: {
          ...enrichedMetadata,
          span_type: 'operation_start'
        }
      });

      this.activeSpans.set(spanId, { 
        traceId, 
        startTime: Date.now(),
        context: enrichedMetadata 
      });

      return traceId;
    } catch (error) {
      console.error('Failed to start Langfuse trace:', error);
      return null;
    }
  }

  /**
   * Post-hook: Complete the trace with results and enhanced metadata
   */
  async postHook(
    traceId: string | null, 
    result: any, 
    tokenUsage?: TokenUsage,
    metadata?: Record<string, any>
  ): Promise<void> {
    if (!this.enabled || !this.client || !traceId) {
      return;
    }

    try {
      const trace = this.activeTraces.get(traceId);
      if (!trace) {
        return;
      }

      const spanId = `span-${traceId}`;
      const spanData = this.activeSpans.get(spanId);
      
      if (spanData) {
        const duration = Date.now() - spanData.startTime;
        
        // Enhance post-hook metadata with comprehensive information
        const postHookOptions = {
          ...metadata,
          output: result,
          result: result,
          hookType: 'post-operation',
          duration_ms: duration
        };
        
        const enrichedPostMetadata = await this.enrichSpanWithMetadata({
          hook_stage: 'post',
          duration_ms: duration,
          success: true,
          span_type: 'operation_complete',
          ...metadata
        }, postHookOptions);
        
        // Update the span with enriched results
        trace.span({
          id: spanId,
          endTime: new Date(),
          output: result,
          metadata: enrichedPostMetadata
        });

        // Enhanced token usage tracking with agent-specific multipliers
        if (tokenUsage) {
          const agentMultiplier = this.getAgentTokenMultiplier(spanData.context?.agent_role);
          const adjustedTokenUsage = {
            promptTokens: Math.round(tokenUsage.input * agentMultiplier),
            completionTokens: Math.round(tokenUsage.output * agentMultiplier),
            totalTokens: Math.round((tokenUsage.total || (tokenUsage.input + tokenUsage.output)) * agentMultiplier)
          };

          trace.generation({
            name: 'enhanced_token_usage',
            model: metadata?.model || 'claude-flow',
            usage: adjustedTokenUsage,
            metadata: {
              estimated_cost: this.estimateCost(tokenUsage),
              agent_multiplier: agentMultiplier,
              agent_role: spanData.context?.agent_role,
              swarm_id: spanData.context?.swarm_id,
              coordination_context: enrichedPostMetadata.coordination_memory,
              ...metadata
            }
          });
        }

        this.activeSpans.delete(spanId);
      }

      // Update trace metadata with final enriched information
      const finalEnrichedMetadata = await this.enrichSpanWithMetadata({
        hook_stage: 'completed',
        success: true,
        ...metadata
      }, { ...metadata, result });

      trace.update({
        metadata: finalEnrichedMetadata
      });

      // Flush the trace
      await this.client.flushAsync();
      
      this.activeTraces.delete(traceId);
    } catch (error) {
      console.error('Failed to complete Langfuse trace:', error);
    }
  }

  /**
   * Error-hook: Record failures with enhanced error context
   */
  async errorHook(
    traceId: string | null,
    error: Error,
    metadata?: Record<string, any>
  ): Promise<void> {
    if (!this.enabled || !this.client || !traceId) {
      return;
    }

    try {
      const trace = this.activeTraces.get(traceId);
      if (!trace) {
        return;
      }

      const spanId = `span-${traceId}`;
      const spanData = this.activeSpans.get(spanId);
      
      if (spanData) {
        const duration = Date.now() - spanData.startTime;
        
        // Enhance error metadata with swarm context
        const errorHookOptions = {
          ...metadata,
          error: error.message,
          errorType: error.name,
          hookType: 'error-handler',
          duration_ms: duration
        };
        
        const enrichedErrorMetadata = await this.enrichSpanWithMetadata({
          hook_stage: 'error',
          duration_ms: duration,
          success: false,
          error_message: error.message,
          error_stack: error.stack,
          error_type: error.name,
          span_type: 'operation_error',
          ...metadata
        }, errorHookOptions);
        
        // Update the span with enriched error information
        trace.span({
          id: spanId,
          endTime: new Date(),
          output: { error: error.message },
          metadata: enrichedErrorMetadata
        });

        this.activeSpans.delete(spanId);
      }

      // Record enriched error event
      const errorEventMetadata = await this.enrichSpanWithMetadata({
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name
        },
        ...metadata
      }, { error: error.message, hookType: 'error-event' });

      trace.event({
        name: 'enhanced_error',
        level: 'ERROR',
        statusMessage: error.message,
        metadata: errorEventMetadata
      });

      // Update trace metadata with enriched error context
      const finalErrorMetadata = await this.enrichSpanWithMetadata({
        hook_stage: 'error',
        success: false,
        error_message: error.message,
        error_recovery_attempted: true,
        ...metadata
      }, { error: error.message, hookType: 'error-completion' });

      trace.update({
        metadata: finalErrorMetadata
      });

      // Flush the trace
      await this.client.flushAsync();
      
      this.activeTraces.delete(traceId);
    } catch (err) {
      console.error('Failed to record error in Langfuse:', err);
    }
  }

  /**
   * Create a custom span within an existing trace with enhanced metadata
   */
  async createSpan(
    traceId: string,
    name: string,
    input?: any,
    metadata?: Record<string, any>
  ): Promise<string | null> {
    if (!this.enabled || !this.client || !traceId) {
      return null;
    }

    const trace = this.activeTraces.get(traceId);
    if (!trace) {
      return null;
    }

    const spanId = `span-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Enhance span metadata with comprehensive swarm information
      const spanHookOptions = {
        ...metadata,
        input: input,
        hookType: 'custom-span',
        spanName: name
      };
      
      const enrichedSpanMetadata = await this.enrichSpanWithMetadata({
        span_name: name,
        span_type: 'custom_operation',
        hook_stage: 'span_creation',
        ...metadata
      }, spanHookOptions);

      trace.span({
        id: spanId,
        name,
        startTime: new Date(),
        input,
        metadata: enrichedSpanMetadata
      });

      this.activeSpans.set(spanId, { 
        traceId, 
        startTime: Date.now(),
        context: enrichedSpanMetadata 
      });
      
      return spanId;
    } catch (error) {
      console.error('Failed to create span:', error);
      return null;
    }
  }

  /**
   * End a custom span with enhanced metadata
   */
  async endSpan(
    spanId: string,
    output?: any,
    metadata?: Record<string, any>
  ): Promise<void> {
    if (!this.enabled || !this.client || !spanId) {
      return;
    }

    const spanData = this.activeSpans.get(spanId);
    if (!spanData) {
      return;
    }

    const trace = this.activeTraces.get(spanData.traceId);
    if (!trace) {
      return;
    }

    try {
      const duration = Date.now() - spanData.startTime;
      
      // Enhance end span metadata
      const endSpanOptions = {
        ...metadata,
        output: output,
        hookType: 'span-completion',
        duration_ms: duration
      };
      
      const enrichedEndMetadata = await this.enrichSpanWithMetadata({
        duration_ms: duration,
        span_type: 'custom_operation_complete',
        hook_stage: 'span_completion',
        success: true,
        ...metadata
      }, endSpanOptions);
      
      trace.span({
        id: spanId,
        endTime: new Date(),
        output,
        metadata: enrichedEndMetadata
      });

      this.activeSpans.delete(spanId);
    } catch (error) {
      console.error('Failed to end span:', error);
    }
  }

  /**
   * Estimate cost based on token usage
   */
  private estimateCost(tokens: TokenUsage): number {
    // Rough estimation based on Claude pricing
    // Adjust these rates based on actual model used
    const inputRate = 0.008; // per 1K tokens
    const outputRate = 0.024; // per 1K tokens
    
    return (tokens.input * inputRate + tokens.output * outputRate) / 1000;
  }

  /**
   * Enrich span with comprehensive swarm metadata
   */
  async enrichSpanWithMetadata(
    baseMetadata: Record<string, any>, 
    hookOptions?: any
  ): Promise<Record<string, any>> {
    const startTime = performance.now();
    
    try {
      // Extract agent context from hook options with fallback patterns
      const agentContext = this.extractAgentContext(hookOptions);
      
      // Get token estimation if content is available
      const tokenData = await this.estimateTokensFromContext(hookOptions);
      
      // Get coordination memory context
      const coordinationContext = await this.getCoordinationContext(agentContext.swarmId, agentContext.agentId);
      
      // Calculate performance metrics
      const latencyMs = performance.now() - startTime;
      
      return {
        ...baseMetadata,
        // Swarm identification
        swarm_id: agentContext.swarmId,
        agent_id: agentContext.agentId,
        agent_role: agentContext.agentRole,
        hook_stage: agentContext.hookStage || 'unknown',
        
        // Performance tracking
        latency_ms: Math.round(latencyMs),
        efficiency_score: this.calculateEfficiencyScore(tokenData, latencyMs),
        
        // Token integration
        token_usage: tokenData.usage,
        token_cost: tokenData.cost,
        token_strategy: tokenData.strategy,
        
        // Agent-specific multipliers
        agent_token_multiplier: this.getAgentTokenMultiplier(agentContext.agentRole),
        
        // Coordination context
        coordination_memory: coordinationContext,
        distributed_trace_id: this.generateDistributedTraceId(agentContext),
        
        // Enhanced metadata
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        claude_flow_version: process.env.CLAUDE_FLOW_VERSION || 'unknown',
        swarm_coordination_enabled: true,
        
        // Error resilience indicators
        graceful_degradation: !tokenData.error && !coordinationContext.error,
        fallback_mode: tokenData.error || coordinationContext.error
      };
    } catch (error) {
      console.error('Error enriching span metadata:', error);
      
      // Graceful degradation - return basic metadata
      return {
        ...baseMetadata,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        claude_flow_version: process.env.CLAUDE_FLOW_VERSION || 'unknown',
        enrichment_error: true,
        graceful_degradation: true,
        fallback_mode: true,
        latency_ms: Math.round(performance.now() - startTime)
      };
    }
  }

  /**
   * Extract agent context from hook options with fallback patterns
   */
  private extractAgentContext(hookOptions?: any): {
    swarmId: string | null;
    agentId: string | null;
    agentRole: string | null;
    hookStage: string | null;
  } {
    if (!hookOptions) {
      return { swarmId: null, agentId: null, agentRole: null, hookStage: null };
    }

    // Primary extraction
    let swarmId = hookOptions.swarmId || hookOptions.swarm_id;
    let agentId = hookOptions.agentId || hookOptions.agent_id;
    let agentRole = hookOptions.agentRole || hookOptions.agent_role;
    let hookStage = hookOptions.hookStage || hookOptions.hook_stage;

    // Fallback patterns from various sources
    if (!swarmId) {
      // Try to extract from task context
      swarmId = hookOptions.taskContext?.swarmId ||
                hookOptions.context?.swarmId ||
                hookOptions.metadata?.swarmId ||
                process.env.SWARM_ID ||
                this.generateSwarmIdFromContext();
    }

    if (!agentId) {
      // Try to extract from environment or generate
      agentId = hookOptions.taskContext?.agentId ||
                hookOptions.context?.agentId ||
                hookOptions.metadata?.agentId ||
                process.env.AGENT_ID ||
                this.generateAgentIdFromRole(agentRole);
    }

    if (!agentRole) {
      // Try to infer from task description or agent name
      agentRole = hookOptions.taskContext?.agentRole ||
                  hookOptions.description?.includes('researcher') ? 'researcher' :
                  hookOptions.description?.includes('coder') ? 'coder' :
                  hookOptions.description?.includes('analyst') ? 'analyst' :
                  hookOptions.description?.includes('tester') ? 'tester' :
                  hookOptions.description?.includes('coordinator') ? 'coordinator' :
                  'general';
    }

    if (!hookStage) {
      // Infer from hook type or operation
      hookStage = hookOptions.hookType?.startsWith('pre-') ? 'pre' :
                  hookOptions.hookType?.startsWith('post-') ? 'post' :
                  hookOptions.operationType === 'start' ? 'pre' :
                  hookOptions.operationType === 'complete' ? 'post' :
                  'execution';
    }

    return { swarmId, agentId, agentRole, hookStage };
  }

  /**
   * Estimate tokens from hook context
   */
  private async estimateTokensFromContext(hookOptions?: any): Promise<{
    usage: any;
    cost: number;
    strategy: string;
    error?: boolean;
  }> {
    try {
      // Simple fallback token estimation without imports
      const estimateSimpleTokens = (text: string): number => {
        return Math.ceil(text.length / 4); // Simple 4-char per token estimation
      };
      
      let inputText = '';
      let outputText = '';
      
      // Extract text content from various sources
      if (hookOptions?.input) {
        inputText = typeof hookOptions.input === 'string' ? hookOptions.input : JSON.stringify(hookOptions.input);
      }
      
      if (hookOptions?.output || hookOptions?.result) {
        const output = hookOptions.output || hookOptions.result;
        outputText = typeof output === 'string' ? output : JSON.stringify(output);
      }
      
      // Estimate if we have content
      if (inputText || outputText) {
        const inputTokens = inputText ? estimateSimpleTokens(inputText) : 0;
        const outputTokens = outputText ? estimateSimpleTokens(outputText) : 0;
        
        const usage = {
          input: inputTokens,
          output: outputTokens,
          total: inputTokens + outputTokens
        };
        
        // Simple cost estimation (Claude Sonnet rates)
        const cost = (inputTokens * 0.003 + outputTokens * 0.015) / 1000;
        
        return {
          usage,
          cost,
          strategy: 'simple_estimation'
        };
      }
      
      // Return empty usage if no content
      return {
        usage: { input: 0, output: 0, total: 0 },
        cost: 0,
        strategy: 'no_content'
      };
      
    } catch (error) {
      console.warn('Token estimation failed, using fallback:', error);
      return {
        usage: { input: 0, output: 0, total: 0 },
        cost: 0,
        strategy: 'fallback',
        error: true
      };
    }
  }

  /**
   * Get coordination context from SQLite memory
   */
  private async getCoordinationContext(swarmId: string | null, agentId: string | null): Promise<{
    activeAgents: number;
    coordinationState: string;
    lastActivity: string | null;
    error?: boolean;
  }> {
    try {
      if (!swarmId) {
        return {
          activeAgents: 0,
          coordinationState: 'uncoordinated',
          lastActivity: null
        };
      }

      // Try to get coordination data from memory database
      const { execSync } = require('child_process');
      
      // Query active agents in this swarm
      const agentQuery = `sqlite3 .swarm/memory.db "SELECT COUNT(*) FROM agent_interactions WHERE task_id LIKE '%${swarmId}%' AND timestamp > (strftime('%s', 'now') - 3600)"`;
      const activeAgents = parseInt(execSync(agentQuery, { encoding: 'utf8' }).trim()) || 0;
      
      // Get last activity
      const activityQuery = `sqlite3 .swarm/memory.db "SELECT timestamp FROM agent_interactions WHERE task_id LIKE '%${swarmId}%' ORDER BY timestamp DESC LIMIT 1"`;
      const lastActivityRaw = execSync(activityQuery, { encoding: 'utf8' }).trim();
      const lastActivity = lastActivityRaw ? new Date(parseInt(lastActivityRaw) * 1000).toISOString() : null;
      
      // Store current trace in coordination memory
      if (agentId) {
        await this.storeTraceInMemory(swarmId, agentId);
      }
      
      return {
        activeAgents,
        coordinationState: activeAgents > 1 ? 'coordinated' : 'standalone',
        lastActivity
      };
      
    } catch (error) {
      console.warn('Failed to get coordination context:', error);
      return {
        activeAgents: 0,
        coordinationState: 'error',
        lastActivity: null,
        error: true
      };
    }
  }

  /**
   * Store trace ID in SQLite for cross-agent coordination
   */
  private async storeTraceInMemory(swarmId: string, agentId: string): Promise<void> {
    try {
      const { execSync } = require('child_process');
      
      const memoryKey = `langfuse/trace/${swarmId}/${agentId}`;
      const traceData = {
        timestamp: Date.now(),
        agentId,
        swarmId,
        traceActive: true
      };
      
      const query = `sqlite3 .swarm/memory.db "INSERT OR REPLACE INTO memory_entries (key, value, namespace, metadata) VALUES ('${memoryKey}', '${JSON.stringify(traceData)}', 'langfuse', '${JSON.stringify({ type: 'trace_coordination' })}')"`;
      execSync(query);
      
    } catch (error) {
      console.warn('Failed to store trace in memory:', error);
    }
  }

  /**
   * Calculate efficiency score based on tokens and latency
   */
  private calculateEfficiencyScore(tokenData: any, latencyMs: number): number {
    if (tokenData.error || !tokenData.usage.total) {
      return 0;
    }
    
    // Higher score for more tokens per millisecond
    const tokensPerMs = tokenData.usage.total / Math.max(latencyMs, 1);
    
    // Normalize to 0-100 scale (assuming 10 tokens/ms is excellent)
    return Math.min(100, (tokensPerMs / 10) * 100);
  }

  /**
   * Get agent-specific token multipliers from token estimation strategy
   */
  private getAgentTokenMultiplier(agentRole: string | null): number {
    const multipliers: Record<string, number> = {
      'researcher': 1.2,  // Researchers handle more complex text
      'coder': 1.4,       // Code is more token-dense
      'analyst': 1.1,     // Analysis involves moderate complexity
      'tester': 1.3,      // Test code and coverage reports
      'coordinator': 1.0, // Basic coordination messages
      'architect': 1.5,   // Complex system designs
      'general': 1.0      // Default multiplier
    };
    
    return multipliers[agentRole || 'general'] || 1.0;
  }

  /**
   * Generate distributed trace ID for coordination
   */
  private generateDistributedTraceId(agentContext: any): string {
    const swarmId = agentContext.swarmId || 'unknown';
    const agentId = agentContext.agentId || 'unknown';
    const timestamp = Date.now();
    
    return `${swarmId}-${agentId}-${timestamp}`;
  }

  /**
   * Generate swarm ID from context
   */
  private generateSwarmIdFromContext(): string {
    const sessionId = process.env.SESSION_ID || Math.random().toString(36).substr(2, 9);
    return `swarm-${sessionId}`;
  }

  /**
   * Generate agent ID from role
   */
  private generateAgentIdFromRole(role: string | null): string {
    const rolePrefix = role || 'agent';
    const randomSuffix = Math.random().toString(36).substr(2, 6);
    return `${rolePrefix}-${randomSuffix}`;
  }

  /**
   * Shutdown and flush all pending traces
   */
  async shutdown(): Promise<void> {
    if (this.client && this.enabled) {
      // End all active spans
      for (const [spanId, _spanData] of this.activeSpans.entries()) {
        await this.endSpan(spanId, { status: 'interrupted' });
      }

      // Complete all active traces
      for (const [_traceId, trace] of this.activeTraces.entries()) {
        trace.update({
          metadata: {
            hook_stage: 'shutdown',
            shutdown_reason: 'graceful_shutdown'
          }
        });
      }

      await this.client.shutdownAsync();
    }

    this.activeTraces.clear();
    this.activeSpans.clear();
    this.emit('shutdown');
  }

  /**
   * Check if Langfuse is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get active trace count
   */
  getActiveTraceCount(): number {
    return this.activeTraces.size;
  }

  /**
   * Get active span count
   */
  getActiveSpanCount(): number {
    return this.activeSpans.size;
  }
}

// Additional helper functions (outside of class)

// These functions are planned for future use when langfuse dependency is available
/*
/**
 * Integrate with token enricher for enhanced tracing
 */
/*async function integrateWithTokenEnricher(
  traceId: string,
  model: string,
  input: string,
  output: string,
  options?: any
): Promise<void> {
    try {
      // Simple token metrics integration without external dependencies
      const inputTokens = Math.ceil(input.length / 4);
      const outputTokens = Math.ceil(output.length / 4);
      const totalTokens = inputTokens + outputTokens;
      const cost = (inputTokens * 0.003 + outputTokens * 0.015) / 1000;
      
      const tokenMetrics = {
        tokens: {
          input: inputTokens,
          output: outputTokens,
          total: totalTokens
        },
        cost,
        efficiency: {
          tokensPerChar: totalTokens / (input.length + output.length || 1),
          tokensPerWord: totalTokens / (input.split(/\s+/).length + output.split(/\s+/).length || 1),
          compressionRatio: totalTokens / ((input.length + output.length) / 4 || 1)
        },
        performance: {
          estimationTimeMs: 0,
          cached: false
        }
      };

      // Store token metrics in coordination memory
      if (options?.swarmId && options?.agentId) {
        await storeTokenMetricsInMemory(options.swarmId, options.agentId, tokenMetrics);
      }
      
    } catch (error) {
      console.warn('Failed to integrate with token enricher:', error);
    }
  }

/**
 * Store token metrics in SQLite for coordination
 */
/*async function storeTokenMetricsInMemory(
    swarmId: string, 
    agentId: string, 
    tokenMetrics: any
  ): Promise<void> {
    try {
      const { execSync } = require('child_process');
      
      const memoryKey = `langfuse/metrics/${swarmId}/${agentId}/${Date.now()}`;
      const metricsData = {
        timestamp: Date.now(),
        agentId,
        swarmId,
        tokenMetrics,
        source: 'langfuse_wrapper'
      };
      
      const query = `sqlite3 .swarm/memory.db "INSERT INTO memory_entries (key, value, namespace, metadata) VALUES ('${memoryKey}', '${JSON.stringify(metricsData)}', 'langfuse_metrics', '${JSON.stringify({ type: 'token_metrics' })}')"`;
      execSync(query);
      
    } catch (error) {
      console.warn('Failed to store token metrics in memory:', error);
    }
  }

/**
 * Get comprehensive swarm metrics from memory
 */
/*async function getSwarmMetrics(swarmId: string): Promise<{
    totalTraces: number;
    totalTokens: number;
    totalCost: number;
    agentActivity: Record<string, any>;
    efficiency: number;
  }> {
    try {
      const { execSync } = require('child_process');
      
      // Get all traces for this swarm
      const tracesQuery = `sqlite3 .swarm/memory.db "SELECT value FROM memory_entries WHERE namespace = 'langfuse' AND key LIKE '%${swarmId}%'"`;
      const tracesResult = execSync(tracesQuery, { encoding: 'utf8' }).trim();
      const traces = tracesResult ? tracesResult.split('\n').map((line: string) => {
        try { return JSON.parse(line); } catch { return null; }
      }).filter(Boolean) : [];

      // Get all token metrics for this swarm
      const metricsQuery = `sqlite3 .swarm/memory.db "SELECT value FROM memory_entries WHERE namespace = 'langfuse_metrics' AND key LIKE '%${swarmId}%'"`;
      const metricsResult = execSync(metricsQuery, { encoding: 'utf8' }).trim();
      const metrics = metricsResult ? metricsResult.split('\n').map((line: string) => {
        try { return JSON.parse(line); } catch { return null; }
      }).filter(Boolean) : [];

      // Calculate aggregated metrics
      const totalTokens = metrics.reduce((sum: number, m: any) => sum + (m.tokenMetrics?.tokens?.total || 0), 0);
      const totalCost = metrics.reduce((sum: number, m: any) => sum + (m.tokenMetrics?.cost || 0), 0);
      
      // Group by agent
      const agentActivity = metrics.reduce((acc: any, m: any) => {
        const agentId = m.agentId;
        if (!acc[agentId]) {
          acc[agentId] = { traces: 0, tokens: 0, cost: 0 };
        }
        acc[agentId].traces += 1;
        acc[agentId].tokens += m.tokenMetrics?.tokens?.total || 0;
        acc[agentId].cost += m.tokenMetrics?.cost || 0;
        return acc;
      }, {} as Record<string, any>);

      // Calculate efficiency score (tokens per dollar)
      const efficiency = totalCost > 0 ? totalTokens / totalCost : 0;

      return {
        totalTraces: traces.length,
        totalTokens,
        totalCost,
        agentActivity,
        efficiency
      };
      
    } catch (error) {
      console.warn('Failed to get swarm metrics:', error);
      return {
        totalTraces: 0,
        totalTokens: 0,
        totalCost: 0,
        agentActivity: {},
        efficiency: 0
      };
    }
  }

/**
 * Create comprehensive coordination report
 */
/*async function generateCoordinationReport(swarmId: string): Promise<Record<string, any>> {
    try {
      const metrics = await getSwarmMetrics(swarmId);
      // Simplified coordination context since function was moved
      const coordinationContext = {
        activeAgents: 0,
        coordinationState: 'standalone',
        lastActivity: null
      };
      
      return {
        swarmId,
        timestamp: new Date().toISOString(),
        metrics,
        coordination: coordinationContext,
        activeTraces: this.getActiveTraceCount(),
        activeSpans: this.getActiveSpanCount(),
        wrapperEnabled: this.isEnabled(),
        summary: {
          total_operations: metrics.totalTraces,
          total_cost: `$${metrics.totalCost.toFixed(6)}`,
          efficiency_score: Math.round(metrics.efficiency),
          coordination_state: coordinationContext.coordinationState,
          active_agents: coordinationContext.activeAgents
        }
      };
    } catch (error) {
      console.error('Failed to generate coordination report:', error);
      return {
        swarmId,
        timestamp: new Date().toISOString(),
        error: 'Failed to generate report',
        fallback_mode: true
      };
    }
  }
*/

// Export singleton instance
export const langfuseWrapper = new LangfuseWrapper();

// Export all core modules
export * from './swarm-tracer';
export * from './trace-context';
export * from './config';
export { ErrorHandler, ErrorSeverity, ErrorType, SwarmError, initializeErrorHandler } from './error-handler';
export * from './singleton';

// Re-export integration modules (if they exist)
try {
  // @ts-ignore
  export * from './claude-flow-integration';
} catch (e) {
  // Optional module
}

try {
  // @ts-ignore
  export * from './hook-enhancer';
} catch (e) {
  // Optional module
}

try {
  // @ts-ignore
  export * from './auto-register';
} catch (e) {
  // Optional module
}

// Export hook tracing modules (if they exist)
try {
  // @ts-ignore
  export * from './hook-tracer';
} catch (e) {
  // Optional module
}

try {
  // @ts-ignore
  export * from './hook-interceptors';
} catch (e) {
  // Optional module
}

try {
  // @ts-ignore
  export * from './traced-hook-wrapper';
} catch (e) {
  // Optional module
}

try {
  // @ts-ignore
  export * from './hook-tracing-integration';
} catch (e) {
  // Optional module
}

// Export real-time tracing modules
try {
  export * from './real-time-observer';
  export * from './streaming-trace-integration';
  export * from './live-dashboard';
  export * from './adaptive-tracing';
  export * from './anomaly-detection';
  export * from './feedback-optimization';
  export * from './real-time-integration';
} catch (e) {
  // Real-time modules may have dependencies not available in all environments
  console.warn('Real-time tracing modules not available:', e);
}

// Export enhanced dashboard modules
try {
  export * from './dashboard/enhanced-live-dashboard';
  export * from './dashboard/websocket/websocket-handler';
  export * from './dashboard/components/alert-manager';
  export * from './dashboard/utils/metrics-aggregator';
  export * from './dashboard/utils/chart-data-provider';
} catch (e) {
  // Enhanced dashboard modules may have additional dependencies
  console.warn('Enhanced dashboard modules not available:', e);
}