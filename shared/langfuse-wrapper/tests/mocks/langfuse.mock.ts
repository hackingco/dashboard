/**
 * Enhanced Langfuse SDK mock for comprehensive testing
 */

import { jest } from '@jest/globals';

export interface MockLangfuseTrace {
  id: string;
  span: jest.MockedFunction<any>;
  generation: jest.MockedFunction<any>;
  event: jest.MockedFunction<any>;
  update: jest.MockedFunction<any>;
}

export interface MockLangfuseClient {
  trace: jest.MockedFunction<any>;
  flushAsync: jest.MockedFunction<any>;
  shutdownAsync: jest.MockedFunction<any>;
}

/**
 * Create a realistic Langfuse client mock
 */
export function createMockLangfuseClient(): MockLangfuseClient {
  const traces = new Map<string, MockLangfuseTrace>();
  
  const mockClient: MockLangfuseClient = {
    trace: jest.fn().mockImplementation((config: any) => {
      const mockTrace: MockLangfuseTrace = {
        id: config.id,
        span: jest.fn().mockImplementation((spanConfig: any) => {
          // Simulate span creation behavior
          return {
            id: spanConfig.id,
            startTime: spanConfig.startTime,
            endTime: spanConfig.endTime,
            input: spanConfig.input,
            output: spanConfig.output,
            metadata: spanConfig.metadata
          };
        }),
        generation: jest.fn().mockImplementation((genConfig: any) => {
          // Simulate generation tracking
          return {
            name: genConfig.name,
            model: genConfig.model,
            input: genConfig.input,
            output: genConfig.output,
            usage: genConfig.usage,
            metadata: genConfig.metadata
          };
        }),
        event: jest.fn().mockImplementation((eventConfig: any) => {
          // Simulate event logging
          return {
            name: eventConfig.name,
            level: eventConfig.level,
            statusMessage: eventConfig.statusMessage,
            metadata: eventConfig.metadata
          };
        }),
        update: jest.fn().mockImplementation((updateConfig: any) => {
          // Simulate trace update
          return updateConfig;
        })
      };
      
      traces.set(config.id, mockTrace);
      return mockTrace;
    }),
    
    flushAsync: jest.fn().mockImplementation(async () => {
      // Simulate flush delay
      await new Promise(resolve => setTimeout(resolve, 10));
      return Promise.resolve();
    }),
    
    shutdownAsync: jest.fn().mockImplementation(async () => {
      // Simulate shutdown delay
      await new Promise(resolve => setTimeout(resolve, 20));
      traces.clear();
      return Promise.resolve();
    })
  };

  // Add helper methods for testing
  (mockClient as any).getTraces = () => traces;
  (mockClient as any).getTrace = (id: string) => traces.get(id);
  (mockClient as any).reset = () => {
    traces.clear();
    jest.clearAllMocks();
  };

  return mockClient;
}

/**
 * Mock for Langfuse constructor that can simulate failures
 */
export function createMockLangfuseConstructor() {
  const mockClients = new Map<string, MockLangfuseClient>();
  
  const MockLangfuse = jest.fn().mockImplementation((config: any) => {
    // Simulate initialization failures
    if (config.publicKey === 'FAIL_INIT') {
      throw new Error('Failed to initialize Langfuse client');
    }
    
    if (config.secretKey === 'INVALID_SECRET') {
      throw new Error('Invalid secret key');
    }
    
    const client = createMockLangfuseClient();
    const key = `${config.publicKey}-${config.secretKey}`;
    mockClients.set(key, client);
    
    return client;
  });
  
  // Add utility methods
  MockLangfuse.getClient = (publicKey: string, secretKey: string) => {
    return mockClients.get(`${publicKey}-${secretKey}`);
  };
  
  MockLangfuse.reset = () => {
    mockClients.clear();
    jest.clearAllMocks();
  };
  
  return MockLangfuse;
}

/**
 * Create mock for better-sqlite3 database
 */
export function createMockDatabase() {
  const tables = new Map<string, any[]>();
  const prepared = new Map<string, any>();
  
  const mockDb = {
    exec: jest.fn().mockImplementation((sql: string) => {
      // Simulate table creation
      if (sql.includes('CREATE TABLE')) {
        const tableName = sql.match(/CREATE TABLE (?:IF NOT EXISTS )?(\w+)/)?.[1];
        if (tableName) {
          tables.set(tableName, []);
        }
      }
    }),
    
    prepare: jest.fn().mockImplementation((sql: string) => {
      const statement = {
        run: jest.fn().mockImplementation((...params: any[]) => {
          // Simulate INSERT operations
          if (sql.includes('INSERT INTO traces')) {
            const traces = tables.get('traces') || [];
            traces.push({
              id: params[0],
              langfuse_trace_id: params[1],
              name: params[2],
              metadata: JSON.parse(params[3] || '{}'),
              created_at: params[4],
              status: 'running'
            });
            tables.set('traces', traces);
            return { changes: 1, lastInsertRowid: traces.length };
          }
          
          // Simulate UPDATE operations
          if (sql.includes('UPDATE traces')) {
            const traces = tables.get('traces') || [];
            const traceIndex = traces.findIndex(t => t.id === params[2]);
            if (traceIndex >= 0) {
              traces[traceIndex].status = params[0];
              traces[traceIndex].completed_at = params[1];
              return { changes: 1 };
            }
            return { changes: 0 };
          }
          
          return { changes: 0 };
        }),
        
        get: jest.fn().mockImplementation(() => {
          // Simulate stats query
          const traces = tables.get('traces') || [];
          return {
            total_traces: traces.length,
            pending_traces: traces.filter(t => t.status === 'running').length,
            completed_traces: traces.filter(t => t.status === 'completed').length,
            avg_duration_ms: 1500
          };
        }),
        
        all: jest.fn().mockImplementation(() => {
          return tables.get('traces') || [];
        })
      };
      
      prepared.set(sql, statement);
      return statement;
    }),
    
    close: jest.fn().mockImplementation(() => {
      tables.clear();
      prepared.clear();
    })
  };
  
  // Add utility methods for testing
  (mockDb as any).getTables = () => tables;
  (mockDb as any).getTable = (name: string) => tables.get(name) || [];
  (mockDb as any).reset = () => {
    tables.clear();
    prepared.clear();
    jest.clearAllMocks();
  };
  
  return mockDb;
}

/**
 * Performance testing utilities
 */
export const performanceUtils = {
  measureAsyncExecution: async <T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> => {
    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;
    return { result, duration };
  },
  
  simulateHighLoad: async (operations: number, concurrency: number, operation: () => Promise<any>) => {
    const batches = Math.ceil(operations / concurrency);
    const results = [];
    
    for (let i = 0; i < batches; i++) {
      const batchSize = Math.min(concurrency, operations - (i * concurrency));
      const batch = Array(batchSize).fill(0).map(() => operation());
      const batchResults = await Promise.all(batch);
      results.push(...batchResults);
    }
    
    return results;
  }
};

export default {
  createMockLangfuseClient,
  createMockLangfuseConstructor,
  createMockDatabase,
  performanceUtils
};