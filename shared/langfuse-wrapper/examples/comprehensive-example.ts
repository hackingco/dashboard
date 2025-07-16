/**
 * Comprehensive example demonstrating all features of the Langfuse wrapper
 * Shows integration with Claude Flow swarm orchestration
 */

import {
  initializeLangfuse,
  getLangfuse,
  getSwarmTracer,
  getTraceContextManager,
  LangfuseConfig
} from '../src';

// Example swarm operation
async function runSwarmExample() {
  // Initialize Langfuse with configuration
  const config: Partial<LangfuseConfig> = {
    publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
    secretKey: process.env.LANGFUSE_SECRET_KEY!,
    host: process.env.LANGFUSE_HOST || 'https://cloud.langfuse.com',
    enabled: true,
    debug: true,
    swarmTracingEnabled: true,
    coordinationMemoryEnabled: true,
    samplingRate: 1.0,
    samplingRules: [
      {
        condition: 'agentRole',
        value: 'coordinator',
        rate: 1.0 // Always sample coordinators
      },
      {
        condition: 'agentRole',
        value: 'researcher',
        rate: 0.5 // Sample 50% of researchers
      }
    ]
  };

  // Initialize the wrapper
  const langfuse = await initializeLangfuse(config);
  console.log('Langfuse initialized successfully');

  // Get components
  const { wrapper, swarmTracer, contextManager } = langfuse;

  // Example 1: Basic trace with wrapper
  console.log('\n=== Example 1: Basic Trace ==="');
  const basicTraceId = await wrapper.preHook({
    hookType: 'example_operation',
    swarmId: 'example-swarm-001',
    agentId: 'agent-001',
    agentRole: 'coordinator',
    metadata: {
      example: true,
      timestamp: new Date().toISOString()
    }
  });

  // Simulate some work
  await new Promise(resolve => setTimeout(resolve, 100));

  // Complete the trace
  await wrapper.postHook(
    basicTraceId,
    { result: 'success', data: { processed: 42 } },
    { input: 100, output: 200, total: 300 },
    { completionTime: new Date().toISOString() }
  );

  // Example 2: Swarm orchestration
  console.log('\n=== Example 2: Swarm Orchestration ==="');
  const swarmId = 'swarm-' + Date.now();
  
  // Start swarm trace
  await swarmTracer.startSwarmTrace(
    swarmId,
    'hierarchical',
    5,
    {
      projectName: 'Example Project',
      description: 'Demonstrating swarm tracing'
    }
  );

  // Spawn agents
  const agents = [
    { id: 'researcher-1', role: 'researcher', capabilities: ['web_search', 'analysis'] },
    { id: 'coder-1', role: 'coder', capabilities: ['typescript', 'python'] },
    { id: 'analyst-1', role: 'analyst', capabilities: ['data_processing', 'visualization'] }
  ];

  for (const agent of agents) {
    await swarmTracer.traceAgentSpawn(
      {
        actionType: 'spawn',
        agentId: agent.id,
        agentRole: agent.role,
        swarmId,
        timestamp: Date.now()
      },
      agent.capabilities
    );
  }

  // Example 3: Task assignment and execution
  console.log('\n=== Example 3: Task Execution ==="');
  const taskId = 'task-001';
  
  // Assign task
  await swarmTracer.traceTaskAssignment(
    taskId,
    'researcher-1',
    swarmId,
    'Research best practices for distributed tracing',
    'high'
  );

  // Simulate task execution with context propagation
  const context = contextManager.createContext(
    swarmId,
    'researcher-1',
    'researcher'
  );

  // Add baggage
  contextManager.setBaggage('researcher-1', 'task_type', 'research');
  contextManager.setBaggage('researcher-1', 'priority', 'high');

  // Start a span for the task
  const taskContext = contextManager.startSpan(
    'researcher-1',
    'research_operation',
    taskId
  );

  // Simulate research work
  await new Promise(resolve => setTimeout(resolve, 200));

  // Complete the span
  contextManager.endSpan('researcher-1');

  // Complete the task
  await swarmTracer.traceTaskCompletion(
    taskId,
    'researcher-1',
    swarmId,
    {
      findings: [
        'Use W3C Trace Context for distributed tracing',
        'Implement baggage propagation for metadata',
        'Use OpenTelemetry standards where possible'
      ]
    },
    { input: 150, output: 300, total: 450 }
  );

  // Example 4: Agent communication
  console.log('\n=== Example 4: Agent Communication ==="');
  await swarmTracer.traceAgentCommunication(
    'researcher-1',
    'coder-1',
    swarmId,
    'task_handoff',
    {
      message: 'Research complete, please implement based on findings',
      findings: ['Use async/await patterns', 'Implement error boundaries']
    }
  );

  // Example 5: Error handling
  console.log('\n=== Example 5: Error Handling ==="');
  try {
    // Simulate an error
    throw new Error('Simulated task failure');
  } catch (error) {
    await swarmTracer.traceSwarmError(
      swarmId,
      'coder-1',
      error as Error,
      {
        taskId: 'task-002',
        operation: 'implementation',
        recoverable: true
      }
    );
  }

  // Example 6: Distributed context propagation
  console.log('\n=== Example 6: Context Propagation ==="');
  
  // Extract context for cross-service communication
  const currentContext = contextManager.getCurrentContext('researcher-1');
  if (currentContext) {
    const headers = contextManager.inject(currentContext);
    console.log('Propagation headers:', headers);
    
    // Simulate receiving in another service
    const extractedContext = contextManager.extract(headers);
    console.log('Extracted context:', extractedContext);
  }

  // Example 7: Get swarm metrics
  console.log('\n=== Example 7: Swarm Metrics ==="');
  const metrics = swarmTracer.getSwarmMetrics(swarmId);
  console.log('Swarm metrics:', metrics);

  // Example 8: Coordination history
  console.log('\n=== Example 8: Coordination History ==="');
  const history = await swarmTracer.getCoordinationHistory(swarmId);
  console.log(`Found ${history.length} coordination events`);
  history.slice(0, 3).forEach(event => {
    console.log(`- ${event.eventType}: ${event.source} -> ${event.target || 'all'}}`);
  });

  // Example 9: Trace timeline
  console.log('\n=== Example 9: Trace Timeline ==="');
  const timeline = await contextManager.getTraceTimeline(swarmId);
  console.log(`Timeline contains ${timeline.length} spans`);

  // Complete the swarm
  await swarmTracer.completeSwarmTrace(swarmId, {
    status: 'completed',
    tasksCompleted: 2,
    duration: Date.now() - parseInt(swarmId.split('-')[1]),
    summary: 'Example swarm completed successfully'
  });

  console.log('\n=== All examples completed ==="');
}

// Example with error handling
async function main() {
  try {
    await runSwarmExample();
  } catch (error) {
    console.error('Error in example:', error);
  } finally {
    // Ensure proper cleanup
    const langfuse = getLangfuse();
    if (langfuse) {
      await langfuse.wrapper.shutdown();
    }
  }
}

// Run the example
if (require.main === module) {
  main();
}

export { runSwarmExample };