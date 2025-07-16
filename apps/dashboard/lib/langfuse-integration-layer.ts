/**
 * Langfuse Integration Layer
 * 
 * This layer provides seamless integration between the trace structure system
 * and Langfuse, handling:
 * - Automatic trace submission to Langfuse
 * - Bidirectional synchronization
 * - Batch processing for performance
 * - Error handling and retry logic
 * - Real-time updates and streaming
 * - Format conversion and mapping
 */

import { EventEmitter } from 'events';
import { TraceMetadata, TraceHierarchy, TraceSpan, TraceGeneration, traceStructureSystem } from './trace-structure-system';
import { SessionContext, sessionManager } from './session-management-system';
import { traceValidator } from './trace-validation-system';
import { getLangfuseServer } from './langfuse-server';
import { createSwarmLogger } from './swarm-langfuse-logger';

export interface LangfuseIntegrationConfig {
  batchSize: number;
  batchTimeout: number;
  retryAttempts: number;
  retryDelay: number;
  enableRealtime: boolean;
  enableValidation: boolean;
  autoCorrect: boolean;
  enableMetrics: boolean;
  compressionEnabled: boolean;
  priorityQueue: boolean;
}

export interface LangfuseTrace {
  id: string;
  name: string;
  sessionId: string;
  userId?: string;
  input?: any;
  output?: any;
  metadata?: Record<string, any>;
  tags?: string[];
  timestamp?: string;
  level?: 'DEBUG' | 'DEFAULT' | 'WARNING' | 'ERROR';
}

export interface LangfuseSpan {
  id: string;
  traceId: string;
  name: string;
  parentObservationId?: string;
  input?: any;
  output?: any;
  metadata?: Record<string, any>;
  startTime?: string;
  endTime?: string;
  level?: 'DEBUG' | 'DEFAULT' | 'WARNING' | 'ERROR';
}

export interface LangfuseGeneration {
  id: string;
  traceId: string;
  name: string;
  parentObservationId?: string;
  model?: string;
  input?: any;
  output?: any;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  metadata?: Record<string, any>;
  startTime?: string;
  endTime?: string;
  level?: 'DEBUG' | 'DEFAULT' | 'WARNING' | 'ERROR';
}

export interface BatchOperation {
  type: 'trace' | 'span' | 'generation';
  operation: 'create' | 'update' | 'end';
  data: any;
  priority: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  retryCount: number;
}

export class LangfuseIntegrationLayer extends EventEmitter {
  private config: LangfuseIntegrationConfig;
  private batchQueue: BatchOperation[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private langfuseClient: any;
  private isProcessing = false;
  private metrics = {
    totalTraces: 0,
    successfulTraces: 0,
    failedTraces: 0,
    retryCount: 0,
    averageLatency: 0,
    lastBatchTime: 0,
  };
  
  constructor(config: Partial<LangfuseIntegrationConfig> = {}) {
    super();
    
    this.config = {
      batchSize: 20,
      batchTimeout: 2000,
      retryAttempts: 3,
      retryDelay: 1000,
      enableRealtime: true,
      enableValidation: true,
      autoCorrect: true,
      enableMetrics: true,
      compressionEnabled: true,
      priorityQueue: true,
      ...config,
    };
    
    this.initializeLangfuseClient();
    this.setupEventListeners();
    this.startBatchProcessor();
  }
  
  /**
   * Initialize Langfuse client
   */
  private initializeLangfuseClient(): void {
    try {
      this.langfuseClient = getLangfuseServer();
      this.emit('client-initialized');
    } catch (error) {
      console.error('Failed to initialize Langfuse client:', error);
      this.emit('client-error', error);
    }
  }
  
  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Listen to trace structure system events
    traceStructureSystem.on?.('trace-created', this.handleTraceCreated.bind(this));
    traceStructureSystem.on?.('trace-updated', this.handleTraceUpdated.bind(this));
    traceStructureSystem.on?.('span-created', this.handleSpanCreated.bind(this));
    traceStructureSystem.on?.('generation-created', this.handleGenerationCreated.bind(this));
    
    // Listen to session manager events
    sessionManager.on('session-created', this.handleSessionCreated.bind(this));
    sessionManager.on('session-completed', this.handleSessionCompleted.bind(this));
    
    // Listen to validation events
    if (this.config.enableValidation) {
      traceValidator.on('trace-validated', this.handleTraceValidated.bind(this));
    }
  }
  
