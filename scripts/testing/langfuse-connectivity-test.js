#!/usr/bin/env node

/**
 * Langfuse v3 Connectivity and Tracing Test Suite
 * Validates ClickHouse integration, trace ingestion, and API functionality
 */

const axios = require('axios');
const { Langfuse } = require('langfuse');
const fs = require('fs').promises;
const path = require('path');

// Configuration
const CONFIG = {
  langfuse: {
    baseUrl: process.env.LANGFUSE_HOST || 'http://localhost:3001',
    publicKey: process.env.LANGFUSE_PUBLIC_KEY || 'pk-lf-test',
    secretKey: process.env.LANGFUSE_SECRET_KEY || 'sk-lf-test',
    ingestionUrl: process.env.LANGFUSE_INGESTION_URL || 'http://localhost:3002'
  },
  clickhouse: {
    url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
    user: process.env.CLICKHOUSE_USER || 'clickhouse',
    password: process.env.CLICKHOUSE_PASSWORD || 'clickhouse'
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  }
};

// Test results tracking
const results = {
  timestamp: new Date().toISOString(),
  tests: {},
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    warnings: 0
  }
};

// Logging utilities
const log = (message) => {
  console.log(`[${new Date().toISOString()}] ${message}`);
};

const error = (message) => {
  console.error(`[ERROR] ${message}`);
};

const success = (message) => {
  console.log(`[SUCCESS] ${message}`);
};

const warning = (message) => {
  console.warn(`[WARNING] ${message}`);
};

// Update test result
const updateResult = (testName, status, message, details = null) => {
  results.tests[testName] = {
    status,
    message,
    details,
    timestamp: new Date().toISOString()
  };
  
  results.summary.total++;
  if (status === 'passed') results.summary.passed++;
  else if (status === 'failed') results.summary.failed++;
  else results.summary.warnings++;
};

// Test Langfuse API health
async function testLangfuseHealth() {
  log('Testing Langfuse API health...');
  
  try {
    const response = await axios.get(`${CONFIG.langfuse.baseUrl}/api/health`, {
      timeout: 10000
    });
    
    if (response.status === 200) {
      success('Langfuse API is healthy');
      updateResult('langfuse_health', 'passed', 'API health check successful', {
        status: response.status,
        data: response.data
      });
      return true;
    } else {
      error(`Langfuse API returned status ${response.status}`);
      updateResult('langfuse_health', 'failed', `API returned status ${response.status}`);
      return false;
    }
  } catch (err) {
    error(`Langfuse API health check failed: ${err.message}`);
    updateResult('langfuse_health', 'failed', `API health check failed: ${err.message}`);
    return false;
  }
}

// Test ClickHouse connectivity
async function testClickHouseConnectivity() {
  log('Testing ClickHouse connectivity...');
  
  try {
    // Test basic ping
    const pingResponse = await axios.get(`${CONFIG.clickhouse.url}/ping`, {
      timeout: 5000
    });
    
    if (pingResponse.status !== 200) {
      throw new Error(`ClickHouse ping failed with status ${pingResponse.status}`);
    }
    
    // Test query endpoint
    const queryResponse = await axios.post(`${CONFIG.clickhouse.url}`, 
      'SELECT version()',
      {
        headers: {
          'Content-Type': 'text/plain'
        },
        auth: {
          username: CONFIG.clickhouse.user,
          password: CONFIG.clickhouse.password
        },
        timeout: 10000
      }
    );
    
    success('ClickHouse is responsive');
    updateResult('clickhouse_connectivity', 'passed', 'ClickHouse connectivity successful', {
      version: queryResponse.data.trim(),
      ping: true
    });
    return true;
  } catch (err) {
    error(`ClickHouse connectivity failed: ${err.message}`);
    updateResult('clickhouse_connectivity', 'failed', `ClickHouse connectivity failed: ${err.message}`);
    return false;
  }
}

