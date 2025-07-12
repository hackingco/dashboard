import { exec } from 'child_process';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import Database from 'better-sqlite3';
import type { Database as BetterSqlite3Database } from 'better-sqlite3';

const execAsync = promisify(exec);

interface HiveOptions {
  topology: 'mesh' | 'hierarchical' | 'ring' | 'star';
  maxAgents: number;
  strategy?: 'balanced' | 'specialized' | 'adaptive';
  enableMemory?: boolean;
  enableNeural?: boolean;
}

interface SwarmAgent {
  id: string;
  type: string;
  name: string;
  status: 'idle' | 'busy' | 'error' | 'offline';
  capabilities: string[];
  metadata?: Record<string, any>;
}

interface HiveSwarm {
  id: string;
  name: string;
  topology: string;
  agents: SwarmAgent[];
  memory: Map<string, any>;
  neural: {
    patterns: Map<string, any>;
    training: boolean;
    accuracy: number;
  };
  status: 'initializing' | 'running' | 'scaling' | 'stopped' | 'error';
  createdAt: string;
  lastUpdated: string;
}

export class HiveService {
  private static instance: HiveService;
  private swarms: Map<string, HiveSwarm> = new Map();
  private db: Database.Database | null = null;
  private hivePath: string;

  private constructor() {
    this.hivePath = path.join(process.cwd(), '.hive-mind');
    this.initializeHive();
  }

  static getInstance(): HiveService {
    if (!HiveService.instance) {
      HiveService.instance = new HiveService();
    }
    return HiveService.instance;
  }

