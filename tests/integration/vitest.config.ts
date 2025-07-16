import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 60000,
    include: [
      '**/*.test.ts'
    ],
    exclude: [
      'node_modules/**',
      'dist/**',
      'build/**'
    ]
  },
  resolve: {
    alias: {
      '@': new URL('../../', import.meta.url).pathname
    }
  }
});