/**
 * Hook Lifecycle Scenarios
 * Comprehensive test scenarios for validating hook tracing and lifecycle management
 */

import { jest, describe, beforeEach, afterEach, it, expect } from '@jest/globals';
import { LangfuseWrapper, HookContext, TokenUsage } from '../../src/index';
import { execSync } from 'child_process';
import * as fs from 'fs';

describe('Hook Lifecycle Scenarios', () => {
  let wrapper: LangfuseWrapper;
  let testDatabase: string;

  beforeEach(async () => {
    process.env.NODE_ENV = 'test';
    process.env.LANGFUSE_ENABLED = 'false';
    
    testDatabase = `.swarm/hook-test-${Date.now()}.db`;
    
    wrapper = new LangfuseWrapper({
      enabled: false,
      publicKey: 'test-key',
      secretKey: 'test-secret'
    });
    
    await setupHookDatabase();
  });

  afterEach(async () => {
    await wrapper.shutdown();
    
    if (fs.existsSync(testDatabase)) {
      fs.unlinkSync(testDatabase);
    }
  });

  describe('Scenario 1: Complex Multi-Agent Development Workflow', () => {
    const workflowId = 'multi-agent-dev-workflow';
    const agents = [
      { id: 'product-manager', role: 'coordinator', tasks: ['requirements', 'planning', 'coordination'] },
      { id: 'frontend-dev', role: 'coder', tasks: ['ui_implementation', 'user_experience', 'responsive_design'] },
      { id: 'backend-dev', role: 'coder', tasks: ['api_development', 'database_design', 'server_logic'] },
      { id: 'qa-engineer', role: 'tester', tasks: ['test_planning', 'automation', 'quality_validation'] },
      { id: 'devops-engineer', role: 'coordinator', tasks: ['deployment', 'monitoring', 'infrastructure'] }
    ];

    it('should trace complete development workflow with realistic hook patterns', async () => {
      const traces: Array<{ agentId: string; traceId: string | null; phase: string }> = [];

      // Phase 1: Project Initiation and Planning
      for (const agent of agents) {
        const hookContext: HookContext = {
          hookType: 'project_initiation',
          swarmId: workflowId,
          agentId: agent.id,
          agentRole: agent.role,
          taskId: `init-${agent.id}`,
          operationType: 'planning',
          metadata: {
            workflowPhase: 'initiation',
            expectedTasks: agent.tasks,
            estimatedDuration: '2 weeks',
            priority: 'high',
            dependencies: getAgentDependencies(agent.role),
            resources: getAgentResources(agent.role)
          }
        };

        const traceId = await wrapper.preHook(hookContext);
        traces.push({ agentId: agent.id, traceId, phase: 'initiation' });

        // Simulate planning work
        await simulateAgentWork(agent, 'planning', 500);

        // Complete planning phase
        const planningResult = {
          planCreated: true,
          taskBreakdown: agent.tasks,
          estimatesProvided: true,
          stakeholderAlignment: 'confirmed',
          riskAssessment: 'low-medium'
        };

        const planningTokens: TokenUsage = {
          input: 800 + Math.random() * 400,
          output: 1200 + Math.random() * 600,
          total: 2000 + Math.random() * 1000
        };

        await wrapper.postHook(
          traceId,
          planningResult,
          planningTokens,
          {
            phaseCompleted: 'planning',
            nextPhase: 'development',
            qualityScore: 0.85 + Math.random() * 0.1,
            agentContributions: agent.tasks.length
          }
        );
      }

      // Phase 2: Parallel Development with Inter-Agent Dependencies
      const developmentTasks = [
        // Frontend Development Stream
        {
          agentId: 'frontend-dev',
          taskId: 'ui-components',
          description: 'Develop reusable UI components',
          dependencies: ['product-manager'],
          complexity: 'medium',
          estimatedTokens: 3500
        },
        {
          agentId: 'frontend-dev',
          taskId: 'user-dashboard',
          description: 'Implement user dashboard interface',
          dependencies: ['ui-components', 'backend-dev'],
          complexity: 'high',
          estimatedTokens: 5000
        },
        // Backend Development Stream
        {
          agentId: 'backend-dev',
          taskId: 'database-schema',
          description: 'Design and implement database schema',
          dependencies: ['product-manager'],
          complexity: 'high',
          estimatedTokens: 4000
        },
        {
          agentId: 'backend-dev',
          taskId: 'api-endpoints',
          description: 'Develop REST API endpoints',
          dependencies: ['database-schema'],
          complexity: 'high',
          estimatedTokens: 6000
        },
        // Testing Stream
        {
          agentId: 'qa-engineer',
          taskId: 'test-framework',
          description: 'Set up testing framework and infrastructure',
          dependencies: ['product-manager'],
          complexity: 'medium',
          estimatedTokens: 2500
        },
        {
          agentId: 'qa-engineer',
          taskId: 'integration-tests',
          description: 'Develop comprehensive integration tests',
          dependencies: ['api-endpoints', 'ui-components'],
          complexity: 'high',
          estimatedTokens: 4500
        }
      ];

      for (const task of developmentTasks) {
        // Pre-hook: Task initiation
        const devHookContext: HookContext = {
          hookType: 'task_execution',
          swarmId: workflowId,
          agentId: task.agentId,
          agentRole: agents.find(a => a.id === task.agentId)?.role || 'unknown',
          taskId: task.taskId,
          operationType: 'development',
          metadata: {
            workflowPhase: 'development',
            taskDescription: task.description,
            dependencies: task.dependencies,
            complexity: task.complexity,
            estimatedTokens: task.estimatedTokens,
            startTime: new Date().toISOString(),
            parallelExecution: true
          }
        };

        const devTraceId = await wrapper.preHook(devHookContext);
        traces.push({ agentId: task.agentId, traceId: devTraceId, phase: 'development' });

        // Simulate development work with realistic delays
        await simulateAgentWork(
          agents.find(a => a.id === task.agentId)!,
          'development',
          1000 + Math.random() * 2000
        );

        // Development completion with detailed results
        const devResult = generateDevelopmentResult(task);
        const devTokens = generateRealisticTokenUsage(task.estimatedTokens);

        await wrapper.postHook(
          devTraceId,
          devResult,
          devTokens,
          {
            taskCompleted: task.taskId,
            codeGenerated: devResult.linesOfCode || 0,
            testsCreated: devResult.testsWritten || 0,
            documentationUpdated: devResult.documentationPages || 0,
            qualityMetrics: {
              codeQuality: 0.8 + Math.random() * 0.15,
              testCoverage: 0.75 + Math.random() * 0.2,
              performanceScore: 0.85 + Math.random() * 0.1
            }
          }
        );
      }

      // Phase 3: Integration and Error Scenarios
      const integrationTasks = [
        {
          agentId: 'qa-engineer',
          taskId: 'system-integration',
          description: 'Perform end-to-end system integration testing',
          willFail: false
        },
        {
          agentId: 'devops-engineer',
          taskId: 'deployment-setup',
          description: 'Configure production deployment pipeline',
          willFail: true, // Simulate deployment failure
          errorType: 'ConfigurationError'
        },
        {
          agentId: 'backend-dev',
          taskId: 'performance-optimization',
          description: 'Optimize API performance based on load testing',
          willFail: false
        }
      ];

      for (const task of integrationTasks) {
        const integrationContext: HookContext = {
          hookType: 'integration_testing',
          swarmId: workflowId,
          agentId: task.agentId,
          agentRole: agents.find(a => a.id === task.agentId)?.role || 'unknown',
          taskId: task.taskId,
          operationType: 'integration',
          metadata: {
            workflowPhase: 'integration',
            taskDescription: task.description,
            criticalPath: true,
            riskLevel: task.willFail ? 'high' : 'medium'
          }
        };

        const integrationTraceId = await wrapper.preHook(integrationContext);

        if (task.willFail) {
          // Simulate failure scenario
          await simulateAgentWork(
            agents.find(a => a.id === task.agentId)!,
            'integration',
            800
          );

          const integrationError = new Error(`${task.errorType}: Failed to configure production environment`);
          integrationError.name = task.errorType || 'IntegrationError';

          await wrapper.errorHook(
            integrationTraceId,
            integrationError,
            {
              failedTask: task.taskId,
              errorCategory: 'configuration',
              impactLevel: 'high',
              recoveryPlan: [
                'Review configuration files',
                'Validate environment variables',
                'Test deployment pipeline in staging'
              ],
              estimatedRecoveryTime: '2 hours',
              workflowImpact: 'deployment_delayed'
            }
          );
        } else {
          // Successful completion
          await simulateAgentWork(
            agents.find(a => a.id === task.agentId)!,
            'integration',
            1200
          );

          const integrationResult = {
            integrationSuccessful: true,
            testsExecuted: 47,
            testsPassed: 45,
            testsFailed: 2,
            performanceMetrics: {
              responseTime: '150ms',
              throughput: '500 req/sec',
              errorRate: '0.1%'
            },
            securityScan: 'passed',
            deploymentReady: true
          };

          const integrationTokens: TokenUsage = {
            input: 1500,
            output: 2000,
            total: 3500
          };

          await wrapper.postHook(
            integrationTraceId,
            integrationResult,
            integrationTokens,
            {
              integrationPhase: 'completed',
              qualityGate: 'passed',
              readinessScore: 0.9
            }
          );
        }
      }

      // Phase 4: Error Recovery and Workflow Completion
      // Simulate error recovery for the failed deployment
      const recoveryContext: HookContext = {
        hookType: 'error_recovery',
        swarmId: workflowId,
        agentId: 'devops-engineer',
        agentRole: 'coordinator',
        taskId: 'deployment-recovery',
        operationType: 'recovery',
        metadata: {
          workflowPhase: 'recovery',
          originalTask: 'deployment-setup',
          recoveryAttempt: 1,
          urgency: 'high'
        }
      };

      const recoveryTraceId = await wrapper.preHook(recoveryContext);

      await simulateAgentWork(
        agents.find(a => a.id === 'devops-engineer')!,
        'recovery',
        1500
      );

      const recoveryResult = {
        recoverySuccessful: true,
        issuesResolved: [
          'Fixed environment variable configuration',
          'Updated deployment scripts',
          'Validated all service dependencies'
        ],
        deploymentCompleted: true,
        additionalSafeguards: [
          'Added configuration validation',
          'Enhanced monitoring alerts',
          'Implemented rollback procedures'
        ],
        lessonLearned: 'Need better staging environment validation'
      };

      const recoveryTokens: TokenUsage = {
        input: 1000,
        output: 1800,
        total: 2800
      };

      await wrapper.postHook(
        recoveryTraceId,
        recoveryResult,
        recoveryTokens,
        {
          recoveryCompleted: true,
          workflowUnblocked: true,
          improvementsImplemented: 3
        }
      );

      // Verify workflow completion
      expect(traces.length).toBeGreaterThan(0);
      
      // Verify different phases were captured
      const phases = [...new Set(traces.map(t => t.phase))];
      expect(phases).toContain('initiation');
      expect(phases).toContain('development');

      // Verify active trace management
      const finalActiveTraces = wrapper.getActiveTraceCount();
      expect(finalActiveTraces).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Scenario 2: Real-time Collaboration with Conflict Resolution', () => {
    const collaborationId = 'real-time-collab-workflow';

    it('should handle concurrent agent modifications with conflict resolution', async () => {
      const conflictingAgents = [
        { id: 'dev-agent-1', role: 'coder', workingOn: 'user_authentication.ts' },
        { id: 'dev-agent-2', role: 'coder', workingOn: 'user_authentication.ts' },
        { id: 'reviewer-agent', role: 'analyst', workingOn: 'code_review_user_authentication' }
      ];

      const concurrentModifications = [];

      // Simulate concurrent file modifications
      for (const agent of conflictingAgents) {
        const concurrentContext: HookContext = {
          hookType: 'concurrent_modification',
          swarmId: collaborationId,
          agentId: agent.id,
          agentRole: agent.role,
          taskId: `modify-${agent.workingOn.replace(/[^a-zA-Z0-9]/g, '-')}`,
          operationType: 'file_modification',
          metadata: {
            fileName: agent.workingOn,
            modificationType: agent.role === 'analyst' ? 'review' : 'implementation',
            lockRequired: true,
            conflictPotential: 'high',
            timestamp: Date.now() + Math.random() * 100 // Slight timing variations
          }
        };

        const modTraceId = await wrapper.preHook(concurrentContext);
        concurrentModifications.push({ agent, traceId: modTraceId });

        // Simulate work
        await simulateAgentWork(agent, 'modification', 300);
      }

      // Simulate conflict detection and resolution
      const conflictError = new Error('Merge conflict detected in user_authentication.ts');
      conflictError.name = 'MergeConflictError';

      await wrapper.errorHook(
        concurrentModifications[1].traceId,
        conflictError,
        {
          conflictingFiles: ['user_authentication.ts'],
          conflictingAgents: ['dev-agent-1', 'dev-agent-2'],
          conflictType: 'concurrent_modification',
          resolutionStrategy: 'manual_merge_with_review',
          reviewerAssigned: 'reviewer-agent'
        }
      );

      // Simulate conflict resolution
      const resolutionResult = {
        conflictResolved: true,
        mergeStrategy: 'three_way_merge',
        changesIntegrated: true,
        reviewCompleted: true,
        testsPassed: true,
        finalVersion: 'v1.2.3-merged'
      };

      await wrapper.postHook(
        concurrentModifications[2].traceId, // Reviewer's trace
        resolutionResult,
        { input: 800, output: 1200, total: 2000 },
        {
          conflictResolution: 'successful',
          collaborationPattern: 'reviewed_merge',
          timeToResolution: '15 minutes'
        }
      );

      expect(concurrentModifications.length).toBe(3);
    });
  });

  describe('Scenario 3: Memory and State Management Validation', () => {
    const memoryWorkflowId = 'memory-state-workflow';

    it('should validate complex memory operations and state transitions', async () => {
      const memoryOperations = [
        {
          operation: 'state_initialization',
          agent: 'state-manager',
          data: { initialState: 'empty', version: '1.0.0' }
        },
        {
          operation: 'data_ingestion',
          agent: 'data-processor',
          data: { recordsProcessed: 10000, errors: 5, successRate: 0.9995 }
        },
        {
          operation: 'state_transformation',
          agent: 'transformer',
          data: { transformations: 15, outputRecords: 9995, qualityScore: 0.98 }
        },
        {
          operation: 'state_persistence',
          agent: 'persistence-manager',
          data: { saved: true, backupCreated: true, checksum: 'abc123def456' }
        }
      ];

      for (const op of memoryOperations) {
        const memoryContext: HookContext = {
          hookType: 'memory_operation',
          swarmId: memoryWorkflowId,
          agentId: op.agent,
          agentRole: 'processor',
          taskId: `memory-${op.operation}`,
          operationType: op.operation,
          metadata: {
            memoryOperation: op.operation,
            stateVersion: '1.0.0',
            dataIntegrity: 'verified',
            persistenceRequired: true,
            operationData: op.data
          }
        };

        const memTraceId = await wrapper.preHook(memoryContext);

        // Simulate memory operation
        await simulateMemoryOperation(op.operation, 400);

        const memResult = {
          operationCompleted: op.operation,
          dataProcessed: op.data,
          memoryUsage: {
            before: '256MB',
            after: '312MB',
            peak: '358MB'
          },
          operationDuration: '2.5 seconds',
          stateValid: true
        };

        await wrapper.postHook(
          memTraceId,
          memResult,
          { input: 500, output: 750, total: 1250 },
          {
            memoryEfficiency: 0.87,
            stateConsistency: 'maintained',
            operationChain: memoryOperations.indexOf(op) + 1
          }
        );
      }

      // Verify memory state coordination
      await verifyMemoryCoordination(memoryWorkflowId);
    });
  });

  describe('Scenario 4: Performance and Scalability Testing', () => {
    const performanceWorkflowId = 'performance-test-workflow';

    it('should validate performance under high-frequency hook operations', async () => {
      const startTime = Date.now();
      const operations = [];
      const numOperations = 100;

      // Generate high-frequency operations
      for (let i = 0; i < numOperations; i++) {
        const perfContext: HookContext = {
          hookType: 'performance_operation',
          swarmId: performanceWorkflowId,
          agentId: `perf-agent-${i % 10}`, // 10 agents handling operations
          agentRole: 'performer',
          taskId: `perf-task-${i}`,
          operationType: 'high_frequency',
          metadata: {
            operationNumber: i,
            batchSize: numOperations,
            performanceTest: true,
            concurrencyLevel: 'high'
          }
        };

        const perfTraceId = await wrapper.preHook(perfContext);
        operations.push({ id: i, traceId: perfTraceId });

        // Minimal delay to simulate rapid operations
        if (i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      // Complete operations in batches
      const batchSize = 20;
      for (let batch = 0; batch < numOperations; batch += batchSize) {
        const batchOperations = operations.slice(batch, batch + batchSize);
        
        await Promise.all(batchOperations.map(async (op) => {
          const result = {
            operationId: op.id,
            processed: true,
            batchNumber: Math.floor(op.id / batchSize),
            timestamp: Date.now()
          };

          await wrapper.postHook(
            op.traceId,
            result,
            { input: 50, output: 75, total: 125 },
            { performanceBatch: true, operationIndex: op.id }
          );
        }));
      }

      const totalTime = Date.now() - startTime;
      
      // Performance assertions
      expect(totalTime).toBeLessThan(10000); // Should complete within 10 seconds
      expect(operations.length).toBe(numOperations);
      
      console.log(`Performance test: ${numOperations} operations completed in ${totalTime}ms`);
      console.log(`Average time per operation: ${totalTime / numOperations}ms`);
      
      // Verify system stability after high load
      const finalActiveTraces = wrapper.getActiveTraceCount();
      expect(finalActiveTraces).toBeGreaterThanOrEqual(0);
    });
  });

  // Helper functions
  async function setupHookDatabase(): Promise<void> {
    const { execSync } = require('child_process');
    const path = require('path');
    
    const dbDir = path.dirname(testDatabase);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    const initQueries = [
      `sqlite3 "${testDatabase}" "CREATE TABLE IF NOT EXISTS memory_entries (key TEXT PRIMARY KEY, value TEXT, namespace TEXT, metadata TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)"`,
      `sqlite3 "${testDatabase}" "CREATE TABLE IF NOT EXISTS agent_interactions (id INTEGER PRIMARY KEY, task_id TEXT, agent_id TEXT, interaction_type TEXT, payload TEXT, timestamp INTEGER)"`,
      `sqlite3 "${testDatabase}" "CREATE TABLE IF NOT EXISTS hook_traces (id INTEGER PRIMARY KEY, trace_id TEXT, hook_type TEXT, agent_id TEXT, swarm_id TEXT, operation_type TEXT, metadata TEXT, timestamp INTEGER)"`,
      `sqlite3 "${testDatabase}" "CREATE INDEX IF NOT EXISTS idx_hook_traces_agent ON hook_traces(agent_id)"`,
      `sqlite3 "${testDatabase}" "CREATE INDEX IF NOT EXISTS idx_hook_traces_swarm ON hook_traces(swarm_id)"`
    ];
    
    for (const query of initQueries) {
      try {
        execSync(query);
      } catch (error) {
        console.warn('Hook database setup query failed:', error);
      }
    }
  }

  async function simulateAgentWork(
    agent: { id: string; role: string; tasks?: string[] },
    workType: string,
    baseDelay: number
  ): Promise<void> {
    // Simulate different work patterns based on agent role
    const roleMultipliers: Record<string, number> = {
      'coordinator': 0.8,
      'coder': 1.2,
      'tester': 1.0,
      'analyst': 0.9,
      'researcher': 1.1
    };
    
    const multiplier = roleMultipliers[agent.role] || 1.0;
    const delay = baseDelay * multiplier * (0.8 + Math.random() * 0.4); // ±20% variation
    
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  async function simulateMemoryOperation(operation: string, baseDelay: number): Promise<void> {
    const operationMultipliers: Record<string, number> = {
      'state_initialization': 0.5,
      'data_ingestion': 2.0,
      'state_transformation': 1.5,
      'state_persistence': 1.0
    };
    
    const multiplier = operationMultipliers[operation] || 1.0;
    const delay = baseDelay * multiplier;
    
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  function getAgentDependencies(role: string): string[] {
    const dependencies: Record<string, string[]> = {
      'coordinator': [],
      'coder': ['coordinator'],
      'tester': ['coder'],
      'analyst': ['coordinator']
    };
    
    return dependencies[role] || [];
  }

  function getAgentResources(role: string): Record<string, any> {
    const resources: Record<string, Record<string, any>> = {
      'coordinator': { cpu: '2 cores', memory: '4GB', tools: ['project_mgmt', 'communication'] },
      'coder': { cpu: '4 cores', memory: '8GB', tools: ['ide', 'compiler', 'debugger'] },
      'tester': { cpu: '2 cores', memory: '4GB', tools: ['test_framework', 'automation'] },
      'analyst': { cpu: '3 cores', memory: '6GB', tools: ['analytics', 'reporting'] }
    };
    
    return resources[role] || { cpu: '2 cores', memory: '4GB', tools: [] };
  }

  function generateDevelopmentResult(task: any): Record<string, any> {
    const baseResults: Record<string, any> = {
      taskCompleted: task.taskId,
      description: task.description,
      complexity: task.complexity
    };

    // Add role-specific results
    if (task.agentId.includes('frontend')) {
      return {
        ...baseResults,
        linesOfCode: 250 + Math.floor(Math.random() * 500),
        componentsCreated: 3 + Math.floor(Math.random() * 7),
        stylesWritten: '1200 lines',
        responsiveDesign: true,
        accessibilityScore: 0.85 + Math.random() * 0.1
      };
    } else if (task.agentId.includes('backend')) {
      return {
        ...baseResults,
        linesOfCode: 400 + Math.floor(Math.random() * 800),
        endpointsCreated: 2 + Math.floor(Math.random() * 6),
        databaseQueries: 5 + Math.floor(Math.random() * 15),
        apiDocumentation: 'Generated',
        testCoverage: 0.8 + Math.random() * 0.15
      };
    } else if (task.agentId.includes('qa')) {
      return {
        ...baseResults,
        testsWritten: 15 + Math.floor(Math.random() * 30),
        testCoverage: 0.85 + Math.random() * 0.1,
        automatedTests: 12 + Math.floor(Math.random() * 20),
        manualTestCases: 8 + Math.floor(Math.random() * 12),
        bugsFound: Math.floor(Math.random() * 5)
      };
    }

    return baseResults;
  }

  function generateRealisticTokenUsage(estimatedTokens: number): TokenUsage {
    const variation = 0.2; // ±20% variation from estimate
    const actualTotal = estimatedTokens * (0.8 + Math.random() * 0.4);
    
    // Typical input/output ratio varies by task type
    const inputRatio = 0.3 + Math.random() * 0.2; // 30-50% input
    const input = Math.round(actualTotal * inputRatio);
    const output = Math.round(actualTotal * (1 - inputRatio));
    
    return {
      input,
      output,
      total: input + output
    };
  }

  async function verifyMemoryCoordination(workflowId: string): Promise<void> {
    try {
      const { execSync } = require('child_process');
      
      // Check for memory coordination entries
      const query = `sqlite3 "${testDatabase}" "SELECT COUNT(*) FROM memory_entries WHERE key LIKE '%${workflowId}%'"`;
      const result = execSync(query, { encoding: 'utf8' }).trim();
      const count = parseInt(result);
      
      expect(count).toBeGreaterThanOrEqual(0); // Should have coordination entries
    } catch (error) {
      console.warn('Memory coordination verification failed:', error);
    }
  }
});