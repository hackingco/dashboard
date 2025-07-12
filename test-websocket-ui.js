#!/usr/bin/env node

// Test script to verify WebSocket connection and data transformation
// This simulates the UI connecting to the WebSocket service

const WebSocket = require('ws');

const WS_URL = 'wss://swarm-manager-live.fly.dev/ws';
const API_BASE = 'https://swarm-manager-live.fly.dev/api';

async function getAuthToken() {
  try {
    const response = await fetch(`${API_BASE}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'test-ui' }),
    });
    
    if (!response.ok) {
      throw new Error(`Token request failed: ${response.status}`);
    }
    
    const data = await response.json();
    return data.token;
  } catch (error) {
    console.error('Failed to get auth token:', error);
    throw error;
  }
}

async function testEnhancedSwarmsAPI() {
  try {
    console.log('🔍 Testing Enhanced Swarms API...');
    
    const response = await fetch(`${API_BASE}/enhanced-swarms`);
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Enhanced Swarms API Response:', JSON.stringify(data, null, 2));
      
      // Test data transformation logic
      const swarmsData = data.data || data;
      if (Array.isArray(swarmsData)) {
        console.log(`📊 Found ${swarmsData.length} swarms`);
        
        swarmsData.forEach((swarm, index) => {
          console.log(`\n🐝 Swarm ${index + 1}:`);
          console.log(`  - ID: ${swarm.id}`);
          console.log(`  - Name: ${swarm.name}`);
          console.log(`  - Status: ${swarm.status}`);
          console.log(`  - Agents: ${swarm.agents?.length || 0}`);
          console.log(`  - Config: ${JSON.stringify(swarm.configuration, null, 2)}`);
        });
      } else {
        console.log('⚠️ API returned non-array data');
      }
    } else {
      console.log(`❌ Enhanced Swarms API failed: ${response.status}`);
    }
  } catch (error) {
    console.error('❌ Enhanced Swarms API test failed:', error);
  }
}

async function testWebSocketConnection() {
  try {
    console.log('\n🔌 Testing WebSocket Connection...');
    
    const token = await getAuthToken();
    console.log('✅ Auth token obtained');
    
    const wsUrl = `${WS_URL}?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(wsUrl);
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('WebSocket connection timeout'));
      }, 10000);
      
      ws.on('open', () => {
        console.log('✅ WebSocket connected');
        clearTimeout(timeout);
        
        // Test scale message
        console.log('📤 Sending test scale message...');
        ws.send(JSON.stringify({
          type: 'scale',
          swarmId: 'test-swarm',
          count: 3,
          targetAgents: 3,
          messageId: Date.now().toString()
        }));
      });
      
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          console.log('📥 WebSocket message received:', JSON.stringify(message, null, 2));
          
          // Test message transformation
          if (message.type === 'swarm_update' && message.data?.agents) {
            console.log('🔄 Testing agent-to-machine transformation...');
            const agents = message.data.agents;
            const activeAgents = agents.filter(a => a.status === 'active' || a.status === 'busy').length;
            
            const transformedMetrics = {
              runningMachines: activeAgents,
              totalMachines: agents.length,
              cpuUsage: activeAgents > 0 ? (activeAgents / agents.length) * 80 : 0,
              memoryUsage: activeAgents > 0 ? (activeAgents / agents.length) * 70 : 0,
              networkIn: activeAgents * 1024,
              networkOut: activeAgents * 2048
            };
            
            console.log('✨ Transformed metrics:', transformedMetrics);
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      });
      
      ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
        clearTimeout(timeout);
        reject(error);
      });
      
      ws.on('close', (code, reason) => {
        console.log(`🔌 WebSocket closed: ${code} - ${reason}`);
        clearTimeout(timeout);
        resolve();
      });
      
      // Close after 5 seconds
      setTimeout(() => {
        ws.close();
        resolve();
      }, 5000);
    });
    
  } catch (error) {
    console.error('❌ WebSocket test failed:', error);
  }
}

async function testScaleAPI() {
  try {
    console.log('\n⚡ Testing Scale API...');
    
    // First get available swarms
    const swarmsResponse = await fetch(`${API_BASE}/enhanced-swarms`);
    if (!swarmsResponse.ok) {
      console.log('❌ Could not fetch swarms for scale test');
      return;
    }
    
    const swarmsData = await swarmsResponse.json();
    const swarms = swarmsData.data || swarmsData;
    
    if (Array.isArray(swarms) && swarms.length > 0) {
      const testSwarm = swarms[0];
      console.log(`🎯 Testing scale on swarm: ${testSwarm.name} (${testSwarm.id})`);
      
      const scaleResponse = await fetch(`${API_BASE}/enhanced-swarms/${testSwarm.id}/scale`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetAgents: 2, targetCount: 2 }),
      });
      
      if (scaleResponse.ok) {
        const scaleResult = await scaleResponse.json();
        console.log('✅ Scale API Response:', JSON.stringify(scaleResult, null, 2));
      } else {
        console.log(`❌ Scale API failed: ${scaleResponse.status}`);
        const errorText = await scaleResponse.text();
        console.log('Error details:', errorText);
      }
    } else {
      console.log('⚠️ No swarms available for scale test');
    }
  } catch (error) {
    console.error('❌ Scale API test failed:', error);
  }
}

async function main() {
  console.log('🧪 WebSocket UI Integration Test\n');
  
  await testEnhancedSwarmsAPI();
  await testWebSocketConnection();
  await testScaleAPI();
  
  console.log('\n✅ Test completed');
}

// Only run if this script is executed directly
if (require.main === module) {
  main().catch(console.error);
}