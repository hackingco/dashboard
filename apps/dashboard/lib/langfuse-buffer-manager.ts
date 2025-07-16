/**
 * Langfuse Buffer Management System
 * Manages trace buffers for optimal batch processing and reliable delivery
 */

import { EventEmitter } from 'events';

// Types for buffer management
interface BufferEntry {
  id: string;
  trace: any;
  timestamp: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  retryCount: number;
  size: number;
  dependencies: string[];
  metadata: {
    source: string;
    sessionId?: string;
    agentId?: string;
    swarmId?: string;
  };
}

interface BufferConfig {
  maxSize: number;
  maxMemory: number; // bytes
  flushThreshold: number;
  maxAge: number; // milliseconds
  priorityWeights: Record<string, number>;
  enableCompression: boolean;
  enableDeduplication: boolean;
}

interface BufferStats {
  totalEntries: number;
  totalSize: number;
  averageEntrySize: number;
  oldestEntry: number;
  newestEntry: number;
  priorityDistribution: Record<string, number>;
  memoryUsage: number;
  compressionRatio: number;
  deduplicationSavings: number;
}

interface FlushBatch {
  id: string;
  entries: BufferEntry[];
  totalSize: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedFlushTime: number;
  dependencies: string[];
}

/**
 * Advanced buffer manager for Langfuse traces
 */
export class LangfuseBufferManager extends EventEmitter {
  private buffers: Map<string, BufferEntry> = new Map();
  private priorityQueues: Map<string, BufferEntry[]> = new Map();
  private config: BufferConfig;
  private stats: BufferStats;
  private compressionCache: Map<string, string> = new Map();
  private deduplicationCache: Map<string, string> = new Map();
  private flushTimer: NodeJS.Timeout | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(config?: Partial<BufferConfig>) {
    super();
    
    this.config = {
      maxSize: config?.maxSize || 1000,
      maxMemory: config?.maxMemory || 10 * 1024 * 1024, // 10MB
      flushThreshold: config?.flushThreshold || 0.8,
      maxAge: config?.maxAge || 30000, // 30 seconds
      priorityWeights: config?.priorityWeights || {
        critical: 4,
        high: 3,
        medium: 2,
        low: 1,
      },
      enableCompression: config?.enableCompression !== false,
      enableDeduplication: config?.enableDeduplication !== false,
    };

    this.stats = {
      totalEntries: 0,
      totalSize: 0,
      averageEntrySize: 0,
      oldestEntry: Date.now(),
      newestEntry: Date.now(),
      priorityDistribution: { critical: 0, high: 0, medium: 0, low: 0 },
      memoryUsage: 0,
      compressionRatio: 1.0,
      deduplicationSavings: 0,
    };

    // Initialize priority queues
    ['critical', 'high', 'medium', 'low'].forEach(priority => {
      this.priorityQueues.set(priority, []);
    });

    this.startTimers();
  }

  /**
   * Add trace to buffer with intelligent management
   */
  public addTrace(trace: any, options?: {
    priority?: 'low' | 'medium' | 'high' | 'critical';
    source?: string;
    sessionId?: string;
    agentId?: string;
    swarmId?: string;
    dependencies?: string[];
  }): string {
    const entryId = this.generateEntryId();
    const now = Date.now();
    
    // Check for deduplication
    if (this.config.enableDeduplication) {
      const duplicateId = this.checkForDuplicate(trace);
      if (duplicateId) {
        console.log(`🔄 Deduplicated trace: ${entryId} -> ${duplicateId}`);
        this.stats.deduplicationSavings++;
        return duplicateId;
      }
    }

    // Calculate trace size
    const traceSize = this.calculateTraceSize(trace);
    
    // Check if we need to make room
    if (this.shouldMakeRoom(traceSize)) {
      this.makeRoom(traceSize);
    }

    // Create buffer entry
    const entry: BufferEntry = {
      id: entryId,
      trace: this.config.enableCompression ? this.compressTrace(trace) : trace,
      timestamp: now,
      priority: options?.priority || this.determinePriority(trace),
      retryCount: 0,
      size: traceSize,
      dependencies: options?.dependencies || [],
      metadata: {
        source: options?.source || 'unknown',
        sessionId: options?.sessionId,
        agentId: options?.agentId,
        swarmId: options?.swarmId,
      },
    };

    // Add to buffer and priority queue
    this.buffers.set(entryId, entry);
    this.priorityQueues.get(entry.priority)?.push(entry);

    // Update stats
    this.updateStats(entry, 'added');

    // Check if we should flush
    if (this.shouldFlush()) {
      this.emit('flush-requested', {
        reason: 'threshold-reached',
        bufferSize: this.buffers.size,
        memoryUsage: this.stats.memoryUsage,
      });
    }

    console.log(`📦 Added trace ${entryId} to buffer (${entry.priority} priority, ${traceSize} bytes)`);
    return entryId;
  }

