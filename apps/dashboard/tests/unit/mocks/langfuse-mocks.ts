import { vi } from 'vitest';

// Mock Langfuse API responses
export const mockLangfuseTraces = [
  {
    id: 'trace-1',
    name: 'API Request Processing',
    sessionId: 'session-123',
    userId: 'user-456',
    timestamp: new Date('2024-01-01T10:00:00Z'),
    duration: 1500,
    status: 'success',
    model: 'gpt-4',
    promptTokens: 150,
    completionTokens: 75,
    totalCost: 0.004,
    input: 'Process incoming API request for user data',
    output: 'Successfully processed request and returned user profile data',
    metadata: {
      agentId: 'api-agent-001',
      temperature: 0.7,
      maxTokens: 2048,
      endpoint: '/api/users/profile',
      httpMethod: 'GET',
      responseCode: 200,
    },
    tags: ['api', 'user-data', 'success'],
    scores: {
      quality: 0.95,
      relevance: 0.92,
      efficiency: 0.88,
      accuracy: 0.96,
    },
    memoryUsage: 128,
    cpuUsage: 25,
    agentId: 'api-agent-001',
    swarmId: 'api-processing-swarm',
  },
  {
    id: 'trace-2',
    name: 'Database Query Optimization',
    sessionId: 'session-124',
    userId: 'system',
    timestamp: new Date('2024-01-01T10:02:30Z'),
    duration: 850,
    status: 'running',
    model: 'claude-3-sonnet',
    promptTokens: 200,
    completionTokens: 100,
    totalCost: 0.003,
    input: 'Optimize database query for better performance',
    output: 'Query optimization in progress...',
    metadata: {
      agentId: 'db-optimizer-002',
      queryType: 'SELECT',
      tableName: 'user_profiles',
      indexesUsed: ['idx_user_id', 'idx_created_at'],
    },
    tags: ['database', 'optimization', 'performance'],
    scores: {
      quality: 0.78,
      relevance: 0.85,
      efficiency: 0.92,
    },
    memoryUsage: 256,
    cpuUsage: 45,
    agentId: 'db-optimizer-002',
    swarmId: 'database-optimization-swarm',
  },
  {
    id: 'trace-3',
    name: 'Error Handling and Recovery',
    sessionId: 'session-125',
    userId: 'error-handler',
    timestamp: new Date('2024-01-01T10:05:15Z'),
    duration: 2200,
    status: 'error',
    model: 'gpt-3.5-turbo',
    promptTokens: 300,
    completionTokens: 50,
    totalCost: 0.002,
    input: 'Handle unexpected error in payment processing',
    output: 'Error: Payment gateway timeout after 30 seconds',
    metadata: {
      agentId: 'error-handler-003',
      errorType: 'TimeoutError',
      errorCode: 'PAYMENT_GATEWAY_TIMEOUT',
      retryAttempts: 3,
      recoveryAction: 'fallback_to_secondary_gateway',
    },
    tags: ['error', 'payment', 'timeout', 'recovery'],
    scores: {
      quality: 0.45,
      relevance: 0.88,
      efficiency: 0.35,
    },
    memoryUsage: 192,
    cpuUsage: 15,
    agentId: 'error-handler-003',
    swarmId: 'error-recovery-swarm',
  },
];

export const mockLangfuseAgents = [
  {
    id: 'api-agent-001',
    name: 'API Request Handler',
    status: 'active' as const,
    currentTask: 'Processing authentication requests',
    tasksCompleted: 156,
    averageResponseTime: 450,
    memoryUsage: 45,
    cpuUsage: 30,
    lastActivity: new Date('2024-01-01T10:00:00Z'),
    swarmId: 'api-processing-swarm',
    metadata: {
      specialization: 'authentication',
      version: '2.1.0',
      capabilities: ['jwt-validation', 'rate-limiting', 'session-management'],
    },
  },
  {
    id: 'db-optimizer-002',
    name: 'Database Optimizer',
    status: 'active' as const,
    currentTask: 'Analyzing query performance metrics',
    tasksCompleted: 89,
    averageResponseTime: 680,
    memoryUsage: 62,
    cpuUsage: 55,
    lastActivity: new Date('2024-01-01T10:02:30Z'),
    swarmId: 'database-optimization-swarm',
    metadata: {
      specialization: 'query-optimization',
      databaseType: 'postgresql',
      capabilities: ['index-analysis', 'query-rewriting', 'performance-monitoring'],
    },
  },
  {
    id: 'error-handler-003',
    name: 'Error Recovery Agent',
    status: 'idle' as const,
    currentTask: undefined,
    tasksCompleted: 23,
    averageResponseTime: 1200,
    memoryUsage: 28,
    cpuUsage: 8,
    lastActivity: new Date('2024-01-01T10:05:15Z'),
    swarmId: 'error-recovery-swarm',
    metadata: {
      specialization: 'error-handling',
      alertThreshold: 'high',
      capabilities: ['exception-analysis', 'auto-recovery', 'incident-reporting'],
    },
  },
  {
    id: 'monitor-agent-004',
    name: 'System Monitor',
    status: 'error' as const,
    currentTask: 'Restarting after system update',
    tasksCompleted: 345,
    averageResponseTime: 200,
    memoryUsage: 85,
    cpuUsage: 70,
    lastActivity: new Date('2024-01-01T09:58:00Z'),
    swarmId: 'monitoring-swarm',
    metadata: {
      specialization: 'system-monitoring',
      alertsEnabled: true,
      capabilities: ['health-checks', 'metric-collection', 'alerting'],
    },
  },
  {
    id: 'analytics-agent-005',
    name: 'Analytics Processor',
    status: 'offline' as const,
    currentTask: undefined,
    tasksCompleted: 78,
    averageResponseTime: 950,
    memoryUsage: 0,
    cpuUsage: 0,
    lastActivity: new Date('2024-01-01T09:45:00Z'),
    swarmId: 'analytics-swarm',
    metadata: {
      specialization: 'data-analytics',
      scheduledDowntime: true,
      capabilities: ['data-processing', 'trend-analysis', 'reporting'],
    },
  },
];

