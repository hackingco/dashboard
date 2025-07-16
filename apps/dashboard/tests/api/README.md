# Langfuse API Integration Tests

Comprehensive test suite for validating Langfuse API integration, real-time WebSocket functionality, and fallback mechanisms.

## 🎯 Overview

This test suite validates:
- ✅ **API Connectivity** - Tests connection to Langfuse at localhost:3000
- 🔄 **Real-time WebSocket** - Tests live trace streaming and data updates
- 🛡️ **Fallback Mechanisms** - Tests mock data when API is unavailable
- ⚡ **Performance** - Tests API response times and concurrent requests
- 🔍 **Data Validation** - Tests trace and metrics data structure integrity
- 🐛 **Error Handling** - Tests graceful failure and recovery scenarios

## 📁 Test Files

### Core Test Suites
- **`langfuse-api-integration.test.ts`** - Main API integration tests
- **`langfuse-websocket.test.ts`** - WebSocket real-time functionality tests
- **`langfuse-fallback.test.ts`** - Mock data fallback and error handling tests

### Test Infrastructure
- **`langfuse-test-runner.ts`** - Comprehensive test runner with reporting
- **`vitest.config.ts`** - Vitest configuration for API tests
- **`setup.ts`** - Global test setup and mocks
- **`run-validation.ts`** - Standalone validation runner script

## 🚀 Quick Start

### Prerequisites

1. **Node.js** (v18 or higher)
2. **Langfuse Server** (optional - tests work with or without it)
   ```bash
   # If you have Langfuse running locally:
   # http://localhost:3000
   ```

### Installation

```bash
# Install dependencies
npm install

# Install test dependencies
npm install --save-dev vitest @testing-library/react @testing-library/react-hooks
```

### Running Tests

#### Run All Tests
```bash
# Run the complete test suite
npm run test:api

# Or using vitest directly
npx vitest run tests/api/

# Run with coverage
npm run test:api:coverage
```

#### Run Specific Test Suites
```bash
# API integration tests only
npx vitest run tests/api/langfuse-api-integration.test.ts

# WebSocket tests only
npx vitest run tests/api/langfuse-websocket.test.ts

# Fallback tests only
npx vitest run tests/api/langfuse-fallback.test.ts
```

#### Run Comprehensive Validation
```bash
# Run standalone validation with report generation
npm run validate:api

# Or run the validation script directly
npx tsx tests/api/run-validation.ts

# With custom options
npx tsx tests/api/run-validation.ts --output-dir ./reports --exit-on-failure
```

#### Watch Mode for Development
```bash
# Run tests in watch mode during development
npx vitest tests/api/ --watch
```

## 📊 Test Scenarios

### 1. Connection Tests
- ✅ Client initialization with various configurations
- ✅ Connection state management
- ✅ Automatic reconnection handling
- ✅ Error state recovery

### 2. API Endpoint Tests
- ✅ Fetch traces from `/api/public/traces`
- ✅ Fetch sessions from `/api/public/sessions`
- ✅ Create traces via `/api/public/ingestion`
- ✅ Calculate swarm metrics from trace data
- ✅ Handle authentication headers
- ✅ Process pagination and filtering

### 3. WebSocket Real-time Tests
- ✅ WebSocket connection establishment
- ✅ Real-time trace streaming (`trace_created`, `trace_updated`)
- ✅ Agent status updates (`agent_status`)
- ✅ Swarm metrics streaming (`swarm_metrics`)
- ✅ Heartbeat handling
- ✅ Event filtering by session/swarm ID
- ✅ Connection recovery and reconnection

### 4. Fallback and Error Handling
- ✅ Network failure scenarios
- ✅ API timeout handling
- ✅ Malformed response processing
- ✅ Mock data quality validation
- ✅ Graceful degradation
- ✅ Performance during fallback

### 5. Performance Tests
- ✅ API response time validation
- ✅ Concurrent request handling
- ✅ Large dataset processing
- ✅ Memory usage monitoring
- ✅ WebSocket message burst handling

### 6. Data Validation Tests
- ✅ Trace data structure integrity
- ✅ Metrics calculation accuracy
- ✅ Type safety validation
- ✅ Required field presence
- ✅ Logical relationship validation

## 🛠️ Configuration

### Environment Variables
```bash
# Langfuse API configuration
NEXT_PUBLIC_LANGFUSE_HOST=http://localhost:3000
NEXT_PUBLIC_LANGFUSE_WS=ws://localhost:3000/ws
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...

# Test environment
NODE_ENV=test
VITEST=true
```

### Test Configuration (vitest.config.ts)
```typescript
{
  testTimeout: 30000,      // 30 seconds for API tests
  retry: 2,                // Retry failed tests for network issues
  maxConcurrency: 5,       // Limit concurrent tests
  coverage: {
    thresholds: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
}
```

## 📈 Test Reports

### Automated Reports
When running `npm run validate:api`, the following reports are generated:

