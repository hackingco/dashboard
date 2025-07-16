/**
 * WebSocket Handler for Enhanced Live Dashboard
 * Manages real-time streaming connections with advanced features
 */

import { EventEmitter } from 'events';
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import * as zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export interface WebSocketClient {
  id: string;
  ws: WebSocket;
  subscriptions: Set<string>;
  metadata: ClientMetadata;
  lastActivity: number;
  messageQueue: QueuedMessage[];
  rateLimitCounter: number;
  compressionEnabled: boolean;
}

export interface ClientMetadata {
  userAgent?: string;
  ipAddress?: string;
  connectedAt: number;
  features: ClientFeatures;
}

export interface ClientFeatures {
  supportsCompression: boolean;
  supportsDelta: boolean;
  supportsCharts: boolean;
  isMobile: boolean;
}

export interface QueuedMessage {
  id: string;
  data: any;
  timestamp: number;
  priority: 'high' | 'normal' | 'low';
  retries: number;
}

export interface WebSocketConfig {
  maxClients?: number;
  heartbeatInterval?: number;
  messageQueueSize?: number;
  compressionThreshold?: number;
  rateLimitPerMinute?: number;
  enableCompression?: boolean;
  enableHeartbeat?: boolean;
  enableMessageQueue?: boolean;
}

export class DashboardWebSocketHandler extends EventEmitter {
  private wsServer: WebSocketServer | null = null;
  private clients: Map<string, WebSocketClient> = new Map();
  private config: Required<WebSocketConfig>;
  private heartbeatTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;
  private isRunning = false;

  constructor(config: WebSocketConfig = {}) {
    super();
    
    this.config = {
      maxClients: 100,
      heartbeatInterval: 30000,
      messageQueueSize: 50,
      compressionThreshold: 1024,
      rateLimitPerMinute: 600,
      enableCompression: true,
      enableHeartbeat: true,
      enableMessageQueue: true,
      ...config
    };
  }

