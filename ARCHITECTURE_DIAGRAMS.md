# Hive Mind Swarm Orchestrator - Architecture Diagrams

## System Overview Diagram

```mermaid
graph TB
    subgraph "Frontend Layer"
        UI[Dashboard UI<br/>Next.js + React + Tailwind]
        AUTH_UI[Supabase Auth UI]
    end
    
    subgraph "API Gateway"
        NGINX[Nginx/Fly Proxy<br/>Load Balancer]
        RATE[Rate Limiter]
    end
    
    subgraph "Manager Service"
        API[REST API<br/>Express.js]
        WS[WebSocket Server<br/>Real-time Updates]
        QUEUE[Queue Manager<br/>BullMQ]
        SCHEDULER[Task Scheduler]
        ORCHESTRATOR[Swarm Orchestrator]
    end
    
    subgraph "Data Layer"
        POSTGRES[(Supabase PostgreSQL<br/>Primary Database)]
        REDIS[(Redis<br/>Cache + Queue)]
        S3[Object Storage<br/>Logs & Artifacts]
    end
    
    subgraph "Worker Fleet"
        W1[Worker Instance 1<br/>Fly Machine]
        W2[Worker Instance 2<br/>Fly Machine]
        W3[Worker Instance N<br/>Fly Machine]
    end
    
    subgraph "Integration Services"
        CF[Claude-Flow<br/>AI Coordination]
        TG[TrustGraph<br/>DAG Processing]
        LF[Langfuse<br/>LLM Tracing]
    end
    
    subgraph "Infrastructure"
        FLY[Fly.io API<br/>Machine Management]
        METRICS[Prometheus<br/>Metrics Collection]
        LOGS[Log Aggregator]
    end
    
    UI --> AUTH_UI
    UI --> NGINX
    NGINX --> RATE
    RATE --> API
    RATE --> WS
    API --> QUEUE
    API --> SCHEDULER
    API --> ORCHESTRATOR
    QUEUE --> REDIS
    API --> POSTGRES
    ORCHESTRATOR --> FLY
    FLY --> W1
    FLY --> W2
    FLY --> W3
    W1 --> CF
    W2 --> CF
    W3 --> CF
    CF --> TG
    CF --> LF
    W1 --> METRICS
    W2 --> METRICS
    W3 --> METRICS
    API --> S3
    W1 --> LOGS
    W2 --> LOGS
    W3 --> LOGS
```

## Request Flow Diagram

```mermaid
sequenceDiagram
    participant User
    participant Dashboard
    participant API
    participant Auth
    participant Queue
    participant Manager
    participant Fly
    participant Worker
    participant DB
    
    User->>Dashboard: Create Swarm Request
    Dashboard->>Auth: Validate JWT Token
    Auth-->>Dashboard: Token Valid
    Dashboard->>API: POST /api/swarms
    API->>DB: Create Swarm Record
    DB-->>API: Swarm Created
    API->>Queue: Enqueue Swarm Init Job
    API-->>Dashboard: 201 Created
    Queue->>Manager: Process Swarm Init
    Manager->>Fly: Create App
    Fly-->>Manager: App Created
    Manager->>Fly: Deploy Workers
    loop For Each Worker
        Fly->>Worker: Start Machine
        Worker-->>Fly: Machine Started
        Worker->>DB: Register Worker
    end
    Manager->>DB: Update Swarm Status
    Manager-->>Dashboard: Swarm Ready (WebSocket)
    Dashboard-->>User: Display Success
```

## Worker Communication Flow

```mermaid
graph LR
    subgraph "Swarm Cluster"
        Q[Queen/Coordinator]
        W1[Worker 1]
        W2[Worker 2]
        W3[Worker 3]
        W4[Worker 4]
    end
    
    subgraph "Communication Layer"
        REDIS[Redis Pub/Sub]
        QUEUE[Task Queue]
    end
    
    subgraph "Coordination"
        CF[Claude-Flow]
        CONSENSUS[Consensus Engine]
    end
    
    Q --> REDIS
    REDIS --> W1
    REDIS --> W2
    REDIS --> W3
    REDIS --> W4
    
    W1 --> QUEUE
    W2 --> QUEUE
    W3 --> QUEUE
    W4 --> QUEUE
    
    Q --> CF
    CF --> CONSENSUS
    CONSENSUS --> Q
    
    W1 -.->|Peer Comm| W2
    W2 -.->|Peer Comm| W3
    W3 -.->|Peer Comm| W4
    W4 -.->|Peer Comm| W1
```

