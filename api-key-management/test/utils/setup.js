/**
 * Jest Test Setup
 * Configure test environment and global utilities
 */

// Increase timeout for integration tests
jest.setTimeout(30000);

// Mock console methods to reduce noise
global.console = {
  ...console,
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  // Keep error for debugging
  error: console.error,
};

// Global test utilities
global.testUtils = {
  // Generate test API keys
  generateTestKeys: () => ({
    publicKey: `pk-test-${Math.random().toString(36).substring(7)}`,
    secretKey: `sk-test-${Math.random().toString(36).substring(7)}`
  }),
  
  // Wait for async operations
  waitFor: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Mock Langfuse host
  mockLangfuseHost: 'http://localhost:3000',
  
  // Clean up resources
  cleanup: async () => {
    // Clear any test data
    jest.clearAllMocks();
    jest.clearAllTimers();
  }
};

// Setup before all tests
beforeAll(() => {
  // Mock timers for controlled testing
  jest.useFakeTimers();
});

// Cleanup after each test
afterEach(async () => {
  await global.testUtils.cleanup();
});

// Final cleanup
afterAll(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});