import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

const router = Router();

// Enhanced Swarm Schema with detailed metadata
const SwarmSchema = z.object({
  name: z.string().min(1).max(50),
  purpose: z.string().min(1).max(500),
  agents: z.array(z.object({
    id: z.string().optional(),
    name: z.string(),
    role: z.string(),
    tasks: z.array(z.string()),
    status: z.enum(['idle', 'busy', 'error', 'offline']).default('idle'),
    metadata: z.record(z.any()).optional()
  })).min(1),
  configuration: z.object({
    maxWorkers: z.number().min(1).max(100).default(10),
    autoScale: z.boolean().default(true),
    priority: z.enum(['low', 'medium', 'high']).default('medium'),
    timeout: z.number().min(30).max(3600).default(300),
    retries: z.number().min(0).max(10).default(3),
    environment: z.record(z.string()).optional(),
    resources: z.object({
      cpu: z.string().default('shared-cpu-1x'),
      memory: z.string().default('256MB'),
      storage: z.string().default('1GB')
    }).optional()
  }).optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional()
});

const FilterSchema = z.object({
  status: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  priority: z.array(z.string()).optional(),
  search: z.string().optional(),
  sortBy: z.enum(['name', 'created', 'status', 'priority', 'agentCount']).default('created'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20)
});

// In-memory storage (replace with database)
let swarms: any[] = [];
let swarmTree: any = {
  id: 'root',
  name: 'Swarm Orchestrator',
  type: 'root',
  children: []
};

