/**
 * Configuration module for Langfuse Wrapper
 * Handles environment variables, validation, and feature flags
 */

import { EventEmitter } from 'events';

/**
 * Langfuse configuration interface
 */
export interface LangfuseConfig {
  // Core Langfuse settings
  publicKey?: string;
  secretKey?: string;
  host?: string;
  enabled?: boolean;
  
  // Performance settings
  flushAt?: number;
  flushInterval?: number;
  maxBatchSize?: number;
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
  
  // Feature flags
  features?: FeatureFlags;
  
  // Swarm integration settings
  swarmIntegration?: SwarmIntegrationConfig;
  
  // Telemetry settings
  telemetry?: TelemetryConfig;
  
  // Debug settings
  debug?: DebugConfig;
}

/**
 * Feature flags for enabling/disabling specific functionality
 */
export interface FeatureFlags {
  // Core features
  autoTracing?: boolean;
  spanEnrichment?: boolean;
  tokenTracking?: boolean;
  errorCapture?: boolean;
  
  // Advanced features
  distributedTracing?: boolean;
  memoryCoordination?: boolean;
  hookInterception?: boolean;
  performanceMonitoring?: boolean;
  
  // Experimental features
  neuralPatternAnalysis?: boolean;
  predictiveCostEstimation?: boolean;
  adaptiveTokenOptimization?: boolean;
  swarmIntelligence?: boolean;
}

/**
 * Swarm integration configuration
 */
export interface SwarmIntegrationConfig {
  // Swarm identification
  swarmId?: string;
  agentId?: string;
  agentRole?: string;
  
  // Coordination settings
  coordinationEnabled?: boolean;
  memoryDbPath?: string;
  sharedMemoryNamespace?: string;
  
  // Performance settings
  coordinationInterval?: number;
  maxCoordinationRetries?: number;
  coordinationTimeout?: number;
}

/**
 * Telemetry configuration
 */
export interface TelemetryConfig {
  // Metrics collection
  collectMetrics?: boolean;
  metricsInterval?: number;
  metricsNamespace?: string;
  
  // Performance tracking
  trackLatency?: boolean;
  trackMemoryUsage?: boolean;
  trackCpuUsage?: boolean;
  
  // Cost tracking
  trackTokenCosts?: boolean;
  costAlerts?: boolean;
  costAlertThreshold?: number;
}

/**
 * Debug configuration
 */
export interface DebugConfig {
  // Logging levels
  logLevel?: 'error' | 'warn' | 'info' | 'debug' | 'trace';
  logToFile?: boolean;
  logFilePath?: string;
  
  // Debug features
  verboseTracing?: boolean;
  traceCallStacks?: boolean;
  dumpConfigOnStart?: boolean;
  
  // Development features
  simulateErrors?: boolean;
  simulateLatency?: number;
  bypassValidation?: boolean;
}

/**
 * Configuration validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Configuration manager with validation and feature detection
 */
export class ConfigManager extends EventEmitter {
  private config: LangfuseConfig;
  private readonly defaults: LangfuseConfig;
  // Note: envPrefix reserved for future environment variable loading
  
  constructor() {
    super();
    
    // Set default configuration
    this.defaults = {
      host: 'https://cloud.langfuse.com',
      enabled: true,
      flushAt: 20,
      flushInterval: 10000,
      maxBatchSize: 100,
      maxRetries: 3,
      retryDelay: 1000,
      timeout: 30000,
      
      features: {
        autoTracing: true,
        spanEnrichment: true,
        tokenTracking: true,
        errorCapture: true,
        distributedTracing: false,
        memoryCoordination: true,
        hookInterception: true,
        performanceMonitoring: true,
        neuralPatternAnalysis: false,
        predictiveCostEstimation: false,
        adaptiveTokenOptimization: false,
        swarmIntelligence: false
      },
      
      swarmIntegration: {
        coordinationEnabled: true,
        memoryDbPath: '.swarm/memory.db',
        sharedMemoryNamespace: 'langfuse',
        coordinationInterval: 5000,
        maxCoordinationRetries: 3,
        coordinationTimeout: 10000
      },
      
      telemetry: {
        collectMetrics: true,
        metricsInterval: 60000,
        metricsNamespace: 'langfuse_metrics',
        trackLatency: true,
        trackMemoryUsage: true,
        trackCpuUsage: false,
        trackTokenCosts: true,
        costAlerts: false,
        costAlertThreshold: 10.0
      },
      
      debug: {
        logLevel: 'info',
        logToFile: false,
        logFilePath: './langfuse.log',
        verboseTracing: false,
        traceCallStacks: false,
        dumpConfigOnStart: false,
        simulateErrors: false,
        simulateLatency: 0,
        bypassValidation: false
      }
    };
    
    // Initialize with defaults
    this.config = this.loadConfig();
  }
  
