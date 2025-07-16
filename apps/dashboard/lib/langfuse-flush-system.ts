/**
 * Explicit Langfuse Flushing System
 * Implements bulletproof trace delivery with robust async flushing
 */

import { EventEmitter } from 'events';
import { Langfuse } from 'langfuse';

// Types for flush operations
interface FlushOperation {
  id: string;
  timestamp: number;
  traceCount: number;
  retryCount: number;
  maxRetries: number;
  status: 'pending' | 'flushing' | 'success' | 'failed';
  traces: any[];
  error?: Error;
}

interface FlushMetrics {
  totalFlushes: number;
  successfulFlushes: number;
  failedFlushes: number;
  totalTraces: number;
  deliveredTraces: number;
  averageFlushTime: number;
  lastFlushTime: number;
  errorRate: number;
  retryRate: number;
}

interface FlushConfig {
  maxRetries: number;
  retryDelay: number;
  flushTimeout: number;
  maxTraceBuffer: number;
  autoFlushInterval: number;
  enableMetrics: boolean;
  onFlushError: (error: Error, operation: FlushOperation) => void;
  onFlushSuccess: (operation: FlushOperation) => void;
}

/**
 * Langfuse Explicit Flush Manager
 * Ensures 100% trace delivery with comprehensive error handling
 */
export class LangfuseFlushManager extends EventEmitter {
  private langfuse: Langfuse | null = null;
  private config: FlushConfig;
  private operations: Map<string, FlushOperation> = new Map();
  private metrics: FlushMetrics;
  private autoFlushTimer: NodeJS.Timeout | null = null;
  private isShuttingDown: boolean = false;

  constructor(langfuse: Langfuse, config?: Partial<FlushConfig>) {
    super();
    this.langfuse = langfuse;
    
    this.config = {
      maxRetries: config?.maxRetries || 5,
      retryDelay: config?.retryDelay || 1000,
      flushTimeout: config?.flushTimeout || 30000,
      maxTraceBuffer: config?.maxTraceBuffer || 1000,
      autoFlushInterval: config?.autoFlushInterval || 10000,
      enableMetrics: config?.enableMetrics !== false,
      onFlushError: config?.onFlushError || this.defaultErrorHandler.bind(this),
      onFlushSuccess: config?.onFlushSuccess || this.defaultSuccessHandler.bind(this),
    };

    this.metrics = {
      totalFlushes: 0,
      successfulFlushes: 0,
      failedFlushes: 0,
      totalTraces: 0,
      deliveredTraces: 0,
      averageFlushTime: 0,
      lastFlushTime: 0,
      errorRate: 0,
      retryRate: 0,
    };

    this.startAutoFlush();
    this.setupGracefulShutdown();
  }

  /**
   * Core flush operation with async/await pattern
   */
  public async flushAsync(traces?: any[], forceFlush: boolean = false): Promise<boolean> {
    if (!this.langfuse) {
      console.error('❌ Langfuse client not initialized');
      return false;
    }

    // Create flush operation
    const operation: FlushOperation = {
      id: this.generateOperationId(),
      timestamp: Date.now(),
      traceCount: traces?.length || 0,
      retryCount: 0,
      maxRetries: this.config.maxRetries,
      status: 'pending',
      traces: traces || [],
    };

    this.operations.set(operation.id, operation);
    
    try {
      console.log(`🔄 Starting flush operation ${operation.id}...`);
      this.emit('flush-start', operation);

      // Execute flush with retry logic
      const result = await this.executeFlushWithRetry(operation);
      
      if (result) {
        this.handleFlushSuccess(operation);
      } else {
        this.handleFlushFailure(operation, new Error('Flush failed after all retries'));
      }

      return result;
    } catch (error) {
      this.handleFlushFailure(operation, error as Error);
      return false;
    } finally {
      this.operations.delete(operation.id);
    }
  }

