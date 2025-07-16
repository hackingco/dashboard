/**
 * Comprehensive Langfuse SDK Configuration System
 * Optimized for local development with multi-environment support
 * Features: Environment-specific settings, performance tuning, health monitoring
 */

import { EventEmitter } from 'events';

// Environment Configuration Types
export interface LangfuseEnvironmentConfig {
  name: string;
  baseUrl: string;
  wsEndpoint?: string;
  publicKey?: string;
  secretKey?: string;
  flushAt: number;
  flushInterval: number;
  requestTimeout: number;
  maxRetries: number;
  retryDelay: number;
  enableHealthCheck: boolean;
  healthCheckInterval: number;
  batchSize: number;
  enableRealtime: boolean;
  enableCache: boolean;
  cacheSize: number;
  performance: {
    enableCompression: boolean;
    maxConcurrentRequests: number;
    connectionPoolSize: number;
    keepAlive: boolean;
  };
  monitoring: {
    enableMetrics: boolean;
    enableTracing: boolean;
    enableLogging: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
  };
}

// Health Check Status
export interface SDKHealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: Date;
  responseTime: number;
  errors: string[];
  warnings: string[];
  metrics: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    uptime: number;
  };
}

// Configuration Validation Result
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

// Performance Metrics
export interface PerformanceMetrics {
  timestamp: Date;
  responseTime: number;
  throughput: number;
  errorRate: number;
  memoryUsage: number;
  cpuUsage: number;
  cacheHitRate: number;
  activeConnections: number;
}

/**
 * Comprehensive SDK Configuration Manager
 * Handles environment-specific configurations, validation, and monitoring
 */
export class LangfuseSDKConfig extends EventEmitter {
  private currentEnvironment: string;
  private configurations: Map<string, LangfuseEnvironmentConfig>;
  private healthStatus: SDKHealthStatus;
  private performanceMetrics: PerformanceMetrics[];
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private metricsInterval: NodeJS.Timeout | null = null;
  private isInitialized: boolean = false;

  constructor() {
    super();
    this.currentEnvironment = process.env.NODE_ENV || 'development';
    this.configurations = new Map();
    this.performanceMetrics = [];
    this.healthStatus = this.createDefaultHealthStatus();
    this.initializeConfigurations();
  }

