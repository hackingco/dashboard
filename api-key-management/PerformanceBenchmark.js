#!/usr/bin/env node

/**
 * 📊 Performance Benchmark Tool
 * 
 * Comprehensive benchmark utility for comparing original vs optimized
 * API key management system performance.
 * 
 * Features:
 * - Side-by-side comparison
 * - Concurrent load testing
 * - Memory usage tracking
 * - Response time analysis
 * - Cache effectiveness
 * - Connection pool efficiency
 * 
 * Author: Performance Optimizer Agent
 * Date: 2025-07-14
 */

import { performance } from 'perf_hooks';
import { promisify } from 'util';
import os from 'os';
import v8 from 'v8';
import LangfuseApiKeyManager from './LangfuseApiKeyManager.js';
import OptimizedApiKeyManager from './OptimizedApiKeyManager.js';

const sleep = promisify(setTimeout);

class PerformanceBenchmark {
  constructor() {
    this.results = {
      original: {
        name: 'Original Manager',
        tests: {},
        metrics: {}
      },
      optimized: {
        name: 'Optimized Manager',
        tests: {},
        metrics: {}
      }
    };
    
    this.testConfig = {
      iterations: 100,
      concurrentRequests: 10,
      cacheWarmupSize: 50,
      testDuration: 30000 // 30 seconds
    };
  }

  /**
   * Run complete benchmark suite
   */
  async runBenchmark() {
    console.log('📊 Starting Performance Benchmark...\n');
    console.log('Configuration:');
    console.log(`  - Iterations: ${this.testConfig.iterations}`);
    console.log(`  - Concurrent Requests: ${this.testConfig.concurrentRequests}`);
    console.log(`  - Test Duration: ${this.testConfig.testDuration}ms\n`);
    
    // Test original implementation
    console.log('🔵 Testing Original Implementation...');
    const originalManager = new LangfuseApiKeyManager();
    await this.testImplementation(originalManager, 'original');
    
    console.log('\n🟢 Testing Optimized Implementation...');
    const optimizedManager = new OptimizedApiKeyManager();
    await this.testImplementation(optimizedManager, 'optimized');
    
    // Generate comparison report
    this.generateReport();
  }

  /**
   * Test a specific implementation
   */
  async testImplementation(manager, type) {
    const startMemory = process.memoryUsage();
    const startTime = performance.now();
    
    try {
      // Initialize
      await this.measureOperation(
        () => manager.initialize(),
        type,
        'initialization'
      );
      
      // Test key validation
      await this.testKeyValidation(manager, type);
      
      // Test concurrent operations
      await this.testConcurrentOperations(manager, type);
      
      // Test cache effectiveness
      await this.testCacheEffectiveness(manager, type);
      
      // Test sustained load
      await this.testSustainedLoad(manager, type);
      
      // Collect metrics
      const endTime = performance.now();
      const endMemory = process.memoryUsage();
      
      this.results[type].metrics = {
        totalDuration: endTime - startTime,
        memoryUsage: {
          start: this.formatBytes(startMemory.heapUsed),
          end: this.formatBytes(endMemory.heapUsed),
          delta: this.formatBytes(endMemory.heapUsed - startMemory.heapUsed)
        },
        cpuUsage: process.cpuUsage()
      };
      
      // Get performance stats if available
      if (manager.getPerformanceStats) {
        this.results[type].performanceStats = await manager.getPerformanceStats();
      }
      
      // Cleanup
      if (manager.shutdown) {
        await manager.shutdown();
      }
      
    } catch (error) {
      console.error(`❌ Error testing ${type}:`, error);
      this.results[type].error = error.message;
    }
  }

  /**
   * Test key validation performance
   */
  async testKeyValidation(manager, type) {
    console.log('  📍 Testing key validation...');
    
    const publicKey = 'pk-lf-REDACTED';
    const secretKey = 'sk-lf-5f3b4323-450a-49bb-9dfc-f55da800d343';
    
    const times = [];
    
    for (let i = 0; i < this.testConfig.iterations; i++) {
      const startTime = performance.now();
      
      await manager.validateKeys(publicKey, secretKey);
      
      times.push(performance.now() - startTime);
      
      // Small delay to prevent overwhelming
      if (i % 10 === 0) {
        await sleep(10);
      }
    }
    
    this.results[type].tests.keyValidation = this.calculateStats(times);
  }

  /**
   * Test concurrent operations
   */
  async testConcurrentOperations(manager, type) {
    console.log('  📍 Testing concurrent operations...');
    
    const publicKey = 'pk-lf-REDACTED';
    const secretKey = 'sk-lf-5f3b4323-450a-49bb-9dfc-f55da800d343';
    
    const startTime = performance.now();
    
    // Create concurrent requests
    const promises = [];
    for (let i = 0; i < this.testConfig.concurrentRequests; i++) {
      promises.push(manager.validateKeys(publicKey, secretKey));
    }
    
    await Promise.all(promises);
    
    const duration = performance.now() - startTime;
    
    this.results[type].tests.concurrentOps = {
      totalDuration: duration,
      avgPerRequest: duration / this.testConfig.concurrentRequests,
      requestsPerSecond: (this.testConfig.concurrentRequests / duration) * 1000
    };
  }

