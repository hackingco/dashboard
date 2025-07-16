/**
 * Test Utilities and Helpers for Langfuse Integration Testing
 */

import { vi } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

// Mock Langfuse Server Configuration
export interface MockLangfuseServerConfig {
  port: number;
  enableWebSocket: boolean;
  enableCORS: boolean;
  traceData?: any[];
  sessionData?: any[];
}

// Create a mock Langfuse server for testing
export async function mockLangfuseServer(config: MockLangfuseServerConfig) {
  const { port, enableWebSocket, enableCORS, traceData = [], sessionData = [] } = config;

  // Mock server implementation
  const mockServer = {
    port,
    isRunning: false,
    
    async start() {
      this.isRunning = true;
      console.log(`Mock Langfuse server started on port ${port}`);
      
      // Mock API endpoints
      global.fetch = vi.fn().mockImplementation((url: string, options: any) => {
        const urlObj = new URL(url);
        
        if (urlObj.pathname === '/api/public/traces') {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
              data: traceData.length > 0 ? traceData : generateMockTraces(),
            }),
          });
        }
        
        if (urlObj.pathname === '/api/public/sessions') {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
              data: sessionData.length > 0 ? sessionData : generateMockSessions(),
            }),
          });
        }
        
        if (urlObj.pathname === '/api/public/ingestion') {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ success: true }),
          });
        }
        
        if (urlObj.pathname === '/api/public/health') {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ status: 'healthy', version: '2.0.0' }),
          });
        }
        
        // Default fallback
        return Promise.resolve({
          ok: false,
          status: 404,
          json: () => Promise.resolve({ error: 'Not found' }),
        });
      });
      
      // Mock WebSocket if enabled
      if (enableWebSocket) {
        global.WebSocket = vi.fn().mockImplementation((url: string) => ({
          readyState: 1, // OPEN
          send: vi.fn(),
          close: vi.fn(),
          onopen: null,
          onmessage: null,
          onclose: null,
          onerror: null,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }));
      }
    },
    
    async close() {
      this.isRunning = false;
      console.log('Mock Langfuse server stopped');
    },
  };
  
  await mockServer.start();
  return mockServer;
}

// Generate mock trace data
function generateMockTraces() {
  return [
    {
      id: 'mock-trace-001',
      name: 'Mock Dashboard Test Trace',
      sessionId: 'test-session-123',
      timestamp: new Date().toISOString(),
      startTime: new Date(Date.now() - 1000).toISOString(),
      endTime: new Date().toISOString(),
      metadata: {
        test: true,
        mock: true,
        dashboard: 'validation',
      },
      tags: ['test', 'mock', 'dashboard'],
      level: 'DEFAULT',
    },
    {
      id: 'mock-trace-002',
      name: 'Mock Agent Activity Trace',
      sessionId: 'test-session-123',
      timestamp: new Date(Date.now() - 30000).toISOString(),
      startTime: new Date(Date.now() - 30500).toISOString(),
      endTime: new Date(Date.now() - 30000).toISOString(),
      metadata: {
        test: true,
        mock: true,
        agent: 'test-agent',
        activity: 'mock-activity',
      },
      tags: ['test', 'mock', 'agent'],
      level: 'DEFAULT',
    },
  ];
}

// Generate mock session data
function generateMockSessions() {
  return [
    {
      id: 'test-session-123',
      createdAt: new Date(Date.now() - 300000).toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'test-session-456',
      createdAt: new Date(Date.now() - 600000).toISOString(),
      updatedAt: new Date(Date.now() - 100000).toISOString(),
    },
  ];
}

// Create a test client for React Query
export function createTestClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
}