  /**
   * Create trace in Langfuse
   */
  async createTrace(trace: TraceMetadata): Promise<string | null> {
    if (this.config.enableValidation) {
      const validation = traceValidator.validateTrace(trace);
      if (!validation.valid && !this.config.autoCorrect) {
        this.emit('validation-failed', trace, validation);
        return null;
      }
      
      if (validation.corrected && this.config.autoCorrect) {
        trace = validation.corrected;
      }
    }
    
    const langfuseTrace = this.convertToLangfuseTrace(trace);
    
    if (this.config.priorityQueue) {
      this.addToBatch({
        type: 'trace',
        operation: 'create',
        data: langfuseTrace,
        priority: this.getPriority(trace),
        timestamp: Date.now(),
        retryCount: 0,
      });
    } else {
      return await this.submitTraceToLangfuse(langfuseTrace);
    }
    
    return trace.traceId;
  }
  
  /**
   * Update trace in Langfuse
   */
  async updateTrace(traceId: string, updates: Partial<TraceMetadata>): Promise<boolean> {
    const langfuseUpdates = this.convertToLangfuseTrace(updates as TraceMetadata);
    
    if (this.config.priorityQueue) {
      this.addToBatch({
        type: 'trace',
        operation: 'update',
        data: { id: traceId, ...langfuseUpdates },
        priority: 'medium',
        timestamp: Date.now(),
        retryCount: 0,
      });
      return true;
    } else {
      return await this.updateTraceInLangfuse(traceId, langfuseUpdates);
    }
  }
  
  /**
   * Create span in Langfuse
   */
  async createSpan(span: TraceSpan): Promise<string | null> {
    const langfuseSpan = this.convertToLangfuseSpan(span);
    
    if (this.config.priorityQueue) {
      this.addToBatch({
        type: 'span',
        operation: 'create',
        data: langfuseSpan,
        priority: 'medium',
        timestamp: Date.now(),
        retryCount: 0,
      });
    } else {
      return await this.submitSpanToLangfuse(langfuseSpan);
    }
    
    return span.spanId;
  }
  
  /**
   * Create generation in Langfuse
   */
  async createGeneration(generation: TraceGeneration): Promise<string | null> {
    const langfuseGeneration = this.convertToLangfuseGeneration(generation);
    
    if (this.config.priorityQueue) {
      this.addToBatch({
        type: 'generation',
        operation: 'create',
        data: langfuseGeneration,
        priority: 'high',
        timestamp: Date.now(),
        retryCount: 0,
      });
    } else {
      return await this.submitGenerationToLangfuse(langfuseGeneration);
    }
    
    return generation.generationId;
  }
  
