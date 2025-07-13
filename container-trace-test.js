#!/usr/bin/env node

/**
 * Test script to run inside coordinator container
 * Creates traces using the internal Langfuse client
 */

const { Langfuse } = require('langfuse');

console.log('🔥 CONTAINER TRACE TEST');
console.log('═══════════════════════');

// Initialize Langfuse client with container network
const client = new Langfuse({
  publicKey: 'pk-lf-62853aa9-4049-4312-9042-fcd7bcf6fe20',
  secretKey: 'sk-lf-d362f0f3-4a00-410e-b3a8-c29e055c2c60',
  baseUrl: 'http://langfuse:3000',
  flushAt: 1,
  flushInterval: 1000
});

console.log('Creating trace with proper credentials...');

// Create a trace
const trace = client.trace({
  id: `container-test-${Date.now()}`,
  name: 'Docker Swarm Container Test',
  metadata: {
    source: 'swarm-coordinator-container',
    network: 'internal',
    timestamp: new Date().toISOString()
  },
  input: {
    test: 'container-langfuse-integration',
    credentials: 'verified'
  }
});

console.log(`Trace created: ${trace.id}`);

// Create a span
const span = trace.span({
  name: 'Agent Coordination Test',
  input: {
    agents: ['researcher', 'coder', 'analyst'],
    task: 'verify-langfuse-tracing'
  },
  metadata: {
    container: 'swarm-coordinator',
    network: 'swarm-network'
  }
});

span.end({
  output: {
    status: 'success',
    traces_created: true,
    visible_in_dashboard: 'should be true'
  }
});

// Flush immediately
client.flushAsync().then(() => {
  console.log('✅ Traces flushed to Langfuse');
  console.log('Check your dashboard at http://localhost:3000');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Flush failed:', error);
  process.exit(1);
});