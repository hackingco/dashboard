import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import path from 'path'
import { config } from 'dotenv'
import { createBullBoard } from '@bull-board/api'
import { ExpressAdapter } from '@bull-board/express'
import logger from './services/logger'
import { errorHandler } from './middleware/error'
import { rateLimiter } from './middleware/rateLimiter'
import { initializeHiveMind } from './services/claude-flow/init'

// Routes
import swarmRouter from './routes/swarms'
import enhancedSwarmRouter from './routes/enhanced-swarms'
import { workerRouter } from './routes/workers'
import { taskRouter } from './routes/tasks'
import { healthRouter } from './routes/health'
import telemetryRouter from './routes/telemetry'

// Load environment variables
config()

const app = express()
const PORT = process.env.PORT || 8080

// Middleware
app.use(helmet())
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true)
    
    const allowedOrigins = [
      process.env.DASHBOARD_URL || 'http://localhost:3000',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'https://admin-dashboard-ovj3bt2gz-hackingco.vercel.app',
      'https://admin-dashboard-5otb7nvz5-hackingco.vercel.app',
      'https://admin-dashboard-r2axwm3fl-hackingco.vercel.app',
      'https://admin-dashboard-l0e1w6ivz-hackingco.vercel.app',
      'https://dist-d4ex7zt2q-hackingco.vercel.app',
      'https://dist-cqq7lpfmg-hackingco.vercel.app',
      // Add pattern matching for Vercel preview deployments
      /^https:\/\/admin-dashboard-.*-hackingco\.vercel\.app$/,
      /^https:\/\/dist-.*-hackingco\.vercel\.app$/,
      // Add any other allowed origins here
    ]
    
    // Check exact matches first
    if (allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') {
        return allowed === origin
      } else if (allowed instanceof RegExp) {
        return allowed.test(origin)
      }
      return false
    })) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
}))
app.use(express.json())
app.use(rateLimiter)

// Bull Dashboard
const serverAdapter = new ExpressAdapter()
serverAdapter.setBasePath('/admin/queues')

createBullBoard({
  queues: [], // Will be populated with task queues
  serverAdapter: serverAdapter,
})

// Routes
app.use('/health', healthRouter)
app.use('/api/swarms', swarmRouter)
app.use('/api/enhanced-swarms', enhancedSwarmRouter)
app.use('/api/workers', workerRouter)
app.use('/api/tasks', taskRouter)
app.use('/api/telemetry', telemetryRouter)
app.use('/admin/queues', serverAdapter.getRouter())

// Serve admin dashboard as static files
app.use('/dashboard', express.static(path.join(__dirname, '../dashboard-dist')))

// Serve dashboard at root with fallback to index.html for SPA routing
app.use(express.static(path.join(__dirname, '../dashboard-dist')))
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api') && !req.path.startsWith('/admin') && !req.path.startsWith('/health')) {
    res.sendFile(path.join(__dirname, '../dashboard-dist/index.html'))
  } else {
    res.status(404).json({ error: 'API endpoint not found' })
  }
})

// Error handling
app.use(errorHandler)

// Initialize Hive Mind before starting server
async function startServer() {
  try {
    // Initialize Claude Flow Hive Mind
    await initializeHiveMind()
    
    // Start server
    app.listen(PORT, () => {
      logger.info(`Swarm Manager API running on port ${PORT}`)
      logger.info('🐝 Claude Flow Hive Mind integration active')
    })
  } catch (error) {
    logger.error('Failed to start server:', error)
    process.exit(1)
  }
}

startServer()