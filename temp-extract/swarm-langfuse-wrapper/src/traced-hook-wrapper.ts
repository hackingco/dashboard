/**
 * Traced Hook Wrapper for Claude Flow
 * Combines hook tracing with interceptor execution in a unified framework
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { v4 as uuidv4 } from 'uuid';
import { HookInterceptor } from './hook-interceptors';
import { TokenUsage } from './index';
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

/**
 * Hook implementation interface
 */
export interface HookImplementation {
  execute(args: any[], context: HookExecutionContext): Promise<any>;
  validate?(args: any[]): boolean;
  priority?: number;
}

/**
 * Hook execution context
 */
export interface HookExecutionContext {
  traceId: string;
  hookType: string;
  metadata: HookMetadata;
  startTime: number;
  tokenUsage?: TokenUsage;
}

/**
 * Hook registry entry
 */
interface HookRegistryEntry {
  implementation: HookImplementation;
  interceptor?: HookInterceptor;
  enabled: boolean;
  metrics: HookMetrics;
}

/**
 * Hook execution metrics
 */
interface HookMetrics {
  executionCount: number;
  successCount: number;
  errorCount: number;
  totalDuration: number;
  avgDuration: number;
  lastExecutedAt?: number;
  lastError?: Error;
}

/**
 * Hook execution result
 */
export interface HookExecutionResult {
  success: boolean;
  result?: any;
  error?: Error;
  duration: number;
  traceId: string;
  tokenUsage?: TokenUsage;
}

/**
 * Traced Hook Wrapper class
 * Manages hook registration, execution, and tracing
 */
export class TracedHookWrapper extends EventEmitter {
  private static instance: TracedHookWrapper;
  private hookRegistry: Map<string, HookRegistryEntry> = new Map();
  private activeExecutions: Map<string, HookExecutionContext> = new Map();
  private errorBoundaries: Map<string, (error: Error) => Promise<any>> = new Map();

  private constructor() {
    super();
    this.setupErrorHandling();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): TracedHookWrapper {
    if (!TracedHookWrapper.instance) {
      TracedHookWrapper.instance = new TracedHookWrapper();
    }
    return TracedHookWrapper.instance;
  }

  /**
   * Register a hook implementation
   */
  registerHook(
    hookType: string,
    implementation: HookImplementation,
    interceptor?: HookInterceptor
  ): void {
    const metrics: HookMetrics = {
      executionCount: 0,
      successCount: 0,
      errorCount: 0,
      totalDuration: 0,
      avgDuration: 0
    };

    this.hookRegistry.set(hookType, {
      implementation,
      interceptor,
      enabled: true,
      metrics
    });

    logger.info(`Registered hook: ${hookType}`, {
      hasInterceptor: !!interceptor,
      priority: implementation.priority
    });

    this.emit('hook:registered', { hookType, implementation, interceptor });
  }

  /**
   * Unregister a hook
   */
  unregisterHook(hookType: string): boolean {
    const existed = this.hookRegistry.delete(hookType);
    if (existed) {
      logger.info(`Unregistered hook: ${hookType}`);
      this.emit('hook:unregistered', { hookType });
    }
    return existed;
  }

