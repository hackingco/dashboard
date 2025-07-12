// API Configuration for admin.hacking.co
// This will connect to the deployed swarm-manager service

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://swarm-mgr-1739853764.fly.dev/api';

export interface SwarmInfo {
  id: string;
  name: string;
  status: 'running' | 'paused' | 'stopped';
  workers: number;
  tasks: number;
  cpu: string;
  memory: string;
  created: string;
}

export interface WorkerInfo {
  id: string;
  name: string;
  swarm: string;
  status: 'active' | 'idle' | 'offline';
  cpu: string;
  memory: string;
  tasks: number;
  lastSeen: string;
}

export interface TaskInfo {
  id: string;
  name: string;
  swarm: string;
  status: 'completed' | 'running' | 'queued' | 'failed';
  priority: 'critical' | 'high' | 'medium' | 'low';
  progress: number;
  duration: string;
  created: string;
  completed: string | null;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'debug';
  source: string;
  message: string;
  metadata?: Record<string, any>;
}

export interface Metric {
  name: string;
  value: number;
  unit: string;
  timestamp: string;
}

class ApiService {
  private async fetch(endpoint: string, options?: RequestInit) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    return response.json();
  }

  // Swarm endpoints
  async getSwarms(): Promise<SwarmInfo[]> {
    return this.fetch('/swarms');
  }

  async getSwarm(id: string): Promise<SwarmInfo> {
    return this.fetch(`/swarms/${id}`);
  }

  async createSwarm(data: Partial<SwarmInfo>): Promise<SwarmInfo> {
    return this.fetch('/swarms', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateSwarm(id: string, data: Partial<SwarmInfo>): Promise<SwarmInfo> {
    return this.fetch(`/swarms/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteSwarm(id: string): Promise<void> {
    return this.fetch(`/swarms/${id}`, {
      method: 'DELETE',
    });
  }

  // Worker endpoints
  async getWorkers(): Promise<WorkerInfo[]> {
    return this.fetch('/workers');
  }

  async getWorkersBySwarm(swarmId: string): Promise<WorkerInfo[]> {
    return this.fetch(`/swarms/${swarmId}/workers`);
  }

  // Task endpoints
  async getTasks(): Promise<TaskInfo[]> {
    return this.fetch('/tasks');
  }

  async getTask(id: string): Promise<TaskInfo> {
    return this.fetch(`/tasks/${id}`);
  }

  async createTask(data: Partial<TaskInfo>): Promise<TaskInfo> {
    return this.fetch('/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async retryTask(id: string): Promise<TaskInfo> {
    return this.fetch(`/tasks/${id}/retry`, {
      method: 'POST',
    });
  }

  // Log endpoints
  async getLogs(filters?: {
    level?: string;
    source?: string;
    limit?: number;
    offset?: number;
  }): Promise<LogEntry[]> {
    const params = new URLSearchParams(filters as any);
    return this.fetch(`/logs?${params}`);
  }

  // Metrics endpoints
  async getMetrics(timeRange?: { start: string; end: string }): Promise<Metric[]> {
    const params = new URLSearchParams(timeRange as any);
    return this.fetch(`/metrics?${params}`);
  }

  async getSystemHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Array<{ name: string; status: string; message?: string }>;
  }> {
    return this.fetch('/health');
  }
}

export const api = new ApiService();