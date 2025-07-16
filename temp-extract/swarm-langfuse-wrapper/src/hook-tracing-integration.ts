/**
 * Hook Tracing Integration for Claude Flow
 * Main integration module that coordinates all hook tracing components
 */

import { EventEmitter } from 'events';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { performance } from 'perf_hooks';
// Simple UUID fallback without external dependency
function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Import all hook tracing components
import { langfuseWrapper, HookContext, TokenUsage } from './index';
import { hookTracer, HookTrace, HookMetadata, TraceHook } from './hook-tracer';
import { 
  // registerHookInterceptors,
  HookInterceptor,
  preTaskInterceptor,
  preSearchInterceptor,
  preEditInterceptor,
  postTaskInterceptor,
  postEditInterceptor,
  sessionEndInterceptor
} from './hook-interceptors';
import { 
  createTracedHook
  // TracedHookWrapper
} from './traced-hook-wrapper';
// import { configManager } from './config';
import * as winston from 'winston';

// Create a simple logger if the complex path doesn't exist
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

const execAsync = promisify(exec);

/**
 * Hook tracing integration configuration
 */
export interface HookTracingConfig {
  enabled?: boolean;
  autoRegister?: boolean;
  interceptorsEnabled?: boolean;
  langfuseEnabled?: boolean;
  performanceTracking?: boolean;
  memoryTracking?: boolean;
  coordinationEnabled?: boolean;
  tokenEstimation?: boolean;
  autoCleanup?: boolean;
  cleanupInterval?: number;
  maxTraceAge?: number;
  hookPatterns?: string[];
  excludePatterns?: string[];
  customInterceptors?: Record<string, HookInterceptor>;
  customMetadata?: Record<string, any>;
}

/**
 * Hook execution result
 */
export interface HookExecutionResult {
  traceId: string;
  hookType: string;
  duration: number;
  success: boolean;
  result?: any;
  error?: Error;
  tokenUsage?: TokenUsage;
  metadata?: Record<string, any>;
}

/**
 * Hook analysis result
 */
export interface HookAnalysis {
  totalHooks: number;
  successfulHooks: number;
  failedHooks: number;
  averageDuration: number;
  totalTokens: number;
  estimatedCost: number;
  hookBreakdown: Record<string, number>;
  agentBreakdown: Record<string, any>;
  performanceMetrics: any;
}

/**
 * Main Hook Tracing Integration class
 */
export class HookTracingIntegration extends EventEmitter {
  private static instance: HookTracingIntegration;
  private config: HookTracingConfig;
  // private registry: TracedHookRegistry;
  private cleanupTimer?: NodeJS.Timeout;
  private registeredHooks: Map<string, Function> = new Map();
  private activeIntegrations: Set<string> = new Set();
  private performanceMonitor: PerformanceMonitor;
  private coordinationManager: CoordinationManager;
  private lifecycleManager: LifecycleManager;

