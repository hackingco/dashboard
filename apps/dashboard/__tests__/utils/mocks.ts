import { vi } from 'vitest';

// Supabase client mock
export const createSupabaseMock = () => {
  const mockChannel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnValue({
      unsubscribe: vi.fn(),
    }),
    unsubscribe: vi.fn(),
  };

  const mockSupabase = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn(),
    channel: vi.fn().mockReturnValue(mockChannel),
  };

  const mockSwarmOperations = {
    create: vi.fn(),
    update: vi.fn(),
    get: vi.fn(),
    list: vi.fn(),
    delete: vi.fn(),
    subscribe: vi.fn().mockReturnValue({
      unsubscribe: vi.fn(),
    }),
  };

  return {
    supabase: mockSupabase,
    swarmOperations: mockSwarmOperations,
    mockChannel,
  };
};

// Machines API mock
export const createMachinesApiMock = () => ({
  listApps: vi.fn(),
  createApp: vi.fn(),
  deleteApp: vi.fn(),
  listMachines: vi.fn(),
  getMachine: vi.fn(),
  createMachine: vi.fn(),
  updateMachine: vi.fn(),
  deleteMachine: vi.fn(),
  startMachine: vi.fn(),
  stopMachine: vi.fn(),
  restartMachine: vi.fn(),
  suspendMachine: vi.fn(),
  signalMachine: vi.fn(),
  getMachineEvents: vi.fn(),
  waitForMachineState: vi.fn(),
  listMachineProcesses: vi.fn(),
  execMachine: vi.fn(),
  getMachineLease: vi.fn(),
  createMachineLease: vi.fn(),
  deleteMachineLease: vi.fn(),
  listVolumes: vi.fn(),
  getVolume: vi.fn(),
  createVolume: vi.fn(),
  updateVolume: vi.fn(),
  deleteVolume: vi.fn(),
  extendVolume: vi.fn(),
  getSwarmStatus: vi.fn(),
  scaleSwarm: vi.fn(),
});

// Langfuse mock
export const createLangfuseMock = () => ({
  trace: vi.fn().mockReturnValue({
    generation: vi.fn().mockReturnValue({
      end: vi.fn(),
    }),
    span: vi.fn().mockReturnValue({
      end: vi.fn(),
    }),
    update: vi.fn(),
    end: vi.fn(),
  }),
  generation: vi.fn().mockReturnValue({
    end: vi.fn(),
  }),
  span: vi.fn().mockReturnValue({
    end: vi.fn(),
  }),
  score: vi.fn(),
  event: vi.fn(),
  shutdown: vi.fn(),
  flush: vi.fn(),
});

// React Query mock
export const createReactQueryMock = () => ({
  useQuery: vi.fn().mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useMutation: vi.fn().mockReturnValue({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isLoading: false,
    isError: false,
    error: null,
    data: undefined,
  }),
  useQueryClient: vi.fn().mockReturnValue({
    invalidateQueries: vi.fn(),
    setQueryData: vi.fn(),
    getQueryData: vi.fn(),
    prefetchQuery: vi.fn(),
  }),
});

// WebSocket mock factory
export const createWebSocketMock = () => {
  const eventListeners: Record<string, Function[]> = {};
  
  const mockWS = {
    addEventListener: vi.fn((event: string, handler: Function) => {
      if (!eventListeners[event]) eventListeners[event] = [];
      eventListeners[event].push(handler);
    }),
    removeEventListener: vi.fn((event: string, handler: Function) => {
      if (eventListeners[event]) {
        eventListeners[event] = eventListeners[event].filter(h => h !== handler);
      }
    }),
    send: vi.fn(),
    close: vi.fn(),
    readyState: 1, // OPEN
    
    // Test utilities
    mockOpen: () => {
      mockWS.readyState = 1;
      eventListeners.open?.forEach(handler => handler({}));
    },
    mockClose: (code = 1000, reason = 'Normal closure') => {
      mockWS.readyState = 3;
      eventListeners.close?.forEach(handler => handler({ code, reason }));
    },
    mockMessage: (data: any) => {
      eventListeners.message?.forEach(handler => 
        handler({ data: typeof data === 'string' ? data : JSON.stringify(data) })
      );
    },
    mockError: (error: any) => {
      eventListeners.error?.forEach(handler => handler({ error }));
    },
  };
  
  return mockWS;
};

// EventSource mock factory
export const createEventSourceMock = () => {
  const eventListeners: Record<string, Function[]> = {};
  
  const mockES = {
    addEventListener: vi.fn((event: string, handler: Function) => {
      if (!eventListeners[event]) eventListeners[event] = [];
      eventListeners[event].push(handler);
    }),
    close: vi.fn(),
    readyState: 1, // OPEN
    
    // Test utilities
    mockMessage: (data: any, eventType = 'message') => {
      const eventData = {
        data: typeof data === 'string' ? data : JSON.stringify(data),
        type: eventType,
      };
      eventListeners[eventType]?.forEach(handler => handler(eventData));
    },
    mockError: () => {
      mockES.readyState = 2; // CLOSED
      eventListeners.error?.forEach(handler => handler({}));
    },
  };
  
  return mockES;
};

// Performance Observer mock
export const createPerformanceObserverMock = () => ({
  observe: vi.fn(),
  disconnect: vi.fn(),
  takeRecords: vi.fn().mockReturnValue([]),
});

// Intersection Observer mock
export const createIntersectionObserverMock = () => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  root: null,
  rootMargin: '',
  thresholds: [],
});

// Resize Observer mock
export const createResizeObserverMock = () => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
});

