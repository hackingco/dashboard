import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'manager-smoke',
    environment: 'node',
    include: ['tests/smoke/**/*.test.ts'],
    globals: true,
    reporter: ['verbose'],
    timeout: 30000, // Longer timeout for smoke tests
    hookTimeout: 10000,
    testTimeout: 30000,
    env: {
      TEST_API_URL: process.env.TEST_API_URL || 'http://localhost:3001',
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/test_db'
    }
  }
})