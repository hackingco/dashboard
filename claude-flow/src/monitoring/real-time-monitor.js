import chalk from 'chalk';
import { EventEmitter } from 'events';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { swarmManager } from '../agents/swarm-manager.js';
import { memoryManager } from '../memory/memory-manager.js';
import { performanceMonitor } from '../monitoring/performance-monitor.js';
import { trace } from '../instrumentation/index.js';

class RealTimeMonitor extends EventEmitter {
  constructor() {
    super();
    this.events = [];
    this.maxEvents = 1000;
    this.filters = [];
    this.highlights = [];
    this.metrics = {
      eventsPerSecond: 0,
      activeAgents: 0,
      completedTasks: 0,
      failedTasks: 0,
      avgResponseTime: 0,
      memoryUsage: 0,
      cpuUsage: 0
    };
    this.lastMetricUpdate = Date.now();
    this.eventCounters = {};
  }

  async initialize(port = 3333) {
    const app = express();
    const server = createServer(app);
    this.io = new Server(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    // Set up WebSocket connections
    this.io.on('connection', (socket) => {
      console.log(chalk.green('✓') + ' Client connected to real-time monitor');
      
      // Send initial state
      socket.emit('initial-state', {
        events: this.events.slice(-100),
        metrics: this.metrics
      });

      // Handle client filters
      socket.on('set-filter', (filter) => {
        socket.data.filter = filter;
      });

      // Handle client highlights
      socket.on('set-highlight', (pattern) => {
        socket.data.highlight = pattern;
      });

      socket.on('disconnect', () => {
        console.log(chalk.yellow('○') + ' Client disconnected from real-time monitor');
      });
    });

    // Start server
    server.listen(port, () => {
      console.log(chalk.blue('🔊') + ` Real-time monitor server listening on port ${port}`);
    });

    // Start metrics collection
    this.startMetricsCollection();
    
    // Hook into swarm events
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Listen to swarm manager events
    if (swarmManager) {
      swarmManager.on('agent-spawned', (data) => {
        this.addEvent('agent', 'spawned', data);
      });

      swarmManager.on('agent-terminated', (data) => {
        this.addEvent('agent', 'terminated', data);
      });

      swarmManager.on('task-assigned', (data) => {
        this.addEvent('task', 'assigned', data);
      });

      swarmManager.on('task-completed', (data) => {
        this.addEvent('task', 'completed', data);
        this.metrics.completedTasks++;
      });

      swarmManager.on('task-failed', (data) => {
        this.addEvent('task', 'failed', data);
        this.metrics.failedTasks++;
      });
    }

    // Listen to memory manager events
    if (memoryManager) {
      memoryManager.on('memory-stored', (data) => {
        this.addEvent('memory', 'stored', data);
      });

      memoryManager.on('memory-retrieved', (data) => {
        this.addEvent('memory', 'retrieved', data);
      });
    }

    // Listen to performance monitor events
    if (performanceMonitor) {
      performanceMonitor.on('metrics-updated', (metrics) => {
        this.metrics.cpuUsage = metrics.cpu;
        this.metrics.memoryUsage = metrics.memory;
        this.metrics.avgResponseTime = metrics.avgResponseTime || 0;
      });
    }
  }

  addEvent(category, type, data) {
    const event = {
      id: Date.now() + Math.random(),
      timestamp: new Date().toISOString(),
      category,
      type,
      data,
      level: this.determineLevel(category, type)
    };

    // Add to events array
    this.events.push(event);
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    // Update counters
    const key = `${category}.${type}`;
    this.eventCounters[key] = (this.eventCounters[key] || 0) + 1;

    // Emit to WebSocket clients
    if (this.io) {
      this.io.sockets.sockets.forEach((socket) => {
        if (this.shouldSendEvent(event, socket.data)) {
          socket.emit('event', event);
        }
      });
    }

    // Emit locally
    this.emit('event', event);
  }

  shouldSendEvent(event, clientData = {}) {
    // Apply filters
    if (clientData.filter) {
      if (clientData.filter.category && event.category !== clientData.filter.category) {
        return false;
      }
      if (clientData.filter.type && event.type !== clientData.filter.type) {
        return false;
      }
      if (clientData.filter.level && event.level !== clientData.filter.level) {
        return false;
      }
    }

    return true;
  }

  determineLevel(category, type) {
    if (type === 'failed' || type === 'error') return 'error';
    if (type === 'warning' || type === 'slow') return 'warning';
    if (type === 'completed' || type === 'success') return 'success';
    return 'info';
  }

  startMetricsCollection() {
    setInterval(() => {
      // Calculate events per second
      const now = Date.now();
      const timeDelta = (now - this.lastMetricUpdate) / 1000;
      const eventsDelta = this.events.filter(e => 
        new Date(e.timestamp).getTime() > this.lastMetricUpdate
      ).length;
      
      this.metrics.eventsPerSecond = eventsDelta / timeDelta;
      this.lastMetricUpdate = now;

      // Update active agents
      if (swarmManager) {
        this.metrics.activeAgents = swarmManager.getActiveAgentCount();
      }

      // Emit metrics update
      if (this.io) {
        this.io.emit('metrics', this.metrics);
      }
    }, 1000);
  }

  getFilteredEvents(filter) {
    return this.events.filter(event => {
      if (filter.category && event.category !== filter.category) return false;
      if (filter.type && event.type !== filter.type) return false;
      if (filter.level && event.level !== filter.level) return false;
      if (filter.pattern) {
        const regex = new RegExp(filter.pattern, 'i');
        return regex.test(JSON.stringify(event));
      }
      return true;
    });
  }

  getMetrics() {
    return {
      ...this.metrics,
      eventCounts: this.eventCounters,
      totalEvents: this.events.length
    };
  }

  clear() {
    this.events = [];
    this.eventCounters = {};
    this.metrics.completedTasks = 0;
    this.metrics.failedTasks = 0;
  }
}

// Export singleton instance
export const realTimeMonitor = new RealTimeMonitor();

// Instrumented version
export const monitor = trace(async (options = {}) => {
  const { duration = 10, interval = 1, filter = null, highlight = null } = options;
  
  return new Promise((resolve) => {
    const startTime = Date.now();
    const collectedData = {
      events: [],
      metrics: [],
      summary: {}
    };

    // Collect events
    const eventHandler = (event) => {
      if (!filter || (
        (!filter.category || event.category === filter.category) &&
        (!filter.type || event.type === filter.type) &&
        (!filter.level || event.level === filter.level)
      )) {
        collectedData.events.push(event);
      }
    };

    realTimeMonitor.on('event', eventHandler);

    // Collect metrics at intervals
    const metricsInterval = setInterval(() => {
      collectedData.metrics.push({
        timestamp: new Date().toISOString(),
        ...realTimeMonitor.getMetrics()
      });
    }, interval * 1000);

    // Stop after duration
    setTimeout(() => {
      clearInterval(metricsInterval);
      realTimeMonitor.off('event', eventHandler);

      // Generate summary
      collectedData.summary = {
        duration,
        totalEvents: collectedData.events.length,
        eventsPerSecond: collectedData.events.length / duration,
        eventsByCategory: {},
        eventsByType: {},
        finalMetrics: realTimeMonitor.getMetrics()
      };

      // Count events by category and type
      collectedData.events.forEach(event => {
        collectedData.summary.eventsByCategory[event.category] = 
          (collectedData.summary.eventsByCategory[event.category] || 0) + 1;
        
        const key = `${event.category}.${event.type}`;
        collectedData.summary.eventsByType[key] = 
          (collectedData.summary.eventsByType[key] || 0) + 1;
      });

      resolve(collectedData);
    }, duration * 1000);
  });
});