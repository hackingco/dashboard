/**
 * Unit Tests for AutomatedKeyTester
 */

import AutomatedKeyTester from '../../AutomatedKeyTester.js';
import LangfuseKeyValidator from '../../LangfuseKeyValidator.js';
import { Langfuse } from '../utils/mockLangfuseClient.js';

// Mock dependencies
jest.mock('../../LangfuseKeyValidator.js');
jest.mock('langfuse', () => ({
  Langfuse: jest.fn()
}));

describe('AutomatedKeyTester', () => {
  let tester;
  let mockValidator;
  let mockLangfuseClient;
  
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers(); // Reset to real timers before each test
    
    // Mock validator
    mockValidator = {
      validateKeys: jest.fn().mockResolvedValue({
        valid: true,
        score: 85,
        tests: {
          format: { passed: true },
          security: { passed: true },
          connectivity: { passed: true }
        },
        recommendations: []
      })
    };
    
    LangfuseKeyValidator.mockImplementation(() => mockValidator);
    
    // Mock Langfuse client
    mockLangfuseClient = {
      trace: jest.fn().mockReturnValue({
        span: jest.fn().mockReturnValue({
          end: jest.fn()
        })
      }),
      flushAsync: jest.fn().mockResolvedValue(),
      shutdownAsync: jest.fn().mockResolvedValue()
    };
    
    Langfuse.mockImplementation(() => mockLangfuseClient);
    
    tester = new AutomatedKeyTester({
      testInterval: 1000,
      stressTestInterval: 5000
    });
  });

  afterEach(() => {
    if (tester.isRunning) {
      tester.stop();
    }
  });

  describe('Initialization', () => {
    test('should initialize with default config', () => {
      const defaultTester = new AutomatedKeyTester();
      
      expect(defaultTester.config.testInterval).toBe(60000);
      expect(defaultTester.config.stressTestInterval).toBe(300000);
      expect(defaultTester.config.maxConcurrentTests).toBe(10);
    });

    test('should accept custom config', () => {
      const customTester = new AutomatedKeyTester({
        testInterval: 5000,
        maxConcurrentTests: 20
      });
      
      expect(customTester.config.testInterval).toBe(5000);
      expect(customTester.config.maxConcurrentTests).toBe(20);
    });
  });

  describe('Key Management', () => {
    test('should set keys correctly', () => {
      const publicKey = 'pk-test';
      const secretKey = 'sk-test';
      
      tester.setKeys(publicKey, secretKey);
      
      expect(tester.currentKeys).toEqual({
        publicKey,
        secretKey
      });
    });

    test('should emit keys-updated event', () => {
      const eventHandler = jest.fn();
      tester.on('keys-updated', eventHandler);
      
      tester.setKeys('pk-new', 'sk-new');
      
      expect(eventHandler).toHaveBeenCalledWith({
        publicKey: 'pk-new',
        secretKey: 'sk-new'
      });
    });
  });

  describe('Test Lifecycle', () => {
    beforeEach(() => {
      tester.setKeys('pk-test', 'sk-test');
      jest.useFakeTimers();
    });

    test('should start automated testing', async () => {
      await tester.start();
      
      expect(tester.isRunning).toBe(true);
      expect(tester.testInterval).toBeDefined();
      expect(tester.stressTestInterval).toBeDefined();
    });

    test('should not start if already running', async () => {
      await tester.start();
      const consoleSpy = jest.spyOn(console, 'log');
      
      await tester.start();
      
      expect(consoleSpy).toHaveBeenCalledWith('⚠️ Automated testing already running');
    });

    test('should throw error if no keys set', async () => {
      const emptyTester = new AutomatedKeyTester();
      
      await expect(emptyTester.start()).rejects.toThrow('No keys set for testing');
    });

    test('should stop automated testing', async () => {
      await tester.start();
      await tester.stop();
      
      expect(tester.isRunning).toBe(false);
      expect(tester.testInterval).toBeNull();
      expect(tester.stressTestInterval).toBeNull();
    });

    test('should emit lifecycle events', async () => {
      const startHandler = jest.fn();
      const stopHandler = jest.fn();
      
      tester.on('testing-started', startHandler);
      tester.on('testing-stopped', stopHandler);
      
      await tester.start();
      expect(startHandler).toHaveBeenCalled();
      
      await tester.stop();
      expect(stopHandler).toHaveBeenCalled();
    });
  });

  describe('Test Suites', () => {
    beforeEach(() => {
      tester.setKeys('pk-test', 'sk-test');
    });

    describe('Basic Test Suite', () => {
      test('should run basic validation', async () => {
        const result = await tester.runTestSuite('basic');
        
        expect(result.passed).toBe(true);
        expect(result.score).toBe(85);
        expect(mockValidator.validateKeys).toHaveBeenCalled();
      });

      test('should handle validation failure', async () => {
        mockValidator.validateKeys.mockResolvedValueOnce({
          valid: false,
          score: 40,
          tests: { format: { passed: false } }
        });
        
        const result = await tester.runTestSuite('basic');
        
        expect(result.passed).toBe(false);
        expect(result.score).toBe(40);
      });
    });

    describe('Stress Test Suite', () => {
      test('should create multiple concurrent traces', async () => {
        const result = await tester.runTestSuite('stress');
        
        expect(result.passed).toBe(true);
        expect(result.totalTraces).toBeGreaterThan(0);
        expect(result.concurrentTests).toBeGreaterThan(0);
        expect(mockLangfuseClient.trace).toHaveBeenCalled();
      });

      test('should calculate throughput metrics', async () => {
        const result = await tester.runTestSuite('stress');
        
        expect(result.averageLatency).toBeGreaterThan(0);
        expect(result.throughput).toBeGreaterThan(0);
      });

      test('should handle stress test errors', async () => {
        mockLangfuseClient.trace.mockImplementationOnce(() => {
          throw new Error('Stress test error');
        });
        
        const result = await tester.runTestSuite('stress');
        
        expect(result.failedTraces).toBeGreaterThan(0);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    describe('Integration Test Suite', () => {
      test('should test swarm integration', async () => {
        const result = await tester.runTestSuite('integration');
        
        expect(result.passed).toBe(true);
        expect(result.tests.swarmIntegration.passed).toBe(true);
        expect(result.tests.swarmIntegration.agentsSimulated).toBe(5);
      });

      test('should test MCP integration', async () => {
        const result = await tester.runTestSuite('integration');
        
        expect(result.tests.mcpIntegration.passed).toBe(true);
        expect(result.tests.mcpIntegration.toolsCalled).toBe(1);
      });

      test('should test agent coordination', async () => {
        const result = await tester.runTestSuite('integration');
        
        expect(result.tests.agentCoordination.passed).toBe(true);
        expect(result.tests.agentCoordination.coordinationEvents).toBe(1);
      });
    });

    describe('Regression Test Suite', () => {
      test('should detect performance regression', async () => {
        // Mock slow performance
        jest.spyOn(tester, 'measurePerformance').mockResolvedValue({
          averageLatency: 3000, // Slower than baseline
          minLatency: 2500,
          maxLatency: 3500
        });
        
        const result = await tester.runTestSuite('regression');
        
        expect(result.performanceRegression).toBe(true);
        expect(result.performanceChange).toBeGreaterThan(20);
      });

      test('should pass when performance is acceptable', async () => {
        jest.spyOn(tester, 'measurePerformance').mockResolvedValue({
          averageLatency: 2100, // Close to baseline
          minLatency: 1900,
          maxLatency: 2300
        });
        
        const result = await tester.runTestSuite('regression');
        
        expect(result.performanceRegression).toBe(false);
        expect(result.passed).toBe(true);
      });
    });
  });

  describe('Continuous Testing', () => {
    beforeEach(() => {
      tester.setKeys('pk-test', 'sk-test');
      jest.useFakeTimers();
    });

    test('should run continuous tests periodically', async () => {
      const runSpy = jest.spyOn(tester, 'runContinuousTests');
      
      await tester.start();
      
      // Fast forward time
      jest.advanceTimersByTime(tester.config.testInterval * 2);
      
      expect(runSpy).toHaveBeenCalledTimes(2);
    });

    test('should handle test failures', async () => {
      mockValidator.validateKeys.mockResolvedValueOnce({
        valid: false,
        score: 30
      });
      
      const failureHandler = jest.fn();
      tester.on('test-failure', failureHandler);
      
      await tester.runContinuousTests();
      
      expect(failureHandler).toHaveBeenCalled();
      expect(tester.failureCount).toBe(1);
    });

    test('should trigger critical failure handling', async () => {
      tester.config.failureThreshold = 2;
      
      mockValidator.validateKeys.mockResolvedValue({
        valid: false,
        score: 30
      });
      
      const criticalHandler = jest.fn();
      tester.on('critical-failure', criticalHandler);
      
      // Simulate multiple failures
      await tester.runContinuousTests();
      await tester.runContinuousTests();
      
      expect(criticalHandler).toHaveBeenCalled();
    });
  });

  describe('Failure Recovery', () => {
    beforeEach(() => {
      tester.setKeys('pk-test', 'sk-test');
      tester.config.recoveryAttempts = 3;
    });

    test('should attempt recovery on critical failure', async () => {
      const recoverySpy = jest.spyOn(tester, 'handleCriticalFailure');
      
      // First call fails, subsequent calls succeed
      mockValidator.validateKeys
        .mockResolvedValueOnce({ valid: false, score: 30 })
        .mockResolvedValueOnce({ valid: true, score: 85 });
      
      await tester.handleCriticalFailure({ valid: false });
      
      expect(recoverySpy).toHaveBeenCalled();
    });

    test('should emit recovery success', async () => {
      const successHandler = jest.fn();
      tester.on('recovery-success', successHandler);
      
      mockValidator.validateKeys.mockResolvedValue({
        valid: true,
        score: 85
      });
      
      await tester.handleCriticalFailure({ valid: false });
      
      expect(successHandler).toHaveBeenCalled();
    });

    test('should emit recovery failure after all attempts', async () => {
      const failureHandler = jest.fn();
      tester.on('recovery-failed', failureHandler);
      
      mockValidator.validateKeys.mockResolvedValue({
        valid: false,
        score: 30
      });
      
      await tester.handleCriticalFailure({ valid: false });
      
      expect(failureHandler).toHaveBeenCalled();
    });
  });

  describe('Statistics and Reporting', () => {
    beforeEach(async () => {
      tester.setKeys('pk-test', 'sk-test');
      
      // Add some test results
      tester.testResults = [
        { suite: 'basic', passed: true, duration: 100, timestamp: Date.now() },
        { suite: 'basic', passed: false, duration: 150, timestamp: Date.now() },
        { suite: 'stress', passed: true, duration: 5000, timestamp: Date.now() }
      ];
    });

    test('should calculate test statistics', () => {
      const stats = tester.getTestStatistics();
      
      expect(stats.totalTests).toBe(3);
      expect(stats.passedTests).toBe(2);
      expect(stats.failedTests).toBe(1);
      expect(stats.successRate).toBeCloseTo(66.67, 1);
    });

    test('should track suite-specific stats', () => {
      const stats = tester.getTestStatistics();
      
      expect(stats.suiteStats.basic).toEqual({
        total: 2,
        passed: 1,
        failed: 1
      });
      expect(stats.suiteStats.stress).toEqual({
        total: 1,
        passed: 1,
        failed: 0
      });
    });

    test('should export test results', () => {
      const exported = tester.exportTestResults();
      
      expect(exported.results).toHaveLength(3);
      expect(exported.statistics).toBeDefined();
      expect(exported.config).toBeDefined();
      expect(exported.exportedAt).toBeDefined();
    });

    test('should clear test history', () => {
      tester.clearHistory();
      
      expect(tester.testResults).toHaveLength(0);
      expect(tester.performanceHistory).toHaveLength(0);
      expect(tester.failureCount).toBe(0);
    });
  });

  describe('Performance Monitoring', () => {
    beforeEach(() => {
      tester.setKeys('pk-test', 'sk-test');
    });

    test('should measure performance accurately', async () => {
      const result = await tester.measurePerformance();
      
      expect(result.averageLatency).toBeGreaterThan(0);
      expect(result.minLatency).toBeLessThanOrEqual(result.averageLatency);
      expect(result.maxLatency).toBeGreaterThanOrEqual(result.averageLatency);
      expect(result.measurements).toHaveLength(10);
    });

    test('should track performance history', async () => {
      await tester.runTestSuite('regression');
      await tester.runTestSuite('regression');
      
      expect(tester.performanceHistory).toHaveLength(2);
      expect(tester.performanceHistory[0]).toHaveProperty('timestamp');
      expect(tester.performanceHistory[0]).toHaveProperty('latency');
    });

    test('should limit performance history size', () => {
      // Add 150 entries
      for (let i = 0; i < 150; i++) {
        tester.performanceHistory.push({
          timestamp: Date.now(),
          latency: 1000,
          change: 0
        });
      }
      
      // Trigger cleanup in regression test
      tester.runTestSuite('regression');
      
      expect(tester.performanceHistory.length).toBeLessThanOrEqual(100);
    });
  });
});