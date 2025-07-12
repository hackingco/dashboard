import { exec } from 'child_process';
import { promisify } from 'util';
import logger from './logger';
import { langfuseService, LangfuseService } from './langfuse/langfuse.service';
import { trustGraphService, TrustGraphService } from './trustgraph/trustgraph.service';
import { supabaseRealtimeService } from './supabase-realtime.service';
import { Swarm, Worker } from '@swarm/types';
import { performance } from 'perf_hooks';
import { v4 as uuidv4 } from 'uuid';

const execAsync = promisify(exec);

export interface FlyAPIMetrics {
  operation: string;
  duration_ms: number;
  tokens_consumed: number;
  cost: number;
  success: boolean;
  error?: string;
  machine_id?: string;
  app_name?: string;
}

export interface ObservabilityContext {
  trace_id: string;
  span_id: string;
  correlation_id: string;
  swarm_id?: string;
  machine_id?: string;
  operation_type: string;
}

/**
 * Enhanced Fly.io service with comprehensive observability integration
 * Wraps all Fly API calls with Langfuse spans and TrustGraph node emission
 */
export class FlyObservabilityService {
  private flyApiToken: string;
  private flyApiUrl: string = 'https://api.machines.dev/v1';
  private langfuse: LangfuseService;
  private trustGraph: TrustGraphService;
  private activeOperations: Map<string, ObservabilityContext> = new Map();
  private metrics: FlyAPIMetrics[] = [];
  private maxMetricsRetention: number = 1000;

  constructor() {
    this.flyApiToken = process.env.FLY_API_TOKEN || '';
    this.langfuse = langfuseService;
    this.trustGraph = trustGraphService;
    
    if (!this.flyApiToken) {
      logger.warn('FLY_API_TOKEN not set - Fly.io operations will fail');
    }
  }

  /**
   * Wraps any Fly.io operation with full observability tracing
   */
  private async wrapWithObservability<T>(
    operation: string,
    appName: string,
    machineId: string | undefined,
    swarmId: string | undefined,
    fn: (context: ObservabilityContext) => Promise<T>
  ): Promise<T> {
    const correlationId = uuidv4();
    const startTime = performance.now();
    
    // Start Langfuse trace
    const traceId = this.langfuse.startTrace(`fly_${operation}`, {
      app_name: appName,
      machine_id: machineId,
      swarm_id: swarmId,
      correlation_id: correlationId
    });

    // Start Langfuse span
    const spanId = `span_${operation}_${Date.now()}`;
    this.langfuse.startSpan(spanId, `Fly.io ${operation}`, traceId, {
      app_name: appName,
      machine_id: machineId,
      swarm_id: swarmId
    });

    // Create observability context
    const context: ObservabilityContext = {
      trace_id: traceId,
      span_id: spanId,
      correlation_id: correlationId,
      swarm_id: swarmId,
      machine_id: machineId,
      operation_type: operation
    };

    this.activeOperations.set(correlationId, context);

    // Create TrustGraph node for the operation
    await this.trustGraph.createNode({
      id: `fly_${operation}_${correlationId}`,
      type: 'api',
      label: `Fly.io ${operation}`,
      metadata: {
        app_name: appName,
        machine_id: machineId,
        swarm_id: swarmId,
        correlation_id: correlationId,
        operation: operation
      }
    });

    // Create database span record
    await this.createDatabaseSpan(context, appName, {
      app_name: appName,
      machine_id: machineId,
      operation: operation
    });

    try {
      // Execute the actual operation
      const result = await fn(context);
      
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Complete the spans with success
      await this.completeObservability(context, {
        success: true,
        duration_ms: duration,
        result: result
      });

      // Store metrics
      this.recordMetrics({
        operation,
        duration_ms: duration,
        tokens_consumed: this.estimateTokenUsage(operation),
        cost: this.estimateCost(operation, duration),
        success: true,
        machine_id: machineId,
        app_name: appName
      });

      return result;

    } catch (error: any) {
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Complete the spans with error
      await this.completeObservability(context, {
        success: false,
        duration_ms: duration,
        error: error.message
      });

      // Store error metrics
      this.recordMetrics({
        operation,
        duration_ms: duration,
        tokens_consumed: this.estimateTokenUsage(operation),
        cost: this.estimateCost(operation, duration),
        success: false,
        error: error.message,
        machine_id: machineId,
        app_name: appName
      });

      throw error;
    } finally {
      this.activeOperations.delete(correlationId);
    }
  }

