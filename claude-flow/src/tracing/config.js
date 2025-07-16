/**
 * Tracing Configuration for Claude-Flow
 * Manages Langfuse configuration and environment setup
 */

import logger from '../utils/logger.js';

// Load environment variables if dotenv is available
let dotenvLoaded = false;
try {
  const dotenv = await import('dotenv');
  dotenv.config();
  dotenvLoaded = true;
} catch (error) {
  logger.debug('dotenv not available, using process.env directly');
}

export class TracingConfig {
  constructor(options = {}) {
    this.config = {
      // Core Langfuse settings
      enabled: this.parseBoolean(options.enabled ?? process.env.LANGFUSE_ENABLED ?? true),
      secretKey: options.secretKey || process.env.LANGFUSE_SECRET_KEY,
      publicKey: options.publicKey || process.env.LANGFUSE_PUBLIC_KEY,
      baseUrl: options.baseUrl || process.env.LANGFUSE_HOST || 'https://cloud.langfuse.com',
      
      // Performance settings
      flushAt: parseInt(options.flushAt || process.env.LANGFUSE_FLUSH_AT || '10'),
      flushInterval: parseInt(options.flushInterval || process.env.LANGFUSE_FLUSH_INTERVAL || '1000'),
      requestTimeout: parseInt(options.requestTimeout || process.env.LANGFUSE_REQUEST_TIMEOUT || '10000'),
      
      // Debug and logging
      debug: this.parseBoolean(options.debug ?? process.env.LANGFUSE_DEBUG ?? false),
      logLevel: options.logLevel || process.env.LANGFUSE_LOG_LEVEL || 'info',
      
      // Instrumentation settings
      instrumentMCP: this.parseBoolean(options.instrumentMCP ?? process.env.LANGFUSE_INSTRUMENT_MCP ?? true),
      instrumentSwarm: this.parseBoolean(options.instrumentSwarm ?? process.env.LANGFUSE_INSTRUMENT_SWARM ?? true),
      instrumentHooks: this.parseBoolean(options.instrumentHooks ?? process.env.LANGFUSE_INSTRUMENT_HOOKS ?? true),
      instrumentMemory: this.parseBoolean(options.instrumentMemory ?? process.env.LANGFUSE_INSTRUMENT_MEMORY ?? true),
      
      // Sampling and filtering
      sampleRate: parseFloat(options.sampleRate || process.env.LANGFUSE_SAMPLE_RATE || '1.0'),
      excludeTools: this.parseArray(options.excludeTools || process.env.LANGFUSE_EXCLUDE_TOOLS || ''),
      includeTools: this.parseArray(options.includeTools || process.env.LANGFUSE_INCLUDE_TOOLS || ''),
      
      // Metadata and tags
      defaultTags: this.parseArray(options.defaultTags || process.env.LANGFUSE_DEFAULT_TAGS || 'claude-flow,mcp'),
      environment: options.environment || process.env.NODE_ENV || 'development',
      version: options.version || process.env.CLAUDE_FLOW_VERSION || '2.0.0',
      
      // Advanced settings
      batchSize: parseInt(options.batchSize || process.env.LANGFUSE_BATCH_SIZE || '100'),
      maxRetries: parseInt(options.maxRetries || process.env.LANGFUSE_MAX_RETRIES || '3'),
      retryDelay: parseInt(options.retryDelay || process.env.LANGFUSE_RETRY_DELAY || '1000'),
      
      // Privacy and security
      maskSensitiveData: this.parseBoolean(options.maskSensitiveData ?? process.env.LANGFUSE_MASK_SENSITIVE ?? true),
      sensitiveKeys: this.parseArray(options.sensitiveKeys || process.env.LANGFUSE_SENSITIVE_KEYS || 'password,token,key,secret'),
      
      // Storage and persistence
      persistTraces: this.parseBoolean(options.persistTraces ?? process.env.LANGFUSE_PERSIST_TRACES ?? false),
      traceStoragePath: options.traceStoragePath || process.env.LANGFUSE_TRACE_STORAGE_PATH || './traces',
      maxTraceAge: parseInt(options.maxTraceAge || process.env.LANGFUSE_MAX_TRACE_AGE || '86400'), // 24 hours
    };

    this.validate();
  }

