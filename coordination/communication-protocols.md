# 8-Agent Swarm Communication Protocols
## Inter-Agent Coordination via Hook Infrastructure

**Designed by:** Analyzer-Core  
**Architecture Reference:** swarm-hook-integration-architecture.md  
**Mission:** Hive-004 Communication Specifications

---

## 🔄 PROTOCOL STACK OVERVIEW

```
Layer 4: Application    │ Agent Decision Logic
Layer 3: Coordination   │ Consensus & Voting
Layer 2: Messaging      │ Hook-based Communication  
Layer 1: Transport      │ SQLite Memory + Hooks
Layer 0: Physical       │ Local Process + Files
```

---

## 📡 HOOK-BASED MESSAGE TYPES

### 1. COMMAND Messages (Queen → Workers)
**Purpose**: Task assignment and coordination directives

```bash
npx claude-flow@alpha hooks notification \
  --message "COMMAND:TASK_ASSIGN:scout-alpha:research-api-patterns" \
  --agent-id "queen" \
  --target-agents "scout-alpha" \
  --priority "high" \
  --telemetry true
```

**Message Format**:
```json
{
  "type": "COMMAND",
  "action": "TASK_ASSIGN|PRIORITY_CHANGE|ABORT|PAUSE",
  "target": "scout-alpha",
  "payload": {
    "task_id": "hive-004-research-001",
    "description": "Research API integration patterns",
    "deadline": "2025-07-15T04:00:00Z",
    "dependencies": ["hive-004-init-001"]
  }
}
```

### 2. STATUS Messages (Workers → Queen)
**Purpose**: Progress reporting and status updates

```bash
npx claude-flow@alpha hooks notification \
  --message "STATUS:PROGRESS:50:researching-oauth-patterns" \
  --agent-id "scout-alpha" \
  --target-agents "queen" \
  --priority "medium"
```

### 3. REQUEST Messages (Peer-to-Peer)
**Purpose**: Inter-agent collaboration requests

```bash
npx claude-flow@alpha hooks notification \
  --message "REQUEST:VALIDATE:builder-core:auth-implementation" \
  --agent-id "builder-systems" \
  --target-agents "validator" \
  --priority "high"
```

### 4. CONSENSUS Messages (All Agents)
**Purpose**: Voting and decision-making

```bash
npx claude-flow@alpha hooks notification \
  --message "CONSENSUS:VOTE:architecture-decision-001:APPROVE" \
  --agent-id "scout-beta" \
  --target-agents "all" \
  --priority "critical"
```

### 5. DATA Messages (Information Sharing)
**Purpose**: Sharing findings, artifacts, and context

```bash
npx claude-flow@alpha hooks notification \
  --message "DATA:FINDINGS:api-research:${base64_encoded_data}" \
  --agent-id "scout-alpha" \
  --target-agents "scout-beta,builder-core" \
  --priority "medium"
```

---

## 🎯 AGENT COMMUNICATION MATRIX

### Message Flow Patterns

| From ↓ To → | Queen | Scout-α | Scout-β | Builder-Core | Builder-Sys | Validator | Optimizer | Monitor |
|-------------|-------|---------|---------|--------------|-------------|-----------|-----------|---------|
| **Queen**       | ⭕ | CMD,REQ | CMD,REQ | CMD,REQ      | CMD,REQ     | CMD,REQ   | CMD,REQ   | CMD,REQ |
| **Scout-α**     | STS,REQ | ⭕ | DATA,REQ | DATA,REQ     | DATA        | ⭕        | ⭕        | STS     |
| **Scout-β**     | STS,REQ | DATA,REQ | ⭕ | DATA,REQ     | DATA        | ⭕        | ⭕        | STS     |
| **Builder-Core** | STS,REQ | REQ     | REQ     | ⭕           | DATA,REQ    | REQ       | STS       | STS     |
| **Builder-Sys**  | STS,REQ | ⭕      | ⭕      | DATA,REQ     | ⭕          | REQ       | STS       | STS     |
| **Validator**   | STS     | DATA    | DATA    | DATA         | DATA        | ⭕        | REQ       | STS     |
| **Optimizer**   | STS,REQ | REQ     | REQ     | REQ          | REQ         | REQ       | ⭕        | DATA    |
| **Monitor**     | STS,DATA | STS     | STS     | STS          | STS         | STS       | DATA      | ⭕      |

