import { EventEmitter } from 'events';
import { trace } from '../instrumentation/index.js';

class EventCollector extends EventEmitter {
  constructor() {
    super();
    this.eventSources = new Map();
    this.eventBuffer = [];
    this.bufferSize = 10000;
    this.aggregators = new Map();
    this.started = false;
  }

  registerSource(name, source, eventMappings) {
    if (this.eventSources.has(name)) {
      console.warn(`Event source ${name} already registered`);
      return;
    }

    this.eventSources.set(name, {
      source,
      eventMappings,
      eventCount: 0
    });

    // Set up listeners for the source
    Object.entries(eventMappings).forEach(([sourceEvent, mappedEvent]) => {
      source.on(sourceEvent, (...args) => {
        this.collectEvent(name, mappedEvent, args);
      });
    });
  }

  collectEvent(sourceName, eventType, args) {
    const event = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      source: sourceName,
      type: eventType,
      data: this.extractEventData(args),
      metadata: {
        processId: process.pid,
        hostname: process.env.HOSTNAME || 'unknown'
      }
    };

    // Add to buffer
    this.eventBuffer.push(event);
    if (this.eventBuffer.length > this.bufferSize) {
      this.eventBuffer.shift();
    }

    // Update source counter
    const source = this.eventSources.get(sourceName);
    if (source) {
      source.eventCount++;
    }

    // Run aggregators
    this.runAggregators(event);

    // Emit the event
    this.emit('event', event);
    this.emit(`event:${eventType}`, event);
  }

  extractEventData(args) {
    // Handle different argument patterns
    if (args.length === 0) return {};
    if (args.length === 1) {
      if (typeof args[0] === 'object') return args[0];
      return { value: args[0] };
    }
    return { args };
  }

  registerAggregator(name, aggregator) {
    this.aggregators.set(name, {
      aggregator,
      state: aggregator.initialState ? aggregator.initialState() : {}
    });
  }

  runAggregators(event) {
    this.aggregators.forEach((config, name) => {
      try {
        config.state = config.aggregator.process(event, config.state);
      } catch (error) {
        console.error(`Aggregator ${name} error:`, error);
      }
    });
  }

  getAggregatorState(name) {
    const config = this.aggregators.get(name);
    return config ? config.state : null;
  }

  getAllAggregatorStates() {
    const states = {};
    this.aggregators.forEach((config, name) => {
      states[name] = config.state;
    });
    return states;
  }

  getEvents(filter = {}) {
    let events = [...this.eventBuffer];

    if (filter.source) {
      events = events.filter(e => e.source === filter.source);
    }

    if (filter.type) {
      events = events.filter(e => e.type === filter.type);
    }

    if (filter.startTime) {
      const startTime = new Date(filter.startTime).getTime();
      events = events.filter(e => new Date(e.timestamp).getTime() >= startTime);
    }

    if (filter.endTime) {
      const endTime = new Date(filter.endTime).getTime();
      events = events.filter(e => new Date(e.timestamp).getTime() <= endTime);
    }

    if (filter.limit) {
      events = events.slice(-filter.limit);
    }

    return events;
  }

  getSourceStats() {
    const stats = {};
    this.eventSources.forEach((source, name) => {
      stats[name] = {
        eventCount: source.eventCount,
        eventTypes: Object.values(source.eventMappings)
      };
    });
    return stats;
  }

  clear() {
    this.eventBuffer = [];
    this.eventSources.forEach(source => {
      source.eventCount = 0;
    });
    this.aggregators.forEach(config => {
      if (config.aggregator.initialState) {
        config.state = config.aggregator.initialState();
      } else {
        config.state = {};
      }
    });
  }

  start() {
    if (this.started) return;
    this.started = true;
    this.emit('started');
  }

  stop() {
    if (!this.started) return;
    this.started = false;
    this.emit('stopped');
  }
}

// Create singleton instance
export const eventCollector = new EventCollector();

