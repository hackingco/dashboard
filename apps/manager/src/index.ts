import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { config } from 'dotenv'
import { createBullBoard } from '@bull-board/express'
import { logger } from './lib/logger'
import { errorHandler } from './middleware/error'
import { rateLimiter } from './middleware/rateLimiter'

// Routes
import { swarmRouter } from './routes/swarms'
import { workerRouter } from './routes/workers'
import { taskRouter } from './routes/tasks'
import { healthRouter } from './routes/health'

// Load environment variables
config()

const app = express()
const PORT = process.env.PORT || 8080

// Middleware
app.use(helmet())
app.use(cors({
  origin: process.env.DASHBOARD_URL || 'http://localhost:3000',
  credentials: true,
}))
app.use(express.json())
app.use(rateLimiter)

// Bull Dashboard
const { router: bullRouter } = createBullBoard({
  queues: [], // Will be populated with task queues
})

// Routes
app.use('/health', healthRouter)
app.use('/api/swarms', swarmRouter)
app.use('/api/workers', workerRouter)
app.use('/api/tasks', taskRouter)
app.use('/admin/queues', bullRouter)

// Error handling
app.use(errorHandler)

// Start server
app.listen(PORT, () => {
  logger.info(`Swarm Manager API running on port ${PORT}`)
})