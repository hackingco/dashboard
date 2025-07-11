/**
 * Memory Store for Claude-Flow
 * Provides persistent memory across sessions with namespace support
 */

import logger from '../utils/logger.js';

export class MemoryStore {
  constructor(dbManager) {
    this.db = dbManager;
    this.cache = new Map(); // In-memory cache for performance
    this.cacheTimeout = 300000; // 5 minutes
  }

  /**
   * Store a value in memory
   * @param {string} key - The storage key
   * @param {any} value - The value to store
   * @param {string} namespace - The namespace (default: 'default')
   * @param {number} ttl - Time to live in seconds (optional)
   */
  async store(key, value, namespace = 'default', ttl = null) {
    try {
      const cacheKey = `${namespace}:${key}`;
      
      // Update cache
      this.cache.set(cacheKey, {
        value,
        timestamp: Date.now(),
        ttl
      });

      // Store in database
      await this.db.storeMemory(key, value, namespace, ttl);
      
      logger.debug(`Stored memory: ${cacheKey}`);
      return { success: true, key, namespace };
    } catch (error) {
      logger.error(`Failed to store memory: ${key}`, error);
      throw error;
    }
  }

  /**
   * Retrieve a value from memory
   * @param {string} key - The storage key
   * @param {string} namespace - The namespace (default: 'default')
   */
  async retrieve(key, namespace = 'default') {
    try {
      const cacheKey = `${namespace}:${key}`;
      
      // Check cache first
      const cached = this.cache.get(cacheKey);
      if (cached) {
        const age = Date.now() - cached.timestamp;
        
        // Check if cache is still valid
        if (age < this.cacheTimeout) {
          // Check TTL if set
          if (cached.ttl && age > cached.ttl * 1000) {
            this.cache.delete(cacheKey);
            await this.db.deleteMemory(key, namespace);
            return null;
          }
          return cached.value;
        }
      }

      // Retrieve from database
      const value = await this.db.retrieveMemory(key, namespace);
      
      if (value !== null) {
        // Update cache
        this.cache.set(cacheKey, {
          value,
          timestamp: Date.now()
        });
      }
      
      return value;
    } catch (error) {
      logger.error(`Failed to retrieve memory: ${key}`, error);
      throw error;
    }
  }

  /**
   * List all keys in a namespace
   * @param {string} namespace - The namespace (default: 'default')
   */
  async list(namespace = 'default') {
    try {
      return await this.db.listMemory(namespace);
    } catch (error) {
      logger.error(`Failed to list memory in namespace: ${namespace}`, error);
      throw error;
    }
  }

  /**
   * Search for keys matching a pattern
   * @param {string} pattern - The search pattern
   * @param {string} namespace - The namespace (default: 'default')
   */
  async search(pattern, namespace = 'default') {
    try {
      return await this.db.searchMemory(pattern, namespace);
    } catch (error) {
      logger.error(`Failed to search memory: ${pattern}`, error);
      throw error;
    }
  }

  /**
   * Delete a key from memory
   * @param {string} key - The storage key
   * @param {string} namespace - The namespace (default: 'default')
   */
  async delete(key, namespace = 'default') {
    try {
      const cacheKey = `${namespace}:${key}`;
      this.cache.delete(cacheKey);
      
      await this.db.deleteMemory(key, namespace);
      
      logger.debug(`Deleted memory: ${cacheKey}`);
      return { success: true, key, namespace };
    } catch (error) {
      logger.error(`Failed to delete memory: ${key}`, error);
      throw error;
    }
  }

  /**
   * Clear all entries in a namespace
   * @param {string} namespace - The namespace to clear
   */
  async clearNamespace(namespace) {
    try {
      // Clear cache entries
      for (const [key] of this.cache) {
        if (key.startsWith(`${namespace}:`)) {
          this.cache.delete(key);
        }
      }

      // Get all keys in namespace and delete them
      const keys = await this.list(namespace);
      for (const key of keys) {
        await this.db.deleteMemory(key, namespace);
      }
      
      logger.info(`Cleared namespace: ${namespace}`);
      return { success: true, cleared: keys.length };
    } catch (error) {
      logger.error(`Failed to clear namespace: ${namespace}`, error);
      throw error;
    }
  }

