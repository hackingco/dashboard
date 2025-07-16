import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import React from 'react';

// Global test setup
beforeAll(() => {
  // Setup global mocks
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));

  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));

  // Mock matchMedia for responsive design tests
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // Mock window.location
  Object.defineProperty(window, 'location', {
    value: {
      ...window.location,
      assign: vi.fn(),
      replace: vi.fn(),
      reload: vi.fn(),
    },
    writable: true,
  });

  // Mock console methods to avoid noise in tests
  global.console = {
    ...console,
    log: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  // Mock environment variables
  process.env = {
    ...process.env,
    NODE_ENV: 'test',
    NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
    NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY: 'test-public-key',
    NEXT_PUBLIC_LANGFUSE_SECRET_KEY: 'test-secret-key',
    NEXT_PUBLIC_LANGFUSE_HOST: 'https://test-langfuse.com',
    NEXT_PUBLIC_TRUSTGRAPH_API_KEY: 'test-trust-key',
    NEXT_PUBLIC_TRUSTGRAPH_API_URL: 'https://test-trust-api.com',
    FLY_API_TOKEN: 'test-fly-token',
  };

  // Mock crypto for uuid generation
  Object.defineProperty(global, 'crypto', {
    value: {
      randomUUID: () => 'test-uuid-' + Math.random().toString(36).substring(2, 15),
      getRandomValues: (arr: any) => {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = Math.floor(Math.random() * 256);
        }
        return arr;
      },
    },
  });

  // Mock fetch globally
  global.fetch = vi.fn();

  // Mock localStorage
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
  });

  // Mock sessionStorage
  const sessionStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };
  Object.defineProperty(window, 'sessionStorage', {
    value: sessionStorageMock,
  });

  // Mock WebSocket
  global.WebSocket = vi.fn().mockImplementation(() => ({
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    send: vi.fn(),
    close: vi.fn(),
    readyState: 1, // OPEN
  }));

  // Mock EventSource for SSE
  global.EventSource = vi.fn().mockImplementation(() => ({
    addEventListener: vi.fn(),
    close: vi.fn(),
    readyState: 1, // OPEN
  }));

  // Mock next/navigation
  vi.mock('next/navigation', () => ({
    useRouter: () => ({
      push: vi.fn(),
      replace: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      prefetch: vi.fn(),
    }),
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => '/',
  }));

  // Mock next/image
  vi.mock('next/image', () => ({
    default: ({ src, alt, ...props }: any) => {
      // eslint-disable-next-line @next/next/no-img-element
      return React.createElement('img', { src, alt, ...props });
    },
  }));

  // Mock react-chartjs-2
  vi.mock('react-chartjs-2', () => ({
    Line: ({ data, options }: any) => {
      const div = document.createElement('div');
      div.setAttribute('data-testid', 'line-chart');
      div.setAttribute('data-chart-data', JSON.stringify(data));
      return div;
    },
    Bar: ({ data, options }: any) => {
      const div = document.createElement('div');
      div.setAttribute('data-testid', 'bar-chart');
      div.setAttribute('data-chart-data', JSON.stringify(data));
      return div;
    },
    Doughnut: ({ data, options }: any) => {
      const div = document.createElement('div');
      div.setAttribute('data-testid', 'doughnut-chart');
      div.setAttribute('data-chart-data', JSON.stringify(data));
      return div;
    },
  }));

  // Mock chart.js
  vi.mock('chart.js', () => ({
    Chart: {
      register: vi.fn(),
    },
    CategoryScale: vi.fn(),
    LinearScale: vi.fn(),
    PointElement: vi.fn(),
    LineElement: vi.fn(),
    BarElement: vi.fn(),
    ArcElement: vi.fn(),
    Title: vi.fn(),
    Tooltip: vi.fn(),
    Legend: vi.fn(),
  }));

  // Mock recharts
  vi.mock('recharts', () => ({
    ResponsiveContainer: ({ children }: any) => 
      React.createElement('div', { 'data-testid': 'responsive-container' }, children),
    LineChart: ({ data, children }: any) => 
      React.createElement('div', { 'data-testid': 'line-chart', 'data-chart-data': JSON.stringify(data) }, children),
    BarChart: ({ data, children }: any) => 
      React.createElement('div', { 'data-testid': 'bar-chart', 'data-chart-data': JSON.stringify(data) }, children),
    XAxis: () => React.createElement('div', { 'data-testid': 'x-axis' }),
    YAxis: () => React.createElement('div', { 'data-testid': 'y-axis' }),
    CartesianGrid: () => React.createElement('div', { 'data-testid': 'cartesian-grid' }),
    Tooltip: () => React.createElement('div', { 'data-testid': 'tooltip' }),
    Legend: () => React.createElement('div', { 'data-testid': 'legend' }),
    Line: () => React.createElement('div', { 'data-testid': 'line' }),
    Bar: () => React.createElement('div', { 'data-testid': 'bar' }),
  }));

  // Mock date-fns
  vi.mock('date-fns', () => ({
    format: vi.fn((date, formatStr) => {
      if (typeof date === 'string') {
        return new Date(date).toISOString().split('T')[0];
      }
      return date.toISOString().split('T')[0];
    }),
    formatDistanceToNow: vi.fn(() => '2 hours ago'),
    addHours: vi.fn((date, hours) => new Date(date.getTime() + hours * 60 * 60 * 1000)),
    subDays: vi.fn((date, days) => new Date(date.getTime() - days * 24 * 60 * 60 * 1000)),
  }));
});