// File API mock
export const createFileMock = (name: string, content: string, type = 'text/plain') => {
  const file = new File([content], name, { type });
  Object.defineProperty(file, 'size', { value: content.length });
  return file;
};

// Blob mock
export const createBlobMock = (content: string, type = 'text/plain') => {
  const blob = new Blob([content], { type });
  Object.defineProperty(blob, 'size', { value: content.length });
  return blob;
};

// URL mock
export const createURLMock = () => ({
  createObjectURL: vi.fn().mockReturnValue('blob:mock-url'),
  revokeObjectURL: vi.fn(),
});

// Timer utilities
export const createTimerUtils = () => ({
  mockSetTimeout: vi.fn(global.setTimeout),
  mockSetInterval: vi.fn(global.setInterval),
  mockClearTimeout: vi.fn(global.clearTimeout),
  mockClearInterval: vi.fn(global.clearInterval),
  
  // Fast-forward time
  fastForward: (ms: number) => {
    vi.advanceTimersByTime(ms);
  },
  
  // Run all timers
  runAllTimers: () => {
    vi.runAllTimers();
  },
  
  // Run only timers
  runOnlyPendingTimers: () => {
    vi.runOnlyPendingTimers();
  },
});

// Form data mock
export const createFormDataMock = (initialData: Record<string, string> = {}) => {
  const data: Record<string, string> = { ...initialData };
  
  return {
    append: vi.fn((key: string, value: string) => {
      data[key] = value;
    }),
    delete: vi.fn((key: string) => {
      delete data[key];
    }),
    get: vi.fn((key: string) => data[key] || null),
    getAll: vi.fn((key: string) => data[key] ? [data[key]] : []),
    has: vi.fn((key: string) => key in data),
    set: vi.fn((key: string, value: string) => {
      data[key] = value;
    }),
    entries: vi.fn(() => Object.entries(data)[Symbol.iterator]()),
    keys: vi.fn(() => Object.keys(data)[Symbol.iterator]()),
    values: vi.fn(() => Object.values(data)[Symbol.iterator]()),
    forEach: vi.fn((callback: Function) => {
      Object.entries(data).forEach(([key, value]) => callback(value, key));
    }),
    
    // Test utility
    getData: () => ({ ...data }),
  };
};

// Mock data generators
export const generateMockSwarms = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    id: `swarm-${i + 1}`,
    name: `Test Swarm ${i + 1}`,
    purpose: `Purpose for swarm ${i + 1}`,
    status: ['running', 'stopped', 'error', 'creating'][i % 4],
    worker_count: Math.floor(Math.random() * 10) + 1,
    config: {
      maxWorkers: Math.floor(Math.random() * 20) + 5,
      cpus: [1, 2, 4, 8][Math.floor(Math.random() * 4)],
      memory: [256, 512, 1024, 2048][Math.floor(Math.random() * 4)],
    },
    metrics: {
      tasks_completed: Math.floor(Math.random() * 1000),
      average_task_duration: Math.floor(Math.random() * 5000) + 100,
      error_rate: Math.random() * 0.1,
    },
    created_at: new Date(Date.now() - Math.random() * 86400000 * 7).toISOString(),
    updated_at: new Date(Date.now() - Math.random() * 3600000).toISOString(),
    error: Math.random() > 0.8 ? 'Sample error message' : null,
    app_name: `app-${i + 1}`,
  }));
};

export const generateMockMachines = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    id: `machine-${i + 1}`,
    name: `machine-${i + 1}`,
    state: ['started', 'stopped', 'destroyed', 'starting'][i % 4],
    region: ['dfw', 'ord', 'lax', 'fra'][i % 4],
    instance_id: `instance-${i + 1}`,
    private_ip: `172.16.0.${i + 1}`,
    config: {
      image: 'nginx:latest',
      env: { NODE_ENV: 'production', INSTANCE_ID: `${i + 1}` },
      guest: { 
        cpus: [1, 2, 4][i % 3], 
        memory_mb: [256, 512, 1024][i % 3] 
      },
      services: [{
        internal_port: 8080,
        protocol: 'tcp',
        ports: [{ port: 80 + i }]
      }]
    },
    created_at: new Date(Date.now() - Math.random() * 86400000 * 7).toISOString(),
    updated_at: new Date(Date.now() - Math.random() * 3600000).toISOString(),
    events: [],
  }));
};

export const generateMockTraces = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    id: `trace-${i + 1}`,
    name: `Trace ${i + 1}`,
    timestamp: new Date(Date.now() - Math.random() * 3600000).toISOString(),
    duration: Math.floor(Math.random() * 5000) + 100,
    status: ['success', 'error', 'pending'][i % 3],
    input: { message: `Input message ${i + 1}` },
    output: { response: `Output response ${i + 1}` },
    metadata: {
      swarm_id: `swarm-${Math.floor(i / 3) + 1}`,
      worker_id: `worker-${(i % 3) + 1}`,
      model: 'claude-3-opus',
    },
    tags: ['test', 'automated', `batch-${Math.floor(i / 5) + 1}`],
  }));
};

// Environment mock utilities
export const mockEnvironment = (env: Record<string, string>) => {
  const original = { ...process.env };
  
  Object.assign(process.env, env);
  
  return () => {
    process.env = original;
  };
};

// Network status mock
export const createNetworkStatusMock = (online = true) => {
  Object.defineProperty(navigator, 'onLine', {
    writable: true,
    value: online,
  });
  
  return {
    setOnline: (status: boolean) => {
      Object.defineProperty(navigator, 'onLine', { value: status });
      
      const event = new Event(status ? 'online' : 'offline');
      window.dispatchEvent(event);
    },
  };
};

export * from './test-utils';
export * from './test-setup';