  async start(port: number): Promise<void> {
    if (this.isRunning) {
      console.log('WebSocket handler already running');
      return;
    }

    try {
      this.wsServer = new WebSocketServer({ port });

      this.wsServer.on('connection', (ws, request) => {
        this.handleConnection(ws, request);
      });

      this.wsServer.on('error', (error) => {
        console.error('WebSocket server error:', error);
        this.emit('error', error);
      });

      // Start heartbeat mechanism
      if (this.config.enableHeartbeat) {
        this.startHeartbeat();
      }

      // Start cleanup timer
      this.startCleanupTimer();

      this.isRunning = true;
      console.log(`WebSocket handler started on port ${port}`);
      this.emit('started', port);

    } catch (error) {
      console.error('Failed to start WebSocket handler:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    try {
      // Stop timers
      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer);
      }
      if (this.cleanupTimer) {
        clearInterval(this.cleanupTimer);
      }

      // Close all client connections
      for (const [clientId, client] of this.clients) {
        await this.disconnectClient(clientId, 'Server shutting down');
      }

      // Close WebSocket server
      if (this.wsServer) {
        await new Promise<void>((resolve) => {
          this.wsServer!.close(() => resolve());
        });
      }

      this.clients.clear();
      this.isRunning = false;
      console.log('WebSocket handler stopped');
      this.emit('stopped');

    } catch (error) {
      console.error('Error stopping WebSocket handler:', error);
    }
  }

  private handleConnection(ws: WebSocket, request: any): void {
    // Check max clients limit
    if (this.clients.size >= this.config.maxClients) {
      ws.close(1008, 'Max clients reached');
      return;
    }

    const clientId = uuidv4();
    const client: WebSocketClient = {
      id: clientId,
      ws,
      subscriptions: new Set(['default']),
      metadata: {
        userAgent: request.headers['user-agent'],
        ipAddress: request.socket.remoteAddress,
        connectedAt: Date.now(),
        features: this.detectClientFeatures(request.headers)
      },
      lastActivity: Date.now(),
      messageQueue: [],
      rateLimitCounter: 0,
      compressionEnabled: this.config.enableCompression
    };

    this.clients.set(clientId, client);

    // Set up event handlers
    ws.on('message', async (data) => {
      await this.handleMessage(clientId, data);
    });

    ws.on('close', (code, reason) => {
      this.handleDisconnection(clientId, code, reason?.toString());
    });

    ws.on('error', (error) => {
      console.error(`WebSocket client error (${clientId}):`, error);
      this.emit('client_error', { clientId, error });
    });

    ws.on('pong', () => {
      client.lastActivity = Date.now();
    });

    // Send welcome message
    this.sendWelcomeMessage(clientId);
    
    this.emit('client_connected', clientId, client.metadata);
    console.log(`Client connected: ${clientId}`);
  }

  private detectClientFeatures(headers: any): ClientFeatures {
    const userAgent = headers['user-agent'] || '';
    
    return {
      supportsCompression: headers['accept-encoding']?.includes('gzip') || false,
      supportsDelta: headers['x-supports-delta'] === 'true',
      supportsCharts: headers['x-supports-charts'] !== 'false',
      isMobile: /mobile|android|ios/i.test(userAgent)
    };
  }

  private async handleMessage(clientId: string, rawData: any): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.lastActivity = Date.now();

    // Apply rate limiting
    if (!this.checkRateLimit(client)) {
      this.sendError(clientId, 'Rate limit exceeded', 429);
      return;
    }

    try {
      let message: any;

      // Handle compressed messages
      if (Buffer.isBuffer(rawData) && rawData[0] === 0x1f && rawData[1] === 0x8b) {
        const decompressed = await gunzip(rawData);
        message = JSON.parse(decompressed.toString());
      } else {
        message = JSON.parse(rawData.toString());
      }

      // Validate message structure
      if (!message.type || !message.id) {
        this.sendError(clientId, 'Invalid message format', 400);
        return;
      }

      // Handle different message types
      switch (message.type) {
        case 'ping':
          this.handlePing(clientId, message);
          break;
        case 'subscribe':
          this.handleSubscribe(clientId, message);
          break;
        case 'unsubscribe':
          this.handleUnsubscribe(clientId, message);
          break;
        case 'configure':
          this.handleConfigure(clientId, message);
          break;
        default:
          // Emit for external handling
          this.emit('client_message', clientId, message);
      }

    } catch (error) {
      console.error(`Error handling message from ${clientId}:`, error);
      this.sendError(clientId, 'Message processing error', 500);
    }
  }

  private checkRateLimit(client: WebSocketClient): boolean {
    const now = Date.now();
    const minute = 60000;
    
    // Reset counter every minute
    if (now - client.lastActivity > minute) {
      client.rateLimitCounter = 0;
    }

    client.rateLimitCounter++;
    return client.rateLimitCounter <= this.config.rateLimitPerMinute;
  }

  private handlePing(clientId: string, message: any): void {
    this.sendToClient(clientId, {
      type: 'pong',
      id: message.id,
      timestamp: Date.now()
    });
  }

  private handleSubscribe(clientId: string, message: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { channels = [] } = message.data || {};
    
    for (const channel of channels) {
      client.subscriptions.add(channel);
    }

    this.sendToClient(clientId, {
      type: 'subscribed',
      id: message.id,
      data: { channels: Array.from(client.subscriptions) },
      timestamp: Date.now()
    });
  }

  private handleUnsubscribe(clientId: string, message: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { channels = [] } = message.data || {};
    
    for (const channel of channels) {
      client.subscriptions.delete(channel);
    }

    this.sendToClient(clientId, {
      type: 'unsubscribed',
      id: message.id,
      data: { channels: Array.from(client.subscriptions) },
      timestamp: Date.now()
    });
  }

  private handleConfigure(clientId: string, message: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { compression, features } = message.data || {};
    
    if (typeof compression === 'boolean') {
      client.compressionEnabled = compression && client.metadata.features.supportsCompression;
    }

    if (features) {
      client.metadata.features = { ...client.metadata.features, ...features };
    }

    this.sendToClient(clientId, {
      type: 'configured',
      id: message.id,
      data: {
        compression: client.compressionEnabled,
        features: client.metadata.features
      },
      timestamp: Date.now()
    });
  }

  private handleDisconnection(clientId: string, code: number, reason?: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    this.clients.delete(clientId);
    this.emit('client_disconnected', clientId, { code, reason });
    console.log(`Client disconnected: ${clientId} (${code}: ${reason || 'No reason'})`);
  }

  private async disconnectClient(clientId: string, reason: string): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Send goodbye message
    try {
      await this.sendToClient(clientId, {
        type: 'goodbye',
        data: { reason },
        timestamp: Date.now()
      });
    } catch (error) {
      // Client might already be disconnected
    }

    client.ws.close(1000, reason);
    this.clients.delete(clientId);
  }

  private sendWelcomeMessage(clientId: string): void {
    this.sendToClient(clientId, {
      type: 'welcome',
      data: {
        clientId,
        features: {
          compression: this.config.enableCompression,
          heartbeat: this.config.enableHeartbeat,
          messageQueue: this.config.enableMessageQueue
        },
        subscriptions: Array.from(this.clients.get(clientId)?.subscriptions || [])
      },
      timestamp: Date.now()
    });
  }

  private sendError(clientId: string, message: string, code: number): void {
    this.sendToClient(clientId, {
      type: 'error',
      error: { message, code },
      timestamp: Date.now()
    });
  }

  async sendToClient(clientId: string, data: any): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      let payload: Buffer | string;

      // Apply compression if enabled and beneficial
      if (client.compressionEnabled && this.shouldCompress(data)) {
        const jsonStr = JSON.stringify(data);
        const compressed = await gzip(jsonStr);
        
        if (compressed.length < jsonStr.length * 0.9) {
          payload = compressed;
        } else {
          payload = jsonStr;
        }
      } else {
        payload = JSON.stringify(data);
      }

      client.ws.send(payload);
      
    } catch (error) {
      console.error(`Failed to send to client ${clientId}:`, error);
      
      // Queue message if enabled
      if (this.config.enableMessageQueue) {
        this.queueMessage(client, data);
      }
    }
  }

  async broadcast(data: any, channel: string = 'default'): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const [clientId, client] of this.clients) {
      if (client.subscriptions.has(channel)) {
        promises.push(this.sendToClient(clientId, data));
      }
    }

    await Promise.allSettled(promises);
  }

  async broadcastToClients(clientIds: string[], data: any): Promise<void> {
    const promises = clientIds.map(clientId => this.sendToClient(clientId, data));
    await Promise.allSettled(promises);
  }

  private shouldCompress(data: any): boolean {
    const size = JSON.stringify(data).length;
    return size > this.config.compressionThreshold;
  }

  private queueMessage(client: WebSocketClient, data: any): void {
    if (client.messageQueue.length >= this.config.messageQueueSize) {
      // Remove oldest low-priority message
      const lowPriorityIndex = client.messageQueue.findIndex(m => m.priority === 'low');
      if (lowPriorityIndex !== -1) {
        client.messageQueue.splice(lowPriorityIndex, 1);
      } else {
        client.messageQueue.shift();
      }
    }

    client.messageQueue.push({
      id: uuidv4(),
      data,
      timestamp: Date.now(),
      priority: data.priority || 'normal',
      retries: 0
    });
  }

  private async processMessageQueues(): Promise<void> {
    for (const [clientId, client] of this.clients) {
      if (client.ws.readyState === WebSocket.OPEN && client.messageQueue.length > 0) {
        const messages = [...client.messageQueue];
        client.messageQueue = [];

        for (const message of messages) {
          try {
            await this.sendToClient(clientId, message.data);
          } catch (error) {
            message.retries++;
            if (message.retries < 3) {
              client.messageQueue.push(message);
            }
          }
        }
      }
    }
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      for (const [clientId, client] of this.clients) {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.ping();
        }
      }
    }, this.config.heartbeatInterval);
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      const timeout = this.config.heartbeatInterval * 2;

      for (const [clientId, client] of this.clients) {
        if (now - client.lastActivity > timeout) {
          console.log(`Removing inactive client: ${clientId}`);
          this.disconnectClient(clientId, 'Inactive');
        }
      }

      // Process message queues
      if (this.config.enableMessageQueue) {
        this.processMessageQueues();
      }
    }, 10000); // Run every 10 seconds
  }

  // Public API

  isRunning(): boolean {
    return this.isRunning;
  }

  getClientCount(): number {
    return this.clients.size;
  }

  getClients(): Array<{ id: string; metadata: ClientMetadata }> {
    return Array.from(this.clients.values()).map(client => ({
      id: client.id,
      metadata: client.metadata
    }));
  }

  getClientSubscriptions(clientId: string): string[] {
    const client = this.clients.get(clientId);
    return client ? Array.from(client.subscriptions) : [];
  }

  isClientConnected(clientId: string): boolean {
    const client = this.clients.get(clientId);
    return client ? client.ws.readyState === WebSocket.OPEN : false;
  }

  async kickClient(clientId: string, reason: string = 'Kicked by server'): Promise<void> {
    await this.disconnectClient(clientId, reason);
  }

  async sendCustomMessage(clientId: string, type: string, data: any): Promise<void> {
    await this.sendToClient(clientId, {
      type,
      data,
      timestamp: Date.now()
    });
  }
}

export { DashboardWebSocketHandler };