/**
 * Integration Examples for Claude-Flow Tracing
 * Shows how to integrate Langfuse tracing in various scenarios
 */

import { tracing, withTracing, traced, autoInitTracing } from './auto-init.js';
import logger from '../utils/logger.js';

/**
 * Example 1: Basic Function Tracing
 */
export async function basicTracingExample() {
  // Wrap any function with tracing
  const tracedFunction = withTracing('example.basic', async (input) => {
    logger.info('Processing input:', input);
    await new Promise(resolve => setTimeout(resolve, 100));
    return { result: `Processed: ${input}` };
  });

  const result = await tracedFunction('test data');
  return result;
}

/**
 * Example 2: Class Method Tracing with Wrapper Functions
 */
export class TracedService {
  constructor() {
    this.name = 'TracedService';
  }

  async processData(data) {
    return await withTracing('service.processData', async () => {
      logger.info('Processing data in service:', data);
      
      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Add custom score
      if (tracing.isEnabled()) {
        const metrics = await tracing.generateMetrics();
        // You would need to get the current trace ID from context
        // This is a simplified example
        logger.info('Current tracing metrics:', metrics);
      }
      
      return { processed: data, timestamp: new Date().toISOString() };
    });
  }

  validateInput(input) {
    return withTracing('service.validateInput', () => {
      if (!input || typeof input !== 'string') {
        throw new Error('Invalid input provided');
      }
      return true;
    });
  }
}

/**
 * Example 3: Manual Trace Management
 */
export async function manualTracingExample() {
  if (!tracing.isEnabled()) {
    logger.info('Tracing not enabled, skipping example');
    return;
  }

  // Start manual trace
  const client = tracing.getClient();
  const result = await client.createTrace('manual.example', {
    operation: 'manual_trace_demo',
    timestamp: new Date().toISOString()
  });

  if (!result) {
    logger.warn('Failed to create manual trace');
    return;
  }

  const { traceId, trace } = result;
  
  try {
    // Create spans for different operations
    const span1 = await client.createSpan(traceId, 'operation.step1', {
      step: 1,
      description: 'First step'
    });

    // Simulate work
    await new Promise(resolve => setTimeout(resolve, 50));
    
    if (span1) {
      await client.updateSpan(span1.spanId, {
        result: 'Step 1 completed'
      }, 'completed');
    }

    const span2 = await client.createSpan(traceId, 'operation.step2', {
      step: 2,
      description: 'Second step'
    });

    // Simulate more work
    await new Promise(resolve => setTimeout(resolve, 75));
    
    if (span2) {
      await client.updateSpan(span2.spanId, {
        result: 'Step 2 completed'
      }, 'completed');
    }

    // Complete the trace
    await client.updateTrace(traceId, {
      totalSteps: 2,
      completedAt: new Date().toISOString()
    }, 'completed');

    // Add performance score
    await client.score(traceId, null, 'performance', 1, 'Operation completed successfully');
    
    logger.info('Manual trace completed:', traceId);
    
  } catch (error) {
    await client.updateTrace(traceId, {
      error: error.message
    }, 'error');
    throw error;
  }
}

/**
 * Example 4: MCP Tool Call Tracing
 */
export async function mcpToolTracingExample() {
  if (!tracing.isEnabled()) {
    logger.info('Tracing not enabled, skipping MCP example');
    return;
  }

  const client = tracing.getClient();
  
  // Simulate MCP tool call
  const { traceId, spanId } = await client.instrumentMCPCall('swarm_init', {
    topology: 'hierarchical',
    maxAgents: 5,
    strategy: 'adaptive'
  });

  try {
    // Simulate tool execution
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const result = {
      swarmId: 'swarm-123',
      agents: 5,
      topology: 'hierarchical',
      status: 'initialized'
    };

    // Complete the instrumentation
    await client.completeMCPCall(traceId, spanId, result, true, null, {
      duration: 300,
      agentsCreated: 5
    });

    logger.info('MCP tool call traced:', traceId);
    return result;
    
  } catch (error) {
    await client.completeMCPCall(traceId, spanId, null, false, error, {
      duration: 300
    });
    throw error;
  }
}

/**
 * Example 5: Swarm Operation Tracing
 */
