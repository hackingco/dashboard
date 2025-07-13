import { Langfuse } from 'langfuse';
import type { LangfuseSpanClient, LangfuseTraceClient } from 'langfuse';
import { SwarmConfig } from './interfaces/swarm-config.interface';

/**
 * Error severity levels for classification
 */
export enum ErrorSeverity {
  WARNING = 'warning',
  RECOVERABLE = 'recoverable',
  CRITICAL = 'critical'
}

/**
 * Error classification types
 */
export enum ErrorType {
  NETWORK = 'network',
  VALIDATION = 'validation',
  CONFIGURATION = 'configuration',
  INTEGRATION = 'integration',
  TIMEOUT = 'timeout',
  RATE_LIMIT = 'rate_limit',
  RESOURCE = 'resource',
  UNKNOWN = 'unknown'
}

/**
 * Error context with swarm metadata
 */
export interface ErrorContext {
  traceId?: string;
  spanId?: string;
  agentId?: string;
  agentType?: string;
  swarmId?: string;
  taskId?: string;
  hookType?: string;
  operation?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * Enhanced error with context and classification
 */
export class SwarmError extends Error {
  public readonly severity: ErrorSeverity;
  public readonly type: ErrorType;
  public readonly context: ErrorContext;
  public readonly originalError?: Error;
  public readonly isRecoverable: boolean;

  constructor(
    message: string,
    severity: ErrorSeverity,
    type: ErrorType,
    context: ErrorContext,
    originalError?: Error
  ) {
    super(message);
    this.name = 'SwarmError';
    this.severity = severity;
    this.type = type;
    this.context = context;
    this.originalError = originalError;
    this.isRecoverable = severity !== ErrorSeverity.CRITICAL;

    // Maintain proper stack trace
    if (originalError?.stack) {
      this.stack = originalError.stack;
    }
  }
}

/**
 * Circuit breaker configuration
 */
interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  halfOpenMaxAttempts: number;
}

/**
 * Circuit breaker state
 */
enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open'
}

/**
 * Circuit breaker for preventing cascading failures
 */
class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private lastFailureTime?: Date;
  private halfOpenAttempts: number = 0;

  constructor(private config: CircuitBreakerConfig) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
        this.halfOpenAttempts = 0;
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return false;
    const timeSinceLastFailure = Date.now() - this.lastFailureTime.getTime();
    return timeSinceLastFailure >= this.config.resetTimeout;
  }

  private onSuccess(): void {
    this.failureCount = 0;
    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.CLOSED;
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = new Date();

    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenAttempts++;
      if (this.halfOpenAttempts >= this.config.halfOpenMaxAttempts) {
        this.state = CircuitState.OPEN;
      }
    } else if (this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
    }
  }

  getState(): CircuitState {
    return this.state;
  }
}

/**
 * Error recovery strategy
 */
export interface ErrorRecoveryStrategy {
  canRecover(error: SwarmError): boolean;
  recover(error: SwarmError): Promise<void>;
}

/**
 * Default recovery strategies
 */
class NetworkErrorRecovery implements ErrorRecoveryStrategy {
  canRecover(error: SwarmError): boolean {
    return error.type === ErrorType.NETWORK && error.isRecoverable;
  }

  async recover(error: SwarmError): Promise<void> {
    // Wait with exponential backoff
    const retryDelay = Math.min(1000 * Math.pow(2, error.context.metadata?.retryCount || 0), 30000);
    await new Promise(resolve => setTimeout(resolve, retryDelay));
  }
}

class RateLimitRecovery implements ErrorRecoveryStrategy {
  canRecover(error: SwarmError): boolean {
    return error.type === ErrorType.RATE_LIMIT;
  }

  async recover(error: SwarmError): Promise<void> {
    // Wait for rate limit window to reset
    const resetTime = error.context.metadata?.resetTime || 60000;
    await new Promise(resolve => setTimeout(resolve, resetTime));
  }
}

/**
 * Error handler with classification, reporting, and recovery
 */
