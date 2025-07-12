import { EventEmitter } from 'events';
import { Logger } from 'winston';
import { createLogger } from '../../utils/logger';

export interface TaskNode {
  id: string;
  type: 'compute' | 'io' | 'decision' | 'aggregate';
  dependencies: string[];
  payload: any;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  error?: Error;
  startTime?: Date;
  endTime?: Date;
  retries?: number;
  maxRetries?: number;
}

export interface DAGExecution {
  id: string;
  nodes: Map<string, TaskNode>;
  startTime: Date;
  endTime?: Date;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export class DAGService extends EventEmitter {
  private logger: Logger;
  private executions: Map<string, DAGExecution> = new Map();

  constructor() {
    super();
    this.logger = createLogger('dag-service');
  }

  /**
   * Create a new DAG execution
   */
  createExecution(nodes: TaskNode[]): string {
    const executionId = `dag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Validate DAG structure
    this.validateDAG(nodes);
    
    // Create execution
    const execution: DAGExecution = {
      id: executionId,
      nodes: new Map(nodes.map(node => [node.id, { ...node, status: 'pending' }])),
      startTime: new Date(),
      status: 'pending'
    };
    
    this.executions.set(executionId, execution);
    this.logger.info(`Created DAG execution: ${executionId}`, { nodeCount: nodes.length });
    
    return executionId;
  }

  /**
   * Validate DAG structure (check for cycles, missing dependencies)
   */
  private validateDAG(nodes: TaskNode[]): void {
    const nodeMap = new Map(nodes.map(node => [node.id, node]));
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      const node = nodeMap.get(nodeId);
      if (!node) {
        throw new Error(`Node ${nodeId} not found in DAG`);
      }

      for (const depId of node.dependencies) {
        if (!nodeMap.has(depId)) {
          throw new Error(`Dependency ${depId} not found for node ${nodeId}`);
        }

        if (!visited.has(depId)) {
          if (hasCycle(depId)) {
            return true;
          }
        } else if (recursionStack.has(depId)) {
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    // Check all nodes for cycles
    for (const node of nodes) {
      if (!visited.has(node.id)) {
        if (hasCycle(node.id)) {
          throw new Error('DAG contains cycles');
        }
      }
    }
  }

  /**
   * Get topologically sorted nodes for execution
   */
  getTopologicalOrder(executionId: string): string[] {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    const nodes = Array.from(execution.nodes.values());
    const inDegree = new Map<string, number>();
    const adjList = new Map<string, string[]>();

    // Initialize structures
    for (const node of nodes) {
      inDegree.set(node.id, node.dependencies.length);
      adjList.set(node.id, []);
    }

    // Build adjacency list
    for (const node of nodes) {
      for (const dep of node.dependencies) {
        const depList = adjList.get(dep) || [];
        depList.push(node.id);
        adjList.set(dep, depList);
      }
    }

    // Find nodes with no dependencies
    const queue: string[] = [];
    for (const [nodeId, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }

    const result: string[] = [];
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      result.push(nodeId);

      // Reduce in-degree of dependent nodes
      const dependents = adjList.get(nodeId) || [];
      for (const depId of dependents) {
        const degree = inDegree.get(depId)! - 1;
        inDegree.set(depId, degree);
        if (degree === 0) {
          queue.push(depId);
        }
      }
    }

    return result;
  }

  /**
   * Get nodes ready for execution (all dependencies completed)
   */
  getReadyNodes(executionId: string): TaskNode[] {
    const execution = this.executions.get(executionId);
    if (!execution) {
      return [];
    }

    const readyNodes: TaskNode[] = [];
    for (const node of execution.nodes.values()) {
      if (node.status === 'pending') {
        const depsCompleted = node.dependencies.every(depId => {
          const depNode = execution.nodes.get(depId);
          return depNode && depNode.status === 'completed';
        });
        
        if (depsCompleted) {
          readyNodes.push(node);
        }
      }
    }

    return readyNodes;
  }

  /**
   * Update node status
   */
  updateNodeStatus(
    executionId: string,
    nodeId: string,
    status: TaskNode['status'],
    result?: any,
    error?: Error
  ): void {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    const node = execution.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found in execution ${executionId}`);
    }

