/**
 * Enhanced Dashboard Demo
 * Demonstrates the full capabilities of the real-time dashboard with WebSocket streaming
 */

import { EnhancedLiveDashboard } from '../src/dashboard/enhanced-live-dashboard';
import { RealTimeObserver } from '../src/real-time-observer';
import { StreamingTraceIntegration } from '../src/streaming-trace-integration';
import { LangfuseWrapper } from '../src';

async function startEnhancedDashboard() {
  console.log('🚀 Starting Enhanced Live Dashboard Demo...\n');

  // Initialize Langfuse wrapper
  const langfuseWrapper = new LangfuseWrapper({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY || 'demo-public-key',
    secretKey: process.env.LANGFUSE_SECRET_KEY || 'demo-secret-key',
    baseUrl: process.env.LANGFUSE_HOST || 'http://localhost:3000',
    enableStreaming: true,
    enableRealTimeObserver: true,
    enableAdaptiveTracing: true,
    enableAutoSpanTracking: true,
    enableMemoryTracking: true,
    enablePerformanceOptimization: true
  });

  // Get real-time observer and streaming integration
  const realTimeObserver = (langfuseWrapper as any).realTimeObserver as RealTimeObserver;
  const streamingIntegration = (langfuseWrapper as any).streamingIntegration as StreamingTraceIntegration;

  // Start real-time observer
  await realTimeObserver.start();

  // Create enhanced dashboard with custom configuration
  const dashboard = new EnhancedLiveDashboard(
    realTimeObserver,
    streamingIntegration,
    {
      port: 3001,
      wsPort: 3002,
      refreshIntervalMs: 1000,
      enableWebSocket: true,
      enableCharts: true,
      enableAlerts: true,
      enableMobileOptimization: true,
      theme: 'dark',
      maxDataPoints: 1000,
      compressionEnabled: true,
      rateLimitMs: 100,
      alertThresholds: {
        errorRate: 0.05,
        latency: 500,
        memoryUsage: 80,
        cpuUsage: 70,
        tokenThroughput: 50
      }
    }
  );

  // Set up dashboard event listeners
  dashboard.on('started', () => {
    console.log('✅ Enhanced Dashboard started successfully!');
    console.log(`   📊 HTTP Dashboard: http://localhost:3001`);
    console.log(`   🔌 WebSocket: ws://localhost:3002`);
    console.log(`   🎨 Theme: Dark mode with Chart.js visualizations`);
    console.log(`   📱 Mobile optimized: Yes`);
    console.log(`   🗜️ Compression: Enabled\n`);
  });

  dashboard.on('alert_created', (alert) => {
    console.log(`🚨 Alert: [${alert.severity.toUpperCase()}] ${alert.message}`);
  });

  dashboard.on('metrics_updated', (metrics) => {
    // Log key metrics
    if (Math.random() < 0.1) { // Log occasionally
      console.log(`📊 Metrics Update:`);
      console.log(`   - Efficiency: ${metrics.performance.efficiency.toFixed(1)}%`);
      console.log(`   - Active Swarms: ${metrics.swarm.activeSwarms}`);
      console.log(`   - Token Throughput: ${metrics.traces.tokenThroughput.toFixed(1)}/s`);
    }
  });

  // Start the enhanced dashboard
  await dashboard.start();

  // Simulate swarm activity
  console.log('\n🐝 Simulating swarm coordination activity...\n');
  
  let swarmCounter = 0;
  let agentCounter = 0;

  // Create swarm simulation function
  const simulateSwarmActivity = async () => {
    // Create a new swarm
    const swarmId = `swarm-${++swarmCounter}`;
    const trace = await langfuseWrapper.createTrace({
      name: `Swarm ${swarmCounter} Coordination`,
      metadata: {
        swarmId,
        topology: 'hierarchical',
        maxAgents: 5
      }
    });

    console.log(`🐝 Created ${swarmId}`);

    // Spawn agents
    const agents = [];
    const agentTypes = ['researcher', 'coder', 'analyst', 'tester', 'coordinator'];
    
    for (let i = 0; i < 5; i++) {
      const agentId = `agent-${++agentCounter}`;
      const agentType = agentTypes[i % agentTypes.length];
      
      const span = trace.span({
        name: `Agent ${agentId} (${agentType})`,
        metadata: {
          agentId,
          agentType,
          swarmId
        }
      });

      agents.push({ id: agentId, type: agentType, span });

      // Simulate agent work
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
      
      // Generate some metrics
      span.generation({
        name: `${agentType} output`,
        input: { task: `Process task for ${agentType}` },
        output: { result: `Completed by ${agentId}` },
        usage: {
          promptTokens: Math.floor(100 + Math.random() * 400),
          completionTokens: Math.floor(50 + Math.random() * 200)
        }
      });

      // Randomly generate errors
      if (Math.random() < 0.05) {
        span.update({ level: 'ERROR', statusMessage: 'Random error occurred' });
      }

      await span.end();
    }

    // Simulate coordination between agents
    const coordinationSpan = trace.span({
      name: 'Cross-Agent Coordination',
      metadata: { swarmId, agentCount: agents.length }
    });

    await new Promise(resolve => setTimeout(resolve, 300));
    
    coordinationSpan.update({
      output: {
        syncStatus: 'completed',
        syncLatency: Math.random() * 100,
        messagesExchanged: agents.length * (agents.length - 1)
      }
    });

    await coordinationSpan.end();
    await trace.update({ output: { status: 'completed', agentsUsed: agents.length } });
    
    console.log(`✅ ${swarmId} completed with ${agents.length} agents\n`);
  };

  // Run continuous simulation
  const simulationInterval = setInterval(async () => {
    await simulateSwarmActivity();
  }, 5000);

  // Simulate various metrics patterns
  let anomalyCounter = 0;
  const metricsInterval = setInterval(() => {
    // Occasionally trigger high latency
    if (Math.random() < 0.1) {
      realTimeObserver.recordObservation({
        id: `obs-${Date.now()}`,
        timestamp: Date.now(),
        type: 'trace_update',
        traceId: `trace-${Date.now()}`,
        swarmId: `swarm-${swarmCounter}`,
        data: { event: 'high_latency' },
        performanceMetrics: {
          latencyMs: 800 + Math.random() * 500,
          tokensPerSecond: 10 + Math.random() * 20
        },
        severity: 'medium'
      });
    }

    // Occasionally trigger anomalies
    if (Math.random() < 0.05) {
      anomalyCounter++;
      realTimeObserver.emit('anomaly', {
        id: `anomaly-${anomalyCounter}`,
        type: 'performance_degradation',
        description: 'Performance dropped below threshold',
        severity: 'high',
        metrics: {
          efficiency: 30 + Math.random() * 20,
          latency: 1000 + Math.random() * 500
        }
      });
    }
  }, 2000);

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down dashboard demo...');
    
    clearInterval(simulationInterval);
    clearInterval(metricsInterval);
    
    await dashboard.stop();
    await realTimeObserver.stop();
    await langfuseWrapper.shutdown();
    
    console.log('✅ Dashboard demo stopped successfully');
    process.exit(0);
  });

  // Test WebSocket client connection
  setTimeout(() => {
    console.log('\n🔌 Testing WebSocket client connection...');
    testWebSocketClient();
  }, 3000);
}