// GET /enhanced-swarms - List swarms with advanced filtering and sorting
router.get('/', (req, res) => {
  try {
    const filters = FilterSchema.parse(req.query);
    
    let filteredSwarms = [...swarms];
    
    // Apply filters
    if (filters.status?.length) {
      filteredSwarms = filteredSwarms.filter(s => filters.status!.includes(s.status));
    }
    
    if (filters.tags?.length) {
      filteredSwarms = filteredSwarms.filter(s => 
        s.tags?.some((tag: string) => filters.tags!.includes(tag))
      );
    }
    
    if (filters.priority?.length) {
      filteredSwarms = filteredSwarms.filter(s => 
        filters.priority!.includes(s.configuration?.priority || 'medium')
      );
    }
    
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      filteredSwarms = filteredSwarms.filter(s =>
        s.name.toLowerCase().includes(searchTerm) ||
        s.purpose.toLowerCase().includes(searchTerm) ||
        s.agents.some((a: any) => a.name.toLowerCase().includes(searchTerm))
      );
    }
    
    // Apply sorting
    filteredSwarms.sort((a, b) => {
      let aVal, bVal;
      
      switch (filters.sortBy) {
        case 'name':
          aVal = a.name;
          bVal = b.name;
          break;
        case 'status':
          aVal = a.status;
          bVal = b.status;
          break;
        case 'priority':
          aVal = a.configuration?.priority || 'medium';
          bVal = b.configuration?.priority || 'medium';
          break;
        case 'agentCount':
          aVal = a.agents.length;
          bVal = b.agents.length;
          break;
        case 'created':
        default:
          aVal = new Date(a.createdAt);
          bVal = new Date(b.createdAt);
          break;
      }
      
      if (filters.sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
    
    // Apply pagination
    const startIndex = (filters.page - 1) * filters.limit;
    const endIndex = startIndex + filters.limit;
    const paginatedSwarms = filteredSwarms.slice(startIndex, endIndex);
    
    res.json({
      data: paginatedSwarms,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total: filteredSwarms.length,
        totalPages: Math.ceil(filteredSwarms.length / filters.limit)
      },
      filters: filters
    });
  } catch (error) {
    res.status(400).json({ error: 'Invalid filter parameters' });
  }
});

// GET /enhanced-swarms/tree - Get swarm hierarchy tree
router.get('/tree', (req, res) => {
  const buildTree = () => {
    const tree = {
      id: 'root',
      name: 'Swarm Orchestrator',
      type: 'root',
      metadata: {
        totalSwarms: swarms.length,
        activeSwarms: swarms.filter(s => s.status === 'running').length,
        totalAgents: swarms.reduce((acc, s) => acc + s.agents.length, 0)
      },
      children: swarms.map(swarm => ({
        id: swarm.id,
        name: swarm.name,
        type: 'swarm',
        status: swarm.status,
        metadata: {
          purpose: swarm.purpose,
          agentCount: swarm.agents.length,
          priority: swarm.configuration?.priority || 'medium',
          tags: swarm.tags || [],
          createdAt: swarm.createdAt,
          lastUpdated: swarm.lastUpdated
        },
        children: swarm.agents.map((agent: any) => ({
          id: agent.id,
          name: agent.name,
          type: 'agent',
          status: agent.status,
          metadata: {
            role: agent.role,
            taskCount: agent.tasks.length,
            lastActivity: agent.lastActivity || swarm.createdAt,
            ...agent.metadata
          }
        }))
      }))
    };
    
    return tree;
  };
  
  res.json(buildTree());
});

// POST /enhanced-swarms - Create enhanced swarm
router.post('/', (req, res) => {
  try {
    const swarmData = SwarmSchema.parse(req.body);
    
    const swarm = {
      id: uuidv4(),
      ...swarmData,
      status: 'initializing',
      agents: swarmData.agents.map(agent => ({
        ...agent,
        id: agent.id || uuidv4(),
        status: agent.status || 'idle',
        lastActivity: new Date().toISOString()
      })),
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      metrics: {
        tasksCompleted: 0,
        tasksActive: 0,
        tasksFailed: 0,
        uptime: 0,
        avgResponseTime: 0
      }
    };
    
    swarms.push(swarm);
    
    res.status(201).json(swarm);
  } catch (error) {
    res.status(400).json({ error: 'Invalid swarm configuration' });
  }
});

// PUT /enhanced-swarms/:id - Update swarm
router.put('/:id', (req, res) => {
  try {
    const swarmIndex = swarms.findIndex(s => s.id === req.params.id);
    if (swarmIndex === -1) {
      return res.status(404).json({ error: 'Swarm not found' });
    }
    
    const swarmData = SwarmSchema.parse(req.body);
    const existingSwarm = swarms[swarmIndex];
    
    swarms[swarmIndex] = {
      ...existingSwarm,
      ...swarmData,
      id: existingSwarm.id,
      createdAt: existingSwarm.createdAt,
      lastUpdated: new Date().toISOString()
    };
    
    res.json(swarms[swarmIndex]);
  } catch (error) {
    res.status(400).json({ error: 'Invalid swarm configuration' });
  }
});

// PATCH /enhanced-swarms/:id/status - Update swarm status
router.patch('/:id/status', (req, res) => {
  const { status } = req.body;
  const validStatuses = ['initializing', 'running', 'scaling', 'stopped', 'error'];
  
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  
  const swarmIndex = swarms.findIndex(s => s.id === req.params.id);
  if (swarmIndex === -1) {
    return res.status(404).json({ error: 'Swarm not found' });
  }
  
  swarms[swarmIndex].status = status;
  swarms[swarmIndex].lastUpdated = new Date().toISOString();
  
  res.json(swarms[swarmIndex]);
});

// GET /enhanced-swarms/:id/agents - Get swarm agents
router.get('/:id/agents', (req, res) => {
  const swarm = swarms.find(s => s.id === req.params.id);
  if (!swarm) {
    return res.status(404).json({ error: 'Swarm not found' });
  }
  
  res.json(swarm.agents);
});

// POST /enhanced-swarms/:id/agents - Add agent to swarm
router.post('/:id/agents', (req, res) => {
  const swarmIndex = swarms.findIndex(s => s.id === req.params.id);
  if (swarmIndex === -1) {
    return res.status(404).json({ error: 'Swarm not found' });
  }
  
  const agent = {
    id: uuidv4(),
    ...req.body,
    status: 'idle',
    lastActivity: new Date().toISOString()
  };
  
  swarms[swarmIndex].agents.push(agent);
  swarms[swarmIndex].lastUpdated = new Date().toISOString();
  
  res.status(201).json(agent);
});

// PUT /enhanced-swarms/:id/agents/:agentId - Update agent
router.put('/:id/agents/:agentId', (req, res) => {
  const swarmIndex = swarms.findIndex(s => s.id === req.params.id);
  if (swarmIndex === -1) {
    return res.status(404).json({ error: 'Swarm not found' });
  }
  
  const agentIndex = swarms[swarmIndex].agents.findIndex((a: any) => a.id === req.params.agentId);
  if (agentIndex === -1) {
    return res.status(404).json({ error: 'Agent not found' });
  }
  
  swarms[swarmIndex].agents[agentIndex] = {
    ...swarms[swarmIndex].agents[agentIndex],
    ...req.body,
    lastActivity: new Date().toISOString()
  };
  
  swarms[swarmIndex].lastUpdated = new Date().toISOString();
  
  res.json(swarms[swarmIndex].agents[agentIndex]);
});

// DELETE /enhanced-swarms/:id/agents/:agentId - Remove agent
router.delete('/:id/agents/:agentId', (req, res) => {
  const swarmIndex = swarms.findIndex(s => s.id === req.params.id);
  if (swarmIndex === -1) {
    return res.status(404).json({ error: 'Swarm not found' });
  }
  
  const agentIndex = swarms[swarmIndex].agents.findIndex((a: any) => a.id === req.params.agentId);
  if (agentIndex === -1) {
    return res.status(404).json({ error: 'Agent not found' });
  }
  
  swarms[swarmIndex].agents.splice(agentIndex, 1);
  swarms[swarmIndex].lastUpdated = new Date().toISOString();
  
  res.status(204).send();
});

// GET /enhanced-swarms/:id/metrics - Get swarm metrics
router.get('/:id/metrics', (req, res) => {
  const swarm = swarms.find(s => s.id === req.params.id);
  if (!swarm) {
    return res.status(404).json({ error: 'Swarm not found' });
  }
  
  const metrics = {
    ...swarm.metrics,
    agents: {
      total: swarm.agents.length,
      idle: swarm.agents.filter((a: any) => a.status === 'idle').length,
      busy: swarm.agents.filter((a: any) => a.status === 'busy').length,
      error: swarm.agents.filter((a: any) => a.status === 'error').length,
      offline: swarm.agents.filter((a: any) => a.status === 'offline').length
    },
    resources: swarm.configuration?.resources || {},
    lastUpdated: swarm.lastUpdated
  };
  
  res.json(metrics);
});

// GET /enhanced-swarms/stats - Get global statistics
router.get('/stats', (req, res) => {
  const stats = {
    totalSwarms: swarms.length,
    activeSwarms: swarms.filter(s => s.status === 'running').length,
    totalAgents: swarms.reduce((acc, s) => acc + s.agents.length, 0),
    statusDistribution: {
      initializing: swarms.filter(s => s.status === 'initializing').length,
      running: swarms.filter(s => s.status === 'running').length,
      scaling: swarms.filter(s => s.status === 'scaling').length,
      stopped: swarms.filter(s => s.status === 'stopped').length,
      error: swarms.filter(s => s.status === 'error').length
    },
    priorityDistribution: {
      low: swarms.filter(s => s.configuration?.priority === 'low').length,
      medium: swarms.filter(s => s.configuration?.priority === 'medium').length,
      high: swarms.filter(s => s.configuration?.priority === 'high').length
    }
  };
  
  res.json(stats);
});

export default router;