# Supabase State Sync Implementation Summary

## Overview
The Supabase state sync functionality has been enhanced to ensure real-time machine state changes are automatically forwarded to connected WebSocket clients.

## Key Components

### 1. Database Schema (Already Implemented)
- **machine_states** table: Stores complete machine state from Fly API responses
- **state_sync_events** table: Tracks all state change deltas
- **Realtime triggers**: PostgreSQL triggers that emit state changes via pg_notify

### 2. Supabase Realtime Service Enhancement
- Added WebSocket service integration via `setWebSocketService()` method
- Enhanced `handleMachineStateChange()` to forward state deltas to WebSocket clients
- State changes are broadcast with:
  - Machine ID
  - Swarm ID
  - State delta details
  - Correlation ID for tracking
  - Timestamp

### 3. Server Integration
- WebSocket service is connected to Supabase Realtime on server startup
- Observability orchestrator initializes to coordinate all services
- State flow: Fly API → Supabase DB → Realtime Trigger → WebSocket Broadcast

### 4. Data Flow
1. **Machine Creation**: FlyObservabilityService creates machine and stores state in Supabase
2. **State Changes**: Database triggers detect changes and emit deltas
3. **Realtime Events**: Supabase Realtime service receives and processes deltas
4. **WebSocket Broadcast**: State changes are forwarded to all connected dashboard clients

## Key Features
- **No Mock Data**: Only real Fly API responses are stored and transmitted
- **Real-time Updates**: State changes propagate within milliseconds
- **Full Observability**: All state changes are tracked with Langfuse traces and TrustGraph nodes
- **Correlation Tracking**: Every state change has a correlation ID for end-to-end tracking

## WebSocket Message Format
```json
{
  "type": "machine_update",
  "appName": "swarm-{swarmId}",
  "machineId": "machine_xyz",
  "status": "running",
  "data": {
    "delta": {
      "event_type": "state_change",
      "machine_id": "machine_xyz",
      "swarm_id": "uuid",
      "old_status": "initializing",
      "new_status": "running",
      "changes": {...},
      "timestamp": "2025-07-12T22:00:00Z"
    },
    "swarmId": "uuid",
    "correlationId": "trace_id",
    "timestamp": "2025-07-12T22:00:00Z"
  }
}
```

## Benefits
- Dashboard receives real-time updates without polling
- State consistency across all connected clients
- Complete audit trail of all state changes
- Reduced API calls through efficient delta broadcasting