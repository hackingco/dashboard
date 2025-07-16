/**
 * Vitest Configuration for Langfuse API Integration Tests
 */

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    name: 'langfuse-api-integration',
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/api/setup.ts'],
    testTimeout: 30000, // 30 seconds for API tests
    hookTimeout: 10000, // 10 seconds for setup/teardown
    teardownTimeout: 5000,
    maxConcurrency: 5, // Limit concurrent tests for API stability
    retry: 2, // Retry failed tests due to network issues
    reporter: ['verbose', 'json'],
    outputFile: './tests/api/results/langfuse-api-test-results.json',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './tests/api/coverage',
      include: ['lib/**/*.ts'],
      exclude: [
        'node_modules/**',
        'tests/**',
        '**/*.d.ts',
        '**/*.config.ts',
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../../'),
      '~': path.resolve(__dirname, '../../'),
    },
  },
  define: {
    'process.env.NODE_ENV': '"test"',
    'process.env.VITEST': 'true',
  },
});