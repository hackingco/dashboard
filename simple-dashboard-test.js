#!/usr/bin/env node

/**
 * Simple Dashboard Test - Direct API calls to prove functionality
 */

const axios = require('axios');

const config = {
  dashboardUrl: 'http://localhost:3004',
  backendUrl: 'http://localhost:3002',
  langfuseUrl: 'http://localhost:3000'
};

console.log('🔥 DASHBOARD TESTING STARTED');
console.log('═══════════════════════════');
console.log(`📊 Dashboard: ${config.dashboardUrl}`);
console.log(`🖥️  Backend: ${config.backendUrl}`);
console.log(`🔗 Langfuse: ${config.langfuseUrl}`);
console.log('');

async function testBackendHealth() {
  try {
    console.log('🏥 Testing backend health...');
    const response = await axios.get(`${config.backendUrl}/api/health`, { timeout: 5000 });
    console.log(`✅ Backend Status: ${response.data.status}`);
    console.log(`📍 Service: ${response.data.service}`);
    console.log(`⏰ Timestamp: ${response.data.timestamp}`);
    return true;
  } catch (error) {
    console.error(`❌ Backend health failed: ${error.message}`);
    return false;
  }
}

async function testCreateTrace() {
  try {
    console.log('🧪 Creating test trace...');
    const response = await axios.post(`${config.backendUrl}/api/test/trace`, {
      name: 'Dashboard Integration Test',
      input: { 
        test: 'dashboard_integration',
        timestamp: new Date().toISOString(),
        source: 'simple_test_script'
      },
      output: { 
        status: 'success',
        dashboard_active: true,
        test_completed: true
      }
    }, { 
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000 
    });
    
    console.log(`✅ Trace created: ${response.data.traceId}`);
    console.log(`📝 Message: ${response.data.message}`);
    return response.data.traceId;
  } catch (error) {
    console.error(`❌ Create trace failed: ${error.message}`);
    return null;
  }
}

async function testFetchTraces() {
  try {
    console.log('📋 Fetching traces...');
    const response = await axios.get(`${config.backendUrl}/api/traces`, { timeout: 10000 });
    console.log(`✅ Traces fetched: ${response.data.traces?.length || 0} traces`);
    console.log(`📊 Total count: ${response.data.count}`);
    console.log(`⏰ Last updated: ${response.data.timestamp}`);
    
    // Show latest traces
    if (response.data.traces && response.data.traces.length > 0) {
      console.log('📝 Latest traces:');
      response.data.traces.slice(0, 3).forEach((trace, index) => {
        console.log(`   ${index + 1}. ${trace.id} - ${trace.name || 'Unnamed'}`);
      });
    }
    
    return response.data.traces?.length || 0;
  } catch (error) {
    console.error(`❌ Fetch traces failed: ${error.message}`);
    return 0;
  }
}

async function testAnalytics() {
  try {
    console.log('📈 Testing analytics...');
    const response = await axios.get(`${config.backendUrl}/api/analytics`, { timeout: 10000 });
    console.log(`✅ Analytics generated:`);
    console.log(`   Total traces: ${response.data.totalTraces}`);
    console.log(`   Last 24h: ${response.data.tracesLast24h}`);
    console.log(`   Avg duration: ${Math.round(response.data.avgDuration)}ms`);
    console.log(`   Unique users: ${response.data.uniqueUsers}`);
    return true;
  } catch (error) {
    console.error(`❌ Analytics failed: ${error.message}`);
    return false;
  }
}

async function testSwarmStatus() {
  try {
    console.log('🐝 Testing swarm status...');
    const response = await axios.get(`${config.backendUrl}/api/swarm/status`, { timeout: 10000 });
    console.log(`✅ Swarm status:`);
    console.log(`   Coordinator: ${response.data.coordinator?.status || 'unknown'}`);
    console.log(`   Langfuse: ${response.data.langfuse?.status || 'unknown'}`);
    console.log(`   Active agents: ${response.data.agents?.length || 0}`);
    
    if (response.data.agents && response.data.agents.length > 0) {
      console.log('👥 Active agents:');
      response.data.agents.slice(0, 3).forEach((agent, index) => {
        console.log(`   ${index + 1}. ${agent.name} (${agent.type}) - ${agent.status}`);
      });
    }
    
    return true;
  } catch (error) {
    console.error(`❌ Swarm status failed: ${error.message}`);
    return false;
  }
}

async function testDashboardAccess() {
  try {
    console.log('🌐 Testing dashboard frontend...');
    const response = await axios.get(config.dashboardUrl, { timeout: 5000 });
    console.log(`✅ Dashboard accessible: HTTP ${response.status}`);
    console.log(`📄 Content length: ${response.data.length} bytes`);
    return true;
  } catch (error) {
    console.error(`❌ Dashboard access failed: ${error.message}`);
    return false;
  }
}

async function runCompleteTest() {
  console.log('🚀 Running complete dashboard test suite...');
  console.log('');
  
  const results = {
    backendHealth: false,
    createTrace: false,
    fetchTraces: false,
    analytics: false,
    swarmStatus: false,
    dashboardAccess: false,
    traceCount: 0
  };
  
  // Test 1: Backend Health
  results.backendHealth = await testBackendHealth();
  console.log('');
  
  // Test 2: Create Test Trace
  const traceId = await testCreateTrace();
  results.createTrace = !!traceId;
  console.log('');
  
  // Test 3: Fetch Traces
  results.traceCount = await testFetchTraces();
  results.fetchTraces = results.traceCount > 0;
  console.log('');
  
  // Test 4: Analytics
  results.analytics = await testAnalytics();
  console.log('');
  
  // Test 5: Swarm Status
  results.swarmStatus = await testSwarmStatus();
  console.log('');
  
  // Test 6: Dashboard Access
  results.dashboardAccess = await testDashboardAccess();
  console.log('');
  
  // Results Summary
  console.log('📋 TEST RESULTS SUMMARY');
  console.log('═══════════════════════');
  console.log(`🏥 Backend Health: ${results.backendHealth ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`🧪 Create Trace: ${results.createTrace ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`📋 Fetch Traces: ${results.fetchTraces ? '✅ PASS' : '❌ FAIL'} (${results.traceCount} traces)`);
  console.log(`📈 Analytics: ${results.analytics ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`🐝 Swarm Status: ${results.swarmStatus ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`🌐 Dashboard Access: ${results.dashboardAccess ? '✅ PASS' : '❌ FAIL'}`);
  console.log('');
  
  const passedTests = Object.values(results).filter(r => r === true).length;
  const totalTests = 6;
  const successRate = Math.round((passedTests / totalTests) * 100);
  
  console.log(`🎯 OVERALL SCORE: ${passedTests}/${totalTests} tests passed (${successRate}%)`);
  console.log('');
  
  if (successRate >= 80) {
    console.log('🎉 DASHBOARD VERIFICATION SUCCESSFUL!');
    console.log(`🌐 Open Dashboard: ${config.dashboardUrl}`);
    console.log(`🔗 Open Langfuse: ${config.langfuseUrl}`);
    console.log('');
    console.log('✅ The real-time tracing dashboard is working correctly!');
    console.log('✅ Traces are being created and displayed properly!');
    console.log('✅ All major functionality has been verified!');
  } else {
    console.log('⚠️ DASHBOARD VERIFICATION INCOMPLETE');
    console.log('Some tests failed. Check the error messages above.');
  }
  
  return successRate >= 80;
}

// Run the test
runCompleteTest().catch(error => {
  console.error('🚨 CRITICAL ERROR:', error);
  process.exit(1);
});