  /**
   * Get optimal flush batch
   */
  public getOptimalBatch(maxSize?: number, targetPriority?: string): FlushBatch {
    const batchSize = maxSize || 50;
    const entries: BufferEntry[] = [];
    let totalSize = 0;
    let highestPriority: 'low' | 'medium' | 'high' | 'critical' = 'low';
    const dependencies: string[] = [];

    // Strategy: prioritize by priority, then by age
    const priorityOrder = ['critical', 'high', 'medium', 'low'];
    
    for (const priority of priorityOrder) {
      if (targetPriority && priority !== targetPriority) continue;
      
      const queue = this.priorityQueues.get(priority) || [];
      
      // Sort by age (oldest first)
      queue.sort((a, b) => a.timestamp - b.timestamp);
      
      for (const entry of queue) {
        if (entries.length >= batchSize) break;
        
        // Check dependencies
        if (entry.dependencies.length > 0) {
          const dependenciesMet = entry.dependencies.every(dep => 
            this.buffers.has(dep) || entries.some(e => e.id === dep)
          );
          if (!dependenciesMet) {
            dependencies.push(...entry.dependencies);
            continue;
          }
        }

        entries.push(entry);
        totalSize += entry.size;
        
        if (this.config.priorityWeights[priority] > this.config.priorityWeights[highestPriority]) {
          highestPriority = priority as any;
        }
      }
      
      if (entries.length >= batchSize) break;
    }

    const batchId = this.generateBatchId();
    
    return {
      id: batchId,
      entries,
      totalSize,
      priority: highestPriority,
      estimatedFlushTime: this.estimateFlushTime(entries),
      dependencies: Array.from(new Set(dependencies)),
    };
  }

  /**
   * Remove entries from buffer (after successful flush)
   */
  public removeEntries(entryIds: string[]): void {
    entryIds.forEach(id => {
      const entry = this.buffers.get(id);
      if (entry) {
        // Remove from main buffer
        this.buffers.delete(id);
        
        // Remove from priority queue
        const queue = this.priorityQueues.get(entry.priority);
        if (queue) {
          const index = queue.findIndex(e => e.id === id);
          if (index !== -1) {
            queue.splice(index, 1);
          }
        }
        
        // Update stats
        this.updateStats(entry, 'removed');
        
        console.log(`🗑️ Removed trace ${id} from buffer`);
      }
    });
  }

  /**
   * Retry failed entries
   */
  public retryEntries(entryIds: string[], maxRetries: number = 3): void {
    entryIds.forEach(id => {
      const entry = this.buffers.get(id);
      if (entry) {
        entry.retryCount++;
        
        if (entry.retryCount > maxRetries) {
          console.warn(`⚠️ Dropping trace ${id} after ${maxRetries} retries`);
          this.removeEntries([id]);
          this.emit('entry-dropped', { entry, reason: 'max-retries' });
        } else {
          console.log(`🔄 Retrying trace ${id} (attempt ${entry.retryCount})`);
          // Increase priority for retried entries
          this.increasePriority(entry);
        }
      }
    });
  }

  /**
   * Get buffer statistics
   */
  public getStats(): BufferStats {
    this.recalculateStats();
    return { ...this.stats };
  }

  /**
   * Get buffer health status
   */
  public getHealthStatus(): {
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    recommendations: string[];
    metrics: BufferStats;
  } {
    const stats = this.getStats();
    const issues: string[] = [];
    const recommendations: string[] = [];
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    // Check memory usage
    if (stats.memoryUsage > this.config.maxMemory * 0.9) {
      issues.push('Memory usage critical');
      recommendations.push('Enable compression or increase memory limit');
      status = 'critical';
    } else if (stats.memoryUsage > this.config.maxMemory * 0.7) {
      issues.push('Memory usage high');
      recommendations.push('Consider flushing more frequently');
      status = 'warning';
    }

    // Check buffer size
    if (stats.totalEntries > this.config.maxSize * 0.9) {
      issues.push('Buffer size critical');
      recommendations.push('Increase flush frequency or buffer size');
      status = 'critical';
    } else if (stats.totalEntries > this.config.maxSize * 0.7) {
      issues.push('Buffer size high');
      recommendations.push('Monitor flush performance');
      status = 'warning';
    }

    // Check age of entries
    const oldestAge = Date.now() - stats.oldestEntry;
    if (oldestAge > this.config.maxAge * 2) {
      issues.push('Very old entries detected');
      recommendations.push('Check flush system performance');
      status = 'critical';
    } else if (oldestAge > this.config.maxAge) {
      issues.push('Old entries detected');
      recommendations.push('Monitor flush frequency');
      status = 'warning';
    }

    return {
      status,
      issues,
      recommendations,
      metrics: stats,
    };
  }