  /**
   * Initialize all environment configurations
   */
  private initializeConfigurations(): void {
    // Development Configuration (localhost:3000)
    this.configurations.set('development', {
      name: 'Development',
      baseUrl: 'http://localhost:3000',
      wsEndpoint: 'ws://localhost:3000/ws',
      publicKey: process.env.NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY || process.env.LANGFUSE_PUBLIC_KEY,
      secretKey: process.env.LANGFUSE_SECRET_KEY,
      flushAt: 1, // Immediate flush for testing
      flushInterval: 1000, // 1 second intervals
      requestTimeout: 30000, // 30 second timeout
      maxRetries: 3, // 3 retry attempts
      retryDelay: 1000, // 1 second delay between retries
      enableHealthCheck: true,
      healthCheckInterval: 30000, // 30 second health checks
      batchSize: 10, // Small batches for development
      enableRealtime: true,
      enableCache: true,
      cacheSize: 100, // Small cache for development
      performance: {
        enableCompression: false, // Disable for debugging
        maxConcurrentRequests: 5,
        connectionPoolSize: 2,
        keepAlive: true,
      },
      monitoring: {
        enableMetrics: true,
        enableTracing: true,
        enableLogging: true,
        logLevel: 'debug',
      },
    });

    // Staging Configuration
    this.configurations.set('staging', {
      name: 'Staging',
      baseUrl: process.env.NEXT_PUBLIC_LANGFUSE_HOST || 'https://staging.langfuse.com',
      wsEndpoint: process.env.NEXT_PUBLIC_LANGFUSE_WS || 'wss://staging.langfuse.com/ws',
      publicKey: process.env.NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY,
      secretKey: process.env.LANGFUSE_SECRET_KEY,
      flushAt: 50, // Balanced batching
      flushInterval: 5000, // 5 second intervals
      requestTimeout: 45000, // 45 second timeout
      maxRetries: 5, // More retries for staging
      retryDelay: 2000, // 2 second delay
      enableHealthCheck: true,
      healthCheckInterval: 60000, // 1 minute health checks
      batchSize: 100, // Medium batches
      enableRealtime: true,
      enableCache: true,
      cacheSize: 500, // Medium cache
      performance: {
        enableCompression: true,
        maxConcurrentRequests: 10,
        connectionPoolSize: 5,
        keepAlive: true,
      },
      monitoring: {
        enableMetrics: true,
        enableTracing: true,
        enableLogging: true,
        logLevel: 'info',
      },
    });

    // Production Configuration
    this.configurations.set('production', {
      name: 'Production',
      baseUrl: process.env.NEXT_PUBLIC_LANGFUSE_HOST || 'https://cloud.langfuse.com',
      wsEndpoint: process.env.NEXT_PUBLIC_LANGFUSE_WS || 'wss://cloud.langfuse.com/ws',
      publicKey: process.env.NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY,
      secretKey: process.env.LANGFUSE_SECRET_KEY,
      flushAt: 100, // Optimized batching
      flushInterval: 10000, // 10 second intervals
      requestTimeout: 60000, // 60 second timeout
      maxRetries: 10, // Maximum retries
      retryDelay: 3000, // 3 second delay
      enableHealthCheck: true,
      healthCheckInterval: 300000, // 5 minute health checks
      batchSize: 1000, // Large batches
      enableRealtime: true,
      enableCache: true,
      cacheSize: 2000, // Large cache
      performance: {
        enableCompression: true,
        maxConcurrentRequests: 20,
        connectionPoolSize: 10,
        keepAlive: true,
      },
      monitoring: {
        enableMetrics: true,
        enableTracing: false, // Disable for performance
        enableLogging: true,
        logLevel: 'warn',
      },
    });

    // Test Configuration
    this.configurations.set('test', {
      name: 'Test',
      baseUrl: 'http://localhost:3000',
      wsEndpoint: 'ws://localhost:3000/ws',
      publicKey: 'test-public-key',
      secretKey: 'test-secret-key',
      flushAt: 1, // Immediate flush for testing
      flushInterval: 100, // Very fast intervals
      requestTimeout: 10000, // Short timeout
      maxRetries: 1, // Minimal retries
      retryDelay: 500, // Fast retry
      enableHealthCheck: false, // Disable for tests
      healthCheckInterval: 0,
      batchSize: 1, // Individual items
      enableRealtime: false, // Disable for tests
      enableCache: false, // Disable caching
      cacheSize: 0,
      performance: {
        enableCompression: false,
        maxConcurrentRequests: 1,
        connectionPoolSize: 1,
        keepAlive: false,
      },
      monitoring: {
        enableMetrics: false,
        enableTracing: false,
        enableLogging: false,
        logLevel: 'error',
      },
    });
  }

  /**
   * Get current environment configuration
   */
  public getCurrentConfig(): LangfuseEnvironmentConfig {
    const config = this.configurations.get(this.currentEnvironment);
    if (!config) {
      throw new Error(`No configuration found for environment: ${this.currentEnvironment}`);
    }
    return config;
  }

  /**
   * Get configuration for specific environment
   */
  public getConfig(environment: string): LangfuseEnvironmentConfig {
    const config = this.configurations.get(environment);
    if (!config) {
      throw new Error(`No configuration found for environment: ${environment}`);
    }
    return config;
  }

  /**
   * Switch to different environment
   */
  public switchEnvironment(environment: string): void {
    if (!this.configurations.has(environment)) {
      throw new Error(`Invalid environment: ${environment}`);
    }
    
    const oldEnvironment = this.currentEnvironment;
    this.currentEnvironment = environment;
    
    this.emit('environment-changed', {
      from: oldEnvironment,
      to: environment,
      config: this.getCurrentConfig(),
    });
    
    // Restart health checks with new configuration
    this.stopHealthChecks();
    this.startHealthChecks();
  }

