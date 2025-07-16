import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    name: 'dashboard-integration',
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/integration/**/*.test.ts'],
    globals: true,
    reporter: ['verbose', 'json'],
    outputFile: {
      json: './test-results/integration-results.json'
    },
    coverage: {
      reporter: ['text', 'lcov', 'html'],
      exclude: [
        'node_modules/**',
        'tests/**',
        'coverage/**',
        '**/*.d.ts',
        '**/*.config.ts'
      ]
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './app'),
      '@/components': path.resolve(__dirname, './components'),
      '@/lib': path.resolve(__dirname, './lib')
    }
  }
})