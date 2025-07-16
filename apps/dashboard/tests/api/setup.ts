/**
 * Test Setup for Langfuse API Integration Tests
 * Global setup and teardown for API testing environment
 */

import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { vi } from 'vitest';

// Global test configuration
const TEST_CONFIG = {
  LANGFUSE_BASE_URL: 'http://localhost:3000',
  LANGFUSE_WS_URL: 'ws://localhost:3000/ws',
  TEST_TIMEOUT: 30000,
  API_RETRY_ATTEMPTS: 3,
  API_RETRY_DELAY: 1000,
};

// Store original global objects
const originalGlobals = {
  fetch: global.fetch,
  WebSocket: global.WebSocket,
  console: {
    log: console.log,
    warn: console.warn,
    error: console.error,
  },
};

// Mock implementations
class TestWebSocket extends EventTarget {
  public static readonly CONNECTING = 0;
  public static readonly OPEN = 1;
  public static readonly CLOSING = 2;
  public static readonly CLOSED = 3;

  public readyState = TestWebSocket.CONNECTING;
  public url: string;
  public protocol = '';
  public extensions = '';
  public bufferedAmount = 0;
  public binaryType: BinaryType = 'blob';

  public onopen: ((event: Event) => void) | null = null;
  public onmessage: ((event: MessageEvent) => void) | null = null;
  public onclose: ((event: CloseEvent) => void) | null = null;
  public onerror: ((event: Event) => void) | null = null;

  constructor(url: string, protocols?: string | string[]) {
    super();
    this.url = url;
    
    // Simulate successful connection after delay
    setTimeout(() => {
      this.readyState = TestWebSocket.OPEN;
      const openEvent = new Event('open');
      if (this.onopen) this.onopen(openEvent);
      this.dispatchEvent(openEvent);
    }, 100);
  }

  send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
    if (this.readyState !== TestWebSocket.OPEN) {
      throw new DOMException('WebSocket is not in OPEN state', 'InvalidStateError');
    }
    // Echo back a test message for certain patterns
    if (typeof data === 'string' && data.includes('ping')) {
      setTimeout(() => {
        const messageEvent = new MessageEvent('message', {
          data: JSON.stringify({ type: 'pong', timestamp: Date.now() })
        });
        if (this.onmessage) this.onmessage(messageEvent);
        this.dispatchEvent(messageEvent);
      }, 50);
    }
  }

  close(code?: number, reason?: string): void {
    if (this.readyState === TestWebSocket.CLOSED || this.readyState === TestWebSocket.CLOSING) {
      return;
    }
    
    this.readyState = TestWebSocket.CLOSING;
    setTimeout(() => {
      this.readyState = TestWebSocket.CLOSED;
      const closeEvent = new CloseEvent('close', { 
        code: code || 1000, 
        reason: reason || 'Normal closure' 
      });
      if (this.onclose) this.onclose(closeEvent);
      this.dispatchEvent(closeEvent);
    }, 10);
  }
}

// Enhanced fetch mock that can simulate various scenarios
function createFetchMock() {
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const urlString = typeof url === 'string' ? url : url.toString();
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
    
    // Handle different endpoints
    if (urlString.includes('/api/public/health')) {
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ status: 'healthy', version: '2.0.0' }),
        text: async () => 'OK',
      } as Response;
    }
    
    if (urlString.includes('/api/public/traces')) {
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          data: [
            {
              id: `trace-${Date.now()}`,
              name: 'Mock API Trace',
              sessionId: 'mock-session',
              timestamp: new Date().toISOString(),
              startTime: new Date().toISOString(),
              level: 'DEFAULT',
              metadata: { mock: true },
            }
          ],
          pagination: { totalCount: 1 },
        }),
      } as Response;
    }
    
    if (urlString.includes('/api/public/sessions')) {
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          data: [
            {
              id: 'mock-session',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }
          ],
        }),
      } as Response;
    }
    
    if (urlString.includes('/api/public/ingestion')) {
      return {
        ok: true,
        status: 201,
        statusText: 'Created',
        json: async () => ({ success: true }),
      } as Response;
    }
    
    // Default: simulate API unavailable
    return {
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      json: async () => ({ error: 'Service temporarily unavailable' }),
    } as Response;
  });
}

// Console mock to reduce noise during tests
function createConsoleMock() {
  return {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  };
}

