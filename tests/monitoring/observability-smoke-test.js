#!/usr/bin/env node

const WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');
const assert = require('assert');
const fetch = require('node-fetch');

// Test configuration
const config = {
  wsUrl: process.env.WS_URL || 'ws://localhost:3001',
  apiUrl: process.env.API_URL || 'http://localhost:3001',
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  flyApiToken: process.env.FLY_API_TOKEN,
  testTimeout: 120000, // 2 minutes
  healthCheckInterval: 5000, // 5 seconds
  maxHealthCheckAttempts: 24 // 2 minutes total
};

// Initialize Supabase client
const supabase = config.supabaseUrl && config.supabaseKey ? 
  createClient(config.supabaseUrl, config.supabaseKey) : null;

// Test utilities
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const generateTestId = () => `test-${Date.now()}-${Math.random().toString(36).substring(7)}`;

// WebSocket test functions
async function testWebSocketConnection() {
  console.log('🧪 Testing WebSocket connection...');
  
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(config.wsUrl);
    
    ws.on('open', () => {
      console.log('✅ WebSocket connected successfully');
      ws.close();
      resolve(true);
    });
    
    ws.on('error', (error) => {
      console.error('❌ WebSocket connection failed:', error.message);
      reject(error);
    });
    
    setTimeout(() => {
      ws.close();
      reject(new Error('WebSocket connection timeout'));
    }, 10000);
  });
}

async function testWebSocketBroadcast() {
  console.log('🧪 Testing WebSocket broadcast messages...');
  
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(config.wsUrl);
    const testSwarmId = generateTestId();
    let receivedMessages = [];
    
    ws.on('open', () => {
      console.log('📡 WebSocket connected, waiting for broadcasts...');
    });
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        receivedMessages.push(message);
        console.log(`📨 Received message type: ${message.type}`);
        
        if (message.type === 'swarm_update' && message.swarmId === testSwarmId) {
          console.log('✅ Received expected swarm update broadcast');
          ws.close();
          resolve(receivedMessages);
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    });
    
    ws.on('error', (error) => {
      reject(error);
    });
    
    // Wait for connection then trigger a swarm update
    setTimeout(async () => {
      try {
        const response = await fetch(`${config.apiUrl}/api/swarms`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.flyApiToken}`
          },
          body: JSON.stringify({
            name: `Test Swarm ${testSwarmId}`,
            description: 'Smoke test swarm',
            config: {
              workerCount: 1,
              workerType: 'test',
              region: 'dfw'
            }
          })
        });
        
        if (!response.ok) {
          throw new Error(`Failed to create test swarm: ${response.status}`);
        }
        
        const swarm = await response.json();
        console.log(`🐝 Created test swarm: ${swarm.id}`);
      } catch (error) {
        console.error('Failed to trigger swarm update:', error);
        ws.close();
        reject(error);
      }
    }, 2000);
    
    // Timeout after 30 seconds
    setTimeout(() => {
      ws.close();
      reject(new Error('WebSocket broadcast test timeout'));
    }, 30000);
  });
}

// API test functions
async function testLaunchOperation() {
  console.log('🧪 Testing launch operation...');
  
  const testId = generateTestId();
  const appName = `test-app-${testId}`;
  
  try {
    // Launch a test machine
    const launchResponse = await fetch(`${config.apiUrl}/api/fly/launch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.flyApiToken}`
      },
      body: JSON.stringify({
        appName: appName,
        config: {
          swarmId: testId,
          workerType: 'test',
          region: 'dfw',
          cpus: 1,
          memory: 256,
          dockerImage: 'flyio/hellofly:latest',
          correlationId: `test-correlation-${testId}`
        }
      })
    });
    
    if (!launchResponse.ok) {
      const error = await launchResponse.text();
      throw new Error(`Launch failed: ${launchResponse.status} - ${error}`);
    }
    
    const machine = await launchResponse.json();
    console.log(`✅ Launched machine: ${machine.id} in app: ${appName}`);
    
    return { appName, machineId: machine.id, correlationId: `test-correlation-${testId}` };
  } catch (error) {
    console.error('❌ Launch operation failed:', error.message);
    throw error;
  }
}

async function testScaleOperation(appName, targetCount) {
  console.log(`🧪 Testing scale operation to ${targetCount} instances...`);
  
  try {
    const scaleResponse = await fetch(`${config.apiUrl}/api/fly/scale`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.flyApiToken}`
      },
      body: JSON.stringify({
        appName: appName,
        count: targetCount
      })
    });
    
    if (!scaleResponse.ok) {
      const error = await scaleResponse.text();
      throw new Error(`Scale failed: ${scaleResponse.status} - ${error}`);
    }
    
    console.log(`✅ Scaled app ${appName} to ${targetCount} instances`);
    return true;
  } catch (error) {
    console.error('❌ Scale operation failed:', error.message);
    throw error;
  }
}

