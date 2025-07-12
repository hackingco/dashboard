// Real-time telemetry service for swarm monitoring
// Simulates live data until backend services are fully operational

export interface SwarmTelemetry {
  id: string;
  name: string;
  status: 'running' | 'paused' | 'stopped' | 'scaling';
  workers: {
    active: number;
    idle: number;
    offline: number;
    total: number;
  };
  tasks: {
    completed: number;
    running: number;
    queued: number;
    failed: number;
    total: number;
  };
  performance: {
    cpu: number;
    memory: number;
    throughput: number;
    latency: number;
  };
  health: {
    uptime: number;
    lastCheck: string;
    errors: number;
    warnings: number;
  };
  region: string;
  created: string;
  lastActivity: string;
}

export interface SystemMetrics {
  timestamp: string;
  cpu: {
    usage: number;
    cores: number;
    frequency: number;
  };
  memory: {
    used: number;
    total: number;
    cached: number;
  };
  network: {
    inbound: number;
    outbound: number;
    connections: number;
  };
  storage: {
    used: number;
    total: number;
    iops: number;
  };
  swarms: {
    active: number;
    scaling: number;
    stopped: number;
  };
  workers: {
    active: number;
    idle: number;
    offline: number;
  };
  tasks: {
    completed: number;
    running: number;
    queued: number;
    failed: number;
  };
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  source: string;
  message: string;
  swarmId?: string;
  workerId?: string;
  taskId?: string;
  metadata?: Record<string, any>;
}

