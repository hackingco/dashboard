import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import path from 'path'
import http from 'http'
import WebSocket from 'ws'
import jwt from 'jsonwebtoken'
import { config } from 'dotenv'
import { createBullBoard } from '@bull-board/api'
import { ExpressAdapter } from '@bull-board/express'
import logger from './services/logger'
import { errorHandler } from './middleware/error'
import { rateLimiter } from './middleware/rateLimiter'
import { initializeHiveMind } from './services/claude-flow/init'
import { WebSocketService } from './services/websocket.service'
import { FlyService } from './services/fly.service'

// Routes
import swarmRouter from './routes/swarms'
import enhancedSwarmRouter, { setWebSocketService } from './routes/enhanced-swarms'
import { workerRouter } from './routes/workers'
import { taskRouter } from './routes/tasks'
import { healthRouter } from './routes/health'
import telemetryRouter from './routes/telemetry'

// Load environment variables
config()

const app = express()
const server = http.createServer(app)
const PORT = process.env.PORT || 8080
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-production'

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

// Initialize WebSocket Server with JWT authentication
const wss = new WebSocket.Server({ 
  server,
  path: '/ws',
  verifyClient: (info: any) => {
    try {
      const url = new URL(info.req.url!, `http://${info.req.headers.host}`)
      const token = url.searchParams.get('token')
      
      if (!token) {
        logger.warn('WebSocket connection rejected: No token provided')
        return false
      }
      
      jwt.verify(token, JWT_SECRET)
      return true
    } catch (error) {
      logger.warn('WebSocket connection rejected: Invalid token', { error: (error as Error).message })
      return false
    }
  }
})

const wsService = new WebSocketService(wss)
const flyService = new FlyService()

// Connect WebSocket service to enhanced-swarms router
setWebSocketService(wsService)

// WebSocket message handling
wss.on('connection', (ws, req) => {
  const url = new URL(req.url!, `http://${req.headers.host}`)
  const token = url.searchParams.get('token')
  
  try {
    const decoded = jwt.verify(token!, JWT_SECRET) as any
    logger.info('WebSocket client connected', { userId: decoded.userId || 'anonymous' })
    
    ws.send(JSON.stringify({
      type: 'connection',
      status: 'connected',
      timestamp: new Date().toISOString()
    }))
    
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString())
        logger.info('WebSocket message received', { type: message.type, action: message.action })
        
        switch (message.type) {
          case 'scale':
            await handleScaleMessage(ws, message, flyService)
            break
          case 'launch':
            await handleLaunchMessage(ws, message, flyService)
            break
          case 'status':
            await handleStatusMessage(ws, message, flyService)
            break
          default:
            ws.send(JSON.stringify({
              type: 'error',
              message: `Unknown message type: ${message.type}`,
              timestamp: new Date().toISOString()
            }))
        }
      } catch (error) {
        logger.error('WebSocket message handling error', { error })
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format',
          timestamp: new Date().toISOString()
        }))
      }
    })
    
    ws.on('close', () => {
      logger.info('WebSocket client disconnected')
    })
    
  } catch (error) {
    logger.error('WebSocket connection error', { error })
    ws.close()
  }
})

// JWT token generation endpoint for dashboard authentication
app.post('/api/auth/token', (req, res) => {
  try {
    // In production, validate user credentials here
    const { userId = 'admin' } = req.body
    const token = jwt.sign(
      { userId, role: 'admin' },
      JWT_SECRET,
      { expiresIn: '24h' }
    )
    
    res.json({ token, expiresIn: '24h' })
  } catch (error) {
    logger.error('Token generation error', { error })
    res.status(500).json({ error: 'Failed to generate token' })
  }
})