async function testHealthCheck(appName, machineId) {
  console.log(`🧪 Testing health check for machine ${machineId}...`);
  
  for (let attempt = 0; attempt < config.maxHealthCheckAttempts; attempt++) {
    try {
      const healthResponse = await fetch(`${config.apiUrl}/api/fly/machines/${appName}/${machineId}/health`, {
        headers: {
          'Authorization': `Bearer ${config.flyApiToken}`
        }
      });
      
      if (!healthResponse.ok) {
        throw new Error(`Health check returned ${healthResponse.status}`);
      }
      
      const health = await healthResponse.json();
      console.log(`🏥 Health check attempt ${attempt + 1}: ${health.status}`);
      
      if (health.status === 'passing') {
        console.log('✅ Machine is healthy');
        return true;
      }
      
      await delay(config.healthCheckInterval);
    } catch (error) {
      console.log(`⚠️  Health check attempt ${attempt + 1} failed: ${error.message}`);
      await delay(config.healthCheckInterval);
    }
  }
  
  throw new Error('Health check did not reach passing state within timeout');
}

// Observability test functions
async function testObservabilityIntegration(swarmId, correlationId) {
  console.log('🧪 Testing observability integration...');
  
  if (!supabase) {
    console.warn('⚠️  Supabase not configured, skipping observability integration test');
    return null;
  }
  
  try {
    // Check if observability correlation was created
    const { data: correlations, error } = await supabase
      .from('observability_correlations')
      .select('*')
      .eq('swarm_id', swarmId)
      .eq('correlation_id', correlationId)
      .limit(1);
    
    if (error) {
      throw error;
    }
    
    if (correlations && correlations.length > 0) {
      console.log('✅ Observability correlation found:', {
        correlation_id: correlations[0].correlation_id,
        langfuse_trace_id: correlations[0].langfuse_trace_id,
        operation_type: correlations[0].operation_type
      });
      return correlations[0];
    } else {
      console.warn('⚠️  No observability correlation found for swarm');
      return null;
    }
  } catch (error) {
    console.error('❌ Observability integration test failed:', error.message);
    throw error;
  }
}

