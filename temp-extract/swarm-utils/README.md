# @swarm-orchestration/utils

> Common utility functions for the Swarm Orchestration Platform

## Overview

The `@swarm-orchestration/utils` package provides a collection of utility functions commonly used across the Swarm Orchestration Platform. These utilities are designed to be lightweight, efficient, and type-safe.

## Features

- **ID Generation** - Unique identifier generation
- **Async Utilities** - Delay, retry, and async helpers
- **Array Utilities** - Chunk arrays and batch processing
- **Error Handling** - Retry with exponential backoff
- **Type Safety** - Full TypeScript support
- **Zero Dependencies** - Only depends on types package

## Installation

```bash
npm install @swarm-orchestration/utils
```

## Usage

### ID Generation

Generate unique identifiers for various entities:

```typescript
import { generateId } from '@swarm-orchestration/utils';

const swarmId = generateId();
console.log(swarmId); // "1705123456789-a1b2c3d4e"

// Use for creating unique identifiers
const taskId = generateId();
const workerId = generateId();
const sessionId = generateId();
```

### Delay Function

Add delays in async operations:

```typescript
import { delay } from '@swarm-orchestration/utils';

async function processWithDelay() {
  console.log('Starting...');
  await delay(1000); // Wait 1 second
  console.log('Continuing after delay');
}

// Useful for rate limiting
async function rateLimitedRequests(urls: string[]) {
  for (const url of urls) {
    await fetch(url);
    await delay(100); // 100ms between requests
  }
}
```

### Array Chunking

Split large arrays into manageable chunks:

```typescript
import { chunk } from '@swarm-orchestration/utils';

const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const chunks = chunk(items, 3);
console.log(chunks); // [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10]]

// Process large datasets in batches
async function processBatches(records: any[]) {
  const batches = chunk(records, 100);
  
  for (const batch of batches) {
    await processRecordBatch(batch);
    await delay(500); // Pause between batches
  }
}
```

### Retry with Exponential Backoff

Retry failed operations with intelligent backoff:

```typescript
import { retry } from '@swarm-orchestration/utils';

// Basic retry
const result = await retry(
  () => fetch('https://api.example.com/data').then(r => r.json())
);

// Custom retry configuration
const data = await retry(
  async () => {
    const response = await fetch('https://api.example.com/resource');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  },
  5,     // Max 5 retries
  2000   // Start with 2 second delay
);

// Retry with logging
const retryWithLogging = async () => {
  let attempt = 0;
  return retry(
    async () => {
      attempt++;
      console.log(`Attempt ${attempt}...`);
      return riskyOperation();
    },
    3,
    1000
  );
};
```

## API Reference

### `generateId(): string`

Generates a unique identifier combining timestamp and random string.

**Returns:** A string in format `{timestamp}-{random}`

**Example:**
```typescript
const id = generateId(); // "1705123456789-a1b2c3d4e"
```

### `delay(ms: number): Promise<void>`

Creates a promise that resolves after specified milliseconds.

**Parameters:**
- `ms` - Number of milliseconds to delay

**Returns:** Promise that resolves after the delay

**Example:**
```typescript
await delay(1000); // Wait 1 second
```

### `chunk<T>(array: T[], size: number): T[][]`

Splits an array into chunks of specified size.

**Parameters:**
- `array` - Array to split
- `size` - Maximum size of each chunk

**Returns:** Array of arrays (chunks)

**Example:**
```typescript
const chunks = chunk([1,2,3,4,5], 2); // [[1,2], [3,4], [5]]
```

### `retry<T>(fn: () => Promise<T>, retries?: number, delayMs?: number): Promise<T>`

Retries a promise-returning function with exponential backoff.

**Parameters:**
- `fn` - Function that returns a promise
- `retries` - Maximum retry attempts (default: 3)
- `delayMs` - Initial delay in milliseconds (default: 1000)

**Returns:** Promise resolving to function result

**Example:**
```typescript
const result = await retry(() => unreliableApiCall(), 5, 2000);
```

## Common Patterns

### Batch Processing

```typescript
import { chunk, delay } from '@swarm-orchestration/utils';

async function batchProcess<T>(
  items: T[],
  processor: (batch: T[]) => Promise<void>,
  batchSize = 50,
  delayMs = 100
) {
  const batches = chunk(items, batchSize);
  
  for (const batch of batches) {
    await processor(batch);
    await delay(delayMs);
  }
}
```

### Resilient API Calls

```typescript
import { retry, delay } from '@swarm-orchestration/utils';

async function resilientApiCall(url: string) {
  return retry(
    async () => {
      const response = await fetch(url);
      
      // Retry on 5xx errors
      if (response.status >= 500) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      // Don't retry on 4xx errors
      if (!response.ok) {
        throw new Error(`Client error: ${response.status}`);
      }
      
      return response.json();
    },
    3,
    2000
  );
}
```

### ID-based Entity Creation

```typescript
import { generateId } from '@swarm-orchestration/utils';
import type { Task, Worker } from '@swarm-orchestration/types';

function createTask(data: Partial<Task>): Task {
  return {
    id: generateId(),
    createdAt: new Date().toISOString(),
    status: 'pending',
    retries: 0,
    priority: 0,
    ...data
  } as Task;
}

function createWorker(swarmId: string): Worker {
  return {
    id: generateId(),
    swarmId,
    state: 'created',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    // ... other required fields
  } as Worker;
}
```

## Testing

The package includes comprehensive tests:

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suites
npm run test:unit
npm run test:integration
```

## Contributing

When adding new utilities:

1. Add the function to `src/index.ts`
2. Include comprehensive TypeScript types
3. Add unit tests in `tests/`
4. Update this README with examples
5. Ensure the utility is generic and reusable

## License

MIT