// Global setup
beforeAll(async () => {
  console.log('🔧 Setting up Langfuse API test environment...');
  
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.VITEST = 'true';
  process.env.NEXT_PUBLIC_LANGFUSE_HOST = TEST_CONFIG.LANGFUSE_BASE_URL;
  process.env.NEXT_PUBLIC_LANGFUSE_WS = TEST_CONFIG.LANGFUSE_WS_URL;
  
  // Setup global mocks
  global.WebSocket = TestWebSocket as any;
  global.fetch = createFetchMock();
  
  // Reduce console noise in tests
  const consoleMock = createConsoleMock();
  Object.assign(console, consoleMock);
  
  console.log('✅ Test environment setup complete');
});

// Global teardown
afterAll(async () => {
  console.log('🧹 Cleaning up test environment...');
  
  // Restore original globals
  global.fetch = originalGlobals.fetch;
  global.WebSocket = originalGlobals.WebSocket;
  Object.assign(console, originalGlobals.console);
  
  // Clean up environment variables
  delete process.env.VITEST;
  
  console.log('✅ Test environment cleanup complete');
});

// Test-level setup
beforeEach(() => {
  // Clear all mocks before each test
  vi.clearAllMocks();
  
  // Reset any module mocks
  vi.resetModules();
});

// Test-level teardown
afterEach(() => {
  // Clean up any remaining timers
  vi.clearAllTimers();
  
  // Reset all mocks
  vi.resetAllMocks();
});

// Utility functions for tests
export const testUtils = {
  CONFIG: TEST_CONFIG,
  
  // Wait for a condition to be true
  waitFor: async (condition: () => boolean, timeout = 5000): Promise<void> => {
    const start = Date.now();
    while (!condition() && Date.now() - start < timeout) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    if (!condition()) {
      throw new Error(`Condition not met within ${timeout}ms`);
    }
  },
  
  // Simulate API delay
  delay: (ms: number): Promise<void> => 
    new Promise(resolve => setTimeout(resolve, ms)),
  
  // Create a mock trace
  createMockTrace: (overrides: Partial<any> = {}) => ({
    id: `test-trace-${Date.now()}`,
    name: 'Test Trace',
    sessionId: 'test-session',
    userId: 'test-user',
    timestamp: new Date(),
    duration: 1000,
    status: 'success',
    model: 'test-model',
    promptTokens: 100,
    completionTokens: 50,
    totalCost: 0.001,
    input: 'Test input',
    output: 'Test output',
    metadata: { test: true },
    tags: ['test'],
    ...overrides,
  }),
  
  // Create mock metrics
  createMockMetrics: (overrides: Partial<any> = {}) => ({
    totalTraces: 100,
    activeTraces: 10,
    totalAgents: 5,
    activeAgents: 4,
    totalTasks: 150,
    completedTasks: 140,
    failedTasks: 5,
    averageResponseTime: 1200,
    throughput: 25,
    errorRate: 3.3,
    totalCost: 12.45,
    tokenUsage: {
      prompt: 5000,
      completion: 3500,
      total: 8500,
    },
    ...overrides,
  }),
  
  // Simulate network conditions
  simulateNetworkCondition: (condition: 'fast' | 'slow' | 'offline' | 'unstable') => {
    const originalFetch = global.fetch;
    
    switch (condition) {
      case 'fast':
        // Normal fast network
        break;
        
      case 'slow':
        global.fetch = vi.fn(async (...args) => {
          await testUtils.delay(2000 + Math.random() * 3000); // 2-5 second delay
          return originalFetch(...args);
        });
        break;
        
      case 'offline':
        global.fetch = vi.fn(() => Promise.reject(new Error('Network offline')));
        break;
        
      case 'unstable':
        global.fetch = vi.fn(async (...args) => {
          if (Math.random() < 0.3) { // 30% failure rate
            throw new Error('Network error');
          }
          await testUtils.delay(Math.random() * 2000); // Variable delay
          return originalFetch(...args);
        });
        break;
    }
    
    // Return cleanup function
    return () => {
      global.fetch = originalFetch;
    };
  },
};

// Export types for test use
export interface TestTrace {
  id: string;
  name: string;
  sessionId: string;
  timestamp: Date;
  status: 'success' | 'error' | 'pending' | 'running';
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalCost: number;
}

export interface TestMetrics {
  totalTraces: number;
  activeTraces: number;
  totalAgents: number;
  activeAgents: number;
  errorRate: number;
  totalCost: number;
}

console.log('📋 Test setup configuration loaded');