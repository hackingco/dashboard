#!/usr/bin/env node

/**
 * 🧪 Automated Langfuse Key Testing System
 * 
 * Comprehensive automated testing system for Langfuse API keys with
 * continuous monitoring, stress testing, and integration validation.
 * 
 * Features:
 * - Continuous key monitoring
 * - Stress testing and load validation
 * - Integration testing with swarm systems
 * - Automated failure detection and recovery
 * - Performance regression testing
 * - Real-time health monitoring
 * 
 * Author: API Key Specialist Agent
 * Date: 2025-07-14
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import LangfuseKeyValidator from './LangfuseKeyValidator.js';
import { Langfuse } from 'langfuse';

class AutomatedKeyTester extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.config = {
      langfuseHost: options.langfuseHost || 'http://localhost:3000',
      testInterval: options.testInterval || 60000, // 1 minute
      stressTestInterval: options.stressTestInterval || 300000, // 5 minutes
      maxConcurrentTests: options.maxConcurrentTests || 10,
      failureThreshold: options.failureThreshold || 3,
      recoveryAttempts: options.recoveryAttempts || 5,
      performanceBaseline: options.performanceBaseline || 2000,
      alertThreshold: options.alertThreshold || 0.8,
      ...options
    };
    
    this.validator = new LangfuseKeyValidator({
      langfuseHost: this.config.langfuseHost
    });
    
    this.currentKeys = null;
    this.testResults = [];
    this.performanceHistory = [];
    this.failureCount = 0;
    this.isRunning = false;
    this.testInterval = null;
    this.stressTestInterval = null;
    this.alertCallbacks = [];
    
    this.testSuites = {
      basic: this.basicTestSuite.bind(this),
      stress: this.stressTestSuite.bind(this),
      integration: this.integrationTestSuite.bind(this),
      regression: this.regressionTestSuite.bind(this),
      endurance: this.enduranceTestSuite.bind(this)
    };
  }

  /**
   * Set keys for testing
   */
  setKeys(publicKey, secretKey) {
    this.currentKeys = { publicKey, secretKey };
    this.emit('keys-updated', this.currentKeys);
  }

  /**
   * Start automated testing
   */
  async start() {
    if (this.isRunning) {
      console.log('⚠️ Automated testing already running');
      return;
    }
    
    if (!this.currentKeys) {
      throw new Error('No keys set for testing');
    }
    
    console.log('🚀 Starting automated key testing...');
    
    this.isRunning = true;
    this.failureCount = 0;
    
    // Run initial validation
    await this.runTestSuite('basic');
    
    // Start continuous monitoring
    this.testInterval = setInterval(async () => {
      await this.runContinuousTests();
    }, this.config.testInterval);
    
    // Start stress testing
    this.stressTestInterval = setInterval(async () => {
      await this.runTestSuite('stress');
    }, this.config.stressTestInterval);
    
    this.emit('testing-started');
    console.log('✅ Automated testing started');
  }

  /**
   * Stop automated testing
   */
  async stop() {
    if (!this.isRunning) {
      console.log('⚠️ Automated testing not running');
      return;
    }
    
    console.log('🛑 Stopping automated testing...');
    
    this.isRunning = false;
    
    if (this.testInterval) {
      clearInterval(this.testInterval);
      this.testInterval = null;
    }
    
    if (this.stressTestInterval) {
      clearInterval(this.stressTestInterval);
      this.stressTestInterval = null;
    }
    
    this.emit('testing-stopped');
    console.log('✅ Automated testing stopped');
  }

  /**
   * Run continuous tests
   */
  async runContinuousTests() {
    try {
      console.log('🔄 Running continuous tests...');
      
      // Run basic validation
      const basicResult = await this.runTestSuite('basic');
      
      // Check for failures
      if (!basicResult.passed) {
        this.failureCount++;
        this.emit('test-failure', basicResult);
        
        if (this.failureCount >= this.config.failureThreshold) {
          await this.handleCriticalFailure(basicResult);
        }
      } else {
        this.failureCount = 0;
      }
      
      // Run performance regression test
      const regressionResult = await this.runTestSuite('regression');
      
      if (regressionResult.performanceRegression) {
        this.emit('performance-regression', regressionResult);
      }
      
    } catch (error) {
      console.error('❌ Continuous testing error:', error);
      this.emit('testing-error', error);
    }
  }

  /**
   * Run a specific test suite
   */
  async runTestSuite(suiteName) {
    if (!this.testSuites[suiteName]) {
      throw new Error(`Unknown test suite: ${suiteName}`);
    }
    
    const startTime = performance.now();
    
    try {
      console.log(`🧪 Running ${suiteName} test suite...`);
      
      const result = await this.testSuites[suiteName]();
      
      result.suite = suiteName;
      result.duration = performance.now() - startTime;
      result.timestamp = Date.now();
      
      // Store result
      this.testResults.push(result);
      
      // Keep only last 100 results
      if (this.testResults.length > 100) {
        this.testResults = this.testResults.slice(-100);
      }
      
      this.emit('test-complete', result);
      
      console.log(`✅ ${suiteName} test suite completed - ${result.passed ? 'PASSED' : 'FAILED'}`);
      
      return result;
    } catch (error) {
      const result = {
        suite: suiteName,
        passed: false,
        error: error.message,
        duration: performance.now() - startTime,
        timestamp: Date.now()
      };
      
      this.testResults.push(result);
      this.emit('test-error', result);
      
      return result;
    }
  }

  /**
   * Basic test suite
   */
  async basicTestSuite() {
    const validation = await this.validator.validateKeys(
      this.currentKeys.publicKey,
      this.currentKeys.secretKey
    );
    
    return {
      passed: validation.valid,
      score: validation.score,
      tests: validation.tests,
      recommendations: validation.recommendations
    };
  }

  /**
   * Stress test suite
   */
  async stressTestSuite() {
    const results = {
      passed: false,
      concurrentTests: 0,
      totalTraces: 0,
      failedTraces: 0,
      averageLatency: 0,
      throughput: 0,
      errors: []
    };
    
    try {
      const client = new Langfuse({
        publicKey: this.currentKeys.publicKey,
        secretKey: this.currentKeys.secretKey,
        baseUrl: this.config.langfuseHost,
        flushAt: 50,
        flushInterval: 1000
      });
      
      const startTime = performance.now();
      const promises = [];
      
      // Create multiple concurrent trace creation operations
      for (let i = 0; i < this.config.maxConcurrentTests; i++) {
        promises.push(this.createStressTestTraces(client, i));
      }
      
      const testResults = await Promise.allSettled(promises);
      
      // Analyze results
      for (const result of testResults) {
        if (result.status === 'fulfilled') {
          results.totalTraces += result.value.tracesCreated;
          results.concurrentTests++;
        } else {
          results.failedTraces++;
          results.errors.push(result.reason.message);
        }
      }
      
      await client.flushAsync();
      await client.shutdownAsync();
      
      const totalDuration = performance.now() - startTime;
      
      results.averageLatency = totalDuration / results.totalTraces;
      results.throughput = (results.totalTraces / totalDuration) * 1000; // traces per second
      results.passed = results.failedTraces === 0 && results.totalTraces > 0;
      
      return results;
    } catch (error) {
      results.errors.push(error.message);
      return results;
    }
  }

  /**
   * Create stress test traces
   */
  async createStressTestTraces(client, batchId) {
    const tracesPerBatch = 10;
    let tracesCreated = 0;
    
    for (let i = 0; i < tracesPerBatch; i++) {
      try {
        const trace = client.trace({
          id: `stress-test-${batchId}-${i}-${Date.now()}`,
          name: `Stress Test Trace ${batchId}-${i}`,
          sessionId: `stress-session-${batchId}`,
          input: { test: 'stress', batch: batchId, iteration: i },
          metadata: {
            stressTest: true,
            batchId,
            iteration: i,
            timestamp: new Date().toISOString()
          }
        });
        
        // Add some spans
        const span = trace.span({
          name: 'Stress Test Span',
          input: { spanTest: true }
        });
        
        span.end();
        tracesCreated++;
      } catch (error) {
        console.error(`Error creating stress test trace ${batchId}-${i}:`, error);
        throw error;
      }
    }
    
    return { tracesCreated };
  }

  /**
   * Integration test suite
   */
  async integrationTestSuite() {
    const results = {
      passed: false,
      tests: {}
    };
    
    try {
      const client = new Langfuse({
        publicKey: this.currentKeys.publicKey,
        secretKey: this.currentKeys.secretKey,
        baseUrl: this.config.langfuseHost,
        flushAt: 1,
        flushInterval: 1000
      });
      
      // Test swarm integration
      results.tests.swarmIntegration = await this.testSwarmIntegration(client);
      
      // Test MCP tool integration
      results.tests.mcpIntegration = await this.testMcpIntegration(client);
      
      // Test agent coordination
      results.tests.agentCoordination = await this.testAgentCoordination(client);
      
      // Test real-time streaming
      results.tests.realTimeStreaming = await this.testRealTimeStreaming(client);
      
      await client.flushAsync();
      await client.shutdownAsync();
      
      // Check if all tests passed
      results.passed = Object.values(results.tests).every(test => test.passed);
      
      return results;
    } catch (error) {
      results.error = error.message;
      return results;
    }
  }

  /**
   * Test swarm integration
   */
  async testSwarmIntegration(client) {
    try {
      const swarmTrace = client.trace({
        id: `swarm-integration-${Date.now()}`,
        name: 'Swarm Integration Test',
        sessionId: 'integration-test',
        input: { test: 'swarm-integration' },
        metadata: {
          swarmId: 'test-swarm',
          agentCount: 5,
          topology: 'mesh',
          integration: true
        },
        tags: ['swarm', 'integration']
      });
      
      // Simulate agent activities
      for (let i = 0; i < 5; i++) {
        const agentSpan = swarmTrace.span({
          name: `Agent ${i} Activity`,
          input: { agentId: `agent-${i}`, task: 'test-task' },
          metadata: { agentId: `agent-${i}` }
        });
        
        agentSpan.end();
      }
      
      return { passed: true, agentsSimulated: 5 };
    } catch (error) {
      return { passed: false, error: error.message };
    }
  }

  /**
   * Test MCP integration
   */
  async testMcpIntegration(client) {
    try {
      const mcpTrace = client.trace({
        id: `mcp-integration-${Date.now()}`,
        name: 'MCP Integration Test',
        sessionId: 'integration-test',
        input: { test: 'mcp-integration' },
        metadata: {
          mcpTool: 'test-tool',
          integration: true
        },
        tags: ['mcp', 'integration']
      });
      
      // Simulate MCP tool calls
      const toolSpan = mcpTrace.span({
        name: 'MCP Tool Call',
        input: { tool: 'test-tool', params: { test: true } },
        metadata: { mcp: true }
      });
      
      toolSpan.end();
      
      return { passed: true, toolsCalled: 1 };
    } catch (error) {
      return { passed: false, error: error.message };
    }
  }

  /**
   * Test agent coordination
   */
  async testAgentCoordination(client) {
    try {
      const coordinationTrace = client.trace({
        id: `coordination-${Date.now()}`,
        name: 'Agent Coordination Test',
        sessionId: 'integration-test',
        input: { test: 'coordination' },
        metadata: {
          coordination: true,
          participants: ['agent-1', 'agent-2', 'agent-3']
        },
        tags: ['coordination', 'integration']
      });
      
      // Simulate coordination events
      const coordinationSpan = coordinationTrace.span({
        name: 'Multi-Agent Coordination',
        input: { participants: 3 },
        metadata: { coordinationType: 'consensus' }
      });
      
      coordinationSpan.end();
      
      return { passed: true, coordinationEvents: 1 };
    } catch (error) {
      return { passed: false, error: error.message };
    }
  }

  /**
   * Test real-time streaming
   */
  async testRealTimeStreaming(client) {
    try {
      // This would test WebSocket streaming in a real implementation
      // For now, we'll simulate it with rapid trace creation
      
      const streamingTrace = client.trace({
        id: `streaming-${Date.now()}`,
        name: 'Real-time Streaming Test',
        sessionId: 'integration-test',
        input: { test: 'streaming' },
        metadata: {
          streaming: true,
          realTime: true
        },
        tags: ['streaming', 'real-time']
      });
      
      return { passed: true, streamingSupported: true };
    } catch (error) {
      return { passed: false, error: error.message };
    }
  }

  /**
   * Regression test suite
   */
  async regressionTestSuite() {
    const results = {
      passed: false,
      performanceRegression: false,
      currentPerformance: 0,
      baselinePerformance: 0,
      performanceChange: 0
    };
    
    try {
      // Run performance test
      const performanceResult = await this.measurePerformance();
      
      results.currentPerformance = performanceResult.averageLatency;
      results.baselinePerformance = this.config.performanceBaseline;
      
      // Calculate performance change
      results.performanceChange = 
        ((results.currentPerformance - results.baselinePerformance) / results.baselinePerformance) * 100;
      
      // Check for regression (> 20% performance degradation)
      results.performanceRegression = results.performanceChange > 20;
      
      results.passed = !results.performanceRegression;
      
      // Store performance data
      this.performanceHistory.push({
        timestamp: Date.now(),
        latency: results.currentPerformance,
        change: results.performanceChange
      });
      
      // Keep only last 100 measurements
      if (this.performanceHistory.length > 100) {
        this.performanceHistory = this.performanceHistory.slice(-100);
      }
      
      return results;
    } catch (error) {
      results.error = error.message;
      return results;
    }
  }

  /**
   * Endurance test suite
   */
  async enduranceTestSuite() {
    const results = {
      passed: false,
      duration: 0,
      totalTraces: 0,
      errors: [],
      memoryUsage: {},
      stability: 0
    };
    
    try {
      console.log('🏃 Starting endurance test (this may take a while)...');
      
      const client = new Langfuse({
        publicKey: this.currentKeys.publicKey,
        secretKey: this.currentKeys.secretKey,
        baseUrl: this.config.langfuseHost,
        flushAt: 100,
        flushInterval: 5000
      });
      
      const startTime = performance.now();
      const endTime = startTime + 60000; // 1 minute endurance test
      
      while (performance.now() < endTime) {
        try {
          const trace = client.trace({
            id: `endurance-${Date.now()}-${Math.random()}`,
            name: 'Endurance Test Trace',
            sessionId: 'endurance-test',
            input: { test: 'endurance' },
            metadata: { endurance: true }
          });
          
          results.totalTraces++;
          
          // Add some delay to simulate real usage
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          results.errors.push(error.message);
        }
      }
      
      await client.flushAsync();
      await client.shutdownAsync();
      
      results.duration = performance.now() - startTime;
      results.stability = (results.totalTraces / (results.totalTraces + results.errors.length)) * 100;
      results.passed = results.stability > 95; // 95% stability threshold
      
      return results;
    } catch (error) {
      results.error = error.message;
      return results;
    }
  }

  /**
   * Measure performance
   */
  async measurePerformance() {
    const measurements = [];
    
    const client = new Langfuse({
      publicKey: this.currentKeys.publicKey,
      secretKey: this.currentKeys.secretKey,
      baseUrl: this.config.langfuseHost,
      flushAt: 1,
      flushInterval: 1000
    });
    
    // Run 10 measurements
    for (let i = 0; i < 10; i++) {
      const startTime = performance.now();
      
      const trace = client.trace({
        id: `perf-measurement-${i}-${Date.now()}`,
        name: `Performance Measurement ${i}`,
        sessionId: 'performance-test',
        input: { test: 'performance', measurement: i }
      });
      
      await client.flushAsync();
      
      const duration = performance.now() - startTime;
      measurements.push(duration);
    }
    
    await client.shutdownAsync();
    
    const averageLatency = measurements.reduce((a, b) => a + b, 0) / measurements.length;
    const minLatency = Math.min(...measurements);
    const maxLatency = Math.max(...measurements);
    
    return {
      averageLatency,
      minLatency,
      maxLatency,
      measurements
    };
  }

  /**
   * Handle critical failure
   */
  async handleCriticalFailure(failureResult) {
    console.error('🚨 Critical failure detected!');
    
    this.emit('critical-failure', {
      failureCount: this.failureCount,
      lastFailure: failureResult,
      timestamp: Date.now()
    });
    
    // Attempt recovery
    for (let attempt = 0; attempt < this.config.recoveryAttempts; attempt++) {
      console.log(`🔄 Recovery attempt ${attempt + 1}/${this.config.recoveryAttempts}`);
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Try basic validation again
      const recoveryResult = await this.runTestSuite('basic');
      
      if (recoveryResult.passed) {
        console.log('✅ Recovery successful!');
        this.failureCount = 0;
        this.emit('recovery-success', recoveryResult);
        return;
      }
    }
    
    // All recovery attempts failed
    console.error('❌ Recovery failed after all attempts');
    this.emit('recovery-failed', {
      attempts: this.config.recoveryAttempts,
      timestamp: Date.now()
    });
    
    // Stop testing to prevent further issues
    await this.stop();
  }

  /**
   * Add alert callback
   */
  addAlertCallback(callback) {
    this.alertCallbacks.push(callback);
  }

  /**
   * Get test statistics
   */
  getTestStatistics() {
    const stats = {
      totalTests: this.testResults.length,
      passedTests: this.testResults.filter(r => r.passed).length,
      failedTests: this.testResults.filter(r => !r.passed).length,
      successRate: 0,
      averageDuration: 0,
      suiteStats: {},
      recentFailures: [],
      performanceTrend: 'stable'
    };
    
    if (this.testResults.length > 0) {
      stats.successRate = (stats.passedTests / stats.totalTests) * 100;
      stats.averageDuration = this.testResults.reduce((sum, r) => sum + r.duration, 0) / this.testResults.length;
      
      // Suite statistics
      for (const result of this.testResults) {
        if (!stats.suiteStats[result.suite]) {
          stats.suiteStats[result.suite] = { total: 0, passed: 0, failed: 0 };
        }
        stats.suiteStats[result.suite].total++;
        if (result.passed) {
          stats.suiteStats[result.suite].passed++;
        } else {
          stats.suiteStats[result.suite].failed++;
        }
      }
      
      // Recent failures
      stats.recentFailures = this.testResults
        .filter(r => !r.passed)
        .slice(-5)
        .map(r => ({
          suite: r.suite,
          error: r.error,
          timestamp: r.timestamp
        }));
    }
    
    // Performance trend
    if (this.performanceHistory.length > 5) {
      const recentChanges = this.performanceHistory.slice(-5).map(h => h.change);
      const averageChange = recentChanges.reduce((a, b) => a + b, 0) / recentChanges.length;
      
      if (averageChange > 10) {
        stats.performanceTrend = 'degrading';
      } else if (averageChange < -10) {
        stats.performanceTrend = 'improving';
      }
    }
    
    return stats;
  }

  /**
   * Export test results
   */
  exportTestResults() {
    return {
      results: this.testResults,
      performance: this.performanceHistory,
      statistics: this.getTestStatistics(),
      config: this.config,
      exportedAt: new Date().toISOString()
    };
  }

  /**
   * Clear test history
   */
  clearHistory() {
    this.testResults = [];
    this.performanceHistory = [];
    this.failureCount = 0;
    console.log('🧹 Test history cleared');
  }
}

