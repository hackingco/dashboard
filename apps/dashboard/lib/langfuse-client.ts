/**
 * Langfuse API Client for Live Dashboard Integration
 * Provides real-time connection to Langfuse for trace streaming and metrics
 */

import { Langfuse } from 'langfuse';
import { EventEmitter } from 'events';

// Types for live tracing data
export interface LiveTrace {
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
}

export interface LiveAgent {
  id: string;
  name: string;
  status: 'active' | 'idle' | 'error' | 'offline';
  currentTask?: string;
  tasksCompleted: number;
  averageResponseTime: number;
  memoryUsage: number;
  cpuUsage: number;
  lastActivity: Date;
  swarmId?: string;
  metadata?: Record<string, any>;
}

export interface SwarmMetrics {
  totalTraces: number;
  activeTraces: number;
  totalAgents: number;
  activeAgents: number;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageResponseTime: number;
  throughput: number;
  errorRate: number;
  totalCost: number;
  tokenUsage: {
    prompt: number;
    completion: number;
    total: number;
  };
}

export interface LangfuseClientConfig {
  publicKey?: string;
  secretKey?: string;
  baseUrl?: string;
  wsEndpoint?: string;
  enableRealtime?: boolean;
  autoFlush?: boolean;
  flushInterval?: number;
}

