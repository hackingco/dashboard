# Langfuse Wrapper Testing Environment

This document describes the simplified Docker test environment for comprehensive Langfuse wrapper testing.

## Overview

The test environment provides a lightweight, containerized setup for testing the Langfuse wrapper in both connected and fallback modes. It includes:

- **Langfuse Server**: Full Langfuse instance with PostgreSQL
- **Test Container**: Node.js environment with the wrapper and comprehensive test suite
- **Automated Testing**: Scripts for running different test scenarios
- **Environment Variables**: Configuration for enabling/disabling Langfuse connection

## Files Created

### 1. `docker-compose.langfuse-test.yml`
Lightweight Docker Compose stack with:
- PostgreSQL database for Langfuse
- Langfuse server instance
- Test container with wrapper
- Network configuration
- Volume management

### 2. `Dockerfile.langfuse-test`
Simple Node.js container that:
- Uses Alpine Linux for smaller size
- Installs wrapper dependencies safely
- Builds TypeScript code
- Runs comprehensive test suite

### 3. `shared/langfuse-wrapper/test-runner.js`
Comprehensive test script that:
- Tests wrapper initialization
- Validates hook functionality (pre, post, error)
- Tests span management
- Validates metadata enrichment
- Tests coordination memory
- Validates graceful degradation
- Generates detailed reports

### 4. `scripts/test-langfuse-wrapper.sh`
Test orchestration script with commands:
- `full`: Complete test suite with Langfuse
- `fallback`: Tests with Langfuse disabled
- `unit`: Unit tests only
- `build`: Build test environment
- `clean`: Cleanup resources
- `logs`: View test logs
- `status`: Check service health

## Quick Start

### 1. Run Full Test Suite
```bash
# From project root
./scripts/test-langfuse-wrapper.sh full
```

### 2. Test Fallback Mode
```bash
# Test graceful degradation when Langfuse is unavailable
./scripts/test-langfuse-wrapper.sh fallback
```

### 3. Run Unit Tests Only
```bash
./scripts/test-langfuse-wrapper.sh unit
```

### 4. Clean Up
```bash
./scripts/test-langfuse-wrapper.sh clean
```

## Environment Variables

### Langfuse Configuration
- `LANGFUSE_PUBLIC_KEY`: Public API key (test value provided)
- `LANGFUSE_SECRET_KEY`: Secret API key (test value provided)
- `LANGFUSE_HOST`: Langfuse server URL
- `LANGFUSE_ENABLED`: Enable/disable Langfuse connection

### Test Configuration
- `SWARM_ID`: Identifier for swarm coordination
- `AGENT_ID`: Unique agent identifier
- `AGENT_ROLE`: Agent role for testing
- `TEST_MODE`: Enable test-specific behavior
- `FALLBACK_MODE`: Test graceful degradation

### Feature Flags
- `LANGFUSE_FEATURE_AUTO_TRACING`: Enable automatic tracing
- `LANGFUSE_FEATURE_SPAN_ENRICHMENT`: Enable span metadata enrichment
- `LANGFUSE_FEATURE_TOKEN_TRACKING`: Enable token usage tracking
- `LANGFUSE_FEATURE_MEMORY_COORDINATION`: Enable memory coordination
- `LANGFUSE_FEATURE_HOOK_INTERCEPTION`: Enable hook interception
- `LANGFUSE_FEATURE_PERFORMANCE_MONITORING`: Enable performance monitoring

## Test Scenarios

### Connected Mode (Langfuse Enabled)
Tests the wrapper when Langfuse is available:
- ✅ Wrapper initialization with valid config
- ✅ Trace creation and management
- ✅ Span creation and lifecycle
- ✅ Metadata enrichment with swarm context
- ✅ Token usage tracking
- ✅ Error handling and recording
- ✅ Memory coordination via SQLite
- ✅ Performance monitoring

### Fallback Mode (Langfuse Disabled)
Tests graceful degradation when Langfuse is unavailable:
- ✅ Wrapper initialization without errors
- ✅ Hook methods return null gracefully
- ✅ No errors thrown when Langfuse unavailable
- ✅ Memory coordination still works
- ✅ All operations complete successfully
- ✅ Proper logging of fallback behavior