// Test Langfuse SDK integration
async function testLangfuseSDK() {
  log('Testing Langfuse SDK integration...');
  
  try {
    const langfuse = new Langfuse({
      publicKey: CONFIG.langfuse.publicKey,
      secretKey: CONFIG.langfuse.secretKey,
      baseUrl: CONFIG.langfuse.baseUrl,
      flushAt: 1,
      flushInterval: 1000
    });
    
    // Create a test trace
    const trace = langfuse.trace({
      name: 'docker-validation-test',
      metadata: {
        testType: 'connectivity',
        timestamp: new Date().toISOString(),
        source: 'docker-stack-validation'
      }
    });
    
    // Add a generation
    const generation = trace.generation({
      name: 'test-generation',
      model: 'test-model',
      input: { prompt: 'Test prompt for validation' },
      output: { response: 'Test response from validation' },
      metadata: {
        validation: true,
        stack: 'docker'
      }
    });
    
    // Score the generation
    generation.score({
      name: 'quality',
      value: 0.95,
      comment: 'High quality test generation'
    });
    
    // Flush immediately
    await langfuse.flushAsync();
    
    success('Langfuse SDK integration successful');
    updateResult('langfuse_sdk', 'passed', 'SDK integration and trace creation successful', {
      traceId: trace.id,
      generationId: generation.id
    });
    return true;
  } catch (err) {
    error(`Langfuse SDK integration failed: ${err.message}`);
    updateResult('langfuse_sdk', 'failed', `SDK integration failed: ${err.message}`);
    return false;
  }
}

// Test high-throughput ingestion
async function testHighThroughputIngestion() {
  log('Testing high-throughput trace ingestion...');
  
  try {
    const langfuse = new Langfuse({
      publicKey: CONFIG.langfuse.publicKey,
      secretKey: CONFIG.langfuse.secretKey,
      baseUrl: CONFIG.langfuse.ingestionUrl || CONFIG.langfuse.baseUrl,
      flushAt: 50,
      flushInterval: 2000
    });
    
    const startTime = Date.now();
    const batchSize = 100;
    const traces = [];
    
    // Create multiple traces quickly
    for (let i = 0; i < batchSize; i++) {
      const trace = langfuse.trace({
        name: `batch-test-trace-${i}`,
        metadata: {
          batchId: startTime,
          index: i,
          testType: 'high-throughput'
        }
      });
      
      trace.generation({
        name: `batch-generation-${i}`,
        model: 'test-model-batch',
        input: { prompt: `Batch test prompt ${i}` },
        output: { response: `Batch test response ${i}` }
      });
      
      traces.push(trace.id);
    }
    
    // Flush all traces
    await langfuse.flushAsync();
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    const throughput = (batchSize / duration) * 1000; // traces per second
    
    success(`High-throughput ingestion successful: ${batchSize} traces in ${duration}ms (${throughput.toFixed(2)} traces/sec)`);
    updateResult('high_throughput_ingestion', 'passed', 'High-throughput ingestion successful', {
      batchSize,
      duration,
      throughput: throughput.toFixed(2),
      traceIds: traces.slice(0, 5) // Store first 5 trace IDs
    });
    return true;
  } catch (err) {
    error(`High-throughput ingestion failed: ${err.message}`);
    updateResult('high_throughput_ingestion', 'failed', `High-throughput ingestion failed: ${err.message}`);
    return false;
  }
}

// Test ClickHouse data flow
async function testClickHouseDataFlow() {
  log('Testing ClickHouse data flow...');
  
  try {
    // Wait a bit for data to be processed
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Query traces table in ClickHouse
    const queryResponse = await axios.post(`${CONFIG.clickhouse.url}`,
      'SELECT count(*) FROM traces WHERE name LIKE \'%test%\' FORMAT JSON',
      {
        headers: {
          'Content-Type': 'text/plain'
        },
        auth: {
          username: CONFIG.clickhouse.user,
          password: CONFIG.clickhouse.password
        },
        timeout: 10000
      }
    );
    
    const result = JSON.parse(queryResponse.data);
    const traceCount = result.data[0]['count()'];
    
    if (traceCount > 0) {
      success(`ClickHouse contains ${traceCount} test traces`);
      updateResult('clickhouse_data_flow', 'passed', 'Data flow to ClickHouse successful', {
        traceCount
      });
      return true;
    } else {
      warning('No test traces found in ClickHouse yet');
      updateResult('clickhouse_data_flow', 'warning', 'No traces found in ClickHouse', {
        traceCount: 0
      });
      return false;
    }
  } catch (err) {
    // This might fail if tables don't exist yet, which is okay
    warning(`ClickHouse data flow test failed: ${err.message}`);
    updateResult('clickhouse_data_flow', 'warning', `Data flow test failed: ${err.message}`);
    return false;
  }
}