**Legend:**
- CMD = Command messages
- STS = Status messages  
- REQ = Request messages
- DATA = Data sharing messages
- ⭕ = No direct communication needed

---

## 🔄 CONSENSUS PROTOCOL SPECIFICATION

### Voting Mechanism
**Trigger Conditions:**
- Architecture decisions requiring approval
- Resource allocation changes  
- Priority modifications
- Emergency interventions

**Voting Process:**
1. **Proposal Phase** (Proposer agent)
   ```bash
   npx claude-flow@alpha hooks consensus \
     --proposal "Change swarm topology from hierarchical to mesh" \
     --agent-id "optimizer" \
     --required-votes 5 \
     --timeout 30000
   ```

2. **Voting Phase** (All agents)
   ```bash
   npx claude-flow@alpha hooks notification \
     --message "CONSENSUS:VOTE:proposal-001:APPROVE:rationale" \
     --agent-id "scout-alpha" \
     --target-agents "all"
   ```

3. **Resolution Phase** (Queen agent)
   ```bash
   npx claude-flow@alpha hooks notification \
     --message "CONSENSUS:RESULT:proposal-001:APPROVED:6/8" \
     --agent-id "queen" \
     --target-agents "all"
   ```

**Voting Rules:**
- **Simple Majority**: 5/8 agents for routine decisions
- **Supermajority**: 6/8 agents for architecture changes  
- **Unanimous**: 8/8 agents for critical system modifications
- **Timeout**: 30 seconds default, 60 seconds for critical votes

---

## 💾 MEMORY COORDINATION PATTERNS

### Shared Memory Keys Structure
```
hive/
├── queen/
│   ├── task-assignments/
│   ├── agent-status/
│   └── consensus-results/
├── scouts/
│   ├── alpha/findings/
│   ├── beta/analysis/
│   └── shared/research/
├── builders/
│   ├── core/implementations/
│   ├── systems/integrations/
│   └── shared/architecture/
├── validation/
│   ├── test-results/
│   ├── quality-metrics/
│   └── approval-status/
├── optimization/
│   ├── performance-data/
│   ├── bottlenecks/
│   └── recommendations/
└── monitoring/
    ├── swarm-metrics/
    ├── agent-health/
    └── coordination-stats/
```

### Memory Synchronization Hooks
```bash
# Before major operations - load context
npx claude-flow@alpha hooks pre-task \
  --load-memory "hive/shared,hive/scouts/shared" \
  --agent-id "scout-alpha"

# After operations - store results  
npx claude-flow@alpha hooks post-edit \
  --memory-key "hive/scouts/alpha/findings/api-research" \
  --coordinate-changes true
```

---

## ⚡ PERFORMANCE OPTIMIZATION PROTOCOLS

### 1. Message Batching
**Problem**: Individual hooks create communication overhead  
**Solution**: Batch related messages

```bash
# Instead of 3 separate calls:
# notification + post-edit + consensus

# Use batch coordination:
npx claude-flow@alpha hooks batch-coordinate \
  --operations "notification,post-edit,consensus" \
  --payloads "status-update,file-change,vote-cast" \
  --agent-id "builder-core"
```

### 2. Priority Queuing
**Message Priority Levels:**
- **CRITICAL**: Emergency stops, system failures
- **HIGH**: Task assignments, validation requests
- **MEDIUM**: Status updates, data sharing
- **LOW**: Metrics, routine notifications

**Queue Processing:**
```javascript
// Priority queue in hook processor
const messageQueue = {
  critical: [],  // Processed immediately
  high: [],      // Processed within 100ms  
  medium: [],    // Processed within 500ms
  low: []        // Processed within 2000ms
};
```

### 3. Asynchronous Processing
**Non-blocking Hook Execution:**
```bash
# Fire-and-forget notifications
npx claude-flow@alpha hooks notification \
  --message "STATUS:PROGRESS:75" \
  --async true \
  --no-wait true
```

