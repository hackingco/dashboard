/**
 * Hooks System Tests for Claude-Flow v2.0.0
 * Tests all hook types and their integration with the memory system
 */

const { describe, it, expect, beforeEach, afterAll } = require('@jest/globals');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

// Helper to run hook commands
async function runHook(hookType, args = []) {
  return new Promise((resolve, reject) => {
    const proc = spawn('npx', ['claude-flow@alpha', 'hooks', hookType, ...args], {
      shell: true,
      env: { ...process.env, NO_COLOR: '1' }
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

describe('Claude-Flow Hooks System Tests', () => {
  const testWorkDir = path.join(__dirname, 'test-hooks-workspace');
  
  beforeEach(async () => {
    await fs.mkdir(testWorkDir, { recursive: true });
    process.chdir(testWorkDir);
  });
  
  afterAll(async () => {
    process.chdir(__dirname);
    await fs.rm(testWorkDir, { recursive: true, force: true });
  });

  describe('Pre-Operation Hooks', () => {
    describe('pre-task hook', () => {
      it('should execute pre-task hook successfully', async () => {
        const result = await runHook('pre-task', [
          '--description', 'Test task for hooks validation'
        ]);
        
        expect(result.code).toBe(0);
        expect(result.stdout).toContain('pre-task hook');
        expect(result.stdout).toMatch(/task-\d+-\w+/); // Task ID format
        expect(result.stdout).toContain('Saved to .swarm/memory.db');
      });

      it('should handle auto-spawn-agents parameter', async () => {
        const result = await runHook('pre-task', [
          '--description', 'Test with auto-spawn disabled',
          '--auto-spawn-agents', 'false'
        ]);
        
        expect(result.code).toBe(0);
        expect(result.stdout).not.toContain('Auto-spawning agents');
      });

      it('should reject missing description', async () => {
        const result = await runHook('pre-task', []);
        
        expect(result.code).not.toBe(0);
        expect(result.stderr).toMatch(/description|required/i);
      });
    });

    describe('pre-edit hook', () => {
      it('should validate file edit operations', async () => {
        // Create a test file
        await fs.writeFile(path.join(testWorkDir, 'test.js'), 'console.log("test");');
        
        const result = await runHook('pre-edit', [
          '--file', 'test.js',
          '--operation', 'modify'
        ]);
        
        expect(result.code).toBe(0);
        expect(result.stdout).toContain('pre-edit hook');
        expect(result.stdout).toContain('test.js');
      });

      it('should detect dangerous operations', async () => {
        const result = await runHook('pre-edit', [
          '--file', '/etc/passwd',
          '--operation', 'delete'
        ]);
        
        // Should warn or prevent dangerous operations
        expect(result.stdout).toMatch(/warning|danger|restricted/i);
      });
    });

    describe('pre-bash hook', () => {
      it('should validate safe commands', async () => {
        const result = await runHook('pre-bash', [
          '--command', 'echo "Hello World"'
        ]);
        
        expect(result.code).toBe(0);
        expect(result.stdout).toContain('pre-bash hook');
        expect(result.stdout).toContain('Command safety check');
      });

      it('should flag dangerous commands', async () => {
        const result = await runHook('pre-bash', [
          '--command', 'rm -rf /'
        ]);
        
        expect(result.stdout).toMatch(/danger|warning|blocked/i);
      });

      it('should check sudo commands', async () => {
        const result = await runHook('pre-bash', [
          '--command', 'sudo rm -rf /tmp/*'
        ]);
        
        expect(result.stdout).toMatch(/sudo|elevated|permission/i);
      });
    });
  });

  describe('Post-Operation Hooks', () => {
    describe('post-task hook', () => {
      it('should complete task tracking', async () => {
        const result = await runHook('post-task', [
          '--task-id', 'test-task-123',
          '--analyze-performance', 'true'
        ]);
        
        expect(result.code).toBe(0);
        expect(result.stdout).toContain('post-task hook');
        expect(result.stdout).toContain('test-task-123');
        expect(result.stdout).toContain('Performance analysis');
      });

      it('should generate task summary', async () => {
        const result = await runHook('post-task', [
          '--task-id', 'test-task-456',
          '--generate-summary', 'true'
        ]);
        
        expect(result.code).toBe(0);
        expect(result.stdout).toMatch(/summary|complete/i);
      });
    });

    describe('post-edit hook', () => {
      it('should log file modifications', async () => {
        const testFile = path.join(testWorkDir, 'modified.js');
        await fs.writeFile(testFile, 'const x = 1;');
        
        const result = await runHook('post-edit', [
          '--file', testFile,
          '--memory-key', 'test/edit/modified'
        ]);
        
        expect(result.code).toBe(0);
        expect(result.stdout).toContain('post-edit hook');
        expect(result.stdout).toContain('Post-edit data saved');
      });

      it('should auto-format code files', async () => {
        const testFile = path.join(testWorkDir, 'format.js');
        await fs.writeFile(testFile, 'const x=1;function test(){return true}');
        
        const result = await runHook('post-edit', [
          '--file', testFile,
          '--auto-format', 'true'
        ]);
        
        expect(result.code).toBe(0);
        // Note: Actual formatting would require prettier/eslint integration
        expect(result.stdout).toMatch(/format|style/i);
      });
    });

    describe('post-bash hook', () => {
      it('should log command execution', async () => {
        const result = await runHook('post-bash', [
          '--command', 'echo "test executed"',
          '--exit-code', '0',
          '--duration', '150'
        ]);
        
        expect(result.code).toBe(0);
        expect(result.stdout).toContain('post-bash hook');
        expect(result.stdout).toContain('150'); // Duration
      });

      it('should track failed commands', async () => {
        const result = await runHook('post-bash', [
          '--command', 'false',
          '--exit-code', '1',
          '--error', 'Command failed'
        ]);
        
        expect(result.code).toBe(0);
        expect(result.stdout).toMatch(/fail|error/i);
      });
    });

    describe('post-search hook', () => {
      it('should cache search results', async () => {
        const result = await runHook('post-search', [
          '--query', 'test search query',
          '--results-count', '10',
          '--cache-key', 'search/test/1'
        ]);
        
        expect(result.code).toBe(0);
        expect(result.stdout).toContain('post-search hook');
        expect(result.stdout).toContain('Cached');
      });
    });
  });

  describe('MCP Integration Hooks', () => {
    describe('mcp-initialized hook', () => {
      it('should persist MCP configuration', async () => {
        const result = await runHook('mcp-initialized', [
          '--server-name', 'claude-flow',
          '--version', '2.0.0'
        ]);
        
        expect(result.code).toBe(0);
        expect(result.stdout).toContain('MCP initialized');
        expect(result.stdout).toContain('Configuration saved');
      });
    });

    describe('agent-spawned hook', () => {
      it('should update agent roster', async () => {
        const result = await runHook('agent-spawned', [
          '--name', 'TestAgent',
          '--type', 'researcher',
          '--capabilities', 'search,analyze'
        ]);
        
        expect(result.code).toBe(0);
        expect(result.stdout).toContain('Agent spawned');
        expect(result.stdout).toContain('TestAgent');
        expect(result.stdout).toContain('researcher');
      });
    });

    describe('task-orchestrated hook', () => {
      it('should monitor task progress', async () => {
        const result = await runHook('task-orchestrated', [
          '--task-id', 'orch-123',
          '--agents-count', '4',
          '--strategy', 'parallel'
        ]);
        
        expect(result.code).toBe(0);
        expect(result.stdout).toContain('Task orchestrated');
        expect(result.stdout).toContain('4 agents');
        expect(result.stdout).toContain('parallel');
      });
    });

    describe('neural-trained hook', () => {
      it('should save pattern improvements', async () => {
        const result = await runHook('neural-trained', [
          '--pattern-type', 'coordination',
          '--accuracy', '0.85',
          '--iterations', '100'
        ]);
        
        expect(result.code).toBe(0);
        expect(result.stdout).toContain('Neural pattern trained');
        expect(result.stdout).toContain('85%'); // Accuracy
      });
    });
  });

  describe('Session Hooks', () => {
    describe('session-end hook', () => {
      it('should generate session summary', async () => {
        const result = await runHook('session-end', [
          '--session-id', 'test-session-123',
          '--generate-summary', 'true',
          '--export-metrics', 'true'
        ]);
        
        expect(result.code).toBe(0);
        expect(result.stdout).toContain('Session ended');
        expect(result.stdout).toContain('Summary generated');
        expect(result.stdout).toContain('Metrics exported');
      });

      it('should save session state', async () => {
        const result = await runHook('session-end', [
          '--session-id', 'test-session-456',
          '--save-state', 'true'
        ]);
        
        expect(result.code).toBe(0);
        expect(result.stdout).toContain('State saved');
      });
    });

    describe('session-restore hook', () => {
      it('should restore previous session', async () => {
        const result = await runHook('session-restore', [
          '--session-id', 'test-session-123',
          '--load-memory', 'true'
        ]);
        
        expect(result.code).toBe(0);
        expect(result.stdout).toContain('Session restored');
        expect(result.stdout).toMatch(/memory|state|loaded/i);
      });

      it('should handle missing sessions', async () => {
        const result = await runHook('session-restore', [
          '--session-id', 'non-existent-session'
        ]);
        
        expect(result.stdout).toMatch(/not found|no session|new session/i);
      });
    });

    describe('notify hook', () => {
      it('should send notifications', async () => {
        const result = await runHook('notify', [
          '--message', 'Test notification message',
          '--level', 'success'
        ]);
        
        expect(result.code).toBe(0);
        expect(result.stdout).toContain('NOTIFICATION');
        expect(result.stdout).toContain('Test notification message');
        expect(result.stdout).toContain('success');
      });

      it('should support different notification levels', async () => {
        const levels = ['info', 'warning', 'error', 'success'];
        
        for (const level of levels) {
          const result = await runHook('notify', [
            '--message', `${level} level test`,
            '--level', level
          ]);
          
          expect(result.code).toBe(0);
          expect(result.stdout).toContain(level);
        }
      });

      it('should include telemetry data', async () => {
        const result = await runHook('notify', [
          '--message', 'Telemetry test',
          '--level', 'info',
          '--telemetry', 'true'
        ]);
        
        expect(result.code).toBe(0);
        expect(result.stdout).toMatch(/telemetry|metrics/i);
      });
    });
  });

  describe('Hook Chain Integration', () => {
    it('should support hook sequences', async () => {
      // Pre-task
      const preTask = await runHook('pre-task', [
        '--description', 'Integration test task'
      ]);
      expect(preTask.code).toBe(0);
      
      // Extract task ID
      const taskIdMatch = preTask.stdout.match(/task-(\d+-\w+)/);
      const taskId = taskIdMatch ? taskIdMatch[1] : 'test-task';
      
      // Simulate work with notifications
      const notify = await runHook('notify', [
        '--message', 'Task in progress',
        '--level', 'info'
      ]);
      expect(notify.code).toBe(0);
      
      // Post-task
      const postTask = await runHook('post-task', [
        '--task-id', `task-${taskId}`,
        '--analyze-performance', 'true'
      ]);
      expect(postTask.code).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid hook types', async () => {
      const result = await runHook('invalid-hook', []);
      expect(result.code).not.toBe(0);
      expect(result.stderr).toMatch(/unknown|invalid/i);
    });

    it('should validate required parameters', async () => {
      const result = await runHook('notify', [
        // Missing required --message
        '--level', 'info'
      ]);
      
      expect(result.code).not.toBe(0);
      expect(result.stderr).toMatch(/message|required/i);
    });

    it('should handle hook execution failures gracefully', async () => {
      // Test with invalid file path
      const result = await runHook('post-edit', [
        '--file', '/invalid/path/that/does/not/exist.js',
        '--memory-key', 'test'
      ]);
      
      // Should handle gracefully even if file doesn't exist
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('post-edit hook');
    });
  });
});