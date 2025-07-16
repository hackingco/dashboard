# API Key Management Test Suite

Comprehensive test suite for the Langfuse API Key Management system.

## Test Structure

```
test/
├── unit/                 # Unit tests for individual components
│   ├── LangfuseKeyValidator.test.js
│   ├── LangfuseApiKeyManager.test.js
│   └── AutomatedKeyTester.test.js
├── integration/          # Integration tests for system workflows
│   ├── KeyLifecycle.test.js
│   ├── FailoverScenarios.test.js
│   └── PerformanceUnderLoad.test.js
├── e2e/                  # End-to-end tests
│   ├── CliCommands.test.js
│   └── WebDashboard.test.js
├── fixtures/             # Test data and mocks
├── utils/                # Test utilities and helpers
│   ├── setup.js
│   └── mockLangfuseClient.js
├── jest.config.js        # Jest configuration
└── package.json          # Test dependencies

```

## Running Tests

### All Tests
```bash
npm test
```

### Unit Tests Only
```bash
npm run test:unit
```

### Integration Tests Only
```bash
npm run test:integration
```

### E2E Tests Only
```bash
npm run test:e2e
```

### Watch Mode
```bash
npm run test:watch
```

### Coverage Report
```bash
npm run test:coverage
```

## Test Coverage Goals

- **Overall**: 80%+ coverage
- **Unit Tests**: 90%+ coverage for core logic
- **Integration Tests**: Cover all critical paths
- **E2E Tests**: Cover all user workflows

## Key Test Scenarios

### Unit Tests
- Key format validation
- Security validation
- Entropy calculations
- Key generation
- Key rotation logic
- Event emissions
- Error handling

### Integration Tests
- Complete key lifecycle
- Multi-key management
- Failover scenarios
- Performance under load
- Concurrent operations
- Health monitoring
- Recovery mechanisms

### E2E Tests
- CLI command execution
- Web dashboard interactions
- Real-time monitoring
- Import/export functionality
- Responsive design
- Accessibility

## Performance Benchmarks

The test suite includes performance tests that verify:
- 1000+ operations per second
- < 10ms P50 latency
- < 100ms P99 latency
- < 20% memory growth
- 95%+ success rate under load

## Mock Configuration

Tests use mocked Langfuse clients to avoid external dependencies:
- `mockLangfuseClient.js` - Simulates Langfuse SDK
- Configurable error injection
- Performance simulation
- State tracking

## CI/CD Integration

```yaml
# Example GitHub Actions configuration
- name: Run Tests
  run: |
    npm install
    npm run test:ci
```

## Debugging Tests

### Debug Single Test
```bash
npm run test:debug -- --testNamePattern="should validate keys"
```

### Verbose Output
```bash
npm test -- --verbose
```

### Test Specific File
```bash
npm test -- LangfuseKeyValidator.test.js
```

## Writing New Tests

### Test Template
```javascript
describe('Component Name', () => {
  let component;
  
  beforeEach(() => {
    // Setup
  });
  
  afterEach(() => {
    // Cleanup
  });
  
  describe('Feature', () => {
    test('should do something', async () => {
      // Arrange
      const input = 'test';
      
      // Act
      const result = await component.method(input);
      
      // Assert
      expect(result).toBe(expected);
    });
  });
});
```

### Best Practices
1. Use descriptive test names
2. Follow AAA pattern (Arrange, Act, Assert)
3. Mock external dependencies
4. Test edge cases
5. Keep tests focused and isolated
6. Use beforeEach/afterEach for setup/cleanup
7. Verify both success and failure paths

## Troubleshooting

### Tests Timing Out
- Increase Jest timeout: `jest.setTimeout(30000)`
- Check for unresolved promises
- Verify mock implementations

### Flaky Tests
- Use `waitFor` utilities for async operations
- Avoid hardcoded timeouts
- Ensure proper cleanup between tests

### Memory Issues
- Run tests with `--runInBand` flag
- Check for memory leaks in beforeEach/afterEach
- Use `--detectOpenHandles` to find issues