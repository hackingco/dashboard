/**
 * Optimized Langfuse Client with Advanced SDK Configuration
 * Integrates comprehensive configuration management, health monitoring, and validation
 */

import { EventEmitter } from 'events';
import { sdkConfig, type LangfuseEnvironmentConfig } from './sdk-config';
import { healthMonitor, type HealthDashboard } from './sdk-health-monitor';
import { sdkValidator, type ValidationReport } from './sdk-validator';

// Re-export types for convenience
export type { LangfuseEnvironmentConfig, SDKHealthStatus, PerformanceMetrics } from './sdk-config';
export type { HealthDashboard, HealthAlert } from './sdk-health-monitor';
export type { ValidationReport, ValidationTestResult } from './sdk-validator';

// Enhanced client configuration
export interface OptimizedClientConfig {
  environment?: string;
  useCase?: 'development' | 'testing' | 'production' | 'high-throughput';
  enableHealthMonitoring?: boolean;
  enableValidation?: boolean;
  autoOptimize?: boolean;
  customConfig?: Partial<LangfuseEnvironmentConfig>;
}

// Enhanced trace interface
export interface EnhancedLiveTrace {
  id: string;
  name: string;
  sessionId: string;
  userId?: string;
  timestamp: Date;
  duration: number;
  status: 'success' | 'error' | 'pending' | 'running';
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalCost: number;
  input: string;
  output: string;
  metadata?: Record<string, any>;
  tags?: string[];
  scores?: Record<string, number>;
  level?: string;
  statusMessage?: string;
  parentObservationId?: string;
  version?: string;
  agentId?: string;
  swarmId?: string;
  // Enhanced fields
  validationStatus?: 'validated' | 'pending' | 'failed';
  performanceMetrics?: {
    latency: number;
    throughput: number;
    errorRate: number;
  };
  healthStatus?: 'healthy' | 'degraded' | 'unhealthy';
}

// Client status interface
export interface ClientStatus {
  initialized: boolean;
  environment: string;
  health: HealthDashboard;
  validation: ValidationReport | null;
  configuration: LangfuseEnvironmentConfig;
  metrics: {
    totalTraces: number;
    totalRequests: number;
    averageResponseTime: number;
    errorRate: number;
    uptime: number;
  };
}

/**
 * Optimized Langfuse Client
 * Provides enhanced functionality with comprehensive monitoring and validation
 */
export class OptimizedLangfuseClient extends EventEmitter {
  private client: any = null;
  private config: LangfuseEnvironmentConfig;
  private isInitialized: boolean = false;
  private validationReport: ValidationReport | null = null;
  private traces: EnhancedLiveTrace[] = [];
  private requestCount: number = 0;
  private errorCount: number = 0;
  private startTime: Date = new Date();

  constructor(clientConfig?: OptimizedClientConfig) {
    super();
    this.initializeClient(clientConfig);
  }

  /**
   * Initialize the optimized client
   */
  private async initializeClient(clientConfig?: OptimizedClientConfig): Promise<void> {
    try {
      // Switch environment if specified
      if (clientConfig?.environment) {
        sdkConfig.switchEnvironment(clientConfig.environment);
      }

      // Get optimized configuration
      if (clientConfig?.useCase) {
        this.config = sdkConfig.getOptimizedConfig(clientConfig.useCase);
      } else {
        this.config = sdkConfig.getCurrentConfig();
      }

      // Apply custom configuration
      if (clientConfig?.customConfig) {
        this.config = { ...this.config, ...clientConfig.customConfig };
      }

      // Auto-optimize if enabled
      if (clientConfig?.autoOptimize !== false) {
        this.config = this.autoOptimizeConfig(this.config);
      }

      // Initialize SDK configuration
      await sdkConfig.initialize();

      // Start health monitoring if enabled
      if (clientConfig?.enableHealthMonitoring !== false) {
        healthMonitor.startMonitoring();
      }

      // Run validation if enabled
      if (clientConfig?.enableValidation !== false) {
        this.validationReport = await sdkValidator.runAllTests(this.config);
        
        if (this.validationReport.overall === 'failed') {
          console.warn('⚠️ SDK validation failed. Some features may not work correctly.');
        }
      }

      // Initialize Langfuse client
      await this.initializeLangfuseClient();

      this.isInitialized = true;
      this.emit('initialized', this.getClientStatus());

    } catch (error) {
      console.error('Failed to initialize optimized client:', error);
      this.emit('error', error);
    }
  }