  private async initializeHive() {
    try {
      // Ensure hive directory exists
      await fs.mkdir(this.hivePath, { recursive: true });
      
      // Initialize SQLite database for persistent memory
      const dbPath = path.join(this.hivePath, 'hive.db');
      this.db = new Database(dbPath);
      
      // Create tables if they don't exist
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS swarm_memory (
          swarm_id TEXT NOT NULL,
          key TEXT NOT NULL,
          value TEXT,
          created_at INTEGER DEFAULT (strftime('%s', 'now')),
          updated_at INTEGER DEFAULT (strftime('%s', 'now')),
          PRIMARY KEY (swarm_id, key)
        );
        
        CREATE TABLE IF NOT EXISTS neural_patterns (
          swarm_id TEXT NOT NULL,
          pattern_id TEXT NOT NULL,
          pattern_data TEXT,
          accuracy REAL DEFAULT 0,
          uses INTEGER DEFAULT 0,
          created_at INTEGER DEFAULT (strftime('%s', 'now')),
          PRIMARY KEY (swarm_id, pattern_id)
        );
        
        CREATE INDEX IF NOT EXISTS idx_swarm_memory_swarm_id ON swarm_memory(swarm_id);
        CREATE INDEX IF NOT EXISTS idx_neural_patterns_swarm_id ON neural_patterns(swarm_id);
      `);
      
      console.log('🐝 Hive mind initialized at:', this.hivePath);
    } catch (error) {
      console.error('Failed to initialize hive:', error);
    }
  }

  async createSwarm(options: HiveOptions & { name: string; purpose: string }): Promise<HiveSwarm> {
    const swarmId = uuidv4();
    
    try {
      // Initialize swarm with Claude Flow
      const { stdout: initOutput } = await execAsync(
        `npx claude-flow@alpha swarm init --topology ${options.topology} --max-agents ${options.maxAgents} --strategy ${options.strategy || 'balanced'}`
      );
      
      console.log('Claude Flow swarm init:', initOutput);
      
      // Create swarm object
      const swarm: HiveSwarm = {
        id: swarmId,
        name: options.name,
        topology: options.topology,
        agents: [],
        memory: new Map(),
        neural: {
          patterns: new Map(),
          training: false,
          accuracy: 0
        },
        status: 'initializing',
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      };
      
      // Store swarm
      this.swarms.set(swarmId, swarm);
      
      // Enable memory persistence if requested
      if (options.enableMemory && this.db) {
        await this.initializeSwarmMemory(swarmId);
      }
      
      // Enable neural patterns if requested
      if (options.enableNeural) {
        await this.initializeNeuralPatterns(swarmId);
      }
      
      // Store notification in Claude Flow memory
      await execAsync(
        `npx claude-flow@alpha hooks notification --message "Swarm ${swarmId} created with ${options.topology} topology"`
      );
      
      return swarm;
    } catch (error) {
      console.error('Failed to create swarm:', error);
      throw error;
    }
  }

  async spawnAgent(swarmId: string, agentType: string, name?: string): Promise<SwarmAgent> {
    const swarm = this.swarms.get(swarmId);
    if (!swarm) {
      throw new Error('Swarm not found');
    }
    
    try {
      // Spawn agent with Claude Flow
      const agentName = name || `${agentType}-${uuidv4().slice(0, 8)}`;
      const { stdout } = await execAsync(
        `npx claude-flow@alpha agent spawn --type ${agentType} --name "${agentName}"`
      );
      
      console.log('Claude Flow agent spawn:', stdout);
      
      // Create agent object
      const agent: SwarmAgent = {
        id: uuidv4(),
        type: agentType,
        name: agentName,
        status: 'idle',
        capabilities: this.getAgentCapabilities(agentType),
        metadata: {
          spawnedAt: new Date().toISOString()
        }
      };
      
      // Add to swarm
      swarm.agents.push(agent);
      swarm.lastUpdated = new Date().toISOString();
      
      // Store in memory
      await this.storeMemory(swarmId, `agent/${agent.id}`, agent);
      
      return agent;
    } catch (error) {
      console.error('Failed to spawn agent:', error);
      throw error;
    }
  }

  async scaleSwarm(swarmId: string, targetAgents: number): Promise<void> {
    const swarm = this.swarms.get(swarmId);
    if (!swarm) {
      throw new Error('Swarm not found');
    }
    
    swarm.status = 'scaling';
    const currentAgents = swarm.agents.length;
    
    try {
      if (targetAgents > currentAgents) {
        // Spawn additional agents
        const agentTypes = ['researcher', 'coder', 'analyst', 'tester', 'coordinator'];
        const promises = [];
        
        for (let i = currentAgents; i < targetAgents; i++) {
          const agentType = agentTypes[i % agentTypes.length];
          promises.push(this.spawnAgent(swarmId, agentType));
        }
        
        await Promise.all(promises);
      } else if (targetAgents < currentAgents) {
        // Remove excess agents
        swarm.agents = swarm.agents.slice(0, targetAgents);
      }
      
      swarm.status = 'running';
      swarm.lastUpdated = new Date().toISOString();
      
      // Notify via Claude Flow
      await execAsync(
        `npx claude-flow@alpha hooks notification --message "Swarm ${swarmId} scaled to ${targetAgents} agents"`
      );
    } catch (error) {
      swarm.status = 'error';
      console.error('Failed to scale swarm:', error);
      throw error;
    }
  }

  async getSwarmIntelligence(swarmId: string): Promise<any> {
    const swarm = this.swarms.get(swarmId);
    if (!swarm) {
      throw new Error('Swarm not found');
    }
    
    try {
      // Get neural patterns status
      const { stdout: neuralStatus } = await execAsync(
        `npx claude-flow@alpha neural status`
      );
      
      // Get memory usage
      const { stdout: memoryStatus } = await execAsync(
        `npx claude-flow@alpha memory usage --detail detailed`
      );
      
      // Retrieve patterns from database
      const patterns = this.db?.prepare(
        'SELECT * FROM neural_patterns WHERE swarm_id = ? ORDER BY accuracy DESC LIMIT 10'
      ).all(swarmId) || [];
      
      // Retrieve recent memory
      const recentMemory = this.db?.prepare(
        'SELECT * FROM swarm_memory WHERE swarm_id = ? ORDER BY updated_at DESC LIMIT 20'
      ).all(swarmId) || [];
      
      return {
        swarmId,
        neural: {
          status: neuralStatus,
          patterns: patterns.map((p: any) => ({
            ...JSON.parse(p.pattern_data as string),
            accuracy: p.accuracy,
            uses: p.uses
          })),
          accuracy: swarm.neural.accuracy,
          training: swarm.neural.training
        },
        memory: {
          status: memoryStatus,
          recent: recentMemory.map(m => ({
            key: m.key,
            value: JSON.parse(m.value as string),
            updated: new Date(m.updated_at * 1000).toISOString()
          })),
          size: swarm.memory.size
        },
        agents: swarm.agents.map(a => ({
          ...a,
          intelligence: {
            tasksCompleted: a.metadata?.tasksCompleted || 0,
            successRate: a.metadata?.successRate || 0,
            specializations: a.capabilities
          }
        }))
      };
    } catch (error) {
      console.error('Failed to get swarm intelligence:', error);
      throw error;
    }
  }

  async trainNeuralPatterns(swarmId: string, iterations: number = 10): Promise<void> {
    const swarm = this.swarms.get(swarmId);
    if (!swarm) {
      throw new Error('Swarm not found');
    }
    
    swarm.neural.training = true;
    
    try {
      // Train neural patterns
      const { stdout } = await execAsync(
        `npx claude-flow@alpha neural train --iterations ${iterations}`
      );
      
      console.log('Neural training result:', stdout);
      
      // Update accuracy based on training
      swarm.neural.accuracy = Math.min(0.95, swarm.neural.accuracy + 0.05);
      swarm.neural.training = false;
      
      // Store training results
      await this.storeMemory(swarmId, 'neural/training/last', {
        iterations,
        accuracy: swarm.neural.accuracy,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      swarm.neural.training = false;
      console.error('Failed to train neural patterns:', error);
      throw error;
    }
  }

  async storeMemory(swarmId: string, key: string, value: any): Promise<void> {
    const swarm = this.swarms.get(swarmId);
    if (!swarm) {
      throw new Error('Swarm not found');
    }
    
    // Store in local memory
    swarm.memory.set(key, value);
    
    // Store in database
    if (this.db) {
      const stmt = this.db.prepare(`
        INSERT INTO swarm_memory (swarm_id, key, value, updated_at)
        VALUES (?, ?, ?, strftime('%s', 'now'))
        ON CONFLICT(swarm_id, key) DO UPDATE SET
          value = excluded.value,
          updated_at = excluded.updated_at
      `);
      
      stmt.run(swarmId, key, JSON.stringify(value));
    }
    
    // Also store in Claude Flow memory
    await execAsync(
      `npx claude-flow@alpha memory usage --action store --key "swarm/${swarmId}/${key}" --value '${JSON.stringify(value)}'`
    );
  }

  async retrieveMemory(swarmId: string, key: string): Promise<any> {
    const swarm = this.swarms.get(swarmId);
    if (!swarm) {
      throw new Error('Swarm not found');
    }
    
    // Check local memory first
    if (swarm.memory.has(key)) {
      return swarm.memory.get(key);
    }
    
    // Check database
    if (this.db) {
      const result = this.db.prepare(
        'SELECT value FROM swarm_memory WHERE swarm_id = ? AND key = ?'
      ).get(swarmId, key);
      
      if (result) {
        const value = JSON.parse(result.value as string);
        swarm.memory.set(key, value); // Cache locally
        return value;
      }
    }
    
    return null;
  }

  getSwarm(swarmId: string): HiveSwarm | undefined {
    return this.swarms.get(swarmId);
  }

  getAllSwarms(): HiveSwarm[] {
    return Array.from(this.swarms.values());
  }

  private getAgentCapabilities(agentType: string): string[] {
    const capabilities: Record<string, string[]> = {
      researcher: ['search', 'analyze', 'summarize', 'discover'],
      coder: ['implement', 'refactor', 'debug', 'optimize'],
      analyst: ['evaluate', 'report', 'visualize', 'predict'],
      tester: ['test', 'validate', 'benchmark', 'verify'],
      coordinator: ['plan', 'orchestrate', 'monitor', 'delegate'],
      architect: ['design', 'structure', 'model', 'blueprint'],
      optimizer: ['optimize', 'enhance', 'streamline', 'accelerate'],
      reviewer: ['review', 'audit', 'critique', 'approve']
    };
    
    return capabilities[agentType] || ['general'];
  }

  private async initializeSwarmMemory(swarmId: string): Promise<void> {
    await this.storeMemory(swarmId, 'config/initialized', {
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });
  }

  private async initializeNeuralPatterns(swarmId: string): Promise<void> {
    // Initialize basic neural patterns
    const patterns = [
      { id: 'task-delegation', data: { type: 'coordination', rules: [] } },
      { id: 'error-recovery', data: { type: 'resilience', strategies: [] } },
      { id: 'optimization', data: { type: 'performance', metrics: [] } }
    ];
    
    for (const pattern of patterns) {
      if (this.db) {
        this.db.prepare(`
          INSERT INTO neural_patterns (swarm_id, pattern_id, pattern_data)
          VALUES (?, ?, ?)
        `).run(swarmId, pattern.id, JSON.stringify(pattern.data));
      }
    }
  }
}