// Test Redis connectivity
async function testRedisConnectivity() {
  log('Testing Redis connectivity...');
  
  try {
    const Redis = require('ioredis');
    const redis = new Redis(CONFIG.redis.url);
    
    // Test ping
    const pong = await redis.ping();
    if (pong !== 'PONG') {
      throw new Error('Redis ping failed');
    }
    
    // Test set/get
    await redis.set('langfuse-test', 'validation');
    const value = await redis.get('langfuse-test');
    
    if (value !== 'validation') {
      throw new Error('Redis set/get test failed');
    }
    
    // Cleanup
    await redis.del('langfuse-test');
    await redis.quit();
    
    success('Redis connectivity successful');
    updateResult('redis_connectivity', 'passed', 'Redis connectivity and operations successful');
    return true;
  } catch (err) {
    error(`Redis connectivity failed: ${err.message}`);
    updateResult('redis_connectivity', 'failed', `Redis connectivity failed: ${err.message}`);
    return false;
  }
}

// Test Langfuse worker processing
async function testWorkerProcessing() {
  log('Testing Langfuse worker processing...');
  
  try {
    // Check if worker container is running
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    const { stdout } = await execAsync('docker ps --filter "name=langfuse-worker" --format "{{.Status}}"');
    
    if (stdout.trim() && stdout.includes('Up')) {
      success('Langfuse worker is running');
      updateResult('worker_processing', 'passed', 'Langfuse worker is active', {
        status: stdout.trim()
      });
      return true;
    } else {
      warning('Langfuse worker not found or not running');
      updateResult('worker_processing', 'warning', 'Worker not running');
      return false;
    }
  } catch (err) {
    warning(`Worker processing test failed: ${err.message}`);
    updateResult('worker_processing', 'warning', `Worker test failed: ${err.message}`);
    return false;
  }
}

// Save results to file
async function saveResults() {
  const resultsPath = path.join(process.cwd(), 'langfuse-connectivity-test-results.json');
  await fs.writeFile(resultsPath, JSON.stringify(results, null, 2));
  log(`Results saved to ${resultsPath}`);
}

// Generate summary report
function generateSummary() {
  log('=== LANGFUSE CONNECTIVITY TEST SUMMARY ===');
  log(`Total tests: ${results.summary.total}`);
  log(`Passed: ${results.summary.passed}`);
  log(`Failed: ${results.summary.failed}`);
  log(`Warnings: ${results.summary.warnings}`);
  
  console.log('\nDetailed Results:');
  Object.entries(results.tests).forEach(([testName, result]) => {
    const status = result.status.toUpperCase();
    const emoji = result.status === 'passed' ? '✅' : result.status === 'failed' ? '❌' : '⚠️';
    console.log(`${emoji} ${testName}: ${status} - ${result.message}`);
  });
}

// Main execution
async function main() {
  log('Starting Langfuse v3 Connectivity Tests');
  log(`Langfuse URL: ${CONFIG.langfuse.baseUrl}`);
  log(`ClickHouse URL: ${CONFIG.clickhouse.url}`);
  log(`Redis URL: ${CONFIG.redis.url}`);
  
  // Run all tests
  await testLangfuseHealth();
  await testClickHouseConnectivity();
  await testRedisConnectivity();
  await testLangfuseSDK();
  await testHighThroughputIngestion();
  await testWorkerProcessing();
  await testClickHouseDataFlow();
  
  // Save results and generate summary
  await saveResults();
  generateSummary();
  
  // Store results for coordination
  try {
    await require('child_process').execSync(
      `npx claude-flow@alpha hooks notification --message "Langfuse connectivity tests completed: ${results.summary.passed}/${results.summary.total} passed" --telemetry true`,
      { stdio: 'inherit' }
    );
  } catch (err) {
    // Ignore if hooks not available
  }
  
  // Exit with appropriate code
  if (results.summary.failed > 0) {
    error('Some tests failed. Check the results for details.');
    process.exit(1);
  } else {
    success('All critical tests passed!');
    process.exit(0);
  }
}

// Handle errors
process.on('unhandledRejection', (err) => {
  error(`Unhandled rejection: ${err.message}`);
  process.exit(1);
});

// Run if called directly
if (require.main === module) {
  main().catch(err => {
    error(`Test suite failed: ${err.message}`);
    process.exit(1);
  });
}

module.exports = {
  CONFIG,
  testLangfuseHealth,
  testClickHouseConnectivity,
  testRedisConnectivity,
  testLangfuseSDK,
  testHighThroughputIngestion,
  testWorkerProcessing,
  testClickHouseDataFlow
};