export const mockSwarmMetrics = {
  totalTraces: 150,
  activeTraces: 12,
  totalAgents: 5,
  activeAgents: 3,
  totalTasks: 891,
  completedTasks: 845,
  failedTasks: 23,
  averageResponseTime: 750,
  throughput: 45,
  errorRate: 2.6,
  totalCost: 1.25,
  tokenUsage: {
    prompt: 8500,
    completion: 4200,
    total: 12700,
  },
};

// Mock API responses
export const mockApiResponses = {
  traces: {
    success: {
      data: mockLangfuseTraces,
      meta: {
        total: mockLangfuseTraces.length,
        page: 1,
        limit: 10,
      },
    },
    error: {
      error: 'Failed to fetch traces',
      code: 'API_ERROR',
      status: 500,
    },
  },
  metrics: {
    success: mockSwarmMetrics,
    error: {
      error: 'Failed to fetch metrics',
      code: 'METRICS_ERROR',
      status: 500,
    },
  },
};

// Mock event data for real-time testing
export const mockRealtimeEvents = {
  traceCreated: {
    type: 'trace_created',
    payload: mockLangfuseTraces[0],
    timestamp: new Date().toISOString(),
  },
  traceUpdated: {
    type: 'trace_updated',
    payload: {
      ...mockLangfuseTraces[1],
      status: 'success',
      duration: 1200,
      output: 'Database query optimization completed successfully',
    },
    timestamp: new Date().toISOString(),
  },
  agentStatus: {
    type: 'agent_status',
    payload: {
      ...mockLangfuseAgents[0],
      status: 'idle',
      currentTask: undefined,
      tasksCompleted: 157,
    },
    timestamp: new Date().toISOString(),
  },
  swarmMetrics: {
    type: 'swarm_metrics',
    payload: {
      ...mockSwarmMetrics,
      activeTraces: 15,
      completedTasks: 847,
      throughput: 48,
    },
    timestamp: new Date().toISOString(),
  },
  heartbeat: {
    type: 'heartbeat',
    payload: { status: 'alive' },
    timestamp: new Date().toISOString(),
  },
};

// Mock fetch responses
export const createMockFetch = (scenario: 'success' | 'error' | 'timeout' = 'success') => {
  return vi.fn().mockImplementation((url: string) => {
    if (scenario === 'timeout') {
      return new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 100);
      });
    }

    if (scenario === 'error') {
      return Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.resolve(mockApiResponses.traces.error),
      });
    }

    // Success scenario
    if (url.includes('/traces')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockApiResponses.traces.success),
      });
    }

    if (url.includes('/metrics')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockApiResponses.metrics.success),
      });
    }

    // Default response
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    });
  });
};

// Mock WebSocket for real-time testing
export class MockWebSocket {
  public readyState: number = WebSocket.CONNECTING;
  public onopen?: (event: Event) => void;
  public onclose?: (event: CloseEvent) => void;
  public onerror?: (event: Event) => void;
  public onmessage?: (event: MessageEvent) => void;

  private messageQueue: string[] = [];

  constructor(public url: string) {
    // Simulate connection delay
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      this.onopen?.(new Event('open'));
    }, 10);
  }

  send(data: string) {
    this.messageQueue.push(data);
  }

  close() {
    this.readyState = WebSocket.CLOSED;
    this.onclose?.(new CloseEvent('close'));
  }

  // Test helper methods
  simulateMessage(data: any) {
    if (this.readyState === WebSocket.OPEN && this.onmessage) {
      this.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }));
    }
  }

  simulateError() {
    this.onerror?.(new Event('error'));
  }

  simulateClose() {
    this.readyState = WebSocket.CLOSED;
    this.onclose?.(new CloseEvent('close'));
  }

  getLastMessage() {
    return this.messageQueue[this.messageQueue.length - 1];
  }

  getAllMessages() {
    return [...this.messageQueue];
  }

  clearMessages() {
    this.messageQueue = [];
  }
}

