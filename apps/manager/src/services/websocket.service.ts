import WebSocket from 'ws';
import jwt from 'jsonwebtoken';
import { logger } from '../lib/logger';
import { trustGraphService } from './trustgraph/trustgraph.service';
import { v4 as uuidv4 } from 'uuid';
// TODO: Re-enable when @swarm/shared-types package is available
// import { WebSocketMessage, WebSocketMachineUpdate } from '@swarm/shared-types';

// Temporary type definitions
export interface WebSocketMessage {
  type: string;
  swarmId?: string;
  status?: string;
  data?: any;
  correlationId?: string;
  timestamp?: string;
  metrics?: any;
  appName?: string;
  machineId?: string;
  level?: string;
  message?: string;
  // Add missing properties for compatibility
  count?: number;
  [key: string]: any; // Allow additional properties
}

export interface WebSocketMachineUpdate extends WebSocketMessage {
  type: 'machine_update';
  appName?: string; // Make optional to match usage
  machineId: string;
  status: string;
  cpus?: number; // Add missing cpus property
  memory?: any;
  region?: any;
  privateIp?: any;
}

export interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  role?: string;
  isAuthenticated?: boolean;
}

export class WebSocketService {
  private wss: WebSocket.Server;
  private clients: Map<WebSocket, AuthenticatedWebSocket> = new Map();
  private jwtSecret: string = process.env.JWT_SECRET || 'dev-secret-key-change-in-production';

  constructor(wss: WebSocket.Server) {
    this.wss = wss;
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.wss.on('connection', (ws: AuthenticatedWebSocket, req) => {
      // Connection already validated by verifyClient, extract auth info
      const url = new URL(req.url!, `http://${req.headers.host}`);
      const token = url.searchParams.get('token');
      
      if (token) {
        try {
          const decoded = jwt.verify(token, this.jwtSecret) as any;
          ws.userId = decoded.userId;
          ws.role = decoded.role;
          ws.isAuthenticated = true;
        } catch (error) {
          logger.error('Failed to decode JWT in connection handler', { error });
        }
      }
      
      this.clients.set(ws, ws);
      logger.info('WebSocket client added to service', { 
        totalClients: this.clients.size,
        userId: ws.userId,
        role: ws.role 
      });

      ws.on('close', () => {
        this.clients.delete(ws);
        logger.info('WebSocket client removed from service', { 
          totalClients: this.clients.size,
          userId: ws.userId 
        });
      });

      ws.on('error', (error) => {
        logger.error('WebSocket client error', { error, userId: ws.userId });
        this.clients.delete(ws);
      });
    });
  }

  /**
   * Broadcast a message to all connected clients
   */
  broadcast(message: WebSocketMessage): void {
    const messageString = JSON.stringify({
      ...message,
      timestamp: message.timestamp || new Date().toISOString()
    });

    // Emit TrustGraph node for WebSocket broadcast
    const correlationId = message.correlationId || uuidv4();
    const swarmId = message.swarmId || 'unknown';
    
    trustGraphService.emitWSBroadcastNode(
      swarmId,
      message.type,
      'websocket',
      {
        message_type: message.type,
        client_count: this.clients.size,
        ...message
      },
      correlationId
    ).catch(err => logger.error('Failed to emit WS broadcast node', { error: err }));

    let successCount = 0;
    let failureCount = 0;

    this.clients.forEach((client, ws) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(messageString);
          successCount++;
        } catch (error) {
          logger.error('Failed to send message to client', { error, userId: client.userId });
          failureCount++;
          this.clients.delete(ws);
        }
      } else {
        // Remove closed connections
        this.clients.delete(ws);
        failureCount++;
      }
    });

    logger.info('WebSocket broadcast completed', {
      type: message.type,
      successCount,
      failureCount,
      totalClients: this.clients.size
    });
  }

  /**
   * Send a message to a specific client
   */
  sendToClient(client: WebSocket, message: WebSocketMessage): boolean {
    if (client.readyState === WebSocket.OPEN) {
      try {
        const messageString = JSON.stringify({
          ...message,
          timestamp: message.timestamp || new Date().toISOString()
        });
        client.send(messageString);
        return true;
      } catch (error) {
        const authClient = this.clients.get(client);
        logger.error('Failed to send message to specific client', { 
          error, 
          userId: authClient?.userId 
        });
        this.clients.delete(client);
        return false;
      }
    }
    return false;
  }

  /**
   * Get current client count
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Send real-time swarm updates
   */
  broadcastSwarmUpdate(swarmId: string, status: string, data?: any): void {
    const correlationId = data?.correlationId || uuidv4();
    this.broadcast({
      type: 'swarm_update',
      swarmId,
      status,
      data,
      correlationId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send real-time metrics updates
   */
  broadcastMetricsUpdate(metrics: any): void {
    this.broadcast({
      type: 'metrics_update',
      metrics,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send machine status updates
   */
  broadcastMachineUpdate(appName: string, machineId: string, status: string, data?: any): void {
    const correlationId = data?.correlationId || uuidv4();
    const swarmId = data?.swarmId || appName;
    this.broadcast({
      type: 'machine_update',
      appName,
      machineId,
      status,
      data,
      correlationId,
      swarmId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send system alerts
   */
  broadcastAlert(level: 'info' | 'warning' | 'error', message: string, data?: any): void {
    this.broadcast({
      type: 'alert',
      level,
      message,
      data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send machine status updates with full details
   */
  broadcastMachineStatusUpdate(update: WebSocketMachineUpdate): void {
    this.broadcast(update);
  }

  /**
   * Get authenticated client by userId
   */
  getClientByUserId(userId: string): AuthenticatedWebSocket | undefined {
    for (const [ws, client] of this.clients) {
      if (client.userId === userId && client.readyState === WebSocket.OPEN) {
        return client;
      }
    }
    return undefined;
  }

  /**
   * Broadcast to specific role
   */
  broadcastToRole(role: string, message: WebSocketMessage): void {
    const messageString = JSON.stringify({
      ...message,
      timestamp: message.timestamp || new Date().toISOString()
    });

    this.clients.forEach((client) => {
      if (client.role === role && client.readyState === WebSocket.OPEN) {
        try {
          client.send(messageString);
        } catch (error) {
          logger.error('Failed to send message to role', { error, role, userId: client.userId });
        }
      }
    });
  }

  /**
   * Cleanup all connections
   */
  cleanup(): void {
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.close();
      }
    });
    this.clients.clear();
    logger.info('WebSocket service cleanup completed');
  }
}