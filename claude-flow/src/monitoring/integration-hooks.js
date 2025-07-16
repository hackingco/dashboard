import { realTimeMonitor } from './real-time-monitor.js';
import { eventCollector } from './event-collector.js';
import { trace } from '../instrumentation/index.js';

/**
 * Integration hooks for connecting monitoring with existing Claude Flow infrastructure
 */

// Hook into Docker agent events
export function hookDockerAgents(dockerManager) {
  dockerManager.on('container.started', (data) => {
    realTimeMonitor.addEvent('docker', 'container-started', data);
  });

  dockerManager.on('container.stopped', (data) => {
    realTimeMonitor.addEvent('docker', 'container-stopped', data);
  });

  dockerManager.on('container.error', (data) => {
    realTimeMonitor.addEvent('docker', 'container-error', data);
  });
}

// Hook into Redis coordination events
export function hookRedisCoordination(redisClient) {
  // Monitor Redis pub/sub for agent coordination
  redisClient.on('message', (channel, message) => {
    try {
      const data = JSON.parse(message);
      realTimeMonitor.addEvent('redis', channel, data);
    } catch (error) {
      realTimeMonitor.addEvent('redis', 'parse-error', { channel, error: error.message });
    }
  });

  // Subscribe to coordination channels
  redisClient.subscribe('agent:status');
  redisClient.subscribe('task:assignment');
  redisClient.subscribe('task:progress');
  redisClient.subscribe('swarm:coordination');
}

// Hook into Langfuse tracing events
export function hookLangfuseTracing(langfuseClient) {
  // Intercept trace creation
  const originalTrace = langfuseClient.trace.bind(langfuseClient);
  langfuseClient.trace = function(params) {
    realTimeMonitor.addEvent('langfuse', 'trace-created', {
      name: params.name,
      sessionId: params.sessionId,
      metadata: params.metadata
    });
    return originalTrace(params);
  };

  // Intercept generation events
  const originalGeneration = langfuseClient.generation?.bind(langfuseClient);
  if (originalGeneration) {
    langfuseClient.generation = function(params) {
      realTimeMonitor.addEvent('langfuse', 'generation-created', {
        name: params.name,
        level: params.level || 'INFO'
      });
      return originalGeneration(params);
    };
  }
}

// Hook into MCP server events
export function hookMCPServer(mcpServer) {
  // Monitor tool calls
  const originalHandleToolCall = mcpServer.handleToolCall.bind(mcpServer);
  mcpServer.handleToolCall = async function(name, args) {
    const startTime = Date.now();
    
    realTimeMonitor.addEvent('mcp', 'tool-call-start', {
      tool: name,
      args: args
    });

    try {
      const result = await originalHandleToolCall(name, args);
      const duration = Date.now() - startTime;
      
      realTimeMonitor.addEvent('mcp', 'tool-call-success', {
        tool: name,
        duration,
        hasResult: !!result
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      realTimeMonitor.addEvent('mcp', 'tool-call-error', {
        tool: name,
        duration,
        error: error.message
      });
      
      throw error;
    }
  };
}

// Hook into task orchestration
export function hookTaskOrchestration(orchestrator) {
  orchestrator.on('task.created', (task) => {
    realTimeMonitor.addEvent('orchestrator', 'task-created', task);
  });

  orchestrator.on('task.distributed', (distribution) => {
    realTimeMonitor.addEvent('orchestrator', 'task-distributed', distribution);
  });

  orchestrator.on('agent.assigned', (assignment) => {
    realTimeMonitor.addEvent('orchestrator', 'agent-assigned', assignment);
  });

  orchestrator.on('swarm.reconfigured', (config) => {
    realTimeMonitor.addEvent('orchestrator', 'swarm-reconfigured', config);
  });
}

// Hook into HTTP requests for API monitoring
export function createAPIMonitoringMiddleware() {
  return (req, res, next) => {
    const startTime = Date.now();
    const originalSend = res.send;
    const originalJson = res.json;

    // Track response
    const trackResponse = (body) => {
      const duration = Date.now() - startTime;
      const status = res.statusCode;
      
      realTimeMonitor.addEvent('api', 'request', {
        method: req.method,
        path: req.path,
        status,
        duration,
        ip: req.ip,
        userAgent: req.get('user-agent')
      });

      if (status >= 400) {
        realTimeMonitor.addEvent('api', 'error', {
          method: req.method,
          path: req.path,
          status,
          duration,
          error: body
        });
      }
    };

    res.send = function(body) {
      trackResponse(body);
      return originalSend.call(this, body);
    };

    res.json = function(body) {
      trackResponse(body);
      return originalJson.call(this, body);
    };

    next();
  };
}

// Initialize all monitoring integrations
export const initializeMonitoringIntegrations = trace(async (components) => {
  const { 
    dockerManager, 
    redisClient, 
    langfuseClient, 
    mcpServer, 
    orchestrator,
    app
  } = components;

  // Hook into various components
  if (dockerManager) hookDockerAgents(dockerManager);
  if (redisClient) hookRedisCoordination(redisClient);
  if (langfuseClient) hookLangfuseTracing(langfuseClient);
  if (mcpServer) hookMCPServer(mcpServer);
  if (orchestrator) hookTaskOrchestration(orchestrator);
  if (app) app.use(createAPIMonitoringMiddleware());

  // Start event collection
  eventCollector.start();

  return {
    success: true,
    integrations: {
      docker: !!dockerManager,
      redis: !!redisClient,
      langfuse: !!langfuseClient,
      mcp: !!mcpServer,
      orchestrator: !!orchestrator,
      api: !!app
    }
  };
});