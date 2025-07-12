// WebSocket client service for real-time communication with swarm manager
class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 5000;
  private subscribers: Map<string, Set<(data: any) => void>> = new Map();
  private token: string | null = null;
  private isConnecting = false;

  constructor() {
    this.initialize();
  }

  private async initialize() {
    try {
      // Get JWT token for WebSocket authentication
      await this.getAuthToken();
      await this.connect();
    } catch (error) {
      console.error('Failed to initialize WebSocket client:', error);
    }
  }

  private async getAuthToken(): Promise<void> {
    try {
      const response = await fetch('https://swarm-manager-live.fly.dev/api/auth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: 'admin' }),
      });

      if (!response.ok) {
        throw new Error(`Token request failed: ${response.status}`);
      }

      const data = await response.json();
      this.token = data.token;
      console.log('WebSocket authentication token obtained');
    } catch (error) {
      console.error('Failed to get authentication token:', error);
      throw error;
    }
  }

  private async connect(): Promise<void> {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    if (!this.token) {
      throw new Error('No authentication token available');
    }

    this.isConnecting = true;

    try {
      const wsUrl = `wss://swarm-manager-live.fly.dev/ws?token=${encodeURIComponent(this.token)}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected to swarm manager');
        this.reconnectAttempts = 0;
        this.isConnecting = false;
        this.notifySubscribers('connection', { status: 'connected' });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('WebSocket message received:', data);
          this.handleMessage(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket connection closed:', event.code, event.reason);
        this.isConnecting = false;
        this.notifySubscribers('connection', { status: 'disconnected' });
        this.handleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnecting = false;
        this.notifySubscribers('connection', { status: 'error', error });
      };
    } catch (error) {
      this.isConnecting = false;
      throw error;
    }
  }

  private handleMessage(data: any): void {
    const { type } = data;

    switch (type) {
      case 'connection':
        this.notifySubscribers('connection', data);
        break;
      case 'swarm_update':
      case 'swarm_scaled':
      case 'swarm_launched':
        this.notifySubscribers('swarm', data);
        break;
      case 'machine_update':
        this.notifySubscribers('machine', data);
        break;
      case 'metrics_update':
        this.notifySubscribers('metrics', data);
        break;
      case 'alert':
        this.notifySubscribers('alert', data);
        break;
      case 'scale':
      case 'launch':
      case 'status':
        this.notifySubscribers('operation', data);
        break;
      default:
        console.log('Unknown WebSocket message type:', type);
        this.notifySubscribers('unknown', data);
    }
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect WebSocket (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      // Use exponential backoff for reconnection attempts
      const backoffDelay = Math.min(this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1), 30000);
      
      setTimeout(async () => {
        try {
          await this.getAuthToken(); // Refresh token
          await this.connect();
        } catch (error) {
          console.error('Reconnection failed:', error);
        }
      }, backoffDelay);
    } else {
      console.error('Max reconnection attempts reached');
      this.notifySubscribers('connection', { status: 'failed', maxAttemptsReached: true });
      
      // Reset attempts after longer delay to allow manual retry
      setTimeout(() => {
        this.reconnectAttempts = 0;
      }, 60000);
    }
  }

  // Public API methods

  /**
   * Subscribe to WebSocket events
   */
  subscribe(eventType: string, callback: (data: any) => void): () => void {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set());
    }
    this.subscribers.get(eventType)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.subscribers.get(eventType)?.delete(callback);
    };
  }

  /**
   * Send scale command to swarm
   */
  scaleSwarm(swarmId: string, count: number): Promise<any> {
    return this.sendMessage({
      type: 'scale',
      swarmId,
      count,
    });
  }

  /**
   * Send launch command to swarm
   */
  launchSwarm(swarmConfig: any): Promise<any> {
    return this.sendMessage({
      type: 'launch',
      swarmConfig,
    });
  }

  /**
   * Get swarm status
   */
  getStatus(appName: string): Promise<any> {
    return this.sendMessage({
      type: 'status',
      appName,
    });
  }

  /**
   * Send message to WebSocket server
   */
  private sendMessage(message: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const messageId = Date.now().toString();
      const messageWithId = { ...message, messageId };

      // Set up one-time listener for response
      const unsubscribe = this.subscribe('operation', (data) => {
        if (data.messageId === messageId || data.type === message.type) {
          unsubscribe();
          resolve(data);
        }
      });

      // Set timeout for response
      setTimeout(() => {
        unsubscribe();
        reject(new Error('WebSocket message timeout'));
      }, 30000);

      try {
        this.ws.send(JSON.stringify(messageWithId));
      } catch (error) {
        unsubscribe();
        reject(error);
      }
    });
  }

  private notifySubscribers(eventType: string, data: any): void {
    const subscribers = this.subscribers.get(eventType);
    if (subscribers) {
      subscribers.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in WebSocket subscriber callback:', error);
        }
      });
    }
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): string {
    if (!this.ws) return 'disconnected';
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.OPEN:
        return 'connected';
      case WebSocket.CLOSING:
        return 'closing';
      case WebSocket.CLOSED:
        return 'disconnected';
      default:
        return 'unknown';
    }
  }

  /**
   * Manually reconnect WebSocket
   */
  async reconnect(): Promise<void> {
    this.disconnect();
    this.reconnectAttempts = 0;
    await this.initialize();
  }

  /**
   * Disconnect WebSocket
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.subscribers.clear();
  }
}

// Export singleton instance
export const wsClient = new WebSocketClient();
export default wsClient;