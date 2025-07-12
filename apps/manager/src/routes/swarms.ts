import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Swarm, CreateSwarmRequest } from '../lib/types';
import { swarmOperations, workerOperations, logOperations } from '../lib/supabase-operations';
import logger from '../services/logger';
import { FlyService } from '../services/fly.service';
import { telemetryService } from '../services/telemetry.service';
import { TraceEndpoint, TraceSwarmOperation } from '../services/langfuse/decorators';

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

    // Validate environment variables if provided
    if (createRequest.config?.env) {
      const env = createRequest.config.env;
      
      // Validate Langfuse configuration if provided
      if (env.LANGFUSE_SECRET_KEY && !env.LANGFUSE_PUBLIC_KEY) {
        return res.status(400).json({ 
          error: 'LANGFUSE_PUBLIC_KEY is required when LANGFUSE_SECRET_KEY is provided' 
        });
      }
      
      // Validate TrustGraph configuration if provided
      if (env.TRUSTGRAPH_API_KEY && !env.TRUSTGRAPH_API_URL) {
        return res.status(400).json({ 
          error: 'TRUSTGRAPH_API_URL is required when TRUSTGRAPH_API_KEY is provided' 
        });
      }
    }

    // Validate Fly API token is available
    if (!process.env.FLY_ACCESS_TOKEN && !process.env.FLY_API_TOKEN) {
      return res.status(500).json({ 
        error: 'Server configuration error: FLY_ACCESS_TOKEN/FLY_API_TOKEN is not configured' 
      });
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

      // Create worker record with comprehensive machine metadata
      await workerOperations.create({
        swarm_id: swarm.id,
        name: `${swarm.name}-worker-1`,
        type: deployConfig.workerType,
        status: 'active',
        machine_id: machineId,
        config: {
          cpus: deployConfig.cpus,
          memory: deployConfig.memory,
          region: machine.region,
          image: machine.config?.image || deployConfig.dockerImage,
          private_ip: machine.private_ip,
          instance_id: machine.instance_id,
          created_at: machine.created_at,
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
      await telemetryService.trackSwarmDeployment(swarm.id, machineId || '', true);
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
      
      // Complete operation tracking with error
      // Note: swarmHooks was removed - this was unused code
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
  try {
    const swarm = await swarmOperations.get(req.params.id);
    
    if (!swarm) {
      return res.status(404).json({ error: 'Swarm not found' });
    }

    // Update swarm properties
    const updates = req.body;
    const updateData: any = {};
    
    if (updates.name) updateData.name = updates.name;
    if (updates.purpose) updateData.purpose = updates.purpose;
    if (updates.config) {
      updateData.config = { ...swarm.config, ...updates.config };
    }

    const updatedSwarm = await swarmOperations.update(swarm.id, updateData);
    res.json(updatedSwarm);
  } catch (error) {
    logger.error('Failed to update swarm', { error });
    res.status(500).json({ error: 'Failed to update swarm' });
  }
});

/**
 * DELETE /swarms/:id
 * Delete a swarm
 */
router.delete('/:id', async (req, res) => {
  try {
    const swarm = await swarmOperations.get(req.params.id);
    
    if (!swarm) {
      return res.status(404).json({ error: 'Swarm not found' });
    }

    // Delete Fly app
    try {
      if (swarm.fly_app_name) {
        await flyService.deleteApp(swarm.fly_app_name);
      }
    } catch (error) {
      logger.error('Failed to delete Fly app', { error });
    }

    // Delete from database
    await swarmOperations.delete(req.params.id);
    res.status(204).send();
  } catch (error) {
    logger.error('Failed to delete swarm', { error });
    res.status(500).json({ error: 'Failed to delete swarm' });
  }
});

/**
 * POST /swarms/:id/machines
 * Create a new machine in an existing swarm
 */
router.post('/:id/machines', async (req, res) => {
  try {
    const swarm = await swarmOperations.get(req.params.id);
    
    if (!swarm) {
      return res.status(404).json({ error: 'Swarm not found' });
    }

    if (!swarm.fly_app_name) {
      return res.status(400).json({ error: 'Swarm has no Fly app associated' });
    }

    const { workerType, region, cpus, memory, env } = req.body;

    // Prepare machine configuration
    const deployConfig = {
      swarmId: swarm.id,
      workerType: workerType || 'general',
      region: region || swarm.config.region || 'dfw',
      cpus: cpus || swarm.config.cpus || 1,
      memory: memory || swarm.config.memory || 256,
      dockerImage: swarm.config.dockerImage,
      env: { ...swarm.config.env, ...env },
    };

    // Create new machine
    const machine = await flyService.createMachine(swarm.fly_app_name, deployConfig);

    // Create worker record
    const workerName = `${swarm.name}-worker-${Date.now()}`;
    const worker = await workerOperations.create({
      swarm_id: swarm.id,
      name: workerName,
      type: deployConfig.workerType,
      status: 'active',
      machine_id: machine.id,
      config: {
        cpus: deployConfig.cpus,
        memory: deployConfig.memory,
        region: machine.region,
        image: machine.config?.image || deployConfig.dockerImage,
        private_ip: machine.private_ip,
        instance_id: machine.instance_id,
        created_at: machine.created_at,
      },
    });

    // Update swarm worker count
    const workers = await workerOperations.listBySwarm(swarm.id);
    await swarmOperations.update(swarm.id, { 
      worker_count: workers.length,
    });

    // Log machine creation
    await logOperations.create({
      swarm_id: swarm.id,
      level: 'info',
      source: 'manager',
      message: `New machine created: ${machine.id}`,
      metadata: { machineId: machine.id, workerName, region: machine.region },
    });

    // Track with telemetry
    await telemetryService.trackWorkerAssignment(swarm.id, worker.id);

    res.status(201).json({
      machine,
      worker,
      message: 'Machine created successfully',
    });
  } catch (error) {
    logger.error('Failed to create machine', { error });
    res.status(500).json({ error: 'Failed to create machine' });
  }
});

/**
 * POST /swarms/:id/scale
 * Scale a swarm's worker count
 */
router.post('/:id/scale', async (req, res) => {
  try {
    const swarm = await swarmOperations.get(req.params.id);
    
    if (!swarm) {
      return res.status(404).json({ error: 'Swarm not found' });
    }

    const { workerCount } = req.body;
    
    if (typeof workerCount !== 'number' || workerCount < 0 || workerCount > swarm.config.maxWorkers) {
      return res.status(400).json({ 
        error: `Worker count must be between 0 and ${swarm.config.maxWorkers}` 
      });
    }

    // Scale Fly app
    if (swarm.fly_app_name) {
      await flyService.scaleApp(swarm.fly_app_name, workerCount);
    }
    
    // Update database
    const updatedSwarm = await swarmOperations.update(swarm.id, { 
      worker_count: workerCount,
    });
    
    res.json({ 
      message: `Swarm scaled to ${workerCount} workers`,
      swarm: updatedSwarm
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
  try {
    const swarm = await swarmOperations.get(req.params.id);
    
    if (!swarm) {
      return res.status(404).json({ error: 'Swarm not found' });
    }

    const lines = parseInt(req.query.lines as string) || 100;

    // Get both Fly logs and database logs
    let flyLogs: string[] = [];
    if (swarm.fly_app_name) {
      try {
        flyLogs = await flyService.getAppLogs(swarm.fly_app_name, lines);
      } catch (error) {
        logger.warn('Failed to get Fly logs', { error });
      }
    }

    // Get database logs
    const dbLogs = await logOperations.listBySwarm(swarm.id, lines);
    
    res.json({ 
      swarmId: swarm.id,
      flyLogs,
      dbLogs
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
  try {
    const swarm = await swarmOperations.get(req.params.id);
    
    if (!swarm) {
      return res.status(404).json({ error: 'Swarm not found' });
    }

    // Scale to 0 to stop
    if (swarm.fly_app_name) {
      await flyService.scaleApp(swarm.fly_app_name, 0);
    }
    
    // Update database
    const updatedSwarm = await swarmOperations.update(swarm.id, {
      status: 'stopped',
      worker_count: 0,
    });
    
    res.json({ 
      message: 'Swarm stopped',
      swarm: updatedSwarm 
    });
  } catch (error) {
    logger.error('Failed to stop swarm', { error });
    res.status(500).json({ error: 'Failed to stop swarm' });
  }
});

/**
 * GET /swarms/:id/machines
 * Get machine metadata for a swarm
 */
router.get('/:id/machines', async (req, res) => {
  try {
    const swarm = await swarmOperations.get(req.params.id);
    
    if (!swarm) {
      return res.status(404).json({ error: 'Swarm not found' });
    }

    if (!swarm.fly_app_name) {
      return res.status(404).json({ error: 'Swarm has no Fly app associated' });
    }

    // Get machine list from Fly
    const machines = await flyService.listMachines(swarm.fly_app_name);
    
    // Get workers from database for additional metadata
    const workers = await workerOperations.listBySwarm(swarm.id);
    
    // Combine machine data with worker metadata
    const enrichedMachines = machines.map(machine => {
      const worker = workers.find(w => w.machine_id === machine.id);
      return {
        ...machine,
        worker: worker || null,
      };
    });

    res.json({
      swarmId: swarm.id,
      appName: swarm.fly_app_name,
      machines: enrichedMachines,
    });
  } catch (error) {
    logger.error('Failed to get swarm machines', { error });
    res.status(500).json({ error: 'Failed to get machine metadata' });
  }
});

/**
 * POST /swarms/:id/start
 * Start a swarm
 */
router.post('/:id/start', async (req, res) => {
  try {
    const swarm = await swarmOperations.get(req.params.id);
    
    if (!swarm) {
      return res.status(404).json({ error: 'Swarm not found' });
    }

    const workerCount = req.body.workerCount || 1;

    // Scale up to start
    if (swarm.fly_app_name) {
      await flyService.scaleApp(swarm.fly_app_name, workerCount);
    }
    
    // Update database
    const updatedSwarm = await swarmOperations.update(swarm.id, {
      status: 'running',
      worker_count: workerCount,
    });
    
    res.json({ 
      message: 'Swarm started',
      swarm: updatedSwarm 
    });
  } catch (error) {
    logger.error('Failed to start swarm', { error });
    res.status(500).json({ error: 'Failed to start swarm' });
  }
});

/**
 * GET /swarms/:id/machines/:machineId/stats
 * Get real-time stats for a specific machine
 */
router.get('/:id/machines/:machineId/stats', async (req, res) => {
  try {
    const swarm = await swarmOperations.get(req.params.id);
    
    if (!swarm) {
      return res.status(404).json({ error: 'Swarm not found' });
    }

    if (!swarm.fly_app_name) {
      return res.status(404).json({ error: 'Swarm has no Fly app associated' });
    }

    // Get machine stats
    const stats = await flyService.getMachineStats(swarm.fly_app_name, req.params.machineId);
    
    res.json({
      swarmId: swarm.id,
      machineId: req.params.machineId,
      stats,
    });
  } catch (error) {
    logger.error('Failed to get machine stats', { error });
    res.status(500).json({ error: 'Failed to get machine stats' });
  }
});

/**
 * PUT /swarms/:id/machines/:machineId/scale
 * Scale a specific machine's resources
 */
router.put('/:id/machines/:machineId/scale', async (req, res) => {
  try {
    const swarm = await swarmOperations.get(req.params.id);
    
    if (!swarm) {
      return res.status(404).json({ error: 'Swarm not found' });
    }

    if (!swarm.fly_app_name) {
      return res.status(404).json({ error: 'Swarm has no Fly app associated' });
    }

    const { cpus, memory } = req.body;
    
    if ((!cpus && !memory) || (cpus && cpus < 1) || (memory && memory < 256)) {
      return res.status(400).json({ 
        error: 'Invalid scale parameters. CPUs must be >= 1, memory must be >= 256' 
      });
    }

    // Scale the machine
    const result = await flyService.scaleMachine(swarm.fly_app_name, req.params.machineId, { cpus, memory });
    
    // Update worker record if exists
    const workers = await workerOperations.listBySwarm(swarm.id);
    const worker = workers.find(w => w.machine_id === req.params.machineId);
    if (worker) {
      await workerOperations.update(worker.id, {
        config: {
          ...worker.config,
          cpus: cpus || worker.config.cpus,
          memory: memory || worker.config.memory,
        },
      });
    }

    // Log the scaling operation
    await logOperations.create({
      swarm_id: swarm.id,
      level: 'info',
      source: 'manager',
      message: `Machine ${req.params.machineId} scaled`,
      metadata: { machineId: req.params.machineId, cpus, memory },
    });

    res.json({ 
      message: 'Machine scaled successfully',
      machine: result,
    });
  } catch (error) {
    logger.error('Failed to scale machine', { error });
    res.status(500).json({ error: 'Failed to scale machine' });
  }
});

/**
 * POST /swarms/:id/machines/:machineId/restart
 * Restart a specific machine
 */
router.post('/:id/machines/:machineId/restart', async (req, res) => {
  try {
    const swarm = await swarmOperations.get(req.params.id);
    
    if (!swarm) {
      return res.status(404).json({ error: 'Swarm not found' });
    }

    if (!swarm.fly_app_name) {
      return res.status(404).json({ error: 'Swarm has no Fly app associated' });
    }

    // Restart the machine
    await flyService.restartMachine(swarm.fly_app_name, req.params.machineId);
    
    // Log the restart
    await logOperations.create({
      swarm_id: swarm.id,
      level: 'info',
      source: 'manager',
      message: `Machine ${req.params.machineId} restarted`,
      metadata: { machineId: req.params.machineId },
    });

    res.json({ 
      message: 'Machine restarted successfully',
      machineId: req.params.machineId,
    });
  } catch (error) {
    logger.error('Failed to restart machine', { error });
    res.status(500).json({ error: 'Failed to restart machine' });
  }
});

/**
 * POST /swarms/:id/machines/:machineId/stop
 * Stop a specific machine
 */
router.post('/:id/machines/:machineId/stop', async (req, res) => {
  try {
    const swarm = await swarmOperations.get(req.params.id);
    
    if (!swarm) {
      return res.status(404).json({ error: 'Swarm not found' });
    }

    if (!swarm.fly_app_name) {
      return res.status(404).json({ error: 'Swarm has no Fly app associated' });
    }

    // Stop the machine
    await flyService.stopMachine(swarm.fly_app_name, req.params.machineId);
    
    // Update worker status
    const workers = await workerOperations.listBySwarm(swarm.id);
    const worker = workers.find(w => w.machine_id === req.params.machineId);
    if (worker) {
      await workerOperations.update(worker.id, { status: 'stopped' });
    }

    // Log the stop
    await logOperations.create({
      swarm_id: swarm.id,
      level: 'info',
      source: 'manager',
      message: `Machine ${req.params.machineId} stopped`,
      metadata: { machineId: req.params.machineId },
    });

    res.json({ 
      message: 'Machine stopped successfully',
      machineId: req.params.machineId,
    });
  } catch (error) {
    logger.error('Failed to stop machine', { error });
    res.status(500).json({ error: 'Failed to stop machine' });
  }
});

/**
 * POST /swarms/:id/machines/:machineId/start
 * Start a specific machine
 */
router.post('/:id/machines/:machineId/start', async (req, res) => {
  try {
    const swarm = await swarmOperations.get(req.params.id);
    
    if (!swarm) {
      return res.status(404).json({ error: 'Swarm not found' });
    }

    if (!swarm.fly_app_name) {
      return res.status(404).json({ error: 'Swarm has no Fly app associated' });
    }

    // Start the machine
    await flyService.startMachine(swarm.fly_app_name, req.params.machineId);
    
    // Update worker status
    const workers = await workerOperations.listBySwarm(swarm.id);
    const worker = workers.find(w => w.machine_id === req.params.machineId);
    if (worker) {
      await workerOperations.update(worker.id, { status: 'active' });
    }

    // Log the start
    await logOperations.create({
      swarm_id: swarm.id,
      level: 'info',
      source: 'manager',
      message: `Machine ${req.params.machineId} started`,
      metadata: { machineId: req.params.machineId },
    });

    res.json({ 
      message: 'Machine started successfully',
      machineId: req.params.machineId,
    });
  } catch (error) {
    logger.error('Failed to start machine', { error });
    res.status(500).json({ error: 'Failed to start machine' });
  }
});

/**
 * DELETE /swarms/:id/machines/:machineId
 * Destroy a specific machine
 */
router.delete('/:id/machines/:machineId', async (req, res) => {
  try {
    const swarm = await swarmOperations.get(req.params.id);
    
    if (!swarm) {
      return res.status(404).json({ error: 'Swarm not found' });
    }

    if (!swarm.fly_app_name) {
      return res.status(404).json({ error: 'Swarm has no Fly app associated' });
    }

    // Destroy the machine
    await flyService.destroyMachine(swarm.fly_app_name, req.params.machineId);
    
    // Delete worker record
    const workers = await workerOperations.listBySwarm(swarm.id);
    const worker = workers.find(w => w.machine_id === req.params.machineId);
    if (worker) {
      await workerOperations.delete(worker.id);
    }

    // Update swarm worker count
    const remainingWorkers = await workerOperations.listBySwarm(swarm.id);
    await swarmOperations.update(swarm.id, { 
      worker_count: remainingWorkers.length,
    });

    // Log the destruction
    await logOperations.create({
      swarm_id: swarm.id,
      level: 'info',
      source: 'manager',
      message: `Machine ${req.params.machineId} destroyed`,
      metadata: { machineId: req.params.machineId },
    });

    res.status(204).send();
  } catch (error) {
    logger.error('Failed to destroy machine', { error });
    res.status(500).json({ error: 'Failed to destroy machine' });
  }
});

export default router;