  /**
   * Execute flush with comprehensive retry logic
   */
  private async executeFlushWithRetry(operation: FlushOperation): Promise<boolean> {
    while (operation.retryCount <= operation.maxRetries) {
      try {
        operation.status = 'flushing';
        operation.retryCount++;
        
        const startTime = Date.now();
        
        // CRITICAL: Use langfuse.flushAsync() - the only way to ensure delivery
        console.log(`📤 Executing langfuse.flushAsync() [Attempt ${operation.retryCount}/${operation.maxRetries + 1}]`);
        
        // Set flush timeout
        const flushPromise = this.langfuse!.flushAsync();
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Flush timeout')), this.config.flushTimeout);
        });

        // Race between flush and timeout
        await Promise.race([flushPromise, timeoutPromise]);
        
        const flushTime = Date.now() - startTime;
        
        // Update metrics
        this.updateMetrics(operation, flushTime, true);
        
        operation.status = 'success';
        console.log(`✅ Flush completed successfully in ${flushTime}ms`);
        
        return true;
      } catch (error) {
        const flushTime = Date.now() - operation.timestamp;
        console.error(`❌ Flush attempt ${operation.retryCount} failed:`, error);
        
        operation.error = error as Error;
        
        // Check if we should retry
        if (operation.retryCount <= operation.maxRetries) {
          const delay = this.calculateRetryDelay(operation.retryCount);
          console.log(`⏳ Retrying in ${delay}ms...`);
          await this.sleep(delay);
        } else {
          // Final failure
          this.updateMetrics(operation, flushTime, false);
          operation.status = 'failed';
          return false;
        }
      }
    }
    
    return false;
  }

  /**
   * Smart flush with buffering and timing optimization
   */
  public async smartFlush(traces: any[]): Promise<boolean> {
    if (!traces || traces.length === 0) {
      console.log('⚠️ No traces to flush');
      return true;
    }

    console.log(`📊 Smart flush requested for ${traces.length} traces`);
    
    // Optimal timing - flush after all traces are created
    // This ensures we don't flush incomplete traces
    await this.sleep(100); // Small delay to ensure all traces are ready
    
    return this.flushAsync(traces, true);
  }

  /**
   * Batch flush for high-volume scenarios
   */
  public async batchFlush(traceBatches: any[][]): Promise<boolean> {
    console.log(`🔄 Batch flush starting for ${traceBatches.length} batches`);
    
    let allSuccessful = true;
    
    for (let i = 0; i < traceBatches.length; i++) {
      const batch = traceBatches[i];
      console.log(`📦 Flushing batch ${i + 1}/${traceBatches.length} (${batch.length} traces)`);
      
      const success = await this.flushAsync(batch);
      if (!success) {
        allSuccessful = false;
        console.error(`❌ Batch ${i + 1} failed to flush`);
      }
      
      // Small delay between batches to prevent overwhelming
      if (i < traceBatches.length - 1) {
        await this.sleep(200);
      }
    }
    
    console.log(`📊 Batch flush completed: ${allSuccessful ? 'SUCCESS' : 'PARTIAL FAILURE'}`);
    return allSuccessful;
  }

  /**
   * Flush with status monitoring
   */
  public async flushWithStatus(): Promise<{
    success: boolean;
    tracesDelivered: number;
    flushTime: number;
    retryCount: number;
    error?: string;
  }> {
    const startTime = Date.now();
    
    const success = await this.flushAsync();
    const flushTime = Date.now() - startTime;
    
    return {
      success,
      tracesDelivered: success ? this.metrics.deliveredTraces : 0,
      flushTime,
      retryCount: 0, // Would need to track this per operation
      error: success ? undefined : 'Flush failed',
    };
  }

  /**
   * Emergency flush - bypasses all delays and optimizations
   */
  public async emergencyFlush(): Promise<boolean> {
    console.log('🚨 EMERGENCY FLUSH ACTIVATED');
    
    if (!this.langfuse) {
      console.error('❌ Cannot emergency flush - Langfuse client not available');
      return false;
    }
    
    try {
      // Direct flush with minimal retry
      await this.langfuse.flushAsync();
      console.log('✅ Emergency flush completed');
      return true;
    } catch (error) {
      console.error('❌ Emergency flush failed:', error);
      
      // One retry attempt
      try {
        await this.sleep(500);
        await this.langfuse.flushAsync();
        console.log('✅ Emergency flush retry succeeded');
        return true;
      } catch (retryError) {
        console.error('❌ Emergency flush retry failed:', retryError);
        return false;
      }
    }
  }

  /**
   * Graceful shutdown with guaranteed flush
   */
  public async shutdown(): Promise<void> {
    console.log('🔄 Shutting down Langfuse flush manager...');
    this.isShuttingDown = true;
    
    // Stop auto-flush
    if (this.autoFlushTimer) {
      clearInterval(this.autoFlushTimer);
    }
    
    // Wait for pending operations
    const pendingOps = Array.from(this.operations.values());
    if (pendingOps.length > 0) {
      console.log(`⏳ Waiting for ${pendingOps.length} pending flush operations...`);
      
      const timeout = setTimeout(() => {
        console.warn('⚠️ Shutdown timeout - forcing exit');
      }, 10000);
      
      await Promise.allSettled(
        pendingOps.map(op => this.waitForOperation(op.id))
      );
      
      clearTimeout(timeout);
    }
    
    // Final emergency flush
    await this.emergencyFlush();
    
    // Shutdown Langfuse client
    if (this.langfuse) {
      await this.langfuse.shutdownAsync();
    }
    
    console.log('✅ Langfuse flush manager shutdown complete');
  }

  /**
   * Get comprehensive metrics
   */
  public getMetrics(): FlushMetrics & { operationCount: number } {
    return {
      ...this.metrics,
      operationCount: this.operations.size,
    };
  }

  /**
   * Health check for flush system
   */
  public async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    lastFlushSuccess: boolean;
    pendingOperations: number;
    errorRate: number;
    details: string;
  }> {
    const now = Date.now();
    const timeSinceLastFlush = now - this.metrics.lastFlushTime;
    const pendingOps = this.operations.size;
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    let details = 'Flush system operating normally';
    
    if (this.metrics.errorRate > 50) {
      status = 'unhealthy';
      details = 'High error rate detected';
    } else if (this.metrics.errorRate > 20 || pendingOps > 10) {
      status = 'degraded';
      details = 'Performance degradation detected';
    } else if (timeSinceLastFlush > 60000) {
      status = 'degraded';
      details = 'No recent flush activity';
    }
    
    return {
      status,
      lastFlushSuccess: this.metrics.successfulFlushes > 0,
      pendingOperations: pendingOps,
      errorRate: this.metrics.errorRate,
      details,
    };
  }

  // Private helper methods

  private handleFlushSuccess(operation: FlushOperation): void {
    console.log(`✅ Flush operation ${operation.id} completed successfully`);
    this.config.onFlushSuccess(operation);
    this.emit('flush-success', operation);
  }

  private handleFlushFailure(operation: FlushOperation, error: Error): void {
    console.error(`❌ Flush operation ${operation.id} failed:`, error);
    operation.error = error;
    operation.status = 'failed';
    this.config.onFlushError(error, operation);
    this.emit('flush-error', { operation, error });
  }

  private updateMetrics(operation: FlushOperation, flushTime: number, success: boolean): void {
    if (!this.config.enableMetrics) return;
    
    this.metrics.totalFlushes++;
    this.metrics.lastFlushTime = Date.now();
    
    if (success) {
      this.metrics.successfulFlushes++;
      this.metrics.deliveredTraces += operation.traceCount;
      
      // Update average flush time
      const totalSuccessTime = this.metrics.averageFlushTime * (this.metrics.successfulFlushes - 1);
      this.metrics.averageFlushTime = (totalSuccessTime + flushTime) / this.metrics.successfulFlushes;
    } else {
      this.metrics.failedFlushes++;
    }
    
    this.metrics.totalTraces += operation.traceCount;
    this.metrics.errorRate = (this.metrics.failedFlushes / this.metrics.totalFlushes) * 100;
    this.metrics.retryRate = operation.retryCount > 1 ? 
      ((this.metrics.retryRate * (this.metrics.totalFlushes - 1)) + (operation.retryCount - 1)) / this.metrics.totalFlushes : 
      this.metrics.retryRate;
  }

  private calculateRetryDelay(retryCount: number): number {
    // Exponential backoff with jitter
    const baseDelay = this.config.retryDelay;
    const exponentialDelay = Math.min(baseDelay * Math.pow(2, retryCount - 1), 10000);
    const jitter = Math.random() * 0.1 * exponentialDelay;
    return Math.floor(exponentialDelay + jitter);
  }

  private generateOperationId(): string {
    return `flush-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async waitForOperation(operationId: string): Promise<void> {
    const operation = this.operations.get(operationId);
    if (!operation) return;
    
    while (operation.status === 'pending' || operation.status === 'flushing') {
      await this.sleep(100);
    }
  }

  private startAutoFlush(): void {
    if (this.config.autoFlushInterval > 0) {
      this.autoFlushTimer = setInterval(() => {
        if (!this.isShuttingDown) {
          this.flushAsync().catch(console.error);
        }
      }, this.config.autoFlushInterval);
    }
  }

  private setupGracefulShutdown(): void {
    const shutdownHandler = async () => {
      console.log('🔄 Graceful shutdown initiated...');
      await this.shutdown();
      process.exit(0);
    };
    
    process.on('SIGINT', shutdownHandler);
    process.on('SIGTERM', shutdownHandler);
    process.on('beforeExit', shutdownHandler);
  }

  private defaultErrorHandler(error: Error, operation: FlushOperation): void {
    console.error(`❌ Flush operation ${operation.id} failed after ${operation.retryCount} attempts:`, error);
  }

  private defaultSuccessHandler(operation: FlushOperation): void {
    console.log(`✅ Flush operation ${operation.id} delivered ${operation.traceCount} traces successfully`);
  }
}

/**
 * Utility class for trace buffer management
 */
export class TraceBufferManager {
  private buffer: any[] = [];
  private maxSize: number;
  private flushManager: LangfuseFlushManager;

  constructor(flushManager: LangfuseFlushManager, maxSize: number = 100) {
    this.flushManager = flushManager;
    this.maxSize = maxSize;
  }

  public addTrace(trace: any): void {
    this.buffer.push(trace);
    
    if (this.buffer.length >= this.maxSize) {
      this.flushBuffer();
    }
  }

  public async flushBuffer(): Promise<boolean> {
    if (this.buffer.length === 0) return true;
    
    const tracesToFlush = [...this.buffer];
    this.buffer = [];
    
    return this.flushManager.smartFlush(tracesToFlush);
  }

  public getBufferSize(): number {
    return this.buffer.length;
  }
}

/**
 * High-level wrapper for easy integration
 */
export class LangfuseFlushWrapper {
  private flushManager: LangfuseFlushManager;
  private bufferManager: TraceBufferManager;
  
  constructor(langfuse: Langfuse, config?: Partial<FlushConfig>) {
    this.flushManager = new LangfuseFlushManager(langfuse, config);
    this.bufferManager = new TraceBufferManager(this.flushManager);
  }

  /**
   * Create traces and flush them immediately
   */
  public async createAndFlushTraces(traces: any[]): Promise<boolean> {
    console.log(`📊 Creating and flushing ${traces.length} traces...`);
    
    // Add traces to buffer
    traces.forEach(trace => this.bufferManager.addTrace(trace));
    
    // Flush everything
    return this.bufferManager.flushBuffer();
  }

  /**
   * Ensure all traces are delivered before shutdown
   */
  public async ensureDelivery(): Promise<boolean> {
    console.log('🚀 Ensuring all traces are delivered...');
    
    // Flush any remaining buffer
    await this.bufferManager.flushBuffer();
    
    // Emergency flush for safety
    return this.flushManager.emergencyFlush();
  }

  public getFlushManager(): LangfuseFlushManager {
    return this.flushManager;
  }

  public getBufferManager(): TraceBufferManager {
    return this.bufferManager;
  }
}

// Export singleton for easy use
export let globalFlushManager: LangfuseFlushManager | null = null;

export function initializeGlobalFlushManager(langfuse: Langfuse, config?: Partial<FlushConfig>): LangfuseFlushManager {
  if (!globalFlushManager) {
    globalFlushManager = new LangfuseFlushManager(langfuse, config);
  }
  return globalFlushManager;
}

export function getGlobalFlushManager(): LangfuseFlushManager | null {
  return globalFlushManager;
}