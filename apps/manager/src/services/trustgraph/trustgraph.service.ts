import { EventEmitter } from 'events';
import logger from '../logger';
import { v4 as uuidv4 } from 'uuid';
const fetch = require('node-fetch');

export interface TrustGraphNode {
  id: string;
  type: 'swarm' | 'worker' | 'task' | 'api' | 'dependency' | 'ws_broadcast' | 'machine';
  label: string;
  metadata?: Record<string, any>;
  timestamp?: Date;
}

export interface TrustGraphEdge {
  id?: string;
  source: string;
  target: string;
  label: string;
  type?: 'depends_on' | 'executes' | 'triggers' | 'creates' | 'calls';
  metadata?: Record<string, any>;
  timestamp?: Date;
}

export interface TaskDependency {
  taskId: string;
  dependsOn: string[];
  status: 'pending' | 'ready' | 'executing' | 'completed' | 'failed';
  executionOrder?: number;
}

export interface DAGAnalysis {
  nodes: number;
  edges: number;
  hasCycles: boolean;
  criticalPath: string[];
  parallelizableGroups: string[][];
  executionOrder: string[];
}

export interface WSBroadcastNode extends TrustGraphNode {
  ws_event_type: string;
  ws_channel: string;
  ws_payload: Record<string, any>;
  correlation_id?: string;
  subscribers_reached?: number;
}

export class TrustGraphService extends EventEmitter {
  private apiKey: string;
  private apiUrl: string;
  private nodes: Map<string, TrustGraphNode> = new Map();
  private edges: Map<string, TrustGraphEdge> = new Map();
  private taskDependencies: Map<string, TaskDependency> = new Map();
  private wsBroadcastNodes: Map<string, WSBroadcastNode> = new Map();
  private nodeQueue: TrustGraphNode[] = [];
  private edgeQueue: TrustGraphEdge[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private batchSize = 50;
  private flushIntervalMs = 5000;

  constructor(apiKey?: string, apiUrl?: string) {
    super();
    this.apiKey = apiKey || process.env.TRUSTGRAPH_API_KEY || '';
    this.apiUrl = apiUrl || process.env.TRUSTGRAPH_API_URL || 'https://api.trustgraph.ai';

    if (!this.apiKey) {
      logger.info('TrustGraph service running in offline mode - no API key provided');
    } else {
      this.startFlushInterval();
    }
  }

  // Node management
  async createNode(node: Omit<TrustGraphNode, 'timestamp'>): Promise<TrustGraphNode> {
    const fullNode: TrustGraphNode = {
      ...node,
      timestamp: new Date()
    };

    this.nodes.set(node.id, fullNode);
    this.nodeQueue.push(fullNode);
    
    this.emit('node:created', fullNode);
    logger.debug('Created TrustGraph node', { id: node.id, type: node.type });
    
    return fullNode;
  }

  async createEdge(edge: Omit<TrustGraphEdge, 'id' | 'timestamp'>): Promise<TrustGraphEdge> {
    const fullEdge: TrustGraphEdge = {
      ...edge,
      id: uuidv4(),
      timestamp: new Date()
    };

    this.edges.set(fullEdge.id!, fullEdge);
    this.edgeQueue.push(fullEdge);
    
    this.emit('edge:created', fullEdge);
    logger.debug('Created TrustGraph edge', { 
      id: fullEdge.id, 
      source: edge.source, 
      target: edge.target 
    });
    
    return fullEdge;
  }

  // Task dependency tracking
  async trackTaskDependency(taskId: string, dependsOn: string[]): Promise<void> {
    const dependency: TaskDependency = {
      taskId,
      dependsOn,
      status: 'pending'
    };

    this.taskDependencies.set(taskId, dependency);

    // Create node for task
    await this.createNode({
      id: taskId,
      type: 'task',
      label: `Task ${taskId}`,
      metadata: { dependsOn }
    });

    // Create edges for dependencies
    for (const depId of dependsOn) {
      await this.createEdge({
        source: depId,
        target: taskId,
        label: 'depends_on',
        type: 'depends_on'
      });
    }

    this.emit('dependency:tracked', dependency);
  }

  async updateTaskStatus(
    taskId: string, 
    status: TaskDependency['status']
  ): Promise<void> {
    const dependency = this.taskDependencies.get(taskId);
    if (dependency) {
      dependency.status = status;
      this.emit('dependency:updated', dependency);
      
      // Check if any dependent tasks are now ready
      if (status === 'completed') {
        this.checkReadyTasks();
      }
    }
  }

  private checkReadyTasks(): void {
    for (const [taskId, dep] of this.taskDependencies) {
      if (dep.status === 'pending') {
        const allDepsCompleted = dep.dependsOn.every(depId => {
          const depTask = this.taskDependencies.get(depId);
          return depTask?.status === 'completed';
        });

        if (allDepsCompleted) {
          dep.status = 'ready';
          this.emit('task:ready', taskId);
        }
      }
    }
  }

  // DAG analysis
  analyzeDAG(): DAGAnalysis {
    const nodes = Array.from(this.nodes.keys());
    const adjacencyList = new Map<string, Set<string>>();
    
    // Build adjacency list
    for (const edge of this.edges.values()) {
      if (!adjacencyList.has(edge.source)) {
        adjacencyList.set(edge.source, new Set());
      }
      adjacencyList.get(edge.source)!.add(edge.target);
    }

    // Detect cycles using DFS
    const hasCycles = this.detectCycles(adjacencyList);
    
    // Find critical path
    const criticalPath = this.findCriticalPath(adjacencyList);
    
    // Identify parallelizable groups
    const parallelizableGroups = this.findParallelizableGroups(adjacencyList);
    
    // Topological sort for execution order
    const executionOrder = this.topologicalSort(adjacencyList);

    return {
      nodes: this.nodes.size,
      edges: this.edges.size,
      hasCycles,
      criticalPath,
      parallelizableGroups,
      executionOrder
    };
  }

  private detectCycles(adjacencyList: Map<string, Set<string>>): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (node: string): boolean => {
      visited.add(node);
      recursionStack.add(node);

      const neighbors = adjacencyList.get(node) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (hasCycle(neighbor)) return true;
        } else if (recursionStack.has(neighbor)) {
          return true;
        }
      }