  /**
   * Load configuration from environment and merge with defaults
   */
  private loadConfig(): LangfuseConfig {
    const envConfig = this.loadFromEnvironment();
    const mergedConfig = this.mergeConfigs(this.defaults, envConfig);
    
    // Emit configuration loaded event
    this.emit('configLoaded', mergedConfig);
    
    return mergedConfig;
  }
  
  /**
   * Load configuration from environment variables
   */
  private loadFromEnvironment(): Partial<LangfuseConfig> {
    const config: Partial<LangfuseConfig> = {};
    
    // Core settings
    if (process.env.LANGFUSE_PUBLIC_KEY) {
      config.publicKey = process.env.LANGFUSE_PUBLIC_KEY;
    }
    if (process.env.LANGFUSE_SECRET_KEY) {
      config.secretKey = process.env.LANGFUSE_SECRET_KEY;
    }
    if (process.env.LANGFUSE_HOST) {
      config.host = process.env.LANGFUSE_HOST;
    }
    if (process.env.LANGFUSE_ENABLED !== undefined) {
      config.enabled = process.env.LANGFUSE_ENABLED !== 'false';
    }
    
    // Performance settings
    if (process.env.LANGFUSE_FLUSH_AT) {
      config.flushAt = parseInt(process.env.LANGFUSE_FLUSH_AT, 10);
    }
    if (process.env.LANGFUSE_FLUSH_INTERVAL) {
      config.flushInterval = parseInt(process.env.LANGFUSE_FLUSH_INTERVAL, 10);
    }
    
    // Feature flags from environment
    config.features = this.loadFeatureFlagsFromEnv();
    
    // Swarm integration from environment
    config.swarmIntegration = this.loadSwarmConfigFromEnv();
    
    // Telemetry from environment
    config.telemetry = this.loadTelemetryConfigFromEnv();
    
    // Debug settings from environment
    config.debug = this.loadDebugConfigFromEnv();
    
    return config;
  }
  
  /**
   * Load feature flags from environment variables
   */
  private loadFeatureFlagsFromEnv(): Partial<FeatureFlags> {
    const features: Partial<FeatureFlags> = {};
    
    const featureEnvMap: Record<keyof FeatureFlags, string> = {
      autoTracing: 'LANGFUSE_FEATURE_AUTO_TRACING',
      spanEnrichment: 'LANGFUSE_FEATURE_SPAN_ENRICHMENT',
      tokenTracking: 'LANGFUSE_FEATURE_TOKEN_TRACKING',
      errorCapture: 'LANGFUSE_FEATURE_ERROR_CAPTURE',
      distributedTracing: 'LANGFUSE_FEATURE_DISTRIBUTED_TRACING',
      memoryCoordination: 'LANGFUSE_FEATURE_MEMORY_COORDINATION',
      hookInterception: 'LANGFUSE_FEATURE_HOOK_INTERCEPTION',
      performanceMonitoring: 'LANGFUSE_FEATURE_PERFORMANCE_MONITORING',
      neuralPatternAnalysis: 'LANGFUSE_FEATURE_NEURAL_PATTERN_ANALYSIS',
      predictiveCostEstimation: 'LANGFUSE_FEATURE_PREDICTIVE_COST',
      adaptiveTokenOptimization: 'LANGFUSE_FEATURE_ADAPTIVE_TOKEN_OPT',
      swarmIntelligence: 'LANGFUSE_FEATURE_SWARM_INTELLIGENCE'
    };
    
    for (const [key, envVar] of Object.entries(featureEnvMap)) {
      if (process.env[envVar] !== undefined) {
        features[key as keyof FeatureFlags] = process.env[envVar] !== 'false';
      }
    }
    
    return features;
  }
  
