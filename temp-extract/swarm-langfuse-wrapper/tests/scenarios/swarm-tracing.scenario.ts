/**
 * Swarm Tracing Scenarios
 * Comprehensive test scenarios for validating swarm coordination and tracing
 */

import { jest, describe, beforeEach, afterEach, it, expect } from '@jest/globals';
import { LangfuseWrapper } from '../../src/index';
import { SwarmTracer, SwarmAction, SwarmCoordinationEvent } from '../../src/swarm-tracer';
import { execSync } from 'child_process';
import * as fs from 'fs';

describe('Swarm Tracing Scenarios', () => {
  let wrapper: LangfuseWrapper;
  let swarmTracer: SwarmTracer;
  let testDatabase: string;

  beforeEach(async () => {
    // Set up fresh test environment for each scenario
    process.env.NODE_ENV = 'test';
    process.env.LANGFUSE_ENABLED = 'false';
    
    testDatabase = `.swarm/scenario-test-${Date.now()}.db`;
    
    wrapper = new LangfuseWrapper({
      enabled: false,
      publicKey: 'test-key',
      secretKey: 'test-secret'
    });
    
    swarmTracer = new SwarmTracer(wrapper);
    
    await setupScenarioDatabase();
  });

  afterEach(async () => {
    await wrapper.shutdown();
    
    // Clean up test database
    if (fs.existsSync(testDatabase)) {
      fs.unlinkSync(testDatabase);
    }
  });

  describe('Scenario 1: Enterprise API Development Swarm', () => {
    const swarmId = 'enterprise-api-swarm';
    const topology = 'hierarchical';
    const maxAgents = 6;
    
    const agents = [
      { id: 'architect-lead', role: 'architect', capabilities: ['system_design', 'api_architecture', 'scalability'] },
      { id: 'security-specialist', role: 'analyst', capabilities: ['security_audit', 'auth_design', 'vulnerability_scan'] },
      { id: 'backend-dev-01', role: 'coder', capabilities: ['node_js', 'typescript', 'database_design'] },
      { id: 'backend-dev-02', role: 'coder', capabilities: ['api_endpoints', 'middleware', 'error_handling'] },
      { id: 'qa-engineer', role: 'tester', capabilities: ['api_testing', 'load_testing', 'security_testing'] },
      { id: 'devops-coordinator', role: 'coordinator', capabilities: ['deployment', 'monitoring', 'ci_cd'] }
    ];

    it('should execute complete enterprise API development lifecycle', async () => {
      // Phase 1: Swarm Initialization
      const traceId = await swarmTracer.startSwarmTrace(swarmId, topology, maxAgents, {
        projectName: 'Enterprise Customer API',
        expectedDuration: '2 weeks',
        priority: 'high',
        stakeholders: ['product_team', 'engineering', 'security']
      });

      expect(swarmTracer.getActiveSwarms()).toContain(swarmId);

      // Phase 2: Agent Spawning with Dependencies
      for (const agent of agents) {
        const spawnAction: SwarmAction = {
          actionType: 'spawn',
          agentId: agent.id,
          agentRole: agent.role,
          swarmId,
          timestamp: Date.now(),
          payload: {
            capabilities: agent.capabilities,
            spawnOrder: agents.indexOf(agent),
            dependencies: getAgentDependencies(agent.role)
          }
        };

        await swarmTracer.traceAgentSpawn(spawnAction, agent.capabilities);
        
        // Simulate spawn delay
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Phase 3: Task Assignment with Priorities
      const tasks = [
        { id: 'api-design', agent: 'architect-lead', description: 'Design RESTful API architecture', priority: 'critical', dependencies: [] },
        { id: 'security-review', agent: 'security-specialist', description: 'Security requirements analysis', priority: 'high', dependencies: ['api-design'] },
        { id: 'user-endpoints', agent: 'backend-dev-01', description: 'User management endpoints', priority: 'high', dependencies: ['api-design', 'security-review'] },
        { id: 'auth-system', agent: 'backend-dev-02', description: 'Authentication and authorization', priority: 'critical', dependencies: ['security-review'] },
        { id: 'api-tests', agent: 'qa-engineer', description: 'Comprehensive API test suite', priority: 'medium', dependencies: ['user-endpoints', 'auth-system'] },
        { id: 'deployment-setup', agent: 'devops-coordinator', description: 'CI/CD and monitoring setup', priority: 'medium', dependencies: ['api-tests'] }
      ];

      for (const task of tasks) {
        await swarmTracer.traceTaskAssignment(
          task.id,
          task.agent,
          swarmId,
          task.description,
          task.priority
        );
      }

      // Phase 4: Complex Inter-Agent Communication
      const communicationFlows = [
        // Architecture decisions
        {
          from: 'architect-lead',
          to: 'security-specialist',
          type: 'architecture_review',
          payload: {
            endpoints: ['/api/v1/users', '/api/v1/auth', '/api/v1/admin'],
            authStrategy: 'JWT with refresh tokens',
            rateLimit: '1000 req/min per user'
          }
        },
        // Security feedback
        {
          from: 'security-specialist',
          to: 'architect-lead',
          type: 'security_recommendations',
          payload: {
            concerns: ['CORS configuration', 'SQL injection prevention', 'Rate limiting'],
            approvedPatterns: ['JWT implementation', 'HTTPS enforcement'],
            requiredChanges: ['Add input validation', 'Implement audit logging']
          }
        },
        // Development coordination
        {
          from: 'architect-lead',
          to: 'backend-dev-01',
          type: 'implementation_specs',
          payload: {
            userSchema: { id: 'uuid', email: 'string', roles: 'array' },
            endpoints: ['GET /users', 'POST /users', 'PUT /users/:id', 'DELETE /users/:id'],
            validation: 'joi schema validation'
          }
        },
        {
          from: 'architect-lead',
          to: 'backend-dev-02',
          type: 'auth_specifications',
          payload: {
            jwtConfig: { algorithm: 'RS256', expiry: '15m' },
            refreshToken: { expiry: '7d', rotation: true },
            middleware: ['auth verification', 'role checking']
          }
        },
        // Cross-development communication
        {
          from: 'backend-dev-01',
          to: 'backend-dev-02',
          type: 'schema_coordination',
          payload: {
            sharedModels: ['User', 'Role', 'Permission'],
            databaseChanges: ['users table', 'roles table', 'user_roles junction'],
            integrationPoints: ['user creation triggers auth setup']
          }
        },
        // Testing coordination
        {
          from: 'backend-dev-01',
          to: 'qa-engineer',
          type: 'testing_requirements',
          payload: {
            completedEndpoints: ['/api/v1/users'],
            testData: 'seed_users.json',
            expectedBehavior: 'CRUD operations with validation'
          }
        },
        {
          from: 'backend-dev-02',
          to: 'qa-engineer',
          type: 'auth_testing_guide',
          payload: {
            authFlow: 'login -> JWT -> refresh cycle',
            testScenarios: ['valid login', 'invalid credentials', 'token expiry'],
            securityTests: ['brute force protection', 'token manipulation']
          }
        },
        // DevOps coordination
        {
          from: 'qa-engineer',
          to: 'devops-coordinator',
          type: 'deployment_readiness',
          payload: {
            testResults: { passed: 95, failed: 2, coverage: '87%' },
            performanceMetrics: { avgResponse: '120ms', maxLoad: '500 concurrent' },
            deploymentRequirements: ['Node 18+', 'PostgreSQL 15', 'Redis cache']
          }
        }
      ];

      for (const comm of communicationFlows) {
        await swarmTracer.traceAgentCommunication(
          comm.from,
          comm.to,
          swarmId,
          comm.type,
          comm.payload
        );
      }

      // Phase 5: Task Execution with Realistic Outcomes
      const taskCompletions = [
        {
          taskId: 'api-design',
          agentId: 'architect-lead',
          result: {
            apiSpecification: 'OpenAPI 3.0',
            endpointCount: 12,
            securityModel: 'Bearer Token',
            documentation: 'Comprehensive API docs generated'
          },
          tokenUsage: { input: 2500, output: 4000, total: 6500 }
        },
        {
          taskId: 'security-review',
          agentId: 'security-specialist',
          result: {
            vulnerabilityScore: 'A+',
            complianceChecks: ['GDPR', 'SOC2', 'OWASP Top 10'],
            securityTests: 15,
            approvalStatus: 'approved with minor recommendations'
          },
          tokenUsage: { input: 3000, output: 2500, total: 5500 }
        },
        {
          taskId: 'user-endpoints',
          agentId: 'backend-dev-01',
          result: {
            endpointsImplemented: 4,
            linesOfCode: 850,
            testCoverage: '92%',
            performanceOptimized: true
          },
          tokenUsage: { input: 4000, output: 6000, total: 10000 }
        },
        {
          taskId: 'auth-system',
          agentId: 'backend-dev-02',
          result: {
            authMethods: ['JWT', 'refresh tokens', 'password reset'],
            securityFeatures: ['rate limiting', 'brute force protection'],
            integrationPoints: 3,
            middlewareComponents: 5
          },
          tokenUsage: { input: 3500, output: 5500, total: 9000 }
        }
      ];

      for (const completion of taskCompletions) {
        await swarmTracer.traceTaskCompletion(
          completion.taskId,
          completion.agentId,
          swarmId,
          completion.result,
          completion.tokenUsage
        );
      }

      // Phase 6: Error Simulation and Recovery
      const simulatedError = new Error('Database connection pool exhausted during load testing');
      simulatedError.name = 'DatabaseConnectionError';
      
      await swarmTracer.traceSwarmError(
        swarmId,
        'qa-engineer',
        simulatedError,
        {
          operation: 'load_testing',
          affectedTests: ['concurrent_user_creation', 'auth_stress_test'],
          recoveryAction: 'increase connection pool size',
          impactLevel: 'medium'
        }
      );

      // Phase 7: Swarm Completion
      const projectSummary = {
        totalTasks: tasks.length,
        completedTasks: taskCompletions.length,
        codeGenerated: '2,150 lines',
        testsCreated: 47,
        documentation: 'Complete API documentation',
        securityScore: 'A+',
        performanceMetrics: {
          avgResponseTime: '120ms',
          throughput: '500 req/sec',
          errorRate: '0.1%'
        },
        teamEfficiency: 'High',
        estimatedVsActual: '98% accuracy'
      };

      await swarmTracer.completeSwarmTrace(swarmId, projectSummary);

      // Verification
      expect(swarmTracer.getActiveSwarms()).not.toContain(swarmId);
      
      const coordHistory = await swarmTracer.getCoordinationHistory(swarmId);
      expect(coordHistory.length).toBeGreaterThan(0);
    });
  });

  describe('Scenario 2: Emergency Bug Fix Swarm', () => {
    const swarmId = 'emergency-bugfix-swarm';
    const topology = 'star'; // Centralized for rapid response
    const maxAgents = 4;

    it('should execute rapid emergency response with minimal coordination overhead', async () => {
      const traceId = await swarmTracer.startSwarmTrace(swarmId, topology, maxAgents, {
        emergencyLevel: 'critical',
        expectedResolution: '2 hours',
        affectedSystems: ['payment_api', 'user_authentication'],
        customerImpact: 'high'
      });

      const emergencyAgents = [
        { id: 'incident-commander', role: 'coordinator', capabilities: ['incident_management', 'communication'] },
        { id: 'senior-dev', role: 'coder', capabilities: ['debugging', 'hotfix', 'payment_systems'] },
        { id: 'sre-specialist', role: 'analyst', capabilities: ['system_monitoring', 'performance_analysis'] },
        { id: 'qa-validator', role: 'tester', capabilities: ['smoke_testing', 'regression_validation'] }
      ];

      // Rapid agent deployment
      for (const agent of emergencyAgents) {
        const spawnAction: SwarmAction = {
          actionType: 'spawn',
          agentId: agent.id,
          agentRole: agent.role,
          swarmId,
          timestamp: Date.now(),
          payload: { emergencyMode: true, priority: 'critical' }
        };

        await swarmTracer.traceAgentSpawn(spawnAction, agent.capabilities);
      }

      // Emergency task assignment
      await swarmTracer.traceTaskAssignment(
        'incident-analysis',
        'incident-commander',
        swarmId,
        'Coordinate emergency response and communication',
        'critical'
      );

      await swarmTracer.traceTaskAssignment(
        'root-cause-analysis',
        'sre-specialist',
        swarmId,
        'Identify root cause of payment failures',
        'critical'
      );

      await swarmTracer.traceTaskAssignment(
        'hotfix-implementation',
        'senior-dev',
        swarmId,
        'Implement and deploy critical hotfix',
        'critical'
      );

      // Rapid communication and resolution
      await swarmTracer.traceAgentCommunication(
        'sre-specialist',
        'incident-commander',
        swarmId,
        'root_cause_identified',
        {
          issue: 'Redis connection timeout during high load',
          scope: 'Payment processing pipeline',
          fix: 'Increase Redis timeout + connection pool',
          estimatedTime: '30 minutes'
        }
      );

      await swarmTracer.traceAgentCommunication(
        'incident-commander',
        'senior-dev',
        swarmId,
        'emergency_fix_approved',
        {
          approvedChanges: ['Redis timeout configuration', 'Connection pool size'],
          riskLevel: 'low',
          rollbackPlan: 'Previous configuration stored'
        }
      );

      // Rapid completion
      await swarmTracer.traceTaskCompletion(
        'hotfix-implementation',
        'senior-dev',
        swarmId,
        {
          fixDeployed: true,
          deploymentTime: '25 minutes',
          systemsRestored: ['payment_api', 'user_sessions'],
          validationStatus: 'passed'
        },
        { input: 500, output: 800, total: 1300 }
      );

      await swarmTracer.completeSwarmTrace(swarmId, {
        resolutionTime: '1.5 hours',
        systemsRestored: '100%',
        customerImpact: 'minimized',
        preventionMeasures: 'monitoring alerts enhanced'
      });

      expect(swarmTracer.getActiveSwarms()).not.toContain(swarmId);
    });
  });

  describe('Scenario 3: Distributed Research Swarm', () => {
    const swarmId = 'research-analysis-swarm';
    const topology = 'mesh'; // Full connectivity for information sharing
    const maxAgents = 5;

    it('should execute comprehensive research with peer-to-peer coordination', async () => {
      const traceId = await swarmTracer.startSwarmTrace(swarmId, topology, maxAgents, {
        researchTopic: 'AI-powered code generation trends',
        expectedDuration: '1 week',
        outputDeliverables: ['market_analysis', 'technical_report', 'recommendations']
      });

      const researchAgents = [
        { id: 'market-researcher', role: 'researcher', capabilities: ['market_analysis', 'trend_identification'] },
        { id: 'tech-analyst', role: 'analyst', capabilities: ['technical_analysis', 'architecture_review'] },
        { id: 'data-scientist', role: 'analyst', capabilities: ['data_processing', 'statistical_analysis'] },
        { id: 'industry-specialist', role: 'researcher', capabilities: ['industry_knowledge', 'competitive_analysis'] },
        { id: 'report-coordinator', role: 'coordinator', capabilities: ['synthesis', 'documentation'] }
      ];

      // Deploy research team
      for (const agent of researchAgents) {
        const spawnAction: SwarmAction = {
          actionType: 'spawn',
          agentId: agent.id,
          agentRole: agent.role,
          swarmId,
          timestamp: Date.now()
        };
        await swarmTracer.traceAgentSpawn(spawnAction, agent.capabilities);
      }

      // Research task distribution
      const researchTasks = [
        { id: 'market-landscape', agent: 'market-researcher', description: 'Analyze current market landscape', priority: 'high' },
        { id: 'technical-capabilities', agent: 'tech-analyst', description: 'Evaluate technical capabilities', priority: 'high' },
        { id: 'usage-patterns', agent: 'data-scientist', description: 'Analyze usage data and patterns', priority: 'medium' },
        { id: 'competitive-analysis', agent: 'industry-specialist', description: 'Competitive landscape analysis', priority: 'medium' },
        { id: 'synthesis-report', agent: 'report-coordinator', description: 'Synthesize findings into report', priority: 'high' }
      ];

      for (const task of researchTasks) {
        await swarmTracer.traceTaskAssignment(task.id, task.agent, swarmId, task.description, task.priority);
      }

      // Extensive peer-to-peer knowledge sharing
      const knowledgeSharing = [
        {
          from: 'market-researcher',
          to: 'industry-specialist',
          type: 'market_insights',
          payload: { marketSize: '$2.3B', growthRate: '45% YoY', keyPlayers: ['GitHub', 'OpenAI', 'Anthropic'] }
        },
        {
          from: 'tech-analyst',
          to: 'data-scientist',
          type: 'technical_metrics',
          payload: { codeQuality: 'high', performanceGains: '30%', adoptionBarriers: ['learning_curve', 'integration'] }
        },
        {
          from: 'data-scientist',
          to: 'market-researcher',
          type: 'usage_insights',
          payload: { topUseCases: ['boilerplate', 'testing', 'documentation'], userSatisfaction: '4.2/5' }
        }
      ];

      for (const sharing of knowledgeSharing) {
        await swarmTracer.traceAgentCommunication(
          sharing.from,
          sharing.to,
          swarmId,
          sharing.type,
          sharing.payload
        );
      }

      // Research completion with comprehensive results
      await swarmTracer.traceTaskCompletion(
        'market-landscape',
        'market-researcher',
        swarmId,
        {
          marketAnalysis: 'comprehensive',
          sourcesAnalyzed: 47,
          trendsIdentified: 12,
          reportSections: 5
        },
        { input: 5000, output: 8000, total: 13000 }
      );

      await swarmTracer.completeSwarmTrace(swarmId, {
        researchCompleted: true,
        findingsCount: 156,
        recommendations: 23,
        confidenceLevel: 'high',
        stakeholderValue: 'significant'
      });

      expect(swarmTracer.getActiveSwarms()).not.toContain(swarmId);
    });
  });

  describe('Scenario 4: Performance Optimization Swarm', () => {
    const swarmId = 'performance-optimization-swarm';
    const topology = 'ring'; // Sequential optimization workflow
    const maxAgents = 4;

    it('should execute systematic performance optimization with measurable results', async () => {
      const traceId = await swarmTracer.startSwarmTrace(swarmId, topology, maxAgents, {
        targetSystem: 'e-commerce platform',
        currentPerformance: { responseTime: '850ms', throughput: '200 req/s', errorRate: '2.1%' },
        optimizationGoals: { responseTime: '<200ms', throughput: '>1000 req/s', errorRate: '<0.5%' }
      });

      const optimizationAgents = [
        { id: 'performance-analyzer', role: 'analyst', capabilities: ['profiling', 'bottleneck_identification'] },
        { id: 'database-optimizer', role: 'coder', capabilities: ['query_optimization', 'indexing', 'caching'] },
        { id: 'frontend-optimizer', role: 'coder', capabilities: ['asset_optimization', 'lazy_loading', 'bundling'] },
        { id: 'infrastructure-optimizer', role: 'coordinator', capabilities: ['scaling', 'load_balancing', 'monitoring'] }
      ];

      // Sequential deployment for optimization pipeline
      for (const agent of optimizationAgents) {
        const spawnAction: SwarmAction = {
          actionType: 'spawn',
          agentId: agent.id,
          agentRole: agent.role,
          swarmId,
          timestamp: Date.now()
        };
        await swarmTracer.traceAgentSpawn(spawnAction, agent.capabilities);
      }

      // Performance optimization workflow
      await swarmTracer.traceTaskAssignment(
        'performance-audit',
        'performance-analyzer',
        swarmId,
        'Comprehensive performance profiling and bottleneck identification',
        'critical'
      );

      // Simulate performance analysis results
      await swarmTracer.traceAgentCommunication(
        'performance-analyzer',
        'database-optimizer',
        swarmId,
        'database_bottlenecks_identified',
        {
          slowQueries: 15,
          missingIndexes: 8,
          inefficientJoins: 12,
          cacheHitRate: '45%',
          recommendations: ['add indexes', 'optimize queries', 'implement Redis caching']
        }
      );

      await swarmTracer.traceAgentCommunication(
        'performance-analyzer',
        'frontend-optimizer',
        swarmId,
        'frontend_issues_identified',
        {
          bundleSize: '2.3MB',
          unusedCode: '35%',
          imageOptimization: 'needed',
          lazyLoading: 'not implemented',
          recommendations: ['code splitting', 'image compression', 'lazy loading']
        }
      );

      // Track optimization implementations
      await swarmTracer.traceTaskCompletion(
        'database-optimization',
        'database-optimizer',
        swarmId,
        {
          indexesAdded: 8,
          queriesOptimized: 15,
          cacheImplemented: 'Redis',
          performanceGain: '60% faster queries',
          newCacheHitRate: '85%'
        },
        { input: 2000, output: 3500, total: 5500 }
      );

      await swarmTracer.traceTaskCompletion(
        'frontend-optimization',
        'frontend-optimizer',
        swarmId,
        {
          bundleSizeReduced: '75%',
          lazyLoadingImplemented: true,
          imagesOptimized: 47,
          performanceGain: '3x faster page loads',
          lighthouse_score: '95/100'
        },
        { input: 1800, output: 2800, total: 4600 }
      );

      await swarmTracer.completeSwarmTrace(swarmId, {
        finalPerformance: { responseTime: '180ms', throughput: '1200 req/s', errorRate: '0.3%' },
        goalsAchieved: '100%',
        optimizationAreas: 4,
        performanceGain: '5.7x improvement',
        costReduction: '40% infrastructure costs'
      });

      expect(swarmTracer.getActiveSwarms()).not.toContain(swarmId);
    });
  });

  describe('Swarm Error Recovery Scenarios', () => {
    it('should handle agent failure and automatic recovery', async () => {
      const swarmId = 'error-recovery-test';
      const traceId = await swarmTracer.startSwarmTrace(swarmId, 'mesh', 3, {
        testScenario: 'agent_failure_recovery'
      });

      // Spawn agents
      const agents = ['agent-1', 'agent-2', 'agent-3'];
      for (const agentId of agents) {
        const spawnAction: SwarmAction = {
          actionType: 'spawn',
          agentId,
          agentRole: 'tester',
          swarmId,
          timestamp: Date.now()
        };
        await swarmTracer.traceAgentSpawn(spawnAction, ['testing']);
      }

      // Simulate agent failure
      const criticalError = new Error('Agent memory exhausted');
      criticalError.name = 'OutOfMemoryError';
      
      await swarmTracer.traceSwarmError(swarmId, 'agent-2', criticalError, {
        recoveryStrategy: 'agent_replacement',
        dataPreservation: 'partial',
        affectedTasks: ['task-2', 'task-3']
      });

      // Simulate recovery by spawning replacement agent
      const recoveryAction: SwarmAction = {
        actionType: 'spawn',
        agentId: 'agent-2-recovery',
        agentRole: 'tester',
        swarmId,
        parentAgentId: 'agent-2',
        timestamp: Date.now(),
        payload: { recoveryMode: true, inheritedState: 'partial' }
      };
      
      await swarmTracer.traceAgentSpawn(recoveryAction, ['testing', 'recovery']);

      await swarmTracer.completeSwarmTrace(swarmId, {
        recoverySuccessful: true,
        dataLoss: 'minimal',
        downtime: '2 minutes'
      });

      expect(swarmTracer.getActiveSwarms()).not.toContain(swarmId);
    });

    it('should handle network partition and coordination recovery', async () => {
      const swarmId = 'network-partition-test';
      const traceId = await swarmTracer.startSwarmTrace(swarmId, 'mesh', 4, {
        testScenario: 'network_partition_recovery'
      });

      // Simulate network partition error
      const networkError = new Error('Network partition detected between agent clusters');
      networkError.name = 'NetworkPartitionError';
      
      await swarmTracer.traceSwarmError(swarmId, 'coordinator', networkError, {
        partitionedAgents: ['agent-1', 'agent-2'],
        isolatedAgents: ['agent-3', 'agent-4'],
        coordinationState: 'degraded',
        recoveryProtocol: 'consensus_rebuild'
      });

      // Simulate coordination recovery
      await swarmTracer.traceAgentCommunication(
        'coordinator',
        'all-agents',
        swarmId,
        'coordination_recovery',
        {
          partitionHealed: true,
          consensusReached: true,
          stateSync: 'completed',
          recoveryTime: '45 seconds'
        }
      );

      await swarmTracer.completeSwarmTrace(swarmId, {
        networkRecovery: 'successful',
        coordinationRestored: true,
        dataConsistency: 'maintained'
      });

      expect(swarmTracer.getActiveSwarms()).not.toContain(swarmId);
    });
  });

  // Helper functions
  async function setupScenarioDatabase(): Promise<void> {
    const { execSync } = require('child_process');
    const path = require('path');
    
    // Create database directory
    const dbDir = path.dirname(testDatabase);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    // Initialize test database with scenario-specific tables
    const initQueries = [
      `sqlite3 "${testDatabase}" "CREATE TABLE IF NOT EXISTS memory_entries (key TEXT PRIMARY KEY, value TEXT, namespace TEXT, metadata TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)"`,
      `sqlite3 "${testDatabase}" "CREATE TABLE IF NOT EXISTS agent_interactions (id INTEGER PRIMARY KEY, task_id TEXT, agent_id TEXT, interaction_type TEXT, payload TEXT, timestamp INTEGER)"`,
      `sqlite3 "${testDatabase}" "CREATE TABLE IF NOT EXISTS coordination_events (id INTEGER PRIMARY KEY, swarm_id TEXT, event_type TEXT, source_agent TEXT, target_agent TEXT, event_data TEXT, timestamp INTEGER)"`,
      `sqlite3 "${testDatabase}" "CREATE INDEX IF NOT EXISTS idx_memory_namespace ON memory_entries(namespace)"`,
      `sqlite3 "${testDatabase}" "CREATE INDEX IF NOT EXISTS idx_agent_task ON agent_interactions(task_id)"`,
      `sqlite3 "${testDatabase}" "CREATE INDEX IF NOT EXISTS idx_coord_swarm ON coordination_events(swarm_id)"`
    ];
    
    for (const query of initQueries) {
      try {
        execSync(query);
      } catch (error) {
        console.warn('Database setup query failed:', error);
      }
    }
  }

  function getAgentDependencies(role: string): string[] {
    const dependencies: Record<string, string[]> = {
      'architect': [],
      'analyst': ['architect'],
      'coder': ['architect', 'analyst'],
      'tester': ['coder'],
      'coordinator': ['architect'],
      'researcher': []
    };
    
    return dependencies[role] || [];
  }
});