1. **JSON Report** - Machine-readable test results
   ```
   tests/api/results/langfuse-api-validation-YYYY-MM-DD-HH-MM-SS.json
   ```

2. **HTML Report** - Human-readable dashboard
   ```
   tests/api/results/langfuse-api-validation-YYYY-MM-DD-HH-MM-SS.html
   ```

3. **Coverage Report** - Code coverage analysis
   ```
   tests/api/coverage/index.html
   ```

### Report Contents
- 🌐 **API Availability Status** - Whether Langfuse is reachable
- 🔄 **WebSocket Support** - Real-time capability status
- 📊 **Test Results** - Pass/fail status for all test suites
- ⚡ **Performance Metrics** - Response times and throughput
- 🎯 **API Coverage** - Percentage of API endpoints tested
- 💡 **Recommendations** - Actionable insights for improvements

## 🔧 Troubleshooting

### Common Issues

#### 1. Langfuse Server Not Available
```
Error: Langfuse API not available at localhost:3000
```
**Solution**: Tests will automatically fall back to mock data. This is expected behavior when Langfuse server is not running.

#### 2. WebSocket Connection Failures
```
Warning: WebSocket connection failed, continuing without real-time updates
```
**Solution**: Tests will continue with polling-based updates. Ensure WebSocket endpoint is accessible.

#### 3. Network Timeout Issues
```
Error: Request timeout after 5000ms
```
**Solution**: Increase timeout in test configuration or check network connectivity.

#### 4. Port Conflicts
```
Error: EADDRINUSE - Port 3000 already in use
```
**Solution**: Either stop the conflicting service or update the test configuration to use a different port.

### Debug Mode

Run tests with debug output:
```bash
# Enable verbose logging
DEBUG=langfuse:* npm run test:api

# Run with detailed error messages
npx vitest run tests/api/ --reporter=verbose

# Run single test with debugging
npx vitest run tests/api/langfuse-api-integration.test.ts --reporter=verbose
```

### Mock Data Verification

To verify mock data is working correctly:
```bash
# Run fallback tests specifically
npx vitest run tests/api/langfuse-fallback.test.ts

# Test with network simulation
SIMULATE_OFFLINE=true npm run test:api
```

## 🧪 Test Development

### Adding New Tests

1. **Create test file** in `tests/api/`
2. **Import test utilities** from `setup.ts`
3. **Use provided mocks** for consistent behavior
4. **Follow naming convention**: `*.test.ts`

### Example Test Structure
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { LangfuseRealtimeClient } from '../../lib/langfuse-client';
import { testUtils } from './setup';

describe('My New Test Suite', () => {
  let client: LangfuseRealtimeClient;

  beforeEach(() => {
    client = new LangfuseRealtimeClient({
      baseUrl: 'http://localhost:3000',
      enableRealtime: false,
    });
  });

  it('should test specific functionality', async () => {
    // Test implementation
    const result = await client.getTraces();
    expect(result).toBeDefined();
  });
});
```

### Mock Customization

Customize mocks for specific test scenarios:
```typescript
import { testUtils } from './setup';

// Simulate network conditions
const cleanup = testUtils.simulateNetworkCondition('slow');

// Your test code here

// Cleanup
cleanup();
```

## 📋 Package.json Scripts

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "test:api": "vitest run tests/api/",
    "test:api:watch": "vitest tests/api/ --watch",
    "test:api:coverage": "vitest run tests/api/ --coverage",
    "validate:api": "tsx tests/api/run-validation.ts",
    "validate:api:ci": "tsx tests/api/run-validation.ts --exit-on-failure --no-report"
  }
}
```

## 🤝 Contributing

### Test Guidelines

1. **Write descriptive test names** that explain what is being tested
2. **Use proper setup/teardown** to ensure test isolation
3. **Test both success and failure scenarios**
4. **Include performance assertions** where appropriate
5. **Document complex test logic** with comments
6. **Ensure tests are deterministic** and don't rely on external state

### Code Coverage Goals

Maintain high test coverage for:
- ✅ API client functions (>90%)
- ✅ Error handling paths (>85%)
- ✅ WebSocket event handlers (>80%)
- ✅ Data validation logic (>95%)

## 📞 Support

For issues with the test suite:

1. **Check the logs** in test output for specific error messages
2. **Review the generated reports** for detailed failure information
3. **Run individual test files** to isolate issues
4. **Check network connectivity** to Langfuse endpoints
5. **Verify environment variables** are set correctly

## 🔄 Continuous Integration

For CI/CD pipelines:

```yaml
# GitHub Actions example
- name: Run Langfuse API Tests
  run: npm run validate:api:ci
  env:
    LANGFUSE_PUBLIC_KEY: ${{ secrets.LANGFUSE_PUBLIC_KEY }}
    LANGFUSE_SECRET_KEY: ${{ secrets.LANGFUSE_SECRET_KEY }}
```

The test suite is designed to work reliably in CI environments with automatic fallback to mock data when external services are unavailable.