### Error Scenarios
Tests wrapper behavior under error conditions:
- ✅ Invalid Langfuse credentials
- ✅ Network connectivity issues
- ✅ Malformed requests
- ✅ Database connection failures
- ✅ Memory corruption scenarios

## Test Output

### Test Results Location
Results are saved to `/app/test-results/` in the container and copied to `./test-results/` on the host:

- `langfuse-wrapper-test-report.json`: Detailed JSON report
- `test-summary.txt`: Human-readable summary

### Sample Test Summary
```
Langfuse Wrapper Test Summary
============================
Timestamp: 2025-07-13T09:15:00.000Z
Environment: test
Langfuse Enabled: true
Fallback Mode: false

Test Results:
- Total Tests: 8
- Passed: 8
- Failed: 0
- Success Rate: 100%
- Duration: 2345ms

Conclusion: All tests passed - wrapper ready for production

Failed Tests:
None
```

## Manual Testing

### 1. Build and Start Environment
```bash
# Build the test environment
./scripts/test-langfuse-wrapper.sh build

# Start services manually
docker-compose -f docker-compose.langfuse-test.yml up -d postgres langfuse-server
```

### 2. Check Service Health
```bash
# Check status
./scripts/test-langfuse-wrapper.sh status

# View logs
./scripts/test-langfuse-wrapper.sh logs
```

### 3. Access Services
- **Langfuse UI**: http://localhost:3000
- **PostgreSQL**: localhost:5432
  - User: `langfuse`
  - Password: `langfuse_test`
  - Database: `langfuse`

### 4. Run Interactive Tests
```bash
# Enter the test container
docker-compose -f docker-compose.langfuse-test.yml run --rm langfuse-wrapper-test bash

# Run individual test components
npm run test:unit
npm run build
node test-runner.js
```

## Integration with CI/CD

### GitHub Actions Integration
Add to your CI pipeline:

```yaml
- name: Test Langfuse Wrapper
  run: |
    ./scripts/test-langfuse-wrapper.sh full
    ./scripts/test-langfuse-wrapper.sh fallback
```

### Test Reports in CI
The test runner generates both JSON and text reports that can be:
- Uploaded as CI artifacts
- Parsed for test result summaries
- Used for coverage reporting
- Integrated with monitoring systems

## Troubleshooting

### Common Issues

1. **Package lock issues**
   - Fixed by using `npm install --no-package-lock`
   - Dockerfile handles fallback installation

2. **Langfuse connection timeout**
   - Test runner waits up to 60 seconds for Langfuse
   - Gracefully falls back to degraded mode testing

3. **SQLite memory coordination**
   - Creates `.swarm` directory automatically
   - Tests basic SQLite operations

4. **Docker build failures**
   - Use `--no-cache` flag to rebuild from scratch
   - Check Docker daemon is running

### Debug Mode
```bash
# Run with verbose output
./scripts/test-langfuse-wrapper.sh -v full

# Check individual service logs
docker-compose -f docker-compose.langfuse-test.yml logs langfuse-server
docker-compose -f docker-compose.langfuse-test.yml logs postgres
```

## Key Improvements Made

1. **Fixed package-lock.json issues**: Uses `npm install` instead of `npm ci`
2. **Environment variables**: Comprehensive configuration for testing
3. **Graceful degradation**: Tests both connected and fallback modes
4. **Comprehensive test runner**: Custom Node.js script for thorough testing
5. **Automated scripts**: Shell scripts for easy test orchestration
6. **Lightweight setup**: Minimal Docker images and services
7. **Results collection**: Automated collection of test reports
8. **Health checks**: Proper service health monitoring

## Next Steps

This test environment provides a solid foundation for:
- **Continuous Integration**: Automated testing in CI/CD pipelines
- **Development**: Local testing during wrapper development
- **Validation**: Comprehensive validation before deployment
- **Monitoring**: Performance and reliability testing

The environment can be extended with additional test scenarios, monitoring tools, or integration with other systems as needed.