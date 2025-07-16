import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';
import { trace } from '../instrumentation/index.js';

class MemoryManager extends EventEmitter {
  constructor() {
    super();
    this.memory = new Map();
    this.persistPath = process.env.MEMORY_PATH || './memory';
    this.autoSaveInterval = null;
  }

  async initialize() {
    try {
      await fs.mkdir(this.persistPath, { recursive: true });
      await this.loadFromDisk();
      this.startAutoSave();
    } catch (error) {
      console.error('Failed to initialize memory manager:', error);
    }
  }

  async store(key, value) {
    this.memory.set(key, {
      value,
      timestamp: new Date().toISOString(),
      accessCount: 0
    });
    
    this.emit('memory-stored', { key, value });
    return { success: true, key };
  }

  async retrieve(key) {
    const entry = this.memory.get(key);
    if (entry) {
      entry.accessCount++;
      entry.lastAccessed = new Date().toISOString();
      this.emit('memory-retrieved', { key, value: entry.value });
      return entry.value;
    }
    return null;
  }

  async list(pattern = '*') {
    const keys = Array.from(this.memory.keys());
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return keys.filter(key => regex.test(key));
  }

  async delete(key) {
    const deleted = this.memory.delete(key);
    if (deleted) {
      this.emit('memory-deleted', { key });
    }
    return deleted;
  }

  async clear() {
    this.memory.clear();
    this.emit('memory-cleared');
  }

  async saveToDisk() {
    try {
      const data = {};
      for (const [key, value] of this.memory.entries()) {
        data[key] = value;
      }
      
      const filePath = path.join(this.persistPath, 'memory.json');
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      this.emit('memory-saved', { entries: this.memory.size });
    } catch (error) {
      console.error('Failed to save memory to disk:', error);
    }
  }

  async loadFromDisk() {
    try {
      const filePath = path.join(this.persistPath, 'memory.json');
      const data = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(data);
      
      for (const [key, value] of Object.entries(parsed)) {
        this.memory.set(key, value);
      }
      
      this.emit('memory-loaded', { entries: this.memory.size });
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Failed to load memory from disk:', error);
      }
    }
  }

  startAutoSave(interval = 60000) {
    this.autoSaveInterval = setInterval(() => {
      this.saveToDisk();
    }, interval);
  }

  stopAutoSave() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
  }

  getStats() {
    const stats = {
      totalEntries: this.memory.size,
      totalSize: 0,
      oldestEntry: null,
      newestEntry: null,
      mostAccessed: null
    };

    let oldestTime = Infinity;
    let newestTime = 0;
    let maxAccess = 0;

    for (const [key, entry] of this.memory.entries()) {
      const size = JSON.stringify(entry).length;
      stats.totalSize += size;

      const time = new Date(entry.timestamp).getTime();
      if (time < oldestTime) {
        oldestTime = time;
        stats.oldestEntry = { key, timestamp: entry.timestamp };
      }
      if (time > newestTime) {
        newestTime = time;
        stats.newestEntry = { key, timestamp: entry.timestamp };
      }
      if (entry.accessCount > maxAccess) {
        maxAccess = entry.accessCount;
        stats.mostAccessed = { key, accessCount: entry.accessCount };
      }
    }

    return stats;
  }
}

// Export singleton instance
export const memoryManager = new MemoryManager();

// Initialize on import
memoryManager.initialize();

// Instrumented memory operations
export const storeMemory = trace(async (key, value) => {
  return await memoryManager.store(key, value);
});

export const retrieveMemory = trace(async (key) => {
  return await memoryManager.retrieve(key);
});

export const listMemory = trace(async (pattern) => {
  return await memoryManager.list(pattern);
});