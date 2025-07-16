/**
 * Claude-Flow v2.0.0
 * Advanced AI coordination system with swarm orchestration
 */

export { SwarmOrchestrator } from './agents/orchestrator.js';
export { MCPServer } from './mcp/server.js';
export { HooksManager } from './hooks/manager.js';
export { MemoryStore } from './memory/store.js';
export { DatabaseManager } from './db/manager.js';
export { AgentCoordinator } from './agents/coordinator.js';
export { TaskScheduler } from './agents/scheduler.js';
export { TracingManager, TracingConfig, LangfuseClient, Instrumentation, tracing } from './tracing/index.js';
export * from './utils/index.js';

// Version info
export const VERSION = '2.0.0';
export const API_VERSION = 'v2';

// Default configuration
export const DEFAULT_CONFIG = {
  swarm: {
    defaultTopology: 'hierarchical',
    defaultMaxAgents: 8,
    defaultStrategy: 'adaptive'
  },
  memory: {
    defaultNamespace: 'default',
    defaultTTL: 86400, // 24 hours
    maxMemorySize: 100 * 1024 * 1024 // 100MB
  },
  mcp: {
    defaultPort: 3000,
    defaultMode: 'stdio',
    timeout: 30000
  },
  hooks: {
    enableAutoFormat: true,
    enableTelemetry: true,
    enablePerformanceTracking: true
  },
  tracing: {
    enabled: true,
    instrumentMCP: true,
    instrumentSwarm: true,
    instrumentHooks: true,
    instrumentMemory: true,
    sampleRate: 1.0,
    flushAt: 10,
    flushInterval: 1000
  }
};