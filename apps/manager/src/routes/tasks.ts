import { Router } from 'express'
import { z } from 'zod'
import { Queue } from 'bullmq'
import { logger } from '../lib/logger'

export const taskRouter = Router()

// Task validation schema
const createTaskSchema = z.object({
  type: z.string(),
  payload: z.any(),
  swarmId: z.string(),
  priority: z.number().min(1).max(10).default(5),
  retries: z.number().min(0).max(5).default(3),
})

// Initialize task queue
const taskQueue = new Queue('tasks', {
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
})

// GET /api/tasks - List tasks
taskRouter.get('/', async (req, res, next) => {
  try {
    const { status, swarmId } = req.query
    
    // TODO: Implement task filtering
    const jobs = await taskQueue.getJobs(['waiting', 'active', 'completed', 'failed'])
    
    const tasks = jobs.map(job => ({
      id: job.id,
      type: job.name,
      status: job.progress,
      data: job.data,
      createdAt: new Date(job.timestamp).toISOString(),
    }))
    
    res.json(tasks)
  } catch (error) {
    next(error)
  }
})

// POST /api/tasks - Create a new task
taskRouter.post('/', async (req, res, next) => {
  try {
    const data = createTaskSchema.parse(req.body)
    
    logger.info(`Creating task: ${data.type} for swarm ${data.swarmId}`)
    
    const job = await taskQueue.add(data.type, {
      swarmId: data.swarmId,
      payload: data.payload,
    }, {
      priority: data.priority,
      attempts: data.retries,
    })
    
    res.status(201).json({
      id: job.id,
      type: data.type,
      swarmId: data.swarmId,
      status: 'queued',
      createdAt: new Date().toISOString(),
    })
  } catch (error) {
    next(error)
  }
})

// GET /api/tasks/:id - Get task details
taskRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    
    const job = await taskQueue.getJob(id)
    if (!job) {
      return res.status(404).json({ error: 'Task not found' })
    }
    
    const state = await job.getState()
    
    res.json({
      id: job.id,
      type: job.name,
      status: state,
      data: job.data,
      progress: job.progress,
      result: job.returnvalue,
      failedReason: job.failedReason,
      createdAt: new Date(job.timestamp).toISOString(),
    })
  } catch (error) {
    next(error)
  }
})

// DELETE /api/tasks/:id - Cancel a task
taskRouter.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    
    const job = await taskQueue.getJob(id)
    if (!job) {
      return res.status(404).json({ error: 'Task not found' })
    }
    
    await job.remove()
    
    res.status(204).send()
  } catch (error) {
    next(error)
  }
})