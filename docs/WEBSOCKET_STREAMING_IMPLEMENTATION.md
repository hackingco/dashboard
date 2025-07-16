# WebSocket Streaming Implementation Blueprint
*Analytics Prime - Real-Time Event Streaming Architecture*

## 🎯 Overview

This document provides the technical implementation details for the WebSocket-based real-time streaming infrastructure that will handle high-frequency swarm action updates with optimal performance and scalability.

## 🔧 WebSocket Gateway Implementation

### Core Gateway Class
```typescript
// shared/langfuse-wrapper/src/websocket-gateway.ts
import { WebSocket, WebSocketServer } from 'ws';
import { EventEmitter } from 'events';
import { createServer } from 'http';

export interface StreamingClient {
  id: string;
  socket: WebSocket;
  subscriptions: Set<string>;
  swarmFilters: Set<string>;
  lastActivity: number;
  rateLimiting: {
    messagesPerSecond: number;
    currentCount: number;
    resetTime: number;
  };
}

export interface StreamMessage {
  id: string;
  timestamp: number;
  type: 'metrics' | 'trace' | 'swarm' | 'alert' | 'heartbeat';
  swarmId?: string;
  data: any;
  priority: 'low' | 'normal' | 'high' | 'critical';
  compression?: boolean;
}

export class WebSocketGateway extends EventEmitter {
  private server: WebSocketServer;
  private httpServer: any;
  private clients: Map<string, StreamingClient> = new Map();
  private messageQueue: StreamMessage[] = [];
  private isRunning = false;
  
  // Performance optimization
  private messageBuffer: Map<string, StreamMessage[]> = new Map();
  private flushTimer?: NodeJS.Timeout;
  private compressionThreshold = 1024; // 1KB
  
  constructor(private config: {
    port: number;
    bufferSize: number;
    flushInterval: number;
    maxConnections: number;
    enableCompression: boolean;
    rateLimitPerSecond: number;
  }) {
    super();
    this.setupPerformanceOptimization();
  }

  async start(): Promise<void> {
    this.httpServer = createServer();
    this.server = new WebSocketServer({ 
      server: this.httpServer,
      perMessageDeflate: this.config.enableCompression
    });

    this.server.on('connection', (socket, request) => {
      this.handleConnection(socket, request);
    });

    this.server.on('error', (error) => {
      console.error('WebSocket server error:', error);
      this.emit('error', error);
    });

    await new Promise<void>((resolve, reject) => {
      this.httpServer.listen(this.config.port, (error?: Error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    this.isRunning = true;
    this.startPerformanceMonitoring();
    
    console.log(`🌐 WebSocket Gateway started on port ${this.config.port}`);
    this.emit('started');
  }

  private handleConnection(socket: WebSocket, request: any): void {
    const clientId = this.generateClientId();
    
    // Check connection limits
    if (this.clients.size >= this.config.maxConnections) {
      socket.close(1013, 'Server overloaded');
      return;
    }

    const client: StreamingClient = {
      id: clientId,
      socket,
      subscriptions: new Set(),
      swarmFilters: new Set(),
      lastActivity: Date.now(),
      rateLimiting: {
        messagesPerSecond: this.config.rateLimitPerSecond,
        currentCount: 0,
        resetTime: Date.now() + 1000
      }
    };

    this.clients.set(clientId, client);
    
    socket.on('message', (data) => {
      this.handleMessage(clientId, data);
    });

    socket.on('close', () => {
      this.handleDisconnection(clientId);
    });

    socket.on('error', (error) => {
      console.error(`Client ${clientId} error:`, error);
      this.handleDisconnection(clientId);
    });

    // Send welcome message
    this.sendToClient(clientId, {
      id: this.generateMessageId(),
      timestamp: Date.now(),
      type: 'heartbeat',
      data: { 
        status: 'connected',
        clientId,
        serverCapabilities: {
          compression: this.config.enableCompression,
          maxSubscriptions: 50,
          rateLimitPerSecond: this.config.rateLimitPerSecond
        }
      },
      priority: 'normal'
    });

    console.log(`📱 Client ${clientId} connected (${this.clients.size} total)`);
    this.emit('client_connected', { clientId, totalClients: this.clients.size });
  }

  private handleMessage(clientId: string, data: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.lastActivity = Date.now();

    try {
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'subscribe':
          this.handleSubscription(clientId, message.data);
          break;
        case 'unsubscribe':
          this.handleUnsubscription(clientId, message.data);
          break;
        case 'ping':
          this.sendPong(clientId);
          break;
        case 'filter_swarms':
          this.handleSwarmFilter(clientId, message.data);
          break;
        default:
          console.warn(`Unknown message type from ${clientId}:`, message.type);
      }
    } catch (error) {
      console.error(`Invalid message from ${clientId}:`, error);
    }
  }

  private handleSubscription(clientId: string, subscriptionData: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { topics, swarmIds } = subscriptionData;
    
    if (topics) {
      topics.forEach((topic: string) => client.subscriptions.add(topic));
    }
    
    if (swarmIds) {
      swarmIds.forEach((swarmId: string) => client.swarmFilters.add(swarmId));
    }

    this.sendToClient(clientId, {
      id: this.generateMessageId(),
      timestamp: Date.now(),
      type: 'heartbeat',
      data: { 
        status: 'subscribed',
        subscriptions: Array.from(client.subscriptions),
        swarmFilters: Array.from(client.swarmFilters)
      },
      priority: 'normal'
    });

    console.log(`📋 Client ${clientId} subscribed:`, { topics, swarmIds });
  }

  // Public streaming methods
  public streamMetricsUpdate(swarmId: string, metrics: any): void {
    this.broadcast({
      id: this.generateMessageId(),
      timestamp: Date.now(),
      type: 'metrics',
      swarmId,
      data: metrics,
      priority: 'normal'
    });
  }

  public streamTraceUpdate(swarmId: string, traceId: string, update: any): void {
    this.broadcast({
      id: this.generateMessageId(),
      timestamp: Date.now(),
      type: 'trace',
      swarmId,
      data: { traceId, ...update },
      priority: 'high'
    });
  }

  public streamSwarmActivity(swarmId: string, activity: any): void {
    this.broadcast({
      id: this.generateMessageId(),
      timestamp: Date.now(),
      type: 'swarm',
      swarmId,
      data: activity,
      priority: 'normal'
    });
  }

  public streamAlert(alert: any): void {
    this.broadcast({
      id: this.generateMessageId(),
      timestamp: Date.now(),
      type: 'alert',
      swarmId: alert.swarmId,
      data: alert,
      priority: 'critical'
    });
  }

  private broadcast(message: StreamMessage): void {
    if (!this.isRunning) return;

    // Add to buffer for batch processing
    const bufferKey = `${message.type}_${message.swarmId || 'global'}`;
    
    if (!this.messageBuffer.has(bufferKey)) {
      this.messageBuffer.set(bufferKey, []);
    }
    
    this.messageBuffer.get(bufferKey)!.push(message);
    
    // For critical messages, send immediately
    if (message.priority === 'critical') {
      this.flushBuffer();
    }
  }

  private setupPerformanceOptimization(): void {
    // Flush buffer at regular intervals
    this.flushTimer = setInterval(() => {
      this.flushBuffer();
    }, this.config.flushInterval);

    // Clean up inactive clients
    setInterval(() => {
      this.cleanupInactiveClients();
    }, 30000); // Every 30 seconds

    // Reset rate limiting counters
    setInterval(() => {
      this.resetRateLimiting();
    }, 1000); // Every second
  }

  private flushBuffer(): void {
    if (this.messageBuffer.size === 0) return;

    const startTime = performance.now();
    let totalMessages = 0;

    for (const [bufferKey, messages] of this.messageBuffer) {
      if (messages.length === 0) continue;

      // Batch messages for efficiency
      const batchedMessages = this.batchMessages(messages);
      
      for (const batchMessage of batchedMessages) {
        this.sendToFilteredClients(batchMessage);
        totalMessages++;
      }

      messages.length = 0; // Clear the buffer
    }

    const flushTime = performance.now() - startTime;
    
    if (totalMessages > 0) {
      console.log(`📤 Flushed ${totalMessages} messages in ${flushTime.toFixed(2)}ms`);
      this.emit('messages_flushed', { count: totalMessages, duration: flushTime });
    }
  }

  private batchMessages(messages: StreamMessage[]): StreamMessage[] {
    if (messages.length <= 1) return messages;

    // Group by type and swarmId for batching
    const groups = new Map<string, StreamMessage[]>();
    
    for (const message of messages) {
      const key = `${message.type}_${message.swarmId || 'global'}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(message);
    }

    const batchedMessages: StreamMessage[] = [];
    
    for (const [key, groupMessages] of groups) {
      if (groupMessages.length === 1) {
        batchedMessages.push(groupMessages[0]);
      } else {
        // Create batched message
        batchedMessages.push({
          id: this.generateMessageId(),
          timestamp: Date.now(),
          type: groupMessages[0].type,
          swarmId: groupMessages[0].swarmId,
          data: {
            batch: true,
            count: groupMessages.length,
            messages: groupMessages.map(m => m.data)
          },
          priority: Math.max(...groupMessages.map(m => this.priorityToNumber(m.priority))) > 2 ? 'critical' : 'normal'
        });
      }
    }

    return batchedMessages;
  }

  private sendToFilteredClients(message: StreamMessage): void {
    for (const [clientId, client] of this.clients) {
      if (!this.shouldSendToClient(client, message)) continue;
      if (!this.checkRateLimit(client)) continue;

      this.sendToClient(clientId, message);
    }
  }

  private shouldSendToClient(client: StreamingClient, message: StreamMessage): boolean {
    // Check topic subscription
    if (!client.subscriptions.has(message.type) && !client.subscriptions.has('all')) {
      return false;
    }

    // Check swarm filter
    if (message.swarmId && client.swarmFilters.size > 0 && !client.swarmFilters.has(message.swarmId)) {
      return false;
    }

    return true;
  }

  private checkRateLimit(client: StreamingClient): boolean {
    const now = Date.now();
    
    if (now > client.rateLimiting.resetTime) {
      client.rateLimiting.currentCount = 0;
      client.rateLimiting.resetTime = now + 1000;
    }

    if (client.rateLimiting.currentCount >= client.rateLimiting.messagesPerSecond) {
      return false;
    }

    client.rateLimiting.currentCount++;
    return true;
  }

  private sendToClient(clientId: string, message: StreamMessage): void {
    const client = this.clients.get(clientId);
    if (!client || client.socket.readyState !== WebSocket.OPEN) return;

    try {
      let data = JSON.stringify(message);
      
      // Apply compression for large messages
      if (this.config.enableCompression && data.length > this.compressionThreshold) {
        message.compression = true;
      }

      client.socket.send(data);
    } catch (error) {
      console.error(`Failed to send message to ${clientId}:`, error);
      this.handleDisconnection(clientId);
    }
  }

  private generateClientId(): string {
    return `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private priorityToNumber(priority: string): number {
    const priorities = { low: 0, normal: 1, high: 2, critical: 3 };
    return priorities[priority as keyof typeof priorities] || 1;
  }

  // Cleanup and monitoring methods
  private cleanupInactiveClients(): void {
    const now = Date.now();
    const timeout = 300000; // 5 minutes

    for (const [clientId, client] of this.clients) {
      if (now - client.lastActivity > timeout) {
        console.log(`🧹 Cleaning up inactive client ${clientId}`);
        this.handleDisconnection(clientId);
      }
    }
  }

  private resetRateLimiting(): void {
    const now = Date.now();
    for (const client of this.clients.values()) {
      if (now > client.rateLimiting.resetTime) {
        client.rateLimiting.currentCount = 0;
        client.rateLimiting.resetTime = now + 1000;
      }
    }
  }

  private startPerformanceMonitoring(): void {
    setInterval(() => {
      this.emit('performance_metrics', {
        connectedClients: this.clients.size,
        queuedMessages: this.messageQueue.length,
        bufferSize: Array.from(this.messageBuffer.values()).reduce((sum, arr) => sum + arr.length, 0),
        memoryUsage: process.memoryUsage(),
        timestamp: Date.now()
      });
    }, 10000); // Every 10 seconds
  }

  public getMetrics(): any {
    return {
      connectedClients: this.clients.size,
      queuedMessages: this.messageQueue.length,
      bufferSize: Array.from(this.messageBuffer.values()).reduce((sum, arr) => sum + arr.length, 0),
      isRunning: this.isRunning,
      uptime: Date.now() - (this.startTime || 0)
    };
  }

  public async stop(): Promise<void> {
    this.isRunning = false;
    
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    // Close all client connections
    for (const [clientId, client] of this.clients) {
      client.socket.close(1001, 'Server shutting down');
    }

    // Close server
    if (this.server) {
      this.server.close();
    }

    if (this.httpServer) {
      await new Promise<void>((resolve) => {
        this.httpServer.close(() => resolve());
      });
    }

    console.log('🛑 WebSocket Gateway stopped');
    this.emit('stopped');
  }

  private handleDisconnection(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.socket.close();
      this.clients.delete(clientId);
      console.log(`📱 Client ${clientId} disconnected (${this.clients.size} remaining)`);
      this.emit('client_disconnected', { clientId, totalClients: this.clients.size });
    }
  }

  private sendPong(clientId: string): void {
    this.sendToClient(clientId, {
      id: this.generateMessageId(),
      timestamp: Date.now(),
      type: 'heartbeat',
      data: { status: 'pong' },
      priority: 'low'
    });
  }

  private handleSwarmFilter(clientId: string, filterData: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { swarmIds, action } = filterData;
    
    if (action === 'add') {
      swarmIds?.forEach((id: string) => client.swarmFilters.add(id));
    } else if (action === 'remove') {
      swarmIds?.forEach((id: string) => client.swarmFilters.delete(id));
    } else if (action === 'clear') {
      client.swarmFilters.clear();
    }

    this.sendToClient(clientId, {
      id: this.generateMessageId(),
      timestamp: Date.now(),
      type: 'heartbeat',
      data: { 
        status: 'filter_updated',
        swarmFilters: Array.from(client.swarmFilters)
      },
      priority: 'normal'
    });
  }
}

export default WebSocketGateway;
```

## 🔌 Integration with Existing Components

### Real-Time Observer Integration
```typescript
// shared/langfuse-wrapper/src/enhanced-real-time-observer.ts
import { RealTimeObserver } from './real-time-observer';
import { WebSocketGateway } from './websocket-gateway';

export class EnhancedRealTimeObserver extends RealTimeObserver {
  private webSocketGateway?: WebSocketGateway;

  constructor(
    port: number,
    databasePath: string,
    private gatewayConfig?: {
      enabled: boolean;
      port: number;
      bufferSize: number;
      flushInterval: number;
    }
  ) {
    super(port, databasePath);
    
    if (gatewayConfig?.enabled) {
      this.initializeWebSocketGateway();
    }
  }

  private async initializeWebSocketGateway(): Promise<void> {
    if (!this.gatewayConfig) return;

    this.webSocketGateway = new WebSocketGateway({
      port: this.gatewayConfig.port,
      bufferSize: this.gatewayConfig.bufferSize,
      flushInterval: this.gatewayConfig.flushInterval,
      maxConnections: 100,
      enableCompression: true,
      rateLimitPerSecond: 60
    });

    await this.webSocketGateway.start();
    this.setupGatewayIntegration();
  }

  private setupGatewayIntegration(): void {
    if (!this.webSocketGateway) return;

    // Forward observations to WebSocket clients
    this.on('observation', (observation) => {
      this.webSocketGateway!.streamSwarmActivity(
        observation.swarmId,
        observation
      );
    });

    this.on('anomaly', (anomaly) => {
      this.webSocketGateway!.streamAlert({
        type: 'anomaly',
        severity: 'warning',
        swarmId: anomaly.swarmId,
        ...anomaly
      });
    });

    this.on('metrics_updated', (metrics) => {
      this.webSocketGateway!.streamMetricsUpdate(
        metrics.swarmId,
        metrics
      );
    });
  }

  public getWebSocketGateway(): WebSocketGateway | undefined {
    return this.webSocketGateway;
  }

  public async shutdown(): Promise<void> {
    if (this.webSocketGateway) {
      await this.webSocketGateway.stop();
    }
    await super.shutdown();
  }
}
```

### Streaming Integration Enhancement
```typescript
// shared/langfuse-wrapper/src/enhanced-streaming-integration.ts
import { StreamingTraceIntegration } from './streaming-trace-integration';
import { WebSocketGateway } from './websocket-gateway';

export class EnhancedStreamingIntegration extends StreamingTraceIntegration {
  private webSocketGateway?: WebSocketGateway;

  public setWebSocketGateway(gateway: WebSocketGateway): void {
    this.webSocketGateway = gateway;
    this.setupStreamingEvents();
  }

  private setupStreamingEvents(): void {
    if (!this.webSocketGateway) return;

    this.on('trace_started', (event) => {
      this.webSocketGateway!.streamTraceUpdate(
        event.swarmId,
        event.traceId,
        { status: 'started', ...event }
      );
    });

    this.on('trace_updated', (event) => {
      this.webSocketGateway!.streamTraceUpdate(
        event.swarmId,
        event.traceId,
        { status: 'updated', ...event }
      );
    });

    this.on('trace_completed', (event) => {
      this.webSocketGateway!.streamTraceUpdate(
        event.swarmId,
        event.traceId,
        { status: 'completed', ...event }
      );
    });

    this.on('trace_error', (event) => {
      this.webSocketGateway!.streamAlert({
        type: 'trace_error',
        severity: 'critical',
        swarmId: event.swarmId,
        traceId: event.traceId,
        error: event.error
      });
    });
  }
}
```

## 📱 Client-Side Implementation

### React WebSocket Hook
```typescript
// React hook for WebSocket connection
import { useState, useEffect, useRef, useCallback } from 'react';

interface UseWebSocketOptions {
  url: string;
  subscriptions?: string[];
  swarmFilters?: string[];
  autoReconnect?: boolean;
  reconnectInterval?: number;
}

export function useWebSocket(options: UseWebSocketOptions) {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<any>(null);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  
  const messagesQueue = useRef<any[]>([]);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const connect = useCallback(() => {
    if (socket?.readyState === WebSocket.OPEN) return;

    setConnectionState('connecting');
    const ws = new WebSocket(options.url);

    ws.onopen = () => {
      setIsConnected(true);
      setConnectionState('connected');
      setSocket(ws);

      // Send subscription message
      if (options.subscriptions || options.swarmFilters) {
        ws.send(JSON.stringify({
          type: 'subscribe',
          data: {
            topics: options.subscriptions || ['all'],
            swarmIds: options.swarmFilters || []
          }
        }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        setLastMessage(message);
        messagesQueue.current.push(message);
        
        // Keep only last 1000 messages
        if (messagesQueue.current.length > 1000) {
          messagesQueue.current = messagesQueue.current.slice(-1000);
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      setConnectionState('disconnected');
      setSocket(null);

      // Auto-reconnect
      if (options.autoReconnect !== false) {
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, options.reconnectInterval || 5000);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

  }, [options.url, options.subscriptions, options.swarmFilters, options.autoReconnect, options.reconnectInterval]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (socket) {
      socket.close();
    }
  }, [socket]);

  const sendMessage = useCallback((message: any) => {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }, [socket]);

  const getMessages = useCallback((filter?: (msg: any) => boolean) => {
    return filter ? messagesQueue.current.filter(filter) : [...messagesQueue.current];
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return {
    isConnected,
    connectionState,
    lastMessage,
    sendMessage,
    getMessages,
    connect,
    disconnect
  };
}
```

### React Dashboard Components
```typescript
// Real-time metrics component
import React, { useState, useEffect } from 'react';
import { useWebSocket } from './hooks/useWebSocket';

export const RealTimeMetrics: React.FC<{ swarmId?: string }> = ({ swarmId }) => {
  const [metrics, setMetrics] = useState<any>({});
  
  const { lastMessage, isConnected } = useWebSocket({
    url: 'ws://localhost:8080',
    subscriptions: ['metrics'],
    swarmFilters: swarmId ? [swarmId] : undefined
  });

  useEffect(() => {
    if (lastMessage?.type === 'metrics') {
      setMetrics(prev => ({
        ...prev,
        ...lastMessage.data
      }));
    }
  }, [lastMessage]);

  return (
    <div className="real-time-metrics">
      <div className="connection-status">
        <span className={`indicator ${isConnected ? 'connected' : 'disconnected'}`} />
        {isConnected ? 'Live' : 'Connecting...'}
      </div>
      
      <div className="metrics-grid">
        <MetricCard title="Active Traces" value={metrics.activeTraces || 0} />
        <MetricCard title="Throughput" value={`${metrics.tokenThroughput || 0}/s`} />
        <MetricCard title="Efficiency" value={`${Math.round(metrics.efficiency || 0)}%`} />
        <MetricCard title="Latency" value={`${metrics.averageLatency || 0}ms`} />
      </div>
    </div>
  );
};

const MetricCard: React.FC<{ title: string; value: string | number }> = ({ title, value }) => (
  <div className="metric-card">
    <h3>{title}</h3>
    <div className="value">{value}</div>
  </div>
);
```

## 🚀 Performance Optimizations

### Message Batching Strategy
```typescript
interface BatchingConfig {
  maxBatchSize: number;        // 50 messages
  maxBatchDelay: number;       // 100ms
  priorityBypasses: string[];  // ['critical', 'high']
  compressionMinSize: number;  // 1KB
}

class MessageBatcher {
  private batches = new Map<string, any[]>();
  private timers = new Map<string, NodeJS.Timeout>();

  constructor(private config: BatchingConfig, private onFlush: (batch: any[]) => void) {}

  addMessage(message: any): void {
    const batchKey = this.getBatchKey(message);
    
    // Bypass batching for priority messages
    if (this.config.priorityBypasses.includes(message.priority)) {
      this.onFlush([message]);
      return;
    }

    if (!this.batches.has(batchKey)) {
      this.batches.set(batchKey, []);
    }

    const batch = this.batches.get(batchKey)!;
    batch.push(message);

    // Flush if batch is full
    if (batch.length >= this.config.maxBatchSize) {
      this.flushBatch(batchKey);
      return;
    }

    // Set timer for batch flush
    if (!this.timers.has(batchKey)) {
      const timer = setTimeout(() => {
        this.flushBatch(batchKey);
      }, this.config.maxBatchDelay);
      
      this.timers.set(batchKey, timer);
    }
  }

  private flushBatch(batchKey: string): void {
    const batch = this.batches.get(batchKey);
    if (!batch || batch.length === 0) return;

    this.onFlush([...batch]);
    
    // Clear batch and timer
    batch.length = 0;
    const timer = this.timers.get(batchKey);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(batchKey);
    }
  }

  private getBatchKey(message: any): string {
    return `${message.type}_${message.swarmId || 'global'}`;
  }
}
```

### Connection Pool Management
```typescript
class ConnectionPool {
  private connections = new Map<string, WebSocket>();
  private connectionHealth = new Map<string, {
    lastPing: number;
    responseTime: number;
    failureCount: number;
  }>();

  constructor(private maxConnections: number = 100) {
    this.startHealthChecking();
  }

  private startHealthChecking(): void {
    setInterval(() => {
      this.performHealthCheck();
    }, 30000); // Every 30 seconds
  }

  private performHealthCheck(): void {
    for (const [clientId, socket] of this.connections) {
      if (socket.readyState !== WebSocket.OPEN) {
        this.removeConnection(clientId);
        continue;
      }

      // Send ping
      const pingStart = Date.now();
      socket.ping();
      
      socket.once('pong', () => {
        const responseTime = Date.now() - pingStart;
        this.updateHealth(clientId, responseTime);
      });
    }
  }

  private updateHealth(clientId: string, responseTime: number): void {
    const health = this.connectionHealth.get(clientId) || {
      lastPing: 0,
      responseTime: 0,
      failureCount: 0
    };

    health.lastPing = Date.now();
    health.responseTime = responseTime;
    health.failureCount = responseTime > 5000 ? health.failureCount + 1 : 0;

    this.connectionHealth.set(clientId, health);

    // Remove unhealthy connections
    if (health.failureCount > 3) {
      this.removeConnection(clientId);
    }
  }

  private removeConnection(clientId: string): void {
    const socket = this.connections.get(clientId);
    if (socket) {
      socket.close();
      this.connections.delete(clientId);
      this.connectionHealth.delete(clientId);
    }
  }

  public getHealthyConnections(): Map<string, WebSocket> {
    const healthy = new Map<string, WebSocket>();
    
    for (const [clientId, socket] of this.connections) {
      const health = this.connectionHealth.get(clientId);
      if (!health || health.failureCount < 2) {
        healthy.set(clientId, socket);
      }
    }

    return healthy;
  }

  public getConnectionMetrics() {
    return {
      total: this.connections.size,
      healthy: this.getHealthyConnections().size,
      utilization: (this.connections.size / this.maxConnections) * 100
    };
  }
}
```

---

This WebSocket implementation provides a high-performance, scalable foundation for real-time swarm coordination monitoring with intelligent message batching, connection pooling, and performance optimization strategies.