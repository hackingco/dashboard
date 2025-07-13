/**
 * Singleton module for Langfuse Wrapper
 * Provides global instance management with thread-safe initialization
 */

import { LangfuseWrapper, HookContext, TokenUsage } from './index';
import { LangfuseConfig, configManager } from './config';
import { EventEmitter } from 'events';
import { SwarmTracer, createSwarmTracer } from './swarm-tracer';
import { TraceContextManager, traceContextManager } from './trace-context';
import { ErrorHandler, getErrorHandler } from './error-handler';

/**
 * Singleton instance state
 */
interface SingletonState {
  instance: LangfuseWrapper | null;
  initialized: boolean;
  initializationPromise: Promise<LangfuseWrapper> | null;
  shutdownPromise: Promise<void> | null;
  lastError: Error | null;
  initCount: number;
  shutdownCount: number;
}

/**
 * Initialization options for the singleton
 */
export interface SingletonInitOptions {
  config?: LangfuseConfig;
  forceReinit?: boolean;
  validateConfig?: boolean;
}

/**
 * Singleton lifecycle events
 */
export interface SingletonEvents {
  'initialized': (wrapper: LangfuseWrapper) => void;
  'shutdown': () => void;
  'error': (error: Error) => void;
  'configChanged': (config: LangfuseConfig) => void;
  'reinitializing': () => void;
}

export interface LangfuseInstance {
  wrapper: LangfuseWrapper;
  swarmTracer: SwarmTracer;
  contextManager: TraceContextManager;
  configManager: typeof configManager;
  errorHandler: ErrorHandler;
}

/**
 * Singleton manager for LangfuseWrapper
 * Ensures only one instance exists and handles lifecycle management
 */
export class LangfuseSingleton extends EventEmitter {
  private state: SingletonState = {
    instance: null,
    initialized: false,
    initializationPromise: null,
    shutdownPromise: null,
    lastError: null,
    initCount: 0,
    shutdownCount: 0
  };
  
  private readonly initLock = new Map<string, Promise<void>>();
  private cleanupHandlers: (() => Promise<void>)[] = [];
  private swarmTracer: SwarmTracer | null = null;
  
  constructor() {
    super();
    
    // Register process cleanup handlers
    this.registerCleanupHandlers();
    
    // Listen for configuration changes
    configManager.on('configUpdated', (config) => {
      this.emit('configChanged', config);
      
      // Reinitialize if critical config changed
      if (this.shouldReinitialize(config)) {
        this.reinitialize(config).catch(error => {
          console.error('Failed to reinitialize after config change:', error);
          this.emit('error', error);
        });
      }
    });
  }
  
  /**
   * Get or create the singleton instance
   */
  async getInstance(options?: SingletonInitOptions): Promise<LangfuseWrapper> {
    // If already initializing, wait for it
    if (this.state.initializationPromise && !options?.forceReinit) {
      return this.state.initializationPromise;
    }
    
    // If already initialized and not forcing reinit, return existing
    if (this.state.initialized && this.state.instance && !options?.forceReinit) {
      return this.state.instance;
    }
    
    // Create initialization promise for thread safety
    this.state.initializationPromise = this.initialize(options);
    
    try {
      const instance = await this.state.initializationPromise;
      return instance;
    } catch (error) {
      this.state.initializationPromise = null;
      throw error;
    }
  }
  
  /**
   * Get full instance with all components
   */
  async getFullInstance(options?: SingletonInitOptions): Promise<LangfuseInstance> {
    const wrapper = await this.getInstance(options);
    
    // Create swarm tracer if not exists
    if (!this.swarmTracer) {
      this.swarmTracer = createSwarmTracer(wrapper);
    }
    
    return {
      wrapper,
      swarmTracer: this.swarmTracer,
      contextManager: traceContextManager,
      configManager,
      errorHandler: getErrorHandlerSingleton()
    };
  }
  
  /**
   * Initialize the singleton instance
   */
  private async initialize(options?: SingletonInitOptions): Promise<LangfuseWrapper> {
    const lockKey = `init-${Date.now()}`;
    
    // Ensure thread-safe initialization
    const initPromise = this.performInitialization(options);
    this.initLock.set(lockKey, initPromise);
    
    try {
      await initPromise;
      
      if (!this.state.instance) {
        throw new Error('Initialization completed but instance is null');
      }
      
      return this.state.instance;
    } finally {
      this.initLock.delete(lockKey);
    }
  }
  