export class ErrorHandler {
  private langfuse?: Langfuse;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private recoveryStrategies: ErrorRecoveryStrategy[] = [
    new NetworkErrorRecovery(),
    new RateLimitRecovery()
  ];
  private errorCounts: Map<string, number> = new Map();
  constructor(config: SwarmConfig, langfuse?: Langfuse) {
    this.langfuse = langfuse;
    // Store config for future use if needed
    console.debug('ErrorHandler initialized with config', config);
  }

  /**
   * Handle error with classification and reporting
   */
  async handleError(
    error: Error | SwarmError,
    context: Partial<ErrorContext>,
    trace?: LangfuseTraceClient,
    span?: LangfuseSpanClient
  ): Promise<void> {
    const swarmError = this.classifyError(error, context);
    
    // Report to Langfuse if available
    if (this.langfuse && trace) {
      await this.reportToLangfuse(swarmError, trace, span);
    }

    // Track error counts
    this.trackErrorCount(swarmError);

    // Attempt recovery if possible
    await this.attemptRecovery(swarmError);

    // Log error with context
    this.logError(swarmError);
  }

  /**
   * Execute operation with circuit breaker protection
   */
  async executeWithProtection<T>(
    key: string,
    operation: () => Promise<T>,
    config?: Partial<CircuitBreakerConfig>
  ): Promise<T> {
    const breaker = this.getOrCreateCircuitBreaker(key, config);
    return breaker.execute(operation);
  }

  /**
   * Classify error based on type and context
   */
  private classifyError(error: Error | SwarmError, context: Partial<ErrorContext>): SwarmError {
    if (error instanceof SwarmError) {
      return error;
    }

    const errorContext: ErrorContext = {
      timestamp: new Date(),
      ...context
    };

    // Classify by error message patterns
    const message = error.message.toLowerCase();
    let type = ErrorType.UNKNOWN;
    let severity = ErrorSeverity.RECOVERABLE;

    if (message.includes('network') || message.includes('fetch') || message.includes('connect')) {
      type = ErrorType.NETWORK;
    } else if (message.includes('timeout')) {
      type = ErrorType.TIMEOUT;
    } else if (message.includes('rate limit') || message.includes('429')) {
      type = ErrorType.RATE_LIMIT;
    } else if (message.includes('validation') || message.includes('invalid')) {
      type = ErrorType.VALIDATION;
      severity = ErrorSeverity.WARNING;
    } else if (message.includes('config') || message.includes('initialization')) {
      type = ErrorType.CONFIGURATION;
      severity = ErrorSeverity.CRITICAL;
    } else if (message.includes('memory') || message.includes('resource')) {
      type = ErrorType.RESOURCE;
      severity = ErrorSeverity.CRITICAL;
    }

    return new SwarmError(error.message, severity, type, errorContext, error);
  }

  /**
   * Report error to Langfuse with enhanced context
   */
  private async reportToLangfuse(
    error: SwarmError,
    trace: LangfuseTraceClient,
    span?: LangfuseSpanClient
  ): Promise<void> {
    try {
      const errorData = {
        name: 'swarm_error',
        input: {
          message: error.message,
          type: error.type,
          severity: error.severity,
          context: error.context
        },
        output: {
          isRecoverable: error.isRecoverable,
          stack: error.stack
        },
        metadata: {
          errorType: error.type,
          severity: error.severity,
          ...error.context.metadata
        },
        level: error.severity === ErrorSeverity.CRITICAL ? 'ERROR' as const : 
               error.severity === ErrorSeverity.WARNING ? 'WARNING' as const : 'DEFAULT' as const
      };

      if (span) {
        span.update({
          ...errorData,
          statusMessage: error.message
        });
      } else {
        trace.span(errorData);
      }
    } catch (reportError) {
      console.error('Failed to report error to Langfuse:', reportError);
    }
  }

  /**
   * Attempt to recover from error using registered strategies
   */
  private async attemptRecovery(error: SwarmError): Promise<void> {
    for (const strategy of this.recoveryStrategies) {
      if (strategy.canRecover(error)) {
        try {
          await strategy.recover(error);
          return;
        } catch (recoveryError) {
          console.error('Recovery failed:', recoveryError);
        }
      }
    }
  }