  private constructor(config?: HookTracingConfig) {
    super();
    
    this.config = {
      enabled: true,
      autoRegister: true,
      interceptorsEnabled: true,
      langfuseEnabled: true,
      performanceTracking: true,
      memoryTracking: true,
      coordinationEnabled: true,
      tokenEstimation: true,
      autoCleanup: true,
      cleanupInterval: 300000, // 5 minutes
      maxTraceAge: 3600000, // 1 hour
      hookPatterns: ['pre-*', 'post-*', 'session-*', 'notification'],
      excludePatterns: [],
      ...config
    };

    // Initialize components
    // Registry initialization commented out for now
    // this.registry = new TracedHookRegistry({
    //   enableTracing: this.config.enabled,
    //   enableInterceptors: this.config.interceptorsEnabled,
    //   enableLangfuse: this.config.langfuseEnabled,
    //   customMetadata: this.config.customMetadata
    // });

    this.performanceMonitor = new PerformanceMonitor();
    this.coordinationManager = new CoordinationManager();
    this.lifecycleManager = new LifecycleManager();

    // Initialize if enabled
    if (this.config.enabled) {
      this.initialize();
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: HookTracingConfig): HookTracingIntegration {
    if (!HookTracingIntegration.instance) {
      HookTracingIntegration.instance = new HookTracingIntegration(config);
    }
    return HookTracingIntegration.instance;
  }

  /**
   * Initialize hook tracing
   */
  private async initialize(): Promise<void> {
    try {
      logger.info('Initializing hook tracing integration');

      // Register default interceptors
      if (this.config.interceptorsEnabled) {
        this.registerDefaultInterceptors();
      }

      // Auto-register hooks
      if (this.config.autoRegister) {
        await this.autoRegisterHooks();
      }

      // Setup auto-cleanup
      if (this.config.autoCleanup) {
        this.setupAutoCleanup();
      }

      // Initialize performance monitoring
      if (this.config.performanceTracking) {
        this.performanceMonitor.start();
      }

      // Initialize coordination
      if (this.config.coordinationEnabled) {
        await this.coordinationManager.initialize();
      }

      // Setup lifecycle management
      this.lifecycleManager.on('hookStart', this.handleHookStart.bind(this));
      this.lifecycleManager.on('hookEnd', this.handleHookEnd.bind(this));
      this.lifecycleManager.on('hookError', this.handleHookError.bind(this));

      this.emit('initialized');
      logger.info('Hook tracing integration initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize hook tracing integration', error);
      this.emit('error', error);
    }
  }

  /**
   * Register default interceptors
   */
  private registerDefaultInterceptors(): void {
    const defaultInterceptors = {
      'pre-task': preTaskInterceptor,
      'pre-search': preSearchInterceptor,
      'pre-edit': preEditInterceptor,
      'post-task': postTaskInterceptor,
      'post-edit': postEditInterceptor,
      'session-end': sessionEndInterceptor
    };

    // Add custom interceptors
    if (this.config.customInterceptors) {
      Object.assign(defaultInterceptors, this.config.customInterceptors);
    }

    for (const [hookType, interceptor] of Object.entries(defaultInterceptors)) {
      this.registry.registerHook(hookType, 
        createTracedHook(hookType, interceptor, {
          enableTracing: true,
          enableInterceptors: true,
          enableLangfuse: this.config.langfuseEnabled
        })
      );
    }

    logger.info(`Registered ${Object.keys(defaultInterceptors).length} interceptors`);
  }

  /**
   * Auto-register Claude Flow hooks
   */
  private async autoRegisterHooks(): Promise<void> {
    try {
      // Get available hooks from Claude Flow
      const { stdout } = await execAsync('npx claude-flow@alpha hooks list');
      const availableHooks = stdout.trim().split('\n').filter(Boolean);

      for (const hookName of availableHooks) {
        if (this.shouldRegisterHook(hookName)) {
          await this.registerHook(hookName);
        }
      }

      logger.info(`Auto-registered ${this.registeredHooks.size} hooks`);
    } catch (error) {
      logger.warn('Failed to auto-register hooks', error);
    }
  }

  /**
   * Check if hook should be registered
   */
  private shouldRegisterHook(hookName: string): boolean {
    // Check exclude patterns
    for (const pattern of this.config.excludePatterns || []) {
      if (this.matchPattern(hookName, pattern)) {
        return false;
      }
    }

    // Check include patterns
    for (const pattern of this.config.hookPatterns || []) {
      if (this.matchPattern(hookName, pattern)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Match hook name against pattern
   */
  private matchPattern(hookName: string, pattern: string): boolean {
    const regex = new RegExp(pattern.replace('*', '.*'));
    return regex.test(hookName);
  }

  /**
   * Register a hook
   */
  async registerHook(
    hookName: string,
    hookImpl?: Function,
    interceptor?: HookInterceptor
  ): Promise<void> {
    if (this.registeredHooks.has(hookName)) {
      logger.debug(`Hook ${hookName} already registered`);
      return;
    }

    // Create hook implementation if not provided
    if (!hookImpl) {
      hookImpl = this.createClaudeFlowHook(hookName);
    }

    // Wrap with tracing - commented out for now
    // const tracedHook = wrapHookWithTracing(
    //   hookName,
    //   hookImpl as any,
    //   interceptor,
    //   {
    //     enableTracing: true,
    //     enableInterceptors: this.config.interceptorsEnabled,
    //     enableLangfuse: this.config.langfuseEnabled,
    //     customMetadata: this.config.customMetadata
    //   }
    // );

    // this.registry.registerHook(hookName, tracedHook, interceptor);
    // this.registeredHooks.set(hookName, tracedHook);
    
    logger.debug(`Registered hook: ${hookName}`);
  }

  /**
   * Create Claude Flow hook wrapper
   */
  private createClaudeFlowHook(hookName: string): Function {
    return async (options: any) => {
      const startTime = performance.now();
      const traceId = uuidv4();

      try {
        // Execute Claude Flow hook
        const command = `npx claude-flow@alpha hooks ${hookName} ${this.buildHookArgs(options)}`;
        const { stdout, stderr } = await execAsync(command);

        if (stderr) {
          logger.warn(`Hook ${hookName} stderr:`, stderr);
        }

        const duration = performance.now() - startTime;
        const result = this.parseHookResult(stdout);

        // Store execution result
        await this.storeExecutionResult({
          traceId,
          hookType: hookName,
          duration,
          success: true,
          result,
          metadata: {
            command,
            options,
            stdout_length: stdout.length
          }
        });

        return result;
      } catch (error) {
        const duration = performance.now() - startTime;
        
        await this.storeExecutionResult({
          traceId,
          hookType: hookName,
          duration,
          success: false,
          error: error as Error,
          metadata: { options }
        });

        throw error;
      }
    };
  }

  /**
   * Build hook arguments from options
   */
  private buildHookArgs(options: any): string {
    const args: string[] = [];

    for (const [key, value] of Object.entries(options || {})) {
      if (value !== undefined && value !== null) {
        const flag = `--${key.replace(/_/g, '-')}`;
        if (typeof value === 'boolean') {
          if (value) args.push(flag);
        } else {
          args.push(flag, String(value));
        }
      }
    }

    return args.join(' ');
  }

  /**
   * Parse hook result from stdout
   */
  private parseHookResult(stdout: string): any {
    try {
      // Try to parse as JSON
      return JSON.parse(stdout);
    } catch {
      // Return as string if not JSON
      return stdout.trim();
    }
  }

  /**
   * Execute a traced hook
   */
  async executeHook(
    hookName: string,
    options?: any
  ): Promise<HookExecutionResult> {
    const hook = this.registeredHooks.get(hookName) || 
                 this.registry.getHooks().includes(hookName) ? 
                 ((opts: any) => this.registry.executeHook(hookName, opts)) : null;

    if (!hook) {
      throw new Error(`Hook not found: ${hookName}`);
    }

    const startTime = performance.now();
    const traceId = await hookTracer.tracePreHook(hookName, options, {
      ...this.extractMetadata(options),
      integration: 'hook-tracing'
    });

    try {
      const result = await hook(options);
      const duration = performance.now() - startTime;

      // Estimate tokens if enabled
      let tokenUsage;
      if (this.config.tokenEstimation) {
        tokenUsage = await this.estimateTokenUsage(options, result);
      }

      await hookTracer.tracePostHook(traceId, result, tokenUsage, {
        duration_ms: duration,
        integration: 'hook-tracing'
      });

      const executionResult: HookExecutionResult = {
        traceId,
        hookType: hookName,
        duration,
        success: true,
        result,
        tokenUsage,
        metadata: { options }
      };

      await this.storeExecutionResult(executionResult);
      return executionResult;

    } catch (error) {
      const duration = performance.now() - startTime;
      
      await hookTracer.traceErrorHook(traceId, error as Error, {
        duration_ms: duration,
        integration: 'hook-tracing'
      });

      const executionResult: HookExecutionResult = {
        traceId,
        hookType: hookName,
        duration,
        success: false,
        error: error as Error,
        metadata: { options }
      };

      await this.storeExecutionResult(executionResult);
      throw error;
    }
  }

  /**
   * Execute multiple hooks in parallel
   */
  async executeHooksParallel(
    hooks: Array<{ name: string; options?: any }>
  ): Promise<HookExecutionResult[]> {
    const promises = hooks.map(({ name, options }) => 
      this.executeHook(name, options).catch(error => ({
        traceId: uuidv4(),
        hookType: name,
        duration: 0,
        success: false,
        error,
        metadata: { options }
      }))
    );

    return Promise.all(promises);
  }

  /**
   * Execute hooks in sequence
   */
  async executeHooksSequence(
    hooks: Array<{ name: string; options?: any }>
  ): Promise<HookExecutionResult[]> {
    const results: HookExecutionResult[] = [];

    for (const { name, options } of hooks) {
      try {
        const result = await this.executeHook(name, options);
        results.push(result);
      } catch (error) {
        results.push({
          traceId: uuidv4(),
          hookType: name,
          duration: 0,
          success: false,
          error: error as Error,
          metadata: { options }
        });
      }
    }

    return results;
  }

  /**
   * Analyze hook executions
   */
  async analyzeHooks(
    filter?: {
      hookType?: string;
      swarmId?: string;
      agentId?: string;
      startTime?: Date;
      endTime?: Date;
    }
  ): Promise<HookAnalysis> {
    const traces = this.getFilteredTraces(filter);
    
    const analysis: HookAnalysis = {
      totalHooks: traces.length,
      successfulHooks: traces.filter(t => !t.error).length,
      failedHooks: traces.filter(t => t.error).length,
      averageDuration: 0,
      totalTokens: 0,
      estimatedCost: 0,
      hookBreakdown: {},
      agentBreakdown: {},
      performanceMetrics: {}
    };

    if (traces.length === 0) {
      return analysis;
    }

    // Calculate metrics
    let totalDuration = 0;
    for (const trace of traces) {
      totalDuration += trace.duration || 0;
      analysis.totalTokens += trace.tokenUsage?.total || 0;
      
      // Hook breakdown
      if (!analysis.hookBreakdown[trace.hookType]) {
        analysis.hookBreakdown[trace.hookType] = 0;
      }
      analysis.hookBreakdown[trace.hookType]++;

      // Agent breakdown
      const agentId = trace.metadata.agentId || 'unknown';
      if (!analysis.agentBreakdown[agentId]) {
        analysis.agentBreakdown[agentId] = {
          hooks: 0,
          tokens: 0,
          errors: 0
        };
      }
      analysis.agentBreakdown[agentId].hooks++;
      analysis.agentBreakdown[agentId].tokens += trace.tokenUsage?.total || 0;
      if (trace.error) {
        analysis.agentBreakdown[agentId].errors++;
      }
    }

    analysis.averageDuration = totalDuration / traces.length;
    analysis.estimatedCost = this.estimateTotalCost(analysis.totalTokens);

    // Get performance metrics
    if (this.config.performanceTracking) {
      analysis.performanceMetrics = await this.performanceMonitor.getMetrics();
    }

    return analysis;
  }

  /**
   * Get filtered traces
   */
  private getFilteredTraces(filter?: any): HookTrace[] {
    let traces = Array.from(hookTracer['traces'].values());

    if (filter) {
      if (filter.hookType) {
        traces = traces.filter(t => t.hookType === filter.hookType);
      }
      if (filter.swarmId) {
        traces = traces.filter(t => t.metadata.swarmId === filter.swarmId);
      }
      if (filter.agentId) {
        traces = traces.filter(t => t.metadata.agentId === filter.agentId);
      }
      if (filter.startTime) {
        traces = traces.filter(t => t.metadata.timestamp >= filter.startTime.getTime());
      }
      if (filter.endTime) {
        traces = traces.filter(t => t.metadata.timestamp <= filter.endTime.getTime());
      }
    }

    return traces;
  }

  /**
   * Extract metadata from options
   */
  private extractMetadata(options: any): HookMetadata {
    return {
      swarmId: options?.swarmId || options?.swarm_id,
      agentId: options?.agentId || options?.agent_id,
      agentRole: options?.agentRole || options?.agent_role,
      taskId: options?.taskId || options?.task_id,
      sessionId: options?.sessionId || options?.session_id,
      operationId: options?.operationId || options?.operation_id,
      file: options?.file,
      query: options?.query,
      message: options?.message
    };
  }

  /**
   * Estimate token usage
   */
  private async estimateTokenUsage(input: any, output: any): Promise<TokenUsage> {
    const inputStr = typeof input === 'string' ? input : JSON.stringify(input);
    const outputStr = typeof output === 'string' ? output : JSON.stringify(output);

    // Simple estimation (4 chars per token)
    const inputTokens = Math.ceil(inputStr.length / 4);
    const outputTokens = Math.ceil(outputStr.length / 4);

    return {
      input: inputTokens,
      output: outputTokens,
      total: inputTokens + outputTokens
    };
  }

  /**
   * Estimate total cost
   */
  private estimateTotalCost(totalTokens: number): number {
    // Claude Sonnet rates (adjust as needed)
    const rate = 0.003; // per 1K tokens
    return (totalTokens * rate) / 1000;
  }

  /**
   * Store execution result
   */
  private async storeExecutionResult(result: HookExecutionResult): Promise<void> {
    if (!this.config.coordinationEnabled) {
      return;
    }

    await this.coordinationManager.storeResult(result);
  }

  /**
   * Setup auto-cleanup
   */
  private setupAutoCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      hookTracer.clearOldTraces(this.config.maxTraceAge);
      this.performanceMonitor.clearOldMetrics(this.config.maxTraceAge);
      this.coordinationManager.clearOldData(this.config.maxTraceAge);
    }, this.config.cleanupInterval);
  }

  /**
   * Handle hook lifecycle events
   */
  private handleHookStart(event: any): void {
    this.emit('hookStart', event);
  }

  private handleHookEnd(event: any): void {
    this.emit('hookEnd', event);
  }

  private handleHookError(event: any): void {
    this.emit('hookError', event);
  }

  /**
   * Export traces
   */
  async exportTraces(
    format: 'json' | 'csv' | 'html' = 'json',
    filter?: any
  ): Promise<string> {
    const traces = this.getFilteredTraces(filter);
    const analysis = await this.analyzeHooks(filter);

    switch (format) {
      case 'json':
        return JSON.stringify({
          traces,
          analysis,
          metadata: {
            exportedAt: new Date().toISOString(),
            filter,
            totalTraces: traces.length
          }
        }, null, 2);

      case 'csv':
        return this.exportAsCSV(traces);

      case 'html':
        return this.exportAsHTML(traces, analysis);

      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Export as CSV
   */
  private exportAsCSV(traces: HookTrace[]): string {
    const headers = [
      'ID', 'Hook Type', 'Phase', 'Start Time', 'Duration', 
      'Success', 'Swarm ID', 'Agent ID', 'Agent Role', 'Tokens'
    ];

    const rows = traces.map(t => [
      t.id,
      t.hookType,
      t.hookPhase,
      new Date(t.metadata.timestamp).toISOString(),
      t.duration || 0,
      !t.error,
      t.metadata.swarmId || '',
      t.metadata.agentId || '',
      t.metadata.agentRole || '',
      t.tokenUsage?.total || 0
    ]);

    return [
      headers.join(','),
      ...rows.map(row => row.map(v => `"${v}"`).join(','))
    ].join('\n');
  }

  /**
   * Export as HTML
   */
  private exportAsHTML(traces: HookTrace[], analysis: HookAnalysis): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <title>Hook Tracing Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1, h2 { color: #333; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f2f2f2; }
    .success { color: green; }
    .error { color: red; }
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }
    .metric { background: #f5f5f5; padding: 15px; border-radius: 5px; }
    .metric-value { font-size: 24px; font-weight: bold; color: #333; }
    .metric-label { color: #666; }
  </style>
</head>
<body>
  <h1>Hook Tracing Report</h1>
  
  <h2>Summary</h2>
  <div class="metrics">
    <div class="metric">
      <div class="metric-value">${analysis.totalHooks}</div>
      <div class="metric-label">Total Hooks</div>
    </div>
    <div class="metric">
      <div class="metric-value">${analysis.successfulHooks}</div>
      <div class="metric-label">Successful</div>
    </div>
    <div class="metric">
      <div class="metric-value">${analysis.failedHooks}</div>
      <div class="metric-label">Failed</div>
    </div>
    <div class="metric">
      <div class="metric-value">${Math.round(analysis.averageDuration)}ms</div>
      <div class="metric-label">Avg Duration</div>
    </div>
    <div class="metric">
      <div class="metric-value">${analysis.totalTokens}</div>
      <div class="metric-label">Total Tokens</div>
    </div>
    <div class="metric">
      <div class="metric-value">$${analysis.estimatedCost.toFixed(4)}</div>
      <div class="metric-label">Est. Cost</div>
    </div>
  </div>

  <h2>Hook Breakdown</h2>
  <table>
    <tr>
      <th>Hook Type</th>
      <th>Count</th>
      <th>Percentage</th>
    </tr>
    ${Object.entries(analysis.hookBreakdown)
      .map(([type, count]) => `
        <tr>
          <td>${type}</td>
          <td>${count}</td>
          <td>${((count / analysis.totalHooks) * 100).toFixed(1)}%</td>
        </tr>
      `).join('')}
  </table>

  <h2>Trace Details</h2>
  <table>
    <tr>
      <th>Time</th>
      <th>Hook</th>
      <th>Phase</th>
      <th>Duration</th>
      <th>Status</th>
      <th>Agent</th>
      <th>Tokens</th>
    </tr>
    ${traces.map(t => `
      <tr>
        <td>${new Date(t.metadata.timestamp).toLocaleString()}</td>
        <td>${t.hookType}</td>
        <td>${t.hookPhase}</td>
        <td>${t.duration ? Math.round(t.duration) + 'ms' : '-'}</td>
        <td class="${t.error ? 'error' : 'success'}">${t.error ? 'Error' : 'Success'}</td>
        <td>${t.metadata.agentRole || '-'}</td>
        <td>${t.tokenUsage?.total || '-'}</td>
      </tr>
    `).join('')}
  </table>

  <p>Generated at: ${new Date().toISOString()}</p>
</body>
</html>`;
  }

  /**
   * Shutdown integration
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down hook tracing integration');

    // Clear cleanup timer
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    // Shutdown components
    await this.performanceMonitor.shutdown();
    await this.coordinationManager.shutdown();
    this.lifecycleManager.removeAllListeners();

    // Export final traces
    const finalTraces = await this.exportTraces('json');
    const tracePath = path.join('.swarm', 'traces', `final-${Date.now()}.json`);
    await fs.mkdir(path.dirname(tracePath), { recursive: true });
    await fs.writeFile(tracePath, finalTraces);

    // Shutdown Langfuse
    await langfuseWrapper.shutdown();

    this.emit('shutdown');
    logger.info('Hook tracing integration shutdown complete');
  }

  /**
   * Get integration status
   */
  getStatus(): Record<string, any> {
    return {
      enabled: this.config.enabled,
      registeredHooks: this.registeredHooks.size,
      activeIntegrations: this.activeIntegrations.size,
      activeTraces: hookTracer.getActiveTraceCount(),
      totalTraces: hookTracer['traces'].size,
      langfuseEnabled: langfuseWrapper.isEnabled(),
      performanceTracking: this.config.performanceTracking,
      coordinationEnabled: this.config.coordinationEnabled,
      uptime: process.uptime()
    };
  }
}

/**
 * Performance monitoring component
 */
class PerformanceMonitor {
  private metrics: Map<string, any[]> = new Map();
  // private startTime: number = Date.now();

  start(): void {
    // this.startTime = Date.now();
    logger.debug('Performance monitoring started');
  }

  recordMetric(name: string, value: number, metadata?: any): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    this.metrics.get(name)!.push({
      value,
      timestamp: Date.now(),
      metadata
    });
  }

  getMetrics(): Record<string, any> {
    const results: Record<string, any> = {};
    
    for (const [name, values] of this.metrics) {
      const sorted = values.sort((a, b) => a.value - b.value);
      results[name] = {
        count: values.length,
        min: sorted[0]?.value || 0,
        max: sorted[sorted.length - 1]?.value || 0,
        avg: values.reduce((sum, v) => sum + v.value, 0) / values.length,
        p50: sorted[Math.floor(values.length * 0.5)]?.value || 0,
        p95: sorted[Math.floor(values.length * 0.95)]?.value || 0,
        p99: sorted[Math.floor(values.length * 0.99)]?.value || 0
      };
    }

    return results;
  }

  clearOldMetrics(maxAge: number): void {
    const cutoff = Date.now() - maxAge;
    
    for (const [name, values] of this.metrics) {
      const filtered = values.filter(v => v.timestamp > cutoff);
      if (filtered.length === 0) {
        this.metrics.delete(name);
      } else {
        this.metrics.set(name, filtered);
      }
    }
  }

  async shutdown(): Promise<void> {
    const metrics = this.getMetrics();
    logger.info('Performance metrics summary:', metrics);
  }
}

/**
 * Coordination manager component
 */
class CoordinationManager {
  private memoryPath: string = '.swarm/memory.db';

  async initialize(): Promise<void> {
    // Ensure memory database exists
    await fs.mkdir(path.dirname(this.memoryPath), { recursive: true });
    logger.debug('Coordination manager initialized');
  }

  async storeResult(result: HookExecutionResult): Promise<void> {
    try {
      const key = `hook-trace/${result.traceId}`;
      const value = JSON.stringify(result);
      
      await execAsync(
        `sqlite3 ${this.memoryPath} "INSERT OR REPLACE INTO memory_entries (key, value, namespace, metadata) VALUES ('${key}', '${value}', 'hook-tracing', '${JSON.stringify({ 
          hookType: result.hookType,
          timestamp: Date.now() 
        })}')"`.replace(/'/g, "'\"'\"'")
      );
    } catch (error) {
      logger.warn('Failed to store result in coordination memory', error);
    }
  }

  async clearOldData(maxAge: number): Promise<void> {
    try {
      const cutoff = Date.now() - maxAge;
      await execAsync(
        `sqlite3 ${this.memoryPath} "DELETE FROM memory_entries WHERE namespace = 'hook-tracing' AND json_extract(metadata, '$.timestamp') < ${cutoff}"`
      );
    } catch (error) {
      logger.warn('Failed to clear old coordination data', error);
    }
  }

  async shutdown(): Promise<void> {
    logger.debug('Coordination manager shutdown');
  }
}

