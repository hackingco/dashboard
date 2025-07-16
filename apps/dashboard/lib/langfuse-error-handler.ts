/**
 * Langfuse Error Handling System
 * Comprehensive error handling for flush operations with recovery strategies
 */

import { EventEmitter } from 'events';

// Types for error handling
interface FlushError {
  id: string;
  timestamp: number;
  operation: string;
  error: Error;
  context: {
    traceCount: number;
    retryCount: number;
    flushDelay: number;
    batchSize: number;
    operationId: string;
  };
  severity: 'low' | 'medium' | 'high' | 'critical';
  recoverable: boolean;
  recoveryStrategy: string;
}

interface ErrorPattern {
  id: string;
  pattern: RegExp;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recoverable: boolean;
  recoveryStrategy: string;
  frequency: number;
  lastOccurrence: number;
}

interface RecoveryAction {
  id: string;
  name: string;
  description: string;
  execute: (error: FlushError) => Promise<boolean>;
  conditions: (error: FlushError) => boolean;
  priority: number;
}

interface ErrorMetrics {
  totalErrors: number;
  errorsByType: Record<string, number>;
  errorsBySeverity: Record<string, number>;
  recoverySuccessRate: number;
  averageRecoveryTime: number;
  criticalErrors: number;
  recentErrorRate: number;
}

/**
 * Comprehensive error handler for Langfuse flush operations
 */
export class LangfuseErrorHandler extends EventEmitter {
  private errorHistory: FlushError[] = [];
  private errorPatterns: Map<string, ErrorPattern> = new Map();
  private recoveryActions: Map<string, RecoveryAction> = new Map();
  private metrics: ErrorMetrics;
  private maxHistorySize: number = 1000;
  private circuitBreaker: {
    isOpen: boolean;
    failures: number;
    lastFailure: number;
    threshold: number;
    timeout: number;
  };

  constructor() {
    super();
    
    this.metrics = {
      totalErrors: 0,
      errorsByType: {},
      errorsBySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
      recoverySuccessRate: 0,
      averageRecoveryTime: 0,
      criticalErrors: 0,
      recentErrorRate: 0,
    };

    this.circuitBreaker = {
      isOpen: false,
      failures: 0,
      lastFailure: 0,
      threshold: 5,
      timeout: 30000, // 30 seconds
    };

    this.initializeErrorPatterns();
    this.initializeRecoveryActions();
  }

  /**
   * Handle flush operation error
   */
  public async handleFlushError(
    error: Error,
    context: {
      traceCount: number;
      retryCount: number;
      flushDelay: number;
      batchSize: number;
      operationId: string;
    }
  ): Promise<{
    handled: boolean;
    recovery: boolean;
    nextAction: string;
    retryRecommended: boolean;
    retryDelay: number;
  }> {
    // Create error record
    const flushError: FlushError = {
      id: this.generateErrorId(),
      timestamp: Date.now(),
      operation: 'flush',
      error,
      context,
      severity: this.determineSeverity(error),
      recoverable: this.isRecoverable(error),
      recoveryStrategy: this.getRecoveryStrategy(error),
    };

    // Add to history
    this.errorHistory.push(flushError);
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory.shift();
    }

    // Update metrics
    this.updateMetrics(flushError);

    // Update circuit breaker
    this.updateCircuitBreaker(flushError);

    // Log error
    this.logError(flushError);

    // Emit error event
    this.emit('flush-error', flushError);

    // Attempt recovery
    const recovery = await this.attemptRecovery(flushError);

    // Determine next action
    const nextAction = this.determineNextAction(flushError, recovery);
    const retryRecommended = this.shouldRetry(flushError);
    const retryDelay = this.calculateRetryDelay(flushError);