  private async createDatabaseSpan(
    context: ObservabilityContext,
    appName: string,
    requestPayload: any
  ): Promise<void> {
    try {
      const { error } = await supabaseRealtimeService.getClient()
        .rpc('create_langfuse_fly_span', {
          p_trace_id: context.trace_id,
          p_operation_type: context.operation_type,
          p_fly_app_name: appName,
          p_machine_id: context.machine_id,
          p_swarm_id: context.swarm_id,
          p_request_payload: requestPayload
        });

      if (error) {
        logger.error('Failed to create database span', { error });
      }
    } catch (error) {
      logger.error('Error creating database span', { error });
    }
  }

  private async completeObservability(
    context: ObservabilityContext,
    result: {
      success: boolean;
      duration_ms: number;
      result?: any;
      error?: string;
    }
  ): Promise<void> {
    try {
      // Complete Langfuse span
      this.langfuse.endSpan(
        context.span_id,
        result.success ? result.result : undefined,
        result.error ? new Error(result.error) : undefined
      );

      // End Langfuse trace
      await this.langfuse.endTrace(context.trace_id, {
        duration_ms: result.duration_ms,
        success: result.success,
        tokens_consumed: this.estimateTokenUsage(context.operation_type),
        cost: this.estimateCost(context.operation_type, result.duration_ms)
      });

      // Complete database span
      await supabaseRealtimeService.getClient()
        .rpc('complete_langfuse_fly_span', {
          p_span_id: context.span_id,
          p_response_payload: result.success ? result.result : null,
          p_tokens_consumed: this.estimateTokenUsage(context.operation_type),
          p_error_message: result.error,
          p_error_code: result.success ? null : 'FLY_API_ERROR'
        });

      // Emit TrustGraph WebSocket node if this is a state-changing operation
      if (this.isStateChangingOperation(context.operation_type) && context.swarm_id) {
        await supabaseRealtimeService.getClient()
          .rpc('emit_trustgraph_ws_node', {
            p_swarm_id: context.swarm_id,
            p_node_type: 'api_call',
            p_ws_event_type: `fly_${context.operation_type}`,
            p_ws_channel: `swarm:${context.swarm_id}:fly_operations`,
            p_ws_payload: {
              operation: context.operation_type,
              success: result.success,
              duration_ms: result.duration_ms,
              machine_id: context.machine_id,
              correlation_id: context.correlation_id
            },
            p_correlation_id: context.correlation_id
          });
      }

    } catch (error) {
      logger.error('Error completing observability', { error, context });
    }
  }

  private isStateChangingOperation(operation: string): boolean {
    return [
      'create_machine',
      'create_app',
      'scale_app',
      'delete_app',
      'deploy_app'
    ].includes(operation);
  }

  private estimateTokenUsage(operation: string): number {
    // Simple estimation based on operation complexity
    const tokenMap: Record<string, number> = {
      'create_machine': 150,
      'create_app': 100,
      'get_status': 50,
      'scale_app': 75,
      'get_logs': 200,
      'delete_app': 75,
      'deploy_app': 300,
      'list_machines': 100
    };
    return tokenMap[operation] || 50;
  }

  private estimateCost(operation: string, durationMs: number): number {
    // Base cost per operation + time-based cost
    const baseCost = 0.001; // $0.001 per API call
    const timeCost = (durationMs / 1000) * 0.0001; // $0.0001 per second
    const tokenCost = this.estimateTokenUsage(operation) * 0.00001; // $0.00001 per token
    
    return baseCost + timeCost + tokenCost;
  }

  private recordMetrics(metrics: FlyAPIMetrics): void {
    this.metrics.push(metrics);
    
    // Keep only recent metrics to prevent memory issues
    if (this.metrics.length > this.maxMetricsRetention) {
      this.metrics = this.metrics.slice(-this.maxMetricsRetention);
    }

    this.langfuse.emit('metrics:recorded', metrics);
  }

