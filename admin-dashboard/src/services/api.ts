// Real API service for connecting to the actual swarm manager
// Replaces the mock telemetry service with real data from the manager service

const API_BASE_URL = 'https://swarm-manager-live.fly.dev/api';

export interface RealSwarmData {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'scaling' | 'stopped' | 'error';
  description?: string;
  flyAppName?: string;
  region: string;
  config: {
    workerCount: number;
    machineType: string;
    strategy: string;
    autoScale: boolean;
  };
  metrics: {
    runningMachines: number;
    totalMachines: number;
    cpuUsage: number;
    memoryUsage: number;
    networkIn: number;
    networkOut: number;
  };
  agents?: Array<{
    id: string;
    type: string;
    status: string;
    capabilities: string[];
  }>;
  created_at: string;
  updated_at: string;
}

export interface RealTelemetryMetrics {
  id: string;
  timestamp: string;
  swarm_id?: string;
  metric_type: 'cpu' | 'memory' | 'network' | 'tasks' | 'system';
  value: number;
  unit: string;
  metadata?: Record<string, any>;
}

export interface RealSystemStatus {
  timestamp: string;
  totalSwarms: number;
  activeSwarms: number;
  totalMachines: number;
  runningMachines: number;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  systemLoad: {
    cpu: number;
    memory: number;
    network: {
      inbound: number;
      outbound: number;
    };
  };
}

