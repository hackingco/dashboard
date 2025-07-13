/**
 * Test Worker Process
 * Executes tests in isolated process for parallel execution
 */

import { TestSuite, Test, TestResult, TestStatus } from './test-runner';
import { performance } from 'perf_hooks';
import * as vm from 'vm';

// Worker message types
interface WorkerMessage {
  type: 'run:tests' | 'test:result' | 'worker:ready' | 'worker:error';
  suite?: Partial<TestSuite>;
  tests?: Test[];
  result?: TestResult;
  error?: Error;
}

// Worker state
let isReady = false;
const workerId = process.env.WORKER_ID || '0';

/**
 * Initialize worker
 */
function initializeWorker() {
  process.on('message', async (message: WorkerMessage) => {
    try {
      switch (message.type) {
        case 'run:tests':
          await runTests(message.suite!, message.tests!);
          break;
      }
    } catch (error) {
      sendMessage({
        type: 'worker:error',
        error: error as Error
      });
      process.exit(1);
    }
  });

  // Signal worker is ready
  sendMessage({ type: 'worker:ready' });
  isReady = true;
}

/**
 * Run tests in worker
 */
async function runTests(suite: Partial<TestSuite>, tests: Test[]) {
  console.log(`Worker ${workerId}: Running ${tests.length} tests`);

  for (const test of tests) {
    const result = await runTest(suite, test);
    sendMessage({
      type: 'test:result',
      result
    });
  }

  // Exit worker after completing tests
  process.exit(0);
}

/**
 * Run individual test
 */
async function runTest(suite: Partial<TestSuite>, test: Test): Promise<TestResult> {
  const startTime = new Date();
  const startPerf = performance.now();

  const result: TestResult = {
    id: test.id,
    name: test.name,
    type: suite.config!.type,
    status: TestStatus.RUNNING,
    duration: 0,
    startTime,
    logs: []
  };

  try {
    // Create isolated context for test execution
    const context = createTestContext();
    
    // Set up test timeout
    const timeout = test.timeout || suite.config?.timeout || 30000;
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Test timeout')), timeout)
    );

    // Execute test in isolated context
    const testFn = vm.runInNewContext(test.fn.toString(), context);
    await Promise.race([testFn(), timeoutPromise]);

    // Test passed
    result.status = TestStatus.PASSED;
    result.endTime = new Date();
    result.duration = performance.now() - startPerf;

  } catch (error) {
    // Test failed
    result.status = TestStatus.FAILED;
    result.error = error as Error;
    result.endTime = new Date();
    result.duration = performance.now() - startPerf;

    // Handle retries
    if (test.retries && test.retries > 0) {
      console.log(`Worker ${workerId}: Retrying test ${test.name}`);
      return runTest(suite, { ...test, retries: test.retries - 1 });
    }
  }

  return result;
}

/**
 * Create isolated test context
 */
function createTestContext() {
  return {
    console,
    process: {
      env: process.env
    },
    setTimeout,
    setInterval,
    clearTimeout,
    clearInterval,
    Promise,
    Buffer,
    require: createSafeRequire(),
    // Add test utilities
    expect: createExpectUtility(),
    describe: createDescribeUtility(),
    it: createItUtility(),
    beforeEach: createHookUtility('beforeEach'),
    afterEach: createHookUtility('afterEach'),
    // Global test data
    __testData: {}
  };
}

/**
 * Create safe require function
 */
function createSafeRequire() {
  const allowedModules = [
    'assert',
    'util',
    'path',
    'fs',
    'crypto',
    'stream',
    'events',
    'querystring',
    'url',
    'buffer'
  ];

  return (moduleName: string) => {
    if (!allowedModules.includes(moduleName)) {
      throw new Error(`Module '${moduleName}' is not allowed in test context`);
    }
    return require(moduleName);
  };
}

/**
 * Create expect utility
 */
function createExpectUtility() {
  return (actual: any) => ({
    toBe: (expected: any) => {
      if (actual !== expected) {
        throw new Error(`Expected ${actual} to be ${expected}`);
      }
    },
    toEqual: (expected: any) => {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${JSON.stringify(actual)} to equal ${JSON.stringify(expected)}`);
      }
    },
    toBeTruthy: () => {
      if (!actual) {
        throw new Error(`Expected ${actual} to be truthy`);
      }
    },
    toBeFalsy: () => {
      if (actual) {
        throw new Error(`Expected ${actual} to be falsy`);
      }
    },
    toThrow: async (expectedError?: string | RegExp) => {
      try {
        if (typeof actual === 'function') {
          await actual();
        } else {
          await actual;
        }
        throw new Error('Expected function to throw');
      } catch (error: any) {
        if (expectedError) {
          if (typeof expectedError === 'string' && !error.message.includes(expectedError)) {
            throw new Error(`Expected error to include "${expectedError}" but got "${error.message}"`);
          }
          if (expectedError instanceof RegExp && !expectedError.test(error.message)) {
            throw new Error(`Expected error to match ${expectedError} but got "${error.message}"`);
          }
        }
      }
    },
    toContain: (expected: any) => {
      if (Array.isArray(actual)) {
        if (!actual.includes(expected)) {
          throw new Error(`Expected array to contain ${expected}`);
        }
      } else if (typeof actual === 'string') {
        if (!actual.includes(expected)) {
          throw new Error(`Expected string to contain ${expected}`);
        }
      } else {
        throw new Error('toContain can only be used with arrays or strings');
      }
    },
    toHaveLength: (expected: number) => {
      if (actual.length !== expected) {
        throw new Error(`Expected length ${actual.length} to be ${expected}`);
      }
    },
    toBeGreaterThan: (expected: number) => {
      if (actual <= expected) {
        throw new Error(`Expected ${actual} to be greater than ${expected}`);
      }
    },
    toBeLessThan: (expected: number) => {
      if (actual >= expected) {
        throw new Error(`Expected ${actual} to be less than ${expected}`);
      }
    }
  });
}

/**
 * Create describe utility
 */
function createDescribeUtility() {
  return (name: string, fn: () => void) => {
    console.log(`Worker ${workerId}: Describe - ${name}`);
    fn();
  };
}

/**
 * Create it utility
 */
function createItUtility() {
  return (name: string, fn: () => Promise<void>) => {
    console.log(`Worker ${workerId}: Test - ${name}`);
    return fn();
  };
}

/**
 * Create hook utility
 */
function createHookUtility(hookName: string) {
  return (fn: () => Promise<void>) => {
    console.log(`Worker ${workerId}: Hook - ${hookName}`);
    return fn();
  };
}

/**
 * Send message to parent process
 */
function sendMessage(message: WorkerMessage) {
  if (process.send) {
    process.send(message);
  }
}

/**
 * Handle uncaught errors
 */
process.on('uncaughtException', (error) => {
  console.error(`Worker ${workerId}: Uncaught exception:`, error);
  sendMessage({
    type: 'worker:error',
    error
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error(`Worker ${workerId}: Unhandled rejection:`, reason);
  sendMessage({
    type: 'worker:error',
    error: new Error(String(reason))
  });
  process.exit(1);
});

// Initialize worker
initializeWorker();