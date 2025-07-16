# 🔐 Langfuse API Key Management System

A comprehensive, production-ready API key management system for Langfuse with advanced validation, testing, and monitoring capabilities.

## 🚀 Features

- **Real-time Key Extraction**: Automatically extracts API keys from Langfuse UI
- **Comprehensive Validation**: Multi-stage validation pipeline with detailed reporting
- **Automated Testing**: Stress testing, endurance testing, and continuous monitoring
- **Health Monitoring**: Real-time health checks and alerting
- **Seamless Integration**: Drop-in replacement for existing Langfuse workflows
- **Failure Recovery**: Automatic failover and key rotation mechanisms
- **CLI Interface**: Full-featured command-line interface for management
- **Security**: Secure key storage with encryption and access controls

## 📋 Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [CLI Usage](#cli-usage)
- [API Usage](#api-usage)
- [Configuration](#configuration)
- [Testing](#testing)
- [Monitoring](#monitoring)
- [Integration](#integration)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

## 🛠️ Installation

### Prerequisites

- Node.js 16.0.0 or higher
- Running Langfuse instance (localhost:3000 by default)
- Access to Langfuse UI for key extraction

### Install Dependencies

```bash
npm install
```

### Global Installation (Optional)

```bash
npm install -g .
```

## 🚀 Quick Start

### 1. Automatic Setup

```bash
# Automatic setup with default settings
node api-key-cli.js setup --auto

# Interactive setup
node api-key-cli.js setup --interactive
```

### 2. Check Status

```bash
node api-key-cli.js status
```

### 3. Validate Keys

```bash
# Full validation
node api-key-cli.js validate

# Quick validation
node api-key-cli.js validate --quick
```

### 4. Run Tests

```bash
# Basic test
node api-key-cli.js test

# Stress test
node api-key-cli.js test --suite stress

# Continuous monitoring
node api-key-cli.js test --monitor
```

## 🖥️ CLI Usage

### Available Commands

| Command | Description | Options |
|---------|-------------|---------|
| `status` | Show current API key status | `-h, --host` |
| `validate` | Validate API keys | `-k, --keys`, `-q, --quick` |
| `test` | Run automated tests | `-s, --suite`, `-m, --monitor` |
| `setup` | Set up key management | `-i, --interactive`, `-a, --auto` |
| `keys` | Manage API keys | `-l, --list`, `-r, --refresh`, `-g, --generate` |
| `export` | Export configuration | `-o, --output`, `-f, --format` |

### Examples

```bash
# Check system status
langfuse-api-keys status

# Validate specific keys
langfuse-api-keys validate --keys "pk-lf-abc123,sk-lf-def456"

# Run stress test with monitoring
langfuse-api-keys test --suite stress --monitor

# Refresh keys from UI
langfuse-api-keys keys --refresh

# Export environment configuration
langfuse-api-keys export --format env --output .env.langfuse
```

## 📖 API Usage

### Basic Integration

```javascript
import { LangfuseIntegration } from './LangfuseIntegration.js';

// Initialize integration
const integration = new LangfuseIntegration({
  langfuseHost: 'http://localhost:3000',
  enableMonitoring: true,
  enableTesting: true
});

await integration.initialize();

// Get managed Langfuse client
const client = integration.getLangfuseClient();

// Create traces as usual
const trace = await integration.createTrace(
  'My Operation',
  { input: 'data' },
  { metadata: 'example' }
);
```

### Advanced Usage

```javascript
import LangfuseApiKeyManager from './LangfuseApiKeyManager.js';
import LangfuseKeyValidator from './LangfuseKeyValidator.js';
import AutomatedKeyTester from './AutomatedKeyTester.js';

// Manual key management
const manager = new LangfuseApiKeyManager();
const keys = await manager.getCurrentKeys();

// Comprehensive validation
const validator = new LangfuseKeyValidator();
const validation = await validator.validateKeys(keys.publicKey, keys.secretKey);

// Automated testing
const tester = new AutomatedKeyTester();
tester.setKeys(keys.publicKey, keys.secretKey);
await tester.start();
```

## ⚙️ Configuration

### Environment Variables

```bash
# Required
LANGFUSE_HOST=http://localhost:3000

# Optional - will be auto-managed
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...

# Integration settings
LANGFUSE_KEY_MANAGEMENT_ENABLED=true
LANGFUSE_AUTO_VALIDATION=true
LANGFUSE_MONITORING_ENABLED=true
```

### Configuration Options

```javascript
const config = {
  langfuseHost: 'http://localhost:3000',
  keyValidationTimeout: 10000,
  keyRotationInterval: 24 * 60 * 60 * 1000, // 24 hours
  enableHealthMonitoring: true,
  enableTesting: true,
  performanceThreshold: 2000,
  maxRetries: 3,
  fallbackKeys: [
    { publicKey: 'pk-lf-backup1', secretKey: 'sk-lf-backup1' },
    { publicKey: 'pk-lf-backup2', secretKey: 'sk-lf-backup2' }
  ]
};
```

## 🧪 Testing

### Test Suites

1. **Basic Test Suite**
   - Format validation
   - Connection testing
   - Authentication verification
   - API functionality

2. **Stress Test Suite**
   - Concurrent request handling
   - High-throughput testing
   - Load balancing validation
   - Error rate monitoring

3. **Integration Test Suite**
   - Swarm integration
   - MCP tool integration
   - Agent coordination
   - Real-time streaming

4. **Regression Test Suite**
   - Performance regression detection
   - Feature compatibility
   - API changes validation

5. **Endurance Test Suite**
   - Long-running stability
   - Memory leak detection
   - Connection persistence
   - Error recovery

### Running Tests

```bash
# Run specific test suite
npm run test -- --suite stress

# Continuous monitoring
npm run monitor

# Custom test configuration
node api-key-cli.js test --suite integration --keys "pk-lf-...,sk-lf-..."
```

## 📊 Monitoring

### Health Monitoring

The system provides real-time health monitoring with:

- **Key Validation**: Continuous validation of API keys
- **Connection Health**: Langfuse service connectivity monitoring
- **Performance Metrics**: Response time and throughput tracking
- **Error Tracking**: Failure detection and alerting
- **Recovery Monitoring**: Automatic recovery attempt tracking

### Metrics Collection

```javascript
// Get monitoring statistics
const stats = tester.getTestStatistics();

console.log(`Success Rate: ${stats.successRate}%`);
console.log(`Average Duration: ${stats.averageDuration}ms`);
console.log(`Recent Failures: ${stats.recentFailures.length}`);
```

### Alerting

```javascript
// Set up custom alerts
tester.on('critical-failure', (failure) => {
  console.error('Critical failure detected:', failure);
  // Send alert to monitoring system
});

tester.on('recovery-success', (result) => {
  console.log('System recovered successfully');
  // Send recovery notification
});
```

## 🔗 Integration

### Existing Langfuse Code

Replace your existing Langfuse initialization:

```javascript
// Before
import { Langfuse } from 'langfuse';
const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  baseUrl: process.env.LANGFUSE_HOST
});

// After
import { createLangfuseIntegration } from './LangfuseIntegration.js';
const integration = createLangfuseIntegration();
await integration.initialize();
const langfuse = integration.getLangfuseClient();
```

### Swarm Integration

```javascript
// Enhanced swarm tracing
const trace = await integration.createTrace(
  'Swarm Operation',
  { agents: ['agent-1', 'agent-2'] },
  { 
    swarmId: 'swarm-001',
    coordinationType: 'mesh',
    agentCount: 5
  }
);
```

### Environment Sync

The system automatically updates environment files:

```bash
# Updates these files automatically
.env
.env.local
.env.development
.env.production
.env.langfuse
```

## 🔒 Security

### Key Storage

- **Encryption**: All keys are encrypted at rest
- **Access Control**: Restrictive file permissions (700)
- **Backup**: Secure key history with rotation
- **Validation**: Continuous key validation and health checks

### Best Practices

1. **Regular Key Rotation**: Automatic key rotation every 24 hours
2. **Fallback Keys**: Multiple fallback keys for redundancy
3. **Monitoring**: Continuous health monitoring and alerting
4. **Validation**: Multi-stage validation pipeline
5. **Recovery**: Automatic failure recovery mechanisms

### Security Configuration

```javascript
const securityConfig = {
  keyRotationInterval: 24 * 60 * 60 * 1000, // 24 hours
  encryptionEnabled: true,
  accessControlEnabled: true,
  auditLoggingEnabled: true,
  secureStorage: true
};
```

## 🔧 Troubleshooting

### Common Issues

#### 1. Keys Not Found

```bash
# Check if keys are available
node api-key-cli.js keys --list

# Refresh keys from UI
node api-key-cli.js keys --refresh

# Manual key setup
node api-key-cli.js keys --set "pk-lf-...,sk-lf-..."
```

#### 2. Validation Failures

```bash
# Run detailed validation
node api-key-cli.js validate --verbose

# Check service health
node api-key-cli.js status

# Test connection
curl http://localhost:3000/api/health
```

#### 3. Performance Issues

```bash
# Run performance test
node api-key-cli.js test --suite regression

# Check stress test results
node api-key-cli.js test --suite stress

# Monitor continuously
node api-key-cli.js test --monitor
```

#### 4. Integration Problems

```bash
# Validate integration
node api-key-cli.js validate --quick

# Check environment sync
node api-key-cli.js export --format env

# Reinitialize system
node api-key-cli.js setup --auto
```

### Debug Mode

Enable verbose logging:

```bash
node api-key-cli.js --verbose status
node api-key-cli.js --verbose validate
node api-key-cli.js --verbose test
```

### Log Analysis

Check system logs:

```bash
# View key manager logs
tail -f .langfuse-keys/manager.log

# View validation logs
tail -f .langfuse-keys/validation.log

# View test logs
tail -f .langfuse-keys/testing.log
```

## 🤝 Contributing

### Development Setup

```bash
# Clone repository
git clone https://github.com/your-org/langfuse-api-key-management.git

# Install dependencies
npm install

# Run tests
npm test

# Start development
npm run dev
```

### Code Style

- Use ES6+ features
- Follow JSDoc conventions
- Include comprehensive error handling
- Write unit tests for new features
- Use semantic commit messages

### Testing

```bash
# Run all tests
npm test

# Run specific test suite
npm run test:unit
npm run test:integration

# Run with coverage
npm run test:coverage
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Langfuse team for the excellent observability platform
- Claude Code team for the development environment
- Open source community for inspiration and tools

---

**Made with ❤️ by the API Key Specialist Agent**

For issues and support, please visit our [GitHub Issues](https://github.com/your-org/langfuse-api-key-management/issues) page.