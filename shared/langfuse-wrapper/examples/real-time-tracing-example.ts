/**
 * Real-Time Tracing Example
 * Demonstrates the complete real-time observation system for swarm coordination
 */

import { LangfuseWrapper, initializeRealTimeIntegration, getRealTimeIntegration } from '../src/index';

async function demonstrateRealTimeTracing() {
  console.log('🚀 Starting Real-Time Tracing Demonstration');

  // Initialize Langfuse wrapper
  const langfuseWrapper = new LangfuseWrapper({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    host: process.env.LANGFUSE_HOST || 'https://cloud.langfuse.com',
    enabled: true
  });

  // Initialize real-time integration with all features enabled
  const realTimeIntegration = initializeRealTimeIntegration(langfuseWrapper, {
    enableRealTimeObserver: true,
    enableStreamingIntegration: true,
    enableLiveDashboard: true,
    enableAdaptiveTracing: true,
    enableAnomalyDetection: true,
    enableFeedbackOptimization: true,
    
    // Configuration
    observerPort: 8080,
    dashboardPort: 3001,
    dashboardTheme: 'dark',
    
    // Advanced settings
    adaptiveLearningRate: 0.1,
    anomalySensitivity: 'medium',
    autoOptimizationEnabled: true,
    
    databaseDirectory: '.swarm'
  });

  try {
    // Start the real-time system
    await realTimeIntegration.start();
    
    console.log('✅ Real-Time Tracing System Started');
    console.log('📊 Dashboard: http://localhost:3001');
    console.log('🔍 Observer API: http://localhost:8080/health');
    
    // Simulate swarm operations
    await simulateSwarmOperations(realTimeIntegration);
    
    // Demonstrate system monitoring
    await demonstrateSystemMonitoring(realTimeIntegration);
    
    // Show adaptive capabilities
    await demonstrateAdaptiveFeatures(realTimeIntegration);
    
    // Export system data
    await demonstrateDataExport(realTimeIntegration);
    
  } catch (error) {
    console.error('❌ Error in real-time tracing demonstration:', error);
  } finally {
    // Clean shutdown
    console.log('🛑 Shutting down Real-Time Tracing System...');
    await realTimeIntegration.stop();
    console.log('✅ Shutdown complete');
  }
}

async function simulateSwarmOperations(integration: any) {
  console.log('\n🐝 Simulating Swarm Operations...');
  
  const swarmId = 'demo-swarm-001';
  const agents = [
    { id: 'researcher-001', role: 'researcher' },
    { id: 'coder-001', role: 'coder' },
    { id: 'analyst-001', role: 'analyst' },
    { id: 'coordinator-001', role: 'coordinator' }
  ];

  // Simulate multiple concurrent operations
  const operations = agents.map(async (agent, index) => {
    const context = {
      hookType: 'swarm-operation',
      swarmId,
      agentId: agent.id,
      agentRole: agent.role,
      taskId: `task-${index + 1}`,
      operationType: 'execute',
      metadata: {
        taskDescription: `${agent.role} executing task ${index + 1}`,
        priority: index === 0 ? 'high' : 'medium',
        expectedDuration: 1000 + (index * 500)
      }
    };

    console.log(`  🔄 Starting ${agent.role} operation...`);
    
    // Start trace
    const traceId = await integration.startTrace(context);
    
    if (traceId) {
      // Simulate work with periodic updates
      for (let step = 1; step <= 3; step++) {
        await new Promise(resolve => setTimeout(resolve, 300 + (Math.random() * 200)));
        
        await integration.updateTrace(traceId, {
          step,
          progress: (step / 3) * 100,
          status: 'processing',
          details: `${agent.role} completing step ${step}`
        });
        
        console.log(`    📊 ${agent.role} - Step ${step}/3 completed`);
      }
      
      // Complete the trace
      const result = {
        status: 'completed',
        output: `${agent.role} task completed successfully`,
        metrics: {
          executionTime: 900 + (index * 500),
          resourcesUsed: 10 + (index * 2),
          efficiency: 85 + (Math.random() * 10)
        }
      };
      
      const tokenUsage = {
        input: 100 + (index * 50),
        output: 200 + (index * 75),
        total: 300 + (index * 125)
      };
      
      await integration.completeTrace(traceId, result, tokenUsage);
      console.log(`  ✅ ${agent.role} operation completed`);
    }
  });

  // Wait for all operations to complete
  await Promise.all(operations);
  console.log('✅ All swarm operations completed');
}

