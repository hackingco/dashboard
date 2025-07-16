/**
 * Optimized Langfuse Batch Manager
 * Implements efficient batching, caching, and retry strategies
 */

import { EventEmitter } from 'events';

interface BatchConfig {
  maxBatchSize: number;
  flushInterval: number;
  maxRetries: number;
  retryDelay: number;
  enableCompression: boolean;
  enableCaching: boolean;
  cacheSize: number;
  cacheTTL: number;
}

interface TraceData {
  id: string;
  timestamp: number;
  size: number;
  data: any;
  retries?: number;
}

interface BatchMetrics {
  totalBatches: number;
  successfulBatches: number;
  failedBatches: number;
  totalTraces: number;
  droppedTraces: number;
  averageBatchSize: number;
  averageLatency: number;
  cacheHits: number;
  cacheMisses: number;
}

export class LangfuseBatchOptimizer extends EventEmitter {
  private config: BatchConfig;
  private batch: TraceData[] = [];
  private batchSize: number = 0;
  private flushTimer: NodeJS.Timeout | null = null;
  private metrics: BatchMetrics;
  private cache: Map<string, { data: any; expiry: number }> = new Map();
  private sending: boolean = false;
  private queue: TraceData[] = [];

  constructor(config?: Partial<BatchConfig>) {
    super();
    
    this.config = {
      maxBatchSize: config?.maxBatchSize || parseInt(process.env.LANGFUSE_BATCH_SIZE || '50'),
      flushInterval: config?.flushInterval || parseInt(process.env.LANGFUSE_FLUSH_INTERVAL || '10000'),
      maxRetries: config?.maxRetries || 3,
      retryDelay: config?.retryDelay || 1000,
      enableCompression: config?.enableCompression !== false,
      enableCaching: config?.enableCaching !== false,
      cacheSize: config?.cacheSize || 1000,
      cacheTTL: config?.cacheTTL || 60000, // 1 minute
    };

    this.metrics = {
      totalBatches: 0,
      successfulBatches: 0,
      failedBatches: 0,
      totalTraces: 0,
      droppedTraces: 0,
      averageBatchSize: 0,
      averageLatency: 0,
      cacheHits: 0,
      cacheMisses: 0,
    };

    this.startFlushTimer();
    this.startCacheCleanup();
  }

  /**
   * Add a trace to the batch
   */
  public addTrace(trace: any): void {
    const traceId = trace.id || this.generateId();
    
    // Check cache first
    if (this.config.enableCaching && this.checkCache(traceId)) {
      this.metrics.cacheHits++;
      return;
    }
    this.metrics.cacheMisses++;

    // Estimate trace size
    const traceSize = this.estimateSize(trace);
    
    const traceData: TraceData = {
      id: traceId,
      timestamp: Date.now(),
      size: traceSize,
      data: trace,
      retries: 0,
    };

    // Add to cache
    if (this.config.enableCaching) {
      this.addToCache(traceId, trace);
    }

    // Add to batch or queue
    if (this.sending) {
      this.queue.push(traceData);
    } else {
      this.batch.push(traceData);
      this.batchSize += traceSize;
      this.metrics.totalTraces++;

      // Check if batch should be flushed
      if (this.shouldFlush()) {
        this.flush();
      }
    }
  }

  /**
   * Check if batch should be flushed
   */
  private shouldFlush(): boolean {
    return (
      this.batch.length >= this.config.maxBatchSize ||
      this.batchSize > 1024 * 1024 // 1MB size limit
    );
  }

  /**
   * Flush the current batch
   */
  public async flush(): Promise<void> {
    if (this.sending || this.batch.length === 0) {
      return;
    }

    this.sending = true;
    this.resetFlushTimer();

    const currentBatch = [...this.batch];
    this.batch = [...this.queue];
    this.queue = [];
    this.batchSize = this.batch.reduce((sum, t) => sum + t.size, 0);

    try {
      const startTime = Date.now();
      await this.sendBatch(currentBatch);
      
      const latency = Date.now() - startTime;
      this.updateMetrics(currentBatch.length, latency, true);
      
      this.emit('batch-sent', {
        size: currentBatch.length,
        latency,
        metrics: this.getMetrics(),
      });
    } catch (error) {
      console.error('Failed to send batch:', error);
      this.updateMetrics(currentBatch.length, 0, false);
      
      // Add failed traces back to queue for retry
      const retryableTraces = currentBatch.filter(t => (t.retries || 0) < this.config.maxRetries);
      retryableTraces.forEach(t => {
        t.retries = (t.retries || 0) + 1;
        this.queue.push(t);
      });

      const droppedCount = currentBatch.length - retryableTraces.length;
      if (droppedCount > 0) {
        this.metrics.droppedTraces += droppedCount;
        this.emit('traces-dropped', droppedCount);
      }
    } finally {
      this.sending = false;
    }
  }