  /**
   * Test cache effectiveness
   */
  async testCacheEffectiveness(manager, type) {
    console.log('  📍 Testing cache effectiveness...');
    
    const publicKey = 'pk-lf-REDACTED';
    const secretKey = 'sk-lf-5f3b4323-450a-49bb-9dfc-f55da800d343';
    
    // Warm up cache
    for (let i = 0; i < this.testConfig.cacheWarmupSize; i++) {
      await manager.validateKeys(publicKey, secretKey);
    }
    
    // Test cache hits
    const cacheTimes = [];
    for (let i = 0; i < 50; i++) {
      const startTime = performance.now();
      await manager.validateKeys(publicKey, secretKey);
      cacheTimes.push(performance.now() - startTime);
    }
    
    this.results[type].tests.cachePerformance = {
      warmupSize: this.testConfig.cacheWarmupSize,
      cacheHitStats: this.calculateStats(cacheTimes),
      avgCacheHitTime: cacheTimes.reduce((a, b) => a + b) / cacheTimes.length
    };
  }

  /**
   * Test sustained load
   */
  async testSustainedLoad(manager, type) {
    console.log('  📍 Testing sustained load...');
    
    const publicKey = 'pk-lf-REDACTED';
    const secretKey = 'sk-lf-5f3b4323-450a-49bb-9dfc-f55da800d343';
    
    const startTime = performance.now();
    let requestCount = 0;
    const responseTimes = [];
    
    // Run for specified duration
    while (performance.now() - startTime < this.testConfig.testDuration) {
      const reqStart = performance.now();
      
      await manager.validateKeys(publicKey, secretKey);
      
      responseTimes.push(performance.now() - reqStart);
      requestCount++;
      
      // Small delay to simulate realistic load
      await sleep(Math.random() * 100);
    }
    
    const totalDuration = performance.now() - startTime;
    
    this.results[type].tests.sustainedLoad = {
      duration: totalDuration,
      totalRequests: requestCount,
      requestsPerSecond: (requestCount / totalDuration) * 1000,
      responseTimeStats: this.calculateStats(responseTimes)
    };
  }

  /**
   * Measure operation performance
   */
  async measureOperation(operation, type, name) {
    const startTime = performance.now();
    const startMemory = process.memoryUsage();
    
    await operation();
    
    const duration = performance.now() - startTime;
    const endMemory = process.memoryUsage();
    
    this.results[type].tests[name] = {
      duration,
      memoryDelta: endMemory.heapUsed - startMemory.heapUsed
    };
  }

