/**
 * CLI Command Tests for Claude-Flow v2.0.0
 * Tests all CLI commands and their outputs
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

// Helper function to run CLI commands
function runCommand(command, args = []) {
  return new Promise((resolve, reject) => {
    const claudeFlowPath = 'npx';
    const fullArgs = ['claude-flow@alpha', command, ...args];
    
    const proc = spawn(claudeFlowPath, fullArgs, {
      shell: true,
      env: { ...process.env, NO_COLOR: '1' }
    });
    
    let stdout = '';
    let stderr = '';
    
    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    proc.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });
    
    proc.on('error', (err) => {
      reject(err);
    });
  });
}

describe('Claude-Flow CLI Commands', () => {
  const testWorkDir = path.join(__dirname, 'test-workspace');
  
  beforeAll(async () => {
    // Create test workspace
    await fs.mkdir(testWorkDir, { recursive: true });
    process.chdir(testWorkDir);
  });
  
  afterAll(async () => {
    // Clean up test workspace
    process.chdir(__dirname);
    await fs.rm(testWorkDir, { recursive: true, force: true });
  });

  describe('Core Commands', () => {
    test('should show version', async () => {
      const { code, stdout } = await runCommand('--version');
      expect(code).toBe(0);
      expect(stdout).toMatch(/2\.0\.0-alpha/);
    });

    test('should show help', async () => {
      const { code, stdout } = await runCommand('--help');
      expect(code).toBe(0);
      expect(stdout).toContain('Claude Flow');
      expect(stdout).toContain('Commands:');
    });

    test('should list available commands', async () => {
      const { code, stdout } = await runCommand('--help');
      expect(code).toBe(0);
      
      // Check for core commands
      expect(stdout).toContain('swarm');
      expect(stdout).toContain('task');
      expect(stdout).toContain('agent');
      expect(stdout).toContain('memory');
      expect(stdout).toContain('hooks');
      expect(stdout).toContain('mcp');
    });
  });

  describe('Swarm Commands', () => {
    test('should initialize swarm', async () => {
      const { code, stdout } = await runCommand('swarm', ['init', '--topology', 'mesh', '--max-agents', '4']);
      expect(code).toBe(0);
      expect(stdout).toContain('initialized');
      expect(stdout).toMatch(/mesh/i);
    });

    test('should show swarm status', async () => {
      const { code, stdout } = await runCommand('swarm', ['status']);
      expect(code).toBe(0);
      expect(stdout).toContain('Swarm');
      expect(stdout).toMatch(/active|inactive/i);
    });

    test('should handle invalid topology', async () => {
      const { code, stderr } = await runCommand('swarm', ['init', '--topology', 'invalid']);
      expect(code).not.toBe(0);
      expect(stderr).toContain('invalid');
    });
  });

  describe('Agent Commands', () => {
    test('should spawn agent', async () => {
      const { code, stdout } = await runCommand('agent', ['spawn', '--type', 'researcher', '--name', 'TestAgent']);
      expect(code).toBe(0);
      expect(stdout).toContain('spawned');
      expect(stdout).toContain('TestAgent');
    });

    test('should list agents', async () => {
      const { code, stdout } = await runCommand('agent', ['list']);
      expect(code).toBe(0);
      expect(stdout).toMatch(/agents?/i);
    });

    test('should show agent metrics', async () => {
      const { code, stdout } = await runCommand('agent', ['metrics']);
      expect(code).toBe(0);
      expect(stdout).toMatch(/metrics|performance/i);
    });
  });

  describe('Task Commands', () => {
    test('should orchestrate task', async () => {
      const { code, stdout } = await runCommand('task', [
        'orchestrate',
        '--task', 'Test task execution',
        '--strategy', 'parallel'
      ]);
      expect(code).toBe(0);
      expect(stdout).toContain('orchestrat');
    });

    test('should show task status', async () => {
      const { code, stdout } = await runCommand('task', ['status']);
      expect(code).toBe(0);
      expect(stdout).toMatch(/task|status/i);
    });
  });

  describe('Memory Commands', () => {
    test('should store memory', async () => {
      const { code, stdout } = await runCommand('memory', [
        'store',
        '--key', 'test-key',
        '--value', 'test-value',
        '--namespace', 'testing'
      ]);
      expect(code).toBe(0);
      expect(stdout).toContain('stored');
    });

    test('should retrieve memory', async () => {
      const { code, stdout } = await runCommand('memory', [
        'retrieve',
        '--key', 'test-key',
        '--namespace', 'testing'
      ]);
      expect(code).toBe(0);
      expect(stdout).toContain('test-value');
    });

    test('should list memory keys', async () => {
      const { code, stdout } = await runCommand('memory', [
        'list',
        '--namespace', 'testing'
      ]);
      expect(code).toBe(0);
      expect(stdout).toContain('test-key');
    });

    test('should search memory', async () => {
      const { code, stdout } = await runCommand('memory', [
        'search',
        '--pattern', 'test',
        '--namespace', 'testing'
      ]);
      expect(code).toBe(0);
      expect(stdout).toContain('test-key');
    });
  });

  describe('Hooks Commands', () => {
    test('should execute pre-task hook', async () => {
      const { code, stdout } = await runCommand('hooks', [
        'pre-task',
        '--description', 'Test task'
      ]);
      expect(code).toBe(0);
      expect(stdout).toContain('pre-task');
    });

    test('should execute post-task hook', async () => {
      const { code, stdout } = await runCommand('hooks', [
        'post-task',
        '--task-id', 'test-123'
      ]);
      expect(code).toBe(0);
      expect(stdout).toContain('post-task');
    });

    test('should execute notify hook', async () => {
      const { code, stdout } = await runCommand('hooks', [
        'notify',
        '--message', 'Test notification',
        '--level', 'info'
      ]);
      expect(code).toBe(0);
      expect(stdout).toContain('notification');
    });
  });

  describe('MCP Commands', () => {
    test('should start MCP server', async () => {
      const { code, stdout } = await runCommand('mcp', ['start']);
      // MCP server starts in background, so we just check it doesn't error
      expect(code).toBe(0);
      expect(stdout).toMatch(/mcp|server|started/i);
    }, 10000); // Increase timeout for server start

    test('should show MCP tools', async () => {
      const { code, stdout } = await runCommand('mcp', ['tools']);
      expect(code).toBe(0);
      expect(stdout).toContain('swarm_init');
      expect(stdout).toContain('agent_spawn');
      expect(stdout).toContain('task_orchestrate');
    });
  });

  describe('SPARC Mode Commands', () => {
    test('should run SPARC dev mode', async () => {
      const { code, stdout } = await runCommand('sparc', [
        '--mode', 'dev',
        '--task', 'Create hello world'
      ]);
      expect(code).toBe(0);
      expect(stdout).toMatch(/sparc|dev/i);
    });

    test('should list SPARC modes', async () => {
      const { code, stdout } = await runCommand('sparc', ['--list-modes']);
      expect(code).toBe(0);
      expect(stdout).toContain('dev');
      expect(stdout).toContain('api');
      expect(stdout).toContain('ui');
      expect(stdout).toContain('test');
      expect(stdout).toContain('refactor');
    });
  });

  describe('Error Handling', () => {
    test('should handle unknown command', async () => {
      const { code, stderr } = await runCommand('unknown-command');
      expect(code).not.toBe(0);
      expect(stderr).toMatch(/unknown|invalid|command/i);
    });

    test('should handle missing required arguments', async () => {
      const { code, stderr } = await runCommand('memory', ['store', '--key', 'test']);
      expect(code).not.toBe(0);
      expect(stderr).toMatch(/required|missing|value/i);
    });

    test('should handle invalid flag values', async () => {
      const { code, stderr } = await runCommand('swarm', ['init', '--max-agents', 'invalid']);
      expect(code).not.toBe(0);
      expect(stderr).toMatch(/invalid|number/i);
    });
  });

  describe('Integration Features', () => {
    test('should support GitHub integration', async () => {
      const { code, stdout } = await runCommand('github', ['--help']);
      expect(code).toBe(0);
      expect(stdout).toMatch(/github|repository/i);
    });

    test('should support DAA features', async () => {
      const { code, stdout } = await runCommand('daa', ['--help']);
      expect(code).toBe(0);
      expect(stdout).toMatch(/daa|autonomous|agent/i);
    });

    test('should support neural features', async () => {
      const { code, stdout } = await runCommand('neural', ['--help']);
      expect(code).toBe(0);
      expect(stdout).toMatch(/neural|pattern|train/i);
    });
  });
});