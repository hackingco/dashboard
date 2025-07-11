import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Swarm, CreateSwarmRequest } from '@swarm/types';
import { swarmOperations, workerOperations, logOperations } from '@swarm/supabase';
import logger from '../services/logger';
import { FlyService } from '../services/fly.service';
import { telemetryService } from '../services/telemetry.service';

const router = Router();
const flyService = new FlyService();

/**
 * GET /swarms
 * List all swarms
 */
router.get('/', async (req, res) => {
  try {
    // Get swarms from Supabase
    const swarms = await swarmOperations.list();
    
    // Get Fly apps to sync status
    const flyApps = await flyService.listSwarmApps();
    
    // Update swarm statuses based on Fly apps
    for (const swarm of swarms) {
      if (swarm.fly_app_name && flyApps.includes(swarm.fly_app_name)) {
        try {
          const status = await flyService.getAppStatus(swarm.fly_app_name);
          const newStatus = status.Allocations?.length > 0 ? 'running' : 'stopped';
          if (swarm.status !== newStatus) {
            await swarmOperations.update(swarm.id, { status: newStatus });
            swarm.status = newStatus;
          }
        } catch (error) {
          if (swarm.status !== 'error') {
            await swarmOperations.update(swarm.id, { 
              status: 'error',
              error: 'Failed to get Fly app status'
            });
            swarm.status = 'error';
          }
        }
      }
    }

    res.json(swarms);
  } catch (error) {
    logger.error('Failed to list swarms', { error });
    res.status(500).json({ error: 'Failed to list swarms' });
  }
});

/**
 * POST /swarms
 * Create a new swarm
 */