// Mock Langfuse client for testing
export const createMockLangfuseClient = () => {
  const mockClient = {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    isRealtimeConnected: vi.fn(() => true),
    reconnect: vi.fn(),
    disconnect: vi.fn(),
    getTraces: vi.fn(() => Promise.resolve(mockLangfuseTraces)),
    getSwarmMetrics: vi.fn(() => Promise.resolve(mockSwarmMetrics)),
    createTrace: vi.fn(() => Promise.resolve('new-trace-id')),
    updateTrace: vi.fn(() => Promise.resolve(true)),
    shutdown: vi.fn(() => Promise.resolve()),
  };

  // Setup event emitter behavior
  const eventCallbacks = new Map<string, Set<Function>>();

  mockClient.on.mockImplementation((event: string, callback: Function) => {
    if (!eventCallbacks.has(event)) {
      eventCallbacks.set(event, new Set());
    }
    eventCallbacks.get(event)!.add(callback);
  });

  mockClient.off.mockImplementation((event: string, callback: Function) => {
    if (eventCallbacks.has(event)) {
      eventCallbacks.get(event)!.delete(callback);
    }
  });

  mockClient.emit.mockImplementation((event: string, ...args: any[]) => {
    if (eventCallbacks.has(event)) {
      eventCallbacks.get(event)!.forEach(callback => callback(...args));
    }
  });

  // Add helper method to trigger events for testing
  (mockClient as any).triggerEvent = (event: string, ...args: any[]) => {
    mockClient.emit(event, ...args);
  };

  return mockClient;
};

// Test data generators
export const generateMockTrace = (overrides: Partial<typeof mockLangfuseTraces[0]> = {}) => ({
  ...mockLangfuseTraces[0],
  id: `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  timestamp: new Date(),
  ...overrides,
});

export const generateMockAgent = (overrides: Partial<typeof mockLangfuseAgents[0]> = {}) => ({
  ...mockLangfuseAgents[0],
  id: `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  lastActivity: new Date(),
  ...overrides,
});

export const generateMockMetrics = (overrides: Partial<typeof mockSwarmMetrics> = {}) => ({
  ...mockSwarmMetrics,
  ...overrides,
});

// Test scenarios
export const testScenarios = {
  // High activity scenario
  highActivity: {
    traces: Array.from({ length: 50 }, (_, i) => 
      generateMockTrace({
        id: `high-activity-trace-${i}`,
        status: Math.random() > 0.1 ? 'success' : 'error',
        duration: Math.floor(Math.random() * 2000) + 100,
      })
    ),
    agents: Array.from({ length: 8 }, (_, i) => 
      generateMockAgent({
        id: `high-activity-agent-${i}`,
        status: Math.random() > 0.2 ? 'active' : 'idle',
        tasksCompleted: Math.floor(Math.random() * 200) + 50,
      })
    ),
    metrics: generateMockMetrics({
      activeTraces: 25,
      throughput: 85,
      errorRate: 8.5,
    }),
  },

  // Low activity scenario
  lowActivity: {
    traces: Array.from({ length: 5 }, (_, i) => 
      generateMockTrace({
        id: `low-activity-trace-${i}`,
        status: 'success',
        duration: Math.floor(Math.random() * 500) + 200,
      })
    ),
    agents: Array.from({ length: 3 }, (_, i) => 
      generateMockAgent({
        id: `low-activity-agent-${i}`,
        status: i === 0 ? 'active' : 'idle',
        tasksCompleted: Math.floor(Math.random() * 50) + 10,
      })
    ),
    metrics: generateMockMetrics({
      activeTraces: 2,
      throughput: 12,
      errorRate: 1.2,
    }),
  },

  // Error scenario
  errorScenario: {
    traces: Array.from({ length: 10 }, (_, i) => 
      generateMockTrace({
        id: `error-trace-${i}`,
        status: Math.random() > 0.3 ? 'error' : 'success',
        duration: Math.floor(Math.random() * 3000) + 500,
      })
    ),
    agents: Array.from({ length: 5 }, (_, i) => 
      generateMockAgent({
        id: `error-agent-${i}`,
        status: i < 2 ? 'error' : i < 4 ? 'active' : 'idle',
        tasksCompleted: Math.floor(Math.random() * 100) + 20,
      })
    ),
    metrics: generateMockMetrics({
      activeTraces: 8,
      throughput: 35,
      errorRate: 25.8,
      failedTasks: 45,
    }),
  },
};

export default {
  mockLangfuseTraces,
  mockLangfuseAgents,
  mockSwarmMetrics,
  mockApiResponses,
  mockRealtimeEvents,
  createMockFetch,
  MockWebSocket,
  createMockLangfuseClient,
  generateMockTrace,
  generateMockAgent,
  generateMockMetrics,
  testScenarios,
};