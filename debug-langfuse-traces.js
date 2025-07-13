#!/usr/bin/env node

/**
 * Comprehensive Langfuse Debug and Trace Creation
 * Tests all aspects of the connection and creates multiple visible traces
 */

const { Langfuse } = require('langfuse');

console.log('🔍 COMPREHENSIVE LANGFUSE DEBUG TEST');
console.log('═══════════════════════════════════════');
console.log(`Time: ${new Date().toISOString()}`);
console.log('');

// Test 1: Basic connectivity
console.log('📡 Step 1: Testing basic connectivity...');
const fetch = require('node-fetch');

async function testConnectivity() {
  try {
    const response = await fetch('http://langfuse:3000/api/public/health');
    const data = await response.json();
    console.log(`✅ Langfuse health: ${data.status} (v${data.version})`);
    return true;
  } catch (error) {
    console.log(`❌ Connectivity failed: ${error.message}`);
    return false;
  }
}

// Test 2: Initialize Langfuse client with debug
console.log('🔧 Step 2: Initializing Langfuse client...');

const client = new Langfuse({
  publicKey: 'pk-lf-62853aa9-4049-4312-9042-fcd7bcf6fe20',
  secretKey: 'sk-lf-d362f0f3-4a00-410e-b3a8-c29e055c2c60',
  baseUrl: 'http://langfuse:3000',
  flushAt: 1,
  flushInterval: 500,
  debug: true
});

console.log('✅ Langfuse client initialized');

// Test 3: Create multiple trace types
async function createComprehensiveTraces() {
  console.log('🚀 Step 3: Creating comprehensive traces...');
  
  const traces = [];
  
  // Trace 1: Simple trace
  console.log('Creating simple trace...');
  const trace1 = client.trace({
    id: `debug-simple-${Date.now()}`,
    name: 'Simple Debug Trace',
    input: { test: 'simple' },
    output: { result: 'success' },
    metadata: {
      type: 'debug',
      container: 'swarm-coordinator',
      timestamp: new Date().toISOString()
    }
  });
  traces.push(trace1.id);
  
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Trace 2: Complex trace with spans
  console.log('Creating complex trace with spans...');
  const trace2 = client.trace({
    id: `debug-complex-${Date.now()}`,
    name: 'Complex Swarm Operation',
    input: { 
      operation: 'swarm_coordination',
      agents: ['researcher', 'coder', 'analyst'],
      priority: 'high'
    },
    metadata: {
      type: 'swarm_operation',
      container: 'swarm-coordinator',
      network: 'swarm-network'
    }
  });
  traces.push(trace2.id);
  
  // Add spans to complex trace
  const span1 = trace2.span({
    name: 'Agent Registration',
    input: { agent_type: 'researcher' },
    output: { status: 'registered', agent_id: 'researcher-001' }
  });
  
  const span2 = trace2.span({
    name: 'Task Assignment',
    input: { task: 'analyze_patterns', priority: 'high' },
    output: { 
      status: 'assigned', 
      estimated_duration: 5000,
      trace_visible: true
    }
  });
  
  span1.end();
  span2.end();
  
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Trace 3: Generation with explicit tokens
  console.log('Creating generation trace...');
  const generation = client.generation({
    id: `debug-generation-${Date.now()}`,
    name: 'Swarm Decision Generation',
    input: {
      prompt: 'Analyze swarm coordination patterns and recommend optimizations',
      system: 'You are a swarm intelligence coordinator'
    },
    output: {
      response: 'Based on current patterns, recommend increasing agent parallelism by 23%',
      reasoning: 'Analysis shows coordination bottlenecks at task distribution phase'
    },
    model: 'claude-3-sonnet',
    usage: {
      input: 156,
      output: 89,
      total: 245
    },
    metadata: {
      container: 'swarm-coordinator',
      agent_type: 'coordinator',
      optimization_context: true
    }
  });
  traces.push(generation.id);
  
  console.log(`✅ Created ${traces.length} traces:`);
  traces.forEach((id, index) => {
    console.log(`   ${index + 1}. ${id}`);
  });
  
  return traces;
}

// Test 4: Force flush and verify
async function flushAndVerify(traceIds) {
  console.log('💾 Step 4: Flushing traces to Langfuse...');
  
  try {
    await client.flushAsync();
    console.log('✅ All traces flushed successfully');
    
    // Wait a moment for processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('');
    console.log('🎯 VERIFICATION CHECKLIST:');
    console.log('═══════════════════════════');
    console.log('Check your Langfuse dashboard at: http://localhost:3000');
    console.log('');
    console.log('You should see:');
    traceIds.forEach((id, index) => {
      console.log(`   ${index + 1}. Trace ID: ${id}`);
    });
    console.log('');
    console.log('Expected trace names:');
    console.log('   - "Simple Debug Trace"');
    console.log('   - "Complex Swarm Operation" (with 2 spans)');
    console.log('   - "Swarm Decision Generation"');
    console.log('');
    console.log('If you still don\'t see traces, there may be an authentication issue.');
    
  } catch (error) {
    console.log(`❌ Flush failed: ${error.message}`);
    throw error;
  }
}

// Run the comprehensive test
async function runTest() {
  try {
    const connected = await testConnectivity();
    if (!connected) {
      throw new Error('Basic connectivity failed');
    }
    
    const traceIds = await createComprehensiveTraces();
    await flushAndVerify(traceIds);
    
    console.log('✅ Comprehensive test completed successfully');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

runTest();