  // Enhanced Fly.io API methods with observability

  async createApp(
    appName: string, 
    org = 'personal',
    swarmId?: string
  ): Promise<void> {
    return this.wrapWithObservability(
      'create_app',
      appName,
      undefined,
      swarmId,
      async (context) => {
        try {
          const { stdout, stderr } = await execAsync(
            `fly apps create ${appName} --org ${org}`,
            { env: { ...process.env, FLY_API_TOKEN: this.flyApiToken } }
          );
          
          logger.info(`Created Fly app: ${appName}`, { 
            stdout, 
            stderr, 
            correlation_id: context.correlation_id 
          });
          
          logger.info(`App ${appName} created successfully`);
          return;
        } catch (error: any) {
          if (error.message.includes('already exists')) {
            logger.info(`App ${appName} already exists`, { 
              correlation_id: context.correlation_id 
            });
            logger.info(`App ${appName} already exists`);
            return;
          } else {
            throw error;
          }
        }
      }
    );
  }

  async createMachine(
    appName: string, 
    config: any,
    swarmId?: string
  ): Promise<any> {
    return this.wrapWithObservability(
      'create_machine',
      appName,
      undefined,
      swarmId,
      async (context) => {
        // Validate configuration
        if (!config.swarmId && !swarmId) {
          throw new Error('swarmId is required for machine creation');
        }

        if (!this.flyApiToken) {
          throw new Error('FLY_API_TOKEN is not configured');
        }

        // Create machine configuration with observability metadata
        const machineConfig = {
          name: `${appName}-worker`,
          region: config.region || 'dfw',
          config: {
            image: config.dockerImage || 'flyio/hellofly:latest',
            env: {
              NODE_ENV: 'production',
              WORKER_TYPE: config.workerType || 'general',
              SWARM_ID: config.swarmId || swarmId,
              REDIS_URL: process.env.REDIS_URL || '',
              
              // Observability environment variables
              LANGFUSE_SECRET_KEY: config.env?.LANGFUSE_SECRET_KEY || process.env.LANGFUSE_SECRET_KEY || '',
              LANGFUSE_PUBLIC_KEY: config.env?.LANGFUSE_PUBLIC_KEY || process.env.LANGFUSE_PUBLIC_KEY || '',
              LANGFUSE_HOST: config.env?.LANGFUSE_HOST || process.env.LANGFUSE_HOST || 'https://cloud.langfuse.com',
              TRUSTGRAPH_API_KEY: config.env?.TRUSTGRAPH_API_KEY || process.env.TRUSTGRAPH_API_KEY || '',
              TRUSTGRAPH_API_URL: config.env?.TRUSTGRAPH_API_URL || process.env.TRUSTGRAPH_API_URL || '',
              
              // Correlation tracking
              CORRELATION_ID: context.correlation_id,
              LANGFUSE_TRACE_ID: context.trace_id,
              
              // Supabase connection
              SUPABASE_URL: process.env.SUPABASE_URL || '',
              SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
              
              ...config.env,
            },
            services: [{
              ports: [
                { port: 80, handlers: ['http'] },
                { port: 443, handlers: ['tls', 'http'] }
              ],
              protocol: 'tcp',
              internal_port: 3000,
            }],
            guest: {
              cpu_kind: 'shared',
              cpus: config.cpus || 1,
              memory_mb: config.memory || 256,
            },
          },
        };

        // Make the API request
        const machine = await this.flyApiRequest('POST', `/apps/${appName}/machines`, machineConfig);
        
        // Create machine state record in database
        if (swarmId || config.swarmId) {
          await supabaseRealtimeService.createMachineState({
            swarm_id: swarmId || config.swarmId,
            machine_id: machine.id,
            status: 'initializing',
            region: machine.region || machineConfig.region,
            fly_app_name: appName,
            config: machineConfig,
            cpu_count: config.cpus || 1,
            memory_mb: config.memory || 256,
            langfuse_trace_id: context.trace_id
          });
        }

        logger.info(`Created machine for app: ${appName}`, { 
          machineId: machine.id,
          region: machine.region,
          state: machine.state,
          correlation_id: context.correlation_id,
          trace_id: context.trace_id
        });
        
        return {
          id: machine.id,
          state: machine.state,
          region: machine.region,
          instance_id: machine.instance_id,
          private_ip: machine.private_ip,
          created_at: machine.created_at,
          correlation_id: context.correlation_id,
          trace_id: context.trace_id,
          config: {
            cpus: config.cpus || 1,
            memory: config.memory || 256,
            image: config.dockerImage || 'flyio/hellofly:latest',
          }
        };
      }
    );
  }