// WebSocket client test
function testWebSocketClient() {
  try {
    const WebSocket = require('ws');
    const ws = new WebSocket('ws://localhost:3002');

    ws.on('open', () => {
      console.log('✅ WebSocket client connected');
      
      // Subscribe to updates
      ws.send(JSON.stringify({
        type: 'subscribe',
        data: { channels: ['default', 'alerts', 'metrics'] }
      }));

      // Configure compression
      ws.send(JSON.stringify({
        type: 'configure',
        data: { compression: true }
      }));
    });

    ws.on('message', (data: any) => {
      try {
        const message = JSON.parse(data);
        if (message.type === 'metrics_update' && Math.random() < 0.05) {
          console.log('📨 Received metrics update via WebSocket');
        }
      } catch (error) {
        // Handle compressed messages
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket client error:', error);
    });

  } catch (error) {
    console.log('ℹ️  WebSocket client test skipped (ws package not installed)');
  }
}

// Display usage instructions
console.log('='.repeat(60));
console.log('🚀 Enhanced Live Dashboard Demo');
console.log('='.repeat(60));
console.log('\nThis demo showcases:');
console.log('  ✅ Real-time WebSocket streaming');
console.log('  ✅ Chart.js visualizations');
console.log('  ✅ Advanced alert system');
console.log('  ✅ Delta compression');
console.log('  ✅ Mobile responsive design');
console.log('  ✅ Dark theme UI');
console.log('\nStarting in 3 seconds...\n');

// Start the demo
setTimeout(() => {
  startEnhancedDashboard().catch(console.error);
}, 3000);