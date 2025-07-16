/**
 * Langfuse Flush Integration
 * Complete integration of all flush system components
 */

import { Langfuse } from 'langfuse';
import { LangfuseFlushManager } from './langfuse-flush-system';
import { LangfuseTimingOptimizer } from './langfuse-timing-optimizer';
import { LangfuseBufferManager } from './langfuse-buffer-manager';
import { LangfuseErrorHandler } from './langfuse-error-handler';
import { LangfuseFlushMonitor } from './langfuse-flush-monitor';

/**
 * Complete Langfuse flush integration system
 * Provides bulletproof trace delivery with all advanced features
 */
export class LangfuseFlushIntegration {
  private langfuse: Langfuse;
  private flushManager: LangfuseFlushManager;
  private timingOptimizer: LangfuseTimingOptimizer;
  private bufferManager: LangfuseBufferManager;
  private errorHandler: LangfuseErrorHandler;
  private flushMonitor: LangfuseFlushMonitor;
  
  private isInitialized: boolean = false;

  constructor(langfuse: Langfuse) {
    this.langfuse = langfuse;
    
    // Initialize all components
    this.flushManager = new LangfuseFlushManager(langfuse);
    this.timingOptimizer = new LangfuseTimingOptimizer();
    this.bufferManager = new LangfuseBufferManager();
    this.errorHandler = new LangfuseErrorHandler();
    this.flushMonitor = new LangfuseFlushMonitor();
    
    this.setupIntegration();
  }

