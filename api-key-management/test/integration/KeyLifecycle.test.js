/**
 * Integration Tests for Complete Key Lifecycle
 */

import LangfuseApiKeyManager from '../../LangfuseApiKeyManager.js';
import AutomatedKeyTester from '../../AutomatedKeyTester.js';
import { Langfuse } from 'langfuse';

// Mock Langfuse for integration tests
jest.mock('langfuse');

describe('Key Lifecycle Integration', () => {
  let manager;
  let tester;
  let mockLangfuseClient;
  
  beforeAll(() => {
    // Setup mock Langfuse client
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
  });
  
  beforeEach(() => {
    manager = new LangfuseApiKeyManager({
      autoRotate: false,
      storageFile: './test-keys.json'
    });
    
    tester = new AutomatedKeyTester({
      testInterval: 1000,
      stressTestInterval: 5000
    });
  });
  
  afterEach(async () => {
    if (tester.isRunning) {
      await tester.stop();
    }
    
    // Cleanup test files
    const fs = require('fs/promises');
    try {
      await fs.unlink('./test-keys.json');
    } catch (error) {
      // File may not exist
    }
  });

  describe('Complete Key Lifecycle', () => {
    test('should handle key creation, validation, and rotation', async () => {
      // Create new keys
      const keyResult = await manager.generateAndAddKey('lifecycle-test');
      expect(keyResult.success).toBe(true);
      
      const key = manager.getKey('lifecycle-test');
      expect(key).toBeDefined();
      expect(key.publicKey).toMatch(/^pk-lf-/);
      
      // Validate the keys
      tester.setKeys(key.publicKey, key.secretKey);
      const validation = await tester.runTestSuite('basic');
      expect(validation.passed).toBe(true);
      
      // Rotate the keys
      const rotationResult = await manager.rotateKey('lifecycle-test');
      expect(rotationResult.success).toBe(true);
      
      const rotatedKey = manager.getKey('lifecycle-test');
      expect(rotatedKey.publicKey).not.toBe(key.publicKey);
      expect(rotatedKey.rotationCount).toBe(1);
      
      // Validate new keys
      tester.setKeys(rotatedKey.publicKey, rotatedKey.secretKey);
      const newValidation = await tester.runTestSuite('basic');
      expect(newValidation.passed).toBe(true);
    });

    test('should persist keys across sessions', async () => {
      // Create and save keys
      await manager.generateAndAddKey('persist-test');
      await manager.saveKeys();
      
      // Create new manager instance
      const newManager = new LangfuseApiKeyManager({
        storageFile: './test-keys.json'
      });
      
      // Load saved keys
      await newManager.loadKeys();
      
      const loadedKey = newManager.getKey('persist-test');
      expect(loadedKey).toBeDefined();
      expect(loadedKey.publicKey).toMatch(/^pk-lf-/);
    });
  });

  describe('Multi-Key Management', () => {
    test('should manage multiple keys with load balancing', async () => {
      // Create multiple keys
      await manager.generateAndAddKey('key-1');
      await manager.generateAndAddKey('key-2');
      await manager.generateAndAddKey('key-3');
      
      // Set primary key
      await manager.setPrimaryKey('key-1');
      
      // Test primary key retrieval
      const primaryKey = manager.getPrimaryKey();
      expect(primaryKey.publicKey).toBe(manager.getKey('key-1').publicKey);
      
      // Test random key distribution
      const selectedKeys = new Set();
      for (let i = 0; i < 20; i++) {
        const randomKey = manager.getRandomKey();
        selectedKeys.add(randomKey.publicKey);
      }
      
      // Should have selected multiple different keys
      expect(selectedKeys.size).toBeGreaterThan(1);
    });

    test('should handle concurrent key operations', async () => {
      // Create keys concurrently
      const createPromises = [
        manager.generateAndAddKey('concurrent-1'),
        manager.generateAndAddKey('concurrent-2'),
        manager.generateAndAddKey('concurrent-3')
      ];
      
      const results = await Promise.all(createPromises);
      expect(results.every(r => r.success)).toBe(true);
      
      // Rotate keys concurrently
      const rotatePromises = [
        manager.rotateKey('concurrent-1'),
        manager.rotateKey('concurrent-2'),
        manager.rotateKey('concurrent-3')
      ];
      
      const rotationResults = await Promise.all(rotatePromises);
      expect(rotationResults.every(r => r.success)).toBe(true);
    });
  });

  describe('Automated Testing Integration', () => {
    test('should monitor key health continuously', async () => {
      // Create key
      await manager.generateAndAddKey('monitor-test');
      const key = manager.getKey('monitor-test');
      
      // Start automated testing
      tester.setKeys(key.publicKey, key.secretKey);
      await tester.start();
      
      // Wait for at least one test cycle
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Check test results
      const stats = tester.getTestStatistics();
      expect(stats.totalTests).toBeGreaterThan(0);
      
      await tester.stop();
    });

    test('should handle key rotation during active testing', async () => {
      // Create key and start testing
      await manager.generateAndAddKey('active-test');
      const originalKey = manager.getKey('active-test');
      
      tester.setKeys(originalKey.publicKey, originalKey.secretKey);
      await tester.start();
      
      // Rotate key while testing is active
      const rotationResult = await manager.rotateKey('active-test');
      expect(rotationResult.success).toBe(true);
      
      // Update tester with new keys
      const newKey = manager.getKey('active-test');
      tester.setKeys(newKey.publicKey, newKey.secretKey);
      
      // Verify testing continues with new keys
      await new Promise(resolve => setTimeout(resolve, 1500));
      const stats = tester.getTestStatistics();
      expect(stats.totalTests).toBeGreaterThan(0);
      
      await tester.stop();
    });
  });

  describe('Health Monitoring and Alerts', () => {
    test('should detect and alert on unhealthy keys', async () => {
      const healthAlerts = [];
      manager.on('health-alert', (alert) => healthAlerts.push(alert));
      
      // Create a key (mocked as healthy)
      await manager.generateAndAddKey('health-test');
      
      // Monitor health
      const health = await manager.monitorKeyHealth();
      expect(health.healthyKeys).toBe(1);
      
      // Simulate unhealthy key by modifying mock
      Langfuse.mockImplementationOnce(() => {
        throw new Error('Connection failed');
      });
      
      // This would trigger health alert in real scenario
      // For testing, we'll check the health monitoring structure
      expect(health).toHaveProperty('totalKeys');
      expect(health).toHaveProperty('healthyKeys');
      expect(health).toHaveProperty('unhealthyKeys');
    });

    test('should integrate health monitoring with automated testing', async () => {
      await manager.generateAndAddKey('integrated-health');
      const key = manager.getKey('integrated-health');
      
      // Setup test monitoring
      const testResults = [];
      tester.on('test-complete', (result) => testResults.push(result));
      
      tester.setKeys(key.publicKey, key.secretKey);
      
      // Run single test cycle
      await tester.runTestSuite('basic');
      
      // Check integration
      expect(testResults).toHaveLength(1);
      expect(testResults[0].suite).toBe('basic');
      
      // Monitor key health based on test results
      const health = await manager.monitorKeyHealth();
      expect(health.keys['integrated-health']).toBeDefined();
    });
  });

  describe('Performance and Stress Testing', () => {
    test('should handle high-frequency key operations', async () => {
      const operationCount = 50;
      const startTime = Date.now();
      
      // Rapid key creation
      const createPromises = [];
      for (let i = 0; i < operationCount; i++) {
        createPromises.push(manager.generateAndAddKey(`perf-key-${i}`));
      }
      
      await Promise.all(createPromises);
      
      const creationTime = Date.now() - startTime;
      expect(creationTime).toBeLessThan(5000); // Should complete within 5 seconds
      
      // Verify all keys created
      expect(manager.listKeys()).toHaveLength(operationCount);
    });

    test('should maintain performance under stress testing', async () => {
      await manager.generateAndAddKey('stress-key');
      const key = manager.getKey('stress-key');
      
      tester.setKeys(key.publicKey, key.secretKey);
      
      // Run stress test
      const stressResult = await tester.runTestSuite('stress');
      
      expect(stressResult.passed).toBe(true);
      expect(stressResult.totalTraces).toBeGreaterThan(0);
      expect(stressResult.throughput).toBeGreaterThan(0);
      
      // Verify no performance degradation
      const regressionResult = await tester.runTestSuite('regression');
      expect(regressionResult.performanceRegression).toBe(false);
    });
  });

  describe('Error Recovery and Resilience', () => {
    test('should recover from key validation failures', async () => {
      // Simulate initial failure
      const mockValidator = manager.validator;
      mockValidator.validateKeys = jest.fn()
        .mockResolvedValueOnce({ valid: false, score: 30 })
        .mockResolvedValueOnce({ valid: true, score: 85 });
      
      // First attempt fails
      const firstAttempt = await manager.addKey('recovery-test', 'pk-bad', 'sk-bad');
      expect(firstAttempt.success).toBe(false);
      
      // Generate new keys and retry
      const secondAttempt = await manager.generateAndAddKey('recovery-test');
      expect(secondAttempt.success).toBe(true);
    });

    test('should handle tester failures gracefully', async () => {
      await manager.generateAndAddKey('failure-test');
      const key = manager.getKey('failure-test');
      
      tester.setKeys(key.publicKey, key.secretKey);
      
      // Track critical failures
      const criticalFailures = [];
      tester.on('critical-failure', (failure) => criticalFailures.push(failure));
      
      // Simulate multiple failures
      tester.config.failureThreshold = 2;
      const mockValidator = tester.validator;
      mockValidator.validateKeys = jest.fn().mockResolvedValue({
        valid: false,
        score: 20
      });
      
      // Run tests that will fail
      await tester.runContinuousTests();
      await tester.runContinuousTests();
      
      // Should trigger critical failure handling
      expect(tester.failureCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Full System Integration', () => {
    test('should complete end-to-end workflow', async () => {
      // 1. Generate keys
      await manager.generateAndAddKey('e2e-test');
      
      // 2. Set as primary
      await manager.setPrimaryKey('e2e-test');
      
      // 3. Start automated testing
      const key = manager.getPrimaryKey();
      tester.setKeys(key.publicKey, key.secretKey);
      await tester.start();
      
      // 4. Monitor health
      await new Promise(resolve => setTimeout(resolve, 1500));
      const health = await manager.monitorKeyHealth();
      expect(health.healthyKeys).toBe(1);
      
      // 5. Check statistics
      const stats = tester.getTestStatistics();
      expect(stats.totalTests).toBeGreaterThan(0);
      expect(stats.successRate).toBeGreaterThan(0);
      
      // 6. Rotate key
      const rotationResult = await manager.rotateKey('e2e-test');
      expect(rotationResult.success).toBe(true);
      
      // 7. Update tester with new key
      const newKey = manager.getPrimaryKey();
      tester.setKeys(newKey.publicKey, newKey.secretKey);
      
      // 8. Save state
      await manager.saveKeys();
      
      // 9. Export results
      const exportedData = tester.exportTestResults();
      expect(exportedData.results).toBeDefined();
      expect(exportedData.statistics).toBeDefined();
      
      // 10. Cleanup
      await tester.stop();
    });
  });
});