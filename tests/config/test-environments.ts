/**
 * Test Environment Configurations
 * Defines different test environments for multi-service testing
 */

export interface TestEnvironment {
  name: string;
  services: {
    dashboard: string;
    manager: string;
    worker?: string;
    redis: string;
    database: string;
  };
  flyConfig?: {
    apiToken: string;
    appName: string;
    region: string;
  };
  supabaseConfig?: {
    url: string;
    anonKey: string;
    serviceKey?: string;
  };
}

export const testEnvironments: Record<string, TestEnvironment> = {
  local: {
    name: 'local',
    services: {
      dashboard: 'http://localhost:3000',
      manager: 'http://localhost:3001',
      worker: 'http://localhost:3002',
      redis: 'redis://localhost:6379',
      database: 'sqlite:///tmp/test.db'
    }
  },
  
  integration: {
    name: 'integration',
    services: {
      dashboard: 'http://localhost:3000',
      manager: 'http://localhost:3001',
      worker: 'http://localhost:3002',
      redis: 'redis://localhost:6379',
      database: 'postgresql://postgres:postgres@localhost:5432/swarm_test'
    },
    supabaseConfig: {
      url: process.env.TEST_SUPABASE_URL || 'http://localhost:54321',
      anonKey: process.env.TEST_SUPABASE_ANON_KEY || 'test-anon-key',
      serviceKey: process.env.TEST_SUPABASE_SERVICE_KEY
    }
  },
  
  staging: {
    name: 'staging',
    services: {
      dashboard: 'https://swarm-admin-staging.fly.dev',
      manager: 'https://swarm-manager-staging.fly.dev',
      redis: 'redis://swarm-redis-staging.internal:6379',
      database: 'postgresql://staging-db-url'
    },
    flyConfig: {
      apiToken: process.env.FLY_API_TOKEN_STAGING!,
      appName: 'swarm-staging',
      region: 'iad'
    },
    supabaseConfig: {
      url: process.env.STAGING_SUPABASE_URL!,
      anonKey: process.env.STAGING_SUPABASE_ANON_KEY!
    }
  },
  
  production: {
    name: 'production',
    services: {
      dashboard: 'https://swarm-admin.fly.dev',
      manager: 'https://swarm-manager.fly.dev',
      redis: 'redis://swarm-redis.internal:6379',
      database: 'postgresql://prod-db-url'
    },
    flyConfig: {
      apiToken: process.env.FLY_API_TOKEN!,
      appName: 'swarm-production',
      region: 'iad'
    },
    supabaseConfig: {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    }
  }
};

export function getTestEnvironment(envName?: string): TestEnvironment {
  const env = envName || process.env.TEST_ENV || 'local';
  const config = testEnvironments[env];
  
  if (!config) {
    throw new Error(`Unknown test environment: ${env}`);
  }
  
  return config;
}

export function validateEnvironment(env: TestEnvironment): string[] {
  const errors: string[] = [];
  
  // Check required services
  if (!env.services.dashboard) errors.push('Dashboard URL is required');
  if (!env.services.manager) errors.push('Manager URL is required');
  if (!env.services.redis) errors.push('Redis URL is required');
  if (!env.services.database) errors.push('Database URL is required');
  
  // Check Fly.io config for non-local environments
  if (env.name !== 'local' && !env.flyConfig?.apiToken) {
    errors.push('Fly.io API token is required for non-local environments');
  }
  
  // Check Supabase config if specified
  if (env.supabaseConfig) {
    if (!env.supabaseConfig.url) errors.push('Supabase URL is required');
    if (!env.supabaseConfig.anonKey) errors.push('Supabase anon key is required');
  }
  
  return errors;
}