  /**
   * Get or create circuit breaker for key
   */
  private getOrCreateCircuitBreaker(
    key: string,
    config?: Partial<CircuitBreakerConfig>
  ): CircuitBreaker {
    if (!this.circuitBreakers.has(key)) {
      const defaultConfig: CircuitBreakerConfig = {
        failureThreshold: 5,
        resetTimeout: 60000, // 1 minute
        halfOpenMaxAttempts: 3,
        ...config
      };
      this.circuitBreakers.set(key, new CircuitBreaker(defaultConfig));
    }
    return this.circuitBreakers.get(key)!;
  }

  /**
   * Track error counts for monitoring
   */
  private trackErrorCount(error: SwarmError): void {
    const key = `${error.type}:${error.severity}`;
    const count = this.errorCounts.get(key) || 0;
    this.errorCounts.set(key, count + 1);
  }

  /**
   * Log error with structured context
   */
  private logError(error: SwarmError): void {
    const logData = {
      timestamp: error.context.timestamp,
      severity: error.severity,
      type: error.type,
      message: error.message,
      context: error.context,
      stack: error.stack
    };

    if (error.severity === ErrorSeverity.CRITICAL) {
      console.error('🚨 CRITICAL ERROR:', logData);
    } else if (error.severity === ErrorSeverity.WARNING) {
      console.warn('⚠️  WARNING:', logData);
    } else {
      console.log('ℹ️  RECOVERABLE ERROR:', logData);
    }
  }

  /**
   * Get error statistics
   */
  getErrorStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    this.errorCounts.forEach((count, key) => {
      stats[key] = count;
    });
    return stats;
  }

  /**
   * Get circuit breaker states
   */
  getCircuitBreakerStates(): Record<string, CircuitState> {
    const states: Record<string, CircuitState> = {};
    this.circuitBreakers.forEach((breaker, key) => {
      states[key] = breaker.getState();
    });
    return states;
  }

  /**
   * Reset error counts and circuit breakers
   */
  reset(): void {
    this.errorCounts.clear();
    this.circuitBreakers.clear();
  }

  /**
   * Add custom recovery strategy
   */
  addRecoveryStrategy(strategy: ErrorRecoveryStrategy): void {
    this.recoveryStrategies.push(strategy);
  }

  /**
   * Create error span for hook tracing
   */
  createErrorSpan(
    error: SwarmError,
    parentSpan?: LangfuseSpanClient
  ): LangfuseSpanClient | undefined {
    if (!parentSpan) return undefined;

    return parentSpan.span({
      name: `error_${error.type}`,
      input: {
        message: error.message,
        type: error.type,
        severity: error.severity
      },
      metadata: {
        isRecoverable: error.isRecoverable,
        context: error.context
      },
      level: error.severity === ErrorSeverity.CRITICAL ? 'ERROR' as const : 'WARNING' as const
    });
  }
}

/**
 * Global error handler instance
 */
let globalErrorHandler: ErrorHandler | null = null;

/**
 * Initialize global error handler
 */
export function initializeErrorHandler(config: SwarmConfig, langfuse?: Langfuse): ErrorHandler {
  globalErrorHandler = new ErrorHandler(config, langfuse);
  return globalErrorHandler;
}

/**
 * Get global error handler
 */
export function getErrorHandler(): ErrorHandler {
  if (!globalErrorHandler) {
    throw new Error('Error handler not initialized. Call initializeErrorHandler first.');
  }
  return globalErrorHandler;
}

/**
 * Graceful degradation decorator
 */
export function gracefulDegradation(fallbackValue?: any) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      try {
        return await originalMethod.apply(this, args);
      } catch (error) {
        const errorHandler = getErrorHandler();
        const context: Partial<ErrorContext> = {
          operation: `${target.constructor.name}.${propertyKey}`,
          metadata: { args }
        };

        await errorHandler.handleError(error as Error, context);

        if (fallbackValue !== undefined) {
          return fallbackValue;
        }
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Circuit breaker decorator
 */
export function withCircuitBreaker(key?: string, config?: Partial<CircuitBreakerConfig>) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const errorHandler = getErrorHandler();
      const breakerKey = key || `${target.constructor.name}.${propertyKey}`;

      return errorHandler.executeWithProtection(
        breakerKey,
        () => originalMethod.apply(this, args),
        config
      );
    };

    return descriptor;
  };
}