async function testTrustGraphNodes(swarmId) {
  console.log('🧪 Testing TrustGraph node creation...');
  
  try {
    const response = await fetch(`${config.apiUrl}/api/observability/trustgraph/${swarmId}`, {
      headers: {
        'Authorization': `Bearer ${config.flyApiToken}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get TrustGraph data: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('✅ TrustGraph data retrieved:', {
      totalNodes: data.stats.totalNodes,
      wsBroadcastNodes: data.stats.wsBroadcastNodes,
      apiCallNodes: data.stats.apiCallNodes,
      correlationChains: data.stats.correlationChains
    });
    
    assert(data.stats.totalNodes > 0, 'No TrustGraph nodes found');
    assert(data.stats.wsBroadcastNodes > 0, 'No WebSocket broadcast nodes found');
    assert(data.stats.apiCallNodes > 0, 'No API call nodes found');
    
    return data;
  } catch (error) {
    console.error('❌ TrustGraph test failed:', error.message);
    throw error;
  }
}

async function testLangfuseTraces(correlationId) {
  console.log('🧪 Testing Langfuse trace tracking...');
  
  try {
    const response = await fetch(`${config.apiUrl}/api/observability/langfuse/traces?correlation_id=${correlationId}`, {
      headers: {
        'Authorization': `Bearer ${config.flyApiToken}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get Langfuse traces: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('✅ Langfuse traces found:', {
      trace_count: data.traces?.length || 0,
      total_tokens: data.metrics?.total_tokens || 0,
      total_cost: data.metrics?.total_cost || 0,
      average_latency: data.metrics?.average_latency || 0
    });
    
    assert(data.traces && data.traces.length > 0, 'No Langfuse traces found');
    
    return data;
  } catch (error) {
    console.error('❌ Langfuse trace test failed:', error.message);
    throw error;
  }
}

// Main test runner
async function runSmokeTests() {
  console.log('🚀 Starting Observability Smoke Tests');
  console.log('━'.repeat(50));
  
  const testResults = {
    passed: 0,
    failed: 0,
    tests: []
  };
  
  const tests = [
    { name: 'WebSocket Connection', fn: testWebSocketConnection },
    { name: 'Launch Operation', fn: testLaunchOperation },
    { name: 'WebSocket Broadcast', fn: testWebSocketBroadcast }
  ];
  
  let launchResult = null;
  let testSwarmId = null;
  
  for (const test of tests) {
    console.log(`\n📋 Running: ${test.name}`);
    console.log('─'.repeat(40));
    
    try {
      const startTime = Date.now();
      const result = await test.fn();
      const duration = Date.now() - startTime;
      
      // Store launch result for subsequent tests
      if (test.name === 'Launch Operation') {
        launchResult = result;
        testSwarmId = result.appName.replace('test-app-', '');
      }
      
      testResults.tests.push({
        name: test.name,
        status: 'passed',
        duration: duration,
        result: result
      });
      testResults.passed++;
      
      console.log(`✅ ${test.name} passed (${duration}ms)`);
    } catch (error) {
      testResults.tests.push({
        name: test.name,
        status: 'failed',
        error: error.message
      });
      testResults.failed++;
      
      console.error(`❌ ${test.name} failed:`, error.message);
    }
  }
  
  // Run additional tests if launch was successful
  if (launchResult) {
    const additionalTests = [
      { 
        name: 'Health Check', 
        fn: () => testHealthCheck(launchResult.appName, launchResult.machineId) 
      },
      { 
        name: 'Scale Operation', 
        fn: () => testScaleOperation(launchResult.appName, 2) 
      },
      { 
        name: 'Observability Integration', 
        fn: () => testObservabilityIntegration(testSwarmId, launchResult.correlationId) 
      },
      { 
        name: 'TrustGraph Nodes', 
        fn: () => testTrustGraphNodes(testSwarmId) 
      },
      { 
        name: 'Langfuse Traces', 
        fn: () => testLangfuseTraces(launchResult.correlationId) 
      }
    ];
    
    for (const test of additionalTests) {
      console.log(`\n📋 Running: ${test.name}`);
      console.log('─'.repeat(40));
      
      try {
        const startTime = Date.now();
        const result = await test.fn();
        const duration = Date.now() - startTime;
        
        testResults.tests.push({
          name: test.name,
          status: 'passed',
          duration: duration,
          result: result
        });
        testResults.passed++;
        
        console.log(`✅ ${test.name} passed (${duration}ms)`);
      } catch (error) {
        testResults.tests.push({
          name: test.name,
          status: 'failed',
          error: error.message
        });
        testResults.failed++;
        
        console.error(`❌ ${test.name} failed:`, error.message);
      }
    }
    
    // Cleanup: Delete test app
    try {
      console.log(`\n🧹 Cleaning up test app: ${launchResult.appName}`);
      const deleteResponse = await fetch(`${config.apiUrl}/api/fly/apps/${launchResult.appName}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${config.flyApiToken}`
        }
      });
      
      if (deleteResponse.ok) {
        console.log('✅ Test app cleaned up successfully');
      } else {
        console.warn('⚠️  Failed to clean up test app');
      }
    } catch (error) {
      console.error('❌ Cleanup failed:', error.message);
    }
  }
  
  // Print summary
  console.log('\n' + '━'.repeat(50));
  console.log('📊 Test Summary');
  console.log('━'.repeat(50));
  console.log(`Total Tests: ${testResults.tests.length}`);
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`Success Rate: ${((testResults.passed / testResults.tests.length) * 100).toFixed(1)}%`);
  
  // Print detailed results
  console.log('\n📋 Detailed Results:');
  testResults.tests.forEach(test => {
    const icon = test.status === 'passed' ? '✅' : '❌';
    const details = test.duration ? `(${test.duration}ms)` : `(${test.error})`;
    console.log(`  ${icon} ${test.name} ${details}`);
  });
  
  // Generate Langfuse trace URL if available
  if (launchResult && launchResult.correlationId) {
    const langfuseProjectId = process.env.LANGFUSE_PROJECT_ID || 'default';
    const langfuseUrl = `https://cloud.langfuse.com/project/${langfuseProjectId}/traces?search=${launchResult.correlationId}`;
    console.log(`\n🔗 Langfuse Traces: ${langfuseUrl}`);
  }
  
  // Print observability tips
  console.log('\n💡 Observability Tips:');
  console.log('  • Check Langfuse for detailed API call traces and token usage');
  console.log('  • View TrustGraph visualization for request flow analysis');
  console.log('  • Monitor Supabase real-time connections for state synchronization');
  console.log('  • Review WebSocket broadcast nodes for event propagation tracking');
  
  // Exit with appropriate code
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});

// Run tests
runSmokeTests().catch(error => {
  console.error('❌ Test runner failed:', error);
  process.exit(1);
});