## Database Schema Relationships

```mermaid
erDiagram
    SWARMS ||--o{ WORKERS : contains
    SWARMS ||--o{ TASKS : processes
    SWARMS ||--o{ LOGS : generates
    SWARMS ||--o{ METRICS : tracks
    SWARMS ||--o{ HIVE_MESSAGES : coordinates
    SWARMS ||--o{ CLAUDE_FLOW_DECISIONS : makes
    WORKERS ||--o{ TASKS : executes
    WORKERS ||--o{ LOGS : produces
    WORKERS ||--o{ METRICS : reports
    WORKERS ||--o{ HIVE_MESSAGES : sends
    TASKS ||--o{ TRUST_GRAPH_NODES : maps_to
    TASKS ||--o{ LOGS : creates
    TRUST_GRAPH_NODES ||--o{ TRUST_GRAPH_NODES : depends_on
    SWARMS ||--o{ LANGFUSE_TRACES : traced_by
    
    SWARMS {
        uuid id PK
        string name
        string purpose
        string status
        int worker_count
        jsonb config
        jsonb metrics
        string fly_app_name UK
        timestamp created_at
        timestamp updated_at
    }
    
    WORKERS {
        uuid id PK
        uuid swarm_id FK
        string name
        string type
        string status
        string machine_id
        timestamp last_heartbeat
        jsonb config
        jsonb metrics
    }
    
    TASKS {
        uuid id PK
        uuid swarm_id FK
        uuid worker_id FK
        string type
        string status
        int priority
        jsonb input
        jsonb output
        string error
        int retry_count
        jsonb dependencies
    }
    
    TRUST_GRAPH_NODES {
        uuid id PK
        uuid swarm_id FK
        uuid task_id FK
        string node_type
        uuid dependencies
        string status
        jsonb data
    }
    
    HIVE_MESSAGES {
        uuid id PK
        uuid swarm_id FK
        uuid from_worker_id FK
        uuid to_worker_ids
        string type
        string action
        jsonb payload
    }
```

## Task Processing Pipeline

```mermaid
flowchart LR
    subgraph "Input"
        A[Task Submitted]
    end
    
    subgraph "Validation"
        B{Valid Task?}
        C[Reject]
    end
    
    subgraph "Queue Management"
        D[Add to Queue]
        E[Priority Sort]
        F[Check Dependencies]
    end
    
    subgraph "Worker Assignment"
        G{Worker Available?}
        H[Wait]
        I[Assign Worker]
        J[Claude-Flow Decision]
    end
    
    subgraph "Execution"
        K[Execute Task]
        L{Success?}
        M[Store Result]
        N[Retry Logic]
    end
    
    subgraph "Completion"
        O[Update Status]
        P[Trigger Next Tasks]
        Q[Send Notifications]
    end
    
    A --> B
    B -->|No| C
    B -->|Yes| D
    D --> E
    E --> F
    F --> G
    G -->|No| H
    H --> G
    G -->|Yes| J
    J --> I
    I --> K
    K --> L
    L -->|Yes| M
    L -->|No| N
    N --> K
    M --> O
    O --> P
    P --> Q
```

## Scaling Architecture

```mermaid
graph TB
    subgraph "Auto-Scaling Logic"
        MONITOR[Metrics Monitor]
        ANALYZER[Load Analyzer]
        SCALER[Scaling Engine]
    end
    
    subgraph "Scaling Triggers"
        CPU[CPU > 80%]
        MEM[Memory > 85%]
        QUEUE[Queue Depth > 100]
        RESP[Response Time > 2s]
    end
    
    subgraph "Scaling Actions"
        SCALE_UP[Add Workers]
        SCALE_DOWN[Remove Workers]
        UPGRADE[Upgrade Machines]
        REBALANCE[Rebalance Load]
    end
    
    subgraph "Infrastructure"
        FLY_API[Fly.io API]
        MACHINES[Machine Fleet]
    end
    
    CPU --> MONITOR
    MEM --> MONITOR
    QUEUE --> MONITOR
    RESP --> MONITOR
    
    MONITOR --> ANALYZER
    ANALYZER --> SCALER
    
    SCALER --> SCALE_UP
    SCALER --> SCALE_DOWN
    SCALER --> UPGRADE
    SCALER --> REBALANCE
    
    SCALE_UP --> FLY_API
    SCALE_DOWN --> FLY_API
    UPGRADE --> FLY_API
    
    FLY_API --> MACHINES
```

