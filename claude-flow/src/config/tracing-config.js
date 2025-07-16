/**
 * Tracing Configuration System for Claude Flow
 * Manages Langfuse tracing settings and component-specific configuration
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import logger from '../utils/logger.js';

export class TracingConfig {
  constructor(configPath = null) {
    this.configPath = configPath;
    this.config = this.loadConfig();
    this.validateConfig();
  }

  loadConfig() {
    // Default configuration
    const defaultConfig = {
      enabled: process.env.CLAUDE_FLOW_TRACING_ENABLED === 'true',
      level: process.env.CLAUDE_FLOW_TRACE_LEVEL || 'info',
      samplingRate: parseFloat(process.env.CLAUDE_FLOW_TRACE_SAMPLING_RATE || '1.0'),
      
      langfuse: {
        publicKey: process.env.LANGFUSE_PUBLIC_KEY,
        secretKey: process.env.LANGFUSE_SECRET_KEY,
        host: process.env.LANGFUSE_HOST || 'https://cloud.langfuse.com',
        batchSize: parseInt(process.env.CLAUDE_FLOW_BATCH_SIZE || '50'),
        flushInterval: parseInt(process.env.CLAUDE_FLOW_FLUSH_INTERVAL || '5000'),
        maxQueueSize: parseInt(process.env.CLAUDE_FLOW_MAX_QUEUE_SIZE || '10000'),
        release: process.env.CLAUDE_FLOW_RELEASE || 'v2.0.0',
        debug: process.env.LANGFUSE_DEBUG === 'true'
      },
      
      components: {
        mcp: process.env.CLAUDE_FLOW_TRACE_MCP !== 'false',
        swarm: process.env.CLAUDE_FLOW_TRACE_SWARM !== 'false',
        agents: process.env.CLAUDE_FLOW_TRACE_AGENTS !== 'false',
        hooks: process.env.CLAUDE_FLOW_TRACE_HOOKS !== 'false',
        memory: process.env.CLAUDE_FLOW_TRACE_MEMORY !== 'false',
        performance: process.env.CLAUDE_FLOW_TRACE_PERFORMANCE !== 'false'
      },
      
      features: {
        asyncContext: process.env.CLAUDE_FLOW_TRACE_ASYNC_CONTEXT !== 'false',
        errorStack: process.env.CLAUDE_FLOW_TRACE_ERROR_STACK !== 'false',
        sanitizeInputs: process.env.CLAUDE_FLOW_TRACE_SANITIZE_INPUTS !== 'false',
        correlationId: process.env.CLAUDE_FLOW_TRACE_CORRELATION_ID !== 'false',
        hierarchicalTracing: process.env.CLAUDE_FLOW_TRACE_HIERARCHICAL !== 'false'
      },
      
      performance: {
        enableMetrics: process.env.CLAUDE_FLOW_ENABLE_METRICS !== 'false',
        metricsInterval: parseInt(process.env.CLAUDE_FLOW_METRICS_INTERVAL || '30000'),
        enableProfiling: process.env.CLAUDE_FLOW_ENABLE_PROFILING === 'true',
        memoryThreshold: parseInt(process.env.CLAUDE_FLOW_MEMORY_THRESHOLD || '104857600'), // 100MB
        cpuThreshold: parseInt(process.env.CLAUDE_FLOW_CPU_THRESHOLD || '80')
      },
      
      errorHandling: {
        circuitBreakerEnabled: process.env.CLAUDE_FLOW_CIRCUIT_BREAKER !== 'false',
        maxFailures: parseInt(process.env.CLAUDE_FLOW_MAX_FAILURES || '10'),
        resetTimeout: parseInt(process.env.CLAUDE_FLOW_RESET_TIMEOUT || '60000'),
        retryAttempts: parseInt(process.env.CLAUDE_FLOW_RETRY_ATTEMPTS || '3'),
        retryDelay: parseInt(process.env.CLAUDE_FLOW_RETRY_DELAY || '1000')
      },
      
      filtering: {
        excludeTools: (process.env.CLAUDE_FLOW_EXCLUDE_TOOLS || '').split(',').filter(Boolean),
        excludeAgents: (process.env.CLAUDE_FLOW_EXCLUDE_AGENTS || '').split(',').filter(Boolean),
        excludeHooks: (process.env.CLAUDE_FLOW_EXCLUDE_HOOKS || '').split(',').filter(Boolean),
        includeDebugInfo: process.env.CLAUDE_FLOW_INCLUDE_DEBUG === 'true'
      }
    };

    // Try to load from config file if provided
    if (this.configPath) {
      try {
        const fileConfig = JSON.parse(readFileSync(resolve(this.configPath), 'utf8'));
        return this.mergeConfigs(defaultConfig, fileConfig);
      } catch (error) {
        logger.warn(`Failed to load config file ${this.configPath}:`, error.message);
      }
    }

    return defaultConfig;
  }

  mergeConfigs(defaultConfig, fileConfig) {
    // Deep merge configuration objects
    const merged = { ...defaultConfig };
    
    for (const [key, value] of Object.entries(fileConfig)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        merged[key] = { ...merged[key], ...value };
      } else {
        merged[key] = value;
      }
    }
    
    return merged;
  }

  validateConfig() {
    const errors = [];
    
    // Validate required fields
    if (this.config.enabled) {
      if (!this.config.langfuse.publicKey) {
        errors.push('LANGFUSE_PUBLIC_KEY is required when tracing is enabled');
      }
      if (!this.config.langfuse.secretKey) {
        errors.push('LANGFUSE_SECRET_KEY is required when tracing is enabled');
      }
    }
    
    // Validate numeric ranges
    if (this.config.samplingRate < 0 || this.config.samplingRate > 1) {
      errors.push('samplingRate must be between 0 and 1');
    }
    
    if (this.config.langfuse.batchSize < 1 || this.config.langfuse.batchSize > 1000) {
      errors.push('batchSize must be between 1 and 1000');
    }
    
    if (this.config.langfuse.flushInterval < 100) {
      errors.push('flushInterval must be at least 100ms');
    }
    
    // Validate level
    const validLevels = ['debug', 'info', 'warn', 'error'];
    if (!validLevels.includes(this.config.level)) {
      errors.push(`level must be one of: ${validLevels.join(', ')}`);
    }
    
    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }
    
    logger.info('Tracing configuration validated successfully');
  }

  /**
   * Get the full configuration object
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Get configuration for a specific component
   */
  getComponentConfig(component) {
    return {
      enabled: this.config.enabled && this.config.components[component],
      level: this.config.level,
      samplingRate: this.config.samplingRate,
      features: this.config.features,
      performance: this.config.performance
    };
  }

  /**
   * Get Langfuse client configuration
   */
  getLangfuseConfig() {
    return {
      ...this.config.langfuse,
      enabled: this.config.enabled
    };
  }

  /**
   * Check if tracing is enabled for a specific component
   */
  isEnabled(component = null) {
    if (!this.config.enabled) return false;
    if (!component) return true;
    return this.config.components[component] === true;
  }

  /**
   * Check if a tool should be traced
   */
  shouldTracetool(toolName) {
    if (!this.isEnabled('mcp')) return false;
    return !this.config.filtering.excludeTools.includes(toolName);
  }

  /**
   * Check if an agent should be traced
   */
  shouldTraceAgent(agentId) {
    if (!this.isEnabled('agents')) return false;
    return !this.config.filtering.excludeAgents.includes(agentId);
  }

  /**
   * Check if a hook should be traced
   */
  shouldTraceHook(hookType) {
    if (!this.isEnabled('hooks')) return false;
    return !this.config.filtering.excludeHooks.includes(hookType);
  }

  /**
   * Check if sampling should allow this trace
   */
  shouldSample() {
    return Math.random() < this.config.samplingRate;
  }

  /**
   * Get trace tags based on configuration
   */
  getTraceTags(context = {}) {
    const tags = [];
    
    if (this.config.langfuse.release) {
      tags.push(`release:${this.config.langfuse.release}`);
    }
    
    if (process.env.NODE_ENV) {
      tags.push(`environment:${process.env.NODE_ENV}`);
    }
    
    if (context.swarmId) {
      tags.push(`swarm:${context.swarmId}`);
    }
    
    if (context.agentType) {
      tags.push(`agent-type:${context.agentType}`);
    }
    
    if (context.priority) {
      tags.push(`priority:${context.priority}`);
    }
    
    return tags;
  }

  /**
   * Get metadata fields based on configuration
   */
  getBaseMetadata() {
    return {
      claude_flow_version: process.env.CLAUDE_FLOW_VERSION || '2.0.0',
      node_version: process.version,
      platform: process.platform,
      pid: process.pid,
      tracing_enabled: this.config.enabled,
      sampling_rate: this.config.samplingRate,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Update configuration at runtime
   */
  updateConfig(updates) {
    const oldConfig = { ...this.config };
    
    try {
      this.config = this.mergeConfigs(this.config, updates);
      this.validateConfig();
      
      logger.info('Configuration updated successfully', {
        changes: this.getConfigDiff(oldConfig, this.config)
      });
      
      return true;
    } catch (error) {
      this.config = oldConfig;
      logger.error('Failed to update configuration:', error.message);
      return false;
    }
  }

  /**
   * Get configuration diff for logging
   */
  getConfigDiff(oldConfig, newConfig) {
    const diff = {};
    
    for (const [key, value] of Object.entries(newConfig)) {
      if (JSON.stringify(oldConfig[key]) !== JSON.stringify(value)) {
        diff[key] = {
          old: oldConfig[key],
          new: value
        };
      }
    }
    
    return diff;
  }

  /**
   * Export configuration to file
   */
  exportConfig(filePath) {
    try {
      const configToExport = {
        ...this.config,
        langfuse: {
          ...this.config.langfuse,
          publicKey: '***',
          secretKey: '***'
        }
      };
      
      writeFileSync(filePath, JSON.stringify(configToExport, null, 2));
      logger.info(`Configuration exported to ${filePath}`);
      return true;
    } catch (error) {
      logger.error(`Failed to export configuration:`, error.message);
      return false;
    }
  }

  /**
   * Get configuration summary for debugging
   */
  getSummary() {
    return {
      enabled: this.config.enabled,
      level: this.config.level,
      samplingRate: this.config.samplingRate,
      components: Object.entries(this.config.components)
        .filter(([, enabled]) => enabled)
        .map(([name]) => name),
      features: Object.entries(this.config.features)
        .filter(([, enabled]) => enabled)
        .map(([name]) => name),
      langfuse: {
        host: this.config.langfuse.host,
        batchSize: this.config.langfuse.batchSize,
        flushInterval: this.config.langfuse.flushInterval,
        hasCredentials: !!(this.config.langfuse.publicKey && this.config.langfuse.secretKey)
      }
    };
  }
}

// Create singleton instance
export const tracingConfig = new TracingConfig();

// Export configuration utilities
export const getTracingConfig = () => tracingConfig.getConfig();
export const isTracingEnabled = (component) => tracingConfig.isEnabled(component);
export const shouldTraceOperation = (type, name) => {
  switch (type) {
    case 'tool':
      return tracingConfig.shouldTraceTest(name);
    case 'agent':
      return tracingConfig.shouldTraceAgent(name);
    case 'hook':
      return tracingConfig.shouldTraceHook(name);
    default:
      return tracingConfig.isEnabled();
  }
};