// Built-in aggregators
export const aggregators = {
  eventCounter: {
    initialState: () => ({ total: 0, byType: {}, bySource: {} }),
    process: (event, state) => {
      state.total++;
      state.byType[event.type] = (state.byType[event.type] || 0) + 1;
      state.bySource[event.source] = (state.bySource[event.source] || 0) + 1;
      return state;
    }
  },

  errorTracker: {
    initialState: () => ({ errors: [], errorCount: 0, lastError: null }),
    process: (event, state) => {
      if (event.type.includes('error') || event.type.includes('failed')) {
        state.errors.push({
          timestamp: event.timestamp,
          type: event.type,
          source: event.source,
          data: event.data
        });
        if (state.errors.length > 100) {
          state.errors.shift();
        }
        state.errorCount++;
        state.lastError = event.timestamp;
      }
      return state;
    }
  },

  performanceTracker: {
    initialState: () => ({ 
      taskDurations: [],
      avgDuration: 0,
      minDuration: Infinity,
      maxDuration: 0
    }),
    process: (event, state) => {
      if (event.type === 'task.completed' && event.data.duration) {
        const duration = event.data.duration;
        state.taskDurations.push(duration);
        if (state.taskDurations.length > 1000) {
          state.taskDurations.shift();
        }
        
        state.avgDuration = state.taskDurations.reduce((a, b) => a + b, 0) / state.taskDurations.length;
        state.minDuration = Math.min(state.minDuration, duration);
        state.maxDuration = Math.max(state.maxDuration, duration);
      }
      return state;
    }
  },

  rateTracker: {
    initialState: () => ({ 
      windows: {},
      rates: {}
    }),
    process: (event, state) => {
      const now = Date.now();
      const windowSize = 60000; // 1 minute windows
      const windowKey = Math.floor(now / windowSize);
      
      if (!state.windows[windowKey]) {
        state.windows[windowKey] = { total: 0, byType: {} };
      }
      
      state.windows[windowKey].total++;
      state.windows[windowKey].byType[event.type] = 
        (state.windows[windowKey].byType[event.type] || 0) + 1;
      
      // Clean old windows
      const oldWindowKey = windowKey - 5;
      Object.keys(state.windows).forEach(key => {
        if (parseInt(key) < oldWindowKey) {
          delete state.windows[key];
        }
      });
      
      // Calculate rates
      const recentWindows = Object.values(state.windows);
      if (recentWindows.length > 0) {
        const totalEvents = recentWindows.reduce((sum, w) => sum + w.total, 0);
        state.rates.eventsPerMinute = totalEvents / recentWindows.length;
        
        // Calculate rates by type
        state.rates.byType = {};
        const allTypes = new Set();
        recentWindows.forEach(w => {
          Object.keys(w.byType).forEach(type => allTypes.add(type));
        });
        
        allTypes.forEach(type => {
          const typeTotal = recentWindows.reduce((sum, w) => sum + (w.byType[type] || 0), 0);
          state.rates.byType[type] = typeTotal / recentWindows.length;
        });
      }
      
      return state;
    }
  }
};

// Register default aggregators
Object.entries(aggregators).forEach(([name, aggregator]) => {
  eventCollector.registerAggregator(name, aggregator);
});

// Instrumented collection function
export const collectEvents = trace(async (options = {}) => {
  const { duration = 10, filter = {} } = options;
  
  return new Promise((resolve) => {
    const collectedEvents = [];
    
    const handler = (event) => {
      if (!filter.type || event.type === filter.type) {
        if (!filter.source || event.source === filter.source) {
          collectedEvents.push(event);
        }
      }
    };
    
    eventCollector.on('event', handler);
    
    setTimeout(() => {
      eventCollector.off('event', handler);
      
      resolve({
        events: collectedEvents,
        stats: eventCollector.getSourceStats(),
        aggregators: eventCollector.getAllAggregatorStates(),
        summary: {
          totalCollected: collectedEvents.length,
          duration,
          eventsPerSecond: collectedEvents.length / duration
        }
      });
    }, duration * 1000);
  });
});