  /**
   * Load swarm configuration from environment
   */
  private loadSwarmConfigFromEnv(): Partial<SwarmIntegrationConfig> {
    const swarmConfig: Partial<SwarmIntegrationConfig> = {};
    
    if (process.env.SWARM_ID) {
      swarmConfig.swarmId = process.env.SWARM_ID;
    }
    if (process.env.AGENT_ID) {
      swarmConfig.agentId = process.env.AGENT_ID;
    }
    if (process.env.AGENT_ROLE) {
      swarmConfig.agentRole = process.env.AGENT_ROLE;
    }
    if (process.env.LANGFUSE_COORDINATION_ENABLED !== undefined) {
      swarmConfig.coordinationEnabled = process.env.LANGFUSE_COORDINATION_ENABLED !== 'false';
    }
    if (process.env.LANGFUSE_MEMORY_DB_PATH) {
      swarmConfig.memoryDbPath = process.env.LANGFUSE_MEMORY_DB_PATH;
    }
    
    return swarmConfig;
  }
  
  /**
   * Load telemetry configuration from environment
   */
  private loadTelemetryConfigFromEnv(): Partial<TelemetryConfig> {
    const telemetry: Partial<TelemetryConfig> = {};
    
    if (process.env.LANGFUSE_COLLECT_METRICS !== undefined) {
      telemetry.collectMetrics = process.env.LANGFUSE_COLLECT_METRICS !== 'false';
    }
    if (process.env.LANGFUSE_TRACK_TOKEN_COSTS !== undefined) {
      telemetry.trackTokenCosts = process.env.LANGFUSE_TRACK_TOKEN_COSTS !== 'false';
    }
    if (process.env.LANGFUSE_COST_ALERT_THRESHOLD) {
      telemetry.costAlertThreshold = parseFloat(process.env.LANGFUSE_COST_ALERT_THRESHOLD);
    }
    
    return telemetry;
  }
  
  /**
   * Load debug configuration from environment
   */
  private loadDebugConfigFromEnv(): Partial<DebugConfig> {
    const debug: Partial<DebugConfig> = {};
    
    if (process.env.LANGFUSE_LOG_LEVEL) {
      debug.logLevel = process.env.LANGFUSE_LOG_LEVEL as DebugConfig['logLevel'];
    }
    if (process.env.LANGFUSE_VERBOSE_TRACING !== undefined) {
      debug.verboseTracing = process.env.LANGFUSE_VERBOSE_TRACING === 'true';
    }
    if (process.env.LANGFUSE_DUMP_CONFIG !== undefined) {
      debug.dumpConfigOnStart = process.env.LANGFUSE_DUMP_CONFIG === 'true';
    }
    
    return debug;
  }
  
  /**
   * Deep merge two configuration objects
   */
  private mergeConfigs(base: LangfuseConfig, override: Partial<LangfuseConfig>): LangfuseConfig {
    const merged = { ...base };
    
    for (const key in override) {
      if (override[key as keyof LangfuseConfig] !== undefined) {
        if (typeof override[key as keyof LangfuseConfig] === 'object' && 
            override[key as keyof LangfuseConfig] !== null &&
            !Array.isArray(override[key as keyof LangfuseConfig])) {
          // Deep merge objects
          merged[key as keyof LangfuseConfig] = {
            ...base[key as keyof LangfuseConfig] as any,
            ...override[key as keyof LangfuseConfig] as any
          };
        } else {
          // Direct assignment for primitives and arrays
          merged[key as keyof LangfuseConfig] = override[key as keyof LangfuseConfig] as any;
        }
      }
    }
    
    return merged;
  }
  
  /**
   * Get the current configuration
   */
  getConfig(): LangfuseConfig {
    return { ...this.config };
  }
  
  /**
   * Update configuration with validation
   */
  updateConfig(updates: Partial<LangfuseConfig>): ValidationResult {
    const validation = this.validateConfig({ ...this.config, ...updates });
    
    if (validation.valid || this.config.debug?.bypassValidation) {
      this.config = this.mergeConfigs(this.config, updates);
      this.emit('configUpdated', this.config);
    }
    
    return validation;
  }
  