async function demonstrateSystemMonitoring(integration: any) {
  console.log('\n📊 Demonstrating System Monitoring...');
  
  // Get system status
  const status = integration.getSystemStatus();
  console.log('System Status:', {
    health: status.health,
    uptime: Math.round(status.metrics.systemUptime / 1000) + 's',
    activeTraces: status.metrics.activeTraces,
    totalObservations: status.metrics.totalObservations
  });
  
  // Get component information
  const observer = integration.getRealTimeObserver();
  if (observer) {
    const metrics = observer.getMetrics();
    console.log('Observer Metrics:', {
      totalTraces: metrics.totalTraces,
      averageLatency: Math.round(metrics.averageLatency) + 'ms',
      errorRate: (metrics.errorRate * 100).toFixed(2) + '%',
      activeAgents: metrics.swarmCoordination.activeAgents
    });
  }
  
  // Get recent observations
  if (observer) {
    const recentObs = observer.getRecentObservations(5);
    console.log(`Recent Observations (${recentObs.length}):`);
    recentObs.forEach((obs, i) => {
      console.log(`  ${i + 1}. ${obs.type} - ${obs.agentRole} (${obs.performanceMetrics.latencyMs}ms)`);
    });
  }
}

async function demonstrateAdaptiveFeatures(integration: any) {
  console.log('\n🧠 Demonstrating Adaptive Features...');
  
  const adaptiveTracing = integration.getAdaptiveTracing();
  if (adaptiveTracing) {
    // Show current strategy
    const currentStrategy = adaptiveTracing.getCurrentStrategy();
    console.log('Current Tracing Strategy:', {
      name: currentStrategy.name,
      samplingRate: currentStrategy.samplingRate,
      detailLevel: currentStrategy.detailLevel,
      effectiveness: (currentStrategy.effectiveness * 100).toFixed(1) + '%'
    });
    
    // Show learned patterns
    const patterns = adaptiveTracing.getPatterns().slice(0, 3);
    console.log(`Learned Patterns (${patterns.length}):`);
    patterns.forEach((pattern, i) => {
      console.log(`  ${i + 1}. ${pattern.pattern} (confidence: ${(pattern.confidence * 100).toFixed(1)}%)`);
    });
    
    // Get adaptive metrics
    const metrics = adaptiveTracing.getAdaptiveMetrics();
    console.log('Adaptive Metrics:', {
      strategiesCount: metrics.strategiesCount,
      patternsCount: metrics.patternsCount,
      averageEffectiveness: (metrics.averageEffectiveness * 100).toFixed(1) + '%',
      learningEnabled: metrics.learningEnabled
    });
  }
  
  // Show anomaly detection status
  const anomalyDetection = integration.getAnomalyDetection();
  if (anomalyDetection) {
    const anomalies = anomalyDetection.getAnomalies(1); // Last hour
    console.log(`Anomalies Detected (last hour): ${anomalies.length}`);
    
    if (anomalies.length > 0) {
      const recent = anomalies.slice(0, 3);
      recent.forEach((anomaly, i) => {
        console.log(`  ${i + 1}. ${anomaly.type} - ${anomaly.description} (${anomaly.severity})`);
      });
    }
    
    const detectionMetrics = anomalyDetection.getDetectionMetrics();
    console.log('Detection Metrics:', {
      totalAnomalies: detectionMetrics.totalAnomalies,
      falsePositiveRate: (detectionMetrics.falsePositiveRate * 100).toFixed(2) + '%',
      averageAccuracy: (detectionMetrics.averageAccuracy * 100).toFixed(1) + '%'
    });
  }
  
  // Show feedback optimization
  const feedbackOptimization = integration.getFeedbackOptimization();
  if (feedbackOptimization) {
    const feedbackMetrics = feedbackOptimization.getFeedbackMetrics();
    console.log('Optimization Metrics:', {
      totalFeedbacks: feedbackMetrics.totalFeedbacks,
      optimizationsApplied: feedbackMetrics.optimizationsApplied,
      successRate: (feedbackMetrics.successRate * 100).toFixed(1) + '%',
      averageImprovement: (feedbackMetrics.averageImprovement * 100).toFixed(1) + '%'
    });
    
    const recommendations = feedbackOptimization.getRecommendations().slice(0, 3);
    console.log(`Active Recommendations (${recommendations.length}):`);
    recommendations.forEach((rec, i) => {
      console.log(`  ${i + 1}. ${rec.description} (${rec.priority} priority, ${(rec.expectedImprovement * 100).toFixed(1)}% improvement)`);
    });
  }
}