      recursionStack.delete(node);
      return false;
    };

    for (const node of adjacencyList.keys()) {
      if (!visited.has(node)) {
        if (hasCycle(node)) return true;
      }
    }

    return false;
  }

  private findCriticalPath(adjacencyList: Map<string, Set<string>>): string[] {
    // Simplified critical path - longest path in DAG
    const distances = new Map<string, number>();
    const parents = new Map<string, string | null>();
    
    // Initialize distances
    for (const node of this.nodes.keys()) {
      distances.set(node, 0);
      parents.set(node, null);
    }

    // Find nodes with no incoming edges (start nodes)
    const startNodes = Array.from(this.nodes.keys()).filter(node => {
      return !Array.from(this.edges.values()).some(edge => edge.target === node);
    });

    // BFS to find longest paths
    const queue = [...startNodes];
    while (queue.length > 0) {
      const current = queue.shift()!;
      const neighbors = adjacencyList.get(current) || new Set();
      
      for (const neighbor of neighbors) {
        const newDistance = distances.get(current)! + 1;
        if (newDistance > distances.get(neighbor)!) {
          distances.set(neighbor, newDistance);
          parents.set(neighbor, current);
        }
        
        if (!queue.includes(neighbor)) {
          queue.push(neighbor);
        }
      }
    }

    // Find node with maximum distance
    let maxDistance = 0;
    let endNode = '';
    for (const [node, distance] of distances) {
      if (distance > maxDistance) {
        maxDistance = distance;
        endNode = node;
      }
    }

    // Reconstruct path
    const path: string[] = [];
    let current: string | null = endNode;
    while (current !== null) {
      path.unshift(current);
      current = parents.get(current) || null;
    }

    return path;
  }

  private findParallelizableGroups(adjacencyList: Map<string, Set<string>>): string[][] {
    const levels = new Map<string, number>();
    const groups: string[][] = [];
    
    // Calculate levels using topological sort with levels
    const inDegree = new Map<string, number>();
    for (const node of this.nodes.keys()) {
      inDegree.set(node, 0);
    }
    
    for (const neighbors of adjacencyList.values()) {
      for (const neighbor of neighbors) {
        inDegree.set(neighbor, (inDegree.get(neighbor) || 0) + 1);
      }
    }

    const queue: string[] = [];
    for (const [node, degree] of inDegree) {
      if (degree === 0) {
        queue.push(node);
        levels.set(node, 0);
      }
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentLevel = levels.get(current)!;
      
      if (!groups[currentLevel]) {
        groups[currentLevel] = [];
      }
      groups[currentLevel].push(current);

      const neighbors = adjacencyList.get(current) || new Set();
      for (const neighbor of neighbors) {
        inDegree.set(neighbor, inDegree.get(neighbor)! - 1);
        if (inDegree.get(neighbor) === 0) {
          queue.push(neighbor);
          levels.set(neighbor, currentLevel + 1);
        }
      }
    }

    return groups.filter(group => group && group.length > 0);
  }

  private topologicalSort(adjacencyList: Map<string, Set<string>>): string[] {
    const visited = new Set<string>();
    const stack: string[] = [];

    const visit = (node: string): void => {
      visited.add(node);
      const neighbors = adjacencyList.get(node) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visit(neighbor);
        }
      }
      stack.push(node);
    };

    for (const node of this.nodes.keys()) {
      if (!visited.has(node)) {
        visit(node);
      }
    }

    return stack.reverse();
  }

  // Visualization helpers
  getVisualizationData(): {
    nodes: Array<TrustGraphNode & { x?: number; y?: number }>;
    edges: TrustGraphEdge[];
  } {
    const nodes = Array.from(this.nodes.values());
    const edges = Array.from(this.edges.values());
    
    // Simple layout calculation (can be enhanced)
    const layout = this.calculateLayout(nodes, edges);
    
    return {
      nodes: nodes.map(node => ({
        ...node,
        ...layout.get(node.id)
      })),
      edges
    };
  }

  private calculateLayout(
    nodes: TrustGraphNode[], 
    edges: TrustGraphEdge[]
  ): Map<string, { x: number; y: number }> {
    const layout = new Map<string, { x: number; y: number }>();
    const levels = this.findParallelizableGroups(this.buildAdjacencyList());
    
    levels.forEach((level, levelIndex) => {
      level.forEach((nodeId, nodeIndex) => {
        layout.set(nodeId, {
          x: nodeIndex * 150 + 50,
          y: levelIndex * 100 + 50
        });
      });
    });
    
    return layout;
  }

  private buildAdjacencyList(): Map<string, Set<string>> {
    const adjacencyList = new Map<string, Set<string>>();
    
    for (const edge of this.edges.values()) {
      if (!adjacencyList.has(edge.source)) {
        adjacencyList.set(edge.source, new Set());
      }
      adjacencyList.get(edge.source)!.add(edge.target);
    }
    
    return adjacencyList;
  }

  // Batch operations
  private async flushNodes(): Promise<void> {
    if (this.nodeQueue.length === 0 || !this.apiKey) return;

    const nodes = this.nodeQueue.splice(0, this.batchSize);
    
    try {
      const response = await fetch(`${this.apiUrl}/v1/nodes/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({ nodes })
      });

      if (!response.ok) {
        throw new Error(`TrustGraph API error: ${response.status}`);
      }

      logger.debug(`Flushed ${nodes.length} nodes to TrustGraph`);
    } catch (error) {
      logger.error('Failed to flush nodes to TrustGraph', { error });
      // Re-queue failed nodes
      this.nodeQueue.unshift(...nodes);
    }
  }

  private async flushEdges(): Promise<void> {
    if (this.edgeQueue.length === 0 || !this.apiKey) return;

    const edges = this.edgeQueue.splice(0, this.batchSize);
    
    try {
      const response = await fetch(`${this.apiUrl}/v1/edges/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({ edges })
      });

      if (!response.ok) {
        throw new Error(`TrustGraph API error: ${response.status}`);
      }

      logger.debug(`Flushed ${edges.length} edges to TrustGraph`);
    } catch (error) {
      logger.error('Failed to flush edges to TrustGraph', { error });
      // Re-queue failed edges
      this.edgeQueue.unshift(...edges);
    }
  }

  private startFlushInterval(): void {
    this.flushInterval = setInterval(async () => {
      await Promise.all([
        this.flushNodes(),
        this.flushEdges()
      ]);
    }, this.flushIntervalMs);
  }

  // Cleanup
  async destroy(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    // Final flush
    await Promise.all([
      this.flushNodes(),
      this.flushEdges()
    ]);
  }

  // WebSocket Broadcast Node Management
  async createWSBroadcastNode(
    wsNode: Omit<WSBroadcastNode, 'timestamp' | 'id'>
  ): Promise<WSBroadcastNode> {
    const fullNode: WSBroadcastNode = {
      ...wsNode,
      id: `ws_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
      timestamp: new Date()
    };

    this.wsBroadcastNodes.set(fullNode.id, fullNode);
    this.nodes.set(fullNode.id, fullNode);
    this.nodeQueue.push(fullNode);
    
    this.emit('ws_node:created', fullNode);
    logger.debug('Created WebSocket broadcast TrustGraph node', { 
      id: fullNode.id, 
      event_type: fullNode.ws_event_type,
      channel: fullNode.ws_channel
    });
    
    return fullNode;
  }

  async emitWSBroadcastNode(
    swarmId: string,
    eventType: string,
    channel: string,
    payload: Record<string, any>,
    correlationId?: string
  ): Promise<WSBroadcastNode> {
    const wsNode = await this.createWSBroadcastNode({
      type: 'ws_broadcast',
      label: `WS Broadcast: ${eventType}`,
      ws_event_type: eventType,
      ws_channel: channel,
      ws_payload: {
        ...payload,
        swarm_id: swarmId,
        timestamp: new Date().toISOString()
      },
      correlation_id: correlationId,
      metadata: {
        swarm_id: swarmId,
        event_type: eventType,
        channel: channel,
        correlation_id: correlationId
      }
    });

    // Create edge from triggering event if correlation ID exists
    if (correlationId) {
      const triggeringNodes = Array.from(this.nodes.values()).filter(
        node => node.metadata?.correlation_id === correlationId
      );
      
      for (const triggerNode of triggeringNodes) {
        if (triggerNode.id !== wsNode.id) {
          await this.createEdge({
            source: triggerNode.id,
            target: wsNode.id,
            label: 'triggers_broadcast',
            type: 'triggers',
            metadata: { correlation_id: correlationId }
          });
        }
      }
    }

    this.emit('ws_broadcast:emitted', wsNode);
    return wsNode;
  }

  getWSBroadcastNodes(
    swarmId?: string,
    eventType?: string,
    channel?: string
  ): WSBroadcastNode[] {
    let nodes = Array.from(this.wsBroadcastNodes.values());
    
    if (swarmId) {
      nodes = nodes.filter(node => node.metadata?.swarm_id === swarmId);
    }
    
    if (eventType) {
      nodes = nodes.filter(node => node.ws_event_type === eventType);
    }
    
    if (channel) {
      nodes = nodes.filter(node => node.ws_channel === channel);
    }
    
    return nodes.sort((a, b) => 
      (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0)
    );
  }

  // Enhanced DAG analysis with WebSocket broadcast tracking
  analyzeSwarmDAG(swarmId: string): DAGAnalysis & {
    wsBroadcastNodes: number;
    broadcastChannels: string[];
    correlationChains: Array<{
      correlation_id: string;
      node_count: number;
      event_types: string[];
    }>;
  } {
    const baseAnalysis = this.analyzeDAG();
    
    // Filter nodes by swarm ID
    const swarmNodes = Array.from(this.nodes.values()).filter(
      node => node.metadata?.swarm_id === swarmId
    );
    
    const swarmWSNodes = this.getWSBroadcastNodes(swarmId);
    
    // Analyze broadcast channels
    const broadcastChannels = [...new Set(
      swarmWSNodes.map(node => node.ws_channel)
    )];
    
    // Analyze correlation chains
    const correlationMap = new Map<string, TrustGraphNode[]>();
    swarmNodes.forEach(node => {
      const corrId = node.metadata?.correlation_id;
      if (corrId) {
        if (!correlationMap.has(corrId)) {
          correlationMap.set(corrId, []);
        }
        correlationMap.get(corrId)!.push(node);
      }
    });
    
    const correlationChains = Array.from(correlationMap.entries()).map(
      ([correlation_id, nodes]) => ({
        correlation_id,
        node_count: nodes.length,
        event_types: [...new Set(nodes.map(n => n.metadata?.event_type || n.type))]
      })
    );

    return {
      ...baseAnalysis,
      wsBroadcastNodes: swarmWSNodes.length,
      broadcastChannels,
      correlationChains
    };
  }

  // Real-time graph visualization data
  getSwarmVisualizationData(swarmId: string): {
    nodes: Array<TrustGraphNode & { x?: number; y?: number; category?: string }>;
    edges: TrustGraphEdge[];
    stats: {
      totalNodes: number;
      wsBroadcastNodes: number;
      apiCallNodes: number;
      taskNodes: number;
      correlationChains: number;
    };
  } {
    const swarmNodes = Array.from(this.nodes.values()).filter(
      node => node.metadata?.swarm_id === swarmId
    );
    
    const swarmEdges = Array.from(this.edges.values()).filter(edge => {
      const sourceNode = this.nodes.get(edge.source);
      const targetNode = this.nodes.get(edge.target);
      return (sourceNode?.metadata?.swarm_id === swarmId) || 
             (targetNode?.metadata?.swarm_id === swarmId);
    });

    // Enhanced layout calculation with categories
    const layout = this.calculateSwarmLayout(swarmNodes, swarmEdges);
    
    // Categorize nodes
    const categorizedNodes = swarmNodes.map(node => ({
      ...node,
      ...layout.get(node.id),
      category: this.categorizeNode(node)
    }));

    // Calculate statistics
    const stats = {
      totalNodes: swarmNodes.length,
      wsBroadcastNodes: swarmNodes.filter(n => n.type === 'ws_broadcast').length,
      apiCallNodes: swarmNodes.filter(n => n.type === 'api').length,
      taskNodes: swarmNodes.filter(n => n.type === 'task').length,
      correlationChains: new Set(
        swarmNodes
          .map(n => n.metadata?.correlation_id)
          .filter(Boolean)
      ).size
    };

    return {
      nodes: categorizedNodes,
      edges: swarmEdges,
      stats
    };
  }

  private categorizeNode(node: TrustGraphNode): string {
    if (node.type === 'ws_broadcast') return 'broadcast';
    if (node.type === 'api') return 'api_call';
    if (node.type === 'task') return 'task';
    if (node.type === 'swarm') return 'swarm';
    if (node.type === 'worker') return 'worker';
    return 'other';
  }

  private calculateSwarmLayout(
    nodes: TrustGraphNode[], 
    edges: TrustGraphEdge[]
  ): Map<string, { x: number; y: number }> {
    const layout = new Map<string, { x: number; y: number }>();
    
    // Group nodes by type and correlation
    const nodeGroups = {
      swarm: nodes.filter(n => n.type === 'swarm'),
      api: nodes.filter(n => n.type === 'api'),
      task: nodes.filter(n => n.type === 'task'),
      ws_broadcast: nodes.filter(n => n.type === 'ws_broadcast'),
      worker: nodes.filter(n => n.type === 'worker'),
      other: nodes.filter(n => !['swarm', 'api', 'task', 'ws_broadcast', 'worker'].includes(n.type))
    };
    
    let yOffset = 0;
    const groupSpacing = 150;
    const nodeSpacing = 120;
    
    // Layout each group
    Object.entries(nodeGroups).forEach(([groupType, groupNodes]) => {
      if (groupNodes.length === 0) return;
      
      groupNodes.forEach((node, index) => {
        layout.set(node.id, {
          x: index * nodeSpacing + 50,
          y: yOffset + 50
        });
      });
      
      yOffset += groupSpacing;
    });
    
    return layout;
  }

  // Export and import with WebSocket broadcast data
  exportGraph(): {
    nodes: TrustGraphNode[];
    edges: TrustGraphEdge[];
    dependencies: TaskDependency[];
    wsBroadcastNodes: WSBroadcastNode[];
  } {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values()),
      dependencies: Array.from(this.taskDependencies.values()),
      wsBroadcastNodes: Array.from(this.wsBroadcastNodes.values())
    };
  }

  importGraph(data: {
    nodes: TrustGraphNode[];
    edges: TrustGraphEdge[];
    dependencies?: TaskDependency[];
    wsBroadcastNodes?: WSBroadcastNode[];
  }): void {
    // Clear existing data
    this.nodes.clear();
    this.edges.clear();
    this.taskDependencies.clear();
    this.wsBroadcastNodes.clear();

    // Import nodes
    for (const node of data.nodes) {
      this.nodes.set(node.id, node);
    }

    // Import edges
    for (const edge of data.edges) {
      this.edges.set(edge.id || uuidv4(), edge);
    }

    // Import dependencies if provided
    if (data.dependencies) {
      for (const dep of data.dependencies) {
        this.taskDependencies.set(dep.taskId, dep);
      }
    }

    // Import WebSocket broadcast nodes if provided
    if (data.wsBroadcastNodes) {
      for (const wsNode of data.wsBroadcastNodes) {
        this.wsBroadcastNodes.set(wsNode.id, wsNode);
      }
    }

    this.emit('graph:imported', data);
  }
}

// Export singleton instance
export const trustGraphService = new TrustGraphService();