#!/usr/bin/env node

/**
 * FINAL TRACE VERIFICATION TEST
 * Creates highly distinctive traces that MUST be visible
 */

const { Langfuse } = require('langfuse');

console.log('🎯 FINAL LANGFUSE TRACE VERIFICATION');
console.log('═══════════════════════════════════════');
console.log(`Timestamp: ${new Date().toISOString()}`);
console.log('Coordinator Port: 8000');
console.log('Langfuse Port: 3000');
console.log('');

const client = new Langfuse({
  publicKey: 'pk-lf-62853aa9-4049-4312-9042-fcd7bcf6fe20',
  secretKey: 'sk-lf-d362f0f3-4a00-410e-b3a8-c29e055c2c60',
  baseUrl: 'http://langfuse:3000',
  flushAt: 1,
  flushInterval: 100
});

async function createDistinctiveTraces() {
  const timestamp = Date.now();
  console.log('🔥 Creating HIGHLY DISTINCTIVE traces...');
  
  // Trace 1: URGENT TEST with current timestamp
  const trace1 = client.trace({
    id: `URGENT-VISIBILITY-TEST-${timestamp}`,
    name: 'URGENT: LANGFUSE VISIBILITY TEST',
    input: { 
      message: 'THIS TRACE MUST BE VISIBLE IN DASHBOARD',
      user: 'swarm-coordinator',
      urgency: 'CRITICAL',
      timestamp: new Date().toISOString()
    },
    output: { 
      result: 'TRACE CREATED SUCCESSFULLY',
      visibility: 'SHOULD BE VISIBLE NOW',
      port_8000: true,
      langfuse_port_3000: true
    },
    metadata: {
      TEST_TYPE: 'FINAL_VERIFICATION',
      CONTAINER: 'swarm-coordinator',
      COORDINATOR_PORT: 8000,
      LANGFUSE_PORT: 3000,
      EXTREMELY_VISIBLE: true
    },
    tags: ['URGENT', 'VISIBILITY_TEST', 'MUST_SEE']
  });
  
  // Trace 2: Sequential operations with clear naming
  const trace2 = client.trace({
    id: `SWARM-OPERATIONS-${timestamp}`,
    name: 'Docker Swarm Operations Trace',
    input: {
      coordinator_status: 'ACTIVE',
      langfuse_enabled: true,
      trace_test: 'FINAL_VERIFICATION'
    },
    metadata: {
      swarm_id: 'docker-swarm-1',
      agents_count: 8,
      test_sequence: 'FINAL'
    }
  });
  
  // Add very clear spans
  const registration = trace2.span({
    name: 'Agent Registration Verification',
    input: { agents: ['researcher', 'coder', 'analyst', 'architect'] },
    output: { all_registered: true, traces_active: true }
  });
  
  const coordination = trace2.span({
    name: 'Coordination Protocol Test',
    input: { protocol: 'langfuse_tracing', status: 'testing' },
    output: { 
      protocol_active: true, 
      traces_visible: 'SHOULD_BE_YES',
      check_dashboard: 'http://localhost:3000'
    }
  });
  
  registration.end();
  coordination.end();
  
  // Trace 3: High-value generation
  const generation = client.generation({
    id: `GENERATION-VISIBILITY-${timestamp}`,
    name: 'CRITICAL: Swarm Intelligence Generation',
    input: {
      prompt: 'URGENT: Verify Langfuse trace visibility in dashboard',
      context: 'Final verification test for Docker swarm Langfuse integration'
    },
    output: {
      response: 'TRACES HAVE BEEN CREATED AND FLUSHED TO LANGFUSE',
      recommendation: 'CHECK DASHBOARD AT http://localhost:3000 NOW',
      status: 'VERIFICATION_COMPLETE'
    },
    model: 'claude-3-sonnet',
    usage: {
      input: 89,
      output: 156,
      total: 245
    },
    metadata: {
      PRIORITY: 'URGENT',
      TEST_TYPE: 'FINAL_VERIFICATION',
      VISIBILITY: 'MUST_BE_VISIBLE'
    }
  });
  
  console.log('✅ Created 3 DISTINCTIVE traces:');
  console.log(`   1. ${trace1.id}`);
  console.log(`   2. ${trace2.id}`);
  console.log(`   3. ${generation.id}`);
  
  return [trace1.id, trace2.id, generation.id];
}

async function runFinalTest() {
  try {
    const traceIds = await createDistinctiveTraces();
    
    console.log('');
    console.log('💾 FLUSHING TRACES TO LANGFUSE...');
    await client.flushAsync();
    console.log('✅ ALL TRACES FLUSHED SUCCESSFULLY');
    
    // Wait for processing
    console.log('⏳ Waiting for trace processing...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('');
    console.log('🚨 FINAL VERIFICATION CHECKLIST');
    console.log('═══════════════════════════════════');
    console.log('IMMEDIATELY CHECK: http://localhost:3000');
    console.log('');
    console.log('YOU MUST SEE THESE TRACES:');
    traceIds.forEach((id, index) => {
      console.log(`   ${index + 1}. ${id}`);
    });
    console.log('');
    console.log('EXPECTED TRACE NAMES:');
    console.log('   - "URGENT: LANGFUSE VISIBILITY TEST"');
    console.log('   - "Docker Swarm Operations Trace" (with 2 spans)');
    console.log('   - "CRITICAL: Swarm Intelligence Generation"');
    console.log('');
    console.log('🔍 SEARCH TIPS:');
    console.log('   - Look for traces with "URGENT" in the name');
    console.log('   - Check the "Generations" tab for the generation trace');
    console.log('   - Sort by newest first');
    console.log('   - Look for tags: URGENT, VISIBILITY_TEST, MUST_SEE');
    console.log('');
    console.log('⚠️  IF YOU STILL DON\'T SEE TRACES:');
    console.log('   - The API keys may be invalid');
    console.log('   - The Langfuse instance may not be accepting data');
    console.log('   - There may be a network routing issue');
    console.log('');
    console.log('✅ FINAL TEST COMPLETED');
    
  } catch (error) {
    console.error('❌ FINAL TEST FAILED:', error);
    process.exit(1);
  }
}

runFinalTest();