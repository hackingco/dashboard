/**
 * Main Langfuse Wrapper Interface
 * Orchestrates all tracing components for the swarm system
 */

import { SwarmTracer } from './swarm-tracer.interface';
import { HookTracer } from './hook-tracer.interface';
import { MemoryTracer } from './memory-tracer.interface';
import { PerformanceTracer } from './performance-tracer.interface';

export interface LangfuseWrapperConfig {
  publicKey?: string;
  secretKey?: string;
  host?: string;
  enabled?: boolean;
  flushAt?: number;
  flushInterval?: number;
  // Enhanced config options
  enableSwarmTracing?: boolean;
  enableHookTracing?: boolean;
  enableMemoryTracing?: boolean;
  enablePerformanceTracing?: boolean;
  sqliteDbPath?: string;
  autoRegisterHooks?: boolean;
  tokenEstimationStrategy?: 'simple' | 'tiktoken' | 'custom';
  agentTokenMultipliers?: Record<string, number>;
}

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  swarmId?: string;
  agentId?: string;
  agentRole?: string;
  sessionId?: string;
  correlationId?: string;
  baggage?: Record<string, string>;
}

export interface EnrichedMetadata {
  // Swarm identification
  swarm_id?: string;
  agent_id?: string;
  agent_role?: string;
  hook_stage?: string;
  
  // Performance tracking
  latency_ms?: number;
  efficiency_score?: number;
  
  // Token integration
  token_usage?: {
    input: number;
    output: number;
    total: number;
  };
  token_cost?: number;
  token_strategy?: string;
  agent_token_multiplier?: number;
  
  // Coordination context
  coordination_memory?: {
    activeAgents: number;
    coordinationState: string;
    lastActivity: string | null;
  };
  distributed_trace_id?: string;
  
  // System metadata
  timestamp: string;
  environment: string;
  claude_flow_version: string;
  swarm_coordination_enabled: boolean;
  
  // Error resilience
  graceful_degradation?: boolean;
  fallback_mode?: boolean;
  
  // Custom metadata
  [key: string]: any;
}

export interface ILangfuseWrapper {
  // Core tracing methods
  preHook(context: HookContext): Promise<string | null>;
  postHook(
    traceId: string | null,
    result: any,
    tokenUsage?: TokenUsage,
    metadata?: Record<string, any>
  ): Promise<void>;
  errorHook(
    traceId: string | null,
    error: Error,
    metadata?: Record<string, any>
  ): Promise<void>;
  
  // Span management
  createSpan(
    traceId: string,
    name: string,
    input?: any,
    metadata?: Record<string, any>
  ): Promise<string | null>;
  endSpan(
    spanId: string,
    output?: any,
    metadata?: Record<string, any>
  ): Promise<void>;
  
  // Enhanced tracing components
  swarm: SwarmTracer;
  hooks: HookTracer;
  memory: MemoryTracer;
  performance: PerformanceTracer;
  
  // Metadata enrichment
  enrichSpanWithMetadata(
    baseMetadata: Record<string, any>,
    hookOptions?: any
  ): Promise<EnrichedMetadata>;
  
  // Context extraction
  extractAgentContext(hookOptions?: any): {
    swarmId: string | null;
    agentId: string | null;
    agentRole: string | null;
    hookStage: string | null;
  };
  
  // Token estimation
  estimateTokensFromContext(hookOptions?: any): Promise<{
    usage: TokenUsage;
    cost: number;
    strategy: string;
    error?: boolean;
  }>;
  
  // Coordination
  getCoordinationContext(
    swarmId: string | null,
    agentId: string | null
  ): Promise<{
    activeAgents: number;
    coordinationState: string;
    lastActivity: string | null;
    error?: boolean;
  }>;
  
  // Lifecycle management
  initialize(): void;
  shutdown(): Promise<void>;
  isEnabled(): boolean;
  
  // Monitoring
  getActiveTraceCount(): number;
  getActiveSpanCount(): number;
  getMetrics(): Promise<{
    traces: number;
    spans: number;
    errors: number;
    avgLatency: number;
    tokenUsage: TokenUsage;
    totalCost: number;
  }>;
  
  // Configuration
  updateConfig(config: Partial<LangfuseWrapperConfig>): void;
  getConfig(): LangfuseWrapperConfig;
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

export interface LangfuseIntegration {
  /**
   * Register the wrapper with Claude Flow
   */
  register(): void;
  
  /**
   * Unregister the wrapper
   */
  unregister(): void;
  
  /**
   * Check registration status
   */
  isRegistered(): boolean;
  
  /**
   * Get integration health
   */
  getHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    langfuseConnected: boolean;
    sqliteConnected: boolean;
    hooksRegistered: boolean;
    activeTraces: number;
    errors: string[];
  }>;
}