#!/usr/bin/env node

/**
 * Real-Time Dashboard Testing Script
 * Creates continuous traces to prove dashboard functionality
 */

const { Langfuse } = require('langfuse');
const axios = require('axios');

// Configuration
const config = {
  langfuseHost: 'http://localhost:3000',
  langfusePublicKey: 'pk-lf-REDACTED',
  langfuseSecretKey: 'sk-lf-d362f0f3-4a00-410e-b3a8-c29e055c2c60',
  dashboardUrl: 'http://localhost:3004',
  backendUrl: 'http://localhost:3002'
};

console.log('🔥 REAL-TIME DASHBOARD TESTING STARTED');
console.log('═══════════════════════════════════════');
console.log(`📊 Dashboard: ${config.dashboardUrl}`);
console.log(`🖥️  Backend: ${config.backendUrl}`);
console.log(`🔗 Langfuse: ${config.langfuseHost}`);
console.log('');

// Initialize Langfuse client
const langfuseClient = new Langfuse({
  publicKey: config.langfusePublicKey,
  secretKey: config.langfuseSecretKey,
  baseUrl: config.langfuseHost,
  flushAt: 1,
  flushInterval: 500
});

let testCounter = 0;
let successfulTraces = 0;
let failedTraces = 0;

async function createTestTrace(testName, testData) {
  try {
    const timestamp = Date.now();
    const traceId = `real-time-test-${timestamp}-${testCounter++}`;
    
    console.log(`🧪 Creating trace: ${traceId}`);
    
    const trace = langfuseClient.trace({
      id: traceId,
      name: testName,
      input: {
        ...testData,
        timestamp: new Date().toISOString(),
        testNumber: testCounter,
        dashboardActive: true
      },
      output: {
        status: 'success',
        visible: true,
        dashboardTest: true,
        realTimeMonitoring: true
      },
      metadata: {
        source: 'real-time-dashboard-test',
        testType: 'continuous_monitoring',
        dashboard: config.dashboardUrl,
        backend: config.backendUrl,
        timestamp: new Date().toISOString()
      }
    });

    // Add some spans to make traces more interesting
    const span1 = trace.span({
      name: 'Dashboard Test Operation',
      input: { operation: 'test_dashboard_connectivity' },
      output: { connected: true, responseTime: Math.floor(Math.random() * 100) + 50 }
    });
    span1.end();

    const span2 = trace.span({
      name: 'Real-Time Data Update',
      input: { updateType: 'live_trace_data' },
      output: { updated: true, recordsAffected: Math.floor(Math.random() * 10) + 1 }
    });
    span2.end();

    // End the trace
    trace.end();
    
    // Flush to ensure immediate delivery
    await langfuseClient.flushAsync();
    
    successfulTraces++;
    console.log(`✅ Trace created successfully: ${traceId}`);
    return traceId;
    
  } catch (error) {
    failedTraces++;
    console.error(`❌ Failed to create trace:`, error.message);
    return null;
  }
}

async function testDashboardConnectivity() {
  try {
    console.log('🔍 Testing dashboard connectivity...');
    
    // Test backend health
    const healthResponse = await axios.get(`${config.backendUrl}/api/health`, { timeout: 5000 });
    console.log(`✅ Backend health: ${healthResponse.data.status}`);
    
    // Test traces endpoint
    const tracesResponse = await axios.get(`${config.backendUrl}/api/traces`, { timeout: 10000 });
    console.log(`✅ Traces endpoint: ${tracesResponse.data.traces?.length || 0} traces found`);
    
    // Test analytics endpoint
    const analyticsResponse = await axios.get(`${config.backendUrl}/api/analytics`, { timeout: 10000 });
    console.log(`✅ Analytics endpoint: ${analyticsResponse.data.totalTraces} total traces`);
    
    return true;
  } catch (error) {
    console.error(`❌ Dashboard connectivity test failed:`, error.message);
    return false;
  }
}

