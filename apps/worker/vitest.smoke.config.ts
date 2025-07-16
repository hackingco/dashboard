import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'worker-smoke',
    environment: 'node',
    include: ['tests/smoke/**/*.test.ts'],
    globals: true,
    reporter: ['verbose'],
    timeout: 30000, // Longer timeout for smoke tests
    hookTimeout: 10000,
    testTimeout: 30000,
    env: {
      REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/test_db'
    }
  }
})