// WebSocket message handlers
async function handleScaleMessage(ws: WebSocket, message: any, flyService: FlyService) {
  try {
    const { swarmId, count } = message
    
    if (!swarmId || typeof count !== 'number') {
      throw new Error('Invalid scale parameters: swarmId and count required')
    }
    
    // Get swarm app name (you may need to fetch this from database)
    const appName = `swarm-${swarmId.slice(0, 8)}`
    
    ws.send(JSON.stringify({
      type: 'scale',
      status: 'starting',
      swarmId,
      targetCount: count,
      timestamp: new Date().toISOString()
    }))
    
    await flyService.scaleApp(appName, count)
    
    ws.send(JSON.stringify({
      type: 'scale',
      status: 'completed',
      swarmId,
      currentCount: count,
      timestamp: new Date().toISOString()
    }))
    
    // Broadcast to all connected clients
    wsService.broadcast({
      type: 'swarm_scaled',
      swarmId,
      count,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    logger.error('Scale operation failed', { error, message })
    ws.send(JSON.stringify({
      type: 'scale',
      status: 'error',
      error: (error as Error).message,
      timestamp: new Date().toISOString()
    }))
  }
}

async function handleLaunchMessage(ws: WebSocket, message: any, flyService: FlyService) {
  try {
    const { swarmConfig } = message
    
    if (!swarmConfig || !swarmConfig.name) {
      throw new Error('Invalid launch parameters: swarmConfig with name required')
    }
    
    const appName = flyService.swarmToFlyApp({ 
      id: swarmConfig.id || Date.now().toString(), 
      name: swarmConfig.name 
    } as any)
    
    ws.send(JSON.stringify({
      type: 'launch',
      status: 'starting',
      appName,
      timestamp: new Date().toISOString()
    }))
    
    // Create app if it doesn't exist
    await flyService.createApp(appName)
    
    // Deploy the swarm
    const machine = await flyService.deployApp(appName, {
      swarmId: swarmConfig.id,
      region: swarmConfig.region || 'dfw',
      cpus: swarmConfig.cpus || 1,
      memory: swarmConfig.memory || 256,
      workerType: swarmConfig.workerType || 'general'
    })
    
    ws.send(JSON.stringify({
      type: 'launch',
      status: 'completed',
      appName,
      machineId: machine.id,
      timestamp: new Date().toISOString()
    }))
    
    // Broadcast to all connected clients
    wsService.broadcast({
      type: 'swarm_launched',
      appName,
      machineId: machine.id,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    logger.error('Launch operation failed', { error, message })
    ws.send(JSON.stringify({
      type: 'launch',
      status: 'error',
      error: (error as Error).message,
      timestamp: new Date().toISOString()
    }))
  }
}

async function handleStatusMessage(ws: WebSocket, message: any, flyService: FlyService) {
  try {
    const { appName } = message
    
    if (!appName) {
      throw new Error('Invalid status parameters: appName required')
    }
    
    const status = await flyService.getAppStatus(appName)
    const machines = await flyService.listMachines(appName)
    
    ws.send(JSON.stringify({
      type: 'status',
      appName,
      status,
      machines,
      timestamp: new Date().toISOString()
    }))
    
  } catch (error) {
    logger.error('Status operation failed', { error, message })
    ws.send(JSON.stringify({
      type: 'status',
      status: 'error',
      error: (error as Error).message,
      timestamp: new Date().toISOString()
    }))
  }
}

// Initialize Hive Mind before starting server
async function startServer() {
  try {
    // Initialize Claude Flow Hive Mind
    await initializeHiveMind()
    
    // Start server with WebSocket support
    server.listen(PORT, () => {
      logger.info(`Swarm Manager API running on port ${PORT}`)
      logger.info('🐝 Claude Flow Hive Mind integration active')
      logger.info('🔌 WebSocket server active at wss://localhost:' + PORT + '/ws')
      logger.info('🔐 JWT authentication enabled for WebSocket connections')
    })
  } catch (error) {
    logger.error('Failed to start server:', error)
    process.exit(1)
  }
}

startServer()