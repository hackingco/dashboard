/**
 * SDK Usage Examples and Quick Start Guide
 * Demonstrates how to use the optimized Langfuse SDK configuration system
 */

import { 
  OptimizedLangfuseClient, 
  ClientUtils, 
  optimizedLangfuseClient 
} from './optimized-langfuse-client';
import { sdkConfig } from './sdk-config';
import { healthMonitor } from './sdk-health-monitor';
import { sdkValidator } from './sdk-validator';

/**
 * Example 1: Basic Usage (Development)
 * Simple setup for local development with optimal settings
 */
export async function basicDevelopmentExample(): Promise<void> {
  console.log('🚀 Basic Development Example');
  
  // Use the default singleton client (automatically optimized for development)
  const client = optimizedLangfuseClient;
  
  // Wait for initialization
  await new Promise(resolve => {
    if (client.getClientStatus().initialized) {
      resolve(undefined);
    } else {
      client.once('initialized', resolve);
    }
  });
  
  // Create a simple trace
  const trace = await client.createTrace({
    name: 'Development Test Trace',
    sessionId: 'dev-session-1',
    input: 'Hello, world!',
    output: 'Hello from Langfuse!',
    metadata: {
      environment: 'development',
      version: '1.0.0',
    },
    tags: ['development', 'test'],
  });
  
  console.log('✅ Trace created:', trace?.id);
  
  // Get client status
  const status = client.getClientStatus();
  console.log('📊 Client Status:', {
    environment: status.environment,
    health: status.health.overall,
    totalTraces: status.metrics.totalTraces,
    uptime: status.metrics.uptime,
  });
}

/**
 * Example 2: Production Setup
 * Optimized configuration for production environment
 */
export async function productionExample(): Promise<void> {
  console.log('🏭 Production Example');
  
  // Create production-optimized client
  const productionClient = ClientUtils.createProductionClient();
  
  // Wait for initialization
  await new Promise(resolve => {
    if (productionClient.getClientStatus().initialized) {
      resolve(undefined);
    } else {
      productionClient.once('initialized', resolve);
    }
  });
  
  // Create high-throughput traces
  const traces = await Promise.all([
    productionClient.createTrace({
      name: 'Production API Call',
      sessionId: 'prod-session-1',
      model: 'gpt-4',
      promptTokens: 150,
      completionTokens: 75,
      totalCost: 0.002,
      input: 'Analyze user behavior',
      output: 'User behavior analysis complete',
      metadata: {
        environment: 'production',
        service: 'analytics',
      },
      tags: ['production', 'analytics'],
    }),
    productionClient.createTrace({
      name: 'Production Processing',
      sessionId: 'prod-session-2',
      model: 'gpt-3.5-turbo',
      promptTokens: 100,
      completionTokens: 50,
      totalCost: 0.001,
      input: 'Process data batch',
      output: 'Data processing complete',
      metadata: {
        environment: 'production',
        service: 'processing',
      },
      tags: ['production', 'processing'],
    }),
  ]);
  
  console.log('✅ Production traces created:', traces.map(t => t?.id));
  
  // Get performance metrics
  const metrics = productionClient.getPerformanceMetrics();
  console.log('📈 Performance Metrics:', metrics);
  
  // Cleanup
  await productionClient.shutdown();
}

/**
 * Example 3: Environment Switching
 * Demonstrates switching between environments
 */
export async function environmentSwitchingExample(): Promise<void> {
  console.log('🔄 Environment Switching Example');
  
  const client = new OptimizedLangfuseClient({
    environment: 'development',
    enableHealthMonitoring: true,
    enableValidation: true,
  });
  
  // Wait for initialization
  await new Promise(resolve => {
    if (client.getClientStatus().initialized) {
      resolve(undefined);
    } else {
      client.once('initialized', resolve);
    }
  });
  
  console.log('🔧 Initial environment:', client.getClientStatus().environment);
  
  // Switch to staging
  await client.switchEnvironment('staging');
  console.log('🔧 Switched to:', client.getClientStatus().environment);
  
  // Switch to production
  await client.switchEnvironment('production');
  console.log('🔧 Switched to:', client.getClientStatus().environment);
  
  // Cleanup
  await client.shutdown();
}

/**
 * Example 4: Health Monitoring
 * Demonstrates health monitoring capabilities
 */