  /**
   * Execute a hook with full tracing and interceptor support
   */
  async executeHook(
    hookType: string,
    args: any[],
    metadata: HookMetadata = {}
  ): Promise<HookExecutionResult> {
    const entry = this.hookRegistry.get(hookType);
    if (!entry) {
      throw new Error(`Hook not registered: ${hookType}`);
    }

    if (!entry.enabled) {
      throw new Error(`Hook disabled: ${hookType}`);
    }

    // Validate arguments if validator provided
    if (entry.implementation.validate && !entry.implementation.validate(args)) {
      throw new Error(`Invalid arguments for hook: ${hookType}`);
    }

    // Start tracing
    const traceId = `trace-${Date.now()}-${uuidv4().slice(0, 8)}`;
    const startTime = performance.now();

    const context: HookExecutionContext = {
      traceId,
      hookType,
      metadata,
      startTime
    };

    this.activeExecutions.set(traceId, context);

    try {
      // Execute before interceptor if provided
      if (entry.interceptor?.before) {
        await entry.interceptor.before(args, metadata);
      }

      // Execute the hook implementation
      const result = await this.executeWithErrorBoundary(
        hookType,
        async () => entry.implementation.execute(args, context)
      );

      // Execute after interceptor if provided
      if (entry.interceptor?.after) {
        await entry.interceptor.after(result, args, metadata);
      }

      // Complete tracing
      const duration = performance.now() - startTime;
      // Note: Simplified tracing without hookTracer dependency

      // Update metrics
      this.updateMetrics(entry.metrics, true, duration);

      // Emit success event
      this.emit('hook:executed', {
        hookType,
        traceId,
        duration,
        success: true
      });

      return {
        success: true,
        result,
        duration,
        traceId,
        tokenUsage: context.tokenUsage
      };

    } catch (error) {
      const err = error as Error;
      const duration = performance.now() - startTime;

      // Execute error interceptor if provided
      if (entry.interceptor?.onError) {
        try {
          await entry.interceptor.onError(err, args, metadata);
        } catch (interceptorError) {
          logger.error('Error interceptor failed', {
            hookType,
            error: interceptorError
          });
        }
      }

      // Complete error tracing
      // Note: Simplified error tracing without hookTracer dependency

      // Update metrics
      this.updateMetrics(entry.metrics, false, duration, err);

      // Emit error event
      this.emit('hook:error', {
        hookType,
        traceId,
        duration,
        error: err
      });

      return {
        success: false,
        error: err,
        duration,
        traceId
      };

    } finally {
      this.activeExecutions.delete(traceId);
    }
  }

  /**
   * Execute multiple hooks in parallel
   */
  async executeHooksParallel(
    executions: Array<{ hookType: string; args: any[]; metadata?: HookMetadata }>
  ): Promise<HookExecutionResult[]> {
    const promises = executions.map(exec =>
      this.executeHook(exec.hookType, exec.args, exec.metadata)
    );

    return Promise.all(promises);
  }

  /**
   * Execute multiple hooks in sequence
   */
  async executeHooksSequential(
    executions: Array<{ hookType: string; args: any[]; metadata?: HookMetadata }>
  ): Promise<HookExecutionResult[]> {
    const results: HookExecutionResult[] = [];

    for (const exec of executions) {
      const result = await this.executeHook(exec.hookType, exec.args, exec.metadata);
      results.push(result);

      // Stop on error if critical
      if (!result.success && this.isHookCritical(exec.hookType)) {
        break;
      }
    }

    return results;
  }

  /**
   * Enable or disable a hook
   */
  setHookEnabled(hookType: string, enabled: boolean): void {
    const entry = this.hookRegistry.get(hookType);
    if (entry) {
      entry.enabled = enabled;
      logger.info(`Hook ${hookType} ${enabled ? 'enabled' : 'disabled'}`);
      this.emit('hook:toggled', { hookType, enabled });
    }
  }

  /**
   * Register an error boundary for a hook type
   */
  registerErrorBoundary(
    hookType: string,
    handler: (error: Error) => Promise<any>
  ): void {
    this.errorBoundaries.set(hookType, handler);
    logger.info(`Registered error boundary for hook: ${hookType}`);
  }

  /**
   * Get metrics for a specific hook or all hooks
   */
  getHookMetrics(hookType?: string): Record<string, HookMetrics> | HookMetrics | null {
    if (hookType) {
      const entry = this.hookRegistry.get(hookType);
      return entry ? entry.metrics : null;
    }

    const allMetrics: Record<string, HookMetrics> = {};
    for (const [type, entry] of this.hookRegistry) {
      allMetrics[type] = entry.metrics;
    }
    return allMetrics;
  }

  /**
   * Get active executions
   */
  getActiveExecutions(): HookExecutionContext[] {
    return Array.from(this.activeExecutions.values());
  }

