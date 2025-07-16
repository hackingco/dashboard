/**
 * MCP Tracer for Claude Flow
 * Instruments MCP (Model Context Protocol) operations with Langfuse tracing
 */

import { traceManager } from './trace-manager.js';
import { tracingConfig } from '../config/tracing-config.js';
import logger from '../utils/logger.js';

export class MCPTracer {
  constructor() {
    this.config = tracingConfig;
    this.traceManager = traceManager;
  }

  /**
   * Trace MCP tool execution
   */
  async traceToolExecution(toolName, args, context = {}) {
    if (!this.config.shouldTraceTest(toolName)) {
      return this.createMockTrace(toolName, args);
    }

    try {
      const trace = await this.traceManager.createTrace({
        name: `mcp.tool.${toolName}`,
        sessionId: context.sessionId,
        userId: context.userId,
        metadata: {
          operation_type: 'mcp_tool',
          tool_name: toolName,
          swarm_id: context.swarmId,
          agent_id: context.agentId,
          agent_type: context.agentType,
          mcp_version: context.mcpVersion || '1.0.0',
          claude_flow_component: 'mcp-server'
        },
        input: {
          tool: toolName,
          arguments: args,
          context: this.sanitizeContext(context)
        },
        tags: ['mcp', 'tool', toolName, context.priority || 'medium']
      });

      // Create execution span
      const executionSpan = await this.traceManager.createSpan(trace.id, {
        name: 'tool.execution',
        metadata: {
          tool_name: toolName,
          execution_phase: 'start'
        },
        input: args
      });

      // Create validation span if needed
      const validationSpan = await this.traceManager.createSpan(trace.id, {
        name: 'tool.validation',
        metadata: {
          tool_name: toolName,
          validation_phase: 'arguments'
        },
        input: { argumentCount: Object.keys(args || {}).length }
      });

      return {
        trace,
        spans: {
          execution: executionSpan,
          validation: validationSpan
        }
      };
    } catch (error) {
      logger.error('Failed to trace MCP tool execution:', error.message);
      return this.createMockTrace(toolName, args);
    }
  }

  /**
   * Trace MCP protocol negotiation
   */
  async traceProtocolNegotiation(protocolInfo, context = {}) {
    if (!this.config.isEnabled('mcp')) {
      return this.createMockTrace('protocol_negotiation', protocolInfo);
    }

    try {
      const trace = await this.traceManager.createTrace({
        name: 'mcp.protocol.negotiation',
        sessionId: context.sessionId,
        metadata: {
          operation_type: 'mcp_protocol',
          protocol_version: protocolInfo.version,
          supported_capabilities: protocolInfo.capabilities,
          client_info: protocolInfo.clientInfo,
          claude_flow_component: 'mcp-server'
        },
        input: protocolInfo,
        tags: ['mcp', 'protocol', 'negotiation']
      });

      // Create capability negotiation span
      const capabilitySpan = await this.traceManager.createSpan(trace.id, {
        name: 'protocol.capabilities',
        metadata: {
          negotiation_phase: 'capabilities',
          capability_count: (protocolInfo.capabilities || []).length
        },
        input: protocolInfo.capabilities
      });

      return { trace, spans: { capability: capabilitySpan } };
    } catch (error) {
      logger.error('Failed to trace protocol negotiation:', error.message);
      return this.createMockTrace('protocol_negotiation', protocolInfo);
    }
  }

  /**
   * Trace MCP session lifecycle
   */
  async traceSessionLifecycle(event, sessionData, context = {}) {
    if (!this.config.isEnabled('mcp')) {
      return this.createMockTrace('session_lifecycle', { event, sessionData });
    }

    try {
      const trace = await this.traceManager.createTrace({
        name: `mcp.session.${event}`,
        sessionId: sessionData.sessionId,
        userId: sessionData.userId,
        metadata: {
          operation_type: 'mcp_session',
          session_event: event,
          session_duration: sessionData.duration,
          session_tools_used: sessionData.toolsUsed || [],
          claude_flow_component: 'mcp-server'
        },
        input: {
          event,
          sessionData: this.sanitizeSessionData(sessionData)
        },
        tags: ['mcp', 'session', event]
      });

      // Create session management span
      const sessionSpan = await this.traceManager.createSpan(trace.id, {
        name: `session.${event}`,
        metadata: {
          session_phase: event,
          session_id: sessionData.sessionId
        },
        input: { event, timestamp: new Date().toISOString() }
      });

      return { trace, spans: { session: sessionSpan } };
    } catch (error) {
      logger.error('Failed to trace session lifecycle:', error.message);
      return this.createMockTrace('session_lifecycle', { event, sessionData });
    }
  }

