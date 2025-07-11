/**
 * Integration Tests for Claude-Flow v2.0.0 Database Operations
 * Tests the complete flow of database interactions
 */

const { describe, it, expect, beforeAll, afterAll } = require('@jest/globals');
const path = require('path');
const fs = require('fs').promises;
const { spawn } = require('child_process');

// Helper to run Claude Flow commands
async function runClaudeFlow(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('npx', ['claude-flow@alpha', ...args], {
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

describe('Database Operations Integration Tests', () => {
  const testNamespace = `test-${Date.now()}`;
  
  describe('Memory Persistence Across Sessions', () => {
    it('should persist data across command invocations', async () => {
      // Store data
      const storeResult = await runClaudeFlow([
        'memory', 'store',
        '--key', 'integration-test',
        '--value', JSON.stringify({ test: true, timestamp: Date.now() }),
        '--namespace', testNamespace
      ]);
      expect(storeResult.code).toBe(0);
      
      // Retrieve data in a new invocation
      const retrieveResult = await runClaudeFlow([
        'memory', 'retrieve',
        '--key', 'integration-test',
        '--namespace', testNamespace
      ]);
      expect(retrieveResult.code).toBe(0);
      expect(retrieveResult.stdout).toContain('test');
      expect(retrieveResult.stdout).toContain('timestamp');
    });

    it('should handle multiple namespaces correctly', async () => {
      // Store in namespace 1
      await runClaudeFlow([
        'memory', 'store',
        '--key', 'shared-key',
        '--value', '"namespace1-value"',
        '--namespace', `${testNamespace}-ns1`
      ]);
      
      // Store in namespace 2
      await runClaudeFlow([
        'memory', 'store',
        '--key', 'shared-key',
        '--value', '"namespace2-value"',
        '--namespace', `${testNamespace}-ns2`
      ]);
      
      // Retrieve from namespace 1
      const result1 = await runClaudeFlow([
        'memory', 'retrieve',
        '--key', 'shared-key',
        '--namespace', `${testNamespace}-ns1`
      ]);
      expect(result1.stdout).toContain('namespace1-value');
      
      // Retrieve from namespace 2
      const result2 = await runClaudeFlow([
        'memory', 'retrieve',
        '--key', 'shared-key',
        '--namespace', `${testNamespace}-ns2`
      ]);
      expect(result2.stdout).toContain('namespace2-value');
    });
  });

  describe('Swarm State Persistence', () => {
    it('should persist swarm initialization state', async () => {
      // Initialize swarm
      const initResult = await runClaudeFlow([
        'swarm', 'init',
        '--topology', 'hierarchical',
        '--max-agents', '5'
      ]);
      expect(initResult.code).toBe(0);
      
      // Check status in new invocation
      const statusResult = await runClaudeFlow(['swarm', 'status']);
      expect(statusResult.code).toBe(0);
      expect(statusResult.stdout).toMatch(/hierarchical/i);
      expect(statusResult.stdout).toMatch(/5|agents/i);
    });

    it('should persist agent state', async () => {
      // Spawn an agent
      const spawnResult = await runClaudeFlow([
        'agent', 'spawn',
        '--type', 'researcher',
        '--name', 'IntegrationTestAgent'
      ]);
      expect(spawnResult.code).toBe(0);
      
      // List agents in new invocation
      const listResult = await runClaudeFlow(['agent', 'list']);
      expect(listResult.code).toBe(0);
      expect(listResult.stdout).toContain('IntegrationTestAgent');
    });
  });

  describe('Hook System Database Integration', () => {
    it('should persist hook execution data', async () => {
      // Execute pre-task hook
      const preTaskResult = await runClaudeFlow([
        'hooks', 'pre-task',
        '--description', 'Integration test task'
      ]);
      expect(preTaskResult.code).toBe(0);
      
      // Check if task ID was persisted (should be retrievable)
      expect(preTaskResult.stdout).toMatch(/task-\d+-\w+/);
    });

    it('should persist notification data', async () => {
      // Send notification
      const notifyResult = await runClaudeFlow([
        'hooks', 'notify',
        '--message', 'Integration test notification',
        '--level', 'success'
      ]);
      expect(notifyResult.code).toBe(0);
      expect(notifyResult.stdout).toContain('saved to .swarm/memory.db');
    });
  });

  describe('Task Orchestration Database State', () => {
    it('should persist task execution state', async () => {
      // Orchestrate a task
      const orchestrateResult = await runClaudeFlow([
        'task', 'orchestrate',
        '--task', 'Database integration test task',
        '--strategy', 'adaptive'
      ]);
      expect(orchestrateResult.code).toBe(0);
      
      // Check task status
      const statusResult = await runClaudeFlow(['task', 'status']);
      expect(statusResult.code).toBe(0);
      expect(statusResult.stdout).toMatch(/task|status/i);
    });
  });

  describe('Search and Pattern Matching', () => {
    it('should search across stored data', async () => {
      // Store multiple related items
      await runClaudeFlow([
        'memory', 'store',
        '--key', 'search-item-1',
        '--value', '"search test data 1"',
        '--namespace', testNamespace
      ]);
      
      await runClaudeFlow([
        'memory', 'store',
        '--key', 'search-item-2',
        '--value', '"search test data 2"',
        '--namespace', testNamespace
      ]);
      
      await runClaudeFlow([
        'memory', 'store',
        '--key', 'other-item',
        '--value', '"other data"',
        '--namespace', testNamespace
      ]);
      
      // Search for pattern
      const searchResult = await runClaudeFlow([
        'memory', 'search',
        '--pattern', 'search-item',
        '--namespace', testNamespace
      ]);
      expect(searchResult.code).toBe(0);
      expect(searchResult.stdout).toContain('search-item-1');
      expect(searchResult.stdout).toContain('search-item-2');
      expect(searchResult.stdout).not.toContain('other-item');
    });
  });

  describe('TTL and Expiration', () => {
    it('should handle TTL expiration', async () => {
      // Store with short TTL
      await runClaudeFlow([
        'memory', 'store',
        '--key', 'ttl-test',
        '--value', '"expires soon"',
        '--ttl', '2', // 2 seconds
        '--namespace', testNamespace
      ]);
      
      // Should exist immediately
      const immediateResult = await runClaudeFlow([
        'memory', 'retrieve',
        '--key', 'ttl-test',
        '--namespace', testNamespace
      ]);
      expect(immediateResult.code).toBe(0);
      expect(immediateResult.stdout).toContain('expires soon');
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      // Should be expired
      const expiredResult = await runClaudeFlow([
        'memory', 'retrieve',
        '--key', 'ttl-test',
        '--namespace', testNamespace
      ]);
      expect(expiredResult.stdout).toMatch(/not found|null|expired/i);
    });
  });

  describe('Database Integrity', () => {
    it('should maintain data integrity under concurrent operations', async () => {
      const promises = [];
      
      // Concurrent writes
      for (let i = 0; i < 10; i++) {
        promises.push(runClaudeFlow([
          'memory', 'store',
          '--key', `concurrent-${i}`,
          '--value', `"value-${i}"`,
          '--namespace', testNamespace
        ]));
      }
      
      const results = await Promise.all(promises);
      results.forEach(result => expect(result.code).toBe(0));
      
      // Verify all writes succeeded
      const listResult = await runClaudeFlow([
        'memory', 'list',
        '--namespace', testNamespace
      ]);
      
      for (let i = 0; i < 10; i++) {
        expect(listResult.stdout).toContain(`concurrent-${i}`);
      }
    });
  });

  describe('Cleanup Operations', () => {
    it('should delete stored data', async () => {
      // Store data
      await runClaudeFlow([
        'memory', 'store',
        '--key', 'delete-test',
        '--value', '"to be deleted"',
        '--namespace', testNamespace
      ]);
      
      // Delete data
      const deleteResult = await runClaudeFlow([
        'memory', 'delete',
        '--key', 'delete-test',
        '--namespace', testNamespace
      ]);
      expect(deleteResult.code).toBe(0);
      
      // Verify deletion
      const retrieveResult = await runClaudeFlow([
        'memory', 'retrieve',
        '--key', 'delete-test',
        '--namespace', testNamespace
      ]);
      expect(retrieveResult.stdout).toMatch(/not found|null/i);
    });
  });
});