// Test wrapper component for React Query
export function TestWrapper({ children }: { children: ReactNode }) {
  const queryClient = createTestClient();
  
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

// Custom render function with providers
export function renderWithProviders(ui: ReactNode) {
  return render(ui, {
    wrapper: TestWrapper,
  });
}

// Mock environment variables for testing
export function setupTestEnvironment() {
  process.env.NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY = 'pk-test-12345';
  process.env.LANGFUSE_SECRET_KEY = 'sk-test-67890';
  process.env.NEXT_PUBLIC_LANGFUSE_HOST = 'http://localhost:3000';
  process.env.NEXT_PUBLIC_LANGFUSE_WS = 'ws://localhost:3000/ws';
}

// Clean up test environment
export function cleanupTestEnvironment() {
  delete process.env.NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY;
  delete process.env.LANGFUSE_SECRET_KEY;
  delete process.env.NEXT_PUBLIC_LANGFUSE_HOST;
  delete process.env.NEXT_PUBLIC_LANGFUSE_WS;
  
  // Restore fetch if it was mocked
  if (vi.isMockFunction(global.fetch)) {
    vi.restoreAllMocks();
  }
}

// Validation utilities
export class LangfuseValidator {
  static validateTraceStructure(trace: any) {
    const requiredFields = ['id', 'name', 'sessionId', 'timestamp'];
    const optionalFields = ['metadata', 'tags', 'level', 'startTime', 'endTime'];
    
    const validation = {
      isValid: true,
      errors: [] as string[],
      warnings: [] as string[],
    };
    
    // Check required fields
    requiredFields.forEach(field => {
      if (!(field in trace)) {
        validation.isValid = false;
        validation.errors.push(`Missing required field: ${field}`);
      }
    });
    
    // Check field types
    if (trace.id && typeof trace.id !== 'string') {
      validation.errors.push('id must be a string');
    }
    
    if (trace.timestamp && isNaN(Date.parse(trace.timestamp))) {
      validation.errors.push('timestamp must be a valid ISO date string');
    }
    
    // Check optional fields
    if (trace.metadata && typeof trace.metadata !== 'object') {
      validation.warnings.push('metadata should be an object');
    }
    
    if (trace.tags && !Array.isArray(trace.tags)) {
      validation.warnings.push('tags should be an array');
    }
    
    return validation;
  }
  
  static validateSessionStructure(session: any) {
    const requiredFields = ['id', 'createdAt', 'updatedAt'];
    
    const validation = {
      isValid: true,
      errors: [] as string[],
    };
    
    requiredFields.forEach(field => {
      if (!(field in session)) {
        validation.isValid = false;
        validation.errors.push(`Missing required field: ${field}`);
      }
    });
    
    // Validate dates
    if (session.createdAt && isNaN(Date.parse(session.createdAt))) {
      validation.errors.push('createdAt must be a valid ISO date string');
    }
    
    if (session.updatedAt && isNaN(Date.parse(session.updatedAt))) {
      validation.errors.push('updatedAt must be a valid ISO date string');
    }
    
    return validation;
  }
  
  static validateMetricsStructure(metrics: any) {
    const requiredFields = [
      'totalTraces', 'activeAgents', 'completedTasks', 'averageResponseTime',
      'errorRate', 'totalCost', 'tokenUsage'
    ];
    
    const validation = {
      isValid: true,
      errors: [] as string[],
    };
    
    requiredFields.forEach(field => {
      if (!(field in metrics)) {
        validation.isValid = false;
        validation.errors.push(`Missing required field: ${field}`);
      }
    });
    
    // Validate numeric fields
    const numericFields = ['totalTraces', 'activeAgents', 'completedTasks', 'averageResponseTime', 'errorRate', 'totalCost'];
    numericFields.forEach(field => {
      if (metrics[field] !== undefined && typeof metrics[field] !== 'number') {
        validation.errors.push(`${field} must be a number`);
      }
    });
    
    // Validate tokenUsage structure
    if (metrics.tokenUsage) {
      const tokenFields = ['prompt', 'completion', 'total'];
      tokenFields.forEach(field => {
        if (!(field in metrics.tokenUsage)) {
          validation.errors.push(`tokenUsage.${field} is required`);
        }
        if (typeof metrics.tokenUsage[field] !== 'number') {
          validation.errors.push(`tokenUsage.${field} must be a number`);
        }
      });
    }
    
    return validation;
  }
}

// Performance monitoring utilities
export class PerformanceMonitor {
  private static measurements: Map<string, number> = new Map();
  
  static start(label: string) {
    this.measurements.set(label, performance.now());
  }
  
  static end(label: string): number {
    const startTime = this.measurements.get(label);
    if (!startTime) {
      throw new Error(`No measurement started for label: ${label}`);
    }
    
    const duration = performance.now() - startTime;
    this.measurements.delete(label);
    return duration;
  }
  
  static measure<T>(label: string, fn: () => T): T {
    this.start(label);
    try {
      const result = fn();
      const duration = this.end(label);
      console.log(`Performance [${label}]: ${duration.toFixed(2)}ms`);
      return result;
    } catch (error) {
      this.measurements.delete(label);
      throw error;
    }
  }
  
  static async measureAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
    this.start(label);
    try {
      const result = await fn();
      const duration = this.end(label);
      console.log(`Performance [${label}]: ${duration.toFixed(2)}ms`);
      return result;
    } catch (error) {
      this.measurements.delete(label);
      throw error;
    }
  }
}

// Test data generators
export class TestDataGenerator {
  static generateTrace(overrides: Partial<any> = {}) {
    return {
      id: `test-trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: 'Test Trace',
      sessionId: 'test-session',
      timestamp: new Date().toISOString(),
      startTime: new Date(Date.now() - 1000).toISOString(),
      endTime: new Date().toISOString(),
      metadata: {
        test: true,
        environment: 'testing',
      },
      tags: ['test'],
      level: 'DEFAULT',
      ...overrides,
    };
  }
  
  static generateSession(overrides: Partial<any> = {}) {
    return {
      id: `test-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(Date.now() - 300000).toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    };
  }
  
  static generateMetrics(overrides: Partial<any> = {}) {
    return {
      totalTraces: 15,
      activeAgents: 5,
      completedTasks: 12,
      averageResponseTime: 850,
      errorRate: 5.2,
      totalCost: 0.024,
      tokenUsage: {
        prompt: 1250,
        completion: 650,
        total: 1900,
      },
      ...overrides,
    };
  }
}

export {
  setupTestEnvironment,
  cleanupTestEnvironment,
  LangfuseValidator,
  PerformanceMonitor,
  TestDataGenerator,
};