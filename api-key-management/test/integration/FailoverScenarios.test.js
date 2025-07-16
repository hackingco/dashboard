/**
 * Integration Tests for Failover Scenarios
 */

import LangfuseApiKeyManager from '../../LangfuseApiKeyManager.js';
import AutomatedKeyTester from '../../AutomatedKeyTester.js';
import { Langfuse } from 'langfuse';

jest.mock('langfuse');

describe('Failover Scenarios', () => {
  let manager;
  let tester;
  let mockLangfuseClient;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
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
    
    manager = new LangfuseApiKeyManager({
      autoRotate: false,
      maxRetries: 3,
      retryDelay: 100
    });
    
    tester = new AutomatedKeyTester({
      failureThreshold: 3,
      recoveryAttempts: 3
    });
  });
  
  afterEach(async () => {
    if (tester.isRunning) {
      await tester.stop();
    }
  });

  describe('Primary Key Failure', () => {
    test('should failover to secondary key when primary fails', async () => {
      // Setup primary and secondary keys
      await manager.generateAndAddKey('primary');
      await manager.generateAndAddKey('secondary');
      await manager.setPrimaryKey('primary');
      
      // Track key usage
      const usedKeys = [];
      manager.on('key-used', (keyId) => usedKeys.push(keyId));
      
      // Simulate primary key failure
      const primaryKey = manager.getKey('primary');
      Langfuse.mockImplementationOnce(() => {
        if (usedKeys.length === 0) {
          throw new Error('Primary key failed');
        }
        return mockLangfuseClient;
      });
      
      // Attempt operation - should failover
      const result = await manager.performOperationWithFailover(async (key) => {
        const client = new Langfuse({
          publicKey: key.publicKey,
          secretKey: key.secretKey
        });
        return client.trace({ name: 'test' });
      });
      
      expect(result).toBeDefined();
      // Should have tried primary first, then secondary
      expect(usedKeys.length).toBeGreaterThanOrEqual(1);
    });

    test('should rotate failed key automatically', async () => {
      await manager.generateAndAddKey('auto-rotate');
      await manager.setPrimaryKey('auto-rotate');
      
      // Enable auto-rotation on failure
      manager.config.rotateOnFailure = true;
      
      // Simulate key failure
      const failedKey = manager.getKey('auto-rotate').publicKey;
      manager.validator.validateKeys = jest.fn()
        .mockResolvedValueOnce({ valid: false, score: 20 })
        .mockResolvedValueOnce({ valid: true, score: 85 });
      
      // Monitor for rotation
      const rotationEvents = [];
      manager.on('key-rotated', (event) => rotationEvents.push(event));
      
      // Trigger health check that will detect failure
      await manager.monitorKeyHealth();
      
      // Key should be rotated
      const newKey = manager.getKey('auto-rotate');
      expect(newKey.publicKey).not.toBe(failedKey);
      expect(rotationEvents).toHaveLength(1);
    });
  });

  describe('Connection Failures', () => {
    test('should retry on temporary connection failures', async () => {
      await manager.generateAndAddKey('retry-test');
      const key = manager.getKey('retry-test');
      
      tester.setKeys(key.publicKey, key.secretKey);
      
      // Simulate temporary failures followed by success
      let attemptCount = 0;
      Langfuse.mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Connection timeout');
        }
        return mockLangfuseClient;
      });
      
      // Should retry and eventually succeed
      const result = await tester.runTestSuite('basic');
      
      expect(attemptCount).toBeGreaterThanOrEqual(3);
      expect(result.passed).toBe(true);
    });

    test('should handle network partition scenarios', async () => {
      // Create multiple keys across "regions"
      await manager.generateAndAddKey('region-1');
      await manager.generateAndAddKey('region-2');
      await manager.generateAndAddKey('region-3');
      
      // Simulate region-1 failure
      const failedRegions = new Set(['region-1']);
      
      Langfuse.mockImplementation((config) => {
        const keyId = manager.listKeys().find(k => 
          k.publicKey === config.publicKey
        )?.id;
        
        if (failedRegions.has(keyId)) {
          throw new Error('Network partition');
        }
        return mockLangfuseClient;
      });
      
      // Should still work with keys from other regions
      const workingKeys = manager.listKeys().filter(k => 
        !failedRegions.has(k.id)
      );
      
      expect(workingKeys).toHaveLength(2);
      
      // Test with working key
      const workingKey = manager.getKey('region-2');
      tester.setKeys(workingKey.publicKey, workingKey.secretKey);
      
      const result = await tester.runTestSuite('basic');
      expect(result.passed).toBe(true);
    });
  });

  describe('Cascading Failures', () => {
    test('should handle multiple simultaneous key failures', async () => {
      // Create multiple keys
      const keyCount = 5;
      for (let i = 0; i < keyCount; i++) {
        await manager.generateAndAddKey(`cascade-${i}`);
      }
      
      // Simulate 60% failure rate
      let callCount = 0;
      Langfuse.mockImplementation(() => {
        callCount++;
        if (callCount % 5 < 3) {
          throw new Error('Service unavailable');
        }
        return mockLangfuseClient;
      });
      
      // Run health monitoring
      const health = await manager.monitorKeyHealth();
      
      // Should identify unhealthy keys
      expect(health.unhealthyKeys).toBeGreaterThan(0);
      expect(health.healthyKeys).toBeGreaterThan(0);
      
      // System should remain operational with healthy keys
      const healthyKey = manager.listKeys().find(k => 
        health.keys[k.id]?.status === 'healthy'
      );
      
      if (healthyKey) {
        tester.setKeys(
          manager.getKey(healthyKey.id).publicKey,
          manager.getKey(healthyKey.id).secretKey
        );
        
        const result = await tester.runTestSuite('basic');
        expect(result).toBeDefined();
      }
    });

    test('should prevent cascade failure propagation', async () => {
      // Setup circuit breaker pattern
      manager.config.circuitBreaker = {
        enabled: true,
        threshold: 5,
        timeout: 1000
      };
      
      await manager.generateAndAddKey('circuit-test');
      const key = manager.getKey('circuit-test');
      
      // Track circuit breaker state
      const circuitStates = [];
      manager.on('circuit-state-change', (state) => circuitStates.push(state));
      
      // Simulate repeated failures
      let failureCount = 0;
      Langfuse.mockImplementation(() => {
        failureCount++;
        throw new Error('Service error');
      });
      
      // Attempt multiple operations
      const attempts = [];
      for (let i = 0; i < 10; i++) {
        attempts.push(
          manager.testKeyConnectivity('circuit-test').catch(e => e)
        );
      }
      
      await Promise.allSettled(attempts);
      
      // Circuit should open after threshold
      expect(failureCount).toBeLessThanOrEqual(
        manager.config.circuitBreaker.threshold + 1
      );
    });
  });

  describe('Recovery Mechanisms', () => {
    test('should execute recovery workflow on failure', async () => {
      await manager.generateAndAddKey('recovery-workflow');
      const key = manager.getKey('recovery-workflow');
      
      tester.setKeys(key.publicKey, key.secretKey);
      
      // Track recovery events
      const recoveryEvents = [];
      tester.on('recovery-success', (event) => recoveryEvents.push(event));
      tester.on('recovery-failed', (event) => recoveryEvents.push(event));
      
      // Simulate failures then recovery
      let attemptCount = 0;
      tester.validator.validateKeys = jest.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 4) {
          return Promise.resolve({ valid: false, score: 20 });
        }
        return Promise.resolve({ valid: true, score: 85 });
      });
      
      // Trigger critical failure
      tester.failureCount = tester.config.failureThreshold;
      await tester.handleCriticalFailure({ valid: false });
      
      // Should have attempted recovery
      expect(attemptCount).toBeGreaterThan(1);
      expect(recoveryEvents).toHaveLength(1);
      expect(recoveryEvents[0]).toHaveProperty('passed', true);
    });

    test('should maintain service degradation mode', async () => {
      // Create keys with different priorities
      await manager.generateAndAddKey('critical-service');
      await manager.generateAndAddKey('standard-service');
      await manager.generateAndAddKey('low-priority');
      
      // Set service levels
      manager.setKeyPriority('critical-service', 'critical');
      manager.setKeyPriority('standard-service', 'standard');
      manager.setKeyPriority('low-priority', 'low');
      
      // Simulate high load scenario
      manager.config.degradationMode = true;
      manager.config.maxActiveKeys = 1;
      
      // Should prioritize critical service
      const activeKey = manager.getActiveKeyForPriority('critical');
      expect(activeKey).toBeDefined();
      expect(activeKey.id).toBe('critical-service');
      
      // Low priority should be rejected
      const lowPriorityKey = manager.getActiveKeyForPriority('low');
      expect(lowPriorityKey).toBeNull();
    });
  });

  describe('Monitoring During Failures', () => {
    test('should maintain telemetry during partial failures', async () => {
      await manager.generateAndAddKey('telemetry-test');
      const key = manager.getKey('telemetry-test');
      
      tester.setKeys(key.publicKey, key.secretKey);
      
      // Track all events
      const events = {
        testComplete: [],
        testError: [],
        testFailure: []
      };
      
      tester.on('test-complete', (e) => events.testComplete.push(e));
      tester.on('test-error', (e) => events.testError.push(e));
      tester.on('test-failure', (e) => events.testFailure.push(e));
      
      // Mix successes and failures
      let callCount = 0;
      tester.validator.validateKeys = jest.fn().mockImplementation(() => {
        callCount++;
        const shouldFail = callCount % 3 === 0;
        return Promise.resolve({
          valid: !shouldFail,
          score: shouldFail ? 30 : 85
        });
      });
      
      // Run multiple test cycles
      for (let i = 0; i < 6; i++) {
        await tester.runTestSuite('basic');
      }
      
      // Should have recorded all attempts
      expect(events.testComplete.length).toBe(6);
      expect(events.testFailure.length).toBeGreaterThan(0);
      expect(events.testComplete.length).toBeGreaterThan(events.testFailure.length);
    });

    test('should generate failure report', async () => {
      // Setup multiple keys
      await manager.generateAndAddKey('report-key-1');
      await manager.generateAndAddKey('report-key-2');
      
      // Simulate mixed health states
      manager.validator.validateKeys = jest.fn()
        .mockResolvedValueOnce({ valid: true, score: 90 })
        .mockResolvedValueOnce({ valid: false, score: 30, 
          error: 'Authentication failed' });
      
      // Generate health report
      const health = await manager.monitorKeyHealth();
      const report = manager.generateHealthReport(health);
      
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('failedKeys');
      expect(report).toHaveProperty('recommendations');
      expect(report.failedKeys).toHaveLength(1);
    });
  });

  describe('Load Balancing During Failures', () => {
    test('should redistribute load when keys fail', async () => {
      // Create pool of keys
      const poolSize = 5;
      for (let i = 0; i < poolSize; i++) {
        await manager.generateAndAddKey(`pool-${i}`);
      }
      
      // Track key usage
      const keyUsage = new Map();
      manager.on('key-selected', (keyId) => {
        keyUsage.set(keyId, (keyUsage.get(keyId) || 0) + 1);
      });
      
      // Mark some keys as failed
      const failedKeys = new Set(['pool-1', 'pool-3']);
      manager.markKeysFailed(failedKeys);
      
      // Perform many operations
      for (let i = 0; i < 100; i++) {
        const key = manager.getRandomHealthyKey();
        expect(key).toBeDefined();
        expect(failedKeys.has(key.id)).toBe(false);
      }
      
      // Load should be distributed among healthy keys
      const healthyKeys = Array.from(keyUsage.keys()).filter(
        id => !failedKeys.has(id)
      );
      expect(healthyKeys.length).toBe(poolSize - failedKeys.size);
      
      // Check relatively even distribution
      const usageCounts = healthyKeys.map(id => keyUsage.get(id));
      const avgUsage = usageCounts.reduce((a, b) => a + b) / usageCounts.length;
      const variance = usageCounts.map(u => Math.abs(u - avgUsage));
      const maxVariance = Math.max(...variance);
      
      expect(maxVariance).toBeLessThan(avgUsage * 0.5); // Within 50% of average
    });

    test('should handle exhaustion of healthy keys', async () => {
      // Create minimal key set
      await manager.generateAndAddKey('last-key-1');
      await manager.generateAndAddKey('last-key-2');
      
      // Both keys fail
      manager.validator.validateKeys = jest.fn()
        .mockResolvedValue({ valid: false, score: 20 });
      
      // Attempt to get healthy key
      const health = await manager.monitorKeyHealth();
      expect(health.healthyKeys).toBe(0);
      
      // Should trigger emergency key generation
      manager.config.autoGenerateOnExhaustion = true;
      const emergencyKey = await manager.getOrCreateHealthyKey();
      
      expect(emergencyKey).toBeDefined();
      expect(manager.listKeys().length).toBe(3); // Original 2 + 1 emergency
    });
  });
});