    // Update node
    node.status = status;
    if (result !== undefined) node.result = result;
    if (error) node.error = error;
    
    if (status === 'running' && !node.startTime) {
      node.startTime = new Date();
    } else if ((status === 'completed' || status === 'failed') && !node.endTime) {
      node.endTime = new Date();
    }

    // Emit status change event
    this.emit('nodeStatusChanged', {
      executionId,
      nodeId,
      status,
      node
    });

    // Check if execution is complete
    this.checkExecutionComplete(executionId);
  }

  /**
   * Check if execution is complete
   */
  private checkExecutionComplete(executionId: string): void {
    const execution = this.executions.get(executionId);
    if (!execution || execution.status !== 'running') {
      return;
    }

    const nodes = Array.from(execution.nodes.values());
    const allComplete = nodes.every(node => 
      node.status === 'completed' || node.status === 'failed'
    );

    if (allComplete) {
      const hasFailed = nodes.some(node => node.status === 'failed');
      execution.status = hasFailed ? 'failed' : 'completed';
      execution.endTime = new Date();
      
      this.emit('executionComplete', {
        executionId,
        status: execution.status,
        execution
      });
      
      this.logger.info(`DAG execution completed: ${executionId}`, {
        status: execution.status,
        duration: execution.endTime.getTime() - execution.startTime.getTime()
      });
    }
  }

  /**
   * Get execution status
   */
  getExecution(executionId: string): DAGExecution | undefined {
    return this.executions.get(executionId);
  }

  /**
   * Get execution progress
   */
  getExecutionProgress(executionId: string): {
    total: number;
    completed: number;
    failed: number;
    running: number;
    pending: number;
    progress: number;
  } {
    const execution = this.executions.get(executionId);
    if (!execution) {
      return {
        total: 0,
        completed: 0,
        failed: 0,
        running: 0,
        pending: 0,
        progress: 0
      };
    }

    const nodes = Array.from(execution.nodes.values());
    const stats = {
      total: nodes.length,
      completed: nodes.filter(n => n.status === 'completed').length,
      failed: nodes.filter(n => n.status === 'failed').length,
      running: nodes.filter(n => n.status === 'running').length,
      pending: nodes.filter(n => n.status === 'pending').length,
      progress: 0
    };

    stats.progress = stats.total > 0 
      ? ((stats.completed + stats.failed) / stats.total) * 100 
      : 0;

    return stats;
  }

  /**
   * Visualize DAG structure
   */
  visualizeDAG(executionId: string): {
    nodes: Array<{ id: string; label: string; type: string; status: string }>;
    edges: Array<{ from: string; to: string }>;
  } {
    const execution = this.executions.get(executionId);
    if (!execution) {
      return { nodes: [], edges: [] };
    }

    const nodes = Array.from(execution.nodes.values()).map(node => ({
      id: node.id,
      label: `${node.id} (${node.type})`,
      type: node.type,
      status: node.status
    }));

    const edges: Array<{ from: string; to: string }> = [];
    for (const node of execution.nodes.values()) {
      for (const dep of node.dependencies) {
        edges.push({ from: dep, to: node.id });
      }
    }

    return { nodes, edges };
  }

  /**
   * Clean up old executions
   */
  cleanupExecutions(olderThan: Date): number {
    let cleaned = 0;
    for (const [id, execution] of this.executions.entries()) {
      if (execution.endTime && execution.endTime < olderThan) {
        this.executions.delete(id);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      this.logger.info(`Cleaned up ${cleaned} old executions`);
    }
    
    return cleaned;
  }
}