async function checkLangfuseVisibility() {
  try {
    console.log('👀 Checking Langfuse visibility...');
    
    // Use Langfuse API directly to check traces
    const response = await axios.get(`${config.langfuseHost}/api/public/traces`, {
      headers: {
        'Authorization': `Bearer ${config.langfuseSecretKey}`,
        'Content-Type': 'application/json'
      },
      params: { limit: 10 },
      timeout: 10000
    });
    
    const traces = response.data.data || [];
    const recentTraces = traces.filter(t => t.name && t.name.includes('real-time-test'));
    
    console.log(`✅ Langfuse API: ${traces.length} total traces, ${recentTraces.length} test traces`);
    
    if (recentTraces.length > 0) {
      console.log(`🎯 Latest test trace: ${recentTraces[0].id} (${recentTraces[0].name})`);
      console.log(`🌐 View in Langfuse: ${config.langfuseHost}/traces/${recentTraces[0].id}`);
    }
    
    return recentTraces.length > 0;
  } catch (error) {
    console.error(`❌ Langfuse visibility check failed:`, error.message);
    return false;
  }
}

async function runContinuousTest() {
  console.log('🔄 Starting continuous testing...');
  
  const testScenarios = [
    { name: 'Dashboard Real-Time Test', data: { scenario: 'real_time_monitoring', priority: 'high' } },
    { name: 'Agent Coordination Test', data: { scenario: 'agent_coordination', agents: 4 } },
    { name: 'Performance Monitoring Test', data: { scenario: 'performance_test', metrics: true } },
    { name: 'Trace Analytics Test', data: { scenario: 'analytics_test', charts: true } },
    { name: 'Live Updates Test', data: { scenario: 'live_updates', websocket: true } }
  ];
  
  let testCount = 0;
  const maxTests = 20; // Run 20 tests
  
  while (testCount < maxTests) {
    try {
      // Pick a random test scenario
      const scenario = testScenarios[Math.floor(Math.random() * testScenarios.length)];
      
      // Create test trace
      const traceId = await createTestTrace(scenario.name, scenario.data);
      
      if (traceId) {
        // Check dashboard connectivity periodically
        if (testCount % 5 === 0) {
          await testDashboardConnectivity();
          await checkLangfuseVisibility();
        }
        
        console.log(`📊 Progress: ${testCount + 1}/${maxTests} tests completed`);
        console.log(`✅ Success: ${successfulTraces}, ❌ Failed: ${failedTraces}`);
        console.log('');
      }
      
      testCount++;
      
      // Wait before next test (2-5 seconds)
      const waitTime = Math.floor(Math.random() * 3000) + 2000;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
    } catch (error) {
      console.error(`❌ Test iteration ${testCount} failed:`, error.message);
      testCount++;
    }
  }
  
  // Final verification
  console.log('🏁 TESTING COMPLETED');
  console.log('═══════════════════════════════════════');
  console.log(`✅ Successful traces: ${successfulTraces}`);
  console.log(`❌ Failed traces: ${failedTraces}`);
  console.log(`📊 Success rate: ${Math.round((successfulTraces / (successfulTraces + failedTraces)) * 100)}%`);
  console.log('');
  
  // Final dashboard check
  console.log('🔍 Final verification...');
  await testDashboardConnectivity();
  const hasVisibleTraces = await checkLangfuseVisibility();
  
  if (hasVisibleTraces) {
    console.log('🎉 SUCCESS: Traces are visible in Langfuse!');
    console.log(`🌐 Open dashboard: ${config.dashboardUrl}`);
    console.log(`🔗 Open Langfuse: ${config.langfuseHost}`);
  } else {
    console.log('⚠️ WARNING: No test traces found in Langfuse');
  }
}

// Start the test
runContinuousTest().catch(error => {
  console.error('🚨 CRITICAL ERROR:', error);
  process.exit(1);
});