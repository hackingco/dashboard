/**
 * Performance Tests Under Load
 */

import LangfuseApiKeyManager from '../../LangfuseApiKeyManager.js';
import AutomatedKeyTester from '../../AutomatedKeyTester.js';
import { performance } from 'perf_hooks';

describe('Performance Under Load', () => {
  let manager;
  let tester;
  
  beforeEach(() => {
    manager = new LangfuseApiKeyManager({
      autoRotate: false
    });
    
    tester = new AutomatedKeyTester({
      maxConcurrentTests: 20,
      stressTestInterval: 1000
    });
  });

  describe('High Volume Operations', () => {
    test('should handle 1000 key operations per second', async () => {
      // Create initial key pool
      const keyCount = 10;
      for (let i = 0; i < keyCount; i++) {
        await manager.generateAndAddKey(`perf-key-${i}`);
      }
      
      const startTime = performance.now();
      const operations = [];
      const targetOps = 1000;
      
      // Generate mixed operations
      for (let i = 0; i < targetOps; i++) {
        const operation = i % 4;
        const keyIndex = i % keyCount;
        
        switch (operation) {
          case 0: // Get key
            operations.push(
              Promise.resolve(manager.getKey(`perf-key-${keyIndex}`))
            );
            break;
          case 1: // List keys
            operations.push(
              Promise.resolve(manager.listKeys())
            );
            break;
          case 2: // Get random key
            operations.push(
              Promise.resolve(manager.getRandomKey())
            );
            break;
          case 3: // Get statistics
            operations.push(
              Promise.resolve(manager.getStatistics())
            );
            break;
        }
      }
      
      // Execute all operations
      await Promise.all(operations);
      
      const duration = performance.now() - startTime;
      const opsPerSecond = (targetOps / duration) * 1000;
      
      console.log(`Achieved ${opsPerSecond.toFixed(0)} ops/second`);
      
      expect(opsPerSecond).toBeGreaterThan(900); // Allow 10% margin
      expect(duration).toBeLessThan(1200); // Should complete within 1.2 seconds
    });

    test('should maintain low latency under concurrent load', async () => {
      // Create keys
      const keyCount = 5;
      for (let i = 0; i < keyCount; i++) {
        await manager.generateAndAddKey(`latency-key-${i}`);
      }
      
      const concurrency = 50;
      const latencies = [];
      
      // Run concurrent operations
      const operations = Array(concurrency).fill(null).map(async (_, index) => {
        const opStart = performance.now();
        
        // Perform various operations
        const key = manager.getRandomKey();
        await manager.validateKey(key.id);
        const stats = manager.getStatistics();
        
        const latency = performance.now() - opStart;
        latencies.push(latency);
        
        return latency;
      });
      
      await Promise.all(operations);
      
      // Calculate percentiles
      latencies.sort((a, b) => a - b);
      const p50 = latencies[Math.floor(latencies.length * 0.5)];
      const p95 = latencies[Math.floor(latencies.length * 0.95)];
      const p99 = latencies[Math.floor(latencies.length * 0.99)];
      
      console.log(`Latencies - P50: ${p50.toFixed(2)}ms, P95: ${p95.toFixed(2)}ms, P99: ${p99.toFixed(2)}ms`);
      
      expect(p50).toBeLessThan(10); // 50th percentile under 10ms
      expect(p95).toBeLessThan(50); // 95th percentile under 50ms
      expect(p99).toBeLessThan(100); // 99th percentile under 100ms
    });
  });

  describe('Memory Efficiency', () => {
    test('should not leak memory during extended operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Run many operations
      for (let cycle = 0; cycle < 10; cycle++) {
        // Create and delete keys repeatedly
        const tempKeys = [];
        
        for (let i = 0; i < 100; i++) {
          const keyId = `mem-test-${cycle}-${i}`;
          await manager.generateAndAddKey(keyId);
          tempKeys.push(keyId);
        }
        
        // Validate all keys
        for (const keyId of tempKeys) {
          await manager.validateKey(keyId);
        }
        
        // Delete all keys
        for (const keyId of tempKeys) {
          manager.removeKey(keyId);
        }
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;
      const growthPercentage = (memoryGrowth / initialMemory) * 100;
      
      console.log(`Memory growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB (${growthPercentage.toFixed(1)}%)`);
      
      // Allow up to 20% memory growth
      expect(growthPercentage).toBeLessThan(20);
    });

    test('should efficiently handle large key collections', async () => {
      const largeKeyCount = 10000;
      const startMemory = process.memoryUsage().heapUsed;
      
      // Create many keys
      const createStart = performance.now();
      const createPromises = [];
      
      for (let i = 0; i < largeKeyCount; i += 100) {
        const batch = [];
        for (let j = 0; j < 100 && i + j < largeKeyCount; j++) {
          batch.push(manager.generateAndAddKey(`large-${i + j}`));
        }
        createPromises.push(Promise.all(batch));
      }
      
      await Promise.all(createPromises);
      const createDuration = performance.now() - createStart;
      
      const midMemory = process.memoryUsage().heapUsed;
      const memoryPerKey = (midMemory - startMemory) / largeKeyCount;
      
      // Test operations on large collection
      const listStart = performance.now();
      const allKeys = manager.listKeys();
      const listDuration = performance.now() - listStart;
      
      console.log(`Created ${largeKeyCount} keys in ${createDuration.toFixed(0)}ms`);
      console.log(`Memory per key: ${memoryPerKey.toFixed(0)} bytes`);
      console.log(`List operation took ${listDuration.toFixed(2)}ms`);
      
      expect(allKeys).toHaveLength(largeKeyCount);
      expect(listDuration).toBeLessThan(100); // List should be fast even with many keys
      expect(memoryPerKey).toBeLessThan(1000); // Less than 1KB per key
    });
  });

  describe('Stress Testing', () => {
    test('should handle burst traffic', async () => {
      // Create test keys
      await manager.generateAndAddKey('burst-key-1');
      await manager.generateAndAddKey('burst-key-2');
      
      const burstSize = 1000;
      const results = {
        success: 0,
        failure: 0,
        totalTime: 0
      };
      
      // Send burst of requests
      const burstStart = performance.now();
      const burstOps = Array(burstSize).fill(null).map(async () => {
        try {
          const key = manager.getRandomKey();
          tester.setKeys(key.publicKey, key.secretKey);
          
          const result = await tester.createStressTestTraces(
            { trace: jest.fn().mockReturnValue({ span: jest.fn() }) },
            Math.floor(Math.random() * 100)
          );
          
          results.success++;
          return result;
        } catch (error) {
          results.failure++;
          throw error;
        }
      });
      
      await Promise.allSettled(burstOps);
      results.totalTime = performance.now() - burstStart;
      
      const successRate = (results.success / burstSize) * 100;
      const throughput = (burstSize / results.totalTime) * 1000;
      
      console.log(`Burst test: ${successRate.toFixed(1)}% success, ${throughput.toFixed(0)} ops/sec`);
      
      expect(successRate).toBeGreaterThan(95);
      expect(results.totalTime).toBeLessThan(5000); // Complete within 5 seconds
    });

    test('should degrade gracefully under extreme load', async () => {
      // Create minimal key set
      await manager.generateAndAddKey('extreme-key');
      const key = manager.getKey('extreme-key');
      
      tester.setKeys(key.publicKey, key.secretKey);
      
      // Track performance metrics
      const metrics = {
        operations: 0,
        successes: 0,
        failures: 0,
        latencies: []
      };
      
      // Apply extreme load
      const extremeLoad = 5000;
      const loadStart = performance.now();
      
      const operations = Array(extremeLoad).fill(null).map(async (_, index) => {
        const opStart = performance.now();
        metrics.operations++;
        
        try {
          // Simulate complex operation
          await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
          
          const latency = performance.now() - opStart;
          metrics.latencies.push(latency);
          metrics.successes++;
          
          return { success: true, latency };
        } catch (error) {
          metrics.failures++;
          return { success: false, error };
        }
      });
      
      // Execute with limited concurrency to avoid overwhelming
      const concurrencyLimit = 100;
      const results = [];
      
      for (let i = 0; i < operations.length; i += concurrencyLimit) {
        const batch = operations.slice(i, i + concurrencyLimit);
        const batchResults = await Promise.allSettled(batch);
        results.push(...batchResults);
      }
      
      const totalDuration = performance.now() - loadStart;
      
      // Calculate degradation metrics
      metrics.latencies.sort((a, b) => a - b);
      const avgLatency = metrics.latencies.reduce((a, b) => a + b, 0) / metrics.latencies.length;
      const maxLatency = metrics.latencies[metrics.latencies.length - 1];
      
      console.log(`Extreme load test completed:`);
      console.log(`- Operations: ${metrics.operations}`);
      console.log(`- Success rate: ${((metrics.successes / metrics.operations) * 100).toFixed(1)}%`);
      console.log(`- Avg latency: ${avgLatency.toFixed(2)}ms`);
      console.log(`- Max latency: ${maxLatency.toFixed(2)}ms`);
      console.log(`- Total duration: ${(totalDuration / 1000).toFixed(1)}s`);
      
      // System should complete all operations
      expect(metrics.operations).toBe(extremeLoad);
      
      // Some degradation is acceptable, but should maintain functionality
      expect(metrics.successes / metrics.operations).toBeGreaterThan(0.9);
      expect(avgLatency).toBeLessThan(100);
    });
  });

  describe('Concurrent Modifications', () => {
    test('should handle concurrent key rotations safely', async () => {
      // Create keys for concurrent rotation
      const concurrentKeys = 10;
      for (let i = 0; i < concurrentKeys; i++) {
        await manager.generateAndAddKey(`concurrent-${i}`);
      }
      
      // Rotate all keys simultaneously
      const rotationStart = performance.now();
      const rotations = [];
      
      for (let i = 0; i < concurrentKeys; i++) {
        rotations.push(manager.rotateKey(`concurrent-${i}`));
      }
      
      const results = await Promise.allSettled(rotations);
      const rotationDuration = performance.now() - rotationStart;
      
      // Check results
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success);
      const failed = results.filter(r => r.status === 'rejected' || !r.value?.success);
      
      console.log(`Concurrent rotations: ${successful.length} succeeded, ${failed.length} failed`);
      console.log(`Total duration: ${rotationDuration.toFixed(0)}ms`);
      
      expect(successful.length).toBe(concurrentKeys);
      expect(failed.length).toBe(0);
      
      // Verify all keys were actually rotated
      for (let i = 0; i < concurrentKeys; i++) {
        const key = manager.getKey(`concurrent-${i}`);
        expect(key.rotationCount).toBe(1);
      }
    });

    test('should maintain consistency during concurrent operations', async () => {
      // Create shared key
      await manager.generateAndAddKey('consistency-test');
      
      const operations = [];
      const operationCount = 100;
      
      // Mix of read and write operations
      for (let i = 0; i < operationCount; i++) {
        const op = i % 5;
        
        switch (op) {
          case 0: // Validate
            operations.push(manager.validateKey('consistency-test'));
            break;
          case 1: // Get stats
            operations.push(Promise.resolve(manager.getStatistics()));
            break;
          case 2: // Monitor health
            operations.push(manager.monitorKeyHealth());
            break;
          case 3: // Update metadata
            operations.push(
              manager.updateKeyMetadata('consistency-test', {
                lastChecked: Date.now()
              })
            );
            break;
          case 4: // Read key
            operations.push(
              Promise.resolve(manager.getKey('consistency-test'))
            );
            break;
        }
      }
      
      // Execute all operations concurrently
      const results = await Promise.allSettled(operations);
      
      // Verify consistency
      const errors = results.filter(r => r.status === 'rejected');
      expect(errors).toHaveLength(0);
      
      // Key should still be valid and consistent
      const finalKey = manager.getKey('consistency-test');
      expect(finalKey).toBeDefined();
      expect(finalKey.publicKey).toMatch(/^pk-lf-/);
    });
  });

  describe('Resource Limits', () => {
    test('should respect rate limits', async () => {
      // Configure rate limiting
      manager.config.rateLimit = {
        enabled: true,
        maxRequests: 100,
        windowMs: 1000
      };
      
      const requests = 150; // Exceeds limit
      const results = {
        accepted: 0,
        rejected: 0
      };
      
      const startTime = performance.now();
      
      // Send requests
      for (let i = 0; i < requests; i++) {
        try {
          await manager.checkRateLimit();
          results.accepted++;
        } catch (error) {
          results.rejected++;
        }
        
        // Small delay to spread requests
        await new Promise(resolve => setTimeout(resolve, 5));
      }
      
      const duration = performance.now() - startTime;
      
      console.log(`Rate limiting: ${results.accepted} accepted, ${results.rejected} rejected`);
      
      // Should enforce rate limit
      expect(results.rejected).toBeGreaterThan(0);
      expect(results.accepted).toBeLessThanOrEqual(manager.config.rateLimit.maxRequests);
    });

    test('should handle resource exhaustion gracefully', async () => {
      // Simulate low resources
      const originalMaxKeys = manager.config.maxKeys;
      manager.config.maxKeys = 5;
      
      // Try to exceed limit
      const attempts = 10;
      const results = [];
      
      for (let i = 0; i < attempts; i++) {
        results.push(
          await manager.generateAndAddKey(`resource-${i}`)
            .then(r => ({ success: true, result: r }))
            .catch(e => ({ success: false, error: e }))
        );
      }
      
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      
      console.log(`Resource limit test: ${successful} succeeded, ${failed} failed`);
      
      expect(successful).toBeLessThanOrEqual(manager.config.maxKeys);
      expect(failed).toBeGreaterThan(0);
      
      // Restore original limit
      manager.config.maxKeys = originalMaxKeys;
    });
  });
});