---

## 🛡️ FAULT TOLERANCE PROTOCOLS

### Agent Failure Detection
**Heartbeat System:**
```bash
# Every agent sends heartbeat every 10 seconds
npx claude-flow@alpha hooks notification \
  --message "HEARTBEAT:${timestamp}:${health_status}" \
  --agent-id "scout-alpha" \
  --target-agents "monitor"
```

**Failure Response:**
1. **Detection** (Monitor agent): No heartbeat for 30 seconds
2. **Notification** (Monitor → Queen): Agent failure alert
3. **Reassignment** (Queen): Redistribute failed agent's tasks
4. **Recovery** (Queen): Attempt agent restart or replacement

### Message Reliability
**Acknowledgment System:**
```bash
# Sender marks message for ACK
npx claude-flow@alpha hooks notification \
  --message "COMMAND:TASK_ASSIGN:critical-task" \
  --require-ack true \
  --timeout 5000

# Receiver sends acknowledgment  
npx claude-flow@alpha hooks notification \
  --message "ACK:message-id-12345" \
  --target-agents "sender-id"
```

**Retry Logic:**
- **Immediate retry**: For critical messages
- **Exponential backoff**: 1s, 2s, 4s, 8s intervals
- **Dead letter queue**: After 5 failed attempts
- **Manual intervention**: For persistent failures

---

## 📊 MONITORING & OBSERVABILITY

### Communication Metrics
**Tracked Metrics:**
- Message throughput (messages/second)
- Latency (hook execution time)
- Success rate (successful deliveries/total)
- Queue depth (pending messages)
- Agent response time (ACK latency)

**Monitoring Hooks:**
```bash
# Monitor agent tracks all communication
npx claude-flow@alpha hooks notification \
  --message "METRICS:COMMUNICATION:${json_metrics}" \
  --agent-id "monitor" \
  --store-only true
```

### Alert Thresholds
- **WARNING**: Latency > 200ms, Success rate < 95%
- **CRITICAL**: Latency > 500ms, Success rate < 90%
- **EMERGENCY**: Agent failure, Message queue overflow

---

## 🔧 IMPLEMENTATION SPECIFICATIONS

### Hook Command Templates
```bash
# Standard notification template
function send_agent_message() {
  local message_type=$1
  local content=$2  
  local target_agent=$3
  local priority=${4:-"medium"}
  
  npx claude-flow@alpha hooks notification \
    --message "${message_type}:${content}" \
    --agent-id "${AGENT_ID}" \
    --target-agents "${target_agent}" \
    --priority "${priority}" \
    --telemetry true
}

# Memory coordination template
function coordinate_memory() {
  local operation=$1
  local key=$2
  local value=$3
  
  npx claude-flow@alpha hooks post-edit \
    --memory-key "${key}" \
    --coordinate-changes true \
    --agent-id "${AGENT_ID}"
}
```

### Error Handling
```bash
# Wrapper for reliable hook execution
function reliable_hook() {
  local hook_command=$1
  local retry_count=0
  local max_retries=3
  
  while [ $retry_count -lt $max_retries ]; do
    if eval "$hook_command"; then
      return 0
    fi
    
    retry_count=$((retry_count + 1))
    sleep $((retry_count * 2))  # Exponential backoff
  done
  
  # Log failure and continue
  echo "Hook failed after $max_retries attempts: $hook_command"
  return 1
}
```

---

## ✅ PROTOCOL VALIDATION CHECKLIST

- [x] Message types defined and structured
- [x] Communication matrix documented  
- [x] Consensus protocol specified
- [x] Memory coordination patterns created
- [x] Performance optimizations designed
- [x] Fault tolerance mechanisms included
- [x] Monitoring and observability planned
- [x] Implementation templates provided

**Status**: Communication Protocols Complete - Ready for Builder Implementation

---

*These communication protocols provide the detailed specifications for 8-agent coordination via hook infrastructure. Builder agents can implement these patterns for optimal swarm collaboration.*