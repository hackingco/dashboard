# WebSocket Implementation for Real-Time Swarm Management

## Overview

This implementation provides a JWT-secured WebSocket endpoint for real-time swarm management, enabling clients to launch machines, scale swarms, and receive live status updates.

## Key Features

### 1. JWT Authentication
- WebSocket connections require a valid JWT token passed as a query parameter
- Tokens are verified before establishing the connection
- Each WebSocket client is authenticated with userId and role

### 2. Enhanced WebSocket Service
- Updated from `Set<WebSocket>` to `Map<WebSocket, AuthenticatedWebSocket>` for user tracking
- Support for broadcasting to specific users or roles
- Automatic cleanup of disconnected clients

### 3. Message Types

#### Launch Message
```typescript
{
  type: 'launch',
  action: 'launch',
  payload: {
    name: string,
    region?: string,
    image?: string,
    cpus?: number,
    memory?: number,
    env?: Record<string, string>
  }
}
```

#### Machine Update (Broadcast)
```typescript
{
  type: 'machine_update',
  machineId: string,
  status: 'created' | 'started' | 'stopped' | 'destroyed',
  cpus: number,
  memory: number,
  region?: string,
  privateIp?: string
}
```

## Implementation Details

### 1. WebSocket Service Updates (`websocket.service.ts`)
- Added JWT authentication support
- Extended with `AuthenticatedWebSocket` interface
- New methods:
  - `broadcastMachineStatusUpdate()` - Send machine status updates
  - `getClientByUserId()` - Find client by user ID
  - `broadcastToRole()` - Send messages to specific roles

### 2. Launch Handler Updates (`index.ts`)
- Updated to match `WebSocketLaunchMessage` interface
- Direct integration with Fly Machines API via `flyService.createMachine()`
- Real-time status updates during machine creation
- Error handling with detailed error messages

### 3. Shared Types (`shared/types/src/index.ts`)
- Added comprehensive WebSocket message type definitions
- Type-safe message interfaces for all operations

## Testing

Use the provided test script to verify the WebSocket implementation:

```bash
# Install dependencies
npm install ws node-fetch

# Run the test (ensure manager is running on port 8080)
node test-websocket.js

# Or with custom URLs
API_URL=https://your-api.fly.dev WS_URL=wss://your-api.fly.dev/ws node test-websocket.js
```

## API Endpoints

### Get JWT Token
```
POST /api/auth/token
Content-Type: application/json

{
  "userId": "your-user-id"
}

Response:
{
  "token": "jwt-token-here",
  "expiresIn": "24h"
}
```

### WebSocket Connection
```
ws://localhost:8080/ws?token=<jwt-token>
```

## Security Considerations

1. **JWT Validation**: All WebSocket connections must provide a valid JWT token
2. **Token Expiry**: Tokens expire after 24 hours
3. **Environment Variables**: 
   - `JWT_SECRET` - Must be set in production
   - `FLY_ACCESS_TOKEN` - Required for Fly.io API calls

## Error Handling

The implementation includes comprehensive error handling:
- Invalid JWT tokens are rejected at connection time
- Malformed messages receive error responses
- Fly API errors are caught and reported to clients
- Connection failures trigger automatic cleanup

## Integration with Fly.io

The WebSocket service directly integrates with Fly.io's Machines API:
- Creates apps using `fly apps create`
- Launches machines with custom configurations
- Tracks machine status and reports updates
- Supports custom Docker images and environment variables

## Next Steps

1. Add support for machine deletion
2. Implement swarm-wide operations (stop all, restart all)
3. Add metrics collection and reporting
4. Implement connection pooling for high-load scenarios
5. Add support for WebSocket reconnection with state recovery