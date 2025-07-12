import { exec } from 'child_process';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';
import { HiveService } from './hive.service';

const execAsync = promisify(exec);

interface AgentTask {
  id: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  assignedTo?: string;
  result?: any;
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

interface AgentMetrics {
  tasksCompleted: number;
  tasksFailed: number;
  successRate: number;
  avgResponseTime: number;
  lastActive: string;
  cognitivePattern?: string;
}

export class AgentService {
  private static instance: AgentService;
  private hiveService: HiveService;
  private activeTasks: Map<string, AgentTask> = new Map();
  private agentMetrics: Map<string, AgentMetrics> = new Map();

  private constructor() {
    this.hiveService = HiveService.getInstance();
  }

  static getInstance(): AgentService {
    if (!AgentService.instance) {
      AgentService.instance = new AgentService();
    }
    return AgentService.instance;
  }

  async assignTask(swarmId: string, agentId: string, task: Omit<AgentTask, 'id' | 'createdAt'>): Promise<AgentTask> {
    const swarm = this.hiveService.getSwarm(swarmId);
    if (!swarm) {
      throw new Error('Swarm not found');
    }

    const agent = swarm.agents.find(a => a.id === agentId);
    if (!agent) {
      throw new Error('Agent not found');
    }

    try {
      // Create task
      const fullTask: AgentTask = {
        ...task,
        id: uuidv4(),
        assignedTo: agentId,
        createdAt: new Date().toISOString()
      };

      // Store task
      this.activeTasks.set(fullTask.id, fullTask);

      // Update agent status
      agent.status = 'busy';
      swarm.lastUpdated = new Date().toISOString();

      // Orchestrate task with Claude Flow
      const { stdout } = await execAsync(
        `npx claude-flow@alpha task orchestrate --task "${task.description}" --priority ${task.priority} --strategy adaptive`
      );

      console.log('Task orchestrated:', stdout);

      // Store in memory
      await this.hiveService.storeMemory(swarmId, `tasks/${fullTask.id}`, fullTask);

      // Update agent metadata
      if (!agent.metadata) agent.metadata = {};
      agent.metadata.currentTask = fullTask.id;
      agent.metadata.lastTaskAssigned = new Date().toISOString();

      return fullTask;
    } catch (error) {
      console.error('Failed to assign task:', error);
      throw error;
    }
  }

  async updateAgentStatus(swarmId: string, agentId: string, status: 'idle' | 'busy' | 'error' | 'offline'): Promise<void> {
    const swarm = this.hiveService.getSwarm(swarmId);
    if (!swarm) {
      throw new Error('Swarm not found');
    }

    const agent = swarm.agents.find(a => a.id === agentId);
    if (!agent) {
      throw new Error('Agent not found');
    }

    agent.status = status;
    swarm.lastUpdated = new Date().toISOString();

    // Update metrics
    const metrics = this.getOrCreateMetrics(agentId);
    metrics.lastActive = new Date().toISOString();

    // Store status change
    await this.hiveService.storeMemory(swarmId, `agents/${agentId}/status`, {
      status,
      timestamp: new Date().toISOString()
    });

    // Notify via Claude Flow
    await execAsync(
      `npx claude-flow@alpha hooks notification --message "Agent ${agentId} status changed to ${status}"`
    );
  }

