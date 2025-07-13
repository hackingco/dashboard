#!/usr/bin/env node

/**
 * Comprehensive Langfuse Testing Suite
 * Automated tests for tracing functionality
 */

const axios = require('./testing-utils/node_modules/axios/dist/node/axios.cjs');
const WebSocket = require('./testing-utils/node_modules/ws');
const { v4: uuidv4 } = require('./testing-utils/node_modules/uuid');

class LangfuseTestSuite {
  constructor(config = {}) {
    this.config = {
      langfuseUrl: config.langfuseUrl || 'http://localhost:3000',
      dashboardUrl: config.dashboardUrl || 'http://localhost:3001',
      websocketUrl: config.websocketUrl || 'ws://localhost:3002',
      publicKey: config.publicKey || 'pk-lf-test',
      secretKey: config.secretKey || 'sk-lf-test',
      timeout: config.timeout || 30000,
      ...config
    };
    
    this.results = [];
    this.traces = [];
  }

  /**
   * Test basic connectivity
   */
  async testConnectivity() {
    console.log('\n🔌 Testing Connectivity...\n');
    
    const tests = [
      {
        name: 'Dashboard Health Check',
        url: `${this.config.dashboardUrl}/api/health`,
        expected: 'healthy'
      },
      {
        name: 'Langfuse Health Check',
        url: `${this.config.langfuseUrl}/api/public/health`,
        expected: 'ok'
      }
    ];
    
    for (const test of tests) {
      try {
        const response = await axios.get(test.url, { timeout: 5000 });
        const passed = response.data.status === test.expected || response.status === 200;
        
        this.recordResult(test.name, passed, response.data);
        console.log(`${passed ? '✅' : '❌'} ${test.name}`);
      } catch (error) {
        this.recordResult(test.name, false, error.message);
        console.log(`❌ ${test.name}: ${error.message}`);
      }
    }
  }

