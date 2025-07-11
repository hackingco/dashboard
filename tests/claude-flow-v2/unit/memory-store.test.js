/**
 * Unit tests for Claude-Flow v2.0.0 Memory Store
 * Tests the SQLite-based persistent memory system
 */

const { describe, it, expect, beforeEach, afterAll } = require('@jest/globals');
const fs = require('fs').promises;
const path = require('path');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

// Simulate the memory store module
class MemoryStore {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.db = null;
  }

  async initialize() {
    this.db = await open({
      filename: this.dbPath,
      driver: sqlite3.Database
    });

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS memory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        namespace TEXT DEFAULT 'default',
        ttl INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  async store(key, value, namespace = 'default', ttl = null) {
    const serialized = JSON.stringify(value);
    await this.db.run(
      `INSERT OR REPLACE INTO memory (key, value, namespace, ttl, updated_at) 
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [key, serialized, namespace, ttl]
    );
  }

  async retrieve(key, namespace = 'default') {
    const row = await this.db.get(
      'SELECT * FROM memory WHERE key = ? AND namespace = ?',
      [key, namespace]
    );
    
    if (!row) return null;
    
    // Check TTL
    if (row.ttl) {
      const createdAt = new Date(row.created_at).getTime();
      const now = Date.now();
      if (now - createdAt > row.ttl * 1000) {
        await this.delete(key, namespace);
        return null;
      }
    }
    
    return JSON.parse(row.value);
  }

  async list(namespace = 'default') {
    const rows = await this.db.all(
      'SELECT key FROM memory WHERE namespace = ?',
      [namespace]
    );
    return rows.map(row => row.key);
  }

  async delete(key, namespace = 'default') {
    await this.db.run(
      'DELETE FROM memory WHERE key = ? AND namespace = ?',
      [key, namespace]
    );
  }

  async search(pattern, namespace = 'default') {
    const rows = await this.db.all(
      'SELECT * FROM memory WHERE namespace = ? AND key LIKE ?',
      [namespace, `%${pattern}%`]
    );
    return rows.map(row => ({
      key: row.key,
      value: JSON.parse(row.value)
    }));
  }

  async close() {
    if (this.db) {
      await this.db.close();
    }
  }
}

describe('MemoryStore Unit Tests', () => {
  let memoryStore;
  const testDbPath = path.join(__dirname, 'test-memory.db');

  beforeEach(async () => {
    // Clean up any existing test database
    try {
      await fs.unlink(testDbPath);
    } catch (err) {
      // File doesn't exist, which is fine
    }
    
    memoryStore = new MemoryStore(testDbPath);
    await memoryStore.initialize();
  });

  afterAll(async () => {
    if (memoryStore) {
      await memoryStore.close();
    }
    // Clean up test database
    try {
      await fs.unlink(testDbPath);
    } catch (err) {
      // Ignore cleanup errors
    }
  });

  describe('Basic Operations', () => {
    it('should store and retrieve values', async () => {
      const testData = { name: 'test', value: 42 };
      await memoryStore.store('test-key', testData);
      
      const retrieved = await memoryStore.retrieve('test-key');
      expect(retrieved).toEqual(testData);
    });

    it('should handle non-existent keys', async () => {
      const result = await memoryStore.retrieve('non-existent');
      expect(result).toBeNull();
    });

    it('should update existing values', async () => {
      await memoryStore.store('update-key', { version: 1 });
      await memoryStore.store('update-key', { version: 2 });
      
      const result = await memoryStore.retrieve('update-key');
      expect(result.version).toBe(2);
    });

    it('should delete values', async () => {
      await memoryStore.store('delete-key', { data: 'test' });
      await memoryStore.delete('delete-key');
      
      const result = await memoryStore.retrieve('delete-key');
      expect(result).toBeNull();
    });
  });

  describe('Namespace Support', () => {
    it('should isolate values by namespace', async () => {
      await memoryStore.store('same-key', { ns: 'default' }, 'default');
      await memoryStore.store('same-key', { ns: 'custom' }, 'custom');
      
      const defaultValue = await memoryStore.retrieve('same-key', 'default');
      const customValue = await memoryStore.retrieve('same-key', 'custom');
      
      expect(defaultValue.ns).toBe('default');
      expect(customValue.ns).toBe('custom');
    });

    it('should list keys by namespace', async () => {
      await memoryStore.store('key1', {}, 'ns1');
      await memoryStore.store('key2', {}, 'ns1');
      await memoryStore.store('key3', {}, 'ns2');
      
      const ns1Keys = await memoryStore.list('ns1');
      const ns2Keys = await memoryStore.list('ns2');
      
      expect(ns1Keys).toHaveLength(2);
      expect(ns2Keys).toHaveLength(1);
    });
  });

  describe('TTL Support', () => {
    it('should expire values after TTL', async () => {
      await memoryStore.store('ttl-key', { data: 'expires' }, 'default', 1); // 1 second TTL
      
      // Should exist immediately
      let result = await memoryStore.retrieve('ttl-key');
      expect(result).not.toBeNull();
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Should be expired
      result = await memoryStore.retrieve('ttl-key');
      expect(result).toBeNull();
    });

    it('should handle values without TTL', async () => {
      await memoryStore.store('no-ttl', { data: 'persistent' });
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const result = await memoryStore.retrieve('no-ttl');
      expect(result).not.toBeNull();
    });
  });

  describe('Search Functionality', () => {
    it('should search by pattern', async () => {
      await memoryStore.store('swarm-agent-1', { type: 'agent' });
      await memoryStore.store('swarm-agent-2', { type: 'agent' });
      await memoryStore.store('task-123', { type: 'task' });
      
      const swarmResults = await memoryStore.search('swarm');
      expect(swarmResults).toHaveLength(2);
      expect(swarmResults[0].key).toContain('swarm');
    });

    it('should search within namespace', async () => {
      await memoryStore.store('test-1', {}, 'ns1');
      await memoryStore.store('test-2', {}, 'ns2');
      
      const results = await memoryStore.search('test', 'ns1');
      expect(results).toHaveLength(1);
    });
  });

  describe('Complex Data Types', () => {
    it('should handle nested objects', async () => {
      const complexData = {
        level1: {
          level2: {
            array: [1, 2, 3],
            value: 'deep'
          }
        },
        timestamp: new Date().toISOString()
      };
      
      await memoryStore.store('complex', complexData);
      const retrieved = await memoryStore.retrieve('complex');
      
      expect(retrieved).toEqual(complexData);
    });

    it('should handle large values', async () => {
      const largeArray = Array(1000).fill(0).map((_, i) => ({
        id: i,
        data: 'x'.repeat(100)
      }));
      
      await memoryStore.store('large', largeArray);
      const retrieved = await memoryStore.retrieve('large');
      
      expect(retrieved).toHaveLength(1000);
    });
  });

  describe('Concurrency', () => {
    it('should handle concurrent writes', async () => {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(memoryStore.store(`concurrent-${i}`, { index: i }));
      }
      
      await Promise.all(promises);
      
      const keys = await memoryStore.list();
      const concurrentKeys = keys.filter(k => k.startsWith('concurrent-'));
      expect(concurrentKeys).toHaveLength(10);
    });
  });
});