  /**
   * Perform the actual initialization
   */
  private async performInitialization(options?: SingletonInitOptions): Promise<void> {
    try {
      // Get configuration
      const config = options?.config || configManager.getConfig();
      
      // Validate configuration if requested
      if (options?.validateConfig) {
        const validation = configManager.validateConfig(config);
        if (!validation.valid) {
          throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
        }
      }
      
      // Shutdown existing instance if force reinit
      if (options?.forceReinit && this.state.instance) {
        await this.shutdown();
      }
      
      // Create new instance
      this.state.instance = new LangfuseWrapper(config);
      
      this.state.initialized = true;
      this.state.initCount++;
      this.state.lastError = null;
      
      // Set up instance event handlers
      this.setupInstanceHandlers(this.state.instance);
      
      // Set up auto-tracing if enabled
      if (configManager.isFeatureEnabled('autoTracing')) {
        this.setupAutoTracing(this.state.instance);
      }
      
      // Store initialization in memory
      await this.storeInitializationData();
      
      // Emit initialized event
      this.emit('initialized', this.state.instance);
      
    } catch (error) {
      this.state.lastError = error as Error;
      this.state.initialized = false;
      this.emit('error', error as Error);
      throw error;
    }
  }
  
  /**
   * Set up event handlers for the instance
   */
  private setupInstanceHandlers(instance: LangfuseWrapper): void {
    // Forward instance events
    instance.on('initialized', () => {
      console.log('Langfuse wrapper initialized successfully');
    });
    
    instance.on('shutdown', () => {
      console.log('Langfuse wrapper shutdown completed');
    });
    
    // Handle errors
    instance.on('error', (error: Error) => {
      console.error('Langfuse wrapper error:', error);
      this.emit('error', error);
    });
  }
  
  
  /**
   * Set up auto-tracing for common operations
   */
  private setupAutoTracing(wrapper: LangfuseWrapper): void {
    // Auto-trace swarm initialization if SWARM_ID is set
    if (typeof process !== 'undefined' && process.env.SWARM_ID) {
      // Lazy create swarm tracer
      if (!this.swarmTracer) {
        this.swarmTracer = createSwarmTracer(wrapper);
      }
      
      this.swarmTracer.startSwarmTrace(
        process.env.SWARM_ID,
        process.env.SWARM_TOPOLOGY || 'unknown',
        parseInt(process.env.MAX_AGENTS || '5', 10),
        {
          autoTraced: true,
          initTime: new Date().toISOString()
        }
      );
    }
  }
  
  /**
   * Check if reinitilization is needed based on config changes
   */
  private shouldReinitialize(newConfig: LangfuseConfig): boolean {
    if (!this.state.instance || !this.state.initialized) {
      return false;
    }
    
    const currentConfig = configManager.getConfig();
    
    // Check critical config changes that require reinit
    const criticalFields: (keyof LangfuseConfig)[] = [
      'publicKey',
      'secretKey',
      'host',
      'enabled'
    ];
    
    return criticalFields.some(field => 
      newConfig[field] !== currentConfig[field]
    );
  }
  
  /**
   * Reinitialize the singleton with new configuration
   */
  async reinitialize(config?: LangfuseConfig): Promise<LangfuseWrapper> {
    this.emit('reinitializing');
    
    return this.getInstance({
      config,
      forceReinit: true,
      validateConfig: true
    });
  }
  
  /**
   * Shutdown the singleton instance
   */
  async shutdown(): Promise<void> {
    // If already shutting down, wait for it
    if (this.state.shutdownPromise) {
      return this.state.shutdownPromise;
    }
    
    // If not initialized, nothing to shutdown
    if (!this.state.initialized || !this.state.instance) {
      return;
    }
    
    // Create shutdown promise
    this.state.shutdownPromise = this.performShutdown();
    
    try {
      await this.state.shutdownPromise;
    } finally {
      this.state.shutdownPromise = null;
    }
  }
  
  /**
   * Perform the actual shutdown
   */
  private async performShutdown(): Promise<void> {
    try {
      // Complete all active swarm traces
      if (this.swarmTracer) {
        const activeSwarms = this.swarmTracer.getActiveSwarms();
        for (const swarmId of activeSwarms) {
          await this.swarmTracer.completeSwarmTrace(swarmId, {
            reason: 'singleton_shutdown',
            timestamp: new Date().toISOString()
          });
        }
      }
      
      // Shutdown wrapper instance
      if (this.state.instance) {
        await this.state.instance.shutdown();
        this.state.instance = null;
      }
      
      this.state.initialized = false;
      this.state.shutdownCount++;
      
      // Clear initialization promise
      this.state.initializationPromise = null;
      
      // Run cleanup handlers
      await this.runCleanupHandlers();
      
      this.emit('shutdown');
      
    } catch (error) {
      console.error('Error during singleton shutdown:', error);
      this.emit('error', error as Error);
      throw error;
    }
  }
  
