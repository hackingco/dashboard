const WebSocket = require('ws');
const fetch = require('node-fetch');

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:8080';
const WS_URL = process.env.WS_URL || 'ws://localhost:8080/ws';

async function getAuthToken() {
  console.log('🔐 Getting auth token...');
  const response = await fetch(`${API_URL}/api/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'test-user' })
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get token: ${response.status}`);
  }
  
  const data = await response.json();
  console.log('✅ Got auth token');
  return data.token;
}

async function testWebSocket() {
  try {
    // Get JWT token
    const token = await getAuthToken();
    
    // Connect to WebSocket with token
    console.log(`🔌 Connecting to WebSocket at ${WS_URL}...`);
    const ws = new WebSocket(`${WS_URL}?token=${token}`);
    
    ws.on('open', () => {
      console.log('✅ WebSocket connected!');
      
      // Test launch message
      console.log('🚀 Sending launch message...');
      ws.send(JSON.stringify({
        type: 'launch',
        action: 'launch',
        payload: {
          name: 'test-swarm',
          region: 'dfw',
          cpus: 1,
          memory: 256,
          image: 'flyio/hellofly:latest',
          env: {
            TEST_VAR: 'test-value'
          }
        }
      }));
    });
    
    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      console.log('📨 Received:', JSON.stringify(message, null, 2));
      
      // Handle different message types
      switch (message.type) {
        case 'connection':
          console.log('🔗 Connection confirmed');
          break;
        case 'launch':
          if (message.status === 'starting') {
            console.log('⏳ Launch starting...');
          } else if (message.status === 'completed') {
            console.log(`✅ Launch completed! Machine ID: ${message.machineId}`);
            
            // Test status message
            console.log('📊 Sending status request...');
            ws.send(JSON.stringify({
              type: 'status',
              appName: message.appName
            }));
          }
          break;
        case 'machine_update':
          console.log(`🖥️  Machine ${message.machineId} status: ${message.status}`);
          console.log(`   CPU: ${message.cpus}, Memory: ${message.memory}MB`);
          break;
        case 'error':
          console.error(`❌ Error: ${message.error}`);
          break;
      }
    });
    
    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
    });
    
    ws.on('close', () => {
      console.log('🔌 WebSocket disconnected');
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
console.log('🧪 Starting WebSocket test...');
testWebSocket();

// Keep the process alive for 30 seconds to receive messages
setTimeout(() => {
  console.log('⏱️  Test timeout - exiting');
  process.exit(0);
}, 30000);