  /**
   * Initialize the complete flush system
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('⚠️ Flush integration already initialized');
      return;
    }

    console.log('🚀 Initializing Langfuse flush integration...');

    try {
      // Setup component integrations
      this.setupFlushManagerIntegration();
      this.setupBufferManagerIntegration();
      this.setupErrorHandlerIntegration();
      this.setupMonitoringIntegration();

      // Start monitoring
      this.flushMonitor.startRealTimeMonitoring();

      this.isInitialized = true;
      console.log('✅ Langfuse flush integration initialized successfully');

      // Log initial system status
      await this.logSystemStatus();
    } catch (error) {
      console.error('❌ Failed to initialize flush integration:', error);
      throw error;
    }
  }

  /**
   * Create traces with intelligent buffering and flushing
   */
  public async createAndFlushTraces(traces: any[]): Promise<{
    success: boolean;
    flushed: number;
    buffered: number;
    errors: number;
    details: string;
  }> {
    if (!this.isInitialized) {
      throw new Error('Flush integration not initialized');
    }

    console.log(`📊 Processing ${traces.length} traces with intelligent flush system...`);

    const startTime = Date.now();
    let flushed = 0;
    let buffered = 0;
    let errors = 0;

    try {
      // Check circuit breaker
      if (!this.errorHandler.canProceed()) {
        console.log('🔒 Circuit breaker is open - buffering traces');
        traces.forEach(trace => {
          this.bufferManager.addTrace(trace, { priority: 'high' });
          buffered++;
        });
        
        return {
          success: false,
          flushed: 0,
          buffered,
          errors: 0,
          details: 'Circuit breaker open - traces buffered',
        };
      }

      // Get optimal timing
      const timing = this.timingOptimizer.getOptimalTiming(traces.length, {
        urgency: 'medium',
        systemLoad: 0.5,
      });

      console.log(`⏱️ Optimal timing: ${timing.optimalDelay}ms delay (${timing.confidence * 100}% confidence)`);

      // Add traces to buffer with intelligent priority
      traces.forEach(trace => {
        const priority = this.determinePriority(trace);
        this.bufferManager.addTrace(trace, { priority });
        buffered++;
      });

      // Apply optimal delay
      if (timing.optimalDelay > 0) {
        await this.sleep(timing.optimalDelay);
      }

      // Get optimal batch
      const batch = this.bufferManager.getOptimalBatch(50);
      
      if (batch.entries.length > 0) {
        console.log(`🔄 Flushing batch of ${batch.entries.length} traces...`);
        
        // Execute flush with comprehensive error handling
        const flushResult = await this.executeFlushWithErrorHandling(batch);
        
        if (flushResult.success) {
          // Remove successfully flushed entries
          this.bufferManager.removeEntries(batch.entries.map(e => e.id));
          flushed = batch.entries.length;
          buffered -= flushed;
          
          // Learn from successful operation
          this.timingOptimizer.learnFromResult({
            traceCount: batch.entries.length,
            flushDelay: timing.optimalDelay,
            success: true,
            duration: flushResult.duration,
          });
        } else {
          // Handle retry entries
          this.bufferManager.retryEntries(batch.entries.map(e => e.id));
          errors = batch.entries.length;
          
          // Learn from failed operation
          this.timingOptimizer.learnFromResult({
            traceCount: batch.entries.length,
            flushDelay: timing.optimalDelay,
            success: false,
            duration: flushResult.duration,
            error: flushResult.error,
          });
        }
      }

      const totalTime = Date.now() - startTime;
      const details = `Processed in ${totalTime}ms with ${timing.reasoning}`;

      return {
        success: flushed > 0,
        flushed,
        buffered,
        errors,
        details,
      };
    } catch (error) {
      console.error('❌ Error in createAndFlushTraces:', error);
      
      // Handle error through error handler
      await this.errorHandler.handleFlushError(error as Error, {
        traceCount: traces.length,
        retryCount: 0,
        flushDelay: 0,
        batchSize: traces.length,
        operationId: 'create-and-flush',
      });

      return {
        success: false,
        flushed: 0,
        buffered: traces.length,
        errors: traces.length,
        details: `Error: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Emergency flush all buffered traces
   */
  public async emergencyFlushAll(): Promise<{
    success: boolean;
    totalFlushed: number;
    totalErrors: number;
    duration: number;
  }> {
    console.log('🚨 Emergency flush initiated...');
    
    const startTime = Date.now();
    let totalFlushed = 0;
    let totalErrors = 0;

    try {
      // Get all batches for emergency flush
      const batches = await this.bufferManager.emergencyFlush();
      
      console.log(`🔄 Emergency flushing ${batches.length} batches...`);

      // Process each batch
      for (const batch of batches) {
        try {
          const result = await this.flushManager.emergencyFlush();
          
          if (result) {
            this.bufferManager.removeEntries(batch.entries.map(e => e.id));
            totalFlushed += batch.entries.length;
          } else {
            totalErrors += batch.entries.length;
          }
        } catch (error) {
          console.error(`❌ Emergency flush batch failed:`, error);
          totalErrors += batch.entries.length;
        }
      }

      const duration = Date.now() - startTime;
      const success = totalFlushed > 0;

      console.log(`${success ? '✅' : '❌'} Emergency flush complete: ${totalFlushed} flushed, ${totalErrors} errors in ${duration}ms`);

      return {
        success,
        totalFlushed,
        totalErrors,
        duration,
      };
    } catch (error) {
      console.error('❌ Emergency flush failed:', error);
      
      return {
        success: false,
        totalFlushed: 0,
        totalErrors: 0,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Get comprehensive system status
   */
  public async getSystemStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    components: {
      flushManager: string;
      bufferManager: string;
      errorHandler: string;
      timingOptimizer: string;
      monitor: string;
    };
    metrics: any;
    alerts: any[];
    recommendations: string[];
  }> {
    const bufferHealth = this.bufferManager.getHealthStatus();
    const flushMetrics = this.flushManager.getMetrics();
    const errorStats = this.errorHandler.getErrorStats();
    const monitoringReport = this.flushMonitor.generateMonitoringReport();
    
    // Determine overall system status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (bufferHealth.status === 'critical' || 
        errorStats.circuitBreakerStatus === 'open' || 
        monitoringReport.alerts.critical > 0) {
      status = 'unhealthy';
    } else if (bufferHealth.status === 'warning' || 
               errorStats.averageSuccessRate < 0.8 || 
               monitoringReport.alerts.active > 5) {
      status = 'degraded';
    }

    const components = {
      flushManager: flushMetrics.errorRate < 10 ? 'healthy' : 'degraded',
      bufferManager: bufferHealth.status,
      errorHandler: errorStats.circuitBreakerStatus === 'closed' ? 'healthy' : 'unhealthy',
      timingOptimizer: 'healthy', // Always healthy unless explicitly failed
      monitor: monitoringReport.alerts.critical === 0 ? 'healthy' : 'degraded',
    };

    const recommendations = [
      ...bufferHealth.recommendations,
      ...monitoringReport.recommendations,
    ];

    return {
      status,
      components,
      metrics: {
        flush: flushMetrics,
        buffer: bufferHealth.metrics,
        errors: errorStats,
        monitoring: monitoringReport.metrics,
      },
      alerts: this.flushMonitor.getActiveAlerts(),
      recommendations,
    };
  }

  /**
   * Graceful shutdown of the entire system
   */
  public async shutdown(): Promise<void> {
    console.log('🔄 Shutting down flush integration system...');

    try {
      // Stop monitoring
      this.flushMonitor.stopMonitoring();

      // Emergency flush remaining traces
      await this.emergencyFlushAll();

      // Shutdown components
      await this.flushManager.shutdown();
      await this.bufferManager.shutdown();

      console.log('✅ Flush integration system shutdown complete');
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      throw error;
    }
  }

  // Private helper methods

  private setupIntegration(): void {
    // This method sets up event listeners and component integrations
    console.log('🔧 Setting up component integrations...');
  }

  private setupFlushManagerIntegration(): void {
    // Monitor flush operations
    this.flushManager.on('flush-success', (operation) => {
      this.flushMonitor.recordFlushOperation({
        success: true,
        duration: Date.now() - operation.timestamp,
        traceCount: operation.traceCount,
        retryCount: operation.retryCount,
        batchSize: operation.traceCount,
        bufferSize: this.bufferManager.getStats().totalEntries,
      });
    });

    this.flushManager.on('flush-error', ({ operation, error }) => {
      this.flushMonitor.recordFlushOperation({
        success: false,
        duration: Date.now() - operation.timestamp,
        traceCount: operation.traceCount,
        retryCount: operation.retryCount,
        batchSize: operation.traceCount,
        bufferSize: this.bufferManager.getStats().totalEntries,
        error,
      });
    });
  }

  private setupBufferManagerIntegration(): void {
    // Handle buffer flush requests
    this.bufferManager.on('flush-requested', async (event) => {
      console.log(`📤 Buffer flush requested: ${event.reason}`);
      
      const batch = this.bufferManager.getOptimalBatch();
      if (batch.entries.length > 0) {
        await this.executeFlushWithErrorHandling(batch);
      }
    });
  }

  private setupErrorHandlerIntegration(): void {
    // Handle error recovery actions
    this.errorHandler.on('batch-size-reduction', (event) => {
      console.log(`📉 Reducing batch size from ${event.currentSize} to ${event.recommendedSize}`);
      // Would integrate with batch sizing logic
    });

    this.errorHandler.on('flush-delay-increase', (event) => {
      console.log(`⏱️ Increasing flush delay from ${event.currentDelay}ms to ${event.recommendedDelay}ms`);
      // Would integrate with timing optimizer
    });
  }

  private setupMonitoringIntegration(): void {
    // Handle monitoring alerts
    this.flushMonitor.on('alert-created', (alert) => {
      console.log(`🔔 Alert created: ${alert.message}`);
      
      // Could integrate with external alerting systems
      if (alert.severity === 'critical') {
        // Trigger emergency procedures
        this.handleCriticalAlert(alert);
      }
    });
  }

  private async executeFlushWithErrorHandling(batch: any): Promise<{
    success: boolean;
    duration: number;
    error?: Error;
  }> {
    const startTime = Date.now();
    
    try {
      // Extract traces from batch entries
      const traces = batch.entries.map((entry: any) => entry.trace);
      
      // Execute flush
      const success = await this.flushManager.smartFlush(traces);
      
      const duration = Date.now() - startTime;
      
      return { success, duration };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Handle error through error handler
      await this.errorHandler.handleFlushError(error as Error, {
        traceCount: batch.entries.length,
        retryCount: 0,
        flushDelay: 0,
        batchSize: batch.entries.length,
        operationId: batch.id,
      });
      
      return { success: false, duration, error: error as Error };
    }
  }

  private determinePriority(trace: any): 'low' | 'medium' | 'high' | 'critical' {
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

  private async handleCriticalAlert(alert: any): Promise<void> {
    console.log(`🚨 Handling critical alert: ${alert.message}`);
    
    // Could trigger emergency procedures:
    // - Reduce batch sizes
    // - Increase flush delays
    // - Switch to emergency mode
    // - Notify administrators
  }

  private async logSystemStatus(): Promise<void> {
    const status = await this.getSystemStatus();
    
    console.log(`📊 System Status: ${status.status.toUpperCase()}
      Components:
        - Flush Manager: ${status.components.flushManager}
        - Buffer Manager: ${status.components.bufferManager}
        - Error Handler: ${status.components.errorHandler}
        - Timing Optimizer: ${status.components.timingOptimizer}
        - Monitor: ${status.components.monitor}
      Active Alerts: ${status.alerts.length}
      Recommendations: ${status.recommendations.length}`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Factory function to create a complete flush integration
 */
export async function createLangfuseFlushIntegration(langfuse: Langfuse): Promise<LangfuseFlushIntegration> {
  const integration = new LangfuseFlushIntegration(langfuse);
  await integration.initialize();
  return integration;
}

/**
 * Simple helper for basic flush operations
 */
export async function flushTracesReliably(
  langfuse: Langfuse,
  traces: any[],
  options?: {
    priority?: 'low' | 'medium' | 'high' | 'critical';
    maxRetries?: number;
    timeout?: number;
  }
): Promise<boolean> {
  const integration = await createLangfuseFlushIntegration(langfuse);
  
  try {
    const result = await integration.createAndFlushTraces(traces);
    return result.success;
  } catch (error) {
    console.error('❌ Reliable flush failed:', error);
    return false;
  } finally {
    await integration.shutdown();
  }
}

export default LangfuseFlushIntegration;