  /**
   * Initialize the actual Langfuse client
   */
  private async initializeLangfuseClient(): Promise<void> {
    try {
      // Try to import and initialize Langfuse
      const { Langfuse } = require('langfuse');
      
      this.client = new Langfuse({
        publicKey: this.config.publicKey,
        secretKey: this.config.secretKey,
        baseUrl: this.config.baseUrl,
        flushAt: this.config.flushAt,
        flushInterval: this.config.flushInterval,
        requestTimeout: this.config.requestTimeout,
        maxRetries: this.config.maxRetries,
      });

      console.log('✅ Optimized Langfuse client initialized successfully');
      
    } catch (error) {
      console.warn('⚠️ Langfuse client initialization failed, using fallback mode:', error);
      this.client = null;
    }
  }

  /**
   * Auto-optimize configuration based on environment and usage patterns
   */
  private autoOptimizeConfig(config: LangfuseEnvironmentConfig): LangfuseEnvironmentConfig {
    const optimizedConfig = { ...config };

    // Development optimizations
    if (config.name === 'development') {
      optimizedConfig.baseUrl = 'http://localhost:3000';
      optimizedConfig.flushAt = 1;
      optimizedConfig.flushInterval = 1000;
      optimizedConfig.requestTimeout = 30000;
      optimizedConfig.maxRetries = 3;
      optimizedConfig.monitoring.logLevel = 'debug';
    }

    // Production optimizations
    if (config.name === 'production') {
      optimizedConfig.flushAt = 100;
      optimizedConfig.flushInterval = 10000;
      optimizedConfig.requestTimeout = 60000;
      optimizedConfig.maxRetries = 10;
      optimizedConfig.performance.enableCompression = true;
      optimizedConfig.performance.maxConcurrentRequests = 20;
      optimizedConfig.monitoring.logLevel = 'warn';
    }

    return optimizedConfig;
  }