  /**
   * Store multiple key-value pairs
   * @param {Object} kvPairs - Object with key-value pairs
   * @param {string} namespace - The namespace (default: 'default')
   * @param {number} ttl - Time to live in seconds (optional)
   */
  async storeBatch(kvPairs, namespace = 'default', ttl = null) {
    try {
      const results = [];
      
      for (const [key, value] of Object.entries(kvPairs)) {
        const result = await this.store(key, value, namespace, ttl);
        results.push(result);
      }
      
      return { success: true, stored: results.length };
    } catch (error) {
      logger.error('Failed to store batch', error);
      throw error;
    }
  }

  /**
   * Create a session-specific namespace
   * @param {string} sessionId - The session ID
   */
  createSessionNamespace(sessionId) {
    return `session:${sessionId}`;
  }

  /**
   * Store agent-specific data
   * @param {string} agentId - The agent ID
   * @param {string} key - The storage key
   * @param {any} value - The value to store
   */
  async storeAgentData(agentId, key, value) {
    const namespace = `agent:${agentId}`;
    return await this.store(key, value, namespace);
  }

  /**
   * Retrieve agent-specific data
   * @param {string} agentId - The agent ID
   * @param {string} key - The storage key
   */
  async retrieveAgentData(agentId, key) {
    const namespace = `agent:${agentId}`;
    return await this.retrieve(key, namespace);
  }

  /**
   * Store swarm coordination data
   * @param {string} swarmId - The swarm ID
   * @param {string} key - The storage key
   * @param {any} value - The value to store
   */
  async storeSwarmData(swarmId, key, value) {
    const namespace = `swarm:${swarmId}`;
    return await this.store(key, value, namespace);
  }

  /**
   * Retrieve swarm coordination data
   * @param {string} swarmId - The swarm ID
   * @param {string} key - The storage key
   */
  async retrieveSwarmData(swarmId, key) {
    const namespace = `swarm:${swarmId}`;
    return await this.retrieve(key, namespace);
  }

  /**
   * Get memory usage statistics
   */
  async getStats() {
    try {
      const namespaces = new Set();
      const stats = {
        totalKeys: 0,
        cacheSize: this.cache.size,
        namespaces: {}
      };

      // Get all namespaces from cache
      for (const [key] of this.cache) {
        const [namespace] = key.split(':');
        namespaces.add(namespace);
      }

      // Get counts for each namespace
      for (const namespace of namespaces) {
        const keys = await this.list(namespace);
        stats.namespaces[namespace] = keys.length;
        stats.totalKeys += keys.length;
      }

      return stats;
    } catch (error) {
      logger.error('Failed to get memory stats', error);
      throw error;
    }
  }

  /**
   * Export memory to JSON
   * @param {string} namespace - The namespace to export (optional)
   */
  async export(namespace = null) {
    try {
      const data = {};
      
      if (namespace) {
        const keys = await this.list(namespace);
        for (const key of keys) {
          data[key] = await this.retrieve(key, namespace);
        }
      } else {
        // Export all namespaces
        const stats = await this.getStats();
        for (const ns of Object.keys(stats.namespaces)) {
          data[ns] = {};
          const keys = await this.list(ns);
          for (const key of keys) {
            data[ns][key] = await this.retrieve(key, ns);
          }
        }
      }
      
      return data;
    } catch (error) {
      logger.error('Failed to export memory', error);
      throw error;
    }
  }

  /**
   * Import memory from JSON
   * @param {Object} data - The data to import
   * @param {string} namespace - The namespace to import to (optional)
   */
  async import(data, namespace = null) {
    try {
      if (namespace) {
        // Import to specific namespace
        await this.storeBatch(data, namespace);
      } else {
        // Import multiple namespaces
        for (const [ns, nsData] of Object.entries(data)) {
          await this.storeBatch(nsData, ns);
        }
      }
      
      return { success: true };
    } catch (error) {
      logger.error('Failed to import memory', error);
      throw error;
    }
  }

  /**
   * Clear the in-memory cache
   */
  clearCache() {
    this.cache.clear();
    logger.debug('Memory cache cleared');
  }

  /**
   * Cleanup expired entries
   */
  async cleanup() {
    try {
      const expired = await this.db.cleanup();
      
      // Clear expired entries from cache
      for (const [key, cached] of this.cache) {
        if (cached.ttl) {
          const age = Date.now() - cached.timestamp;
          if (age > cached.ttl * 1000) {
            this.cache.delete(key);
          }
        }
      }
      
      logger.info(`Memory cleanup completed, removed ${expired} expired entries`);
      return { success: true, removed: expired };
    } catch (error) {
      logger.error('Failed to cleanup memory', error);
      throw error;
    }
  }
}