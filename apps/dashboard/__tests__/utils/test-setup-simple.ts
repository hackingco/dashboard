import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';

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
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // Mock environment variables
  process.env = {
    ...process.env,
    NODE_ENV: 'test',
    NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
    NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY: 'test-public-key',
    NEXT_PUBLIC_LANGFUSE_SECRET_KEY: 'test-secret-key',
    NEXT_PUBLIC_LANGFUSE_HOST: 'https://test-langfuse.com',
    FLY_API_TOKEN: 'test-fly-token',
  };

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

  // Mock WebSocket
  global.WebSocket = vi.fn().mockImplementation(() => ({
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    send: vi.fn(),
    close: vi.fn(),
    readyState: 1,
  }));

  // Mock EventSource
  global.EventSource = vi.fn().mockImplementation(() => ({
    addEventListener: vi.fn(),
    close: vi.fn(),
    readyState: 1,
  }));
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(global.fetch).mockReset();
});

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.resetAllMocks();
});

afterAll(() => {
  vi.restoreAllMocks();
});

export {};