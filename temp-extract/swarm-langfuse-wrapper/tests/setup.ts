// Test setup for Jest
import { jest } from '@jest/globals';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.CLAUDE_FLOW_ENABLED = 'false';

// Mock winston logger to reduce noise in tests
jest.mock('winston', () => {
  const mockFormat = {
    combine: jest.fn(),
    timestamp: jest.fn(),
    json: jest.fn(),
    colorize: jest.fn(),
    simple: jest.fn()
  };

  const mockTransports = {
    Console: jest.fn(),
    File: jest.fn()
  };

  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn()
  };

  return {
    format: mockFormat,
    transports: mockTransports,
    createLogger: jest.fn(() => mockLogger),
    Logger: jest.fn(() => mockLogger)
  };
});

// Global test helpers
global.testHelpers = {
  delay: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  
  mockLangfuseClient: () => ({
    trace: jest.fn().mockReturnValue({
      span: jest.fn(),
      generation: jest.fn(),
      event: jest.fn(),
      update: jest.fn()
    }),
    flushAsync: jest.fn().mockResolvedValue(undefined),
    shutdownAsync: jest.fn().mockResolvedValue(undefined)
  }),

  createMockConfig: (overrides = {}) => ({
    publicKey: 'test-public-key',
    secretKey: 'test-secret-key',
    host: 'https://test.langfuse.com',
    flushAt: 10,
    flushInterval: 5000,
    autoRegister: false,
    memoryDbPath: ':memory:',
    enableHooks: true,
    ...overrides
  })
};

// Cleanup after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Cleanup after all tests
afterAll(async () => {
  // Clean up any open database connections
  await new Promise(resolve => setTimeout(resolve, 100));
});

// Type declarations for global test helpers
declare global {
  var testHelpers: {
    delay: (ms: number) => Promise<void>;
    mockLangfuseClient: () => any;
    createMockConfig: (overrides?: any) => any;
  };
}