  /**
   * Smart buffer optimization
   */
  public optimize(): {
    compressionSavings: number;
    deduplicationSavings: number;
    memoryFreed: number;
    optimizationTime: number;
  } {
    const startTime = Date.now();
    let compressionSavings = 0;
    let deduplicationSavings = 0;
    let memoryFreed = 0;

    console.log('🔧 Starting buffer optimization...');

    // Compression optimization
    if (this.config.enableCompression) {
      compressionSavings = this.optimizeCompression();
    }

    // Deduplication optimization
    if (this.config.enableDeduplication) {
      deduplicationSavings = this.optimizeDeduplication();
    }

    // Memory cleanup
    memoryFreed = this.cleanupMemory();

    const optimizationTime = Date.now() - startTime;

    console.log(`✅ Buffer optimization complete:
      Compression savings: ${compressionSavings} bytes
      Deduplication savings: ${deduplicationSavings} entries
      Memory freed: ${memoryFreed} bytes
      Time taken: ${optimizationTime}ms`);

    return {
      compressionSavings,
      deduplicationSavings,
      memoryFreed,
      optimizationTime,
    };
  }

  /**
   * Emergency flush - clear all buffers
   */
  public async emergencyFlush(): Promise<FlushBatch[]> {
    console.log('🚨 Emergency flush activated');
    
    const batches: FlushBatch[] = [];
    const batchSize = 25; // Smaller batches for emergency
    
    while (this.buffers.size > 0) {
      const batch = this.getOptimalBatch(batchSize);
      if (batch.entries.length === 0) break;
      
      batches.push(batch);
      
      // Don't remove entries yet - let the flush system handle it
      if (batches.length > 20) { // Prevent infinite loop
        console.warn('⚠️ Emergency flush batch limit reached');
        break;
      }
    }
    
    return batches;
  }

  /**
   * Shutdown buffer manager
   */
  public async shutdown(): Promise<void> {
    console.log('🔄 Shutting down buffer manager...');
    
    // Stop timers
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    // Clear caches
    this.compressionCache.clear();
    this.deduplicationCache.clear();
    
    // Emit final stats
    this.emit('shutdown', {
      finalStats: this.getStats(),
      remainingEntries: this.buffers.size,
    });
    
    console.log('✅ Buffer manager shutdown complete');
  }

  // Private helper methods

  private generateEntryId(): string {
    return `entry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateBatchId(): string {
    return `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateTraceSize(trace: any): number {
    return JSON.stringify(trace).length;
  }

  private determinePriority(trace: any): 'low' | 'medium' | 'high' | 'critical' {
    // Determine priority based on trace characteristics
    if (trace.level === 'ERROR' || trace.status === 'error') {
      return 'high';
    }
    
    if (trace.metadata?.urgent || trace.tags?.includes('urgent')) {
      return 'high';
    }
    
    if (trace.metadata?.system || trace.tags?.includes('system')) {
      return 'medium';
    }
    
    return 'low';
  }

  private shouldMakeRoom(newEntrySize: number): boolean {
    const wouldExceedSize = this.buffers.size >= this.config.maxSize;
    const wouldExceedMemory = this.stats.memoryUsage + newEntrySize > this.config.maxMemory;
    
    return wouldExceedSize || wouldExceedMemory;
  }

  private makeRoom(requiredSize: number): void {
    console.log(`🧹 Making room for ${requiredSize} bytes...`);
    
    // Strategy: remove oldest low-priority entries first
    const lowPriorityQueue = this.priorityQueues.get('low') || [];
    lowPriorityQueue.sort((a, b) => a.timestamp - b.timestamp);
    
    let freedMemory = 0;
    const toRemove: string[] = [];
    
    for (const entry of lowPriorityQueue) {
      toRemove.push(entry.id);
      freedMemory += entry.size;
      
      if (freedMemory >= requiredSize) break;
    }
    
    if (toRemove.length > 0) {
      this.removeEntries(toRemove);
      console.log(`🧹 Removed ${toRemove.length} entries, freed ${freedMemory} bytes`);
    }
  }

  private shouldFlush(): boolean {
    const sizeThreshold = this.buffers.size >= this.config.maxSize * this.config.flushThreshold;
    const memoryThreshold = this.stats.memoryUsage >= this.config.maxMemory * this.config.flushThreshold;
    const ageThreshold = Date.now() - this.stats.oldestEntry > this.config.maxAge;
    
    return sizeThreshold || memoryThreshold || ageThreshold;
  }

  private compressTrace(trace: any): any {
    // Simple compression simulation
    const compressed = JSON.stringify(trace);
    return compressed;
  }

  private checkForDuplicate(trace: any): string | null {
    const traceHash = this.generateTraceHash(trace);
    return this.deduplicationCache.get(traceHash) || null;
  }

  private generateTraceHash(trace: any): string {
    // Simple hash based on key properties
    const key = `${trace.id}-${trace.name}-${trace.sessionId}-${trace.timestamp}`;
    return Buffer.from(key).toString('base64');
  }

  private updateStats(entry: BufferEntry, operation: 'added' | 'removed'): void {
    if (operation === 'added') {
      this.stats.totalEntries++;
      this.stats.totalSize += entry.size;
      this.stats.memoryUsage += entry.size;
      this.stats.priorityDistribution[entry.priority]++;
      
      if (entry.timestamp < this.stats.oldestEntry) {
        this.stats.oldestEntry = entry.timestamp;
      }
      if (entry.timestamp > this.stats.newestEntry) {
        this.stats.newestEntry = entry.timestamp;
      }
    } else {
      this.stats.totalEntries--;
      this.stats.totalSize -= entry.size;
      this.stats.memoryUsage -= entry.size;
      this.stats.priorityDistribution[entry.priority]--;
    }
    
    this.stats.averageEntrySize = this.stats.totalEntries > 0 ? 
      this.stats.totalSize / this.stats.totalEntries : 0;
  }

  private recalculateStats(): void {
    // Recalculate stats from current buffer state
    const entries = Array.from(this.buffers.values());
    
    this.stats.totalEntries = entries.length;
    this.stats.totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);
    this.stats.memoryUsage = this.stats.totalSize;
    this.stats.averageEntrySize = this.stats.totalEntries > 0 ? 
      this.stats.totalSize / this.stats.totalEntries : 0;
    
    // Reset and recalculate priority distribution
    this.stats.priorityDistribution = { critical: 0, high: 0, medium: 0, low: 0 };
    entries.forEach(entry => {
      this.stats.priorityDistribution[entry.priority]++;
    });
    
    // Update oldest/newest
    if (entries.length > 0) {
      this.stats.oldestEntry = Math.min(...entries.map(e => e.timestamp));
      this.stats.newestEntry = Math.max(...entries.map(e => e.timestamp));
    }
  }

