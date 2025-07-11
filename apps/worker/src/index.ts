import express from 'express'
import { Worker } from 'bullmq'
import { config } from 'dotenv'
import winston from 'winston'

config()

const app = express()
const PORT = process.env.PORT || 8000

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
})

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    workerType: process.env.WORKER_TYPE || 'generic',
    swarmName: process.env.SWARM_NAME,
    timestamp: new Date().toISOString(),
  })
})

// Metrics endpoint
app.get('/metrics', (req, res) => {
  res.json({
    processed: worker.processed,
    failed: worker.failed,
    completed: worker.completed,
  })
})

// Initialize worker
const worker = new Worker(
  'tasks',
  async (job) => {
    logger.info(`Processing task ${job.id} of type ${job.name}`)
    
    switch (job.name) {
      case 'analyze':
        return handleAnalyze(job.data)
      case 'process':
        return handleProcess(job.data)
      default:
        logger.warn(`Unknown task type: ${job.name}`)
        throw new Error(`Unknown task type: ${job.name}`)
    }
  },
  {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    },
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '1'),
  }
)

async function handleAnalyze(data: any) {
  // Simulate analysis work
  await new Promise(resolve => setTimeout(resolve, 1000))
  return { analyzed: true, ...data }
}

async function handleProcess(data: any) {
  // Simulate processing work
  await new Promise(resolve => setTimeout(resolve, 2000))
  return { processed: true, ...data }
}

worker.on('completed', (job) => {
  logger.info(`Job ${job.id} completed`)
})

worker.on('failed', (job, err) => {
  logger.error(`Job ${job?.id} failed:`, err)
})

app.listen(PORT, () => {
  logger.info(`Worker running on port ${PORT}`)
  logger.info(`Worker type: ${process.env.WORKER_TYPE || 'generic'}`)
  logger.info(`Swarm: ${process.env.SWARM_NAME}`)
})