beforeEach(() => {
  // Clear all mocks before each test
  vi.clearAllMocks();
  
  // Reset fetch mock
  vi.mocked(global.fetch).mockReset();
  
  // Reset localStorage and sessionStorage
  vi.mocked(window.localStorage.getItem).mockReset();
  vi.mocked(window.localStorage.setItem).mockReset();
  vi.mocked(window.localStorage.removeItem).mockReset();
  vi.mocked(window.localStorage.clear).mockReset();
  
  vi.mocked(window.sessionStorage.getItem).mockReset();
  vi.mocked(window.sessionStorage.setItem).mockReset();
  vi.mocked(window.sessionStorage.removeItem).mockReset();
  vi.mocked(window.sessionStorage.clear).mockReset();

  // Reset timers
  vi.useRealTimers();
});

afterEach(() => {
  // Cleanup DOM after each test
  cleanup();
  
  // Clear any remaining timers
  vi.clearAllTimers();
  
  // Reset all mocks
  vi.resetAllMocks();
});

afterAll(() => {
  // Cleanup global mocks
  vi.restoreAllMocks();
});

// Custom matchers
expect.extend({
  toBeValidSwarmData(received) {
    const required = ['id', 'name', 'status', 'worker_count'];
    const missing = required.filter(field => !(field in received));
    
    if (missing.length > 0) {
      return {
        message: () => `Expected swarm data to have required fields: ${missing.join(', ')}`,
        pass: false,
      };
    }

    return {
      message: () => 'Expected swarm data to be invalid',
      pass: true,
    };
  },
  
  toBeValidMachineData(received) {
    const required = ['id', 'name', 'state', 'config'];
    const missing = required.filter(field => !(field in received));
    
    if (missing.length > 0) {
      return {
        message: () => `Expected machine data to have required fields: ${missing.join(', ')}`,
        pass: false,
      };
    }

    if (received.config && !received.config.image) {
      return {
        message: () => 'Expected machine config to have image field',
        pass: false,
      };
    }

    return {
      message: () => 'Expected machine data to be invalid',
      pass: true,
    };
  },

  toHaveValidApiResponse(received) {
    if (typeof received !== 'object' || received === null) {
      return {
        message: () => 'Expected API response to be an object',
        pass: false,
      };
    }

    // Check for common API response patterns
    const hasData = 'data' in received || Array.isArray(received);
    const hasError = 'error' in received;
    
    if (!hasData && !hasError) {
      return {
        message: () => 'Expected API response to have either data or error field',
        pass: false,
      };
    }

    return {
      message: () => 'Expected invalid API response',
      pass: true,
    };
  },
});

// Declare custom matcher types
declare global {
  namespace Vi {
    interface Assertion {
      toBeValidSwarmData(): void;
      toBeValidMachineData(): void;
      toHaveValidApiResponse(): void;
    }
  }
}

export {};