  /**
   * Test trace creation
   */
  async testTraceCreation() {
    console.log('\n📈 Testing Trace Creation...\n');
    
    const trace = {
      id: `test-trace-${uuidv4()}`,
      timestamp: new Date().toISOString(),
      name: 'Test Trace Creation',
      sessionId: `test-session-${Date.now()}`,
      publicKey: this.config.publicKey,
      metadata: {
        test: true,
        suite: 'langfuse-test',
        timestamp: Date.now()
      }
    };
    
    try {
      // Create trace via dashboard API
      const response = await axios.post(
        `${this.config.dashboardUrl}/api/traces`,
        trace,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.secretKey}`
          }
        }
      );
      
      this.traces.push(trace.id);
      this.recordResult('Create Trace', true, response.data);
      console.log('✅ Create Trace');
      
      return trace.id;
    } catch (error) {
      this.recordResult('Create Trace', false, error.message);
      console.log(`❌ Create Trace: ${error.message}`);
      return null;
    }
  }

  /**
   * Test span creation
   */
  async testSpanCreation(traceId) {
    console.log('\n🔗 Testing Span Creation...\n');
    
    if (!traceId) {
      console.log('⚠️  Skipping span tests (no trace ID)');
      return;
    }
    
    const spans = [
      {
        id: `span-init-${uuidv4()}`,
        traceId: traceId,
        name: 'Initialize',
        startTime: new Date(Date.now() - 5000).toISOString(),
        endTime: new Date(Date.now() - 4000).toISOString(),
        metadata: { phase: 'initialization' }
      },
      {
        id: `span-process-${uuidv4()}`,
        traceId: traceId,
        name: 'Process',
        startTime: new Date(Date.now() - 4000).toISOString(),
        endTime: new Date(Date.now() - 2000).toISOString(),
        metadata: { phase: 'processing', items: 100 }
      },
      {
        id: `span-complete-${uuidv4()}`,
        traceId: traceId,
        name: 'Complete',
        startTime: new Date(Date.now() - 2000).toISOString(),
        endTime: new Date().toISOString(),
        metadata: { phase: 'completion', success: true }
      }
    ];
    
    for (const span of spans) {
      try {
        const response = await axios.post(
          `${this.config.dashboardUrl}/api/spans`,
          span,
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.config.secretKey}`
            }
          }
        );
        
        this.recordResult(`Create Span: ${span.name}`, true, response.data);
        console.log(`✅ Create Span: ${span.name}`);
      } catch (error) {
        this.recordResult(`Create Span: ${span.name}`, false, error.message);
        console.log(`❌ Create Span: ${span.name}: ${error.message}`);
      }
    }
  }

  /**
   * Test WebSocket streaming
   */
  async testWebSocketStreaming() {
    console.log('\n🌐 Testing WebSocket Streaming...\n');
    
    return new Promise((resolve) => {
      let messageCount = 0;
      const targetMessages = 5;
      const timeout = setTimeout(() => {
        ws.close();
        this.recordResult('WebSocket Streaming', false, 'Timeout');
        console.log('❌ WebSocket Streaming: Timeout');
        resolve();
      }, 10000);
      
      const ws = new WebSocket(this.config.websocketUrl);
      
      ws.on('open', () => {
        console.log('🔗 WebSocket connected');
        ws.send(JSON.stringify({ type: 'subscribe', channel: 'traces' }));
      });
      
      ws.on('message', (data) => {
        messageCount++;
        console.log(`📨 Received message ${messageCount}/${targetMessages}`);
        
        if (messageCount >= targetMessages) {
          clearTimeout(timeout);
          ws.close();
          this.recordResult('WebSocket Streaming', true, `Received ${messageCount} messages`);
          console.log(`✅ WebSocket Streaming: ${messageCount} messages`);
          resolve();
        }
      });
      
      ws.on('error', (error) => {
        clearTimeout(timeout);
        this.recordResult('WebSocket Streaming', false, error.message);
        console.log(`❌ WebSocket Streaming: ${error.message}`);
        resolve();
      });
    });
  }

  /**
   * Test performance metrics
   */
  async testPerformanceMetrics() {
    console.log('\n⚡ Testing Performance Metrics...\n');
    
    const iterations = 10;
    const latencies = [];
    
    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      
      try {
        await axios.get(`${this.config.dashboardUrl}/api/metrics`, {
          timeout: 5000
        });
        
        const latency = Date.now() - start;
        latencies.push(latency);
        console.log(`📊 Request ${i + 1}/${iterations}: ${latency}ms`);
      } catch (error) {
        console.log(`❌ Request ${i + 1} failed: ${error.message}`);
      }
    }
    
    if (latencies.length > 0) {
      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const maxLatency = Math.max(...latencies);
      const minLatency = Math.min(...latencies);
      
      console.log(`\n📈 Performance Results:`);
      console.log(`   Average: ${avgLatency.toFixed(2)}ms`);
      console.log(`   Min: ${minLatency}ms`);
      console.log(`   Max: ${maxLatency}ms`);
      
      const passed = avgLatency < 100; // Target: <100ms average
      this.recordResult('Performance Metrics', passed, {
        avgLatency,
        minLatency,
        maxLatency,
        samples: latencies.length
      });
      
      console.log(`${passed ? '✅' : '❌'} Performance target: <100ms average`);
    }
  }

  /**
   * Test swarm coordination
   */
  async testSwarmCoordination() {
    console.log('\n🐝 Testing Swarm Coordination...\n');
    
    const swarmId = `swarm-test-${uuidv4()}`;
    const agents = [];
    
    // Create multiple agent traces
    for (let i = 0; i < 3; i++) {
      const agentTrace = {
        id: `agent-${i}-trace-${uuidv4()}`,
        timestamp: new Date().toISOString(),
        name: `Agent ${i} Task`,
        sessionId: swarmId,
        publicKey: this.config.publicKey,
        metadata: {
          swarmId: swarmId,
          agentId: `agent-${i}`,
          agentRole: ['coordinator', 'worker', 'monitor'][i],
          coordination: true
        }
      };
      
      try {
        await axios.post(
          `${this.config.dashboardUrl}/api/traces`,
          agentTrace,
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.config.secretKey}`
            }
          }
        );
        
        agents.push(agentTrace.id);
        console.log(`✅ Created trace for Agent ${i}`);
      } catch (error) {
        console.log(`❌ Failed to create trace for Agent ${i}: ${error.message}`);
      }
    }
    
    const passed = agents.length === 3;
    this.recordResult('Swarm Coordination', passed, {
      swarmId,
      agents: agents.length,
      traces: agents
    });
    
    console.log(`${passed ? '✅' : '❌'} Swarm Coordination: ${agents.length}/3 agents`);
  }

  /**
   * Test error handling
   */
  async testErrorHandling() {
    console.log('\n🚨 Testing Error Handling...\n');
    
    const tests = [
      {
        name: 'Invalid Trace ID',
        request: {
          method: 'GET',
          url: `${this.config.dashboardUrl}/api/traces/invalid-id`
        }
      },
      {
        name: 'Missing Required Fields',
        request: {
          method: 'POST',
          url: `${this.config.dashboardUrl}/api/traces`,
          data: { name: 'Incomplete Trace' } // Missing required fields
        }
      },
      {
        name: 'Invalid Authentication',
        request: {
          method: 'POST',
          url: `${this.config.dashboardUrl}/api/traces`,
          headers: { Authorization: 'Bearer invalid-key' },
          data: { id: 'test', name: 'Test' }
        }
      }
    ];
    
    for (const test of tests) {
      try {
        await axios(test.request);
        this.recordResult(`Error Handling: ${test.name}`, false, 'Expected error but succeeded');
        console.log(`❌ Error Handling: ${test.name} - Should have failed`);
      } catch (error) {
        const handled = error.response && error.response.status >= 400;
        this.recordResult(`Error Handling: ${test.name}`, handled, error.response?.status || error.message);
        console.log(`${handled ? '✅' : '❌'} Error Handling: ${test.name}`);
      }
    }
  }

  /**
   * Test data persistence
   */
  async testDataPersistence() {
    console.log('\n💾 Testing Data Persistence...\n');
    
    if (this.traces.length === 0) {
      console.log('⚠️  No traces to test persistence');
      return;
    }
    
    const traceId = this.traces[0];
    
    try {
      // Retrieve created trace
      const response = await axios.get(
        `${this.config.dashboardUrl}/api/traces/${traceId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.secretKey}`
          }
        }
      );
      
      const passed = response.data && response.data.id === traceId;
      this.recordResult('Data Persistence', passed, response.data);
      console.log(`${passed ? '✅' : '❌'} Data Persistence: Trace retrieval`);
    } catch (error) {
      this.recordResult('Data Persistence', false, error.message);
      console.log(`❌ Data Persistence: ${error.message}`);
    }
  }

  /**
   * Record test result
   */
  recordResult(test, passed, details) {
    this.results.push({
      test,
      passed,
      details,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Generate test report
   */
  generateReport() {
    console.log('\n📊 Test Report\n');
    console.log('=============\n');
    
    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;
    const percentage = total > 0 ? (passed / total * 100).toFixed(1) : 0;
    
    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${total - passed}`);
    console.log(`Success Rate: ${percentage}%\n`);
    
    // Group results by category
    const categories = {};
    this.results.forEach(result => {
      const category = result.test.split(':')[0];
      if (!categories[category]) {
        categories[category] = { passed: 0, failed: 0, tests: [] };
      }
      
      if (result.passed) {
        categories[category].passed++;
      } else {
        categories[category].failed++;
      }
      
      categories[category].tests.push(result);
    });
    
    // Display by category
    Object.entries(categories).forEach(([category, data]) => {
      console.log(`\n${category}:`);
      console.log(`  ✅ Passed: ${data.passed}`);
      console.log(`  ❌ Failed: ${data.failed}`);
      
      data.tests.forEach(test => {
        if (!test.passed) {
          console.log(`     - ${test.test}: ${JSON.stringify(test.details)}`);
        }
      });
    });
    
    // Save detailed report
    const report = {
      summary: {
        total,
        passed,
        failed: total - passed,
        successRate: percentage + '%',
        timestamp: new Date().toISOString()
      },
      configuration: this.config,
      results: this.results,
      categories
    };
    
    require('fs').writeFileSync(
      'langfuse-test-report.json',
      JSON.stringify(report, null, 2)
    );
    
    console.log('\n📄 Detailed report saved to: langfuse-test-report.json');
    
    return report;
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    console.log('🎯 Langfuse Comprehensive Test Suite');
    console.log('====================================\n');
    console.log('Configuration:');
    console.log(`  Langfuse URL : ${this.config.langfuseUrl}`);
    console.log(`  Dashboard URL: ${this.config.dashboardUrl}`);
    console.log(`  WebSocket URL: ${this.config.websocketUrl}`);
    
    try {
      // Run tests in sequence
      await this.testConnectivity();
      
      const traceId = await this.testTraceCreation();
      await this.testSpanCreation(traceId);
      
      await this.testWebSocketStreaming();
      await this.testPerformanceMetrics();
      await this.testSwarmCoordination();
      await this.testErrorHandling();
      await this.testDataPersistence();
      
      // Generate report
      const report = this.generateReport();
      
      // Exit code based on results
      const allPassed = report.summary.failed === 0;
      console.log(`\n${allPassed ? '✅' : '❌'} Test suite ${allPassed ? 'PASSED' : 'FAILED'}`);
      
      return allPassed ? 0 : 1;
      
    } catch (error) {
      console.error('\n❌ Test suite error:', error.message);
      return 1;
    }
  }
}

// CLI interface
if (require.main === module) {
  const config = {
    langfuseUrl: process.env.LANGFUSE_URL || 'http://localhost:3000',
    dashboardUrl: process.env.DASHBOARD_URL || 'http://localhost:3001',
    websocketUrl: process.env.WEBSOCKET_URL || 'ws://localhost:3002',
    publicKey: process.env.LANGFUSE_PUBLIC_KEY || 'pk-lf-test',
    secretKey: process.env.LANGFUSE_SECRET_KEY || 'sk-lf-test'
  };
  
  const testSuite = new LangfuseTestSuite(config);
  
  testSuite.runAllTests().then(exitCode => {
    process.exit(exitCode);
  });
}

module.exports = LangfuseTestSuite;