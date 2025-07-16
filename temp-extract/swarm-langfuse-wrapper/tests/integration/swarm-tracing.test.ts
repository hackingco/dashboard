/**
 * Integration tests for complete swarm action tracing
 * Tests the full lifecycle of swarm operations with Langfuse integration
 */

import { jest } from '@jest/globals';
import { LangfuseWrapper, HookContext, TokenUsage } from '../../src';
import { createMockLangfuseClient, createMockLangfuseConstructor } from '../mocks/langfuse.mock';

// Mock dependencies
jest.mock('langfuse');
jest.mock('child_process');

const MockLangfuse = createMockLangfuseConstructor();

// Simulate swarm agent behaviors
class SwarmAgent {
  constructor(
    private wrapper: LangfuseWrapper,
    private agentId: string,
    private agentRole: string,
    private swarmId: string
  ) {}

  async executeTask(taskId: string, taskDescription: string, work: () => Promise<any>) {
    const context: HookContext = {
      hookType: `${this.agentRole}-task`,
      swarmId: this.swarmId,
      agentId: this.agentId,
      agentRole: this.agentRole,
      taskId: taskId,
      operationType: 'task-execution',
      metadata: {
        task_description: taskDescription,
        agent_capabilities: this.getCapabilities()
      }
    };

    const traceId = await this.wrapper.preHook(context);

    try {
      // Simulate task phases with spans
      const spans = await this.executeTaskPhases(traceId!, taskDescription);
      
      // Execute main work
      const result = await work();
      
      // Complete all spans
      for (const span of spans) {
        await this.wrapper.endSpan(span.id, span.result);
      }

      // Calculate token usage based on role
      const tokenUsage = this.calculateTokenUsage(taskDescription, result);
      
      await this.wrapper.postHook(traceId, result, tokenUsage, {
        phases_completed: spans.length,
        execution_time_ms: Date.now() - spans[0].startTime
      });

      return { traceId, result };
    } catch (error) {
      await this.wrapper.errorHook(traceId, error as Error, {
        agent_id: this.agentId,
        task_id: taskId,
        recovery_attempted: true
      });
      throw error;
    }
  }

  private async executeTaskPhases(traceId: string, taskDescription: string) {
    const phases = this.getTaskPhases();
    const spans = [];

    for (const phase of phases) {
      const spanId = await this.wrapper.createSpan(
        traceId,
        `${this.agentRole}-${phase.name}`,
        { phase: phase.name, description: phase.description },
        { agent_id: this.agentId, phase_type: phase.type }
      );

      spans.push({
        id: spanId!,
        startTime: Date.now(),
        result: { 
          phase: phase.name,
          completed: true,
          outputs: phase.outputs
        }
      });

      // Simulate phase execution time
      await new Promise(resolve => setTimeout(resolve, phase.duration));
    }

    return spans;
  }

  private getCapabilities() {
    const capabilities: Record<string, string[]> = {
      researcher: ['search', 'analyze', 'summarize', 'fact-check'],
      coder: ['implement', 'refactor', 'test', 'debug'],
      analyst: ['data-analysis', 'visualization', 'reporting', 'insights'],
      tester: ['unit-test', 'integration-test', 'performance-test', 'security-test'],
      coordinator: ['plan', 'delegate', 'monitor', 'report'],
      architect: ['design', 'model', 'optimize', 'document']
    };

    return capabilities[this.agentRole] || ['general'];
  }