  /**
   * Trace MCP request routing
   */
  async traceRequestRouting(request, handler, context = {}) {
    if (!this.config.isEnabled('mcp')) {
      return this.createMockTrace('request_routing', request);
    }

    try {
      const trace = await this.traceManager.createTrace({
        name: 'mcp.request.route',
        sessionId: context.sessionId,
        metadata: {
          operation_type: 'mcp_routing',
          request_method: request.method,
          request_path: request.path,
          handler_name: handler.name,
          route_params: request.params,
          claude_flow_component: 'mcp-router'
        },
        input: {
          method: request.method,
          path: request.path,
          params: request.params,
          handler: handler.name
        },
        tags: ['mcp', 'routing', request.method]
      });

      // Create routing decision span
      const routingSpan = await this.traceManager.createSpan(trace.id, {
        name: 'routing.decision',
        metadata: {
          routing_phase: 'handler_selection',
          handler_name: handler.name,
          route_matched: !!handler
        },
        input: { method: request.method, path: request.path }
      });

      return { trace, spans: { routing: routingSpan } };
    } catch (error) {
      logger.error('Failed to trace request routing:', error.message);
      return this.createMockTrace('request_routing', request);
    }
  }

  /**
   * Trace MCP error handling
   */
  async traceError(error, context = {}) {
    if (!this.config.isEnabled('mcp')) {
      return;
    }

    try {
      const trace = await this.traceManager.createTrace({
        name: 'mcp.error',
        sessionId: context.sessionId,
        metadata: {
          operation_type: 'mcp_error',
          error_type: error.name,
          error_message: error.message,
          error_stack: this.config.getConfig().features.errorStack ? error.stack : undefined,
          tool_name: context.toolName,
          recovery_attempted: context.recoveryAttempted || false,
          claude_flow_component: 'mcp-server'
        },
        input: {
          error: {
            name: error.name,
            message: error.message
          },
          context: this.sanitizeContext(context)
        },
        tags: ['mcp', 'error', error.name, 'failure']
      });

      // Create error handling span
      const errorSpan = await this.traceManager.createSpan(trace.id, {
        name: 'error.handling',
        metadata: {
          error_phase: 'processing',
          error_type: error.name,
          recovery_attempted: context.recoveryAttempted || false
        },
        input: {
          error: error.message,
          timestamp: new Date().toISOString()
        }
      });

      return { trace, spans: { error: errorSpan } };
    } catch (traceError) {
      logger.error('Failed to trace MCP error:', traceError.message);
    }
  }

  /**
   * End tool execution trace
   */
  async endToolExecution(traceData, result, error = null) {
    if (!traceData || traceData.trace?.mock) {
      return;
    }

    try {
      const { trace, spans } = traceData;
      
      // End spans
      if (spans.validation) {
        await this.traceManager.endSpan(spans.validation.id, null, {
          validation_status: error ? 'failed' : 'passed',
          validation_errors: error ? [error.message] : []
        });
      }

      if (spans.execution) {
        await this.traceManager.endSpan(spans.execution.id, result, {
          execution_status: error ? 'failed' : 'completed',
          execution_error: error ? error.message : undefined,
          result_size: result ? JSON.stringify(result).length : 0
        });
      }

      // End trace
      await this.traceManager.endTrace(trace.id, result, {
        execution_status: error ? 'failed' : 'completed',
        error_message: error ? error.message : undefined,
        result_type: result ? typeof result : 'undefined'
      });

      logger.debug('Ended MCP tool execution trace', {
        traceId: trace.id,
        toolName: trace.metadata?.tool_name,
        status: error ? 'failed' : 'completed'
      });
    } catch (endError) {
      logger.error('Failed to end tool execution trace:', endError.message);
    }
  }