## Security Architecture

```mermaid
graph TB
    subgraph "External Access"
        USER[User]
        API_CLIENT[API Client]
    end
    
    subgraph "Edge Security"
        CDN[Cloudflare CDN]
        WAF[Web Application Firewall]
        DDOS[DDoS Protection]
    end
    
    subgraph "Authentication Layer"
        SUPABASE[Supabase Auth]
        JWT[JWT Validation]
        MFA[Multi-Factor Auth]
    end
    
    subgraph "API Security"
        RATE_LIMIT[Rate Limiting]
        CORS[CORS Policy]
        HELMET[Security Headers]
    end
    
    subgraph "Data Security"
        TLS[TLS Encryption]
        RLS[Row Level Security]
        ENCRYPT[At-Rest Encryption]
    end
    
    subgraph "Infrastructure Security"
        VPC[Private Network]
        SECRETS[Secrets Manager]
        AUDIT[Audit Logs]
    end
    
    USER --> CDN
    API_CLIENT --> CDN
    CDN --> WAF
    WAF --> DDOS
    DDOS --> SUPABASE
    SUPABASE --> JWT
    JWT --> MFA
    MFA --> RATE_LIMIT
    RATE_LIMIT --> CORS
    CORS --> HELMET
    HELMET --> TLS
    TLS --> RLS
    RLS --> ENCRYPT
    ENCRYPT --> VPC
    VPC --> SECRETS
    SECRETS --> AUDIT
```

## Claude-Flow Integration Architecture

```mermaid
flowchart TB
    subgraph "Swarm Workers"
        W1[Worker 1]
        W2[Worker 2]
        W3[Worker 3]
    end
    
    subgraph "Claude-Flow Hive Mind"
        QUEEN[Queen Bee<br/>Strategic Coordinator]
        CONSENSUS[Consensus Engine]
        MEMORY[Collective Memory]
        DECISION[Decision Engine]
    end
    
    subgraph "Worker Roles"
        RESEARCHER[Researcher Bees]
        CODER[Coder Bees]
        ANALYST[Analyst Bees]
        TESTER[Tester Bees]
    end
    
    subgraph "Integration Points"
        HOOKS[Event Hooks]
        SYNC[State Sync]
        COORD[Coordination API]
    end
    
    W1 --> HOOKS
    W2 --> HOOKS
    W3 --> HOOKS
    
    HOOKS --> QUEEN
    QUEEN --> CONSENSUS
    CONSENSUS --> DECISION
    DECISION --> MEMORY
    
    QUEEN --> RESEARCHER
    QUEEN --> CODER
    QUEEN --> ANALYST
    QUEEN --> TESTER
    
    MEMORY --> SYNC
    SYNC --> COORD
    COORD --> W1
    COORD --> W2
    COORD --> W3
```

## Deployment Architecture

