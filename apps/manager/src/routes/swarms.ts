import { Router } from 'express'
import { z } from 'zod'
import { FlyService } from '../services/fly.service'
import { ApiError } from '../middleware/error'
import { strictRateLimiter } from '../middleware/rateLimiter'
import { logger } from '../lib/logger'

export const swarmRouter = Router()
const flyService = new FlyService()

// Validation schemas
const createSwarmSchema = z.object({
  name: z.string().min(3).max(30).regex(/^[a-z0-9-]+$/),
  workerCount: z.number().min(1).max(10).default(1),
  workerType: z.enum(['researcher', 'coder', 'analyst', 'tester']).default('generic'),
  config: z.object({
    memory: z.number().default(256),
    cpus: z.number().default(1),
    env: z.record(z.string()).optional(),
  }).optional(),
})

const scaleSwarmSchema = z.object({
  workerCount: z.number().min(0).max(20),
})

// GET /api/swarms - List all swarms
swarmRouter.get('/', async (req, res, next) => {
  try {
    // TODO: Fetch from Supabase
    const swarms = [
      {
        id: '1',
        name: 'production-api',
        status: 'active',
        workerCount: 3,
        createdAt: new Date().toISOString(),
      },
    ]
    res.json(swarms)
  } catch (error) {
    next(error)
  }
})

// POST /api/swarms - Create a new swarm
swarmRouter.post('/', strictRateLimiter, async (req, res, next) => {
  try {
    const data = createSwarmSchema.parse(req.body)
    
    logger.info(`Creating swarm: ${data.name}`)

    // Create Fly app for the swarm
    const app = await flyService.createApp(`swarm-${data.name}`)

    // Deploy worker configuration
    const workerConfig = {
      app: app.name,
      env: {
        WORKER_TYPE: data.workerType,
        SWARM_NAME: data.name,
        ...data.config?.env,
      },
      services: [{
        ports: [{ port: 80, handlers: ['http'] }],
        protocol: 'tcp',
        internal_port: 8000,
      }],
    }

    await flyService.deployApp(app.name, workerConfig)

    // Scale to desired worker count
    if (data.workerCount > 1) {
      await flyService.scaleMachines(app.name, data.workerCount)
    }

    // TODO: Save to Supabase
    const swarm = {
      id: app.name,
      name: data.name,
      status: 'active',
      workerCount: data.workerCount,
      workerType: data.workerType,
      flyAppName: app.name,
      createdAt: new Date().toISOString(),
    }

    res.status(201).json(swarm)
  } catch (error) {
    next(error)
  }
})

// GET /api/swarms/:id - Get swarm details
swarmRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    
    // TODO: Fetch from Supabase
    const machines = await flyService.listMachines(`swarm-${id}`)
    
    const swarm = {
      id,
      name: id,
      status: 'active',
      workers: machines.map(m => ({
        id: m.id,
        state: m.state,
        region: m.region,
        createdAt: m.created_at,
      })),
    }

    res.json(swarm)
  } catch (error) {
    next(error)
  }
})

// PUT /api/swarms/:id/scale - Scale swarm workers
swarmRouter.put('/:id/scale', strictRateLimiter, async (req, res, next) => {
  try {
    const { id } = req.params
    const data = scaleSwarmSchema.parse(req.body)
    
    logger.info(`Scaling swarm ${id} to ${data.workerCount} workers`)
    
    await flyService.scaleMachines(`swarm-${id}`, data.workerCount)
    
    res.json({ 
      id, 
      workerCount: data.workerCount,
      message: 'Swarm scaled successfully' 
    })
  } catch (error) {
    next(error)
  }
})

// DELETE /api/swarms/:id - Destroy swarm
swarmRouter.delete('/:id', strictRateLimiter, async (req, res, next) => {
  try {
    const { id } = req.params
    
    logger.info(`Destroying swarm: ${id}`)
    
    await flyService.destroyApp(`swarm-${id}`)
    
    // TODO: Delete from Supabase
    
    res.status(204).send()
  } catch (error) {
    next(error)
  }
})