  /**
   * Register cleanup handlers for process exit
   */
  private registerCleanupHandlers(): void {
    const cleanup = async () => {
      if (this.state.initialized && this.state.instance) {
        console.log('Shutting down Langfuse singleton...');
        await this.shutdown();
      }
    };
    
    // Handle various exit scenarios
    process.on('exit', () => {
      // Synchronous cleanup only
      if (this.state.instance) {
        console.log('Process exiting, Langfuse traces may be lost');
      }
    });
    
    process.on('SIGINT', async () => {
      await cleanup();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      await cleanup();
      process.exit(0);
    });
    
    process.on('uncaughtException', async (error) => {
      console.error('Uncaught exception:', error);
      await cleanup();
      process.exit(1);
    });
    
    process.on('unhandledRejection', async (reason, promise) => {
      console.error('Unhandled rejection at:', promise, 'reason:', reason);
      await cleanup();
      process.exit(1);
    });
  }
  
  /**
   * Store initialization data in memory
   */
  private async storeInitializationData(): Promise<void> {
    try {
      const { execSync } = require('child_process');
      
      const initData = {
        timestamp: Date.now(),
        config: configManager.exportConfig(),
        environment: process.env.NODE_ENV || 'development',
        processId: process.pid,
        nodeVersion: process.version,
        initCount: this.state.initCount
      };
      
      const memoryKey = `langfuse/init/${Date.now()}`;
      const query = `sqlite3 .swarm/memory.db "INSERT OR REPLACE INTO memory_entries (key, value, namespace, metadata) VALUES ('${memoryKey}', '${JSON.stringify(initData).replace(/'/g, "''")}', 'langfuse_init', '${JSON.stringify({ type: 'initialization' })}')"`;
      
      execSync(query);
    } catch (error) {
      console.warn('Failed to store initialization data:', error);
    }
  }
  
  /**
   * Add a cleanup handler
   */
  addCleanupHandler(handler: () => Promise<void>): void {
    this.cleanupHandlers.push(handler);
  }
  
  /**
   * Run all cleanup handlers
   */
  private async runCleanupHandlers(): Promise<void> {
    const handlers = [...this.cleanupHandlers];
    this.cleanupHandlers = [];
    
    await Promise.all(
      handlers.map(handler => 
        handler().catch(error => 
          console.error('Cleanup handler error:', error)
        )
      )
    );
  }
  
  /**
   * Get singleton state information
   */
  getState(): Readonly<SingletonState> {
    return {
      ...this.state,
      instance: this.state.instance // Reference, not copy
    };
  }
  
  /**
   * Check if singleton is initialized
   */
  isInitialized(): boolean {
    return this.state.initialized && this.state.instance !== null;
  }
  
  /**
   * Get the last initialization error
   */
  getLastError(): Error | null {
    return this.state.lastError;
  }
  
  /**
   * Get initialization statistics
   */
  getStats(): {
    initCount: number;
    shutdownCount: number;
    isInitialized: boolean;
    hasError: boolean;
    activeTraces: number;
    activeSpans: number;
  } {
    return {
      initCount: this.state.initCount,
      shutdownCount: this.state.shutdownCount,
      isInitialized: this.isInitialized(),
      hasError: this.state.lastError !== null,
      activeTraces: this.state.instance?.getActiveTraceCount() || 0,
      activeSpans: this.state.instance?.getActiveSpanCount() || 0
    };
  }
  
  /**
   * Reset the singleton (for testing)
   */
  async reset(): Promise<void> {
    await this.shutdown();
    
    this.state = {
      instance: null,
      initialized: false,
      initializationPromise: null,
      shutdownPromise: null,
      lastError: null,
      initCount: 0,
      shutdownCount: 0
    };
    
    this.cleanupHandlers = [];
    this.initLock.clear();
    this.swarmTracer = null;
  }
}

// Create singleton instance
const singleton = new LangfuseSingleton();

// Export singleton manager
export const langfuseSingleton = singleton;

/**
 * Convenience function to get Langfuse wrapper instance
 */
export async function getLangfuseInstance(
  options?: SingletonInitOptions
): Promise<LangfuseWrapper> {
  return singleton.getInstance(options);
}

/**
 * Convenience function to get full Langfuse instance with all components
 */
export async function getLangfuseFullInstance(
  options?: SingletonInitOptions
): Promise<LangfuseInstance> {
  return singleton.getFullInstance(options);
}