  async completeTask(swarmId: string, taskId: string, result?: any): Promise<void> {
    const task = this.activeTasks.get(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    const swarm = this.hiveService.getSwarm(swarmId);
    if (!swarm) {
      throw new Error('Swarm not found');
    }

    try {
      // Update task
      task.status = 'completed';
      task.completedAt = new Date().toISOString();
      task.result = result;

      // Get task results from Claude Flow
      const { stdout } = await execAsync(
        `npx claude-flow@alpha task results --task-id ${taskId} --format detailed`
      );

      console.log('Task results:', stdout);

      // Update agent metrics
      if (task.assignedTo) {
        const metrics = this.getOrCreateMetrics(task.assignedTo);
        metrics.tasksCompleted++;
        metrics.successRate = metrics.tasksCompleted / (metrics.tasksCompleted + metrics.tasksFailed);
        
        if (task.startedAt) {
          const duration = Date.now() - new Date(task.startedAt).getTime();
          metrics.avgResponseTime = (metrics.avgResponseTime * (metrics.tasksCompleted - 1) + duration) / metrics.tasksCompleted;
        }

        // Update agent status
        const agent = swarm.agents.find(a => a.id === task.assignedTo);
        if (agent) {
          agent.status = 'idle';
          delete agent.metadata?.currentTask;
        }
      }

      // Store completed task
      await this.hiveService.storeMemory(swarmId, `tasks/${taskId}/completed`, task);

      // Remove from active tasks
      this.activeTasks.delete(taskId);
    } catch (error) {
      console.error('Failed to complete task:', error);
      throw error;
    }
  }

  async failTask(swarmId: string, taskId: string, error: string): Promise<void> {
    const task = this.activeTasks.get(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    task.status = 'failed';
    task.error = error;
    task.completedAt = new Date().toISOString();

    // Update metrics
    if (task.assignedTo) {
      const metrics = this.getOrCreateMetrics(task.assignedTo);
      metrics.tasksFailed++;
      metrics.successRate = metrics.tasksCompleted / (metrics.tasksCompleted + metrics.tasksFailed);
    }

    // Store failed task
    await this.hiveService.storeMemory(swarmId, `tasks/${taskId}/failed`, task);

    // Remove from active tasks
    this.activeTasks.delete(taskId);
  }

  async getAgentMetrics(agentId: string): Promise<AgentMetrics> {
    const metrics = this.getOrCreateMetrics(agentId);

    try {
      // Get additional metrics from Claude Flow
      const { stdout } = await execAsync(
        `npx claude-flow@alpha agent metrics --agent-id ${agentId} --metric all`
      );

      console.log('Agent metrics:', stdout);

      // Get cognitive pattern
      const { stdout: pattern } = await execAsync(
        `npx claude-flow@alpha neural patterns --pattern all`
      );

      metrics.cognitivePattern = this.extractCognitivePattern(pattern);
    } catch (error) {
      console.error('Failed to get full metrics:', error);
    }

    return metrics;
  }

  async adaptAgent(swarmId: string, agentId: string, feedback: string, performanceScore: number): Promise<void> {
    try {
      // Use Claude Flow DAA adaptation
      const { stdout } = await execAsync(
        `npx claude-flow@alpha daa agent adapt --agent-id ${agentId} --feedback "${feedback}" --performance-score ${performanceScore}`
      );

      console.log('Agent adaptation result:', stdout);

      // Store adaptation history
      await this.hiveService.storeMemory(swarmId, `agents/${agentId}/adaptations/${Date.now()}`, {
        feedback,
        performanceScore,
        timestamp: new Date().toISOString()
      });

      // Update metrics
      const metrics = this.getOrCreateMetrics(agentId);
      metrics.lastActive = new Date().toISOString();
    } catch (error) {
      console.error('Failed to adapt agent:', error);
      throw error;
    }
  }

  async shareKnowledge(swarmId: string, sourceAgentId: string, targetAgentIds: string[], knowledge: any): Promise<void> {
    try {
      // Use Claude Flow knowledge sharing
      const { stdout } = await execAsync(
        `npx claude-flow@alpha daa knowledge share --source-agent ${sourceAgentId} --target-agents ${targetAgentIds.join(',')} --knowledge-domain "${knowledge.domain}" --knowledge-content '${JSON.stringify(knowledge.content)}'`
      );

      console.log('Knowledge sharing result:', stdout);

      // Store knowledge transfer
      await this.hiveService.storeMemory(swarmId, `knowledge/${Date.now()}`, {
        source: sourceAgentId,
        targets: targetAgentIds,
        knowledge,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to share knowledge:', error);
      throw error;
    }
  }

  async analyzePerformance(swarmId: string): Promise<any> {
    try {
      // Get performance metrics from Claude Flow
      const { stdout: performance } = await execAsync(
        `npx claude-flow@alpha performance report --format detailed --timeframe 24h`
      );

      // Get bottleneck analysis
      const { stdout: bottlenecks } = await execAsync(
        `npx claude-flow@alpha bottleneck analyze --component swarm`
      );

      // Get token usage
      const { stdout: tokens } = await execAsync(
        `npx claude-flow@alpha token usage --operation all --timeframe 24h`
      );

      const swarm = this.hiveService.getSwarm(swarmId);
      if (!swarm) {
        throw new Error('Swarm not found');
      }

      // Calculate swarm-level metrics
      const agentMetrics = swarm.agents.map(agent => ({
        id: agent.id,
        metrics: this.agentMetrics.get(agent.id) || this.getOrCreateMetrics(agent.id)
      }));

      return {
        performance: JSON.parse(performance),
        bottlenecks: JSON.parse(bottlenecks),
        tokenUsage: JSON.parse(tokens),
        agents: agentMetrics,
        tasks: {
          active: this.activeTasks.size,
          completed: Array.from(this.agentMetrics.values()).reduce((sum, m) => sum + m.tasksCompleted, 0),
          failed: Array.from(this.agentMetrics.values()).reduce((sum, m) => sum + m.tasksFailed, 0)
        }
      };
    } catch (error) {
      console.error('Failed to analyze performance:', error);
      // Return basic metrics if Claude Flow fails
      return {
        agents: Array.from(this.agentMetrics.entries()).map(([id, metrics]) => ({ id, metrics })),
        tasks: {
          active: this.activeTasks.size,
          completed: 0,
          failed: 0
        }
      };
    }
  }

  getActiveTasks(): AgentTask[] {
    return Array.from(this.activeTasks.values());
  }

  getTasksForAgent(agentId: string): AgentTask[] {
    return Array.from(this.activeTasks.values()).filter(task => task.assignedTo === agentId);
  }

  private getOrCreateMetrics(agentId: string): AgentMetrics {
    if (!this.agentMetrics.has(agentId)) {
      this.agentMetrics.set(agentId, {
        tasksCompleted: 0,
        tasksFailed: 0,
        successRate: 0,
        avgResponseTime: 0,
        lastActive: new Date().toISOString()
      });
    }
    return this.agentMetrics.get(agentId)!;
  }

  private extractCognitivePattern(output: string): string {
    // Extract cognitive pattern from Claude Flow output
    const patterns = ['convergent', 'divergent', 'lateral', 'systems', 'critical', 'adaptive'];
    for (const pattern of patterns) {
      if (output.toLowerCase().includes(pattern)) {
        return pattern;
      }
    }
    return 'adaptive';
  }
}