  /**
   * End protocol negotiation trace
   */
  async endProtocolNegotiation(traceData, result, error = null) {
    if (!traceData || traceData.trace?.mock) {
      return;
    }

    try {
      const { trace, spans } = traceData;
      
      // End capability span
      if (spans.capability) {
        await this.traceManager.endSpan(spans.capability.id, result, {
          negotiation_status: error ? 'failed' : 'completed',
          negotiation_error: error ? error.message : undefined,
          agreed_capabilities: result?.capabilities || []
        });
      }

      // End trace
      await this.traceManager.endTrace(trace.id, result, {
        negotiation_status: error ? 'failed' : 'completed',
        protocol_version: result?.version,
        error_message: error ? error.message : undefined
      });

      logger.debug('Ended protocol negotiation trace', {
        traceId: trace.id,
        status: error ? 'failed' : 'completed'
      });
    } catch (endError) {
      logger.error('Failed to end protocol negotiation trace:', endError.message);
    }
  }

  /**
   * End session lifecycle trace
   */
  async endSessionLifecycle(traceData, result, error = null) {
    if (!traceData || traceData.trace?.mock) {
      return;
    }

    try {
      const { trace, spans } = traceData;
      
      // End session span
      if (spans.session) {
        await this.traceManager.endSpan(spans.session.id, result, {
          session_status: error ? 'failed' : 'completed',
          session_error: error ? error.message : undefined,
          final_state: result?.state
        });
      }

      // End trace
      await this.traceManager.endTrace(trace.id, result, {
        session_status: error ? 'failed' : 'completed',
        error_message: error ? error.message : undefined,
        session_final_state: result?.state
      });

      logger.debug('Ended session lifecycle trace', {
        traceId: trace.id,
        sessionId: trace.sessionId,
        status: error ? 'failed' : 'completed'
      });
    } catch (endError) {
      logger.error('Failed to end session lifecycle trace:', endError.message);
    }
  }

  /**
   * Sanitize context data
   */
  sanitizeContext(context) {
    const sanitized = { ...context };
    
    // Remove sensitive fields
    const sensitiveFields = ['password', 'token', 'key', 'secret', 'auth'];
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '***redacted***';
      }
    }
    
    return sanitized;
  }

  /**
   * Sanitize session data
   */
  sanitizeSessionData(sessionData) {
    const sanitized = { ...sessionData };
    
    // Remove sensitive session information
    if (sanitized.credentials) {
      sanitized.credentials = '***redacted***';
    }
    
    if (sanitized.tokens) {
      sanitized.tokens = '***redacted***';
    }
    
    return sanitized;
  }

  /**
   * Create mock trace for when tracing is disabled
   */
  createMockTrace(operation, data) {
    return {
      trace: {
        id: `mock-mcp-${Date.now()}`,
        name: `mcp.${operation}`,
        mock: true,
        timestamp: new Date().toISOString()
      },
      spans: {
        execution: {
          id: `mock-span-${Date.now()}`,
          name: `${operation}.execution`,
          mock: true,
          timestamp: new Date().toISOString()
        }
      }
    };
  }

  /**
   * Get MCP tracing statistics
   */
  getStats() {
    return {
      enabled: this.config.isEnabled('mcp'),
      activeTraces: this.traceManager.getActiveTraceCount(),
      activeSpans: this.traceManager.getActiveSpanCount(),
      componentConfig: this.config.getComponentConfig('mcp')
    };
  }
}

// Create singleton instance
export const mcpTracer = new MCPTracer();

// Export convenience functions
export const traceToolExecution = (toolName, args, context) => 
  mcpTracer.traceToolExecution(toolName, args, context);

export const traceProtocolNegotiation = (protocolInfo, context) => 
  mcpTracer.traceProtocolNegotiation(protocolInfo, context);

export const traceSessionLifecycle = (event, sessionData, context) => 
  mcpTracer.traceSessionLifecycle(event, sessionData, context);

export const traceRequestRouting = (request, handler, context) => 
  mcpTracer.traceRequestRouting(request, handler, context);

export const traceError = (error, context) => 
  mcpTracer.traceError(error, context);

export const endToolExecution = (traceData, result, error) => 
  mcpTracer.endToolExecution(traceData, result, error);

export const endProtocolNegotiation = (traceData, result, error) => 
  mcpTracer.endProtocolNegotiation(traceData, result, error);

export const endSessionLifecycle = (traceData, result, error) => 
  mcpTracer.endSessionLifecycle(traceData, result, error);