export async function healthMonitoringExample(): Promise<void> {
  console.log('🏥 Health Monitoring Example');
  
  // Start health monitoring
  healthMonitor.startMonitoring();
  
  // Listen for health updates
  healthMonitor.on('health-updated', (status) => {
    console.log('🔍 Health Status:', status.status);
  });
  
  // Listen for alerts
  healthMonitor.on('alert-created', (alert) => {
    console.log('🚨 Alert:', alert.message);
  });
  
  // Get health dashboard
  const dashboard = healthMonitor.getHealthDashboard();
  console.log('📊 Health Dashboard:', {
    overall: dashboard.overall,
    uptime: dashboard.uptime,
    alerts: dashboard.alerts.length,
    availability: dashboard.metrics.availability,
  });
  
  // Wait for some health data
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Get performance history
  const performanceHistory = healthMonitor.getPerformanceHistory();
  console.log('📈 Performance History:', performanceHistory.length, 'entries');
  
  // Stop monitoring
  healthMonitor.stopMonitoring();
}

/**
 * Example 5: Configuration Validation
 * Demonstrates validation capabilities
 */
export async function validationExample(): Promise<void> {
  console.log('✅ Configuration Validation Example');
  
  // Run comprehensive validation
  const report = await sdkValidator.runAllTests();
  
  console.log('📋 Validation Report:', {
    environment: report.environment,
    overall: report.overall,
    score: report.score,
    summary: report.summary,
  });
  
  // Show failed tests
  const failedTests = report.results.filter(r => !r.passed);
  if (failedTests.length > 0) {
    console.log('❌ Failed Tests:');
    failedTests.forEach(test => {
      console.log(`  - ${test.test.name}: ${test.message}`);
    });
  }
  
  // Show recommendations
  if (report.recommendations.length > 0) {
    console.log('💡 Recommendations:');
    report.recommendations.forEach(rec => {
      console.log(`  - ${rec}`);
    });
  }
}

/**
 * Example 6: Custom Configuration
 * Demonstrates custom configuration options
 */
export async function customConfigurationExample(): Promise<void> {
  console.log('⚙️ Custom Configuration Example');
  
  // Create client with custom configuration
  const customClient = new OptimizedLangfuseClient({
    environment: 'development',
    useCase: 'high-throughput',
    customConfig: {
      baseUrl: 'http://localhost:3000',
      flushAt: 5, // Custom batch size
      flushInterval: 2000, // Custom flush interval
      requestTimeout: 15000, // Custom timeout
      maxRetries: 5, // Custom retry count
      performance: {
        enableCompression: true,
        maxConcurrentRequests: 10,
        connectionPoolSize: 5,
        keepAlive: true,
      },
      monitoring: {
        enableMetrics: true,
        enableTracing: true,
        enableLogging: true,
        logLevel: 'info',
      },
    },
  });
  
  // Wait for initialization
  await new Promise(resolve => {
    if (customClient.getClientStatus().initialized) {
      resolve(undefined);
    } else {
      customClient.once('initialized', resolve);
    }
  });
  
  // Show configuration
  const config = customClient.getClientStatus().configuration;
  console.log('⚙️ Custom Configuration:', {
    flushAt: config.flushAt,
    flushInterval: config.flushInterval,
    requestTimeout: config.requestTimeout,
    maxRetries: config.maxRetries,
    compression: config.performance.enableCompression,
  });
  
  // Cleanup
  await customClient.shutdown();
}

/**
 * Example 7: Real-time Swarm Traces
 * Demonstrates creating traces for swarm operations
 */
