# @swarm-orchestration/config

[![npm version](https://badge.fury.io/js/%40swarm-orchestration%2Fconfig.svg)](https://badge.fury.io/js/%40swarm-orchestration%2Fconfig)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Centralized configuration management and validation for all Swarm Orchestration Platform components.

## 🌟 Features

- **Type-safe Configuration**: Zod-based validation for runtime safety
- **Environment Variable Handling**: Automatic parsing and validation
- **Singleton Pattern**: Consistent configuration access across components
- **Security-aware**: Automatic masking of sensitive values in production
- **Multi-environment Support**: Development, staging, and production configurations
- **Hot Reloading**: Configuration updates without restarts (development mode)

## 📦 Installation

```bash
npm install @swarm-orchestration/config
```

## 🚀 Quick Start

### Basic Usage

```typescript
import { SwarmConfig } from '@swarm-orchestration/config';

// Initialize configuration
const config = new SwarmConfig();

// Access configuration values
console.log(config.swarm.maxAgents); // 8
console.log(config.database.url); // postgres://...
console.log(config.api.port); // 3000
```

### Environment-specific Configuration

```typescript
import { SwarmConfig } from '@swarm-orchestration/config';

// Initialize with specific environment
const config = new SwarmConfig({
  environment: 'production',
  validateSecrets: true
});

// Configuration is automatically validated
if (config.isValid()) {
  console.log('Configuration is valid!');
} else {
  console.error('Configuration errors:', config.getErrors());
}
```

### Custom Configuration

```typescript
import { SwarmConfig, SwarmConfigOptions } from '@swarm-orchestration/config';

const customConfig: SwarmConfigOptions = {
  swarm: {
    maxAgents: 12,
    topology: 'mesh',
    coordinationStrategy: 'adaptive'
  },
  database: {
    url: process.env.DATABASE_URL,
    poolSize: 20
  },
  monitoring: {
    enabled: true,
    langfuseKey: process.env.LANGFUSE_PUBLIC_KEY
  }
};

const config = new SwarmConfig(customConfig);
```

## 🔧 Configuration Schema

### Swarm Configuration
```typescript
interface SwarmConfig {
  maxAgents: number;           // Maximum number of agents (default: 8)
  topology: 'hierarchical' | 'mesh' | 'ring' | 'star'; // Network topology
  coordinationStrategy: 'parallel' | 'sequential' | 'adaptive'; // Strategy
  memoryEnabled: boolean;      // Enable persistent memory (default: true)
  neuralNetworksEnabled: boolean; // Enable neural learning (default: true)
}
```

### Database Configuration
```typescript
interface DatabaseConfig {
  url: string;                 // Database connection URL
  poolSize: number;            // Connection pool size (default: 10)
  ssl: boolean;                // Enable SSL (default: true in production)
  timeout: number;             // Query timeout in ms (default: 30000)
  retryAttempts: number;       // Retry attempts (default: 3)
}
```

### API Configuration
```typescript
interface ApiConfig {
  port: number;                // API server port (default: 3000)
  host: string;                // API server host (default: 'localhost')
  cors: boolean;               // Enable CORS (default: true)
  rateLimit: number;           // Requests per minute (default: 1000)
  timeout: number;             // Request timeout in ms (default: 30000)
}
```

### Monitoring Configuration
```typescript
interface MonitoringConfig {
  enabled: boolean;            // Enable monitoring (default: true)
  langfuseKey: string;         // Langfuse public key
  langfuseSecret: string;      // Langfuse secret key
  metricsInterval: number;     // Metrics collection interval in ms (default: 5000)
  retentionDays: number;       // Data retention period (default: 30)
}
```

## 🌍 Environment Variables

### Required Variables
```bash
# Database
DATABASE_URL=postgres://username:password@host:port/database

# Monitoring (optional but recommended)
LANGFUSE_PUBLIC_KEY=pk_...
LANGFUSE_SECRET_KEY=sk_...

# API Configuration (optional)
API_PORT=3000
API_HOST=localhost
```

### Optional Variables
```bash
# Swarm Configuration
SWARM_MAX_AGENTS=8
SWARM_TOPOLOGY=hierarchical
SWARM_STRATEGY=parallel

# Security
ENCRYPTION_KEY=your-32-character-encryption-key
JWT_SECRET=your-jwt-secret

# Performance
DB_POOL_SIZE=10
API_RATE_LIMIT=1000
METRICS_INTERVAL=5000
```

## 🔒 Security Features

### Automatic Secret Masking
```typescript
const config = new SwarmConfig();

// Secrets are automatically masked in logs
console.log(config.toJSON()); 
// Output: { database: { url: "postgres://***:***@***:5432/***" } }

// Access raw values when needed
console.log(config.database.url); // Full connection string
```

### Environment Validation
```typescript
const config = new SwarmConfig({
  validateSecrets: true,  // Validates all secrets are present
  requireHttps: true,     // Requires HTTPS in production
  validateUrls: true      // Validates URL formats
});
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Test Configuration
```typescript
import { SwarmConfig } from '@swarm-orchestration/config';

// Use test configuration
const testConfig = new SwarmConfig({
  environment: 'test',
  database: {
    url: 'sqlite::memory:'
  },
  monitoring: {
    enabled: false
  }
});
```

## 📊 Configuration Validation

### Built-in Validations
- **URL Validation**: Ensures database URLs are properly formatted
- **Port Validation**: Validates port numbers are within valid ranges
- **Secret Validation**: Ensures required secrets are present and properly formatted
- **Environment Validation**: Validates environment-specific requirements

### Custom Validation
```typescript
import { SwarmConfig, ConfigValidator } from '@swarm-orchestration/config';

const customValidator: ConfigValidator = (config) => {
  if (config.swarm.maxAgents > 20) {
    return { valid: false, error: 'Too many agents for current plan' };
  }
  return { valid: true };
};

const config = new SwarmConfig({
  validators: [customValidator]
});
```

## 🔄 Hot Reloading (Development)

```typescript
import { SwarmConfig } from '@swarm-orchestration/config';

const config = new SwarmConfig({
  watchMode: true,  // Enable file watching in development
  onChange: (newConfig) => {
    console.log('Configuration updated:', newConfig);
    // Handle configuration changes
  }
});
```

## 🌐 Multi-Environment Support

### Development
```typescript
// .env.development
NODE_ENV=development
API_PORT=3001
DATABASE_URL=postgres://localhost:5432/swarm_dev
LANGFUSE_ENABLED=false
```

### Staging
```typescript
// .env.staging
NODE_ENV=staging
API_PORT=3000
DATABASE_URL=postgres://staging-db:5432/swarm_staging
LANGFUSE_ENABLED=true
SSL_REQUIRED=true
```

### Production
```typescript
// .env.production
NODE_ENV=production
API_PORT=443
DATABASE_URL=postgres://prod-db:5432/swarm_prod
LANGFUSE_ENABLED=true
SSL_REQUIRED=true
VALIDATE_SECRETS=true
```

## 🛠️ TypeScript Support

Full TypeScript support with comprehensive type definitions:

```typescript
import type { 
  SwarmConfigOptions,
  DatabaseConfig,
  ApiConfig,
  MonitoringConfig,
  SwarmTopology,
  CoordinationStrategy
} from '@swarm-orchestration/config';
```

## 📚 Examples

### Basic Express.js Integration
```typescript
import express from 'express';
import { SwarmConfig } from '@swarm-orchestration/config';

const config = new SwarmConfig();
const app = express();

app.listen(config.api.port, config.api.host, () => {
  console.log(`Server running on ${config.api.host}:${config.api.port}`);
});
```

### Database Connection
```typescript
import { Pool } from 'pg';
import { SwarmConfig } from '@swarm-orchestration/config';

const config = new SwarmConfig();

const pool = new Pool({
  connectionString: config.database.url,
  max: config.database.poolSize,
  ssl: config.database.ssl
});
```

### Swarm Initialization
```typescript
import { createSwarm } from 'claude-flow';
import { SwarmConfig } from '@swarm-orchestration/config';

const config = new SwarmConfig();

const swarm = await createSwarm({
  maxAgents: config.swarm.maxAgents,
  topology: config.swarm.topology,
  strategy: config.swarm.coordinationStrategy
});
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Related Packages

- [@swarm-orchestration/types](https://github.com/ruvnet/swarm-types) - TypeScript definitions
- [@swarm-orchestration/utils](https://github.com/ruvnet/swarm-utils) - Utility functions
- [claude-flow](https://github.com/ruvnet/claude-flow) - Core orchestration engine

## 📞 Support

- [Documentation](https://github.com/ruvnet/swarm-config/docs)
- [Issues](https://github.com/ruvnet/swarm-config/issues)
- [Discussions](https://github.com/ruvnet/swarm-config/discussions)
- Email: support@swarm-orchestration.com