  /**
   * Validate configuration
   */
  validateConfig(config: LangfuseConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Validate core settings
    if (config.enabled && (!config.publicKey || !config.secretKey)) {
      errors.push('Langfuse is enabled but publicKey or secretKey is missing');
    }
    
    // Validate performance settings
    if (config.flushAt !== undefined && config.flushAt < 1) {
      errors.push('flushAt must be at least 1');
    }
    if (config.flushInterval !== undefined && config.flushInterval < 1000) {
      warnings.push('flushInterval less than 1000ms may impact performance');
    }
    if (config.maxBatchSize !== undefined && config.maxBatchSize > 1000) {
      warnings.push('maxBatchSize greater than 1000 may cause memory issues');
    }
    
    // Validate feature combinations
    if (config.features?.distributedTracing && !config.features?.memoryCoordination) {
      warnings.push('Distributed tracing works better with memory coordination enabled');
    }
    if (config.features?.swarmIntelligence && !config.swarmIntegration?.coordinationEnabled) {
      errors.push('Swarm intelligence requires coordination to be enabled');
    }
    
    // Validate swarm configuration
    if (config.swarmIntegration?.coordinationEnabled && !config.swarmIntegration?.memoryDbPath) {
      errors.push('Coordination is enabled but memoryDbPath is not set');
    }
    
    // Validate telemetry configuration
    if (config.telemetry?.costAlerts && config.telemetry?.costAlertThreshold === undefined) {
      warnings.push('Cost alerts are enabled but no threshold is set');
    }
    
    // Validate debug configuration
    const validLogLevels = ['error', 'warn', 'info', 'debug', 'trace'];
    if (config.debug?.logLevel && !validLogLevels.includes(config.debug.logLevel)) {
      errors.push(`Invalid log level: ${config.debug.logLevel}`);
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  /**
   * Check if a feature is enabled
   */
  isFeatureEnabled(feature: keyof FeatureFlags): boolean {
    return this.config.features?.[feature] ?? false;
  }
  
  /**
   * Get swarm configuration
   */
  getSwarmConfig(): SwarmIntegrationConfig {
    return { ...this.config.swarmIntegration } as SwarmIntegrationConfig;
  }
  
  /**
   * Get telemetry configuration
   */
  getTelemetryConfig(): TelemetryConfig {
    return { ...this.config.telemetry } as TelemetryConfig;
  }
  
  /**
   * Get debug configuration
   */
  getDebugConfig(): DebugConfig {
    return { ...this.config.debug } as DebugConfig;
  }
  
  /**
   * Check if Langfuse is properly configured
   */
  isConfigured(): boolean {
    return !!(this.config.publicKey && this.config.secretKey);
  }
  
  /**
   * Check if Langfuse is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled ?? true;
  }
  
  /**
   * Reset configuration to defaults
   */
  reset(): void {
    this.config = { ...this.defaults };
    this.emit('configReset', this.config);
  }
  
  /**
   * Export configuration for debugging
   */
  exportConfig(): string {
    const safeConfig = { ...this.config };
    
    // Mask sensitive values
    if (safeConfig.publicKey) {
      safeConfig.publicKey = this.maskValue(safeConfig.publicKey);
    }
    if (safeConfig.secretKey) {
      safeConfig.secretKey = this.maskValue(safeConfig.secretKey);
    }
    
    return JSON.stringify(safeConfig, null, 2);
  }
  
  /**
   * Mask sensitive values for logging
   */
  private maskValue(value: string): string {
    if (value.length <= 8) {
      return '***';
    }
    return value.substring(0, 4) + '***' + value.substring(value.length - 4);
  }
  
  /**
   * Get configuration summary for logging
   */
  getConfigSummary(): Record<string, any> {
    return {
      enabled: this.isEnabled(),
      configured: this.isConfigured(),
      features: {
        enabled: Object.entries(this.config.features || {})
          .filter(([_, enabled]) => enabled)
          .map(([feature]) => feature)
      },
      swarm: {
        enabled: this.config.swarmIntegration?.coordinationEnabled,
        swarmId: this.config.swarmIntegration?.swarmId,
        agentRole: this.config.swarmIntegration?.agentRole
      },
      telemetry: {
        metricsEnabled: this.config.telemetry?.collectMetrics,
        costTrackingEnabled: this.config.telemetry?.trackTokenCosts
      },
      debug: {
        logLevel: this.config.debug?.logLevel,
        verboseTracing: this.config.debug?.verboseTracing
      }
    };
  }
}

// Export singleton instance
export const configManager = new ConfigManager();

// Export convenience functions
export function getConfig(): LangfuseConfig {
  return configManager.getConfig();
}

export function isFeatureEnabled(feature: keyof FeatureFlags): boolean {
  return configManager.isFeatureEnabled(feature);
}

export function updateConfig(updates: Partial<LangfuseConfig>): ValidationResult {
  return configManager.updateConfig(updates);
}

export function validateConfig(config: LangfuseConfig): ValidationResult {
  return configManager.validateConfig(config);
}