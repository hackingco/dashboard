#!/usr/bin/env node

/**
 * Simple Langfuse Trace Test - No external dependencies
 */

const { Langfuse } = require('langfuse');

console.log('🔥 SIMPLE LANGFUSE TRACE TEST');
console.log('═══════════════════════════════');
console.log(`Time: ${new Date().toISOString()}`);
console.log('');

// Initialize Langfuse client
console.log('🔧 Initializing Langfuse client...');
const client = new Langfuse({
  publicKey: 'pk-lf-62853aa9-4049-4312-9042-fcd7bcf6fe20',
  secretKey: 'sk-lf-d362f0f3-4a00-410e-b3a8-c29e055c2c60',
  baseUrl: 'http://langfuse:3000',
  flushAt: 1,
  flushInterval: 500
});

console.log('✅ Client initialized');

// Create multiple distinct traces
async function createTraces() {
  console.log('🚀 Creating multiple trace types...');
  
  const timestamp = Date.now();
  const traces = [];
  
  // Trace 1: Basic coordination trace
  console.log('   Creating coordination trace...');
  const trace1 = client.trace({
    id: `swarm-coord-${timestamp}`,
    name: 'Swarm Coordination Test',
    input: { 
      coordinatorUrl: 'http://localhost:8000',
      langfuseUrl: 'http://localhost:3000',
      testType: 'coordination'
    },
    output: { 
      status: 'active',
      tracesGenerated: true,
      shouldBeVisible: 'YES'
    },
    metadata: {
      swarmId: 'docker-swarm-1',
      container: 'swarm-coordinator',
      port: 8000,
      timestamp: new Date().toISOString()
    }
  });
  traces.push(trace1.id);
  
  // Trace 2: Agent operation trace with spans
  console.log('   Creating agent operation trace...');
  const trace2 = client.trace({
    id: `agent-ops-${timestamp}`,
    name: 'Agent Operations Test',
    input: {
      operation: 'multi_agent_coordination',
      agentCount: 8,
      taskType: 'langfuse_verification'
    },
    metadata: {
      agentTypes: ['researcher', 'coder', 'analyst', 'architect'],
      network: 'swarm-network',
      testRun: true
    }
  });
  traces.push(trace2.id);
  
  // Add spans to agent trace
  const span1 = trace2.span({
    name: 'Agent Registration Phase',
    input: { phase: 'registration', expectedAgents: 8 },
    output: { registeredAgents: 8, success: true }
  });
  
  const span2 = trace2.span({
    name: 'Task Distribution Phase', 
    input: { tasks: ['research', 'coding', 'analysis'], priority: 'high' },
    output: { distributed: true, tracingActive: true }
  });
  
  span1.end();
  span2.end();
  
  // Trace 3: Generation trace
  console.log('   Creating generation trace...');
  const generation = client.generation({
    id: `swarm-gen-${timestamp}`,
    name: 'Swarm Intelligence Generation',
    input: {
      prompt: 'Generate swarm coordination strategy for distributed task execution',
      context: 'Docker container environment with 8 specialized agents'
    },
    output: {
      strategy: 'Hierarchical coordination with mesh fallback',
      confidence: 0.94,
      visible: 'This trace should be visible in Langfuse dashboard'
    },
    model: 'claude-3-sonnet',
    usage: {
      input: 234,
      output: 156,
      total: 390
    },
    metadata: {
      swarmType: 'docker-containerized',
      coordinatorPort: 8000,
      langfusePort: 3000
    }
  });
  traces.push(generation.id);
  
  console.log(`✅ Created ${traces.length} traces`);
  return traces;
}

// Main execution
async function runTest() {
  try {
    const traceIds = await createTraces();
    
    console.log('💾 Flushing traces to Langfuse...');
    await client.flushAsync();
    console.log('✅ Flush completed');
    
    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('');
    console.log('🎯 TRACE VERIFICATION');
    console.log('═══════════════════════');
    console.log('Check your Langfuse dashboard: http://localhost:3000');
    console.log('');
    console.log('Expected traces:');
    traceIds.forEach((id, index) => {
      console.log(`   ${index + 1}. ${id}`);
    });
    console.log('');
    console.log('Trace names to look for:');
    console.log('   - "Swarm Coordination Test"');
    console.log('   - "Agent Operations Test" (with 2 spans)');
    console.log('   - "Swarm Intelligence Generation"');
    console.log('');
    console.log('✅ Test completed - Please confirm traces are visible!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

runTest();