  async deployApp(
    appName: string, 
    config: any,
    swarmId?: string
  ): Promise<any> {
    return this.wrapWithObservability(
      'deploy_app',
      appName,
      undefined,
      swarmId,
      async (context) => {
        const machine = await this.createMachine(appName, config, swarmId);
        logger.info(`Deployed app: ${appName} using Machines API`, {
          correlation_id: context.correlation_id
        });
        return machine;
      }
    );
  }

  async scaleApp(
    appName: string, 
    count: number,
    swarmId?: string
  ): Promise<void> {
    await this.wrapWithObservability(
      'scale_app',
      appName,
      undefined,
      swarmId,
      async (context) => {
        const { stdout, stderr } = await execAsync(
          `fly scale count ${count} --app ${appName}`,
          { env: { ...process.env, FLY_API_TOKEN: this.flyApiToken } }
        );
        
        logger.info(`Scaled app ${appName} to ${count} instances`, { 
          stdout, 
          stderr,
          correlation_id: context.correlation_id
        });
        
        return { app_name: appName, count, stdout, stderr };
      }
    );
  }

  async getAppStatus(
    appName: string,
    swarmId?: string
  ): Promise<any> {
    return this.wrapWithObservability(
      'get_status',
      appName,
      undefined,
      swarmId,
      async (context) => {
        const { stdout } = await execAsync(
          `fly status --app ${appName} --json`,
          { env: { ...process.env, FLY_API_TOKEN: this.flyApiToken } }
        );
        
        const status = JSON.parse(stdout);
        
        // Update machine states if we have swarm context
        if (swarmId && status.Allocations) {
          for (const allocation of status.Allocations) {
            await supabaseRealtimeService.updateMachineState(
              allocation.ID,
              {
                status: allocation.Status?.toLowerCase() || 'unknown',
                health_status: allocation.Checks?.[0]?.Status === 'passing' ? 'healthy' : 'unhealthy',
                last_heartbeat: new Date().toISOString()
              }
            );
          }
        }
        
        return status;
      }
    );
  }

  async getAppLogs(
    appName: string, 
    lines = 100,
    swarmId?: string
  ): Promise<string[]> {
    return this.wrapWithObservability(
      'get_logs',
      appName,
      undefined,
      swarmId,
      async (context) => {
        const { stdout } = await execAsync(
          `fly logs --app ${appName} -n ${lines}`,
          { env: { ...process.env, FLY_API_TOKEN: this.flyApiToken } }
        );
        
        return stdout.split('\n').filter(line => line.trim());
      }
    );
  }

  async getMachineMetadata(
    appName: string, 
    machineId: string,
    swarmId?: string
  ): Promise<any> {
    return this.wrapWithObservability(
      'get_machine_metadata',
      appName,
      machineId,
      swarmId,
      async (context) => {
        const machine = await this.flyApiRequest('GET', `/apps/${appName}/machines/${machineId}`);
        
        // Update machine state in database
        if (swarmId) {
          await supabaseRealtimeService.updateMachineState(
            machineId,
            {
              status: machine.state?.toLowerCase() || 'unknown',
              private_ip: machine.private_ip,
              last_heartbeat: new Date().toISOString(),
              config: machine.config
            }
          );
        }
        
        logger.info(`Retrieved machine metadata`, { 
          appName, 
          machineId,
          correlation_id: context.correlation_id
        });
        
        return {
          id: machine.id,
          state: machine.state,
          region: machine.region,
          instance_id: machine.instance_id,
          private_ip: machine.private_ip,
          created_at: machine.created_at,
          updated_at: machine.updated_at,
          config: machine.config,
          events: machine.events,
          correlation_id: context.correlation_id
        };
      }
    );
  }

