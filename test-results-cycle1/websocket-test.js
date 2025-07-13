// WebSocket Connection Test
const WebSocket = require('ws');

console.log('Testing WebSocket connectivity...');

// Test Dashboard WebSocket
const dashboardWs = new WebSocket('ws://localhost:3001');

dashboardWs.on('open', () => {
    console.log('✅ Dashboard WebSocket connected');
    
    // Subscribe to updates
    dashboardWs.send(JSON.stringify({
        type: 'subscribe',
        channels: ['metrics', 'logs', 'status']
    }));
});

dashboardWs.on('message', (data) => {
    console.log('📨 Dashboard message:', data.toString().substring(0, 100));
});

dashboardWs.on('error', (err) => {
    console.error('❌ Dashboard WebSocket error:', err.message);
});

dashboardWs.on('close', () => {
    console.log('🔌 Dashboard WebSocket closed');
});

// Keep the script running for 10 seconds
setTimeout(() => {
    console.log('\nClosing connections...');
    dashboardWs.close();
    process.exit(0);
}, 10000);