class RealtimeTelemetryService {
  private swarms: Map<string, SwarmTelemetry> = new Map();
  private metrics: SystemMetrics[] = [];
  private logs: LogEntry[] = [];
  private subscribers: Map<string, Set<(data: any) => void>> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.initializeData();
    this.startRealTimeUpdates();
  }

  private initializeData() {
    // Initialize sample swarms
    const swarmData: SwarmTelemetry[] = [
      {
        id: 'swarm-1',
        name: 'Production Web Crawlers',
        status: 'running',
        workers: { active: 8, idle: 2, offline: 0, total: 10 },
        tasks: { completed: 1247, running: 12, queued: 5, failed: 3, total: 1267 },
        performance: { cpu: 67, memory: 78, throughput: 450, latency: 125 },
        health: { uptime: 99.8, lastCheck: new Date().toISOString(), errors: 0, warnings: 1 },
        region: 'ord',
        created: '2025-01-10T08:00:00Z',
        lastActivity: new Date().toISOString()
      },
      {
        id: 'swarm-2', 
        name: 'Data Processing Pipeline',
        status: 'scaling',
        workers: { active: 15, idle: 3, offline: 1, total: 19 },
        tasks: { completed: 856, running: 23, queued: 18, failed: 2, total: 899 },
        performance: { cpu: 84, memory: 91, throughput: 780, latency: 89 },
        health: { uptime: 99.9, lastCheck: new Date().toISOString(), errors: 0, warnings: 0 },
        region: 'iad',
        created: '2025-01-09T14:30:00Z',
        lastActivity: new Date().toISOString()
      },
      {
        id: 'swarm-3',
        name: 'ML Training Cluster',
        status: 'running',
        workers: { active: 6, idle: 1, offline: 0, total: 7 },
        tasks: { completed: 234, running: 8, queued: 2, failed: 1, total: 245 },
        performance: { cpu: 92, memory: 88, throughput: 320, latency: 245 },
        health: { uptime: 99.5, lastCheck: new Date().toISOString(), errors: 1, warnings: 2 },
        region: 'sjc',
        created: '2025-01-08T10:15:00Z',
        lastActivity: new Date().toISOString()
      },
      {
        id: 'swarm-4',
        name: 'API Gateway Swarm',
        status: 'stopped',
        workers: { active: 0, idle: 0, offline: 4, total: 4 },
        tasks: { completed: 1089, running: 0, queued: 0, failed: 5, total: 1094 },
        performance: { cpu: 0, memory: 0, throughput: 0, latency: 0 },
        health: { uptime: 0, lastCheck: new Date().toISOString(), errors: 2, warnings: 0 },
        region: 'lhr',
        created: '2025-01-07T16:45:00Z',
        lastActivity: '2025-01-11T22:30:00Z'
      }
    ];

    swarmData.forEach(swarm => {
      this.swarms.set(swarm.id, swarm);
    });

    // Initialize metrics history
    const now = Date.now();
    for (let i = 59; i >= 0; i--) {
      const timestamp = new Date(now - i * 60000).toISOString();
      this.metrics.push(this.generateMetrics(timestamp));
    }

    // Initialize recent logs
    this.generateRecentLogs();
  }

  private generateMetrics(timestamp: string): SystemMetrics {
    const baseValues = {
      cpu: 45 + Math.sin(Date.now() / 300000) * 25,
      memory: 60 + Math.sin(Date.now() / 240000) * 20,
      network: 100 + Math.sin(Date.now() / 180000) * 50,
    };

    return {
      timestamp,
      cpu: {
        usage: Math.max(0, Math.min(100, baseValues.cpu + (Math.random() - 0.5) * 10)),
        cores: 32,
        frequency: 2.4
      },
      memory: {
        used: Math.max(0, Math.min(100, baseValues.memory + (Math.random() - 0.5) * 15)),
        total: 64,
        cached: 12
      },
      network: {
        inbound: Math.max(0, baseValues.network + (Math.random() - 0.5) * 30),
        outbound: Math.max(0, baseValues.network * 0.8 + (Math.random() - 0.5) * 25),
        connections: 450 + Math.floor(Math.random() * 100)
      },
      storage: {
        used: 78,
        total: 500,
        iops: 2500 + Math.floor(Math.random() * 1000)
      },
      swarms: {
        active: Array.from(this.swarms.values()).filter(s => s.status === 'running').length,
        scaling: Array.from(this.swarms.values()).filter(s => s.status === 'scaling').length,
        stopped: Array.from(this.swarms.values()).filter(s => s.status === 'stopped').length
      },
      workers: {
        active: Array.from(this.swarms.values()).reduce((sum, s) => sum + s.workers.active, 0),
        idle: Array.from(this.swarms.values()).reduce((sum, s) => sum + s.workers.idle, 0),
        offline: Array.from(this.swarms.values()).reduce((sum, s) => sum + s.workers.offline, 0)
      },
      tasks: {
        completed: Array.from(this.swarms.values()).reduce((sum, s) => sum + s.tasks.completed, 0),
        running: Array.from(this.swarms.values()).reduce((sum, s) => sum + s.tasks.running, 0),
        queued: Array.from(this.swarms.values()).reduce((sum, s) => sum + s.tasks.queued, 0),
        failed: Array.from(this.swarms.values()).reduce((sum, s) => sum + s.tasks.failed, 0)
      }
    };
  }

  private generateRecentLogs() {
    const logMessages = [
      { level: 'info' as const, message: 'Swarm scaling operation completed successfully', source: 'orchestrator' },
      { level: 'info' as const, message: 'Worker node joined swarm', source: 'worker-manager' },
      { level: 'warn' as const, message: 'High memory usage detected on worker-07', source: 'monitoring' },
      { level: 'info' as const, message: 'Task batch completed: 45 items processed', source: 'task-runner' },
      { level: 'error' as const, message: 'Connection timeout to external API', source: 'http-client' },
      { level: 'info' as const, message: 'Health check passed for all active swarms', source: 'health-monitor' },
      { level: 'debug' as const, message: 'Cache invalidation triggered', source: 'cache-manager' },
      { level: 'info' as const, message: 'New task queued: data-processing-batch-001', source: 'scheduler' },
    ];

    const now = Date.now();
    for (let i = 0; i < 50; i++) {
      const timestamp = new Date(now - i * 30000 - Math.random() * 30000).toISOString();
      const template = logMessages[Math.floor(Math.random() * logMessages.length)];
      
      this.logs.unshift({
        id: `log-${i}-${Date.now()}`,
        timestamp,
        level: template.level,
        source: template.source,
        message: template.message,
        swarmId: Math.random() > 0.7 ? `swarm-${Math.floor(Math.random() * 4) + 1}` : undefined,
        metadata: Math.random() > 0.8 ? { duration: Math.floor(Math.random() * 5000) } : undefined
      });
    }
  }

  private startRealTimeUpdates() {
    // Update metrics every 30 seconds
    const metricsInterval = setInterval(() => {
      const newMetric = this.generateMetrics(new Date().toISOString());
      this.metrics.push(newMetric);
      if (this.metrics.length > 120) this.metrics.shift(); // Keep last 2 hours
      
      this.notifySubscribers('metrics', newMetric);
    }, 30000);

    // Update swarm data every 10 seconds
    const swarmsInterval = setInterval(() => {
      this.updateSwarmData();
      this.notifySubscribers('swarms', Array.from(this.swarms.values()));
    }, 10000);

    // Add new logs every 15-45 seconds
    const logsInterval = setInterval(() => {
      this.addRandomLog();
    }, 15000 + Math.random() * 30000);

    this.intervals.set('metrics', metricsInterval);
    this.intervals.set('swarms', swarmsInterval);
    this.intervals.set('logs', logsInterval);
  }

  private updateSwarmData() {
    this.swarms.forEach((swarm) => {
      // Simulate realistic changes
      if (swarm.status === 'running') {
        // Update task counts
        const completedIncrease = Math.floor(Math.random() * 5);
        swarm.tasks.completed += completedIncrease;
        swarm.tasks.running = Math.max(0, swarm.tasks.running + Math.floor(Math.random() * 3) - 1);
        swarm.tasks.queued = Math.max(0, swarm.tasks.queued + Math.floor(Math.random() * 2) - 1);
        
        // Update performance metrics
        swarm.performance.cpu = Math.max(0, Math.min(100, swarm.performance.cpu + (Math.random() - 0.5) * 10));
        swarm.performance.memory = Math.max(0, Math.min(100, swarm.performance.memory + (Math.random() - 0.5) * 8));
        swarm.performance.throughput = Math.max(0, swarm.performance.throughput + (Math.random() - 0.5) * 50);
        swarm.performance.latency = Math.max(10, swarm.performance.latency + (Math.random() - 0.5) * 20);

        swarm.lastActivity = new Date().toISOString();
      } else if (swarm.status === 'scaling') {
        // Simulate scaling completion
        if (Math.random() > 0.8) {
          swarm.status = 'running';
          swarm.workers.total += 2;
          swarm.workers.active += 2;
        }
      }

      swarm.health.lastCheck = new Date().toISOString();
    });
  }

  private addRandomLog() {
    const levels = ['info', 'warn', 'error', 'debug'] as const;
    const sources = ['orchestrator', 'worker-manager', 'monitoring', 'task-runner', 'scheduler'];
    const messages = [
      'Task execution completed successfully',
      'Worker health check passed',
      'Memory threshold warning',
      'New worker node connected',
      'Task queue processed',
      'Performance optimization applied',
      'Cache refresh triggered',
      'Load balancing adjustment made'
    ];

    const newLog: LogEntry = {
      id: `log-${Date.now()}-${Math.random()}`,
      timestamp: new Date().toISOString(),
      level: levels[Math.floor(Math.random() * levels.length)],
      source: sources[Math.floor(Math.random() * sources.length)],
      message: messages[Math.floor(Math.random() * messages.length)],
      swarmId: Math.random() > 0.6 ? `swarm-${Math.floor(Math.random() * 4) + 1}` : undefined,
    };

    this.logs.unshift(newLog);
    if (this.logs.length > 100) this.logs.pop(); // Keep last 100 logs

    this.notifySubscribers('logs', newLog);
  }

  private notifySubscribers(type: string, data: any) {
    const subscribers = this.subscribers.get(type);
    if (subscribers) {
      subscribers.forEach(callback => callback(data));
    }
  }

  // Public API
  getSwarms(): SwarmTelemetry[] {
    return Array.from(this.swarms.values());
  }

  getSwarm(id: string): SwarmTelemetry | undefined {
    return this.swarms.get(id);
  }

  getMetrics(count = 60): SystemMetrics[] {
    return this.metrics.slice(-count);
  }

  getCurrentMetrics(): SystemMetrics {
    return this.metrics[this.metrics.length - 1];
  }

  getLogs(count = 50): LogEntry[] {
    return this.logs.slice(0, count);
  }

  subscribe(type: 'swarms' | 'metrics' | 'logs', callback: (data: any) => void): () => void {
    if (!this.subscribers.has(type)) {
      this.subscribers.set(type, new Set());
    }
    this.subscribers.get(type)!.add(callback);

    return () => {
      this.subscribers.get(type)?.delete(callback);
    };
  }

  cleanup() {
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals.clear();
    this.subscribers.clear();
  }
}

export const telemetryService = new RealtimeTelemetryService();