  /**
   * Validate configuration
   */
  public validateConfig(config?: LangfuseEnvironmentConfig): ValidationResult {
    const configToValidate = config || this.getCurrentConfig();
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      suggestions: [],
    };

    // Required fields validation
    if (!configToValidate.baseUrl) {
      result.errors.push('baseUrl is required');
      result.valid = false;
    }

    if (!configToValidate.publicKey) {
      result.errors.push('publicKey is required');
      result.valid = false;
    }

    if (!configToValidate.secretKey) {
      result.errors.push('secretKey is required');
      result.valid = false;
    }

    // URL validation
    if (configToValidate.baseUrl) {
      try {
        new URL(configToValidate.baseUrl);
      } catch (error) {
        result.errors.push('Invalid baseUrl format');
        result.valid = false;
      }
    }

    // Performance validation
    if (configToValidate.flushAt < 1) {
      result.warnings.push('flushAt should be at least 1');
    }

    if (configToValidate.flushInterval < 100) {
      result.warnings.push('flushInterval should be at least 100ms');
    }

    if (configToValidate.requestTimeout < 5000) {
      result.warnings.push('requestTimeout should be at least 5000ms');
    }

    // Suggestions
    if (configToValidate.name === 'development' && configToValidate.baseUrl !== 'http://localhost:3000') {
      result.suggestions.push('Consider using localhost:3000 for development');
    }

    if (configToValidate.flushAt > 1000) {
      result.suggestions.push('Large flushAt values may cause memory issues');
    }

    if (configToValidate.performance.maxConcurrentRequests > 50) {
      result.suggestions.push('High concurrent requests may impact performance');
    }

