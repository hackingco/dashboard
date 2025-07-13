import { z } from 'zod';

/**
 * Environment-specific configuration schema with validation
 */
const ConfigSchema = z.object({
  // Fly.io Configuration
  flyAccessToken: z.string().min(1, 'FLY_ACCESS_TOKEN is required'),
  flyApiUrl: z.string().url().default('https://api.machines.dev/v1'),
  
  // Supabase Configuration
  supabaseUrl: z.string().url('Invalid SUPABASE_URL'),
  supabaseKey: z.string().min(1, 'SUPABASE_ANON_KEY is required'),
  
  // Database Configuration
  databaseUrl: z.string().optional(),
  redisUrl: z.string().url().optional(),
  
  // Observability Configuration
  langfuseHost: z.string().url().optional(),
  langfusePublicKey: z.string().optional(),
  langfuseSecretKey: z.string().optional(),
  
  // Application Configuration
  port: z.number().int().min(1).max(65535).default(3000),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  
  // Security Configuration
  jwtSecret: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  corsOrigins: z.string().transform(str => str.split(',').map(s => s.trim())).default('*'),
  
  // Performance Configuration
  maxConnections: z.number().int().positive().default(1000),
  requestTimeout: z.number().int().positive().default(30000),
  
  // Feature Flags
  enableMetrics: z.boolean().default(true),
  enableTracing: z.boolean().default(true),
  enableRealtime: z.boolean().default(true),
});

export type Configuration = z.infer<typeof ConfigSchema>;

/**
 * Centralized configuration service with validation and type safety
 */
export class ConfigurationService {
  private static instance: ConfigurationService;
  private config: Configuration;

  private constructor() {
    this.config = ConfigSchema.parse({
      // Fly.io
      flyAccessToken: process.env.FLY_ACCESS_TOKEN || process.env.FLY_API_TOKEN,
      flyApiUrl: process.env.FLY_API_URL,
      
      // Supabase
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseKey: process.env.SUPABASE_ANON_KEY,
      
      // Database
      databaseUrl: process.env.DATABASE_URL,
      redisUrl: process.env.REDIS_URL,
      
      // Observability
      langfuseHost: process.env.LANGFUSE_HOST,
      langfusePublicKey: process.env.LANGFUSE_PUBLIC_KEY,
      langfuseSecretKey: process.env.LANGFUSE_SECRET_KEY,
      
      // Application
      port: process.env.PORT ? parseInt(process.env.PORT) : undefined,
      logLevel: process.env.LOG_LEVEL,
      nodeEnv: process.env.NODE_ENV,
      
      // Security
      jwtSecret: process.env.JWT_SECRET,
      corsOrigins: process.env.CORS_ORIGINS,
      
      // Performance
      maxConnections: process.env.MAX_CONNECTIONS ? parseInt(process.env.MAX_CONNECTIONS) : undefined,
      requestTimeout: process.env.REQUEST_TIMEOUT ? parseInt(process.env.REQUEST_TIMEOUT) : undefined,
      
      // Feature Flags
      enableMetrics: process.env.ENABLE_METRICS !== 'false',
      enableTracing: process.env.ENABLE_TRACING !== 'false',
      enableRealtime: process.env.ENABLE_REALTIME !== 'false',
    });
  }

  static getInstance(): ConfigurationService {
    if (!this.instance) {
      this.instance = new ConfigurationService();
    }
    return this.instance;
  }

  // Typed configuration getters
  get fly() {
    return {
      accessToken: this.config.flyAccessToken,
      apiUrl: this.config.flyApiUrl,
    };
  }

  get supabase() {
    return {
      url: this.config.supabaseUrl,
      key: this.config.supabaseKey,
    };
  }

  get database() {
    return {
      url: this.config.databaseUrl,
      redis: this.config.redisUrl,
    };
  }

  get observability() {
    return {
      langfuse: {
        host: this.config.langfuseHost,
        publicKey: this.config.langfusePublicKey,
        secretKey: this.config.langfuseSecretKey,
      },
      enableMetrics: this.config.enableMetrics,
      enableTracing: this.config.enableTracing,
    };
  }

  get application() {
    return {
      port: this.config.port,
      logLevel: this.config.logLevel,
      nodeEnv: this.config.nodeEnv,
      enableRealtime: this.config.enableRealtime,
    };
  }

  get security() {
    return {
      jwtSecret: this.config.jwtSecret,
      corsOrigins: this.config.corsOrigins,
    };
  }

  get performance() {
    return {
      maxConnections: this.config.maxConnections,
      requestTimeout: this.config.requestTimeout,
    };
  }

  // Validation helpers
  get isProduction(): boolean {
    return this.config.nodeEnv === 'production';
  }

  get isDevelopment(): boolean {
    return this.config.nodeEnv === 'development';
  }

  get isTest(): boolean {
    return this.config.nodeEnv === 'test';
  }

  // Configuration validation
  static validate(): void {
    try {
      ConfigurationService.getInstance();
    } catch (error) {
      console.error('Configuration validation failed:', error);
      process.exit(1);
    }
  }

  // Get all configuration (for debugging - exclude secrets in production)
  getAll(includeSensitive = false): Partial<Configuration> {
    if (includeSensitive || !this.isProduction) {
      return { ...this.config };
    }
    
    // Production: exclude sensitive values
    const { flyAccessToken, jwtSecret, langfuseSecretKey, ...safeConfig } = this.config;
    return {
      ...safeConfig,
      flyAccessToken: '***',
      jwtSecret: '***',
      langfuseSecretKey: '***',
    };
  }
}

// Export singleton instance
export const config = ConfigurationService.getInstance();

// Export for testing
export const createConfigForTesting = (overrides: Partial<Configuration>): Configuration => {
  return ConfigSchema.parse({
    ...config.getAll(true),
    ...overrides,
  });
};