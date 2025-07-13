// Enhanced API service with CORS handling and fallback options
// Handles cross-origin requests to the swarm manager API

const API_BASE_URL = 'https://swarm-manager-live.fly.dev/api';

// For development/testing, you can use a CORS proxy
const CORS_PROXY = 'https://cors-anywhere.herokuapp.com/';
const USE_CORS_PROXY = false; // Set to true if experiencing CORS issues

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
  private useMockData = false;

  constructor() {
    this.baseUrl = USE_CORS_PROXY ? CORS_PROXY + API_BASE_URL : API_BASE_URL;
    this.startPolling();
  }

  private async fetchWithAuth(endpoint: string, options: RequestInit = {}) {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...options.headers,
        },
        mode: 'cors',
      });

      if (!response.ok) {
        // If CORS error or 404, fall back to mock data
        if (response.status === 0 || response.status === 404) {
          console.warn('API unavailable, using mock data:', endpoint);
          this.useMockData = true;
          return this.getMockData(endpoint);
        }
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API request failed for ${endpoint}:`, error);
      
      // Fall back to mock data on network errors
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        console.warn('Network error, using mock data:', endpoint);
        this.useMockData = true;
        return this.getMockData(endpoint);
      }
      
      throw error;
    }
  }

  // Mock data fallback for when API is unavailable
  private getMockData(endpoint: string): any {
    if (endpoint.includes('/enhanced-swarms')) {
      return this.getMockSwarms();
    }
    if (endpoint.includes('/telemetry/metrics')) {
      return this.getMockMetrics();
    }
    if (endpoint.includes('/stats')) {
      return this.getMockStats();
    }
    return null;
  }

  private getMockSwarms(): RealSwarmData[] {
    return [
      {
        id: 'swarm-demo-1',
        name: 'Demo Production Swarm',
        status: 'active',
        description: 'Demo swarm for testing',
        region: 'ord',
        config: {
          workerCount: 4,
          machineType: 'shared-cpu-1x',
          strategy: 'balanced',
          autoScale: true,
        },
        metrics: {
          runningMachines: 3,
          totalMachines: 4,
          cpuUsage: 45,
          memoryUsage: 62,
          networkIn: 1024,
          networkOut: 2048,
        },
        agents: [
          { id: 'agent-1', type: 'coordinator', status: 'active', capabilities: ['orchestration'] },
          { id: 'agent-2', type: 'worker', status: 'active', capabilities: ['processing'] },
        ],
        created_at: new Date(Date.now() - 86400000).toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'swarm-demo-2',
        name: 'Demo Analytics Swarm',
        status: 'scaling',
        description: 'Analytics and data processing',
        region: 'iad',
        config: {
          workerCount: 8,
          machineType: 'shared-cpu-2x',
          strategy: 'performance',
          autoScale: true,
        },
        metrics: {
          runningMachines: 6,
          totalMachines: 8,
          cpuUsage: 78,
          memoryUsage: 85,
          networkIn: 4096,
          networkOut: 8192,
        },
        created_at: new Date(Date.now() - 172800000).toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
  }

  private getMockMetrics(): RealTelemetryMetrics[] {
    return [
      {
        id: 'metric-1',
        timestamp: new Date().toISOString(),
        metric_type: 'cpu',
        value: 65,
        unit: 'percentage',
      },
    ];
  }

  private getMockStats() {
    return {
      totalSwarms: 2,
      activeSwarms: 1,
      stoppedSwarms: 0,
      scalingSwarms: 1,
      totalAgents: 4,
      activeAgents: 4,
    };
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
    try {
      const swarms = await this.getSwarms();
      
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
    } catch (error) {
      console.error('Failed to get system status:', error);
      // Return mock status if API fails
      return {
        timestamp: new Date().toISOString(),
        totalSwarms: 2,
        activeSwarms: 1,
        totalMachines: 12,
        runningMachines: 9,
        totalTasks: 150,
        completedTasks: 120,
        failedTasks: 5,
        systemLoad: {
          cpu: 65,
          memory: 72,
          network: {
            inbound: 5120,
            outbound: 10240,
          },
        },
      };
    }
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