async function demonstrateDataExport(integration: any) {
  console.log('\n💾 Demonstrating Data Export...');
  
  try {
    const exportData = await integration.exportSystemData();
    
    console.log('Export Summary:', {
      timestamp: new Date(exportData.timestamp).toISOString(),
      systemHealth: exportData.status.health,
      observationsCount: exportData.observations.length,
      anomaliesCount: exportData.anomalies.length,
      optimizationsCount: exportData.optimizations.length,
      strategiesCount: exportData.strategies.length,
      patternsCount: exportData.patterns.length
    });
    
    // Save to file (in real usage)
    // const fs = require('fs');
    // fs.writeFileSync(`real-time-export-${Date.now()}.json`, JSON.stringify(exportData, null, 2));
    // console.log('✅ Export data saved to file');
    
  } catch (error) {
    console.error('❌ Export failed:', error);
  }
}

// Error simulation for anomaly detection
async function simulateErrorConditions(integration: any) {
  console.log('\n⚠️  Simulating Error Conditions for Anomaly Detection...');
  
  // Simulate high latency trace
  const highLatencyContext = {
    hookType: 'high-latency-operation',
    swarmId: 'demo-swarm-001',
    agentId: 'stress-agent-001',
    agentRole: 'stress-tester',
    operationType: 'stress-test'
  };
  
  const traceId = await integration.startTrace(highLatencyContext);
  if (traceId) {
    // Simulate long-running operation
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await integration.completeTrace(traceId, {
      status: 'completed',
      warning: 'High latency detected'
    });
  }
  
  // Simulate error trace
  const errorContext = {
    hookType: 'error-operation',
    swarmId: 'demo-swarm-001',
    agentId: 'error-agent-001',
    agentRole: 'error-simulator',
    operationType: 'error-test'
  };
  
  const errorTraceId = await integration.startTrace(errorContext);
  if (errorTraceId) {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const error = new Error('Simulated error for anomaly detection');
    await integration.errorTrace(errorTraceId, error);
  }
  
  console.log('✅ Error conditions simulated');
}

// Performance testing
async function performanceTest(integration: any) {
  console.log('\n🚀 Running Performance Test...');
  
  const startTime = Date.now();
  const concurrentTraces = 10;
  
  const traces = Array.from({ length: concurrentTraces }, async (_, i) => {
    const context = {
      hookType: 'performance-test',
      swarmId: 'perf-test-swarm',
      agentId: `perf-agent-${i}`,
      agentRole: 'performance-tester',
      operationType: 'load-test'
    };
    
    const traceId = await integration.startTrace(context);
    if (traceId) {
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
      await integration.completeTrace(traceId, { testIndex: i });
    }
  });
  
  await Promise.all(traces);
  
  const duration = Date.now() - startTime;
  console.log(`✅ Performance test completed: ${concurrentTraces} traces in ${duration}ms`);
  console.log(`   Average: ${(duration / concurrentTraces).toFixed(2)}ms per trace`);
}

// Main demonstration function
async function main() {
  try {
    await demonstrateRealTimeTracing();
    
    // Additional demonstrations
    const integration = getRealTimeIntegration();
    if (integration) {
      await simulateErrorConditions(integration);
      await performanceTest(integration);
    }
    
  } catch (error) {
    console.error('❌ Demonstration failed:', error);
    process.exit(1);
  }
}

// Event handlers for real-time monitoring
function setupEventHandlers(integration: any) {
  integration.on('started', () => {
    console.log('🎯 Real-Time Integration started');
  });
  
  integration.on('system_anomaly', (anomaly: any) => {
    console.log(`🚨 System anomaly: ${anomaly.description} (${anomaly.severity})`);
  });
  
  integration.on('optimization_applied', (event: any) => {
    console.log(`⚡ Optimization applied: ${event.recommendation.description}`);
  });
  
  integration.on('strategy_change', (event: any) => {
    console.log(`🔄 Strategy changed: ${event.previous.name} → ${event.current.name}`);
  });
  
  integration.on('health_alert', (alert: any) => {
    console.log(`❤️  Health alert: System is ${alert.health}`);
  });
}

// Run the demonstration
if (require.main === module) {
  main().catch(console.error);
}

export {
  demonstrateRealTimeTracing,
  simulateSwarmOperations,
  demonstrateSystemMonitoring,
  demonstrateAdaptiveFeatures,
  demonstrateDataExport,
  simulateErrorConditions,
  performanceTest,
  setupEventHandlers
};