  /**
   * Calculate statistics
   */
  calculateStats(times) {
    const sorted = times.sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    
    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sum / sorted.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    };
  }

  /**
   * Format bytes
   */
  formatBytes(bytes) {
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }

  /**
   * Generate comparison report
   */
  generateReport() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 PERFORMANCE BENCHMARK RESULTS');
    console.log('='.repeat(80) + '\n');
    
    // Initialization comparison
    console.log('🚀 INITIALIZATION');
    console.log('-'.repeat(40));
    this.compareMetric('initialization', 'duration', 'ms');
    
    // Key validation comparison
    console.log('\n🔑 KEY VALIDATION (avg per request)');
    console.log('-'.repeat(40));
    if (this.results.original.tests.keyValidation && this.results.optimized.tests.keyValidation) {
      const origAvg = this.results.original.tests.keyValidation.avg;
      const optAvg = this.results.optimized.tests.keyValidation.avg;
      const improvement = ((origAvg - optAvg) / origAvg) * 100;
      
      console.log(`Original:  ${origAvg.toFixed(2)}ms`);
      console.log(`Optimized: ${optAvg.toFixed(2)}ms`);
      console.log(`Improvement: ${improvement.toFixed(1)}% faster ✨`);
    }
    
    // Concurrent operations comparison
    console.log('\n⚡ CONCURRENT OPERATIONS');
    console.log('-'.repeat(40));
    if (this.results.original.tests.concurrentOps && this.results.optimized.tests.concurrentOps) {
      const origRPS = this.results.original.tests.concurrentOps.requestsPerSecond;
      const optRPS = this.results.optimized.tests.concurrentOps.requestsPerSecond;
      const improvement = ((optRPS - origRPS) / origRPS) * 100;
      
      console.log(`Original:  ${origRPS.toFixed(2)} req/s`);
      console.log(`Optimized: ${optRPS.toFixed(2)} req/s`);
      console.log(`Improvement: ${improvement.toFixed(1)}% higher throughput 🚀`);
    }
    
    // Cache performance
    console.log('\n💾 CACHE PERFORMANCE');
    console.log('-'.repeat(40));
    if (this.results.optimized.tests.cachePerformance) {
      const cacheStats = this.results.optimized.tests.cachePerformance;
      console.log(`Cache hit time: ${cacheStats.avgCacheHitTime.toFixed(2)}ms`);
      
      if (this.results.optimized.performanceStats?.caching?.validation) {
        const cacheStats = this.results.optimized.performanceStats.caching.validation;
        console.log(`Cache hit rate: ${cacheStats.hitRate}`);
        console.log(`Total hits: ${cacheStats.hits}`);
      }
    }
    
    // Sustained load comparison
    console.log('\n📈 SUSTAINED LOAD TEST');
    console.log('-'.repeat(40));
    if (this.results.original.tests.sustainedLoad && this.results.optimized.tests.sustainedLoad) {
      const origLoad = this.results.original.tests.sustainedLoad;
      const optLoad = this.results.optimized.tests.sustainedLoad;
      
      console.log(`Original:  ${origLoad.requestsPerSecond.toFixed(2)} req/s sustained`);
      console.log(`Optimized: ${optLoad.requestsPerSecond.toFixed(2)} req/s sustained`);
      
      const improvement = ((optLoad.requestsPerSecond - origLoad.requestsPerSecond) / origLoad.requestsPerSecond) * 100;
      console.log(`Improvement: ${improvement.toFixed(1)}% higher sustained throughput 💪`);
    }
    
    // Memory usage comparison
    console.log('\n💾 MEMORY USAGE');
    console.log('-'.repeat(40));
    if (this.results.original.metrics && this.results.optimized.metrics) {
      console.log(`Original:  ${this.results.original.metrics.memoryUsage.delta}`);
      console.log(`Optimized: ${this.results.optimized.metrics.memoryUsage.delta}`);
    }
    
    // Connection pool stats (optimized only)
    if (this.results.optimized.performanceStats?.connectionPool) {
      console.log('\n🔌 CONNECTION POOL STATS');
      console.log('-'.repeat(40));
      const poolStats = this.results.optimized.performanceStats.connectionPool;
      console.log(`Connection reuse rate: ${poolStats.reuseRate}`);
      console.log(`Active connections: ${poolStats.activeConnections}`);
      console.log(`Total requests: ${poolStats.totalRequests}`);
    }
    
    // Overall summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 OVERALL PERFORMANCE IMPROVEMENT SUMMARY');
    console.log('='.repeat(80));
    
    if (this.results.original.tests.keyValidation && this.results.optimized.tests.keyValidation) {
      const origAvg = this.results.original.tests.keyValidation.avg;
      const optAvg = this.results.optimized.tests.keyValidation.avg;
      const speedup = origAvg / optAvg;
      
      console.log(`\n✨ The optimized implementation is ${speedup.toFixed(1)}x faster! ✨`);
    }
    
    // Save detailed results
    this.saveResults();
  }

  /**
   * Compare specific metric
   */
  compareMetric(test, metric, unit = '') {
    const orig = this.results.original.tests[test]?.[metric];
    const opt = this.results.optimized.tests[test]?.[metric];
    
    if (orig !== undefined && opt !== undefined) {
      const improvement = ((orig - opt) / orig) * 100;
      console.log(`Original:  ${orig.toFixed(2)}${unit}`);
      console.log(`Optimized: ${opt.toFixed(2)}${unit}`);
      console.log(`Improvement: ${improvement.toFixed(1)}%`);
    }
  }

  /**
   * Save detailed results to file
   */
  saveResults() {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const resultsFile = path.join(__dirname, 'benchmark-results.json');
    
    const results = {
      timestamp: new Date().toISOString(),
      system: {
        platform: os.platform(),
        arch: os.arch(),
        cpus: os.cpus().length,
        memory: this.formatBytes(os.totalmem()),
        nodeVersion: process.version
      },
      config: this.testConfig,
      results: this.results
    };
    
    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    console.log(`\n📄 Detailed results saved to: ${resultsFile}`);
  }
}

// Run benchmark
if (import.meta.url === `file://${process.argv[1]}`) {
  const benchmark = new PerformanceBenchmark();
  
  // Parse command line options
  const args = process.argv.slice(2);
  
  if (args.includes('--iterations')) {
    const idx = args.indexOf('--iterations');
    benchmark.testConfig.iterations = parseInt(args[idx + 1]) || 100;
  }
  
  if (args.includes('--concurrent')) {
    const idx = args.indexOf('--concurrent');
    benchmark.testConfig.concurrentRequests = parseInt(args[idx + 1]) || 10;
  }
  
  if (args.includes('--duration')) {
    const idx = args.indexOf('--duration');
    benchmark.testConfig.testDuration = parseInt(args[idx + 1]) || 30000;
  }
  
  benchmark.runBenchmark().catch(console.error);
}

export default PerformanceBenchmark;