    return {
      handled: true,
      recovery,
      nextAction,
      retryRecommended,
      retryDelay,
    };
  }

  /**
   * Check if circuit breaker allows operation
   */
  public canProceed(): boolean {
    if (!this.circuitBreaker.isOpen) {
      return true;
    }

    // Check if timeout has passed
    const now = Date.now();
    if (now - this.circuitBreaker.lastFailure > this.circuitBreaker.timeout) {
      this.circuitBreaker.isOpen = false;
      this.circuitBreaker.failures = 0;
      console.log('🔓 Circuit breaker closed - operations resumed');
      return true;
    }

    return false;
  }

  /**
   * Get error statistics
   */
  public getErrorStats(): ErrorMetrics & {
    circuitBreakerStatus: string;
    recentErrors: FlushError[];
    topErrorPatterns: Array<{ pattern: string; count: number }>;
  } {
    const recentErrors = this.errorHistory
      .filter(e => Date.now() - e.timestamp < 300000) // Last 5 minutes
      .slice(-10); // Last 10 errors

    const topErrorPatterns = Array.from(this.errorPatterns.values())
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5)
      .map(pattern => ({
        pattern: pattern.description,
        count: pattern.frequency,
      }));

    return {
      ...this.metrics,
      circuitBreakerStatus: this.circuitBreaker.isOpen ? 'open' : 'closed',
      recentErrors,
      topErrorPatterns,
    };
  }

  /**
   * Analyze error trends
   */
  public analyzeErrorTrends(): {
    trend: 'improving' | 'stable' | 'degrading';
    recommendations: string[];
    criticalIssues: string[];
    successRate: number;
  } {
    const recent = this.errorHistory
      .filter(e => Date.now() - e.timestamp < 3600000) // Last hour
      .length;

    const previous = this.errorHistory
      .filter(e => {
        const age = Date.now() - e.timestamp;
        return age >= 3600000 && age < 7200000; // Hour before that
      })
      .length;

    let trend: 'improving' | 'stable' | 'degrading' = 'stable';
    if (recent < previous * 0.8) {
      trend = 'improving';
    } else if (recent > previous * 1.2) {
      trend = 'degrading';
    }

    const recommendations: string[] = [];
    const criticalIssues: string[] = [];

    // Analyze patterns
    const criticalErrors = this.errorHistory
      .filter(e => e.severity === 'critical' && Date.now() - e.timestamp < 3600000);

    if (criticalErrors.length > 0) {
      criticalIssues.push(`${criticalErrors.length} critical errors in last hour`);
    }

    if (this.circuitBreaker.isOpen) {
      criticalIssues.push('Circuit breaker is open - operations blocked');
    }

    // Generate recommendations
    if (trend === 'degrading') {
      recommendations.push('Monitor system resources');
      recommendations.push('Check network connectivity');
      recommendations.push('Review flush timing configuration');
    }

    if (this.metrics.recoverySuccessRate < 0.5) {
      recommendations.push('Improve recovery strategies');
    }

    const successRate = this.metrics.totalErrors > 0 ? 
      1 - (this.metrics.totalErrors / (this.metrics.totalErrors + 100)) : 1;

    return {
      trend,
      recommendations,
      criticalIssues,
      successRate,
    };
  }

  /**
   * Create error report
   */
  public generateErrorReport(): {
    summary: string;
    metrics: ErrorMetrics;
    topErrors: Array<{ error: string; count: number; lastSeen: string }>;
    recommendations: string[];
  } {
    const now = Date.now();
    const recentErrors = this.errorHistory
      .filter(e => now - e.timestamp < 3600000); // Last hour

    const errorCounts = new Map<string, { count: number; lastSeen: number }>();
    
    recentErrors.forEach(error => {
      const key = error.error.name || 'Unknown';
      const current = errorCounts.get(key) || { count: 0, lastSeen: 0 };
      errorCounts.set(key, {
        count: current.count + 1,
        lastSeen: Math.max(current.lastSeen, error.timestamp),
      });
    });

    const topErrors = Array.from(errorCounts.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([error, data]) => ({
        error,
        count: data.count,
        lastSeen: new Date(data.lastSeen).toISOString(),
      }));

    const analysis = this.analyzeErrorTrends();
    
    const summary = `Error Analysis Report
      Total Errors: ${this.metrics.totalErrors}
      Recent Errors (1h): ${recentErrors.length}
      Trend: ${analysis.trend}
      Success Rate: ${(analysis.successRate * 100).toFixed(1)}%
      Circuit Breaker: ${this.circuitBreaker.isOpen ? 'OPEN' : 'CLOSED'}`;

    return {
      summary,
      metrics: this.metrics,
      topErrors,
      recommendations: analysis.recommendations,
    };
  }

  /**
   * Reset error state
   */
  public resetErrorState(): void {
    console.log('🔄 Resetting error handler state...');
    
    this.errorHistory = [];
    this.circuitBreaker = {
      isOpen: false,
      failures: 0,
      lastFailure: 0,
      threshold: 5,
      timeout: 30000,
    };
    
    this.metrics = {
      totalErrors: 0,
      errorsByType: {},
      errorsBySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
      recoverySuccessRate: 0,
      averageRecoveryTime: 0,
      criticalErrors: 0,
      recentErrorRate: 0,
    };
    
    console.log('✅ Error state reset complete');
  }

  // Private helper methods

  private initializeErrorPatterns(): void {
    const patterns: ErrorPattern[] = [
      {
        id: 'network-timeout',
        pattern: /timeout|ETIMEDOUT|ECONNRESET/i,
        description: 'Network timeout or connection reset',
        severity: 'high',
        recoverable: true,
        recoveryStrategy: 'retry-with-backoff',
        frequency: 0,
        lastOccurrence: 0,
      },
      {
        id: 'auth-failure',
        pattern: /401|unauthorized|invalid.*key/i,
        description: 'Authentication failure',
        severity: 'critical',
        recoverable: false,
        recoveryStrategy: 'check-credentials',
        frequency: 0,
        lastOccurrence: 0,
      },
      {
        id: 'rate-limit',
        pattern: /429|rate.*limit|too.*many.*requests/i,
        description: 'Rate limiting',
        severity: 'medium',
        recoverable: true,
        recoveryStrategy: 'exponential-backoff',
        frequency: 0,
        lastOccurrence: 0,
      },
      {
        id: 'server-error',
        pattern: /5\d{2}|server.*error|internal.*error/i,
        description: 'Server error',
        severity: 'high',
        recoverable: true,
        recoveryStrategy: 'retry-with-delay',
        frequency: 0,
        lastOccurrence: 0,
      },
      {
        id: 'client-error',
        pattern: /4\d{2}|client.*error|bad.*request/i,
        description: 'Client error',
        severity: 'medium',
        recoverable: false,
        recoveryStrategy: 'validate-request',
        frequency: 0,
        lastOccurrence: 0,
      },
      {
        id: 'memory-error',
        pattern: /out.*of.*memory|heap.*size/i,
        description: 'Memory exhaustion',
        severity: 'critical',
        recoverable: true,
        recoveryStrategy: 'reduce-batch-size',
        frequency: 0,
        lastOccurrence: 0,
      },
    ];

    patterns.forEach(pattern => {
      this.errorPatterns.set(pattern.id, pattern);
    });
  }

  private initializeRecoveryActions(): void {
    const actions: RecoveryAction[] = [
      {
        id: 'retry-with-backoff',
        name: 'Retry with Exponential Backoff',
        description: 'Retry operation with increasing delays',
        execute: async (error: FlushError) => {
          const delay = Math.min(1000 * Math.pow(2, error.context.retryCount), 30000);
          await this.sleep(delay);
          return true;
        },
        conditions: (error: FlushError) => error.recoverable && error.context.retryCount < 5,
        priority: 1,
      },
      {
        id: 'reduce-batch-size',
        name: 'Reduce Batch Size',
        description: 'Split large batches into smaller ones',
        execute: async (error: FlushError) => {
          if (error.context.batchSize > 10) {
            // Signal to reduce batch size
            this.emit('batch-size-reduction', {
              currentSize: error.context.batchSize,
              recommendedSize: Math.max(5, Math.floor(error.context.batchSize / 2)),
            });
            return true;
          }
          return false;
        },
        conditions: (error: FlushError) => error.context.batchSize > 10,
        priority: 2,
      },
      {
        id: 'increase-flush-delay',
        name: 'Increase Flush Delay',
        description: 'Add delay before flushing',
        execute: async (error: FlushError) => {
          const newDelay = Math.min(error.context.flushDelay * 2, 2000);
          this.emit('flush-delay-increase', {
            currentDelay: error.context.flushDelay,
            recommendedDelay: newDelay,
          });
          return true;
        },
        conditions: (error: FlushError) => error.context.flushDelay < 1000,
        priority: 3,
      },
      {
        id: 'emergency-flush',
        name: 'Emergency Flush',
        description: 'Attempt emergency flush with minimal batch',
        execute: async (error: FlushError) => {
          this.emit('emergency-flush-requested', {
            reason: 'error-recovery',
            originalError: error,
          });
          return true;
        },
        conditions: (error: FlushError) => error.severity === 'critical',
        priority: 0,
      },
    ];

    actions.forEach(action => {
      this.recoveryActions.set(action.id, action);
    });
  }

  private determineSeverity(error: Error): 'low' | 'medium' | 'high' | 'critical' {
    const message = error.message || error.toString();
    
    // Check patterns
    for (const pattern of this.errorPatterns.values()) {
      if (pattern.pattern.test(message)) {
        pattern.frequency++;
        pattern.lastOccurrence = Date.now();
        return pattern.severity;
      }
    }
    
    // Default classification
    if (message.includes('timeout') || message.includes('network')) {
      return 'high';
    }
    
    if (message.includes('auth') || message.includes('401')) {
      return 'critical';
    }
    
    return 'medium';
  }

  private isRecoverable(error: Error): boolean {
    const message = error.message || error.toString();
    
    // Check patterns
    for (const pattern of this.errorPatterns.values()) {
      if (pattern.pattern.test(message)) {
        return pattern.recoverable;
      }
    }
    
    // Default: most errors are recoverable
    return true;
  }

  private getRecoveryStrategy(error: Error): string {
    const message = error.message || error.toString();
    
    // Check patterns
    for (const pattern of this.errorPatterns.values()) {
      if (pattern.pattern.test(message)) {
        return pattern.recoveryStrategy;
      }
    }
    
    return 'retry-with-backoff';
  }

  private async attemptRecovery(error: FlushError): Promise<boolean> {
    const startTime = Date.now();
    
    // Get applicable recovery actions
    const applicableActions = Array.from(this.recoveryActions.values())
      .filter(action => action.conditions(error))
      .sort((a, b) => a.priority - b.priority);

    console.log(`🔧 Attempting recovery for error ${error.id} using ${applicableActions.length} strategies`);

    for (const action of applicableActions) {
      try {
        console.log(`⚡ Executing recovery action: ${action.name}`);
        const success = await action.execute(error);
        
        if (success) {
          const recoveryTime = Date.now() - startTime;
          this.updateRecoveryMetrics(true, recoveryTime);
          
          console.log(`✅ Recovery successful using: ${action.name} (${recoveryTime}ms)`);
          this.emit('recovery-success', {
            error,
            action: action.name,
            recoveryTime,
          });
          
          return true;
        }
      } catch (recoveryError) {
        console.error(`❌ Recovery action failed: ${action.name}`, recoveryError);
      }
    }

    const recoveryTime = Date.now() - startTime;
    this.updateRecoveryMetrics(false, recoveryTime);
    
    console.log(`❌ All recovery attempts failed for error ${error.id}`);
    this.emit('recovery-failed', { error, recoveryTime });
    
    return false;
  }

  private updateMetrics(error: FlushError): void {
    this.metrics.totalErrors++;
    this.metrics.errorsBySeverity[error.severity]++;
    
    const errorType = error.error.name || 'Unknown';
    this.metrics.errorsByType[errorType] = (this.metrics.errorsByType[errorType] || 0) + 1;
    
    if (error.severity === 'critical') {
      this.metrics.criticalErrors++;
    }
    
    // Calculate recent error rate
    const recentErrors = this.errorHistory
      .filter(e => Date.now() - e.timestamp < 300000) // Last 5 minutes
      .length;
    
    this.metrics.recentErrorRate = recentErrors / 5; // Errors per minute
  }

  private updateRecoveryMetrics(success: boolean, recoveryTime: number): void {
    // Update recovery success rate
    const totalRecoveries = this.errorHistory
      .filter(e => e.recoverable)
      .length;
    
    if (totalRecoveries > 0) {
      const successfulRecoveries = success ? 1 : 0;
      this.metrics.recoverySuccessRate = 
        (this.metrics.recoverySuccessRate * (totalRecoveries - 1) + successfulRecoveries) / totalRecoveries;
    }
    
    // Update average recovery time
    if (success) {
      const recoveryAttempts = this.errorHistory.length;
      this.metrics.averageRecoveryTime = 
        (this.metrics.averageRecoveryTime * (recoveryAttempts - 1) + recoveryTime) / recoveryAttempts;
    }
  }

  private updateCircuitBreaker(error: FlushError): void {
    if (error.severity === 'critical') {
      this.circuitBreaker.failures++;
      this.circuitBreaker.lastFailure = Date.now();
      
      if (this.circuitBreaker.failures >= this.circuitBreaker.threshold) {
        this.circuitBreaker.isOpen = true;
        console.log(`🔒 Circuit breaker opened after ${this.circuitBreaker.failures} failures`);
        this.emit('circuit-breaker-opened', {
          failures: this.circuitBreaker.failures,
          threshold: this.circuitBreaker.threshold,
        });
      }
    }
  }

  private logError(error: FlushError): void {
    const prefix = error.severity === 'critical' ? '🚨' : 
                   error.severity === 'high' ? '❌' : 
                   error.severity === 'medium' ? '⚠️' : '🔸';
    
    console.log(`${prefix} Flush error [${error.severity.toUpperCase()}] ${error.id}:
      Error: ${error.error.message}
      Context: ${error.context.traceCount} traces, retry ${error.context.retryCount}
      Recoverable: ${error.recoverable}
      Strategy: ${error.recoveryStrategy}`);
  }

  private determineNextAction(error: FlushError, recoverySuccess: boolean): string {
    if (recoverySuccess) {
      return 'retry-operation';
    }
    
    if (error.severity === 'critical') {
      return 'escalate-to-admin';
    }
    
    if (error.context.retryCount >= 3) {
      return 'abandon-operation';
    }
    
    return 'retry-with-modifications';
  }

  private shouldRetry(error: FlushError): boolean {
    if (!error.recoverable) return false;
    if (error.context.retryCount >= 5) return false;
    if (this.circuitBreaker.isOpen) return false;
    if (error.severity === 'critical' && error.context.retryCount >= 2) return false;
    
    return true;
  }

  private calculateRetryDelay(error: FlushError): number {
    const baseDelay = 1000; // 1 second
    const retryMultiplier = Math.pow(2, error.context.retryCount);
    const severityMultiplier = error.severity === 'critical' ? 2 : 1;
    const jitter = Math.random() * 0.1; // 10% jitter
    
    const delay = baseDelay * retryMultiplier * severityMultiplier * (1 + jitter);
    return Math.min(delay, 30000); // Cap at 30 seconds
  }

  private generateErrorId(): string {
    return `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const errorHandler = new LangfuseErrorHandler();

// Export for testing
export default errorHandler;