class RealApiService {
  private baseUrl: string;
  private subscribers: Map<string, Set<(data: any) => void>> = new Map();
  private pollingIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.baseUrl = API_BASE_URL;
    this.startPolling();
  }

  private async fetchWithAuth(endpoint: string, options: RequestInit = {}) {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  // Swarm Management
  async getSwarms(): Promise<RealSwarmData[]> {
    return this.fetchWithAuth('/enhanced-swarms');
  }

  async getSwarm(id: string): Promise<RealSwarmData> {
    return this.fetchWithAuth(`/enhanced-swarms/${id}`);
  }

  async createSwarm(swarmData: Partial<RealSwarmData>): Promise<RealSwarmData> {
    return this.fetchWithAuth('/enhanced-swarms', {
      method: 'POST',
      body: JSON.stringify(swarmData),
    });
  }

  async updateSwarm(id: string, updates: Partial<RealSwarmData>): Promise<RealSwarmData> {
    return this.fetchWithAuth(`/enhanced-swarms/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteSwarm(id: string): Promise<void> {
    return this.fetchWithAuth(`/enhanced-swarms/${id}`, {
      method: 'DELETE',
    });
  }

  async scaleSwarm(id: string, targetCount: number): Promise<RealSwarmData> {
    return this.fetchWithAuth(`/enhanced-swarms/${id}/scale`, {
      method: 'POST',
      body: JSON.stringify({ targetCount }),
    });
  }

  // Telemetry and Metrics
  async getTelemetryMetrics(filters?: {
    swarmId?: string;
    metricType?: string;
    startTime?: string;
    endTime?: string;
    limit?: number;
  }): Promise<RealTelemetryMetrics[]> {
    const params = new URLSearchParams();
    if (filters?.swarmId) params.append('swarm_id', filters.swarmId);
    if (filters?.metricType) params.append('metric_type', filters.metricType);
    if (filters?.startTime) params.append('start_time', filters.startTime);
    if (filters?.endTime) params.append('end_time', filters.endTime);
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const query = params.toString() ? `?${params.toString()}` : '';
    return this.fetchWithAuth(`/telemetry/metrics${query}`);
  }

  async getSystemStatus(): Promise<RealSystemStatus> {
    const [swarms, metrics] = await Promise.all([
      this.getSwarms(),
      this.getTelemetryMetrics({ limit: 1 }),
    ]);

    const activeSwarms = swarms.filter(s => s.status === 'active' || s.status === 'scaling');
    const totalMachines = swarms.reduce((sum, s) => sum + s.metrics.totalMachines, 0);
    const runningMachines = swarms.reduce((sum, s) => sum + s.metrics.runningMachines, 0);

    // Calculate system averages
    const avgCpu = swarms.length > 0 
      ? swarms.reduce((sum, s) => sum + s.metrics.cpuUsage, 0) / swarms.length 
      : 0;
    const avgMemory = swarms.length > 0 
      ? swarms.reduce((sum, s) => sum + s.metrics.memoryUsage, 0) / swarms.length 
      : 0;
    const totalNetworkIn = swarms.reduce((sum, s) => sum + s.metrics.networkIn, 0);
    const totalNetworkOut = swarms.reduce((sum, s) => sum + s.metrics.networkOut, 0);

    return {
      timestamp: new Date().toISOString(),
      totalSwarms: swarms.length,
      activeSwarms: activeSwarms.length,
      totalMachines,
      runningMachines,
      totalTasks: 0, // Will be calculated from tasks API when available
      completedTasks: 0, // Will be calculated from tasks API when available
      failedTasks: 0, // Will be calculated from tasks API when available
      systemLoad: {
        cpu: avgCpu,
        memory: avgMemory,
        network: {
          inbound: totalNetworkIn,
          outbound: totalNetworkOut,
        },
      },
    };
  }

  async getSwarmStats(): Promise<{
    totalSwarms: number;
    activeSwarms: number;
    stoppedSwarms: number;
    scalingSwarms: number;
    totalAgents: number;
    activeAgents: number;
  }> {
    return this.fetchWithAuth('/enhanced-swarms/stats');
  }

  // Agent Management
  async getSwarmAgents(swarmId: string) {
    return this.fetchWithAuth(`/enhanced-swarms/${swarmId}/agents`);
  }

  async addAgent(swarmId: string, agentData: any) {
    return this.fetchWithAuth(`/enhanced-swarms/${swarmId}/agents`, {
      method: 'POST',
      body: JSON.stringify(agentData),
    });
  }

  async updateAgent(swarmId: string, agentId: string, updates: any) {
    return this.fetchWithAuth(`/enhanced-swarms/${swarmId}/agents/${agentId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteAgent(swarmId: string, agentId: string) {
    return this.fetchWithAuth(`/enhanced-swarms/${swarmId}/agents/${agentId}`, {
      method: 'DELETE',
    });
  }

  // Real-time subscriptions (polling-based)
  subscribe(type: 'swarms' | 'metrics' | 'system', callback: (data: any) => void): () => void {
    if (!this.subscribers.has(type)) {
      this.subscribers.set(type, new Set());
    }
    this.subscribers.get(type)!.add(callback);

    return () => {
      this.subscribers.get(type)?.delete(callback);
    };
  }

  private startPolling() {
    // Poll swarms every 10 seconds
    const swarmsInterval = setInterval(async () => {
      try {
        const swarms = await this.getSwarms();
        this.notifySubscribers('swarms', swarms);
      } catch (error) {
        console.error('Failed to poll swarms:', error);
      }
    }, 10000);

    // Poll system metrics every 30 seconds
    const metricsInterval = setInterval(async () => {
      try {
        const systemStatus = await this.getSystemStatus();
        this.notifySubscribers('system', systemStatus);
        this.notifySubscribers('metrics', systemStatus);
      } catch (error) {
        console.error('Failed to poll system metrics:', error);
      }
    }, 30000);

    this.pollingIntervals.set('swarms', swarmsInterval);
    this.pollingIntervals.set('metrics', metricsInterval);
  }

  private notifySubscribers(type: string, data: any) {
    const subscribers = this.subscribers.get(type);
    if (subscribers) {
      subscribers.forEach(callback => callback(data));
    }
  }

  cleanup() {
    this.pollingIntervals.forEach(interval => clearInterval(interval));
    this.pollingIntervals.clear();
    this.subscribers.clear();
  }
}

export const apiService = new RealApiService();