export async function swarmTracesExample(): Promise<void> {
  console.log('🐝 Swarm Traces Example');
  
  const client = optimizedLangfuseClient;
  
  // Create swarm coordination trace
  const coordinationTrace = await client.createTrace({
    name: 'Swarm Coordination',
    sessionId: 'swarm-session-1',
    agentId: 'coordinator-001',
    swarmId: 'swarm-analytics',
    input: 'Initialize swarm with 5 agents',
    output: 'Swarm initialized successfully',
    metadata: {
      agentCount: 5,
      topology: 'hierarchical',
      coordinationType: 'distributed',
    },
    tags: ['swarm', 'coordination', 'initialization'],
  });
  
  // Create agent-specific traces
  const agentTraces = await Promise.all([
    client.createTrace({
      name: 'Agent: Data Processing',
      sessionId: 'swarm-session-1',
      agentId: 'processor-001',
      swarmId: 'swarm-analytics',
      input: 'Process dataset batch 1',
      output: 'Processed 1000 records',
      metadata: {
        recordsProcessed: 1000,
        processingTime: 2.5,
      },
      tags: ['swarm', 'processing', 'data'],
    }),
    client.createTrace({
      name: 'Agent: Analysis',
      sessionId: 'swarm-session-1',
      agentId: 'analyzer-001',
      swarmId: 'swarm-analytics',
      input: 'Analyze processed data',
      output: 'Analysis complete: 3 patterns found',
      metadata: {
        patternsFound: 3,
        analysisTime: 1.8,
      },
      tags: ['swarm', 'analysis', 'patterns'],
    }),
  ]);
  
  console.log('✅ Swarm traces created:', [coordinationTrace?.id, ...agentTraces.map(t => t?.id)]);
  
  // Get swarm-specific traces
  const swarmTraces = await client.getTraces({
    swarmId: 'swarm-analytics',
    includeMetrics: true,
  });
  
  console.log('🔍 Swarm traces found:', swarmTraces.length);
}

/**
 * Example 8: Error Handling and Recovery
 * Demonstrates error handling and recovery mechanisms
 */
export async function errorHandlingExample(): Promise<void> {
  console.log('🚨 Error Handling Example');
  
  const client = new OptimizedLangfuseClient({
    environment: 'development',
    enableHealthMonitoring: true,
    customConfig: {
      baseUrl: 'http://invalid-url:3000', // Intentionally invalid URL
      maxRetries: 3,
      requestTimeout: 5000,
    },
  });
  
  // Listen for errors
  client.on('error', (error) => {
    console.log('❌ Client Error:', error.message);
  });
  
  // Listen for health alerts
  healthMonitor.on('alert-created', (alert) => {
    console.log('🚨 Health Alert:', alert.message);
  });
  
  // Try to create a trace (will fail)
  try {
    const trace = await client.createTrace({
      name: 'Error Test Trace',
      sessionId: 'error-session',
      input: 'Test error handling',
      output: 'Should fail',
    });
    
    console.log('✅ Trace created (unexpected):', trace?.id);
  } catch (error) {
    console.log('❌ Trace creation failed (expected):', error instanceof Error ? error.message : 'Unknown error');
  }
  
  // Check health status
  const health = await client.runHealthCheck();
  console.log('🏥 Health Status:', health.overall);
  
  // Get validation report
  const validation = await client.runValidation();
  console.log('📋 Validation Status:', validation.overall);
  
  // Cleanup
  await client.shutdown();
}

/**
 * Example 9: Performance Optimization
 * Demonstrates performance optimization features
 */
export async function performanceOptimizationExample(): Promise<void> {
  console.log('⚡ Performance Optimization Example');
  
  const client = new OptimizedLangfuseClient({
    environment: 'development',
    autoOptimize: true,
  });
  
  // Wait for initialization
  await new Promise(resolve => {
    if (client.getClientStatus().initialized) {
      resolve(undefined);
    } else {
      client.once('initialized', resolve);
    }
  });
  
  // Create multiple traces to generate performance data
  const traces = await Promise.all(
    Array.from({ length: 10 }, (_, i) => 
      client.createTrace({
        name: `Performance Test ${i + 1}`,
        sessionId: 'perf-session',
        input: `Test input ${i + 1}`,
        output: `Test output ${i + 1}`,
        metadata: { testNumber: i + 1 },
        tags: ['performance', 'test'],
      })
    )
  );
  
  console.log('✅ Performance traces created:', traces.length);
  
  // Get initial performance metrics
  const initialMetrics = client.getPerformanceMetrics();
  console.log('📊 Initial Metrics:', initialMetrics);
  
  // Optimize configuration based on usage
  const optimizedConfig = client.optimizeConfiguration();
  console.log('⚡ Optimized Configuration:', {
    flushAt: optimizedConfig.flushAt,
    flushInterval: optimizedConfig.flushInterval,
    maxRetries: optimizedConfig.maxRetries,
    requestTimeout: optimizedConfig.requestTimeout,
  });
  
  // Get updated metrics
  const updatedMetrics = client.getPerformanceMetrics();
  console.log('📈 Updated Metrics:', updatedMetrics);
  
  // Generate usage report
  const report = client.generateUsageReport();
  console.log('📋 Usage Report:', report.summary);
  console.log('💡 Recommendations:', report.recommendations);
  
  // Cleanup
  await client.shutdown();
}