  /**
   * Parse boolean values from environment variables
   */
  parseBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true' || value === '1' || value === 'yes';
    }
    return false;
  }

  /**
   * Parse array values from environment variables
   */
  parseArray(value) {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      return value.split(',').map(item => item.trim()).filter(item => item);
    }
    return [];
  }

  /**
   * Validate configuration
   */
  validate() {
    const errors = [];

    // Check required fields when enabled
    if (this.config.enabled) {
      if (!this.config.secretKey) {
        errors.push('LANGFUSE_SECRET_KEY is required when tracing is enabled');
      }
      if (!this.config.publicKey) {
        errors.push('LANGFUSE_PUBLIC_KEY is required when tracing is enabled');
      }
    }

    // Validate URLs
    if (this.config.baseUrl && !this.isValidUrl(this.config.baseUrl)) {
      errors.push('LANGFUSE_HOST must be a valid URL');
    }

    // Validate numeric values
    if (this.config.flushAt < 1 || this.config.flushAt > 1000) {
      errors.push('LANGFUSE_FLUSH_AT must be between 1 and 1000');
    }

    if (this.config.sampleRate < 0 || this.config.sampleRate > 1) {
      errors.push('LANGFUSE_SAMPLE_RATE must be between 0 and 1');
    }

    if (errors.length > 0) {
      const errorMessage = `Langfuse configuration errors:\n${errors.join('\n')}`;
      logger.error(errorMessage);
      
      if (this.config.enabled) {
        throw new Error(errorMessage);
      }
    }
  }

  /**
   * Check if a URL is valid
   */
  isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get configuration for Langfuse client
   */
  getClientConfig() {
    return {
      secretKey: this.config.secretKey,
      publicKey: this.config.publicKey,
      baseUrl: this.config.baseUrl,
      debug: this.config.debug,
      enabled: this.config.enabled,
      flushAt: this.config.flushAt,
      flushInterval: this.config.flushInterval,
      requestTimeout: this.config.requestTimeout
    };
  }

  /**
   * Get instrumentation configuration
   */
  getInstrumentationConfig() {
    return {
      instrumentMCP: this.config.instrumentMCP,
      instrumentSwarm: this.config.instrumentSwarm,
      instrumentHooks: this.config.instrumentHooks,
      instrumentMemory: this.config.instrumentMemory,
      sampleRate: this.config.sampleRate,
      excludeTools: this.config.excludeTools,
      includeTools: this.config.includeTools,
      maskSensitiveData: this.config.maskSensitiveData,
      sensitiveKeys: this.config.sensitiveKeys
    };
  }

  /**
   * Get default metadata for traces
   */
  getDefaultMetadata() {
    return {
      environment: this.config.environment,
      version: this.config.version,
      claudeFlowVersion: this.config.version,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get default tags for traces
   */
  getDefaultTags() {
    return [
      ...this.config.defaultTags,
      `env:${this.config.environment}`,
      `version:${this.config.version}`
    ];
  }

  /**
   * Check if a tool should be instrumented
   */
  shouldInstrumentTool(toolName) {
    // Check sample rate
    if (Math.random() > this.config.sampleRate) {
      return false;
    }

    // Check exclude list
    if (this.config.excludeTools.includes(toolName)) {
      return false;
    }

    // Check include list (if specified, only include listed tools)
    if (this.config.includeTools.length > 0) {
      return this.config.includeTools.includes(toolName);
    }

    return true;
  }

  /**
   * Mask sensitive data in objects
   */
  maskSensitiveData(data) {
    if (!this.config.maskSensitiveData) return data;
    
    return this.recursiveMask(data, this.config.sensitiveKeys);
  }

  /**
   * Recursively mask sensitive keys in objects
   */
  recursiveMask(obj, sensitiveKeys) {
    if (typeof obj !== 'object' || obj === null) return obj;
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.recursiveMask(item, sensitiveKeys));
    }

    const masked = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = sensitiveKeys.some(sensitiveKey => 
        lowerKey.includes(sensitiveKey.toLowerCase())
      );
      
      if (isSensitive) {
        masked[key] = '***MASKED***';
      } else if (typeof value === 'object' && value !== null) {
        masked[key] = this.recursiveMask(value, sensitiveKeys);
      } else {
        masked[key] = value;
      }
    }
    
    return masked;
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates) {
    this.config = { ...this.config, ...updates };
    this.validate();
  }

  /**
   * Export configuration for environment setup
   */
  exportEnvironment() {
    const envVars = {
      LANGFUSE_ENABLED: this.config.enabled.toString(),
      LANGFUSE_SECRET_KEY: this.config.secretKey || '',
      LANGFUSE_PUBLIC_KEY: this.config.publicKey || '',
      LANGFUSE_HOST: this.config.baseUrl,
      LANGFUSE_DEBUG: this.config.debug.toString(),
      LANGFUSE_FLUSH_AT: this.config.flushAt.toString(),
      LANGFUSE_FLUSH_INTERVAL: this.config.flushInterval.toString(),
      LANGFUSE_REQUEST_TIMEOUT: this.config.requestTimeout.toString(),
      LANGFUSE_SAMPLE_RATE: this.config.sampleRate.toString(),
      LANGFUSE_DEFAULT_TAGS: this.config.defaultTags.join(','),
      LANGFUSE_MASK_SENSITIVE: this.config.maskSensitiveData.toString(),
      LANGFUSE_SENSITIVE_KEYS: this.config.sensitiveKeys.join(',')
    };

    return envVars;
  }

  /**
   * Generate example environment file
   */
  generateEnvExample() {
    return `# Langfuse Configuration for Claude-Flow

# Basic settings
LANGFUSE_ENABLED=true
LANGFUSE_SECRET_KEY=your-secret-key-here
LANGFUSE_PUBLIC_KEY=your-public-key-here
LANGFUSE_HOST=https://cloud.langfuse.com

# Performance settings
LANGFUSE_FLUSH_AT=10
LANGFUSE_FLUSH_INTERVAL=1000
LANGFUSE_REQUEST_TIMEOUT=10000

# Debug and logging
LANGFUSE_DEBUG=false
LANGFUSE_LOG_LEVEL=info

# Instrumentation settings
LANGFUSE_INSTRUMENT_MCP=true
LANGFUSE_INSTRUMENT_SWARM=true
LANGFUSE_INSTRUMENT_HOOKS=true
LANGFUSE_INSTRUMENT_MEMORY=true

# Sampling and filtering
LANGFUSE_SAMPLE_RATE=1.0
LANGFUSE_EXCLUDE_TOOLS=
LANGFUSE_INCLUDE_TOOLS=

# Metadata and tags
LANGFUSE_DEFAULT_TAGS=claude-flow,mcp
LANGFUSE_ENVIRONMENT=development
LANGFUSE_VERSION=2.0.0

# Privacy and security
LANGFUSE_MASK_SENSITIVE=true
LANGFUSE_SENSITIVE_KEYS=password,token,key,secret

# Storage and persistence
LANGFUSE_PERSIST_TRACES=false
LANGFUSE_TRACE_STORAGE_PATH=./traces
LANGFUSE_MAX_TRACE_AGE=86400
`;
  }
}

export default TracingConfig;