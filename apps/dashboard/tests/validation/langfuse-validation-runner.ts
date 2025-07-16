/**
 * Comprehensive Langfuse Validation Test Runner
 * Orchestrates all validation tests and generates detailed reports
 */

import { execSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

interface TestResult {
  name: string;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  errors: string[];
  warnings: string[];
}

interface ValidationReport {
  timestamp: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  totalDuration: number;
  testResults: TestResult[];
  summary: {
    traceGeneration: TestResult;
    mcpIntegration: TestResult;
    exportFunctionality: TestResult;
    errorHandling: TestResult;
  };
  recommendations: string[];
  status: 'PASS' | 'FAIL' | 'WARNING';
}

class LangfuseValidationRunner {
  private testFiles = [
    'trace-generation-validation.test.ts',
    'mcp-tool-tracing-validation.test.ts', 
    'trace-export-validation.test.ts',
    'error-handling-performance-validation.test.ts',
  ];

  private testDirectory = '/Users/shaight/claude-projects/swarm03/apps/dashboard/tests/validation';
  private reportDirectory = '/Users/shaight/claude-projects/swarm03/apps/dashboard/tests/validation/reports';

  constructor() {
    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    if (!existsSync(this.reportDirectory)) {
      mkdirSync(this.reportDirectory, { recursive: true });
    }
  }

  async runAllTests(): Promise<ValidationReport> {
    console.log('🧪 Starting Langfuse Validation Test Suite...');
    
    const report: ValidationReport = {
      timestamp: new Date().toISOString(),
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      totalDuration: 0,
      testResults: [],
      summary: {} as any,
      recommendations: [],
      status: 'PASS',
    };

    const startTime = Date.now();

    for (const testFile of this.testFiles) {
      console.log(`\n📋 Running ${testFile}...`);
      
      try {
        const result = await this.runSingleTest(testFile);
        report.testResults.push(result);
        
        report.totalTests += result.passed + result.failed + result.skipped;
        report.passedTests += result.passed;
        report.failedTests += result.failed;
        report.skippedTests += result.skipped;
        report.totalDuration += result.duration;

        if (result.failed > 0) {
          report.status = 'FAIL';
        } else if (result.warnings.length > 0 && report.status === 'PASS') {
          report.status = 'WARNING';
        }

        console.log(`✅ ${result.passed} passed, ❌ ${result.failed} failed, ⏭️ ${result.skipped} skipped`);
      } catch (error) {
        console.error(`❌ Error running ${testFile}:`, error);
        report.status = 'FAIL';
      }
    }

    const endTime = Date.now();
    report.totalDuration = endTime - startTime;

    this.generateSummary(report);
    this.generateRecommendations(report);
    this.saveReport(report);

    return report;
  }

  private async runSingleTest(testFile: string): Promise<TestResult> {
    const testPath = join(this.testDirectory, testFile);
    const startTime = Date.now();

    try {
      // Run the test using vitest
      const output = execSync(`cd ${this.testDirectory}/../.. && npx vitest run ${testPath} --reporter=json`, {
        encoding: 'utf8',
        timeout: 300000, // 5 minutes timeout
      });

      const testOutput = JSON.parse(output);
      const endTime = Date.now();

      return {
        name: testFile,
        passed: testOutput.numPassedTests || 0,
        failed: testOutput.numFailedTests || 0,
        skipped: testOutput.numPendingTests || 0,
        duration: endTime - startTime,
        errors: testOutput.testResults?.flatMap((r: any) => 
          r.assertionResults?.filter((a: any) => a.status === 'failed')
            .map((a: any) => a.failureMessages || [])
        ).flat() || [],
        warnings: [],
      };
    } catch (error) {
      const endTime = Date.now();
      
      return {
        name: testFile,
        passed: 0,
        failed: 1,
        skipped: 0,
        duration: endTime - startTime,
        errors: [error instanceof Error ? error.message : String(error)],
        warnings: [],
      };
    }
  }

  private generateSummary(report: ValidationReport): void {
    const testResults = report.testResults;
    
    report.summary = {
      traceGeneration: testResults.find(r => r.name.includes('trace-generation')) || this.createEmptyResult('trace-generation'),
      mcpIntegration: testResults.find(r => r.name.includes('mcp-tool-tracing')) || this.createEmptyResult('mcp-tool-tracing'),
      exportFunctionality: testResults.find(r => r.name.includes('trace-export')) || this.createEmptyResult('trace-export'),
      errorHandling: testResults.find(r => r.name.includes('error-handling')) || this.createEmptyResult('error-handling'),
    };
  }

  private createEmptyResult(name: string): TestResult {
    return {
      name,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
      errors: [],
      warnings: [],
    };
  }

  private generateRecommendations(report: ValidationReport): void {
    const recommendations: string[] = [];

    // Check test coverage
    if (report.totalTests < 50) {
      recommendations.push('Consider adding more comprehensive test cases to improve coverage');
    }

    // Check failure rate
    const failureRate = report.totalTests > 0 ? (report.failedTests / report.totalTests) * 100 : 0;
    if (failureRate > 10) {
      recommendations.push(`High failure rate (${failureRate.toFixed(1)}%) - investigate failing tests`);
    }

    // Check performance
    if (report.totalDuration > 60000) {
      recommendations.push('Test suite is slow - consider optimizing test performance');
    }

    // Check specific test categories
    if (report.summary.traceGeneration.failed > 0) {
      recommendations.push('Trace generation tests failing - check langfuse client configuration');
    }

    if (report.summary.mcpIntegration.failed > 0) {
      recommendations.push('MCP integration tests failing - verify MCP tool connections');
    }

    if (report.summary.exportFunctionality.failed > 0) {
      recommendations.push('Export functionality tests failing - check file system permissions');
    }

    if (report.summary.errorHandling.failed > 0) {
      recommendations.push('Error handling tests failing - review error recovery mechanisms');
    }

    // Performance recommendations
    if (report.summary.errorHandling.duration > 20000) {
      recommendations.push('Error handling tests are slow - consider adding timeouts');
    }

    if (recommendations.length === 0) {
      recommendations.push('All validation tests passing - langfuse integration is healthy');
    }

    report.recommendations = recommendations;
  }

  private saveReport(report: ValidationReport): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = join(this.reportDirectory, `langfuse-validation-${timestamp}.json`);
    
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    // Also save as latest report
    const latestPath = join(this.reportDirectory, 'langfuse-validation-latest.json');
    writeFileSync(latestPath, JSON.stringify(report, null, 2));

    console.log(`\n📊 Validation report saved to: ${reportPath}`);
  }

  generateHTMLReport(report: ValidationReport): void {
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Langfuse Validation Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f0f0f0; padding: 20px; border-radius: 8px; }
        .status-pass { color: #28a745; }
        .status-fail { color: #dc3545; }
        .status-warning { color: #ffc107; }
        .test-result { margin: 10px 0; padding: 10px; border: 1px solid #ddd; border-radius: 4px; }
        .metrics { display: flex; gap: 20px; margin: 20px 0; }
        .metric { text-align: center; }
        .metric-value { font-size: 24px; font-weight: bold; }
        .recommendations { background: #e9ecef; padding: 15px; border-radius: 8px; margin: 20px 0; }
        .error { background: #f8d7da; padding: 10px; border-radius: 4px; margin: 5px 0; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f8f9fa; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Langfuse Validation Test Report</h1>
        <p><strong>Status:</strong> <span class="status-${report.status.toLowerCase()}">${report.status}</span></p>
        <p><strong>Generated:</strong> ${new Date(report.timestamp).toLocaleString()}</p>
        <p><strong>Duration:</strong> ${(report.totalDuration / 1000).toFixed(1)} seconds</p>
    </div>

    <div class="metrics">
        <div class="metric">
            <div class="metric-value status-pass">${report.passedTests}</div>
            <div>Passed</div>
        </div>
        <div class="metric">
            <div class="metric-value status-fail">${report.failedTests}</div>
            <div>Failed</div>
        </div>
        <div class="metric">
            <div class="metric-value">${report.skippedTests}</div>
            <div>Skipped</div>
        </div>
        <div class="metric">
            <div class="metric-value">${report.totalTests}</div>
            <div>Total</div>
        </div>
    </div>

    <h2>Test Results Summary</h2>
    <table>
        <thead>
            <tr>
                <th>Test Category</th>
                <th>Passed</th>
                <th>Failed</th>
                <th>Skipped</th>
                <th>Duration (ms)</th>
                <th>Status</th>
            </tr>
        </thead>
        <tbody>
            ${Object.entries(report.summary).map(([category, result]) => `
                <tr>
                    <td>${category}</td>
                    <td class="status-pass">${result.passed}</td>
                    <td class="status-fail">${result.failed}</td>
                    <td>${result.skipped}</td>
                    <td>${result.duration}</td>
                    <td class="status-${result.failed > 0 ? 'fail' : 'pass'}">${result.failed > 0 ? 'FAIL' : 'PASS'}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>

    <h2>Detailed Test Results</h2>
    ${report.testResults.map(result => `
        <div class="test-result">
            <h3>${result.name}</h3>
            <p><strong>Passed:</strong> ${result.passed} | <strong>Failed:</strong> ${result.failed} | <strong>Skipped:</strong> ${result.skipped}</p>
            <p><strong>Duration:</strong> ${result.duration}ms</p>
            ${result.errors.length > 0 ? `
                <h4>Errors:</h4>
                ${result.errors.map(error => `<div class="error">${error}</div>`).join('')}
            ` : ''}
        </div>
    `).join('')}

    <div class="recommendations">
        <h2>Recommendations</h2>
        <ul>
            ${report.recommendations.map(rec => `<li>${rec}</li>`).join('')}
        </ul>
    </div>

    <footer>
        <p><small>Generated by Langfuse Validation Runner on ${new Date().toLocaleString()}</small></p>
    </footer>
</body>
</html>
    `;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const htmlPath = join(this.reportDirectory, `langfuse-validation-${timestamp}.html`);
    writeFileSync(htmlPath, htmlContent);

    console.log(`\n📄 HTML report saved to: ${htmlPath}`);
  }

  async runContinuousValidation(intervalMinutes: number = 30): Promise<void> {
    console.log(`🔄 Starting continuous validation (every ${intervalMinutes} minutes)...`);
    
    const runValidation = async () => {
      try {
        const report = await this.runAllTests();
        this.generateHTMLReport(report);
        
        console.log(`\n📊 Validation completed: ${report.status}`);
        console.log(`✅ Passed: ${report.passedTests} | ❌ Failed: ${report.failedTests} | ⏭️ Skipped: ${report.skippedTests}`);
        
        if (report.status === 'FAIL') {
          console.log('⚠️ Validation failures detected - check the report for details');
        }
      } catch (error) {
        console.error('❌ Validation error:', error);
      }
    };

    // Run immediately
    await runValidation();

    // Then run at intervals
    setInterval(runValidation, intervalMinutes * 60 * 1000);
  }
}

// CLI interface
if (require.main === module) {
  const runner = new LangfuseValidationRunner();
  
  const command = process.argv[2];
  
  switch (command) {
    case 'run':
      runner.runAllTests().then(report => {
        console.log(`\n🎯 Final Status: ${report.status}`);
        console.log(`📊 Results: ${report.passedTests} passed, ${report.failedTests} failed, ${report.skippedTests} skipped`);
        
        if (report.status === 'FAIL') {
          process.exit(1);
        }
      });
      break;
      
    case 'continuous':
      const interval = parseInt(process.argv[3]) || 30;
      runner.runContinuousValidation(interval);
      break;
      
    case 'html':
      // Generate HTML report from latest JSON report
      try {
        const fs = require('fs');
        const path = require('path');
        const latestPath = path.join(runner['reportDirectory'], 'langfuse-validation-latest.json');
        const report = JSON.parse(fs.readFileSync(latestPath, 'utf8'));
        runner.generateHTMLReport(report);
      } catch (error) {
        console.error('❌ Error generating HTML report:', error);
        process.exit(1);
      }
      break;
      
    default:
      console.log(`
Usage: node langfuse-validation-runner.js <command>

Commands:
  run         Run all validation tests once
  continuous  Run validation tests continuously (optional interval in minutes)
  html        Generate HTML report from latest results

Examples:
  node langfuse-validation-runner.js run
  node langfuse-validation-runner.js continuous 60
  node langfuse-validation-runner.js html
      `);
  }
}

export { LangfuseValidationRunner, ValidationReport, TestResult };
/**
 * Langfuse Integration Validation Runner
 * 
 * This script performs comprehensive validation of the Langfuse API integration
 * and generates a detailed report of the findings.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { langfuseClient, LangfuseRealtimeClient } from '../../../lib/langfuse-client';
import { langfuseAPI } from '../../../lib/langfuse-api';
import { LangfuseValidator, PerformanceMonitor, TestDataGenerator } from '../utils/test-helpers';

interface ValidationResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'WARNING' | 'SKIP';
  duration: number;
  details: string;
  error?: string;
}

interface ValidationReport {
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
    skipped: number;
    duration: number;
  };
  results: ValidationResult[];
  timestamp: string;
  environment: string;
  recommendations: string[];
}

class LangfuseValidationRunner {
  private results: ValidationResult[] = [];
  private startTime: number = 0;

  constructor() {
    this.startTime = Date.now();
  }

  private async runTest(testName: string, testFn: () => Promise<void>): Promise<ValidationResult> {
    console.log(`🧪 Running: ${testName}`);
    
    const result: ValidationResult = {
      test: testName,
      status: 'PASS',
      duration: 0,
      details: '',
    };

    try {
      await PerformanceMonitor.measureAsync(testName, testFn);
      result.duration = PerformanceMonitor.end(testName);
      result.details = 'Test completed successfully';
      result.status = 'PASS';
      console.log(`  ✅ PASS (${result.duration.toFixed(2)}ms)`);
    } catch (error) {
      result.status = 'FAIL';
      result.error = error instanceof Error ? error.message : String(error);
      result.details = `Test failed: ${result.error}`;
      console.log(`  ❌ FAIL: ${result.error}`);
    }

    this.results.push(result);
    return result;
  }

  async validateClientConfiguration(): Promise<void> {
    await this.runTest('Client Configuration', async () => {
      if (!langfuseClient) {
        throw new Error('Langfuse client is not defined');
      }

      // Check if client has required methods
      const requiredMethods = ['getTraces', 'createTrace', 'getSwarmMetrics', 'isRealtimeConnected'];
      for (const method of requiredMethods) {
        if (typeof (langfuseClient as any)[method] !== 'function') {
          throw new Error(`Missing required method: ${method}`);
        }
      }

      // Test client instantiation with custom config
      const testClient = new LangfuseRealtimeClient({
        baseUrl: 'http://localhost:3000',
        enableRealtime: false,
      });

      if (!testClient) {
        throw new Error('Failed to create test client instance');
      }
    });
  }

  async validateAPIEndpoints(): Promise<void> {
    await this.runTest('API Endpoints - Traces', async () => {
      const traces = await langfuseAPI.fetchTraces('test-session-validation');
      
      if (!Array.isArray(traces)) {
        throw new Error('fetchTraces did not return an array');
      }

      // Validate trace structure if traces exist
      if (traces.length > 0) {
        const trace = traces[0];
        const validation = LangfuseValidator.validateTraceStructure(trace);
        
        if (!validation.isValid) {
          throw new Error(`Invalid trace structure: ${validation.errors.join(', ')}`);
        }
      }
    });

    await this.runTest('API Endpoints - Sessions', async () => {
      const sessions = await langfuseAPI.fetchSessions();
      
      if (!Array.isArray(sessions)) {
        throw new Error('fetchSessions did not return an array');
      }

      // Validate session structure if sessions exist
      if (sessions.length > 0) {
        const session = sessions[0];
        const validation = LangfuseValidator.validateSessionStructure(session);
        
        if (!validation.isValid) {
          throw new Error(`Invalid session structure: ${validation.errors.join(', ')}`);
        }
      }
    });

    await this.runTest('API Endpoints - Create Trace', async () => {
      const testTrace = TestDataGenerator.generateTrace({
        name: 'Validation Test Trace',
        metadata: {
          validationTest: true,
          timestamp: new Date().toISOString(),
        },
      });

      const success = await langfuseAPI.createTrace(testTrace);
      
      if (typeof success !== 'boolean') {
        throw new Error('createTrace did not return a boolean');
      }
    });
  }

  async validateRealtimeClient(): Promise<void> {
    await this.runTest('Realtime Client - Initialization', async () => {
      const client = new LangfuseRealtimeClient({
        baseUrl: 'http://localhost:3000',
        enableRealtime: true,
      });

      // Wait for potential initialization
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check if client provides expected interface
      if (typeof client.isRealtimeConnected !== 'function') {
        throw new Error('Missing isRealtimeConnected method');
      }

      if (typeof client.getTraces !== 'function') {
        throw new Error('Missing getTraces method');
      }
    });

    await this.runTest('Realtime Client - Trace Fetching', async () => {
      const traces = await langfuseClient.getTraces({
        limit: 10,
        sessionId: 'validation-test-session',
      });

      if (!Array.isArray(traces)) {
        throw new Error('getTraces did not return an array');
      }

      // Test data structure
      if (traces.length > 0) {
        const trace = traces[0];
        
        const requiredFields = ['id', 'name', 'sessionId', 'timestamp', 'status'];
        for (const field of requiredFields) {
          if (!(field in trace)) {
            throw new Error(`Missing required field in trace: ${field}`);
          }
        }
      }
    });

    await this.runTest('Realtime Client - Metrics', async () => {
      const metrics = await langfuseClient.getSwarmMetrics('validation-test-swarm');
      
      if (!metrics) {
        throw new Error('getSwarmMetrics returned null or undefined');
      }

      const validation = LangfuseValidator.validateMetricsStructure(metrics);
      
      if (!validation.isValid) {
        throw new Error(`Invalid metrics structure: ${validation.errors.join(', ')}`);
      }
    });
  }

  async validateWebSocketConnection(): Promise<void> {
    await this.runTest('WebSocket Connection', async () => {
      // This test checks if WebSocket can be attempted without throwing errors
      const client = new LangfuseRealtimeClient({
        baseUrl: 'http://localhost:3000',
        wsEndpoint: 'ws://localhost:3000/ws',
        enableRealtime: true,
      });

      // Wait for connection attempt
      await new Promise(resolve => setTimeout(resolve, 2000));

      // The test passes if no errors are thrown during initialization
      // Actual connection success depends on Langfuse server availability
      const isConnected = client.isRealtimeConnected();
      
      // Update result based on connection status
      const lastResult = this.results[this.results.length - 1];
      if (lastResult) {
        if (isConnected) {
          lastResult.details = 'WebSocket connection established successfully';
        } else {
          lastResult.status = 'WARNING';
          lastResult.details = 'WebSocket connection not available - this is expected if Langfuse server is not running';
        }
      }
    });
  }

  async validateErrorHandling(): Promise<void> {
    await this.runTest('Error Handling - Invalid Endpoints', async () => {
      // Test with invalid configuration
      const client = new LangfuseRealtimeClient({
        baseUrl: 'http://invalid-host:9999',
        enableRealtime: false,
      });

      // These should not throw errors but return fallback data
      const traces = await client.getTraces();
      const metrics = await client.getSwarmMetrics();

      if (!Array.isArray(traces)) {
        throw new Error('Error handling failed - should return array for traces');
      }

      if (!metrics || typeof metrics !== 'object') {
        throw new Error('Error handling failed - should return object for metrics');
      }
    });

    await this.runTest('Error Handling - Network Failures', async () => {
      // Mock network failure
      const originalFetch = global.fetch;
      global.fetch = async () => {
        throw new Error('Network error');
      };

      try {
        const traces = await langfuseAPI.fetchTraces();
        
        if (!Array.isArray(traces)) {
          throw new Error('Should return fallback data on network error');
        }
      } finally {
        global.fetch = originalFetch;
      }
    });
  }

  async validatePerformance(): Promise<void> {
    await this.runTest('Performance - Trace Fetching', async () => {
      const iterations = 5;
      const durations: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        await langfuseClient.getTraces({ limit: 50 });
        const duration = performance.now() - startTime;
        durations.push(duration);
      }

      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const maxDuration = Math.max(...durations);

      // Performance thresholds
      if (avgDuration > 2000) {
        throw new Error(`Average fetch time too slow: ${avgDuration.toFixed(2)}ms > 2000ms`);
      }

      if (maxDuration > 5000) {
        throw new Error(`Max fetch time too slow: ${maxDuration.toFixed(2)}ms > 5000ms`);
      }

      const lastResult = this.results[this.results.length - 1];
      if (lastResult) {
        lastResult.details = `Avg: ${avgDuration.toFixed(2)}ms, Max: ${maxDuration.toFixed(2)}ms`;
      }
    });

    await this.runTest('Performance - Metrics Calculation', async () => {
      const startTime = performance.now();
      const metrics = await langfuseClient.getSwarmMetrics();
      const duration = performance.now() - startTime;

      if (duration > 1000) {
        throw new Error(`Metrics calculation too slow: ${duration.toFixed(2)}ms > 1000ms`);
      }

      const lastResult = this.results[this.results.length - 1];
      if (lastResult) {
        lastResult.details = `Duration: ${duration.toFixed(2)}ms`;
      }
    });
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    
    // Analyze results for recommendations
    const failedTests = this.results.filter(r => r.status === 'FAIL');
    const warningTests = this.results.filter(r => r.status === 'WARNING');
    const slowTests = this.results.filter(r => r.duration > 1000);

    if (failedTests.length > 0) {
      recommendations.push('Review failed tests and check Langfuse server configuration');
    }

    if (warningTests.some(t => t.test.includes('WebSocket'))) {
      recommendations.push('Consider enabling WebSocket support for real-time features');
    }

    if (slowTests.length > 0) {
      recommendations.push('Optimize API calls or consider implementing caching for better performance');
    }

    const performanceTests = this.results.filter(r => r.test.includes('Performance'));
    const avgPerformance = performanceTests.reduce((sum, t) => sum + t.duration, 0) / performanceTests.length;
    
    if (avgPerformance > 500) {
      recommendations.push('Performance could be improved - consider optimizing network calls');
    }

    if (this.results.every(r => r.status === 'PASS')) {
      recommendations.push('All tests passed! The Langfuse integration is working correctly.');
    }

    return recommendations;
  }

  async generateReport(): Promise<ValidationReport> {
    const endTime = Date.now();
    const totalDuration = endTime - this.startTime;

    const summary = {
      total: this.results.length,
      passed: this.results.filter(r => r.status === 'PASS').length,
      failed: this.results.filter(r => r.status === 'FAIL').length,
      warnings: this.results.filter(r => r.status === 'WARNING').length,
      skipped: this.results.filter(r => r.status === 'SKIP').length,
      duration: totalDuration,
    };

    const report: ValidationReport = {
      summary,
      results: this.results,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      recommendations: this.generateRecommendations(),
    };

    return report;
  }

  async run(): Promise<ValidationReport> {
    console.log('🚀 Starting Langfuse Integration Validation...\n');

    // Run all validation tests
    await this.validateClientConfiguration();
    await this.validateAPIEndpoints();
    await this.validateRealtimeClient();
    await this.validateWebSocketConnection();
    await this.validateErrorHandling();
    await this.validatePerformance();

    console.log('\n📊 Generating validation report...');
    const report = await this.generateReport();

    // Print summary
    console.log('\n🎯 Validation Summary:');
    console.log(`  Total Tests: ${report.summary.total}`);
    console.log(`  ✅ Passed: ${report.summary.passed}`);
    console.log(`  ❌ Failed: ${report.summary.failed}`);
    console.log(`  ⚠️ Warnings: ${report.summary.warnings}`);
    console.log(`  ⏭️ Skipped: ${report.summary.skipped}`);
    console.log(`  ⏱️ Duration: ${report.summary.duration}ms`);

    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      report.recommendations.forEach(rec => console.log(`  • ${rec}`));
    }

    return report;
  }
}

// Main execution
async function main() {
  const runner = new LangfuseValidationRunner();
  
  try {
    const report = await runner.run();
    
    // Save report to file
    const reportPath = path.join(process.cwd(), 'langfuse-validation-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Report saved to: ${reportPath}`);
    
    // Exit with appropriate code
    const exitCode = report.summary.failed > 0 ? 1 : 0;
    process.exit(exitCode);
    
  } catch (error) {
    console.error('\n❌ Validation runner failed:', error);
    process.exit(1);
  }
}

// Run if this script is executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { LangfuseValidationRunner };