/**
 * Example 10: Complete Integration Example
 * Demonstrates full integration with all features
 */
export async function completeIntegrationExample(): Promise<void> {
  console.log('🎯 Complete Integration Example');
  
  // Create fully configured client
  const client = new OptimizedLangfuseClient({
    environment: 'development',
    useCase: 'development',
    enableHealthMonitoring: true,
    enableValidation: true,
    autoOptimize: true,
    customConfig: {
      baseUrl: 'http://localhost:3000',
      flushAt: 1,
      flushInterval: 1000,
      requestTimeout: 30000,
      maxRetries: 3,
    },
  });
  
  // Wait for initialization
  await new Promise(resolve => {
    if (client.getClientStatus().initialized) {
      resolve(undefined);
    } else {
      client.once('initialized', resolve);
    }
  });
  
  // 1. Run validation
  console.log('1️⃣ Running validation...');
  const validation = await client.runValidation();
  console.log('✅ Validation:', validation.overall);
  
  // 2. Check health
  console.log('2️⃣ Checking health...');
  const health = await client.runHealthCheck();
  console.log('✅ Health:', health.overall);
  
  // 3. Create comprehensive trace
  console.log('3️⃣ Creating comprehensive trace...');
  const trace = await client.createTrace({
    name: 'Complete Integration Test',
    sessionId: 'integration-session',
    userId: 'test-user',
    agentId: 'integration-agent',
    swarmId: 'integration-swarm',
    model: 'gpt-4',
    promptTokens: 150,
    completionTokens: 75,
    totalCost: 0.002,
    input: 'Complete integration test',
    output: 'Integration test successful',
    metadata: {
      testType: 'integration',
      version: '1.0.0',
      features: ['validation', 'health', 'monitoring', 'optimization'],
    },
    tags: ['integration', 'test', 'complete'],
  });
  
  console.log('✅ Trace created:', trace?.id);
  
  // 4. Get comprehensive status
  console.log('4️⃣ Getting comprehensive status...');
  const status = client.getClientStatus();
  console.log('📊 Status:', {
    environment: status.environment,
    health: status.health.overall,
    validation: status.validation?.overall,
    metrics: status.metrics,
  });
  
  // 5. Generate final report
  console.log('5️⃣ Generating final report...');
  const report = client.generateUsageReport();
  console.log('📋 Final Report:', report.summary);
  
  // Cleanup
  await client.shutdown();
  console.log('✅ Integration example complete');
}

/**
 * Quick Start Guide
 */
export const QuickStartGuide = {
  /**
   * Development setup (minimal)
   */
  development: async () => {
    const client = optimizedLangfuseClient;
    
    const trace = await client.createTrace({
      name: 'Quick Start Test',
      sessionId: 'quick-start',
      input: 'Hello',
      output: 'World',
    });
    
    console.log('✅ Quick start trace:', trace?.id);
  },
  
  /**
   * Production setup (optimized)
   */
  production: async () => {
    const client = ClientUtils.createProductionClient();
    
    const trace = await client.createTrace({
      name: 'Production Trace',
      sessionId: 'prod-quick-start',
      input: 'Production test',
      output: 'Success',
    });
    
    console.log('✅ Production trace:', trace?.id);
    await client.shutdown();
  },
  
  /**
   * Testing setup (minimal)
   */
  testing: async () => {
    const client = ClientUtils.createTestClient();
    
    const trace = await client.createTrace({
      name: 'Test Trace',
      sessionId: 'test-quick-start',
      input: 'Test',
      output: 'Pass',
    });
    
    console.log('✅ Test trace:', trace?.id);
    await client.shutdown();
  },
};

// Export all examples
export const SDKExamples = {
  basicDevelopmentExample,
  productionExample,
  environmentSwitchingExample,
  healthMonitoringExample,
  validationExample,
  customConfigurationExample,
  swarmTracesExample,
  errorHandlingExample,
  performanceOptimizationExample,
  completeIntegrationExample,
  QuickStartGuide,
};

export default SDKExamples;