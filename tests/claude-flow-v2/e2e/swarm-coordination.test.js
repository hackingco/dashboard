/**
 * End-to-End Swarm Coordination Tests for Claude-Flow v2.0.0
 * Tests complete swarm workflows from initialization to task completion
 */

const { describe, it, expect, beforeAll, afterAll } = require('@jest/globals');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

// Helper to run Claude Flow commands
async function runClaudeFlow(args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn('npx', ['claude-flow@alpha', ...args], {
      shell: true,
      env: { ...process.env, NO_COLOR: '1' },
      ...options
    });
    
    let stdout = '';
    let stderr = '';
    
    proc.stdout.on('data', (data) => stdout += data.toString());
    proc.stderr.on('data', (data) => stderr += data.toString());
    
    proc.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

// Helper to simulate agent work
async function simulateAgentWork(agentName, taskDescription) {
  // Pre-task hook
  await runClaudeFlow([
    'hooks', 'pre-task',
    '--description', `${agentName}: ${taskDescription}`
  ]);
  
  // Simulate some work
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Post-task hook
  await runClaudeFlow([
    'hooks', 'post-task',
    '--task-id', `${agentName}-task`,
    '--analyze-performance', 'true'
  ]);
}

describe('E2E Swarm Coordination Tests', () => {
  const testWorkDir = path.join(__dirname, 'e2e-swarm-workspace');
  const testProjectDir = path.join(testWorkDir, 'test-project');
  
  beforeAll(async () => {
    await fs.mkdir(testProjectDir, { recursive: true });
    process.chdir(testProjectDir);
  });
  
  afterAll(async () => {
    process.chdir(__dirname);
    await fs.rm(testWorkDir, { recursive: true, force: true });
  });

  describe('Complete Swarm Workflow', () => {
    it('should execute full swarm lifecycle', async () => {
      // 1. Initialize swarm
      const initResult = await runClaudeFlow([
        'swarm', 'init',
        '--topology', 'hierarchical',
        '--max-agents', '6',
        '--strategy', 'adaptive'
      ]);
      expect(initResult.code).toBe(0);
      expect(initResult.stdout).toContain('Swarm initialized');
      
      // 2. Spawn multiple agents
      const agentTypes = [
        { type: 'coordinator', name: 'MainCoordinator' },
        { type: 'researcher', name: 'DataResearcher' },
        { type: 'coder', name: 'APIDeveloper' },
        { type: 'analyst', name: 'SystemAnalyst' },
        { type: 'tester', name: 'QAEngineer' },
        { type: 'reviewer', name: 'CodeReviewer' }
      ];
      
      for (const agent of agentTypes) {
        const spawnResult = await runClaudeFlow([
          'agent', 'spawn',
          '--type', agent.type,
          '--name', agent.name
        ]);
        expect(spawnResult.code).toBe(0);
        expect(spawnResult.stdout).toContain('spawned');
      }
      
      // 3. Verify all agents are active
      const listResult = await runClaudeFlow(['agent', 'list']);
      expect(listResult.code).toBe(0);
      for (const agent of agentTypes) {
        expect(listResult.stdout).toContain(agent.name);
      }
      
      // 4. Orchestrate a complex task
      const orchestrateResult = await runClaudeFlow([
        'task', 'orchestrate',
        '--task', 'Build a REST API with authentication, database, and tests',
        '--strategy', 'parallel',
        '--priority', 'high'
      ]);
      expect(orchestrateResult.code).toBe(0);
      expect(orchestrateResult.stdout).toContain('orchestrated');
      
      // 5. Check swarm status
      const statusResult = await runClaudeFlow(['swarm', 'status']);
      expect(statusResult.code).toBe(0);
      expect(statusResult.stdout).toMatch(/active|running/i);
      expect(statusResult.stdout).toContain('6'); // Agent count
      
      // 6. Monitor swarm activity
      const monitorResult = await runClaudeFlow([
        'swarm', 'monitor',
        '--duration', '2',
        '--interval', '1'
      ]);
      expect(monitorResult.code).toBe(0);
      expect(monitorResult.stdout).toMatch(/monitor|activity/i);
    });
  });

  describe('Agent Coordination Patterns', () => {
    it('should coordinate agents using memory', async () => {
      // Agent 1 stores discovery
      const store1 = await runClaudeFlow([
        'memory', 'store',
        '--key', 'agent/researcher/discovery',
        '--value', JSON.stringify({
          finding: 'API needs rate limiting',
          timestamp: Date.now()
        }),
        '--namespace', 'coordination'
      ]);
      expect(store1.code).toBe(0);
      
      // Agent 2 retrieves and acts on it
      const retrieve2 = await runClaudeFlow([
        'memory', 'retrieve',
        '--key', 'agent/researcher/discovery',
        '--namespace', 'coordination'
      ]);
      expect(retrieve2.code).toBe(0);
      expect(retrieve2.stdout).toContain('rate limiting');
      
      // Agent 2 stores implementation
      const store2 = await runClaudeFlow([
        'memory', 'store',
        '--key', 'agent/coder/implementation',
        '--value', JSON.stringify({
          implemented: 'Added rate limiter middleware',
          referencedDiscovery: 'agent/researcher/discovery'
        }),
        '--namespace', 'coordination'
      ]);
      expect(store2.code).toBe(0);
      
      // Coordinator checks progress
      const searchResult = await runClaudeFlow([
        'memory', 'search',
        '--pattern', 'agent/',
        '--namespace', 'coordination'
      ]);
      expect(searchResult.code).toBe(0);
      expect(searchResult.stdout).toContain('discovery');
      expect(searchResult.stdout).toContain('implementation');
    });

    it('should handle agent failures gracefully', async () => {
      // Simulate agent failure notification
      const failureNotify = await runClaudeFlow([
        'hooks', 'notify',
        '--message', 'Agent TestAgent encountered error: Connection timeout',
        '--level', 'error'
      ]);
      expect(failureNotify.code).toBe(0);
      
      // Check if swarm continues
      const statusAfterFailure = await runClaudeFlow(['swarm', 'status']);
      expect(statusAfterFailure.code).toBe(0);
      expect(statusAfterFailure.stdout).toMatch(/active|running/i);
    });
  });

  describe('Real-World Task Simulation', () => {
    it('should build a simple API project', async () => {
      // Initialize project structure
      const dirs = ['src', 'tests', 'docs'];
      for (const dir of dirs) {
        await fs.mkdir(path.join(testProjectDir, dir), { recursive: true });
      }
      
      // Simulate architect agent planning
      await simulateAgentWork('Architect', 'Design API structure');
      
      // Store architecture decision
      await runClaudeFlow([
        'memory', 'store',
        '--key', 'architecture/api-design',
        '--value', JSON.stringify({
          endpoints: ['/users', '/auth', '/posts'],
          database: 'PostgreSQL',
          auth: 'JWT'
        }),
        '--namespace', 'project'
      ]);
      
      // Simulate coder agent implementation
      await simulateAgentWork('Coder', 'Implement API endpoints');
      
      // Create actual files
      const packageJson = {
        name: 'test-api',
        version: '1.0.0',
        dependencies: {
          express: '^4.18.0',
          jsonwebtoken: '^9.0.0'
        }
      };
      await fs.writeFile(
        path.join(testProjectDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );
      
      const serverCode = `
const express = require('express');
const app = express();

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(3000);
      `;
      await fs.writeFile(
        path.join(testProjectDir, 'src', 'server.js'),
        serverCode
      );
      
      // Log file creation
      await runClaudeFlow([
        'hooks', 'post-edit',
        '--file', 'src/server.js',
        '--memory-key', 'implementation/server'
      ]);
      
      // Simulate tester agent
      await simulateAgentWork('Tester', 'Write unit tests');
      
      const testCode = `
describe('API Tests', () => {
  test('health check', () => {
    expect(true).toBe(true);
  });
});
      `;
      await fs.writeFile(
        path.join(testProjectDir, 'tests', 'api.test.js'),
        testCode
      );
      
      // Final task completion
      await runClaudeFlow([
        'hooks', 'notify',
        '--message', 'API project completed successfully',
        '--level', 'success'
      ]);
      
      // Verify files were created
      const files = await fs.readdir(testProjectDir, { recursive: true });
      expect(files).toContain('package.json');
      expect(files).toContain('src');
      expect(files).toContain('tests');
    });
  });

  describe('Performance and Scaling', () => {
    it('should handle concurrent agent operations', async () => {
      // Spawn multiple tasks concurrently
      const concurrentTasks = [];
      
      for (let i = 0; i < 5; i++) {
        concurrentTasks.push(
          runClaudeFlow([
            'memory', 'store',
            '--key', `concurrent/task-${i}`,
            '--value', JSON.stringify({ taskId: i, timestamp: Date.now() }),
            '--namespace', 'performance'
          ])
        );
      }
      
      const results = await Promise.all(concurrentTasks);
      results.forEach(result => expect(result.code).toBe(0));
      
      // Verify all were stored
      const listResult = await runClaudeFlow([
        'memory', 'list',
        '--namespace', 'performance'
      ]);
      expect(listResult.code).toBe(0);
      for (let i = 0; i < 5; i++) {
        expect(listResult.stdout).toContain(`concurrent/task-${i}`);
      }
    });

    it('should collect performance metrics', async () => {
      const metricsResult = await runClaudeFlow(['agent', 'metrics']);
      expect(metricsResult.code).toBe(0);
      expect(metricsResult.stdout).toMatch(/performance|metrics/i);
    });
  });

  describe('Session Management', () => {
    it('should save and restore session state', async () => {
      const sessionId = `e2e-test-${Date.now()}`;
      
      // Store session data
      await runClaudeFlow([
        'memory', 'store',
        '--key', 'session/current-task',
        '--value', '"Building API"',
        '--namespace', sessionId
      ]);
      
      // End session
      const endResult = await runClaudeFlow([
        'hooks', 'session-end',
        '--session-id', sessionId,
        '--save-state', 'true'
      ]);
      expect(endResult.code).toBe(0);
      
      // Restore session
      const restoreResult = await runClaudeFlow([
        'hooks', 'session-restore',
        '--session-id', sessionId,
        '--load-memory', 'true'
      ]);
      expect(restoreResult.code).toBe(0);
      
      // Verify data is still accessible
      const retrieveResult = await runClaudeFlow([
        'memory', 'retrieve',
        '--key', 'session/current-task',
        '--namespace', sessionId
      ]);
      expect(retrieveResult.code).toBe(0);
      expect(retrieveResult.stdout).toContain('Building API');
    });
  });

  describe('Error Recovery', () => {
    it('should recover from agent crashes', async () => {
      // Simulate agent crash
      await runClaudeFlow([
        'hooks', 'notify',
        '--message', 'Agent CrashedAgent terminated unexpectedly',
        '--level', 'error'
      ]);
      
      // Spawn replacement agent
      const respawnResult = await runClaudeFlow([
        'agent', 'spawn',
        '--type', 'coder',
        '--name', 'ReplacementAgent'
      ]);
      expect(respawnResult.code).toBe(0);
      
      // Verify swarm continues functioning
      const statusResult = await runClaudeFlow(['swarm', 'status']);
      expect(statusResult.code).toBe(0);
      expect(statusResult.stdout).toMatch(/active|running/i);
    });
  });
});