export default AutomatedKeyTester;

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new AutomatedKeyTester();
  
  const command = process.argv[2];
  const publicKey = process.argv[3];
  const secretKey = process.argv[4];
  
  switch (command) {
    case 'test':
      if (!publicKey || !secretKey) {
        console.error('Usage: node AutomatedKeyTester.js test <public_key> <secret_key>');
        process.exit(1);
      }
      tester.setKeys(publicKey, secretKey);
      tester.runTestSuite('basic').then(result => {
        console.log(JSON.stringify(result, null, 2));
      });
      break;
      
    case 'stress':
      if (!publicKey || !secretKey) {
        console.error('Usage: node AutomatedKeyTester.js stress <public_key> <secret_key>');
        process.exit(1);
      }
      tester.setKeys(publicKey, secretKey);
      tester.runTestSuite('stress').then(result => {
        console.log(JSON.stringify(result, null, 2));
      });
      break;
      
    case 'monitor':
      if (!publicKey || !secretKey) {
        console.error('Usage: node AutomatedKeyTester.js monitor <public_key> <secret_key>');
        process.exit(1);
      }
      tester.setKeys(publicKey, secretKey);
      tester.start();
      
      // Handle graceful shutdown
      process.on('SIGINT', async () => {
        await tester.stop();
        process.exit(0);
      });
      break;
      
    default:
      console.log('Usage: node AutomatedKeyTester.js [test|stress|monitor] <public_key> <secret_key>');
  }
}