/**
 * Convenience function to shutdown Langfuse
 */
export async function shutdownLangfuse(): Promise<void> {
  return singleton.shutdown();
}

/**
 * Convenience wrapper functions that use the singleton
 */
export const langfuse = {
  /**
   * Start a trace (pre-hook)
   */
  async trace(context: HookContext): Promise<string | null> {
    try {
      const instance = await getLangfuseInstance();
      return instance.preHook(context);
    } catch (error) {
      console.error('Failed to start trace:', error);
      return null;
    }
  },
  
  /**
   * Complete a trace (post-hook)
   */
  async completeTrace(
    traceId: string | null,
    result: any,
    tokenUsage?: TokenUsage,
    metadata?: Record<string, any>
  ): Promise<void> {
    if (!traceId) return;
    
    try {
      const instance = await getLangfuseInstance();
      await instance.postHook(traceId, result, tokenUsage, metadata);
    } catch (error) {
      console.error('Failed to complete trace:', error);
    }
  },
  
  /**
   * Record an error (error-hook)
   */
  async recordError(
    traceId: string | null,
    error: Error,
    metadata?: Record<string, any>
  ): Promise<void> {
    if (!traceId) return;
    
    try {
      const instance = await getLangfuseInstance();
      await instance.errorHook(traceId, error, metadata);
    } catch (err) {
      console.error('Failed to record error:', err);
    }
  },
  
  /**
   * Create a custom span
   */
  async span(
    traceId: string,
    name: string,
    input?: any,
    metadata?: Record<string, any>
  ): Promise<string | null> {
    try {
      const instance = await getLangfuseInstance();
      return instance.createSpan(traceId, name, input, metadata);
    } catch (error) {
      console.error('Failed to create span:', error);
      return null;
    }
  },
  
  /**
   * End a custom span
   */
  async endSpan(
    spanId: string,
    output?: any,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const instance = await getLangfuseInstance();
      await instance.endSpan(spanId, output, metadata);
    } catch (error) {
      console.error('Failed to end span:', error);
    }
  },
  
  /**
   * Check if Langfuse is enabled
   */
  async isEnabled(): Promise<boolean> {
    try {
      const instance = await getLangfuseInstance();
      return instance.isEnabled();
    } catch {
      return false;
    }
  },
  
  /**
   * Get singleton state
   */
  getState(): Readonly<SingletonState> {
    return singleton.getState();
  },
  
  /**
   * Get singleton stats
   */
  getStats(): ReturnType<typeof singleton.getStats> {
    return singleton.getStats();
  },
  
  /**
   * Shutdown the singleton
   */
  shutdown: shutdownLangfuse
};

// Export types
export type { SingletonState };
export type { SingletonEvents };

// Legacy compatibility exports
export async function initializeLangfuse(config?: Partial<LangfuseConfig>): Promise<LangfuseInstance> {
  return singleton.getFullInstance({ config });
}

export function getLangfuse(): LangfuseInstance | null {
  if (!singleton.isInitialized()) {
    return null;
  }
  
  // Try to get the full instance synchronously
  const state = singleton.getState();
  if (state.instance && singleton['swarmTracer']) {
    return {
      wrapper: state.instance,
      swarmTracer: singleton['swarmTracer'],
      contextManager: traceContextManager,
      configManager,
      errorHandler: getErrorHandlerSingleton()
    };
  }
  
  return null;
}

export async function getOrCreateLangfuse(): Promise<LangfuseInstance> {
  return singleton.getFullInstance();
}

// Export individual components for direct access
export function getLangfuseWrapper(): LangfuseWrapper | null {
  const state = singleton.getState();
  return state.instance;
}

export function getSwarmTracer(): SwarmTracer | null {
  return singleton['swarmTracer'] || null;
}

export function getTraceContextManager(): TraceContextManager {
  return traceContextManager;
}

export function getConfigManager(): typeof configManager {
  return configManager;
}

// Note: This creates a default error handler for the singleton
// In a real implementation, this would be properly initialized
export function getErrorHandlerSingleton(): ErrorHandler {
  // Return a default error handler instance
  const { SwarmConfig } = require('./interfaces/swarm-config.interface');
  const { initializeErrorHandler } = require('./error-handler');
  
  const defaultConfig: SwarmConfig = {
    enabled: true,
    circuitBreaker: {
      failureThreshold: 5,
      resetTimeout: 60000,
      halfOpenMaxAttempts: 3
    }
  };
  
  return initializeErrorHandler(defaultConfig);
}