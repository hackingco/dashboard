import { CorsOptions } from 'cors'
import logger from '../services/logger'

export interface CorsEnvironment {
  isDevelopment: boolean
  isProduction: boolean
  isPreview: boolean
  environment: 'development' | 'production' | 'preview'
}

export class CorsConfigManager {
  private static instance: CorsConfigManager
  private allowedOrigins: Set<string> = new Set()
  private patterns: RegExp[] = []
  
  private constructor() {
    this.initializeOrigins()
  }
  
  static getInstance(): CorsConfigManager {
    if (!CorsConfigManager.instance) {
      CorsConfigManager.instance = new CorsConfigManager()
    }
    return CorsConfigManager.instance
  }
  
  private detectEnvironment(): CorsEnvironment {
    const nodeEnv = process.env.NODE_ENV || 'development'
    const flyAppName = process.env.FLY_APP_NAME
    const vercelEnv = process.env.VERCEL_ENV
    
    // Auto-detect environment
    const isDevelopment = nodeEnv === 'development' || (!flyAppName && !vercelEnv)
    const isProduction = nodeEnv === 'production' || !!flyAppName
    const isPreview = vercelEnv === 'preview'
    
    return {
      isDevelopment,
      isProduction,
      isPreview,
      environment: isDevelopment ? 'development' : (isPreview ? 'preview' : 'production')
    }
  }
  
  private initializeOrigins() {
    const env = this.detectEnvironment()
    
    // Always allow localhost in development
    if (env.isDevelopment) {
      // Allow all localhost ports
      this.patterns.push(/^http:\/\/localhost:\d+$/)
      this.patterns.push(/^http:\/\/127\.0\.0\.1:\d+$/)
      this.patterns.push(/^http:\/\/\[::1\]:\d+$/)
      
      // Common development ports
      for (let port = 3000; port <= 3010; port++) {
        this.allowedOrigins.add(`http://localhost:${port}`)
      }
      this.allowedOrigins.add('http://localhost:5173') // Vite default
      this.allowedOrigins.add('http://localhost:5174') // Vite alternate
      this.allowedOrigins.add('http://localhost:8080') // Common dev server
      this.allowedOrigins.add('http://localhost:8081')
    }
    
    // Production origins from environment
    if (process.env.ALLOWED_ORIGINS) {
      process.env.ALLOWED_ORIGINS.split(',').forEach(origin => {
        this.allowedOrigins.add(origin.trim())
      })
    }
    
    // Dashboard URL from environment
    if (process.env.DASHBOARD_URL) {
      this.allowedOrigins.add(process.env.DASHBOARD_URL)
    }
    
    // Vercel preview deployments - auto-detect patterns
    this.patterns.push(/^https:\/\/admin-dashboard-[a-z0-9]+-hackingco\.vercel\.app$/)
    this.patterns.push(/^https:\/\/dist-[a-z0-9]+-hackingco\.vercel\.app$/)
    this.patterns.push(/^https:\/\/[a-z0-9-]+-hackingco\.vercel\.app$/)
    
    // GitHub Pages
    this.patterns.push(/^https:\/\/[a-z0-9-]+\.github\.io$/)
    
    // Fly.io preview apps
    this.patterns.push(/^https:\/\/[a-z0-9-]+\.fly\.dev$/)
    
    // Custom domain patterns from environment
    if (process.env.ALLOWED_ORIGIN_PATTERNS) {
      process.env.ALLOWED_ORIGIN_PATTERNS.split(',').forEach(pattern => {
        try {
          this.patterns.push(new RegExp(pattern.trim()))
        } catch (e) {
          logger.error('Invalid CORS pattern', { pattern, error: e })
        }
      })
    }
    
    logger.info('CORS configuration initialized', {
      environment: env.environment,
      allowedOrigins: Array.from(this.allowedOrigins),
      patterns: this.patterns.map(p => p.source),
      totalAllowed: this.allowedOrigins.size + this.patterns.length
    })
  }
  
  addAllowedOrigin(origin: string) {
    this.allowedOrigins.add(origin)
    logger.info('Added allowed origin', { origin })
  }
  
  addAllowedPattern(pattern: RegExp | string) {
    if (typeof pattern === 'string') {
      try {
        pattern = new RegExp(pattern)
      } catch (e) {
        logger.error('Invalid CORS pattern', { pattern, error: e })
        return
      }
    }
    this.patterns.push(pattern)
    logger.info('Added allowed pattern', { pattern: pattern.source })
  }
  
  isOriginAllowed(origin: string | undefined): boolean {
    // Allow requests with no origin (like mobile apps, Postman, or same-origin)
    if (!origin) return true
    
    // Check exact matches
    if (this.allowedOrigins.has(origin)) return true
    
    // Check patterns
    return this.patterns.some(pattern => pattern.test(origin))
  }
  
  getCorsOptions(): CorsOptions {
    const env = this.detectEnvironment()
    
    return {
      origin: (origin, callback) => {
        const allowed = this.isOriginAllowed(origin)
        
        if (allowed) {
          callback(null, true)
        } else {
          // In development, log but allow anyway
          if (env.isDevelopment) {
            logger.warn('Unknown origin in development (allowing)', { origin })
            callback(null, true)
          } else {
            logger.warn('CORS rejected origin', { origin, environment: env.environment })
            callback(new Error('Not allowed by CORS'))
          }
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
      exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
      maxAge: 86400, // 24 hours
      preflightContinue: false,
      optionsSuccessStatus: 204
    }
  }
  
  // Utility method to get all allowed origins for debugging
  getAllowedOrigins(): { exact: string[], patterns: string[] } {
    return {
      exact: Array.from(this.allowedOrigins),
      patterns: this.patterns.map(p => p.source)
    }
  }
  
  // Health check endpoint data
  getHealthCheckData() {
    const env = this.detectEnvironment()
    return {
      cors: {
        environment: env.environment,
        allowedOriginsCount: this.allowedOrigins.size,
        patternsCount: this.patterns.length,
        isDevelopment: env.isDevelopment,
        isProduction: env.isProduction,
        isPreview: env.isPreview
      }
    }
  }
}

// Export singleton instance
export const corsConfig = CorsConfigManager.getInstance()

// Export convenience function for Express
export function getCorsMiddleware() {
  return corsConfig.getCorsOptions()
}