  private estimateFlushTime(entries: BufferEntry[]): number {
    // Base flush time estimation
    const baseTime = 100; // Base 100ms
    const entryTime = entries.length * 10; // 10ms per entry
    const sizeTime = entries.reduce((sum, e) => sum + e.size, 0) / 1000; // 1ms per KB
    
    return baseTime + entryTime + sizeTime;
  }

  private increasePriority(entry: BufferEntry): void {
    const priorities = ['low', 'medium', 'high', 'critical'];
    const currentIndex = priorities.indexOf(entry.priority);
    
    if (currentIndex < priorities.length - 1) {
      const oldPriority = entry.priority;
      const newPriority = priorities[currentIndex + 1] as any;
      
      // Remove from old queue
      const oldQueue = this.priorityQueues.get(oldPriority);
      if (oldQueue) {
        const index = oldQueue.findIndex(e => e.id === entry.id);
        if (index !== -1) {
          oldQueue.splice(index, 1);
        }
      }
      
      // Add to new queue
      entry.priority = newPriority;
      this.priorityQueues.get(newPriority)?.push(entry);
      
      // Update stats
      this.stats.priorityDistribution[oldPriority]--;
      this.stats.priorityDistribution[newPriority]++;
    }
  }

  private optimizeCompression(): number {
    // Placeholder for compression optimization
    return 0;
  }

  private optimizeDeduplication(): number {
    // Placeholder for deduplication optimization
    return 0;
  }

  private cleanupMemory(): number {
    // Cleanup expired cache entries
    const now = Date.now();
    let freedMemory = 0;
    
    // Clean compression cache
    for (const [key, value] of this.compressionCache.entries()) {
      if (Math.random() < 0.1) { // Random cleanup
        this.compressionCache.delete(key);
        freedMemory += value.length;
      }
    }
    
    // Clean deduplication cache
    for (const [key, value] of this.deduplicationCache.entries()) {
      if (Math.random() < 0.1) { // Random cleanup
        this.deduplicationCache.delete(key);
        freedMemory += key.length + value.length;
      }
    }
    
    return freedMemory;
  }

  private startTimers(): void {
    // Auto-flush timer
    this.flushTimer = setInterval(() => {
      if (this.shouldFlush()) {
        this.emit('flush-requested', {
          reason: 'timer',
          bufferSize: this.buffers.size,
          memoryUsage: this.stats.memoryUsage,
        });
      }
    }, 5000); // Check every 5 seconds
    
    // Cleanup timer
    this.cleanupTimer = setInterval(() => {
      this.cleanupMemory();
    }, 30000); // Cleanup every 30 seconds
  }
}

// Export singleton instance
export const bufferManager = new LangfuseBufferManager();

// Export for testing
export default bufferManager;