export async function swarmOperationTracingExample() {
  if (!tracing.isEnabled()) {
    logger.info('Tracing not enabled, skipping swarm example');
    return;
  }

  const client = tracing.getClient();
  
  // Instrument swarm operation
  const { traceId, spanId } = await client.instrumentSwarmOperation('task_orchestration', {
    taskId: 'task-123',
    priority: 'high',
    strategy: 'parallel',
    agentsRequired: 3
  });

  try {
    // Simulate orchestration steps
    const steps = [
      { name: 'agent_allocation', duration: 50 },
      { name: 'task_distribution', duration: 100 },
      { name: 'coordination_setup', duration: 75 },
      { name: 'execution_monitoring', duration: 200 }
    ];

    const stepResults = [];
    
    for (const step of steps) {
      const stepSpan = await client.createSpan(traceId, `orchestration.${step.name}`, {
        stepName: step.name,
        expectedDuration: step.duration
      });

      // Simulate step execution
      await new Promise(resolve => setTimeout(resolve, step.duration));
      
      const stepResult = {
        step: step.name,
        duration: step.duration,
        status: 'completed',
        timestamp: new Date().toISOString()
      };

      stepResults.push(stepResult);
      
      if (stepSpan) {
        await client.updateSpan(stepSpan.spanId, stepResult, 'completed');
      }
    }

    const finalResult = {
      orchestrationId: 'orch-456',
      taskId: 'task-123',
      stepsCompleted: stepResults.length,
      totalDuration: steps.reduce((sum, step) => sum + step.duration, 0),
      status: 'completed'
    };

    // Complete swarm operation
    await client.completeMCPCall(traceId, spanId, finalResult, true, null, {
      duration: finalResult.totalDuration,
      stepsCompleted: stepResults.length
    });

    logger.info('Swarm operation traced:', traceId);
    return finalResult;
    
  } catch (error) {
    await client.completeMCPCall(traceId, spanId, null, false, error, {
      duration: 0
    });
    throw error;
  }
}

/**
 * Example 6: Neural Training Tracing
 */
export async function neuralTrainingTracingExample() {
  if (!tracing.isEnabled()) {
    logger.info('Tracing not enabled, skipping neural example');
    return;
  }

  const client = tracing.getClient();
  
  // Instrument neural training
  const { traceId, spanId } = await client.instrumentNeuralTraining({
    patternType: 'coordination',
    dataSize: 1000,
    iterations: 10,
    model: 'claude-flow-neural-v1'
  });

  try {
    // Simulate training iterations
    const trainingResults = [];
    
    for (let i = 1; i <= 10; i++) {
      const iterationSpan = await client.createSpan(traceId, `training.iteration_${i}`, {
        iteration: i,
        totalIterations: 10
      });

      // Simulate training step
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const accuracy = 0.7 + (i * 0.02); // Simulate improving accuracy
      const loss = 1.0 - (i * 0.08);      // Simulate decreasing loss
      
      const iterationResult = {
        iteration: i,
        accuracy,
        loss,
        timestamp: new Date().toISOString()
      };

      trainingResults.push(iterationResult);
      
      if (iterationSpan) {
        await client.updateSpan(iterationSpan.spanId, iterationResult, 'completed');
      }
    }

    const finalResult = {
      trainingId: 'training-789',
      patternType: 'coordination',
      finalAccuracy: trainingResults[trainingResults.length - 1].accuracy,
      finalLoss: trainingResults[trainingResults.length - 1].loss,
      iterations: trainingResults.length,
      status: 'completed'
    };

    // Complete neural training
    await client.completeMCPCall(traceId, spanId, finalResult, true, null, {
      duration: 500,
      iterations: 10,
      finalAccuracy: finalResult.finalAccuracy
    });

    // Add accuracy score
    await client.score(traceId, null, 'accuracy', finalResult.finalAccuracy, 
      `Final accuracy: ${finalResult.finalAccuracy}`);

    logger.info('Neural training traced:', traceId);
    return finalResult;
    
  } catch (error) {
    await client.completeMCPCall(traceId, spanId, null, false, error, {
      duration: 0
    });
    throw error;
  }
}

/**
 * Example 7: Full Integration Demo
 */
export async function fullIntegrationDemo() {
  logger.info('Starting full integration demo...');

  try {
    // Initialize tracing with context
    const tracingManager = await autoInitTracing({
      context: {
        sessionId: `demo-${Date.now()}`,
        swarmId: 'demo-swarm',
        agentId: 'demo-agent'
      }
    });

    logger.info('Tracing initialized for demo');

    // Run all examples
    await basicTracingExample();
    logger.info('✓ Basic tracing example completed');

    const service = new TracedService();
    await service.processData('demo data');
    logger.info('✓ Class method tracing example completed');

    await manualTracingExample();
    logger.info('✓ Manual tracing example completed');

    await mcpToolTracingExample();
    logger.info('✓ MCP tool tracing example completed');

    await swarmOperationTracingExample();
    logger.info('✓ Swarm operation tracing example completed');

    await neuralTrainingTracingExample();
    logger.info('✓ Neural training tracing example completed');

    // Get final metrics
    const metrics = await tracingManager.generateMetrics();
    logger.info('Final tracing metrics:', metrics);

    // Flush all traces
    await tracingManager.flush();
    logger.info('All traces flushed');

    return {
      success: true,
      message: 'Full integration demo completed successfully',
      metrics
    };

  } catch (error) {
    logger.error('Full integration demo failed:', error);
    throw error;
  }
}

export default {
  basicTracingExample,
  TracedService,
  manualTracingExample,
  mcpToolTracingExample,
  swarmOperationTracingExample,
  neuralTrainingTracingExample,
  fullIntegrationDemo
};