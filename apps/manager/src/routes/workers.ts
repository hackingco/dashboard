import { Router } from 'express'
import { FlyService } from '../services/fly.service'
import { logger } from '../lib/logger'

export const workerRouter = Router()
const flyService = new FlyService()

// GET /api/workers - List all workers across all swarms
workerRouter.get('/', async (req, res, next) => {
  try {
    // TODO: Implement worker listing from all swarms
    const workers = []
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
    
    const machine = await flyService.getMachineStatus(
      `swarm-${swarm}`,
      id
    )
    
    const worker = {
      id: machine.id,
      swarm: swarm as string,
      state: machine.state,
      region: machine.region,
      config: machine.config,
      createdAt: machine.created_at,
      updatedAt: machine.updated_at,
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