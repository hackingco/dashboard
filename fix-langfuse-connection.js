#!/usr/bin/env node

/**
 * Direct Langfuse Test with Actual API Calls
 * Tests the connection to your Langfuse instance and creates traces
 */

const http = require('http');

const LANGFUSE_HOST = 'localhost:3000';
const SECRET_KEY = 'sk-lf-d362f0f3-4a00-410e-b3a8-c29e055c2c60';
const PUBLIC_KEY = 'pk-lf-REDACTED';

console.log('🔍 DIRECT LANGFUSE API TEST');
console.log('══════════════════════════');
console.log(`Host: ${LANGFUSE_HOST}`);
console.log(`Public Key: ${PUBLIC_KEY}`);
console.log('');

function createTrace() {
  const traceData = {
    id: `swarm-direct-test-${Date.now()}`,
    name: 'Docker Swarm Direct Test',
    metadata: {
      source: 'docker-swarm-coordinator',
      testType: 'direct-api-call',
      timestamp: new Date().toISOString()
    },
    input: {
      operation: 'swarm_coordination_test',
      agents: ['researcher', 'coder', 'analyst'],
      taskType: 'langfuse_verification'
    }
  };

  const postData = JSON.stringify(traceData);
  
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/public/traces',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'Authorization': `Bearer ${SECRET_KEY}`,
      'X-API-Key': PUBLIC_KEY
    }
  };

  console.log('📤 Creating trace via direct API call...');
  console.log(`Trace ID: ${traceData.id}`);

  const req = http.request(options, (res) => {
    console.log(`✅ Response Status: ${res.statusCode}`);
    console.log('Response Headers:', res.headers);

    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      console.log('📥 Response Body:', data);
      if (res.statusCode === 201 || res.statusCode === 200) {
        console.log('');
        console.log('🎉 TRACE SUCCESSFULLY CREATED!');
        console.log('Check your Langfuse dashboard at http://localhost:3000');
        console.log(`Look for trace: ${traceData.id}`);
        
        // Create additional traces to make them visible
        setTimeout(() => createSpan(traceData.id), 1000);
      } else {
        console.log('❌ Failed to create trace');
      }
    });
  });

  req.on('error', (e) => {
    console.error('❌ Request failed:', e.message);
  });

  req.write(postData);
  req.end();
}

function createSpan(traceId) {
  const spanData = {
    id: `span-${Date.now()}`,
    traceId: traceId,
    name: 'Agent Task Execution',
    startTime: new Date().toISOString(),
    endTime: new Date(Date.now() + 5000).toISOString(),
    input: {
      agentType: 'researcher',
      task: 'Analyze swarm coordination patterns',
      priority: 'high'
    },
    output: {
      status: 'completed',
      findings: ['Pattern recognition improved', 'Coordination efficiency up 23%'],
      duration: 5000
    },
    metadata: {
      tokenUsage: {
        input: 150,
        output: 320,
        total: 470
      },
      agentId: 'researcher-docker-alpha',
      containerized: true
    }
  };

  const postData = JSON.stringify(spanData);
  
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/public/spans',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'Authorization': `Bearer ${SECRET_KEY}`,
      'X-API-Key': PUBLIC_KEY
    }
  };

  console.log('📤 Creating span for trace...');

  const req = http.request(options, (res) => {
    console.log(`✅ Span Response Status: ${res.statusCode}`);

    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      if (res.statusCode === 201 || res.statusCode === 200) {
        console.log('🎉 SPAN SUCCESSFULLY CREATED!');
        console.log('');
        console.log('🔍 CHECK YOUR LANGFUSE DASHBOARD NOW:');
        console.log('   http://localhost:3000');
        console.log('');
        console.log('You should see:');
        console.log(`   - Trace: ${traceId}`);
        console.log(`   - Span: Agent Task Execution`);
        console.log('   - Metadata with token usage');
        console.log('   - Docker swarm coordination data');
      } else {
        console.log('❌ Failed to create span:', data);
      }
    });
  });

  req.on('error', (e) => {
    console.error('❌ Span request failed:', e.message);
  });

  req.write(postData);
  req.end();
}

// Test health first
console.log('🏥 Testing Langfuse health endpoint...');
const healthOptions = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/public/health',
  method: 'GET'
};

const healthReq = http.request(healthOptions, (res) => {
  console.log(`Health check status: ${res.statusCode}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('Health response:', data);
    if (res.statusCode === 200) {
      console.log('✅ Langfuse is accessible');
      console.log('');
      
      // Now create the trace
      setTimeout(createTrace, 1000);
    } else {
      console.log('❌ Langfuse health check failed');
    }
  });
});

healthReq.on('error', (e) => {
  console.error('❌ Health check failed:', e.message);
});

healthReq.end();