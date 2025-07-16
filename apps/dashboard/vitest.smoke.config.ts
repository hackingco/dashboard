import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'dashboard-smoke',
    environment: 'node',
    include: ['tests/smoke/**/*.test.ts'],
    globals: true,
    reporter: ['verbose'],
    timeout: 30000, // Longer timeout for smoke tests
    hookTimeout: 10000,
    testTimeout: 30000,
    env: {
      TEST_BASE_URL: process.env.TEST_BASE_URL || 'http://localhost:3000',
      TEST_API_URL: process.env.TEST_API_URL || 'http://localhost:3001'
    }
  }
})