  /**
   * Submit hierarchy to Langfuse
   */
  async submitHierarchy(hierarchy: TraceHierarchy): Promise<boolean> {
    try {
      // Submit root trace
      await this.createTrace(hierarchy.trace);
      
      // Submit spans
      for (const span of hierarchy.spans) {
        await this.createSpan(span);
      }
      
      // Submit generations
      for (const generation of hierarchy.generations) {
        await this.createGeneration(generation);
      }
      
      // Submit children recursively
      for (const child of hierarchy.children) {
        await this.submitHierarchy(child);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to submit hierarchy:', error);
      this.emit('hierarchy-error', hierarchy, error);
      return false;
    }
  }
  
  /**
   * Submit session to Langfuse
   */
  async submitSession(session: SessionContext): Promise<boolean> {
    try {
      // Create session trace
      const sessionTrace: TraceMetadata = {
        traceId: `session-trace-${session.sessionId}`,
        sessionId: session.sessionId,
        operation: 'session_execution',
        operationType: 'custom',
        startTime: session.startTime,
        endTime: session.endTime,
        duration: session.endTime ? session.endTime - session.startTime : undefined,
        status: session.endTime ? 'success' : 'running',
        priority: 'medium',
        tags: ['session', session.sessionType],
        category: 'session_management',
        complexity: 'medium',
        custom: {
          sessionName: session.sessionName,
          sessionType: session.sessionType,
          totalTraces: session.totalTraces,
          activeTraces: session.activeTraces,
          ...session.metadata,
        },
      };
      
      await this.createTrace(sessionTrace);
      return true;
    } catch (error) {
      console.error('Failed to submit session:', error);
      this.emit('session-error', session, error);
      return false;
    }
  }
  
  /**
   * Convert to Langfuse trace format
   */
  private convertToLangfuseTrace(trace: TraceMetadata): LangfuseTrace {
    return {
      id: trace.traceId,
      name: trace.operation || 'Unknown Operation',
      sessionId: trace.sessionId,
      userId: trace.agentId,
      input: trace.input,
      output: trace.output,
      metadata: {
        agentId: trace.agentId,
        agentName: trace.agentName,
        agentType: trace.agentType,
        swarmId: trace.swarmId,
        swarmTopology: trace.swarmTopology,
        operationType: trace.operationType,
        priority: trace.priority,
        category: trace.category,
        complexity: trace.complexity,
        startTime: trace.startTime,
        endTime: trace.endTime,
        duration: trace.duration,
        memoryUsage: trace.memoryUsage,
        cpuUsage: trace.cpuUsage,
        tokenUsage: trace.tokenUsage,
        error: trace.error,
        custom: trace.custom,
      },
      tags: trace.tags,
      timestamp: new Date(trace.startTime).toISOString(),
      level: this.mapStatusToLevel(trace.status),
    };
  }
  
  /**
   * Convert to Langfuse span format
   */
  private convertToLangfuseSpan(span: TraceSpan): LangfuseSpan {
    return {
      id: span.spanId,
      traceId: span.traceId,
      name: span.name,
      parentObservationId: span.parentSpanId,
      input: span.metadata.input,
      output: span.metadata.output,
      metadata: span.metadata,
      startTime: new Date(span.startTime).toISOString(),
      endTime: span.endTime ? new Date(span.endTime).toISOString() : undefined,
      level: this.mapStatusToLevel(span.status),
    };
  }
  
  /**
   * Convert to Langfuse generation format
   */
  private convertToLangfuseGeneration(generation: TraceGeneration): LangfuseGeneration {
    return {
      id: generation.generationId,
      traceId: generation.traceId,
      name: `${generation.model} Generation`,
      parentObservationId: generation.spanId,
      model: generation.model,
      input: generation.prompt,
      output: generation.completion,
      usage: generation.tokenUsage ? {
        promptTokens: generation.tokenUsage.promptTokens,
        completionTokens: generation.tokenUsage.completionTokens,
        totalTokens: generation.tokenUsage.totalTokens,
      } : undefined,
      metadata: generation.metadata,
      startTime: new Date(generation.startTime).toISOString(),
      endTime: generation.endTime ? new Date(generation.endTime).toISOString() : undefined,
      level: 'DEFAULT',
    };
  }
  
  /**
   * Map status to Langfuse level
   */
  private mapStatusToLevel(status: string): 'DEBUG' | 'DEFAULT' | 'WARNING' | 'ERROR' {
    switch (status) {
      case 'error': return 'ERROR';
      case 'running': return 'DEBUG';
      case 'pending': return 'DEBUG';
      case 'success': return 'DEFAULT';
      default: return 'DEFAULT';
    }
  }
  
  /**
   * Get priority for trace
   */
  private getPriority(trace: TraceMetadata): 'low' | 'medium' | 'high' | 'critical' {
    if (trace.status === 'error') return 'critical';
    if (trace.priority === 'high' || trace.priority === 'critical') return 'high';
    if (trace.operationType === 'llm_generate') return 'high';
    if (trace.operationType === 'swarm_coordinate') return 'medium';
    return 'low';
  }
  
  /**
   * Add to batch queue
   */
  private addToBatch(operation: BatchOperation): void {
    this.batchQueue.push(operation);
    
    // Sort by priority if enabled
    if (this.config.priorityQueue) {
      this.batchQueue.sort((a, b) => {
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });
    }
    
    // Process batch if size threshold reached
    if (this.batchQueue.length >= this.config.batchSize) {
      this.processBatch();
    }
    
    // Start timer if not already running
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.processBatch();
      }, this.config.batchTimeout);
    }
  }
  
  /**
   * Process batch queue
   */
  private async processBatch(): Promise<void> {
    if (this.isProcessing || this.batchQueue.length === 0) return;
    
    this.isProcessing = true;
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    
    const batch = this.batchQueue.splice(0, this.config.batchSize);
    const startTime = Date.now();
    
    try {
      const results = await Promise.allSettled(
        batch.map(operation => this.processOperation(operation))
      );
      
      let successful = 0;
      let failed = 0;
      
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const operation = batch[i];
        
        if (result.status === 'fulfilled') {
          successful++;
        } else {
          failed++;
          
          // Retry failed operations
          if (operation.retryCount < this.config.retryAttempts) {
            operation.retryCount++;
            setTimeout(() => {
              this.addToBatch(operation);
            }, this.config.retryDelay * Math.pow(2, operation.retryCount));
          } else {
            this.emit('operation-failed', operation, result.reason);
          }
        }
      }
      
      // Update metrics
      this.updateMetrics(successful, failed, Date.now() - startTime);
      
      this.emit('batch-processed', {
        size: batch.length,
        successful,
        failed,
        duration: Date.now() - startTime,
      });
      
    } catch (error) {
      console.error('Batch processing failed:', error);
      this.emit('batch-error', batch, error);
    } finally {
      this.isProcessing = false;
      
      // Process remaining items if any
      if (this.batchQueue.length > 0) {
        setTimeout(() => this.processBatch(), 100);
      }
    }
  }
  
  /**
   * Process single operation
   */
  private async processOperation(operation: BatchOperation): Promise<any> {
    switch (operation.type) {
      case 'trace':
        if (operation.operation === 'create') {
          return await this.submitTraceToLangfuse(operation.data);
        } else if (operation.operation === 'update') {
          return await this.updateTraceInLangfuse(operation.data.id, operation.data);
        }
        break;
      
      case 'span':
        return await this.submitSpanToLangfuse(operation.data);
      
      case 'generation':
        return await this.submitGenerationToLangfuse(operation.data);
    }
  }
  
  /**
   * Submit trace to Langfuse
   */
  private async submitTraceToLangfuse(trace: LangfuseTrace): Promise<string> {
    const langfuseTrace = this.langfuseClient.trace(trace);
    await this.langfuseClient.flushAsync();
    return trace.id;
  }
  
  /**
   * Update trace in Langfuse
   */
  private async updateTraceInLangfuse(traceId: string, updates: Partial<LangfuseTrace>): Promise<boolean> {
    // Note: Langfuse doesn't support direct updates, so we'll create a new trace
    const langfuseTrace = this.langfuseClient.trace({ id: traceId, ...updates });
    await this.langfuseClient.flushAsync();
    return true;
  }
  
  /**
   * Submit span to Langfuse
   */
  private async submitSpanToLangfuse(span: LangfuseSpan): Promise<string> {
    const trace = this.langfuseClient.trace({ id: span.traceId });
    const langfuseSpan = trace.span(span);
    await this.langfuseClient.flushAsync();
    return span.id;
  }
  
  /**
   * Submit generation to Langfuse
   */
  private async submitGenerationToLangfuse(generation: LangfuseGeneration): Promise<string> {
    const trace = this.langfuseClient.trace({ id: generation.traceId });
    const langfuseGeneration = trace.generation(generation);
    await this.langfuseClient.flushAsync();
    return generation.id;
  }
  
  /**
   * Update metrics
   */
  private updateMetrics(successful: number, failed: number, duration: number): void {
    if (this.config.enableMetrics) {
      this.metrics.totalTraces += successful + failed;
      this.metrics.successfulTraces += successful;
      this.metrics.failedTraces += failed;
      this.metrics.averageLatency = (this.metrics.averageLatency + duration) / 2;
      this.metrics.lastBatchTime = Date.now();
    }
  }
  
  /**
   * Event handlers
   */
  private async handleTraceCreated(trace: TraceMetadata): Promise<void> {
    await this.createTrace(trace);
  }
  
  private async handleTraceUpdated(trace: TraceMetadata): Promise<void> {
    await this.updateTrace(trace.traceId, trace);
  }
  
  private async handleSpanCreated(span: TraceSpan): Promise<void> {
    await this.createSpan(span);
  }
  
  private async handleGenerationCreated(generation: TraceGeneration): Promise<void> {
    await this.createGeneration(generation);
  }
  
  private async handleSessionCreated(session: SessionContext): Promise<void> {
    await this.submitSession(session);
  }
  
  private async handleSessionCompleted(session: SessionContext): Promise<void> {
    await this.submitSession(session);
  }
  
  private async handleTraceValidated(trace: TraceMetadata, validation: any): Promise<void> {
    if (validation.valid) {
      this.emit('trace-validated', trace, validation);
    } else {
      this.emit('trace-validation-failed', trace, validation);
    }
  }
  
  /**
   * Start batch processor
   */
  private startBatchProcessor(): void {
    // Process batches every interval
    setInterval(() => {
      if (this.batchQueue.length > 0) {
        this.processBatch();
      }
    }, this.config.batchTimeout);
  }
  
  /**
   * Get metrics
   */
  getMetrics(): typeof this.metrics {
    return { ...this.metrics };
  }
  
  /**
   * Get queue status
   */
  getQueueStatus(): { size: number; processing: boolean } {
    return {
      size: this.batchQueue.length,
      processing: this.isProcessing,
    };
  }
  
  /**
   * Update configuration
   */
  updateConfig(config: Partial<LangfuseIntegrationConfig>): void {
    this.config = { ...this.config, ...config };
    this.emit('config-updated', this.config);
  }
  
  /**
   * Flush all pending operations
   */
  async flush(): Promise<void> {
    while (this.batchQueue.length > 0) {
      await this.processBatch();
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  /**
   * Shutdown integration layer
   */
  async shutdown(): Promise<void> {
    await this.flush();
    this.removeAllListeners();
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }
    
    if (this.langfuseClient) {
      await this.langfuseClient.shutdownAsync();
    }
  }
}

// Export singleton instance
export const langfuseIntegration = new LangfuseIntegrationLayer();

export default langfuseIntegration;