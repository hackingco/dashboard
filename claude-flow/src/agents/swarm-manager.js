import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { trace } from '../instrumentation/index.js';

class SwarmManager extends EventEmitter {
  constructor() {
    super();
    this.agents = new Map();
    this.tasks = new Map();
    this.topology = 'mesh';
    this.maxAgents = 10;
  }

  async initialize(config = {}) {
    this.topology = config.topology || 'mesh';
    this.maxAgents = config.maxAgents || 10;
    this.emit('initialized', { topology: this.topology, maxAgents: this.maxAgents });
  }

  async spawnAgent(type, name) {
    const agentId = uuidv4();
    const agent = {
      id: agentId,
      type,
      name: name || `${type}-${agentId.substr(0, 8)}`,
      status: 'active',
      createdAt: new Date().toISOString(),
      tasks: [],
      metrics: {
        tasksCompleted: 0,
        tasksFailed: 0,
        avgResponseTime: 0
      }
    };

    this.agents.set(agentId, agent);
    this.emit('agent-spawned', agent);
    return agent;
  }

  async terminateAgent(agentId) {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.status = 'terminated';
      this.agents.delete(agentId);
      this.emit('agent-terminated', agent);
    }
  }

  async assignTask(taskDescription, agentId = null) {
    const taskId = uuidv4();
    const task = {
      id: taskId,
      description: taskDescription,
      status: 'pending',
      assignedTo: agentId,
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      result: null
    };

    // Auto-assign if no agent specified
    if (!agentId) {
      const availableAgent = this.findAvailableAgent();
      if (availableAgent) {
        task.assignedTo = availableAgent.id;
        availableAgent.tasks.push(taskId);
      }
    } else {
      const agent = this.agents.get(agentId);
      if (agent) {
        agent.tasks.push(taskId);
      }
    }

    this.tasks.set(taskId, task);
    this.emit('task-assigned', task);
    
    // Simulate task execution
    this.executeTask(taskId);
    
    return task;
  }

  findAvailableAgent() {
    let bestAgent = null;
    let minTasks = Infinity;

    for (const agent of this.agents.values()) {
      if (agent.status === 'active' && agent.tasks.length < minTasks) {
        bestAgent = agent;
        minTasks = agent.tasks.length;
      }
    }

    return bestAgent;
  }

  async executeTask(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.status = 'in-progress';
    task.startedAt = new Date().toISOString();
    this.emit('task-started', task);

    // Simulate task execution time
    setTimeout(() => {
      const success = Math.random() > 0.1; // 90% success rate
      
      if (success) {
        task.status = 'completed';
        task.completedAt = new Date().toISOString();
        task.result = { success: true, data: 'Task completed successfully' };
        
        // Update agent metrics
        const agent = this.agents.get(task.assignedTo);
        if (agent) {
          agent.metrics.tasksCompleted++;
          const duration = new Date(task.completedAt) - new Date(task.startedAt);
          agent.metrics.avgResponseTime = 
            (agent.metrics.avgResponseTime * (agent.metrics.tasksCompleted - 1) + duration) / 
            agent.metrics.tasksCompleted;
        }
        
        this.emit('task-completed', task);
      } else {
        task.status = 'failed';
        task.completedAt = new Date().toISOString();
        task.result = { success: false, error: 'Task execution failed' };
        
        // Update agent metrics
        const agent = this.agents.get(task.assignedTo);
        if (agent) {
          agent.metrics.tasksFailed++;
        }
        
        this.emit('task-failed', task);
      }
    }, Math.random() * 5000 + 1000); // 1-6 seconds
  }

  getActiveAgentCount() {
    return Array.from(this.agents.values()).filter(a => a.status === 'active').length;
  }

  getAgentStatus() {
    const agents = Array.from(this.agents.values());
    return {
      total: agents.length,
      active: agents.filter(a => a.status === 'active').length,
      terminated: agents.filter(a => a.status === 'terminated').length,
      agents: agents.map(a => ({
        id: a.id,
        name: a.name,
        type: a.type,
        status: a.status,
        taskCount: a.tasks.length,
        metrics: a.metrics
      }))
    };
  }

  getTaskStatus() {
    const tasks = Array.from(this.tasks.values());
    return {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      inProgress: tasks.filter(t => t.status === 'in-progress').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      failed: tasks.filter(t => t.status === 'failed').length,
      tasks: tasks.slice(-10) // Last 10 tasks
    };
  }
}

// Export singleton instance
export const swarmManager = new SwarmManager();

// Instrumented swarm operations
export const initializeSwarm = trace(async (config) => {
  await swarmManager.initialize(config);
  return { success: true, config };
});

export const spawnAgentInstrumented = trace(async (type, name) => {
  return await swarmManager.spawnAgent(type, name);
});

export const orchestrateTask = trace(async (task, options = {}) => {
  const { strategy = 'balanced' } = options;
  return await swarmManager.assignTask(task);
});