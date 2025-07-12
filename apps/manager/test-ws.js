#!/usr/bin/env node
/**
 * Simple WebSocket test script to verify the implementation
 */

const WebSocket = require('ws');

async function testWebSocket() {
  try {
    // First get auth token
    console.log('Getting authentication token...');
    const response = await fetch('http://localhost:8080/api/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'test-user' })
    });
    
    if (!response.ok) {
      throw new Error(`Token request failed: ${response.status}`);
    }
    
    const { token } = await response.json();
    console.log('Got token:', token.substring(0, 20) + '...');
    
    // Connect to WebSocket
    console.log('Connecting to WebSocket...');
    const ws = new WebSocket(`ws://localhost:8080/ws?token=${encodeURIComponent(token)}`);
    
    ws.on('open', () => {
      console.log('✅ WebSocket connected successfully!');
      
      // Test scale message
      setTimeout(() => {
        console.log('Sending scale test message...');
        ws.send(JSON.stringify({
          type: 'scale',
          swarmId: 'test-swarm-123',
          count: 5
        }));
      }, 1000);
      
      // Test launch message
      setTimeout(() => {
        console.log('Sending launch test message...');
        ws.send(JSON.stringify({
          type: 'launch',
          swarmConfig: {
            id: 'test-swarm-123',
            name: 'Test Swarm',
            region: 'dfw'
          }
        }));
      }, 2000);
    });
    
    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      console.log('📨 Received:', message);
    });
    
    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
    });
    
    ws.on('close', () => {
      console.log('🔌 WebSocket closed');
      process.exit(0);
    });
    
    // Close after 10 seconds
    setTimeout(() => {
      console.log('Closing WebSocket...');
      ws.close();
    }, 10000);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testWebSocket();