```mermaid
graph TB
    subgraph "Development"
        DEV_CODE[Source Code]
        DEV_TEST[Unit Tests]
        DEV_BUILD[Build Process]
    end
    
    subgraph "CI/CD Pipeline"
        GH_ACTIONS[GitHub Actions]
        TEST_SUITE[Test Suite]
        DOCKER_BUILD[Docker Build]
        SECURITY_SCAN[Security Scan]
    end
    
    subgraph "Container Registry"
        REGISTRY[Fly.io Registry]
        MANAGER_IMG[Manager Image]
        WORKER_IMG[Worker Image]
        DASHBOARD_IMG[Dashboard Image]
    end
    
    subgraph "Deployment Targets"
        STAGING[Staging Environment]
        PRODUCTION[Production Environment]
    end
    
    subgraph "Infrastructure"
        FLY_STAGING[Fly.io Staging]
        FLY_PROD[Fly.io Production]
        SUPABASE[Supabase Instances]
    end
    
    DEV_CODE --> DEV_TEST
    DEV_TEST --> DEV_BUILD
    DEV_BUILD --> GH_ACTIONS
    
    GH_ACTIONS --> TEST_SUITE
    TEST_SUITE --> DOCKER_BUILD
    DOCKER_BUILD --> SECURITY_SCAN
    SECURITY_SCAN --> REGISTRY
    
    REGISTRY --> MANAGER_IMG
    REGISTRY --> WORKER_IMG
    REGISTRY --> DASHBOARD_IMG
    
    MANAGER_IMG --> STAGING
    WORKER_IMG --> STAGING
    DASHBOARD_IMG --> STAGING
    
    STAGING --> FLY_STAGING
    FLY_STAGING --> PRODUCTION
    PRODUCTION --> FLY_PROD
    
    FLY_STAGING --> SUPABASE
    FLY_PROD --> SUPABASE
```

## Monitoring & Observability Stack

```mermaid
graph TB
    subgraph "Data Sources"
        APP[Application Metrics]
        INFRA[Infrastructure Metrics]
        LOGS[Application Logs]
        TRACES[Distributed Traces]
    end
    
    subgraph "Collection Layer"
        PROM[Prometheus]
        LOKI[Loki]
        TEMPO[Tempo]
        OTEL[OpenTelemetry]
    end
    
    subgraph "Storage"
        TSDB[Time Series DB]
        LOG_STORE[Log Storage]
        TRACE_STORE[Trace Storage]
    end
    
    subgraph "Visualization"
        GRAFANA[Grafana Dashboards]
        ALERTS[Alert Manager]
        REPORTS[Custom Reports]
    end
    
    subgraph "Incident Response"
        PAGER[PagerDuty]
        SLACK[Slack Notifications]
        RUNBOOK[Runbook Automation]
    end
    
    APP --> PROM
    INFRA --> PROM
    LOGS --> LOKI
    TRACES --> TEMPO
    
    PROM --> TSDB
    LOKI --> LOG_STORE
    TEMPO --> TRACE_STORE
    OTEL --> PROM
    OTEL --> TEMPO
    
    TSDB --> GRAFANA
    LOG_STORE --> GRAFANA
    TRACE_STORE --> GRAFANA
    
    GRAFANA --> ALERTS
    GRAFANA --> REPORTS
    
    ALERTS --> PAGER
    ALERTS --> SLACK
    PAGER --> RUNBOOK
```

## Error Handling Flow

```mermaid
flowchart TB
    subgraph "Error Detection"
        ERR[Error Occurs]
        TYPE{Error Type?}
    end
    
    subgraph "Error Categories"
        TRANSIENT[Transient Error]
        SYSTEM[System Error]
        USER[User Error]
        CRITICAL[Critical Error]
    end
    
    subgraph "Handling Strategies"
        RETRY[Retry with Backoff]
        CIRCUIT[Circuit Breaker]
        FALLBACK[Fallback Logic]
        ALERT[Alert & Escalate]
    end
    
    subgraph "Recovery Actions"
        HEAL[Self-Healing]
        RESTART[Restart Service]
        SCALE[Scale Resources]
        MANUAL[Manual Intervention]
    end
    
    subgraph "Logging & Monitoring"
        LOG[Log Error]
        METRIC[Update Metrics]
        TRACE[Create Trace]
        NOTIFY[Send Notification]
    end
    
    ERR --> TYPE
    TYPE --> TRANSIENT
    TYPE --> SYSTEM
    TYPE --> USER
    TYPE --> CRITICAL
    
    TRANSIENT --> RETRY
    SYSTEM --> CIRCUIT
    USER --> FALLBACK
    CRITICAL --> ALERT
    
    RETRY --> HEAL
    CIRCUIT --> RESTART
    FALLBACK --> LOG
    ALERT --> MANUAL
    
    HEAL --> SCALE
    RESTART --> METRIC
    SCALE --> TRACE
    MANUAL --> NOTIFY
```