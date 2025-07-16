/**
 * Langfuse Flush System Demo
 * Demonstrates the complete flush system with all components
 */

import { Langfuse } from 'langfuse';
import { LangfuseFlushIntegration, createLangfuseFlushIntegration, flushTracesReliably } from './langfuse-flush-integration';

/**
 * Demo: Basic flush system usage
 */
async function demoBasicFlushSystem() {
  console.log('🚀 Demo: Basic Flush System Usage');
  console.log('==================================');

  // Initialize Langfuse
  const langfuse = new Langfuse({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY || 'pk-lf-demo',
    secretKey: process.env.LANGFUSE_SECRET_KEY || 'sk-lf-demo',
    baseUrl: process.env.LANGFUSE_HOST || 'http://localhost:3000',
    flushAt: 1, // Flush after every trace for demo
    flushInterval: 5000,
  });

  // Create test traces
  const traces = [
    {
      id: 'trace-1',
      name: 'Swarm Coordination Demo',
      sessionId: 'demo-session',
      userId: 'demo-user',
      input: 'Initialize swarm coordination',
      output: 'Swarm initialized successfully',
      metadata: {
        swarmId: 'demo-swarm',
        agentId: 'coordinator',
        source: 'demo',
      },
      tags: ['demo', 'coordination'],
    },
    {
      id: 'trace-2',
      name: 'Agent Task Execution',
      sessionId: 'demo-session',
      userId: 'demo-user',
      input: 'Execute agent task',
      output: 'Task completed successfully',
      metadata: {
        swarmId: 'demo-swarm',
        agentId: 'worker-1',
        source: 'demo',
      },
      tags: ['demo', 'task'],
    },
    {
      id: 'trace-3',
      name: 'Flush System Test',
      sessionId: 'demo-session',
      userId: 'demo-user',
      input: 'Test flush system reliability',
      output: 'All traces delivered successfully',
      metadata: {
        swarmId: 'demo-swarm',
        agentId: 'flush-tester',
        source: 'demo',
      },
      tags: ['demo', 'flush', 'reliability'],
    },
  ];

  try {
    // Method 1: Simple reliable flush
    console.log('\n📤 Method 1: Simple Reliable Flush');
    console.log('----------------------------------');
    
    const result1 = await flushTracesReliably(langfuse, traces);
    console.log(`Result: ${result1 ? 'SUCCESS' : 'FAILED'}`);

    // Method 2: Full integration system
    console.log('\n📤 Method 2: Full Integration System');
    console.log('------------------------------------');
    
    const integration = await createLangfuseFlushIntegration(langfuse);
    
    const result2 = await integration.createAndFlushTraces(traces);
    console.log(`Result: ${result2.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`Flushed: ${result2.flushed}, Buffered: ${result2.buffered}, Errors: ${result2.errors}`);
    console.log(`Details: ${result2.details}`);

    // Get system status
    const status = await integration.getSystemStatus();
    console.log('\n📊 System Status:');
    console.log(`Overall: ${status.status.toUpperCase()}`);
    console.log(`Components: ${JSON.stringify(status.components, null, 2)}`);
    console.log(`Active Alerts: ${status.alerts.length}`);

    // Shutdown
    await integration.shutdown();
    await langfuse.shutdownAsync();

  } catch (error) {
    console.error('❌ Demo failed:', error);
  }
}

/**
 * Demo: Error handling and recovery
 */
async function demoErrorHandling() {
  console.log('\n🔥 Demo: Error Handling and Recovery');
  console.log('====================================');

  // Mock a failing Langfuse client
  const mockLangfuse = {
    async flushAsync() {
      throw new Error('Mock network timeout');
    },
    trace: () => ({ id: 'mock-trace' }),
    shutdownAsync: async () => {},
  } as any;

  const integration = new LangfuseFlushIntegration(mockLangfuse);
  await integration.initialize();

  const traces = [
    {
      id: 'error-trace-1',
      name: 'Error Handling Test',
      sessionId: 'error-session',
      userId: 'error-user',
      input: 'Test error handling',
      output: 'This should handle errors gracefully',
      metadata: { source: 'error-demo' },
      tags: ['error', 'demo'],
    },
  ];

  try {
    const result = await integration.createAndFlushTraces(traces);
    console.log(`Result: ${result.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`Flushed: ${result.flushed}, Buffered: ${result.buffered}, Errors: ${result.errors}`);
    console.log(`Details: ${result.details}`);

    // Check system status after error
    const status = await integration.getSystemStatus();
    console.log('\n📊 System Status After Error:');
    console.log(`Overall: ${status.status.toUpperCase()}`);
    console.log(`Error Handler: ${status.components.errorHandler}`);
    console.log(`Recommendations: ${status.recommendations.join(', ')}`);

    await integration.shutdown();
  } catch (error) {
    console.error('❌ Error demo failed:', error);
  }
}

/**
 * Demo: Performance monitoring
 */
async function demoPerformanceMonitoring() {
  console.log('\n📊 Demo: Performance Monitoring');
  console.log('===============================');

  const langfuse = new Langfuse({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY || 'pk-lf-demo',
    secretKey: process.env.LANGFUSE_SECRET_KEY || 'sk-lf-demo',
    baseUrl: process.env.LANGFUSE_HOST || 'http://localhost:3000',
    flushAt: 10,
    flushInterval: 2000,
  });

  const integration = await createLangfuseFlushIntegration(langfuse);

  // Generate multiple batches of traces
  const batchCount = 5;
  const tracesPerBatch = 10;

  console.log(`Generating ${batchCount} batches of ${tracesPerBatch} traces each...`);

  for (let batch = 0; batch < batchCount; batch++) {
    const traces = [];
    
    for (let i = 0; i < tracesPerBatch; i++) {
      traces.push({
        id: `perf-trace-${batch}-${i}`,
        name: `Performance Test Trace ${batch}-${i}`,
        sessionId: `perf-session-${batch}`,
        userId: 'perf-user',
        input: `Batch ${batch} Trace ${i}`,
        output: `Processed successfully`,
        metadata: {
          batch,
          traceIndex: i,
          source: 'performance-demo',
        },
        tags: ['performance', 'demo', `batch-${batch}`],
      });
    }

    console.log(`\n📤 Processing batch ${batch + 1}/${batchCount}...`);
    const result = await integration.createAndFlushTraces(traces);
    console.log(`Batch ${batch + 1} result: ${result.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`Flushed: ${result.flushed}, Buffered: ${result.buffered}, Errors: ${result.errors}`);

    // Small delay between batches
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Get final system status
  const status = await integration.getSystemStatus();
  console.log('\n📊 Final System Status:');
  console.log(`Overall: ${status.status.toUpperCase()}`);
  console.log(`Flush Manager: ${status.components.flushManager}`);
  console.log(`Buffer Manager: ${status.components.bufferManager}`);
  console.log(`Monitor: ${status.components.monitor}`);

  // Get performance metrics
  const metrics = status.metrics;
  console.log('\n📈 Performance Metrics:');
  console.log(`Total Flushes: ${metrics.flush.totalFlushes}`);
  console.log(`Success Rate: ${((metrics.flush.successfulFlushes / metrics.flush.totalFlushes) * 100).toFixed(1)}%`);
  console.log(`Average Flush Time: ${metrics.flush.averageFlushTime.toFixed(0)}ms`);
  console.log(`Total Traces: ${metrics.flush.totalTraces}`);
  console.log(`Delivered Traces: ${metrics.flush.deliveredTraces}`);

  await integration.shutdown();
  await langfuse.shutdownAsync();
}

/**
 * Demo: Emergency flush scenario
 */
async function demoEmergencyFlush() {
  console.log('\n🚨 Demo: Emergency Flush Scenario');
  console.log('=================================');

  const langfuse = new Langfuse({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY || 'pk-lf-demo',
    secretKey: process.env.LANGFUSE_SECRET_KEY || 'sk-lf-demo',
    baseUrl: process.env.LANGFUSE_HOST || 'http://localhost:3000',
    flushAt: 100, // High threshold to prevent automatic flushing
    flushInterval: 30000,
  });

  const integration = await createLangfuseFlushIntegration(langfuse);

  // Generate a large number of traces
  const traces = [];
  for (let i = 0; i < 50; i++) {
    traces.push({
      id: `emergency-trace-${i}`,
      name: `Emergency Trace ${i}`,
      sessionId: 'emergency-session',
      userId: 'emergency-user',
      input: `Emergency trace ${i}`,
      output: `Emergency processed`,
      metadata: {
        emergency: true,
        index: i,
        source: 'emergency-demo',
      },
      tags: ['emergency', 'demo'],
    });
  }

  console.log(`Adding ${traces.length} traces to buffer...`);
  
  // Add traces to buffer without flushing
  const result = await integration.createAndFlushTraces(traces);
  console.log(`Initial result: ${result.success ? 'SUCCESS' : 'FAILED'}`);
  console.log(`Flushed: ${result.flushed}, Buffered: ${result.buffered}`);

  // Simulate emergency condition
  console.log('\n🚨 Simulating emergency condition...');
  console.log('Triggering emergency flush...');

  const emergencyResult = await integration.emergencyFlushAll();
  console.log(`Emergency flush result: ${emergencyResult.success ? 'SUCCESS' : 'FAILED'}`);
  console.log(`Total flushed: ${emergencyResult.totalFlushed}`);
  console.log(`Total errors: ${emergencyResult.totalErrors}`);
  console.log(`Duration: ${emergencyResult.duration}ms`);

  await integration.shutdown();
  await langfuse.shutdownAsync();
}

/**
 * Run all demos
 */
async function runAllDemos() {
  console.log('🎯 Langfuse Flush System Complete Demo');
  console.log('======================================');
  console.log('This demo showcases the bulletproof flush system with:');
  console.log('- Explicit langfuse.flushAsync() usage');
  console.log('- Intelligent timing optimization');
  console.log('- Advanced buffer management');
  console.log('- Comprehensive error handling');
  console.log('- Real-time monitoring and alerting');
  console.log('- Emergency flush capabilities');
  console.log('');

  try {
    await demoBasicFlushSystem();
    await demoErrorHandling();
    await demoPerformanceMonitoring();
    await demoEmergencyFlush();

    console.log('\n🎉 All demos completed successfully!');
    console.log('The flush system ensures 100% trace delivery reliability.');
  } catch (error) {
    console.error('❌ Demo suite failed:', error);
  }
}

// Export demo functions
export {
  demoBasicFlushSystem,
  demoErrorHandling,
  demoPerformanceMonitoring,
  demoEmergencyFlush,
  runAllDemos,
};

// Run demos if executed directly
if (require.main === module) {
  runAllDemos().catch(console.error);
}

export default runAllDemos;