router.post('/', async (req, res) => {
  try {
    const createRequest: CreateSwarmRequest = req.body;

    // Validate request
    if (!createRequest.name || !createRequest.purpose) {
      return res.status(400).json({ error: 'Name and purpose are required' });
    }

    // Generate Fly app name
    const appName = `swarm-${createRequest.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;

    // Create swarm in Supabase
    const swarm = await swarmOperations.create({
      name: createRequest.name,
      purpose: createRequest.purpose,
      status: 'initializing',
      worker_count: createRequest.workerCount || 1,
      fly_app_name: appName,
      config: {
        maxWorkers: createRequest.config?.maxWorkers || 10,
        taskTimeout: createRequest.config?.taskTimeout || 300000,
        retryLimit: createRequest.config?.retryLimit || 3,
        region: createRequest.config?.region || 'dfw',
        cpus: createRequest.config?.cpus || 1,
        memory: createRequest.config?.memory || 256,
        dockerImage: createRequest.config?.dockerImage,
        env: createRequest.config?.env || {},
      },
      metrics: {
        tasksCompleted: 0,
        tasksFailed: 0,
        averageTaskTime: 0,
      },
    });

    // Log swarm creation
    await logOperations.create({
      swarm_id: swarm.id,
      level: 'info',
      source: 'manager',
      message: `Swarm "${swarm.name}" created`,
      metadata: { appName },
    });

    // Track swarm creation with telemetry
    await telemetryService.trackSwarmCreation(swarm.id, swarm.name, swarm.config);

    // Create Fly app and deploy
    let machineId: string | null = null;
    
    try {
      await flyService.createApp(appName);
      
      // Deploy the worker app
      const deployConfig = {
        swarmId: swarm.id,
        workerType: createRequest.config?.workerType || 'general',
        region: createRequest.config?.region || 'dfw',
        cpus: createRequest.config?.cpus || 1,
        memory: createRequest.config?.memory || 256,
        minInstances: createRequest.config?.minInstances || 1,
        dockerImage: createRequest.config?.dockerImage,
        env: createRequest.config?.env || {},
      };
      
      const machine = await flyService.createMachine(appName, deployConfig);
      machineId = machine.id;

      // Update swarm status
      await swarmOperations.update(swarm.id, { 
        status: 'running',
        worker_count: 1,
      });

      // Create worker record
      await workerOperations.create({
        swarm_id: swarm.id,
        name: `${swarm.name}-worker-1`,
        type: deployConfig.workerType,
        status: 'active',
        machine_id: machineId,
        config: {
          cpus: deployConfig.cpus,
          memory: deployConfig.memory,
        },
      });

      // Log successful deployment
      await logOperations.create({
        swarm_id: swarm.id,
        level: 'info',
        source: 'manager',
        message: `Swarm deployed successfully`,
        metadata: { machineId, appName },
      });
      
      // Track successful deployment
      await telemetryService.trackSwarmDeployment(swarm.id, machineId, true);
    } catch (error) {
      logger.error('Failed to create Fly app', { appName, error });
      
      // Update swarm with error
      await swarmOperations.update(swarm.id, { 
        status: 'error',
        error: 'Failed to deploy to Fly.io',
      });

      // Log error
      await logOperations.create({
        swarm_id: swarm.id,
        level: 'error',
        source: 'manager',
        message: `Failed to deploy swarm: ${error}`,
        metadata: { appName, error: String(error) },
      });
      
      // Track failed deployment
      await telemetryService.trackSwarmDeployment(swarm.id, '', false, error);
    }

    // Get updated swarm
    const updatedSwarm = await swarmOperations.get(swarm.id);
    res.status(201).json(updatedSwarm);
  } catch (error) {
    logger.error('Failed to create swarm', { error });
    res.status(500).json({ error: 'Failed to create swarm' });
  }
});

/**
 * GET /swarms/:id
 * Get a specific swarm
 */
router.get('/:id', async (req, res) => {
  try {
    const swarm = await swarmOperations.get(req.params.id);
    
    if (!swarm) {
      return res.status(404).json({ error: 'Swarm not found' });
    }

    // Update status from Fly
    if (swarm.fly_app_name) {
      try {
        const status = await flyService.getAppStatus(swarm.fly_app_name);
        const newStatus = status.Allocations?.length > 0 ? 'running' : 'stopped';
        if (swarm.status !== newStatus) {
          await swarmOperations.update(swarm.id, { status: newStatus });
          swarm.status = newStatus;
        }
      } catch (error) {
        logger.warn('Failed to get Fly app status', { error });
      }
    }

    res.json(swarm);
  } catch (error) {
    logger.error('Failed to get swarm', { error });
    res.status(500).json({ error: 'Failed to get swarm' });
  }
});

/**
 * PUT /swarms/:id
 * Update a swarm
 */
router.put('/:id', async (req, res) => {
  const swarm = swarms.get(req.params.id);
  
  if (!swarm) {
    return res.status(404).json({ error: 'Swarm not found' });
  }

  // Update swarm properties
  const updates = req.body;
  if (updates.name) swarm.name = updates.name;
  if (updates.purpose) swarm.purpose = updates.purpose;
  if (updates.config) {
    swarm.config = { ...swarm.config, ...updates.config };
  }
  swarm.updatedAt = new Date();

  res.json(swarm);
});

/**
 * DELETE /swarms/:id
 * Delete a swarm
 */
router.delete('/:id', async (req, res) => {
  const swarm = swarms.get(req.params.id);
  
  if (!swarm) {
    return res.status(404).json({ error: 'Swarm not found' });
  }

  // Delete Fly app
  try {
    const appName = flyService.swarmToFlyApp(swarm);
    await flyService.deleteApp(appName);
  } catch (error) {
    logger.error('Failed to delete Fly app', { error });
  }

  swarms.delete(req.params.id);
  res.status(204).send();
});

/**
 * POST /swarms/:id/scale
 * Scale a swarm's worker count
 */
router.post('/:id/scale', async (req, res) => {
  const swarm = swarms.get(req.params.id);
  
  if (!swarm) {
    return res.status(404).json({ error: 'Swarm not found' });
  }

  const { workerCount } = req.body;
  
  if (typeof workerCount !== 'number' || workerCount < 0 || workerCount > swarm.config.maxWorkers) {
    return res.status(400).json({ 
      error: `Worker count must be between 0 and ${swarm.config.maxWorkers}` 
    });
  }

  try {
    // Scale Fly app
    const appName = flyService.swarmToFlyApp(swarm);
    await flyService.scaleApp(appName, workerCount);
    
    swarm.workerCount = workerCount;
    swarm.updatedAt = new Date();
    
    res.json({ 
      message: `Swarm scaled to ${workerCount} workers`,
      swarm 
    });
  } catch (error) {
    logger.error('Failed to scale swarm', { error });
    res.status(500).json({ error: 'Failed to scale swarm' });
  }
});

/**
 * GET /swarms/:id/logs
 * Get logs for a swarm
 */
router.get('/:id/logs', async (req, res) => {
  const swarm = swarms.get(req.params.id);
  
  if (!swarm) {
    return res.status(404).json({ error: 'Swarm not found' });
  }

  const lines = parseInt(req.query.lines as string) || 100;

  try {
    const appName = flyService.swarmToFlyApp(swarm);
    const logs = await flyService.getAppLogs(appName, lines);
    
    res.json({ 
      swarmId: swarm.id,
      logs 
    });
  } catch (error) {
    logger.error('Failed to get swarm logs', { error });
    res.status(500).json({ error: 'Failed to get logs' });
  }
});

/**
 * POST /swarms/:id/stop
 * Stop a swarm
 */
router.post('/:id/stop', async (req, res) => {
  const swarm = swarms.get(req.params.id);
  
  if (!swarm) {
    return res.status(404).json({ error: 'Swarm not found' });
  }

  try {
    // Scale to 0 to stop
    const appName = flyService.swarmToFlyApp(swarm);
    await flyService.scaleApp(appName, 0);
    
    swarm.status = 'stopped';
    swarm.workerCount = 0;
    swarm.updatedAt = new Date();
    
    res.json({ 
      message: 'Swarm stopped',
      swarm 
    });
  } catch (error) {
    logger.error('Failed to stop swarm', { error });
    res.status(500).json({ error: 'Failed to stop swarm' });
  }
});

/**
 * POST /swarms/:id/start
 * Start a swarm
 */
router.post('/:id/start', async (req, res) => {
  const swarm = swarms.get(req.params.id);
  
  if (!swarm) {
    return res.status(404).json({ error: 'Swarm not found' });
  }

  const workerCount = req.body.workerCount || 1;

  try {
    // Scale up to start
    const appName = flyService.swarmToFlyApp(swarm);
    await flyService.scaleApp(appName, workerCount);
    
    swarm.status = 'running';
    swarm.workerCount = workerCount;
    swarm.updatedAt = new Date();
    
    res.json({ 
      message: 'Swarm started',
      swarm 
    });
  } catch (error) {
    logger.error('Failed to start swarm', { error });
    res.status(500).json({ error: 'Failed to start swarm' });
  }
});

export default router;