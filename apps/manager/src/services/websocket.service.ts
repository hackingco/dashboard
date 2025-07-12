import WebSocket from 'ws';
import logger from './logger';

export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

export class WebSocketService {
  private wss: WebSocket.Server;
  private clients: Set<WebSocket> = new Set();

  constructor(wss: WebSocket.Server) {
    this.wss = wss;
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.wss.on('connection', (ws) => {
      this.clients.add(ws);
      logger.info('WebSocket client added to service', { totalClients: this.clients.size });

      ws.on('close', () => {
        this.clients.delete(ws);
        logger.info('WebSocket client removed from service', { totalClients: this.clients.size });
      });

      ws.on('error', (error) => {
        logger.error('WebSocket client error', { error });
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

    let successCount = 0;
    let failureCount = 0;

    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(messageString);
          successCount++;
        } catch (error) {
          logger.error('Failed to send message to client', { error });
          failureCount++;
          this.clients.delete(client);
        }
      } else {
        // Remove closed connections
        this.clients.delete(client);
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
        logger.error('Failed to send message to specific client', { error });
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
    this.broadcast({
      type: 'swarm_update',
      swarmId,
      status,
      data,
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
    this.broadcast({
      type: 'machine_update',
      appName,
      machineId,
      status,
      data,
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