  private getTaskPhases() {
    const phasesByRole: Record<string, any[]> = {
      researcher: [
        { name: 'search', type: 'discovery', duration: 50, outputs: ['sources'] },
        { name: 'analyze', type: 'processing', duration: 100, outputs: ['findings'] },
        { name: 'summarize', type: 'synthesis', duration: 75, outputs: ['summary'] }
      ],
      coder: [
        { name: 'design', type: 'planning', duration: 75, outputs: ['architecture'] },
        { name: 'implement', type: 'creation', duration: 150, outputs: ['code'] },
        { name: 'test', type: 'validation', duration: 100, outputs: ['coverage'] }
      ],
      analyst: [
        { name: 'collect', type: 'gathering', duration: 80, outputs: ['data'] },
        { name: 'process', type: 'transformation', duration: 120, outputs: ['metrics'] },
        { name: 'visualize', type: 'presentation', duration: 90, outputs: ['charts'] }
      ],
      tester: [
        { name: 'prepare', type: 'setup', duration: 60, outputs: ['environment'] },
        { name: 'execute', type: 'testing', duration: 130, outputs: ['results'] },
        { name: 'report', type: 'documentation', duration: 70, outputs: ['report'] }
      ],
      coordinator: [
        { name: 'assess', type: 'evaluation', duration: 40, outputs: ['status'] },
        { name: 'coordinate', type: 'management', duration: 80, outputs: ['assignments'] },
        { name: 'track', type: 'monitoring', duration: 60, outputs: ['progress'] }
      ],
      architect: [
        { name: 'analyze', type: 'requirements', duration: 100, outputs: ['requirements'] },
        { name: 'design', type: 'architecture', duration: 140, outputs: ['blueprints'] },
        { name: 'review', type: 'validation', duration: 80, outputs: ['feedback'] }
      ]
    };

    return phasesByRole[this.agentRole] || [
      { name: 'execute', type: 'general', duration: 100, outputs: ['result'] }
    ];
  }

  private calculateTokenUsage(input: string, output: any): TokenUsage {
    // Simulate realistic token usage based on role
    const baseInput = input.length * 0.25; // ~4 chars per token
    const baseOutput = JSON.stringify(output).length * 0.25;

    const multipliers: Record<string, number> = {
      researcher: 1.5,  // More reading/analysis
      coder: 2.0,       // Code is token-heavy
      analyst: 1.3,     // Data processing
      tester: 1.8,      // Test code and reports
      coordinator: 1.0, // Standard communication
      architect: 1.7    // Complex diagrams/docs
    };

    const multiplier = multipliers[this.agentRole] || 1.0;

    return {
      input: Math.round(baseInput * multiplier),
      output: Math.round(baseOutput * multiplier),
      total: Math.round((baseInput + baseOutput) * multiplier)
    };
  }
}