  async listMachines(
    appName: string,
    swarmId?: string
  ): Promise<any[]> {
    return this.wrapWithObservability(
      'list_machines',
      appName,
      undefined,
      swarmId,
      async (context) => {
        const machines = await this.flyApiRequest('GET', `/apps/${appName}/machines`);
        
        logger.info(`Listed machines for app: ${appName}`, { 
          count: machines.length,
          correlation_id: context.correlation_id
        });
        
        return machines.map((machine: any) => ({
          ...machine,
          correlation_id: context.correlation_id
        }));
      }
    );
  }

  async deleteApp(
    appName: string,
    swarmId?: string
  ): Promise<void> {
    await this.wrapWithObservability(
      'delete_app',
      appName,
      undefined,
      swarmId,
      async (context) => {
        const { stdout, stderr } = await execAsync(
          `fly apps destroy ${appName} --yes`,
          { env: { ...process.env, FLY_API_TOKEN: this.flyApiToken } }
        );
        
        logger.info(`Deleted app: ${appName}`, { 
          stdout, 
          stderr,
          correlation_id: context.correlation_id
        });
        
        return { app_name: appName, stdout, stderr };
      }
    );
  }

  // Private helper method for API requests
  private async flyApiRequest(method: string, path: string, body?: any): Promise<any> {
    const response = await fetch(`${this.flyApiUrl}${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${this.flyApiToken}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Fly API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  // Utility methods
  swarmToFlyApp(swarm: Swarm): string {
    return `swarm-${swarm.name.toLowerCase().replace(/\s+/g, '-')}-${swarm.id.slice(0, 8)}`;
  }

  async listSwarmApps(): Promise<string[]> {
    try {
      const { stdout } = await execAsync(
        `fly apps list --json`,
        { env: { ...process.env, FLY_API_TOKEN: this.flyApiToken } }
      );
      const apps = JSON.parse(stdout);
      return apps
        .filter((app: any) => app.Name.startsWith('swarm-'))
        .map((app: any) => app.Name);
    } catch (error) {
      logger.error('Failed to list Fly apps', { error });
      return [];
    }
  }

  // Metrics and observability queries
  getMetrics(timeRange?: { start: Date; end: Date }): FlyAPIMetrics[] {
    let metrics = [...this.metrics];
    
    if (timeRange) {
      // Filter by creation time (approximate)
      const now = Date.now();
      metrics = metrics.filter((m, index) => {
        const metricTime = now - (this.metrics.length - index) * 1000; // Rough estimate
        return metricTime >= timeRange.start.getTime() && metricTime <= timeRange.end.getTime();
      });
    }
    
    return metrics;
  }

  getActiveOperations(): ObservabilityContext[] {
    return Array.from(this.activeOperations.values());
  }

  getMetricsSummary(): {
    totalOperations: number;
    successRate: number;
    averageDuration: number;
    totalCost: number;
    operationBreakdown: Record<string, number>;
  } {
    if (this.metrics.length === 0) {
      return {
        totalOperations: 0,
        successRate: 0,
        averageDuration: 0,
        totalCost: 0,
        operationBreakdown: {}
      };
    }

    const totalOperations = this.metrics.length;
    const successfulOps = this.metrics.filter(m => m.success).length;
    const successRate = successfulOps / totalOperations;
    const averageDuration = this.metrics.reduce((sum, m) => sum + m.duration_ms, 0) / totalOperations;
    const totalCost = this.metrics.reduce((sum, m) => sum + m.cost, 0);
    
    const operationBreakdown: Record<string, number> = {};
    this.metrics.forEach(m => {
      operationBreakdown[m.operation] = (operationBreakdown[m.operation] || 0) + 1;
    });

    return {
      totalOperations,
      successRate,
      averageDuration,
      totalCost,
      operationBreakdown
    };
  }

  async exportObservabilityData(): Promise<{
    metrics: FlyAPIMetrics[];
    activeOperations: ObservabilityContext[];
    summary: any;
  }> {
    return {
      metrics: this.metrics,
      activeOperations: this.getActiveOperations(),
      summary: this.getMetricsSummary()
    };
  }
}

// Export singleton instance
export const flyObservabilityService = new FlyObservabilityService();