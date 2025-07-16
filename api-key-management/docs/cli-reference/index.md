# CLI Reference

The Langfuse API Key Management System provides a comprehensive command-line interface for managing API keys, testing, and monitoring.

## Quick Reference

```bash
# Key Management
langfuse-keys extract              # Extract keys from Langfuse UI
langfuse-keys validate            # Validate existing keys
langfuse-keys rotate              # Rotate API keys
langfuse-keys list                # List all configured keys

# Testing
langfuse-keys test               # Run basic functionality tests
langfuse-keys test --stress      # Run stress tests
langfuse-keys test --endurance   # Run endurance tests

# Monitoring
langfuse-keys monitor            # Start real-time monitoring
langfuse-keys health             # Check system health
langfuse-keys metrics            # Display performance metrics

# Configuration
langfuse-keys config             # Show current configuration
langfuse-keys setup              # Run interactive setup wizard
```

## Detailed Commands

### Key Management Commands

#### `extract`
Automatically extracts API keys from Langfuse UI.

```bash
langfuse-keys extract [options]

Options:
  --url <url>           Langfuse URL (default: http://localhost:3000)
  --output <file>       Output file for keys (default: .env)
  --format <format>     Output format: env, json, yaml (default: env)
  --overwrite           Overwrite existing keys
```

#### `validate`
Validates API keys functionality and permissions.

```bash
langfuse-keys validate [options]

Options:
  --keys <file>         Key file to validate (default: .env)
  --detailed            Show detailed validation results
  --fix                 Attempt to fix common issues
```

#### `rotate`
Rotates API keys with zero-downtime strategy.

```bash
langfuse-keys rotate [options]

Options:
  --strategy <type>     Rotation strategy: gradual, immediate (default: gradual)
  --backup              Create backup before rotation
  --verify              Verify new keys before applying
```

### Testing Commands

#### `test`
Runs comprehensive test suites.

```bash
langfuse-keys test [options]

Options:
  --stress              Run stress tests
  --endurance           Run endurance tests
  --performance         Run performance benchmarks
  --report <file>       Save test report to file
```

### Monitoring Commands

#### `monitor`
Starts real-time monitoring dashboard.

```bash
langfuse-keys monitor [options]

Options:
  --interval <ms>       Monitoring interval (default: 5000)
  --alerts              Enable alert notifications
  --dashboard           Show visual dashboard
```

## Configuration File

The CLI can be configured using a `.langfuse-keys.json` file:

```json
{
  "langfuse": {
    "url": "http://localhost:3000",
    "timeout": 30000
  },
  "keys": {
    "validation_interval": 300000,
    "rotation_strategy": "gradual",
    "backup_enabled": true
  },
  "monitoring": {
    "enabled": true,
    "interval": 5000,
    "alerts": {
      "email": "admin@example.com",
      "webhook": "https://hooks.slack.com/..."
    }
  }
}
```

## Exit Codes

- `0` - Success
- `1` - General error
- `2` - Configuration error
- `3` - Validation failure
- `4` - Network error
- `5` - Permission error

## Examples

See the [examples directory](../examples/) for detailed usage examples and integration patterns.