import '@testing-library/jest-dom';
import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

// Mock environment variables
beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.FLY_API_TOKEN = 'test-token';
  process.env.FLY_APP_NAME = 'test-app';
  process.env.SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'test-key';
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/test_db';
});

// Clean up after all tests
afterAll(() => {
  // Clean up any test artifacts
});

// Reset mocks before each test
beforeEach(() => {
  // Reset fetch mock
  global.fetch = vi.fn();
});

// Clean up after each test
afterEach(() => {
  vi.resetAllMocks();
});

// Mock Next.js router
vi.mock('next/router', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    reload: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
    beforePopState: vi.fn(),
    pathname: '/',
    route: '/',
    query: {},
    asPath: '/',
    basePath: '',
    isLocaleDomain: false,
    isReady: true,
    isPreview: false,
    events: {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
    },
  }),
}));

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Global test utilities
global.testUtils = {
  createMockMachine: (overrides = {}) => ({
    id: 'vm-test-001',
    name: 'test-machine',
    state: 'started',
    region: 'iad',
    config: {
      image: 'nginx:latest',
      guest: {
        cpu_kind: 'shared',
        cpus: 1,
        memory_mb: 256,
      },
    },
    ...overrides,
  }),

  createMockSwarmMetrics: (overrides = {}) => ({
    totalMachines: 5,
    activeMachines: 4,
    totalCPU: 4,
    totalMemory: 1024,
    averageLoad: 45.5,
    networkTraffic: {
      inbound: 125.5,
      outbound: 89.2,
    },
    errors: [],
    uptime: 99.8,
    lastUpdated: new Date().toISOString(),
    ...overrides,
  }),

  mockFetchResponse: (data: any, status = 200) => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => data,
      text: async () => JSON.stringify(data),
    });
  },

  mockFetchError: (status = 500, statusText = 'Internal Server Error') => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status,
      statusText,
      json: async () => ({ error: statusText }),
    });
  },
};