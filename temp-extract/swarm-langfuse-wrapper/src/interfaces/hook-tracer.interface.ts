/**
 * Hook Tracer Interface
 * Defines the contract for tracing Claude Flow hooks
 */

export interface HookExecutionContext {
  hookType: string;
  hookStage: 'pre' | 'post' | 'error';
  swarmId?: string;
  agentId?: string;
  agentRole?: string;
  taskId?: string;
  sessionId?: string;
  executionId: string;
  startTime: Date;
  metadata?: Record<string, any>;
}

export interface HookResult {
  success: boolean;
  data?: any;
  error?: Error;
  duration: number;
  tokenUsage?: {
    input: number;
    output: number;
    total: number;
  };
  metadata?: Record<string, any>;
}

export interface HookMetrics {
  hookType: string;
  executionCount: number;
  successCount: number;
  errorCount: number;
  avgDuration: number;
  totalTokensUsed: number;
  totalCost: number;
  timestamp: Date;
}

export interface HookTracer {
  /**
   * Start tracing a hook execution
   */
  startHookExecution(context: HookExecutionContext): Promise<string>;
  
  /**
   * End a hook execution trace
   */
  endHookExecution(
    traceId: string,
    result: HookResult
  ): Promise<void>;
  
  /**
   * Record a hook chain (sequence of related hooks)
   */
  recordHookChain(
    chainId: string,
    hooks: Array<{
      hookType: string;
      executionId: string;
      order: number;
    }>
  ): Promise<void>;
  
  /**
   * Update hook metrics
   */
  updateHookMetrics(metrics: HookMetrics): Promise<void>;
  
  /**
   * Get hook execution history
   */
  getHookHistory(
    hookType?: string,
    agentId?: string,
    limit?: number
  ): Promise<HookExecutionContext[]>;
  
  /**
   * Analyze hook patterns
   */
  analyzeHookPatterns(
    timeRange: { start: Date; end: Date }
  ): Promise<{
    mostFrequent: string[];
    slowest: string[];
    mostExpensive: string[];
    errorProne: string[];
  }>;
}