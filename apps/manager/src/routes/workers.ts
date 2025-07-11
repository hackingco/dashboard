import { Router } from 'express'
import { FlyService } from '../services/fly.service'
import logger from '../services/logger'
import { Worker } from '@swarm/types'

export const workerRouter = Router()
const flyService = new FlyService()

// GET /api/workers - List all workers across all swarms
workerRouter.get('/', async (req, res, next) => {
  try {
    // TODO: Implement worker listing from all swarms
    const workers: Worker[] = []
    res.json(workers)
  } catch (error) {
    next(error)
  }
})

// GET /api/workers/:id - Get worker details
workerRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const { swarm } = req.query
    
    if (!swarm) {
      return res.status(400).json({ error: 'Swarm name required' })
    }
    
    // TODO: Implement machine status retrieval
    // const machine = await flyService.getMachineStatus(
    //   `swarm-${swarm}`,
    //   id
    // )
    
    const worker: Worker = {
      id: id,
      swarmId: swarm as string,
      type: 'analyst',
      state: 'started',
      machineId: id,
      region: 'dfw',
      config: {
        image: 'swarm-worker:latest',
        memory: 256,
        cpus: 1,
        env: {}
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metrics: {
        cpu: 0,
        memory: 0,
        diskUsage: 0,
        networkIn: 0,
        networkOut: 0,
        timestamp: new Date().toISOString(),
      }
    }
    
    res.json(worker)
  } catch (error) {
    next(error)
  }
})

// POST /api/workers/:id/restart - Restart a worker
workerRouter.post('/:id/restart', async (req, res, next) => {
  try {
    const { id } = req.params
    const { swarm } = req.body
    
    if (!swarm) {
      return res.status(400).json({ error: 'Swarm name required' })
    }
    
    logger.info(`Restarting worker ${id} in swarm ${swarm}`)
    
    // TODO: Implement worker restart via Fly API
    
    res.json({ message: 'Worker restart initiated' })
  } catch (error) {
    next(error)
  }
})