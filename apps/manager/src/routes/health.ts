import { Router } from 'express'
import { createClient } from '@supabase/supabase-js'
import { logger } from '../lib/logger'

export const healthRouter = Router()

healthRouter.get('/', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version,
  }

  res.json(health)
})

healthRouter.get('/ready', async (req, res) => {
  try {
    // Check database connection
    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY
      )
      
      const { error } = await supabase.from('swarms').select('count').limit(1)
      if (error) throw error
    }

    res.json({ ready: true })
  } catch (error) {
    logger.error('Readiness check failed:', error)
    res.status(503).json({ ready: false })
  }
})