  /**
   * Create an enhanced trace with additional monitoring
   */
  public async createTrace(traceData: Partial<EnhancedLiveTrace>): Promise<EnhancedLiveTrace | null> {
    if (!this.isInitialized) {
      console.warn('Client not initialized');
      return null;
    }

    const startTime = Date.now();
    this.requestCount++;

    try {
      const enhancedTrace: EnhancedLiveTrace = {
        id: traceData.id || `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: traceData.name || 'Unnamed Trace',
        sessionId: traceData.sessionId || 'default-session',
        userId: traceData.userId,
        timestamp: traceData.timestamp || new Date(),
        duration: traceData.duration || 0,
        status: traceData.status || 'pending',
        model: traceData.model || 'unknown',
        promptTokens: traceData.promptTokens || 0,
        completionTokens: traceData.completionTokens || 0,
        totalCost: traceData.totalCost || 0,
        input: traceData.input || '',
        output: traceData.output || '',
        metadata: traceData.metadata || {},
        tags: traceData.tags || [],
        scores: traceData.scores || {},
        level: traceData.level,
        statusMessage: traceData.statusMessage,
        parentObservationId: traceData.parentObservationId,
        version: traceData.version,
        agentId: traceData.agentId,
        swarmId: traceData.swarmId,
        // Enhanced fields
        validationStatus: 'validated',
        performanceMetrics: {
          latency: Date.now() - startTime,
          throughput: this.requestCount / ((Date.now() - this.startTime.getTime()) / 1000),
          errorRate: this.errorCount / this.requestCount,
        },
        healthStatus: healthMonitor.getHealthDashboard().overall,
      };

      // Create trace with actual Langfuse client
      if (this.client) {
        const langfuseTrace = this.client.trace({
          id: enhancedTrace.id,
          name: enhancedTrace.name,
          sessionId: enhancedTrace.sessionId,
          userId: enhancedTrace.userId,
          input: enhancedTrace.input,
          output: enhancedTrace.output,
          metadata: {
            ...enhancedTrace.metadata,
            agentId: enhancedTrace.agentId,
            swarmId: enhancedTrace.swarmId,
            model: enhancedTrace.model,
            optimizedClient: true,
          },
          tags: enhancedTrace.tags,
        });

        await this.client.flushAsync();
      }

      // Add to internal traces
      this.traces.push(enhancedTrace);
      
      // Keep only last 1000 traces
      if (this.traces.length > 1000) {
        this.traces = this.traces.slice(-1000);
      }

      this.emit('trace-created', enhancedTrace);
      return enhancedTrace;

    } catch (error) {
      this.errorCount++;
      console.error('Failed to create trace:', error);
      this.emit('error', error);
      return null;
    }
  }

  /**
   * Get traces with enhanced filtering
   */
  public async getTraces(options?: {
    sessionId?: string;
    userId?: string;
    agentId?: string;
    swarmId?: string;
    status?: string;
    limit?: number;
    offset?: number;
    includeMetrics?: boolean;
  }): Promise<EnhancedLiveTrace[]> {
    try {
      let traces = this.traces;

      // Apply filters
      if (options?.sessionId) {
        traces = traces.filter(t => t.sessionId === options.sessionId);
      }
      if (options?.userId) {
        traces = traces.filter(t => t.userId === options.userId);
      }
      if (options?.agentId) {
        traces = traces.filter(t => t.agentId === options.agentId);
      }
      if (options?.swarmId) {
        traces = traces.filter(t => t.swarmId === options.swarmId);
      }
      if (options?.status) {
        traces = traces.filter(t => t.status === options.status);
      }

      // Apply pagination
      const offset = options?.offset || 0;
      const limit = options?.limit || 50;
      traces = traces.slice(offset, offset + limit);

      // Add real-time metrics if requested
      if (options?.includeMetrics) {
        traces = traces.map(trace => ({
          ...trace,
          performanceMetrics: {
            latency: trace.performanceMetrics?.latency || 0,
            throughput: this.requestCount / ((Date.now() - this.startTime.getTime()) / 1000),
            errorRate: this.errorCount / this.requestCount,
          },
          healthStatus: healthMonitor.getHealthDashboard().overall,
        }));
      }

      return traces;

    } catch (error) {
      console.error('Failed to get traces:', error);
      return [];
    }
  }

  /**
   * Get comprehensive client status
   */
  public getClientStatus(): ClientStatus {
    const healthDashboard = healthMonitor.getHealthDashboard();
    const uptime = Date.now() - this.startTime.getTime();

    return {
      initialized: this.isInitialized,
      environment: this.config.name,
      health: healthDashboard,
      validation: this.validationReport,
      configuration: this.config,
      metrics: {
        totalTraces: this.traces.length,
        totalRequests: this.requestCount,
        averageResponseTime: this.requestCount > 0 ? 
          this.traces.reduce((sum, t) => sum + t.duration, 0) / this.traces.length : 0,
        errorRate: this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0,
        uptime,
      },
    };
  }

  /**
   * Run health check
   */
  public async runHealthCheck(): Promise<HealthDashboard> {
    return healthMonitor.getHealthDashboard();
  }

  /**
   * Run validation
   */
  public async runValidation(): Promise<ValidationReport> {
    this.validationReport = await sdkValidator.runAllTests(this.config);
    this.emit('validation-completed', this.validationReport);
    return this.validationReport;
  }

  /**
   * Switch environment
   */
  public async switchEnvironment(environment: string): Promise<void> {
    sdkConfig.switchEnvironment(environment);
    this.config = sdkConfig.getCurrentConfig();
    
    // Re-initialize client with new configuration
    await this.initializeLangfuseClient();
    
    this.emit('environment-changed', environment);
  }

  /**
   * Get performance metrics
   */
  public getPerformanceMetrics(): {
    requestCount: number;
    errorCount: number;
    errorRate: number;
    averageResponseTime: number;
    uptime: number;
  } {
    const uptime = Date.now() - this.startTime.getTime();
    const errorRate = this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0;
    const averageResponseTime = this.requestCount > 0 ? 
      this.traces.reduce((sum, t) => sum + t.duration, 0) / this.traces.length : 0;

    return {
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      errorRate,
      averageResponseTime,
      uptime,
    };
  }

  /**
   * Optimize configuration for current usage
   */
  public optimizeConfiguration(): LangfuseEnvironmentConfig {
    const metrics = this.getPerformanceMetrics();
    const optimizedConfig = { ...this.config };

    // Optimize based on error rate
    if (metrics.errorRate > 10) {
      optimizedConfig.maxRetries = Math.min(optimizedConfig.maxRetries + 2, 10);
      optimizedConfig.requestTimeout = Math.min(optimizedConfig.requestTimeout + 10000, 60000);
    }

    // Optimize based on response time
    if (metrics.averageResponseTime > 5000) {
      optimizedConfig.flushInterval = Math.max(optimizedConfig.flushInterval - 1000, 1000);
      optimizedConfig.performance.maxConcurrentRequests = Math.max(
        optimizedConfig.performance.maxConcurrentRequests - 2, 1
      );
    }

    // Optimize based on request volume
    if (metrics.requestCount > 1000) {
      optimizedConfig.flushAt = Math.max(optimizedConfig.flushAt - 10, 1);
      optimizedConfig.performance.enableCompression = true;
    }

    this.config = optimizedConfig;
    return optimizedConfig;
  }

  /**
   * Generate usage report
   */
  public generateUsageReport(): {
    summary: string;
    recommendations: string[];
    metrics: any;
    health: HealthDashboard;
    validation: ValidationReport | null;
  } {
    const metrics = this.getPerformanceMetrics();
    const health = healthMonitor.getHealthDashboard();
    
    const summary = `
      Optimized Langfuse Client Report
      Environment: ${this.config.name}
      Uptime: ${Math.floor(metrics.uptime / 1000)}s
      Total Requests: ${metrics.requestCount}
      Error Rate: ${metrics.errorRate.toFixed(2)}%
      Average Response Time: ${metrics.averageResponseTime.toFixed(0)}ms
      Health Status: ${health.overall}
    `;

    const recommendations: string[] = [];
    
    if (metrics.errorRate > 5) {
      recommendations.push('Consider increasing retry count or timeout values');
    }
    
    if (metrics.averageResponseTime > 3000) {
      recommendations.push('Consider optimizing flush interval or concurrent requests');
    }
    
    if (health.overall !== 'healthy') {
      recommendations.push('Address health issues for optimal performance');
    }

    return {
      summary,
      recommendations,
      metrics,
      health,
      validation: this.validationReport,
    };
  }

  /**
   * Shutdown client
   */
  public async shutdown(): Promise<void> {
    try {
      // Stop health monitoring
      healthMonitor.stopMonitoring();
      
      // Shutdown SDK configuration
      await sdkConfig.shutdown();
      
      // Shutdown Langfuse client
      if (this.client) {
        await this.client.shutdownAsync();
      }
      
      this.removeAllListeners();
      this.isInitialized = false;
      
      console.log('✅ Optimized Langfuse client shutdown complete');
      
    } catch (error) {
      console.error('Error during client shutdown:', error);
    }
  }
}

// Export singleton instance
export const optimizedLangfuseClient = new OptimizedLangfuseClient({
  environment: process.env.NODE_ENV || 'development',
  useCase: 'development',
  enableHealthMonitoring: true,
  enableValidation: true,
  autoOptimize: true,
});

// Export utility functions
export const ClientUtils = {
  /**
   * Create client with optimal settings for development
   */
  createDevelopmentClient(): OptimizedLangfuseClient {
    return new OptimizedLangfuseClient({
      environment: 'development',
      useCase: 'development',
      enableHealthMonitoring: true,
      enableValidation: true,
      autoOptimize: true,
    });
  },

  /**
   * Create client with optimal settings for production
   */
  createProductionClient(): OptimizedLangfuseClient {
    return new OptimizedLangfuseClient({
      environment: 'production',
      useCase: 'production',
      enableHealthMonitoring: true,
      enableValidation: false, // Disable validation in production
      autoOptimize: true,
    });
  },

  /**
   * Create client with optimal settings for testing
   */
  createTestClient(): OptimizedLangfuseClient {
    return new OptimizedLangfuseClient({
      environment: 'test',
      useCase: 'testing',
      enableHealthMonitoring: false,
      enableValidation: false,
      autoOptimize: false,
    });
  },

  /**
   * Get recommended configuration for environment
   */
  getRecommendedConfig(environment: string): OptimizedClientConfig {
    switch (environment) {
      case 'development':
        return {
          environment: 'development',
          useCase: 'development',
          enableHealthMonitoring: true,
          enableValidation: true,
          autoOptimize: true,
        };
      case 'production':
        return {
          environment: 'production',
          useCase: 'production',
          enableHealthMonitoring: true,
          enableValidation: false,
          autoOptimize: true,
        };
      case 'test':
        return {
          environment: 'test',
          useCase: 'testing',
          enableHealthMonitoring: false,
          enableValidation: false,
          autoOptimize: false,
        };
      default:
        return {
          environment: 'development',
          useCase: 'development',
          enableHealthMonitoring: true,
          enableValidation: true,
          autoOptimize: true,
        };
    }
  },
};

export default optimizedLangfuseClient;