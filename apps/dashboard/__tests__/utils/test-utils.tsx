import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';

// Mock providers for testing
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: Infinity,
    },
    mutations: {
      retry: false,
    },
  },
});

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient;
}

// Custom render function that includes providers
const customRender = (
  ui: ReactElement,
  {
    queryClient = createTestQueryClient(),
    ...renderOptions
  }: CustomRenderOptions = {}
) => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  return render(ui, { wrapper: Wrapper, ...renderOptions });
};

// Mock data factories
export const mockSwarmFactory = (overrides = {}) => ({
  id: 'test-swarm-id',
  name: 'Test Swarm',
  purpose: 'Testing purposes',
  status: 'running',
  worker_count: 3,
  config: {
    maxWorkers: 5,
    cpus: 1,
    memory: 512,
    autoScale: true,
  },
  metrics: {
    tasks_completed: 100,
    average_task_duration: 250,
    error_rate: 0.02,
  },
  created_at: '2023-12-01T10:00:00Z',
  updated_at: '2023-12-01T10:30:00Z',
  error: null,
  app_name: 'test-app',
  ...overrides,
});

export const mockMachineFactory = (overrides = {}) => ({
  id: 'test-machine-id',
  name: 'test-machine',
  state: 'started',
  region: 'dfw',
  instance_id: 'instance-123',
  private_ip: '172.16.0.1',
  config: {
    image: 'nginx:latest',
    env: { NODE_ENV: 'test' },
    guest: { cpus: 1, memory_mb: 256 },
    services: [{
      internal_port: 8080,
      protocol: 'tcp',
      ports: [{ port: 80 }]
    }]
  },
  created_at: '2023-12-01T10:00:00Z',
  updated_at: '2023-12-01T10:30:00Z',
  events: [],
  ...overrides,
});

export const mockTraceFactory = (overrides = {}) => ({
  id: 'test-trace-id',
  name: 'Test Trace',
  timestamp: new Date().toISOString(),
  duration: 1500,
  status: 'success',
  input: { message: 'test input' },
  output: { response: 'test output' },
  metadata: {
    swarm_id: 'test-swarm-id',
    worker_id: 'worker-1',
    model: 'claude-3-opus',
  },
  tags: ['test', 'automated'],
  ...overrides,
});

// Test utilities
export const waitForNextTick = () => 
  new Promise(resolve => setTimeout(resolve, 0));

export const mockLocalStorage = () => {
  const store: Record<string, string> = {};
  
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach(key => delete store[key]);
    }),
  };
};

export const mockSessionStorage = () => {
  const store: Record<string, string> = {};
  
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach(key => delete store[key]);
    }),
  };
};

// Network mocking utilities
export const mockFetch = (responseData: any, options: { status?: number; ok?: boolean } = {}) => {
  const { status = 200, ok = true } = options;
  
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(responseData),
    text: () => Promise.resolve(JSON.stringify(responseData)),
    headers: new Headers({ 'Content-Type': 'application/json' }),
  });
};

export const mockFetchError = (error: string, status = 500) => {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    text: () => Promise.resolve(error),
    json: () => Promise.reject(new Error('Invalid JSON')),
  });
};

// Real-time mocking utilities
export const mockWebSocket = () => {
  const events: Record<string, Function[]> = {};
  
  return {
    addEventListener: vi.fn((event: string, handler: Function) => {
      if (!events[event]) events[event] = [];
      events[event].push(handler);
    }),
    removeEventListener: vi.fn((event: string, handler: Function) => {
      if (events[event]) {
        events[event] = events[event].filter(h => h !== handler);
      }
    }),
    send: vi.fn(),
    close: vi.fn(),
    readyState: 1, // OPEN
    triggerEvent: (event: string, data: any) => {
      if (events[event]) {
        events[event].forEach(handler => handler(data));
      }
    },
  };
};

export const mockEventSource = () => {
  const events: Record<string, Function[]> = {};
  
  return {
    addEventListener: vi.fn((event: string, handler: Function) => {
      if (!events[event]) events[event] = [];
      events[event].push(handler);
    }),
    close: vi.fn(),
    readyState: 1, // OPEN
    triggerEvent: (event: string, data: any) => {
      if (events[event]) {
        events[event].forEach(handler => handler({ data }));
      }
    },
  };
};

// Form testing utilities
export const fillFormField = async (
  user: any,
  labelText: string | RegExp,
  value: string
) => {
  const field = document.querySelector(`[aria-label="${labelText}"]`) ||
                document.querySelector(`label:contains("${labelText}")`)?.control;
  if (field) {
    await user.clear(field);
    await user.type(field, value);
  }
};

export const selectFromDropdown = async (
  user: any,
  triggerText: string | RegExp,
  optionText: string | RegExp
) => {
  const trigger = document.querySelector(`[aria-label="${triggerText}"]`);
  if (trigger) {
    await user.click(trigger);
    const option = document.querySelector(`[role="option"]:contains("${optionText}")`);
    if (option) {
      await user.click(option);
    }
  }
};

// Component testing helpers
export const getByTestId = (testId: string) => 
  document.querySelector(`[data-testid="${testId}"]`);

export const getAllByTestId = (testId: string) =>
  Array.from(document.querySelectorAll(`[data-testid="${testId}"]`));

// Async testing utilities
export const waitForCondition = async (
  condition: () => boolean,
  timeout = 5000,
  interval = 100
) => {
  const start = Date.now();
  
  while (Date.now() - start < timeout) {
    if (condition()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(`Condition not met within ${timeout}ms`);
};

// Error boundary for testing
export class TestErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Test error boundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <div data-testid="error-boundary">Error: {this.state.error?.message}</div>;
    }

    return this.props.children;
  }
}

// Re-export everything from RTL and add our custom render
export * from '@testing-library/react';
export { customRender as render };
export { createTestQueryClient };