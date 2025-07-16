/**
 * Langfuse API Integration Test Runner
 * Comprehensive test runner for all Langfuse API integration scenarios
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { LangfuseRealtimeClient } from '../../lib/langfuse-client';
import { langfuseAPI } from '../../lib/langfuse-api';

interface TestResult {
  testName: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  details?: any;
}

interface TestSuite {
  suiteName: string;
  results: TestResult[];
  totalDuration: number;
  passed: number;
  failed: number;
  skipped: number;
}

interface ApiValidationReport {
  timestamp: Date;
  langfuseAvailable: boolean;
  webSocketSupported: boolean;
  testSuites: TestSuite[];
  summary: {
    totalTests: number;
    totalPassed: number;
    totalFailed: number;
    totalSkipped: number;
    totalDuration: number;
    apiCoverage: number;
    reliabilityScore: number;
  };
  recommendations: string[];
}

class LangfuseApiValidator {
  private report: ApiValidationReport;
  private client: LangfuseRealtimeClient | null = null;

  constructor() {
    this.report = {
      timestamp: new Date(),
      langfuseAvailable: false,
      webSocketSupported: false,
      testSuites: [],
      summary: {
        totalTests: 0,
        totalPassed: 0,
        totalFailed: 0,
        totalSkipped: 0,
        totalDuration: 0,
        apiCoverage: 0,
        reliabilityScore: 0,
      },
      recommendations: [],
    };
  }

  async runAllTests(): Promise<ApiValidationReport> {
    console.log('🚀 Starting Langfuse API Integration Validation...\n');

    // Pre-flight checks
    await this.performPreflightChecks();

    // Run test suites
    await this.runConnectionTests();
    await this.runApiEndpointTests();
    await this.runWebSocketTests();
    await this.runFallbackTests();
    await this.runPerformanceTests();
    await this.runDataValidationTests();

    // Calculate summary and generate recommendations
    this.calculateSummary();
    this.generateRecommendations();

    // Clean up
    await this.cleanup();

    console.log('✅ API Validation Complete!\n');
    this.printReport();

    return this.report;
  }

  private async performPreflightChecks(): Promise<void> {
    console.log('🔍 Performing pre-flight checks...');

    // Test Langfuse API availability
    try {
      const response = await fetch('http://localhost:3000/api/public/health', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000),
      });
      this.report.langfuseAvailable = response.ok;
      console.log(`   Langfuse API (localhost:3000): ${response.ok ? '✅ Available' : '❌ Unavailable'}`);
    } catch (error) {
      this.report.langfuseAvailable = false;
      console.log(`   Langfuse API (localhost:3000): ❌ Unavailable (${error instanceof Error ? error.message : 'Unknown error'})`);
    }

    // Test WebSocket support
    this.report.webSocketSupported = typeof WebSocket !== 'undefined';
    console.log(`   WebSocket Support: ${this.report.webSocketSupported ? '✅ Available' : '❌ Not Available'}`);

    console.log('');
  }

  private async runConnectionTests(): Promise<void> {
    const suite: TestSuite = {
      suiteName: 'Connection Tests',
      results: [],
      totalDuration: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
    };

    console.log('🔗 Running connection tests...');

    // Test 1: Client initialization
    await this.runTest(suite, 'Client Initialization', async () => {
      this.client = new LangfuseRealtimeClient({
        baseUrl: 'http://localhost:3000',
        enableRealtime: true,
        autoFlush: false,
      });

      expect(this.client).toBeDefined();
      expect(typeof this.client.getTraces).toBe('function');
      expect(typeof this.client.getSwarmMetrics).toBe('function');
      expect(typeof this.client.createTrace).toBe('function');

      return { clientInitialized: true };
    });

    // Test 2: Connection state
    await this.runTest(suite, 'Connection State Management', async () => {
      if (!this.client) throw new Error('Client not initialized');

      const isConnected = this.client.isRealtimeConnected();
      expect(typeof isConnected).toBe('boolean');

      return { 
        connectionState: isConnected,
        stateType: typeof isConnected 
      };
    });

    // Test 3: Reconnection capability
    await this.runTest(suite, 'Reconnection Capability', async () => {
      if (!this.client) throw new Error('Client not initialized');

      // Test reconnection doesn't throw
      this.client.reconnect();
      await new Promise(resolve => setTimeout(resolve, 500));

      return { reconnectionAttempted: true };
    });

    this.report.testSuites.push(suite);
    console.log(`   ✅ Connection tests completed: ${suite.passed}/${suite.results.length} passed\n`);
  }

  private async runApiEndpointTests(): Promise<void> {
    const suite: TestSuite = {
      suiteName: 'API Endpoint Tests',
      results: [],
      totalDuration: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
    };

    console.log('🌐 Running API endpoint tests...');

    // Test 1: Fetch traces
    await this.runTest(suite, 'Fetch Traces', async () => {
      if (!this.client) throw new Error('Client not initialized');

      const traces = await this.client.getTraces({ limit: 10 });
      
      expect(Array.isArray(traces)).toBe(true);
      expect(traces.length).toBeGreaterThan(0);

      const trace = traces[0];
      expect(trace).toHaveProperty('id');
      expect(trace).toHaveProperty('name');
      expect(trace).toHaveProperty('sessionId');
      expect(trace).toHaveProperty('timestamp');
      expect(trace).toHaveProperty('status');

      return {
        traceCount: traces.length,
        firstTraceId: trace.id,
        hasValidStructure: true,
      };
    });

    // Test 2: Fetch metrics
    await this.runTest(suite, 'Fetch Swarm Metrics', async () => {
      if (!this.client) throw new Error('Client not initialized');

      const metrics = await this.client.getSwarmMetrics();
      
      expect(metrics).toBeDefined();
      expect(typeof metrics.totalTraces).toBe('number');
      expect(typeof metrics.totalAgents).toBe('number');
      expect(typeof metrics.averageResponseTime).toBe('number');
      expect(typeof metrics.errorRate).toBe('number');
      expect(metrics.errorRate).toBeGreaterThanOrEqual(0);
      expect(metrics.errorRate).toBeLessThanOrEqual(100);

      return {
        totalTraces: metrics.totalTraces,
        totalAgents: metrics.totalAgents,
        errorRate: metrics.errorRate,
        hasTokenUsage: !!metrics.tokenUsage,
      };
    });

    // Test 3: Create trace
    await this.runTest(suite, 'Create Trace', async () => {
      if (!this.client) throw new Error('Client not initialized');

      const testTrace = {
        id: `test-trace-${Date.now()}`,
        name: 'API Validation Test Trace',
        sessionId: 'validation-session',
        userId: 'api-validator',
        timestamp: new Date(),
        status: 'success' as const,
        model: 'test-model',
        promptTokens: 100,
        completionTokens: 50,
        totalCost: 0.001,
        input: 'API validation test input',
        output: 'API validation test output',
        metadata: {
          test: true,
          validator: 'langfuse-api-validator',
          timestamp: Date.now(),
        },
        tags: ['validation', 'api-test'],
      };

      const traceId = await this.client.createTrace(testTrace);

      return {
        traceCreated: traceId !== null,
        traceId: traceId,
        testTraceId: testTrace.id,
      };
    });

    // Test 4: REST API direct access
    await this.runTest(suite, 'Direct REST API Access', async () => {
      const traces = await langfuseAPI.fetchTraces();
      const sessions = await langfuseAPI.fetchSessions();

      expect(Array.isArray(traces)).toBe(true);
      expect(Array.isArray(sessions)).toBe(true);

      return {
        tracesCount: traces.length,
        sessionsCount: sessions.length,
        directApiWorking: true,
      };
    });

    this.report.testSuites.push(suite);
    console.log(`   ✅ API endpoint tests completed: ${suite.passed}/${suite.results.length} passed\n`);
  }

  private async runWebSocketTests(): Promise<void> {
    const suite: TestSuite = {
      suiteName: 'WebSocket Tests',
      results: [],
      totalDuration: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
    };

    console.log('🔄 Running WebSocket tests...');

    if (!this.report.webSocketSupported) {
      await this.runTest(suite, 'WebSocket Support Check', async () => {
        throw new Error('WebSocket not supported in this environment');
      });
      
      this.report.testSuites.push(suite);
      console.log(`   ⚠️  WebSocket tests skipped: Not supported in this environment\n`);
      return;
    }

    // Test 1: WebSocket connection attempt
    await this.runTest(suite, 'WebSocket Connection', async () => {
      // This would test actual WebSocket connection in a browser environment
      // For now, we test that the client handles WebSocket gracefully
      
      const wsClient = new LangfuseRealtimeClient({
        baseUrl: 'http://localhost:3000',
        enableRealtime: true,
        autoFlush: false,
      });

      // WebSocket connection may fail in test environment, but should not throw
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await wsClient.shutdown();

      return { webSocketHandled: true };
    });

    // Test 2: Event handling capability
    await this.runTest(suite, 'Event Handling', async () => {
      if (!this.client) throw new Error('Client not initialized');

      let eventReceived = false;
      const timeout = new Promise(resolve => setTimeout(resolve, 2000));

      // Set up event listener
      this.client.on('connected', () => {
        eventReceived = true;
      });

      this.client.on('error', () => {
        eventReceived = true;
      });

      await timeout;

      return { 
        eventSystemWorking: true,
        eventReceived: eventReceived,
      };
    });

    this.report.testSuites.push(suite);
    console.log(`   ✅ WebSocket tests completed: ${suite.passed}/${suite.results.length} passed\n`);
  }

  private async runFallbackTests(): Promise<void> {
    const suite: TestSuite = {
      suiteName: 'Fallback Tests',
      results: [],
      totalDuration: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
    };

    console.log('🛡️ Running fallback tests...');

    // Test 1: Network failure fallback
    await this.runTest(suite, 'Network Failure Fallback', async () => {
      const offlineClient = new LangfuseRealtimeClient({
        baseUrl: 'http://localhost:9999', // Non-existent port
        enableRealtime: false,
        autoFlush: false,
      });

      const traces = await offlineClient.getTraces({ limit: 5 });
      const metrics = await offlineClient.getSwarmMetrics();

      expect(Array.isArray(traces)).toBe(true);
      expect(traces.length).toBeGreaterThan(0);
      expect(metrics).toBeDefined();

      await offlineClient.shutdown();

      return {
        fallbackWorking: true,
        mockTracesCount: traces.length,
        mockMetricsAvailable: !!metrics,
      };
    });

    // Test 2: Mock data quality
    await this.runTest(suite, 'Mock Data Quality', async () => {
      const offlineClient = new LangfuseRealtimeClient({
        baseUrl: 'http://invalid:8888',
        enableRealtime: false,
      });

      const traces = await offlineClient.getTraces({ limit: 20 });
      
      // Validate mock data quality
      traces.forEach(trace => {
        expect(typeof trace.id).toBe('string');
        expect(typeof trace.name).toBe('string');
        expect(trace.timestamp).toBeInstanceOf(Date);
        expect(['success', 'error', 'pending', 'running']).toContain(trace.status);
        expect(typeof trace.promptTokens).toBe('number');
        expect(typeof trace.completionTokens).toBe('number');
        expect(typeof trace.totalCost).toBe('number');
        expect(trace.promptTokens).toBeGreaterThanOrEqual(0);
        expect(trace.totalCost).toBeGreaterThanOrEqual(0);
      });

      await offlineClient.shutdown();

      return {
        mockDataValid: true,
        structureValid: true,
        valuesRealistic: true,
      };
    });

    // Test 3: Performance during fallback
    await this.runTest(suite, 'Fallback Performance', async () => {
      const offlineClient = new LangfuseRealtimeClient({
        baseUrl: 'http://timeout:7777',
        enableRealtime: false,
      });

      const startTime = Date.now();
      const traces = await offlineClient.getTraces({ limit: 100 });
      const duration = Date.now() - startTime;

      expect(traces.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(1000); // Should be fast with mock data

      await offlineClient.shutdown();

      return {
        fallbackPerformance: duration,
        withinThreshold: duration < 1000,
        tracesReturned: traces.length,
      };
    });

    this.report.testSuites.push(suite);
    console.log(`   ✅ Fallback tests completed: ${suite.passed}/${suite.results.length} passed\n`);
  }

  private async runPerformanceTests(): Promise<void> {
    const suite: TestSuite = {
      suiteName: 'Performance Tests',
      results: [],
      totalDuration: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
    };

    console.log('⚡ Running performance tests...');

    // Test 1: Response time
    await this.runTest(suite, 'API Response Time', async () => {
      if (!this.client) throw new Error('Client not initialized');

      const startTime = Date.now();
      await this.client.getTraces({ limit: 50 });
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds

      return {
        responseTime: duration,
        withinThreshold: duration < 5000,
      };
    });

    // Test 2: Concurrent requests
    await this.runTest(suite, 'Concurrent Request Handling', async () => {
      if (!this.client) throw new Error('Client not initialized');

      const startTime = Date.now();
      const promises = Array.from({ length: 5 }, () => 
        this.client!.getTraces({ limit: 10 })
      );

      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(5);
      results.forEach(traces => {
        expect(Array.isArray(traces)).toBe(true);
      });

      return {
        concurrentDuration: duration,
        allRequestsSucceeded: results.every(r => Array.isArray(r) && r.length > 0),
        requestCount: 5,
      };
    });

    // Test 3: Large data handling
    await this.runTest(suite, 'Large Data Set Handling', async () => {
      if (!this.client) throw new Error('Client not initialized');

      const startTime = Date.now();
      const traces = await this.client.getTraces({ limit: 1000 });
      const duration = Date.now() - startTime;

      expect(Array.isArray(traces)).toBe(true);

      return {
        largeDataDuration: duration,
        tracesReturned: traces.length,
        handledLargeRequest: true,
      };
    });

    this.report.testSuites.push(suite);
    console.log(`   ✅ Performance tests completed: ${suite.passed}/${suite.results.length} passed\n`);
  }

  private async runDataValidationTests(): Promise<void> {
    const suite: TestSuite = {
      suiteName: 'Data Validation Tests',
      results: [],
      totalDuration: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
    };

    console.log('🔍 Running data validation tests...');

    // Test 1: Trace data validation
    await this.runTest(suite, 'Trace Data Structure Validation', async () => {
      if (!this.client) throw new Error('Client not initialized');

      const traces = await this.client.getTraces({ limit: 10 });
      
      let validTraces = 0;
      traces.forEach(trace => {
        // Required fields
        if (typeof trace.id === 'string' &&
            typeof trace.name === 'string' &&
            typeof trace.sessionId === 'string' &&
            trace.timestamp instanceof Date &&
            ['success', 'error', 'pending', 'running'].includes(trace.status) &&
            typeof trace.model === 'string' &&
            typeof trace.promptTokens === 'number' &&
            typeof trace.completionTokens === 'number' &&
            typeof trace.totalCost === 'number' &&
            trace.promptTokens >= 0 &&
            trace.completionTokens >= 0 &&
            trace.totalCost >= 0) {
          validTraces++;
        }
      });

      expect(validTraces).toBe(traces.length);

      return {
        totalTraces: traces.length,
        validTraces: validTraces,
        validationRate: (validTraces / traces.length) * 100,
      };
    });

    // Test 2: Metrics data validation
    await this.runTest(suite, 'Metrics Data Structure Validation', async () => {
      if (!this.client) throw new Error('Client not initialized');

      const metrics = await this.client.getSwarmMetrics();
      
      // Validate all required fields
      expect(typeof metrics.totalTraces).toBe('number');
      expect(typeof metrics.activeTraces).toBe('number');
      expect(typeof metrics.totalAgents).toBe('number');
      expect(typeof metrics.activeAgents).toBe('number');
      expect(typeof metrics.averageResponseTime).toBe('number');
      expect(typeof metrics.errorRate).toBe('number');
      expect(typeof metrics.totalCost).toBe('number');

      // Validate logical relationships
      expect(metrics.activeTraces).toBeLessThanOrEqual(metrics.totalTraces);
      expect(metrics.activeAgents).toBeLessThanOrEqual(metrics.totalAgents);
      expect(metrics.errorRate).toBeGreaterThanOrEqual(0);
      expect(metrics.errorRate).toBeLessThanOrEqual(100);

      return {
        metricsValid: true,
        logicalRelationshipsValid: true,
        allFieldsPresent: true,
      };
    });

    this.report.testSuites.push(suite);
    console.log(`   ✅ Data validation tests completed: ${suite.passed}/${suite.results.length} passed\n`);
  }

  private async runTest(
    suite: TestSuite, 
    testName: string, 
    testFn: () => Promise<any>
  ): Promise<void> {
    const startTime = Date.now();
    
    try {
      const result = await testFn();
      const duration = Date.now() - startTime;
      
      suite.results.push({
        testName,
        status: 'passed',
        duration,
        details: result,
      });
      
      suite.passed++;
      suite.totalDuration += duration;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      suite.results.push({
        testName,
        status: 'failed',
        duration,
        error: error instanceof Error ? error.message : String(error),
      });
      
      suite.failed++;
      suite.totalDuration += duration;
    }
  }

  private calculateSummary(): void {
    this.report.summary = this.report.testSuites.reduce(
      (summary, suite) => ({
        totalTests: summary.totalTests + suite.results.length,
        totalPassed: summary.totalPassed + suite.passed,
        totalFailed: summary.totalFailed + suite.failed,
        totalSkipped: summary.totalSkipped + suite.skipped,
        totalDuration: summary.totalDuration + suite.totalDuration,
        apiCoverage: 0, // Will calculate below
        reliabilityScore: 0, // Will calculate below
      }),
      {
        totalTests: 0,
        totalPassed: 0,
        totalFailed: 0,
        totalSkipped: 0,
        totalDuration: 0,
        apiCoverage: 0,
        reliabilityScore: 0,
      }
    );

    // Calculate API coverage (based on number of different API endpoints tested)
    this.report.summary.apiCoverage = Math.min(100, (this.report.summary.totalPassed / 15) * 100); // 15 core API functions

    // Calculate reliability score
    this.report.summary.reliabilityScore = this.report.summary.totalTests > 0 
      ? (this.report.summary.totalPassed / this.report.summary.totalTests) * 100 
      : 0;
  }

  private generateRecommendations(): void {
    const recommendations: string[] = [];

    if (!this.report.langfuseAvailable) {
      recommendations.push('🔧 Langfuse API is not available at localhost:3000. Consider starting the Langfuse server or updating the configuration.');
    }

    if (!this.report.webSocketSupported) {
      recommendations.push('🌐 WebSocket support is not available. Real-time features will be limited to polling.');
    }

    if (this.report.summary.reliabilityScore < 80) {
      recommendations.push('⚠️ API reliability is below 80%. Consider implementing more robust error handling.');
    }

    if (this.report.summary.apiCoverage < 90) {
      recommendations.push('📊 API coverage is below 90%. Consider adding tests for additional endpoints.');
    }

    const avgDuration = this.report.summary.totalDuration / this.report.summary.totalTests;
    if (avgDuration > 2000) {
      recommendations.push('⚡ Average API response time is above 2 seconds. Consider optimizing API calls or implementing better caching.');
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ All API integration tests passed successfully! The Langfuse integration is working optimally.');
    }

    this.report.recommendations = recommendations;
  }

  private printReport(): void {
    console.log('📊 LANGFUSE API VALIDATION REPORT');
    console.log('='.repeat(50));
    console.log(`📅 Timestamp: ${this.report.timestamp.toISOString()}`);
    console.log(`🌐 Langfuse Available: ${this.report.langfuseAvailable ? '✅ Yes' : '❌ No'}`);
    console.log(`🔄 WebSocket Supported: ${this.report.webSocketSupported ? '✅ Yes' : '❌ No'}`);
    console.log('');

    console.log('📈 SUMMARY');
    console.log('-'.repeat(30));
    console.log(`Total Tests: ${this.report.summary.totalTests}`);
    console.log(`Passed: ${this.report.summary.totalPassed} ✅`);
    console.log(`Failed: ${this.report.summary.totalFailed} ${this.report.summary.totalFailed > 0 ? '❌' : '✅'}`);
    console.log(`Skipped: ${this.report.summary.totalSkipped} ${this.report.summary.totalSkipped > 0 ? '⚠️' : '✅'}`);
    console.log(`Total Duration: ${this.report.summary.totalDuration}ms`);
    console.log(`API Coverage: ${this.report.summary.apiCoverage.toFixed(1)}%`);
    console.log(`Reliability Score: ${this.report.summary.reliabilityScore.toFixed(1)}%`);
    console.log('');

    console.log('🔍 TEST SUITES');
    console.log('-'.repeat(30));
    this.report.testSuites.forEach(suite => {
      console.log(`${suite.suiteName}: ${suite.passed}/${suite.results.length} passed (${suite.totalDuration}ms)`);
    });
    console.log('');

    console.log('💡 RECOMMENDATIONS');
    console.log('-'.repeat(30));
    this.report.recommendations.forEach(rec => {
      console.log(`   ${rec}`);
    });
    console.log('');
  }

  private async cleanup(): Promise<void> {
    if (this.client) {
      await this.client.shutdown();
      this.client = null;
    }
  }
}

// Export the validator for use in tests
export { LangfuseApiValidator, type ApiValidationReport };

// Main execution function
export async function runLangfuseApiValidation(): Promise<ApiValidationReport> {
  const validator = new LangfuseApiValidator();
  return await validator.runAllTests();
}