  /**
   * Clear metrics for a hook
   */
  clearMetrics(hookType?: string): void {
    if (hookType) {
      const entry = this.hookRegistry.get(hookType);
      if (entry) {
        entry.metrics = {
          executionCount: 0,
          successCount: 0,
          errorCount: 0,
          totalDuration: 0,
          avgDuration: 0
        };
      }
    } else {
      // Clear all metrics
      for (const entry of this.hookRegistry.values()) {
        entry.metrics = {
          executionCount: 0,
          successCount: 0,
          errorCount: 0,
          totalDuration: 0,
          avgDuration: 0
        };
      }
    }
  }

  /**
   * Export hook registry state
   */
  exportRegistry(): any {
    const registry: any = {};
    
    for (const [hookType, entry] of this.hookRegistry) {
      registry[hookType] = {
        enabled: entry.enabled,
        hasInterceptor: !!entry.interceptor,
        priority: entry.implementation.priority,
        metrics: entry.metrics
      };
    }

    return {
      exportedAt: new Date().toISOString(),
      hookCount: this.hookRegistry.size,
      activeExecutions: this.activeExecutions.size,
      registry
    };
  }

  /**
   * Execute with error boundary
   */
  private async executeWithErrorBoundary(
    hookType: string,
    fn: () => Promise<any>
  ): Promise<any> {
    const errorBoundary = this.errorBoundaries.get(hookType);

    try {
      return await fn();
    } catch (error) {
      if (errorBoundary) {
        logger.warn(`Error boundary triggered for hook: ${hookType}`, error);
        return await errorBoundary(error as Error);
      }
      throw error;
    }
  }

  /**
   * Update hook metrics
   */
  private updateMetrics(
    metrics: HookMetrics,
    success: boolean,
    duration: number,
    error?: Error
  ): void {
    metrics.executionCount++;
    if (success) {
      metrics.successCount++;
    } else {
      metrics.errorCount++;
      if (error) {
        metrics.lastError = error;
      }
    }
    
    metrics.totalDuration += duration;
    metrics.avgDuration = metrics.totalDuration / metrics.executionCount;
    metrics.lastExecutedAt = Date.now();
  }

  /**
   * Check if a hook is critical (failure should stop execution)
   */
  private isHookCritical(hookType: string): boolean {
    const criticalHooks = ['pre-task', 'pre-edit', 'session-start'];
    return criticalHooks.includes(hookType);
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    this.on('error', (error: Error) => {
      logger.error('TracedHookWrapper error', error);
    });

    // Note: Simplified setup without hookTracer dependency
  }
}

/**
 * Create a traced hook implementation
 */
export function createTracedHook(
  hookType: string,
  execute: (args: any[], context: HookExecutionContext) => Promise<any>,
  options: {
    validate?: (args: any[]) => boolean;
    priority?: number;
    interceptor?: HookInterceptor;
  } = {}
): void {
  const wrapper = TracedHookWrapper.getInstance();
  
  const implementation: HookImplementation = {
    execute,
    validate: options.validate,
    priority: options.priority ?? 0
  };

  wrapper.registerHook(hookType, implementation, options.interceptor);
}

/**
 * Decorator for automatically creating traced hooks
 */
export function TracedHook(hookType: string, options: { priority?: number } = {}) {
  return function (
    target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const wrapper = TracedHookWrapper.getInstance();

    const implementation: HookImplementation = {
      execute: async (args: any[], _context: HookExecutionContext) => {
        return originalMethod.apply(target, args);
      },
      priority: options.priority ?? 0
    };

    wrapper.registerHook(hookType, implementation);

    descriptor.value = async function (...args: any[]) {
      const result = await wrapper.executeHook(hookType, args);
      if (!result.success) {
        throw result.error;
      }
      return result.result;
    };

    return descriptor;
  };
}

// Export singleton instance
export const tracedHookWrapper = TracedHookWrapper.getInstance();