    return result;
  }

  /**
   * Get optimized configuration for specific use case
   */
  public getOptimizedConfig(useCase: 'development' | 'testing' | 'production' | 'high-throughput'): LangfuseEnvironmentConfig {
    const baseConfig = this.getCurrentConfig();
    
    switch (useCase) {
      case 'development':
        return {
          ...baseConfig,
          baseUrl: 'http://localhost:3000',
          flushAt: 1,
          flushInterval: 1000,
          requestTimeout: 30000,
          maxRetries: 3,
          enableHealthCheck: true,
          monitoring: {
            ...baseConfig.monitoring,
            enableLogging: true,
            logLevel: 'debug',
          },
        };

      case 'testing':
        return {
          ...baseConfig,
          flushAt: 1,
          flushInterval: 100,
          requestTimeout: 10000,
          maxRetries: 1,
          enableHealthCheck: false,
          enableRealtime: false,
          enableCache: false,
          monitoring: {
            ...baseConfig.monitoring,
            enableLogging: false,
            logLevel: 'error',
          },
        };

      case 'production':
        return {
          ...baseConfig,
          flushAt: 100,
          flushInterval: 10000,
          requestTimeout: 60000,
          maxRetries: 10,
          performance: {
            ...baseConfig.performance,
            enableCompression: true,
            maxConcurrentRequests: 20,
            connectionPoolSize: 10,
          },
          monitoring: {
            ...baseConfig.monitoring,
            enableTracing: false,
            logLevel: 'warn',
          },
        };

      case 'high-throughput':
        return {
          ...baseConfig,
          flushAt: 1000,
          flushInterval: 5000,
          batchSize: 2000,
          performance: {
            ...baseConfig.performance,
            enableCompression: true,
            maxConcurrentRequests: 50,
            connectionPoolSize: 20,
          },
          monitoring: {
            ...baseConfig.monitoring,
            enableTracing: false,
            logLevel: 'error',
          },
        };

      default:
        return baseConfig;
    }
  }

  /**
   * Start health monitoring
   */
  public startHealthChecks(): void {
    const config = this.getCurrentConfig();
    
    if (!config.enableHealthCheck) {
      return;
    }

    this.healthCheckInterval = setInterval(async () => {
      try {
        const healthStatus = await this.performHealthCheck();
        this.healthStatus = healthStatus;
        this.emit('health-status', healthStatus);
      } catch (error) {
        console.error('Health check failed:', error);
        this.healthStatus = {
          ...this.healthStatus,
          status: 'unhealthy',
          errors: [error instanceof Error ? error.message : 'Unknown error'],
        };
      }
    }, config.healthCheckInterval);

    // Start performance metrics collection
    this.metricsInterval = setInterval(() => {
      this.collectPerformanceMetrics();
    }, 5000); // Collect every 5 seconds
  }

  /**
   * Stop health monitoring
   */
  public stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
  }

  /**
   * Perform health check
   */
  private async performHealthCheck(): Promise<SDKHealthStatus> {
    const config = this.getCurrentConfig();
    const startTime = Date.now();
    const status: SDKHealthStatus = {
      status: 'healthy',
      timestamp: new Date(),
      responseTime: 0,
      errors: [],
      warnings: [],
      metrics: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        uptime: Date.now() - startTime,
      },
    };

    try {
      // Test basic connectivity
      const response = await fetch(`${config.baseUrl}/api/health`, {
        method: 'GET',
        timeout: config.requestTimeout,
      });

      status.responseTime = Date.now() - startTime;

      if (!response.ok) {
        status.status = 'degraded';
        status.warnings.push(`Health endpoint returned ${response.status}`);
      }

      // Test authentication
      if (config.publicKey && config.secretKey) {
        const authResponse = await fetch(`${config.baseUrl}/api/public/traces`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${config.publicKey}`,
            'Content-Type': 'application/json',
          },
          timeout: config.requestTimeout,
        });

        if (!authResponse.ok && authResponse.status !== 401) {
          status.status = 'degraded';
          status.warnings.push(`Authentication test failed: ${authResponse.status}`);
        }
      }

      // Calculate metrics
      const recentMetrics = this.performanceMetrics.slice(-10);
      if (recentMetrics.length > 0) {
        const avgResponseTime = recentMetrics.reduce((sum, m) => sum + m.responseTime, 0) / recentMetrics.length;
        const errorRate = recentMetrics.reduce((sum, m) => sum + m.errorRate, 0) / recentMetrics.length;
        
        status.metrics = {
          totalRequests: recentMetrics.length,
          successfulRequests: Math.floor(recentMetrics.length * (1 - errorRate / 100)),
          failedRequests: Math.floor(recentMetrics.length * (errorRate / 100)),
          averageResponseTime: avgResponseTime,
          uptime: Date.now() - startTime,
        };

        if (avgResponseTime > config.requestTimeout / 2) {
          status.status = 'degraded';
          status.warnings.push('High response times detected');
        }

        if (errorRate > 10) {
          status.status = 'unhealthy';
          status.errors.push('High error rate detected');
        }
      }

    } catch (error) {
      status.status = 'unhealthy';
      status.errors.push(error instanceof Error ? error.message : 'Unknown error');
      status.responseTime = Date.now() - startTime;
    }

    return status;
  }

  /**
   * Collect performance metrics
   */
  private collectPerformanceMetrics(): void {
    const metrics: PerformanceMetrics = {
      timestamp: new Date(),
      responseTime: Math.random() * 1000 + 500, // Mock data
      throughput: Math.random() * 100 + 50, // Mock data
      errorRate: Math.random() * 5, // Mock data
      memoryUsage: Math.random() * 50 + 25, // Mock data
      cpuUsage: Math.random() * 30 + 10, // Mock data
      cacheHitRate: Math.random() * 40 + 60, // Mock data
      activeConnections: Math.floor(Math.random() * 10) + 1, // Mock data
    };

    this.performanceMetrics.push(metrics);
    
    // Keep only last 100 metrics
    if (this.performanceMetrics.length > 100) {
      this.performanceMetrics = this.performanceMetrics.slice(-100);
    }

    this.emit('performance-metrics', metrics);
  }

  /**
   * Get current health status
   */
  public getHealthStatus(): SDKHealthStatus {
    return this.healthStatus;
  }

  /**
   * Get performance metrics
   */
  public getPerformanceMetrics(): PerformanceMetrics[] {
    return this.performanceMetrics;
  }

  /**
   * Get configuration hot-reload support
   */
  public enableHotReload(): void {
    // Watch for environment variable changes
    process.on('env-change', () => {
      this.initializeConfigurations();
      this.emit('config-reloaded', this.getCurrentConfig());
    });
  }

  /**
   * Create default health status
   */
  private createDefaultHealthStatus(): SDKHealthStatus {
    return {
      status: 'healthy',
      timestamp: new Date(),
      responseTime: 0,
      errors: [],
      warnings: [],
      metrics: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        uptime: 0,
      },
    };
  }

  /**
   * Initialize the configuration system
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Validate current configuration
    const validation = this.validateConfig();
    if (!validation.valid) {
      throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
    }

    // Start health monitoring
    this.startHealthChecks();

    // Enable hot reload
    this.enableHotReload();

    this.isInitialized = true;
    this.emit('initialized', this.getCurrentConfig());
  }

  /**
   * Shutdown the configuration system
   */
  public async shutdown(): Promise<void> {
    this.stopHealthChecks();
    this.removeAllListeners();
    this.isInitialized = false;
  }
}

// Export singleton instance
export const sdkConfig = new LangfuseSDKConfig();

// Export utility functions
export const ConfigUtils = {
  /**
   * Get optimal configuration for current environment
   */
  getOptimalConfig(): LangfuseEnvironmentConfig {
    const env = process.env.NODE_ENV || 'development';
    return sdkConfig.getOptimizedConfig(env as any);
  },

  /**
   * Validate environment variables
   */
  validateEnvironmentVariables(): ValidationResult {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      suggestions: [],
    };

    const requiredVars = ['NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY', 'LANGFUSE_SECRET_KEY'];
    const recommendedVars = ['NEXT_PUBLIC_LANGFUSE_HOST', 'NEXT_PUBLIC_LANGFUSE_WS'];

    for (const varName of requiredVars) {
      if (!process.env[varName]) {
        result.errors.push(`Missing required environment variable: ${varName}`);
        result.valid = false;
      }
    }

    for (const varName of recommendedVars) {
      if (!process.env[varName]) {
        result.warnings.push(`Missing recommended environment variable: ${varName}`);
      }
    }

    return result;
  },

  /**
   * Get configuration for specific deployment
   */
  getDeploymentConfig(deployment: 'docker' | 'kubernetes' | 'serverless'): Partial<LangfuseEnvironmentConfig> {
    switch (deployment) {
      case 'docker':
        return {
          baseUrl: 'http://langfuse:3000',
          requestTimeout: 45000,
          maxRetries: 5,
          performance: {
            enableCompression: true,
            maxConcurrentRequests: 15,
            connectionPoolSize: 8,
            keepAlive: true,
          },
        };

      case 'kubernetes':
        return {
          baseUrl: 'http://langfuse-service:3000',
          requestTimeout: 60000,
          maxRetries: 10,
          performance: {
            enableCompression: true,
            maxConcurrentRequests: 30,
            connectionPoolSize: 15,
            keepAlive: true,
          },
        };

      case 'serverless':
        return {
          requestTimeout: 30000,
          maxRetries: 3,
          flushAt: 1,
          flushInterval: 100,
          performance: {
            enableCompression: true,
            maxConcurrentRequests: 5,
            connectionPoolSize: 2,
            keepAlive: false,
          },
        };

      default:
        return {};
    }
  },
};

export default sdkConfig;