  /**
   * Send batch to Langfuse
   */
  private async sendBatch(traces: TraceData[]): Promise<void> {
    if (traces.length === 0) return;

    const payload = {
      batch: traces.map(t => t.data),
      timestamp: new Date().toISOString(),
      metadata: {
        batchSize: traces.length,
        totalSize: traces.reduce((sum, t) => sum + t.size, 0),
        compressed: this.config.enableCompression,
      },
    };

    // Simulate compression if enabled
    const body = this.config.enableCompression 
      ? await this.compress(JSON.stringify(payload))
      : JSON.stringify(payload);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${this.getAuthHeader()}`,
    };

    if (this.config.enableCompression) {
      headers['Content-Encoding'] = 'gzip';
    }

    const response = await fetch(`${this.getLangfuseHost()}/api/public/traces/batch`, {
      method: 'POST',
      headers,
      body,
    });

    if (!response.ok) {
      throw new Error(`Batch send failed: ${response.status} ${response.statusText}`);
    }
  }

  /**
   * Compress data (simulated for demo)
   */
  private async compress(data: string): Promise<string> {
    // In production, use actual compression like pako or built-in compression
    return data; // Simulated compression
  }

  /**
   * Get auth header
   */
  private getAuthHeader(): string {
    const publicKey = process.env.LANGFUSE_PUBLIC_KEY || '';
    const secretKey = process.env.LANGFUSE_SECRET_KEY || '';
    return Buffer.from(`${publicKey}:${secretKey}`).toString('base64');
  }

  /**
   * Get Langfuse host
   */
  private getLangfuseHost(): string {
    return process.env.LANGFUSE_HOST || 'https://us.cloud.langfuse.com';
  }

  /**
   * Estimate size of trace data
   */
  private estimateSize(data: any): number {
    return JSON.stringify(data).length;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cache management
   */
  private checkCache(id: string): boolean {
    if (!this.config.enableCaching) return false;
    
    const cached = this.cache.get(id);
    if (cached && cached.expiry > Date.now()) {
      return true;
    }
    
    this.cache.delete(id);
    return false;
  }

  private addToCache(id: string, data: any): void {
    if (!this.config.enableCaching) return;
    
    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.config.cacheSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    
    this.cache.set(id, {
      data,
      expiry: Date.now() + this.config.cacheTTL,
    });
  }

  /**
   * Timer management
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      if (this.batch.length > 0) {
        this.flush();
      }
    }, this.config.flushInterval);
  }

  private resetFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.startFlushTimer();
    }
  }

  private startCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.cache.entries()) {
        if (value.expiry < now) {
          this.cache.delete(key);
        }
      }
    }, 60000); // Clean every minute
  }

  /**
   * Metrics management
   */
  private updateMetrics(batchSize: number, latency: number, success: boolean): void {
    this.metrics.totalBatches++;
    
    if (success) {
      this.metrics.successfulBatches++;
      this.metrics.averageBatchSize = 
        (this.metrics.averageBatchSize * (this.metrics.successfulBatches - 1) + batchSize) / 
        this.metrics.successfulBatches;
      this.metrics.averageLatency = 
        (this.metrics.averageLatency * (this.metrics.successfulBatches - 1) + latency) / 
        this.metrics.successfulBatches;
    } else {
      this.metrics.failedBatches++;
    }
  }

  public getMetrics(): BatchMetrics {
    return { ...this.metrics };
  }

  /**
   * Lifecycle management
   */
  public async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    
    // Final flush
    await this.flush();
    
    this.removeAllListeners();
    this.cache.clear();
  }
}

// Export singleton instance
export const batchOptimizer = new LangfuseBatchOptimizer();

// Export for testing
export default batchOptimizer;