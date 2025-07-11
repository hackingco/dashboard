/**
 * Database Manager for Claude-Flow
 * Handles both SQLite (local) and Supabase (cloud) connections
 */

import Database from 'better-sqlite3';
import { createClient } from '@supabase/supabase-js';
import { join } from 'path';
import { homedir } from 'os';
import { existsSync, mkdirSync } from 'fs';
import logger from '../utils/logger.js';

export class DatabaseManager {
  constructor(config = {}) {
    this.config = {
      localDbPath: config.localDbPath || join(homedir(), '.claude-flow', 'data.db'),
      supabaseUrl: config.supabaseUrl || process.env.SUPABASE_URL,
      supabaseKey: config.supabaseKey || process.env.SUPABASE_ANON_KEY,
      useCloud: config.useCloud || false,
      ...config
    };

    this.localDb = null;
    this.supabase = null;
    
    this.initialize();
  }

  initialize() {
    // Ensure local directory exists
    const dbDir = join(homedir(), '.claude-flow');
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }

    // Initialize local SQLite database
    this.localDb = new Database(this.config.localDbPath);
    this.setupLocalSchema();

    // Initialize Supabase if credentials are available
    if (this.config.supabaseUrl && this.config.supabaseKey) {
      this.supabase = createClient(this.config.supabaseUrl, this.config.supabaseKey);
      logger.info('Supabase connection initialized');
    }
  }

  setupLocalSchema() {
    // Memory store table
    this.localDb.exec(`
      CREATE TABLE IF NOT EXISTS memory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        namespace TEXT DEFAULT 'default',
        ttl INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now')),
        UNIQUE(key, namespace)
      )
    `);

    // Swarm state table
    this.localDb.exec(`
      CREATE TABLE IF NOT EXISTS swarm_state (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        swarm_id TEXT UNIQUE NOT NULL,
        topology TEXT NOT NULL,
        agents TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    // Task history table
    this.localDb.exec(`
      CREATE TABLE IF NOT EXISTS task_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id TEXT UNIQUE NOT NULL,
        description TEXT NOT NULL,
        status TEXT NOT NULL,
        priority TEXT DEFAULT 'medium',
        result TEXT,
        agent_assignments TEXT,
        started_at INTEGER,
        completed_at INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    // Agent metrics table
    this.localDb.exec(`
      CREATE TABLE IF NOT EXISTS agent_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id TEXT NOT NULL,
        metric_type TEXT NOT NULL,
        value REAL NOT NULL,
        metadata TEXT,
        timestamp INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    // Hooks execution log
    this.localDb.exec(`
      CREATE TABLE IF NOT EXISTS hooks_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hook_type TEXT NOT NULL,
        input TEXT,
        output TEXT,
        success INTEGER DEFAULT 1,
        error TEXT,
        duration_ms INTEGER,
        timestamp INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    // Create indexes
    this.localDb.exec(`
      CREATE INDEX IF NOT EXISTS idx_memory_namespace ON memory(namespace);
      CREATE INDEX IF NOT EXISTS idx_memory_created ON memory(created_at);
      CREATE INDEX IF NOT EXISTS idx_task_status ON task_history(status);
      CREATE INDEX IF NOT EXISTS idx_agent_metrics ON agent_metrics(agent_id, metric_type);
      CREATE INDEX IF NOT EXISTS idx_hooks_type ON hooks_log(hook_type);
    `);
  }

  // Memory operations
  async storeMemory(key, value, namespace = 'default', ttl = null) {
    const valueStr = JSON.stringify(value);
    
    if (this.config.useCloud && this.supabase) {
      try {
        const { error } = await this.supabase
          .from('memory')
          .upsert({
            key,
            value: valueStr,
            namespace,
            ttl,
            updated_at: new Date().toISOString()
          });
        
        if (error) throw error;
      } catch (error) {
        logger.error('Supabase memory store failed:', error);
      }
    }

    // Always store locally
    const stmt = this.localDb.prepare(`
      INSERT OR REPLACE INTO memory (key, value, namespace, ttl, updated_at)
      VALUES (?, ?, ?, ?, strftime('%s', 'now'))
    `);
    
    stmt.run(key, valueStr, namespace, ttl);
    return { key, namespace, stored: true };
  }

  async retrieveMemory(key, namespace = 'default') {
    // Try cloud first if enabled
    if (this.config.useCloud && this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('memory')
          .select('value, ttl, created_at')
          .eq('key', key)
          .eq('namespace', namespace)
          .single();
        
        if (!error && data) {
          // Check TTL
          if (data.ttl) {
            const age = Date.now() / 1000 - new Date(data.created_at).getTime() / 1000;
            if (age > data.ttl) {
              await this.deleteMemory(key, namespace);
              return null;
            }
          }
          return JSON.parse(data.value);
        }
      } catch (error) {
        logger.error('Supabase memory retrieve failed:', error);
      }
    }

    // Fallback to local
    const stmt = this.localDb.prepare(`
      SELECT value, ttl, created_at FROM memory
      WHERE key = ? AND namespace = ?
    `);
    
    const row = stmt.get(key, namespace);
    if (!row) return null;

    // Check TTL
    if (row.ttl) {
      const age = Math.floor(Date.now() / 1000) - row.created_at;
      if (age > row.ttl) {
        this.deleteMemory(key, namespace);
        return null;
      }
    }

    return JSON.parse(row.value);
  }

  async listMemory(namespace = 'default') {
    const stmt = this.localDb.prepare(`
      SELECT key FROM memory WHERE namespace = ?
      ORDER BY updated_at DESC
    `);
    
    return stmt.all(namespace).map(row => row.key);
  }

  async searchMemory(pattern, namespace = 'default') {
    const stmt = this.localDb.prepare(`
      SELECT key, value FROM memory
      WHERE namespace = ? AND key LIKE ?
      ORDER BY updated_at DESC
    `);
    
    return stmt.all(namespace, `%${pattern}%`).map(row => ({
      key: row.key,
      value: JSON.parse(row.value)
    }));
  }

  async deleteMemory(key, namespace = 'default') {
    if (this.config.useCloud && this.supabase) {
      try {
        await this.supabase
          .from('memory')
          .delete()
          .eq('key', key)
          .eq('namespace', namespace);
      } catch (error) {
        logger.error('Supabase memory delete failed:', error);
      }
    }

    const stmt = this.localDb.prepare(`
      DELETE FROM memory WHERE key = ? AND namespace = ?
    `);
    
    return stmt.run(key, namespace);
  }

  // Swarm operations
  async saveSwarmState(swarmId, topology, agents, status) {
    const agentsStr = JSON.stringify(agents);
    
    const stmt = this.localDb.prepare(`
      INSERT OR REPLACE INTO swarm_state (swarm_id, topology, agents, status, updated_at)
      VALUES (?, ?, ?, ?, strftime('%s', 'now'))
    `);
    
    return stmt.run(swarmId, topology, agentsStr, status);
  }

  async getSwarmState(swarmId) {
    const stmt = this.localDb.prepare(`
      SELECT * FROM swarm_state WHERE swarm_id = ?
    `);
    
    const row = stmt.get(swarmId);
    if (!row) return null;
    
    return {
      ...row,
      agents: JSON.parse(row.agents)
    };
  }

  // Task operations
  async saveTask(taskId, description, status, priority = 'medium') {
    const stmt = this.localDb.prepare(`
      INSERT OR REPLACE INTO task_history (task_id, description, status, priority)
      VALUES (?, ?, ?, ?)
    `);
    
    return stmt.run(taskId, description, status, priority);
  }

  async updateTaskStatus(taskId, status, result = null) {
    const stmt = this.localDb.prepare(`
      UPDATE task_history
      SET status = ?, result = ?, completed_at = CASE WHEN ? = 'completed' THEN strftime('%s', 'now') ELSE completed_at END
      WHERE task_id = ?
    `);
    
    return stmt.run(status, result ? JSON.stringify(result) : null, status, taskId);
  }

  async getTask(taskId) {
    const stmt = this.localDb.prepare(`
      SELECT * FROM task_history WHERE task_id = ?
    `);
    
    const row = stmt.get(taskId);
    if (!row) return null;
    
    return {
      ...row,
      result: row.result ? JSON.parse(row.result) : null,
      agent_assignments: row.agent_assignments ? JSON.parse(row.agent_assignments) : null
    };
  }

  // Metrics operations
  async recordMetric(agentId, metricType, value, metadata = {}) {
    const stmt = this.localDb.prepare(`
      INSERT INTO agent_metrics (agent_id, metric_type, value, metadata)
      VALUES (?, ?, ?, ?)
    `);
    
    return stmt.run(agentId, metricType, value, JSON.stringify(metadata));
  }

  async getMetrics(agentId, metricType = null, since = null) {
    let query = 'SELECT * FROM agent_metrics WHERE agent_id = ?';
    const params = [agentId];
    
    if (metricType) {
      query += ' AND metric_type = ?';
      params.push(metricType);
    }
    
    if (since) {
      query += ' AND timestamp > ?';
      params.push(since);
    }
    
    query += ' ORDER BY timestamp DESC';
    
    const stmt = this.localDb.prepare(query);
    return stmt.all(...params).map(row => ({
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : {}
    }));
  }

  // Hooks logging
  async logHook(hookType, input, output, success = true, error = null, durationMs = null) {
    const stmt = this.localDb.prepare(`
      INSERT INTO hooks_log (hook_type, input, output, success, error, duration_ms)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    return stmt.run(
      hookType,
      JSON.stringify(input),
      output ? JSON.stringify(output) : null,
      success ? 1 : 0,
      error,
      durationMs
    );
  }

  // Cleanup operations
  async cleanup() {
    // Remove expired memory entries
    const stmt = this.localDb.prepare(`
      DELETE FROM memory
      WHERE ttl IS NOT NULL
      AND (strftime('%s', 'now') - created_at) > ttl
    `);
    
    const result = stmt.run();
    logger.info(`Cleaned up ${result.changes} expired memory entries`);
    
    return result.changes;
  }

  // Close database connections
  close() {
    if (this.localDb) {
      this.localDb.close();
    }
  }
}