describe('Swarm Tracing Integration', () => {
  let wrapper: LangfuseWrapper;
  let mockClient: any;
  let mockExecSync: jest.MockedFunction<any>;
  let swarmAgents: Map<string, SwarmAgent>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = createMockLangfuseClient();
    
    // Setup mocks
    (require('langfuse') as any).Langfuse = MockLangfuse;
    MockLangfuse.mockImplementation(() => mockClient);
    
    // Mock SQLite coordination
    mockExecSync = jest.fn()
      .mockReturnValueOnce('6') // 6 active agents
      .mockReturnValueOnce(Date.now().toString()); // recent activity
    (require('child_process') as any).execSync = mockExecSync;
    
    wrapper = new LangfuseWrapper({
      publicKey: 'test-public',
      secretKey: 'test-secret'
    });

    // Initialize swarm agents
    swarmAgents = new Map();
    const swarmId = 'swarm-integration-test';
    const roles = ['researcher', 'coder', 'analyst', 'tester', 'coordinator', 'architect'];
    
    roles.forEach((role, index) => {
      const agent = new SwarmAgent(
        wrapper,
        `agent-${role}-${index}`,
        role,
        swarmId
      );
      swarmAgents.set(role, agent);
    });
  });

  afterEach(async () => {
    if (wrapper) {
      await wrapper.shutdown();
    }
  });

  describe('Full Swarm Operation Lifecycle', () => {
    it('should trace complete swarm task execution', async () => {
      const swarmTask = 'Build a REST API with authentication';
      
      // Coordinator starts the planning
      const coordinatorResult = await swarmAgents.get('coordinator')!.executeTask(
        'task-plan',
        'Create implementation plan',
        async () => ({
          plan: {
            phases: ['research', 'design', 'implement', 'test', 'document'],
            assignments: {
              researcher: ['best-practices', 'security-patterns'],
              architect: ['api-design', 'auth-flow'],
              coder: ['implementation', 'integration'],
              tester: ['test-suite', 'security-audit'],
              analyst: ['performance-metrics', 'usage-patterns']
            }
          }
        })
      );

      expect(coordinatorResult.traceId).toBeTruthy();
      expect(mockClient.trace).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'coordinator-task',
          metadata: expect.objectContaining({
            swarm_id: 'swarm-integration-test',
            agent_role: 'coordinator',
            coordination_memory: {
              activeAgents: 6,
              coordinationState: 'coordinated',
              lastActivity: expect.any(String)
            }
          })
        })
      );

      // Researcher gathers information
      const researcherResult = await swarmAgents.get('researcher')!.executeTask(
        'task-research',
        'Research authentication patterns',
        async () => ({
          findings: {
            patterns: ['JWT', 'OAuth2', 'Session-based'],
            recommendations: {
              preferred: 'JWT',
              reasons: ['stateless', 'scalable', 'standard']
            }
          }
        })
      );

      // Architect designs the system
      const architectResult = await swarmAgents.get('architect')!.executeTask(
        'task-design',
        'Design API architecture',
        async () => ({
          design: {
            endpoints: ['/auth/login', '/auth/logout', '/auth/refresh'],
            middleware: ['authentication', 'authorization', 'rate-limiting'],
            database: { users: ['id', 'email', 'password_hash'] }
          }
        })
      );

      // Verify all traces have proper swarm context
      const traces = mockClient.trace.mock.calls;
      expect(traces.length).toBeGreaterThanOrEqual(3);
      
      traces.forEach(call => {
        expect(call[0].metadata).toMatchObject({
          swarm_id: 'swarm-integration-test',
          swarm_coordination_enabled: true,
          claude_flow_version: expect.any(String)
        });
      });
    });

    it('should handle parallel agent execution with coordination', async () => {
      const parallelTasks = [
        { agent: 'researcher', task: 'research-security', description: 'Security analysis' },
        { agent: 'coder', task: 'implement-auth', description: 'Implement authentication' },
        { agent: 'tester', task: 'test-security', description: 'Security testing' },
        { agent: 'analyst', task: 'analyze-performance', description: 'Performance analysis' }
      ];

      // Execute tasks in parallel
      const results = await Promise.all(
        parallelTasks.map(({ agent, task, description }) =>
          swarmAgents.get(agent)!.executeTask(
            task,
            description,
            async () => ({
              agent,
              task,
              completed: true,
              timestamp: Date.now()
            })
          )
        )
      );

      expect(results).toHaveLength(4);
      
      // Verify each agent's trace has unique ID but same swarm context
      const traceIds = results.map(r => r.traceId);
      expect(new Set(traceIds).size).toBe(4); // All unique

      // Check token usage varies by agent role
      const generationCalls = mockClient.trace.mock.results
        .flatMap(r => r.value.generation.mock.calls);
      
      const tokenUsageByRole = new Map();
      generationCalls.forEach(call => {
        const role = call[0].metadata.agent_role;
        const usage = call[0].usage;
        tokenUsageByRole.set(role, usage);
      });

      // Verify different roles have different token multipliers applied
      expect(tokenUsageByRole.get('coder').totalTokens)
        .toBeGreaterThan(tokenUsageByRole.get('analyst').totalTokens);
    });

    it('should track error recovery across swarm agents', async () => {
      const failingTask = async () => {
        throw new Error('API endpoint failed');
      };

      // Coder encounters an error
      let coderError: any;
      try {
        await swarmAgents.get('coder')!.executeTask(
          'task-failing',
          'Implement failing endpoint',
          failingTask
        );
      } catch (error) {
        coderError = error;
      }

      expect(coderError).toBeDefined();
      expect(coderError.message).toBe('API endpoint failed');

      // Verify error was tracked
      const errorEvents = mockClient.trace.mock.results
        .flatMap(r => r.value.event.mock.calls)
        .filter(call => call[0].name === 'enhanced_error');

      expect(errorEvents).toHaveLength(1);
      expect(errorEvents[0][0]).toMatchObject({
        level: 'ERROR',
        statusMessage: 'API endpoint failed',
        metadata: expect.objectContaining({
          agent_id: 'agent-coder-1',
          recovery_attempted: true
        })
      });

      // Coordinator responds to the error
      const recoveryResult = await swarmAgents.get('coordinator')!.executeTask(
        'task-recovery',
        'Coordinate error recovery',
        async () => ({
          recovery_plan: {
            reassigned_to: 'architect',
            action: 'redesign-endpoint',
            reason: 'Implementation failed, needs architectural review'
          }
        })
      );

      expect(recoveryResult.result.recovery_plan).toBeDefined();
    });
  });

  describe('Cross-Agent Span Correlation', () => {
    it('should correlate spans across multiple agents', async () => {
      const mainTaskId = 'cross-agent-task';
      
      // Coordinator creates main task
      const coordinatorTrace = await wrapper.preHook({
        hookType: 'coordinate-main-task',
        swarmId: 'swarm-correlation',
        agentId: 'coordinator-main',
        agentRole: 'coordinator',
        taskId: mainTaskId
      });

      // Create main coordination span
      const mainSpan = await wrapper.createSpan(
        coordinatorTrace!,
        'main-coordination',
        { task: 'Coordinate multi-agent operation' },
        { correlation_id: mainTaskId }
      );

      // Other agents create correlated spans
      const agentSpans = await Promise.all([
        (async () => {
          const trace = await wrapper.preHook({
            hookType: 'research-subtask',
            swarmId: 'swarm-correlation',
            agentId: 'researcher-1',
            agentRole: 'researcher',
            taskId: `${mainTaskId}-research`
          });
          return wrapper.createSpan(
            trace!,
            'research-analysis',
            { parent_task: mainTaskId },
            { correlation_id: mainTaskId, parent_span: mainSpan }
          );
        })(),
        (async () => {
          const trace = await wrapper.preHook({
            hookType: 'code-subtask',
            swarmId: 'swarm-correlation',
            agentId: 'coder-1',
            agentRole: 'coder',
            taskId: `${mainTaskId}-code`
          });
          return wrapper.createSpan(
            trace!,
            'code-implementation',
            { parent_task: mainTaskId },
            { correlation_id: mainTaskId, parent_span: mainSpan }
          );
        })()
      ]);

      // End all spans
      for (const spanId of agentSpans) {
        await wrapper.endSpan(spanId!, { subtask_complete: true });
      }
      await wrapper.endSpan(mainSpan!, { all_subtasks_complete: true });

      // Verify correlation metadata
      const spanCalls = mockClient.trace.mock.results
        .flatMap(r => r.value.span.mock.calls);
      
      const correlatedSpans = spanCalls.filter(
        call => call[0].metadata?.correlation_id === mainTaskId
      );

      expect(correlatedSpans.length).toBeGreaterThanOrEqual(3); // main + 2 agent spans
    });
  });

  describe('Performance Metrics Across Swarm', () => {
    it('should collect and aggregate performance metrics', async () => {
      const performanceTasks = Array(5).fill(0).map((_, i) => ({
        agent: ['researcher', 'coder', 'analyst'][i % 3],
        taskId: `perf-task-${i}`,
        description: `Performance test task ${i}`
      }));

      const startTime = Date.now();
      
      const results = await Promise.all(
        performanceTasks.map(({ agent, taskId, description }) =>
          swarmAgents.get(agent)!.executeTask(
            taskId,
            description,
            async () => {
              // Simulate varying workloads
              await new Promise(resolve => 
                setTimeout(resolve, 50 + Math.random() * 150)
              );
              return {
                processed: Math.floor(Math.random() * 1000),
                duration: Date.now() - startTime
              };
            }
          )
        )
      );

      const totalDuration = Date.now() - startTime;

      // Verify all tasks completed
      expect(results).toHaveLength(5);
      
      // Check efficiency scores in metadata
      const spanCalls = mockClient.trace.mock.results
        .flatMap(r => r.value.span.mock.calls);
      
      const efficiencyScores = spanCalls
        .map(call => call[0].metadata?.efficiency_score)
        .filter(score => score !== undefined);

      expect(efficiencyScores.length).toBeGreaterThan(0);
      efficiencyScores.forEach(score => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      });

      // Verify total execution time is reasonable
      expect(totalDuration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should track memory usage patterns', async () => {
      // Execute memory-intensive tasks
      const memoryTasks = Array(10).fill(0).map((_, i) => ({
        agent: 'analyst',
        taskId: `memory-task-${i}`,
        data: Array(1000).fill({ index: i, data: 'x'.repeat(100) })
      }));

      for (const { agent, taskId, data } of memoryTasks) {
        await swarmAgents.get(agent)!.executeTask(
          taskId,
          'Process large dataset',
          async () => ({
            processed: data.length,
            summary: `Processed ${data.length} records`
          })
        );
      }

      // Verify no memory leaks - all traces should be cleaned up
      expect(wrapper.getActiveTraceCount()).toBe(0);
      expect(wrapper.getActiveSpanCount()).toBe(0);
    });
  });

  describe('Swarm Coordination Patterns', () => {
    it('should implement leader-follower pattern', async () => {
      // Architect acts as leader
      const leaderResult = await swarmAgents.get('architect')!.executeTask(
        'leader-task',
        'Design system architecture',
        async () => ({
          design: {
            components: ['auth-service', 'api-gateway', 'database'],
            assignments: {
              'auth-service': 'coder-1',
              'api-gateway': 'coder-2',
              'database': 'analyst-1'
            }
          }
        })
      );

      // Followers execute based on leader's design
      const followerTasks = [
        {
          agent: 'coder',
          component: 'auth-service',
          work: async () => ({ implemented: 'JWT authentication' })
        },
        {
          agent: 'analyst',
          component: 'database',
          work: async () => ({ schema: { users: {}, sessions: {} } })
        }
      ];

      const followerResults = await Promise.all(
        followerTasks.map(({ agent, component, work }) =>
          swarmAgents.get(agent)!.executeTask(
            `implement-${component}`,
            `Implement ${component}`,
            work
          )
        )
      );

      // Verify leader-follower relationship in traces
      expect(leaderResult.traceId).toBeTruthy();
      expect(followerResults).toHaveLength(2);
      
      // Check that follower traces reference the leader's design
      const traces = mockClient.trace.mock.calls;
      const followerTraces = traces.slice(-2); // Last two traces
      
      followerTraces.forEach(call => {
        expect(call[0].metadata.agent_role).toMatch(/coder|analyst/);
      });
    });

    it('should implement peer-to-peer coordination', async () => {
      // Multiple agents coordinate without a central leader
      const peerTasks = [
        { agent: 'researcher', topic: 'security-patterns' },
        { agent: 'coder', topic: 'implementation-patterns' },
        { agent: 'tester', topic: 'testing-patterns' }
      ];

      // Each peer shares findings with others
      const peerResults = new Map();
      
      for (const { agent, topic } of peerTasks) {
        const result = await swarmAgents.get(agent)!.executeTask(
          `peer-${topic}`,
          `Research ${topic}`,
          async () => ({
            topic,
            findings: [`${topic}-1`, `${topic}-2`],
            shared_with: peerTasks.filter(p => p.agent !== agent).map(p => p.agent)
          })
        );
        peerResults.set(agent, result);
      }

      // Verify all peers completed their tasks
      expect(peerResults.size).toBe(3);
      
      // Check coordination context shows multiple active agents
      const traces = mockClient.trace.mock.calls;
      traces.forEach(call => {
        if (call[0].metadata.coordination_memory) {
          expect(call[0].metadata.coordination_memory.activeAgents).toBeGreaterThan(1);
          expect(call[0].metadata.coordination_memory.coordinationState).toBe('coordinated');
        }
      });
    });
  });

  describe('Advanced Swarm Scenarios', () => {
    it('should handle agent failure and reassignment', async () => {
      let failedAgentTask: any;
      
      // Simulate agent failure
      try {
        await swarmAgents.get('coder')!.executeTask(
          'critical-implementation',
          'Implement critical feature',
          async () => {
            // Simulate partial completion then failure
            await new Promise(resolve => setTimeout(resolve, 100));
            throw new Error('Agent crashed - out of memory');
          }
        );
      } catch (error) {
        failedAgentTask = error;
      }

      expect(failedAgentTask.message).toContain('Agent crashed');

      // Coordinator detects failure and reassigns
      const reassignmentResult = await swarmAgents.get('coordinator')!.executeTask(
        'reassign-critical-task',
        'Reassign failed task to available agent',
        async () => ({
          reassignment: {
            original_agent: 'coder',
            new_agent: 'architect',
            reason: 'Agent failure - memory exhaustion',
            recovery_strategy: 'restart-with-optimization'
          }
        })
      );

      expect(reassignmentResult.result.reassignment.new_agent).toBe('architect');

      // New agent completes the task
      const recoveryResult = await swarmAgents.get('architect')!.executeTask(
        'critical-implementation-recovery',
        'Complete critical feature with optimizations',
        async () => ({
          implemented: true,
          optimizations: ['memory-pooling', 'lazy-loading', 'caching']
        })
      );

      expect(recoveryResult.result.implemented).toBe(true);
    });

    it('should scale swarm dynamically based on load', async () => {
      // Simulate high load scenario
      const loadTestTasks = Array(20).fill(0).map((_, i) => ({
        id: `load-${i}`,
        priority: i < 5 ? 'high' : i < 15 ? 'medium' : 'low',
        estimatedTokens: 1000 + Math.random() * 4000
      }));

      // Coordinator assesses load and scales
      const scalingDecision = await swarmAgents.get('coordinator')!.executeTask(
        'assess-scaling-needs',
        'Evaluate workload and scale swarm',
        async () => {
          const totalTokens = loadTestTasks.reduce((sum, t) => sum + t.estimatedTokens, 0);
          const avgTokensPerAgent = totalTokens / swarmAgents.size;
          
          return {
            current_agents: swarmAgents.size,
            total_workload: totalTokens,
            avg_load_per_agent: avgTokensPerAgent,
            scaling_decision: avgTokensPerAgent > 5000 ? 'scale-up' : 'maintain',
            recommended_agents: Math.ceil(totalTokens / 5000)
          };
        }
      );

      expect(scalingDecision.result.scaling_decision).toBeDefined();
      
      // Simulate adding new agents if needed
      if (scalingDecision.result.scaling_decision === 'scale-up') {
        const newAgentCount = scalingDecision.result.recommended_agents - swarmAgents.size;
        
        for (let i = 0; i < newAgentCount; i++) {
          const newAgent = new SwarmAgent(
            wrapper,
            `agent-scaled-${i}`,
            'coder', // Add more coders for implementation work
            'swarm-integration-test'
          );
          swarmAgents.set(`coder-scaled-${i}`, newAgent);
        }
      }

      // Distribute high-priority tasks
      const highPriorityTasks = loadTestTasks.filter(t => t.priority === 'high');
      const taskAssignments = await Promise.all(
        highPriorityTasks.map((task, i) => {
          const agent = Array.from(swarmAgents.values())[i % swarmAgents.size];
          return agent.executeTask(
            task.id,
            `Process high-priority task ${task.id}`,
            async () => ({
              task_id: task.id,
              processed: true,
              tokens_used: task.estimatedTokens
            })
          );
        })
      );

      expect(taskAssignments).toHaveLength(highPriorityTasks.length);
    });
  });
});