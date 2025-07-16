# API Key Rotation Features

## Overview

The enhanced LangfuseApiKeyManager now includes comprehensive key rotation capabilities designed to ensure continuous service availability while maintaining security best practices.

## Features

### 1. Automatic Key Rotation

- **Configurable Intervals**: Set custom rotation intervals (default: 24 hours)
- **Background Processing**: Automatic rotation runs in the background without manual intervention
- **Smart Scheduling**: Checks rotation requirements every minute

```javascript
const manager = new LangfuseApiKeyManager({
  keyRotationInterval: 24 * 60 * 60 * 1000, // 24 hours
  enableAutoRotation: true
});
```

### 2. Graceful Rotation Strategy

Two rotation strategies are available:

#### Graceful Rotation (Default)
- Maintains both old and new keys active during a grace period
- Zero downtime during key transitions
- Configurable grace period (default: 5 minutes)
- Automatic cleanup of old keys after grace period

#### Immediate Rotation
- Instantly switches to new keys
- Suitable for emergency situations
- No grace period

```javascript
const manager = new LangfuseApiKeyManager({
  rotationStrategy: 'graceful', // or 'immediate'
  rotationGracePeriod: 5 * 60 * 1000 // 5 minutes
});
```

### 3. Rollback Mechanism

- **Automatic Snapshots**: Every rotation creates a snapshot for potential rollback
- **Validation Before Rollback**: Ensures previous keys are still valid
- **History Tracking**: Maintains complete rotation history
- **CLI Support**: Easy rollback via command line

```bash
# Rollback to a specific rotation
node LangfuseApiKeyManager.js rollback rotation-1234567890
```

### 4. Rotation History

- **Persistent Storage**: All rotations are logged with metadata
- **Configurable History Size**: Control how many rotations to keep (default: 50)
- **Detailed Tracking**: Includes timestamps, status, attempts, and errors

```javascript
// Get rotation history
const history = manager.getRotationHistory(10);
```

### 5. Event Notifications

- **Real-time Events**: Subscribe to rotation lifecycle events
- **Webhook Support**: Send notifications to external systems
- **Event Types**:
  - `rotation_started`
  - `rotation_completed`
  - `rotation_failed`
  - `grace_period_started`
  - `grace_period_ended`
  - `rotation_rolled_back`

```javascript
// Subscribe to events
manager.onRotationEvent(event => {
  console.log('Rotation event:', event);
});

// Configure webhook
const manager = new LangfuseApiKeyManager({
  enableRotationNotifications: true,
  notificationWebhook: 'https://your-webhook.com/rotations'
});
```

### 6. Multiple Active Keys Support

During grace periods, the system maintains multiple active keys:

```javascript
// Get all active keys (useful for load balancers)
const activeKeys = manager.getAllActiveKeys();

// Check if a specific key is active
const isActive = manager.isKeyActive(publicKey);

// Get current keys with active key details
const keys = await manager.getCurrentKeys(true);
```

## CLI Commands

### Rotation Management

```bash
# Manually rotate keys
node LangfuseApiKeyManager.js rotate

# Force rotation (bypass checks)
node LangfuseApiKeyManager.js rotate --force

# View rotation history
node LangfuseApiKeyManager.js rotation-history 10

# View rotation statistics
node LangfuseApiKeyManager.js rotation-stats

# Listen for rotation events
node LangfuseApiKeyManager.js rotation-listen

# Rollback to previous rotation
node LangfuseApiKeyManager.js rollback <rotation-id>
```

## Configuration Options

### Rotation-specific Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enableAutoRotation` | boolean | true | Enable automatic key rotation |
| `keyRotationInterval` | number | 86400000 (24h) | Time between rotations in milliseconds |
| `rotationStrategy` | string | 'graceful' | Rotation strategy: 'graceful' or 'immediate' |
| `rotationGracePeriod` | number | 300000 (5m) | Grace period for old keys in milliseconds |
| `maxRotationAttempts` | number | 3 | Maximum rotation retry attempts |
| `rotationRetryDelay` | number | 30000 (30s) | Delay between rotation retries |
| `enableRotationNotifications` | boolean | true | Enable rotation event notifications |
| `notificationWebhook` | string | null | Webhook URL for notifications |
| `maxHistorySize` | number | 50 | Maximum rotation history entries |
| `enableRollback` | boolean | true | Enable rollback functionality |

## Best Practices

1. **Grace Period Configuration**: Set grace period based on your application's caching and deployment patterns
2. **Monitoring**: Always monitor rotation events in production
3. **Testing**: Test rotation in staging before enabling in production
4. **Backup Keys**: Keep fallback keys configured for emergencies
5. **History Retention**: Balance history size with storage requirements

## Integration Example

```javascript
import LangfuseApiKeyManager from './LangfuseApiKeyManager.js';

// Initialize with rotation features
const keyManager = new LangfuseApiKeyManager({
  enableAutoRotation: true,
  keyRotationInterval: 12 * 60 * 60 * 1000, // 12 hours
  rotationStrategy: 'graceful',
  rotationGracePeriod: 10 * 60 * 1000, // 10 minutes
  notificationWebhook: process.env.ROTATION_WEBHOOK
});

// Subscribe to rotation events
keyManager.onRotationEvent(async (event) => {
  console.log(`[${event.event}]`, event);
  
  // Update load balancer configuration on rotation
  if (event.event === 'rotation_completed') {
    await updateLoadBalancerKeys(keyManager.getAllActiveKeys());
  }
});

// Use keys in your application
async function getLangfuseClient() {
  const keys = await keyManager.getCurrentKeys();
  return new Langfuse({
    publicKey: keys.publicKey,
    secretKey: keys.secretKey
  });
}
```

## Security Considerations

1. **Secure Storage**: Keys and rotation history are stored with restrictive permissions (0o600)
2. **Validation**: All keys are validated before becoming active
3. **Atomic Operations**: Rotations are atomic to prevent partial updates
4. **Audit Trail**: Complete rotation history provides audit capabilities
5. **Rollback Safety**: Rollback operations validate key viability before execution

## Troubleshooting

### Common Issues

1. **Rotation Failures**
   - Check Langfuse service availability
   - Verify network connectivity
   - Review rotation history for error details

2. **Grace Period Issues**
   - Ensure applications can handle multiple active keys
   - Verify load balancer configuration updates

3. **Rollback Failures**
   - Check if previous keys are still valid in Langfuse
   - Verify rotation history integrity

### Debug Mode

Enable detailed logging for troubleshooting:

```javascript
const manager = new LangfuseApiKeyManager({
  debug: true,
  verbose: true
});
```

## Future Enhancements

Planned features for future releases:
- Predictive rotation based on usage patterns
- Multi-region key rotation coordination
- Integration with secret management services
- Advanced rotation policies (time-based, usage-based)
- Rotation approval workflows