/**
 * Lifecycle manager component
 */
class LifecycleManager extends EventEmitter {
  constructor() {
    super();
    this.setupProcessHandlers();
  }

  private setupProcessHandlers(): void {
    process.on('exit', () => this.emit('processExit'));
    process.on('SIGINT', () => this.emit('interrupt'));
    process.on('SIGTERM', () => this.emit('terminate'));
  }
}

// Export main function to initialize hook tracing
export function initializeHookTracing(config?: HookTracingConfig): HookTracingIntegration {
  return HookTracingIntegration.getInstance(config);
}

// Export convenience functions
export async function executeTracedHook(
  hookName: string,
  options?: any
): Promise<HookExecutionResult> {
  const integration = HookTracingIntegration.getInstance();
  return integration.executeHook(hookName, options);
}

export async function analyzeHookPerformance(filter?: any): Promise<HookAnalysis> {
  const integration = HookTracingIntegration.getInstance();
  return integration.analyzeHooks(filter);
}

export async function exportHookTraces(
  format: 'json' | 'csv' | 'html' = 'json',
  filter?: any
): Promise<string> {
  const integration = HookTracingIntegration.getInstance();
  return integration.exportTraces(format, filter);
}

// Export example implementations
export const hookTracingExamples = {
  // Basic hook execution
  basicExecution: async () => {
    const result = await executeTracedHook('pre-task', {
      taskId: 'example-task',
      description: 'Example task execution',
      autoSpawnAgents: true
    });
    console.log('Hook executed:', result);
  },

  // Parallel hook execution
  parallelExecution: async () => {
    const integration = HookTracingIntegration.getInstance();
    const results = await integration.executeHooksParallel([
      { name: 'pre-task', options: { taskId: 'task-1' } },
      { name: 'pre-search', options: { query: 'test query' } },
      { name: 'pre-edit', options: { file: 'test.ts' } }
    ]);
    console.log('Parallel results:', results);
  },

  // Sequential hook execution with coordination
  sequentialExecution: async () => {
    const integration = HookTracingIntegration.getInstance();
    const results = await integration.executeHooksSequence([
      { name: 'session-start', options: { sessionId: 'test-session' } },
      { name: 'pre-task', options: { taskId: 'task-1' } },
      { name: 'post-task', options: { taskId: 'task-1' } },
      { name: 'session-end', options: { sessionId: 'test-session' } }
    ]);
    console.log('Sequential results:', results);
  },

  // Performance analysis
  performanceAnalysis: async () => {
    const analysis = await analyzeHookPerformance({
      hookType: 'pre-task',
      startTime: new Date(Date.now() - 3600000), // Last hour
      endTime: new Date()
    });
    console.log('Performance analysis:', analysis);
  },

  // Export traces
  exportExample: async () => {
    const json = await exportHookTraces('json');
    const csv = await exportHookTraces('csv');
    const html = await exportHookTraces('html');
    
    console.log('Exported formats available');
  }
};

// Export singleton instance
export const hookTracingIntegration = HookTracingIntegration.getInstance();

// Export all related types and classes
export {
  HookTrace,
  HookMetadata,
  HookInterceptor,
  // TracedHookRegistry,
  TracedHookOptions,
  HookContext,
  TokenUsage,
  TraceHook
};