class LangfuseRealtimeClient extends EventEmitter {
  private client: Langfuse | null = null;
  private ws: WebSocket | null = null;
  private config: LangfuseClientConfig;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 2000;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(config?: LangfuseClientConfig) {
    super();
    
    this.config = {
      publicKey: config?.publicKey || process.env.NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY || process.env.LANGFUSE_PUBLIC_KEY,
      secretKey: config?.secretKey || process.env.LANGFUSE_SECRET_KEY,
      baseUrl: config?.baseUrl || process.env.NEXT_PUBLIC_LANGFUSE_HOST || 'http://localhost:3050',
      wsEndpoint: config?.wsEndpoint || process.env.NEXT_PUBLIC_LANGFUSE_WS || 'ws://localhost:3050/ws',
      enableRealtime: config?.enableRealtime !== false,
      autoFlush: config?.autoFlush !== false,
      flushInterval: config?.flushInterval || 5000,
    };

    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Initialize Langfuse REST client
      if (this.config.publicKey && this.config.secretKey) {
        this.client = new Langfuse({
          publicKey: this.config.publicKey,
          secretKey: this.config.secretKey,
          baseUrl: this.config.baseUrl,
          flushAt: 20,
          flushInterval: this.config.flushInterval,
        });

        this.emit('client-initialized');
      }

      // Initialize WebSocket connection for real-time updates
      if (this.config.enableRealtime && this.config.wsEndpoint) {
        await this.connectWebSocket();
      }

    } catch (error) {
      console.error('Failed to initialize Langfuse client:', error);
      this.emit('error', error);
    }
  }

  private async connectWebSocket(): Promise<void> {
    try {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        return;
      }

      this.ws = new WebSocket(this.config.wsEndpoint!);
      
      this.ws.onopen = () => {
        console.log('Langfuse WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.emit('connected');
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleRealtimeMessage(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('Langfuse WebSocket disconnected');
        this.isConnected = false;
        this.emit('disconnected');
        this.stopHeartbeat();
        this.scheduleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('Langfuse WebSocket error:', error);
        this.emit('error', error);
      };

    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      this.scheduleReconnect();
    }
  }

  private handleRealtimeMessage(data: any): void {
    switch (data.type) {
      case 'trace_created':
      case 'trace_updated':
        this.emit('trace', this.formatTrace(data.payload));
        break;
      
      case 'agent_status':
        this.emit('agent', this.formatAgent(data.payload));
        break;
      
      case 'swarm_metrics':
        this.emit('metrics', data.payload as SwarmMetrics);
        break;
      
      case 'heartbeat':
        // Handle heartbeat
        break;
      
      default:
        this.emit('message', data);
    }
  }

  private formatTrace(traceData: any): LiveTrace {
    return {
      id: traceData.id,
      name: traceData.name || 'Unnamed Trace',
      sessionId: traceData.sessionId || 'unknown',
      userId: traceData.userId,
      timestamp: new Date(traceData.timestamp || Date.now()),
      duration: traceData.duration || 0,
      status: this.mapStatus(traceData.status || traceData.level),
      model: traceData.model || traceData.metadata?.model || 'unknown',
      promptTokens: traceData.usage?.promptTokens || traceData.promptTokens || 0,
      completionTokens: traceData.usage?.completionTokens || traceData.completionTokens || 0,
      totalCost: traceData.usage?.totalCost || traceData.totalCost || 0,
      input: traceData.input || traceData.metadata?.input || '',
      output: traceData.output || traceData.metadata?.output || '',
      metadata: traceData.metadata || {},
      tags: traceData.tags || [],
      scores: traceData.scores || {},
      level: traceData.level,
      statusMessage: traceData.statusMessage,
      parentObservationId: traceData.parentObservationId,
      version: traceData.version,
      agentId: traceData.metadata?.agentId || traceData.agentId,
      swarmId: traceData.metadata?.swarmId || traceData.swarmId,
    };
  }

  private formatAgent(agentData: any): LiveAgent {
    return {
      id: agentData.id,
      name: agentData.name || agentData.id,
      status: agentData.status || 'unknown',
      currentTask: agentData.currentTask,
      tasksCompleted: agentData.tasksCompleted || 0,
      averageResponseTime: agentData.averageResponseTime || 0,
      memoryUsage: agentData.memoryUsage || 0,
      cpuUsage: agentData.cpuUsage || 0,
      lastActivity: new Date(agentData.lastActivity || Date.now()),
      swarmId: agentData.swarmId,
      metadata: agentData.metadata || {},
    };
  }

  private mapStatus(status: string): 'success' | 'error' | 'pending' | 'running' {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'success':
      case 'ok':
        return 'success';
      case 'error':
      case 'failed':
      case 'failure':
        return 'error';
      case 'pending':
      case 'queued':
        return 'pending';
      case 'running':
      case 'in_progress':
      case 'active':
        return 'running';
      default:
        return 'pending';
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.emit('max-reconnect-attempts');
      return;
    }

    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    setTimeout(() => {
      console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      this.connectWebSocket();
    }, delay);
  }

  // Public API methods
  public async getTraces(options?: {
    sessionId?: string;
    userId?: string;
    limit?: number;
    offset?: number;
    fromTimestamp?: Date;
    toTimestamp?: Date;
  }): Promise<LiveTrace[]> {
    try {
      if (!this.client) {
        throw new Error('Langfuse client not initialized');
      }

      // For now, return mock data since Langfuse SDK doesn't provide direct trace querying
      // In production, this would use the Langfuse REST API
      const response = await fetch(`${this.config.baseUrl}/api/public/traces`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.publicKey}`,
          'Content-Type': 'application/json',
        },
        ...options && {
          body: JSON.stringify({
            sessionId: options.sessionId,
            userId: options.userId,
            limit: options.limit || 50,
            offset: options.offset || 0,
            fromTimestamp: options.fromTimestamp?.toISOString(),
            toTimestamp: options.toTimestamp?.toISOString(),
          }),
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data?.map((trace: any) => this.formatTrace(trace)) || [];

    } catch (error) {
      console.error('Failed to fetch traces:', error);
      // Return empty array on error to maintain app stability
      return [];
    }
  }

  public async getSwarmMetrics(swarmId?: string): Promise<SwarmMetrics> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/public/swarm-metrics${swarmId ? `?swarmId=${swarmId}` : ''}`, {
        headers: {
          'Authorization': `Bearer ${this.config.publicKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();

    } catch (error) {
      console.error('Failed to fetch swarm metrics:', error);
      // Return default metrics on error
      return {
        totalTraces: 0,
        activeTraces: 0,
        totalAgents: 0,
        activeAgents: 0,
        totalTasks: 0,
        completedTasks: 0,
        failedTasks: 0,
        averageResponseTime: 0,
        throughput: 0,
        errorRate: 0,
        totalCost: 0,
        tokenUsage: {
          prompt: 0,
          completion: 0,
          total: 0,
        },
      };
    }
  }

  public async createTrace(trace: Partial<LiveTrace>): Promise<string | null> {
    try {
      if (!this.client) {
        throw new Error('Langfuse client not initialized');
      }

      const langfuseTrace = this.client.trace({
        id: trace.id,
        name: trace.name,
        sessionId: trace.sessionId,
        userId: trace.userId,
        input: trace.input,
        output: trace.output,
        metadata: {
          ...trace.metadata,
          agentId: trace.agentId,
          swarmId: trace.swarmId,
          model: trace.model,
        },
        tags: trace.tags,
      });

      await this.client.flushAsync();
      return trace.id || null;

    } catch (error) {
      console.error('Failed to create trace:', error);
      return null;
    }
  }

  public async updateTrace(traceId: string, updates: Partial<LiveTrace>): Promise<boolean> {
    try {
      if (!this.client) {
        throw new Error('Langfuse client not initialized');
      }

      // Note: Langfuse SDK doesn't provide direct trace updates
      // This would typically use the REST API
      const response = await fetch(`${this.config.baseUrl}/api/public/traces/${traceId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${this.config.publicKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      return response.ok;

    } catch (error) {
      console.error('Failed to update trace:', error);
      return false;
    }
  }

  public isRealtimeConnected(): boolean {
    return this.isConnected;
  }

  public reconnect(): void {
    this.reconnectAttempts = 0;
    this.connectWebSocket();
  }

  public disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.stopHeartbeat();
    this.isConnected = false;
  }

  public async shutdown(): Promise<void> {
    this.disconnect();
    
    if (this.client) {
      await this.client.shutdownAsync();
    }
    
    this.removeAllListeners();
  }
}

// Export singleton instance
export const langfuseClient = new LangfuseRealtimeClient();

// Export the class for custom instances
export { LangfuseRealtimeClient };

// Export default client
export default langfuseClient;