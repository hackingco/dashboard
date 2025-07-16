# Claude-Flow v2.0.0 Alpha Implementation Requirements

## 📋 Executive Summary

Claude-Flow v2.0.0 Alpha is a CLI tool and MCP server that enhances Claude Code's capabilities with:
- Persistent global installation
- Database-backed swarm coordination
- Hook system for automation
- MCP server integration
- Supabase integration for persistence

## 🎯 Core Requirements

### 1. Installation & Distribution

#### 1.1 NPM Package Structure
- **Package Name**: `claude-flow`
- **Version**: `2.0.0-alpha.X` (currently at alpha.27 based on wrapper)
- **Scope**: Public NPM package
- **Binary**: `claude-flow` executable in PATH after global install

#### 1.2 Installation Methods
```bash
# Global installation (persistent in PATH)
npm install -g claude-flow@alpha

# Local project installation
npm install claude-flow@alpha

# Direct execution via npx
npx claude-flow@alpha [command]
```

#### 1.3 Package Contents
```
claude-flow/
├── bin/
│   └── claude-flow.js       # Main CLI entry point
├── src/
│   ├── cli/                 # CLI command handlers
│   ├── mcp/                 # MCP server implementation
│   ├── hooks/               # Hook system
│   ├── db/                  # Database integration
│   └── swarm/               # Swarm coordination logic
├── templates/               # Project templates
├── package.json
└── README.md
```

### 2. CLI Commands & Features

#### 2.1 Core Commands
```bash
# MCP Server
claude-flow mcp start        # Start MCP server (stdio mode)
claude-flow mcp stop         # Stop MCP server

# Swarm Management
claude-flow swarm init       # Initialize swarm with topology
claude-flow swarm status     # Check swarm status
claude-flow agent spawn      # Spawn new agents
claude-flow task orchestrate # Orchestrate tasks

# Hooks System
claude-flow hooks pre-task   # Pre-task coordination
claude-flow hooks post-edit  # Post-edit tracking
claude-flow hooks notify     # Send notifications

# Memory & Persistence
claude-flow memory store     # Store to persistent memory
claude-flow memory retrieve  # Retrieve from memory
claude-flow memory list      # List memory entries

# Database Management
claude-flow db init          # Initialize database
claude-flow db migrate       # Run migrations
claude-flow db status        # Check database status
```

#### 2.2 Argument Parsing
- Support for `--agents N` to specify agent count
- Configuration via `.claude-flow.json` or environment variables
- Support for both stdio and WebSocket MCP modes

### 3. Database Integration

#### 3.1 Supabase Tables (Existing)
- **swarms**: Swarm configuration and status
- **workers**: Individual agent/worker tracking
- **tasks**: Task queue and status
- **logs**: Activity logging
- **metrics**: Performance metrics
- **templates**: Reusable swarm templates

#### 3.2 Local SQLite (.swarm/memory.db)
- Session state persistence
- Hook execution history
- Coordination metadata
- Cache for frequently accessed data

#### 3.3 Database Operations
```javascript
// Example database interface
class DatabaseManager {
  async initializeSwarm(config) { /* ... */ }
  async spawnAgent(swarmId, agentConfig) { /* ... */ }
  async createTask(taskConfig) { /* ... */ }
  async updateTaskStatus(taskId, status) { /* ... */ }
  async getSwarmStatus(swarmId) { /* ... */ }
}
```

### 4. MCP Server Implementation

#### 4.1 MCP Tools to Implement
```typescript
// Swarm Management
mcp__claude-flow__swarm_init
mcp__claude-flow__swarm_status
mcp__claude-flow__swarm_monitor
mcp__claude-flow__swarm_destroy

// Agent Management
mcp__claude-flow__agent_spawn
mcp__claude-flow__agent_list
mcp__claude-flow__agent_metrics

// Task Management
mcp__claude-flow__task_orchestrate
mcp__claude-flow__task_status
mcp__claude-flow__task_results

// Neural & Memory
mcp__claude-flow__neural_status
mcp__claude-flow__neural_train
mcp__claude-flow__memory_usage

// Performance
mcp__claude-flow__benchmark_run
mcp__claude-flow__bottleneck_analyze
```

#### 4.2 MCP Server Architecture
```javascript
// MCP Server implementation
class ClaudeFlowMCPServer {
  constructor(db, config) {
    this.db = db;
    this.config = config;
  }

  async handleRequest(method, params) {
    switch(method) {
      case 'swarm_init':
        return this.initializeSwarm(params);
      // ... other methods
    }
  }
}
```

### 5. Hook System

#### 5.1 Hook Types
- **Pre-operation hooks**: Validation and preparation
- **Post-operation hooks**: Logging and learning
- **Session hooks**: State management
- **MCP integration hooks**: Coordination tracking

#### 5.2 Hook Implementation
```javascript
class HookManager {
  async executeHook(hookName, params) {
    // Log to SQLite
    await this.db.logHookExecution(hookName, params);
    
    // Execute hook logic
    switch(hookName) {
      case 'pre-task':
        return this.preTaskHook(params);
      case 'post-edit':
        return this.postEditHook(params);
      // ... other hooks
    }
  }
}
```

### 6. Integration Points

#### 6.1 Claude Code Integration
- Wrapper scripts already exist (claude-flow, claude-flow.bat, claude-flow.ps1)
- MCP tools accessible via `mcp__claude-flow__` prefix
- Hooks callable via CLI commands

#### 6.2 Supabase Integration
```javascript
// Supabase client configuration
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);
```

#### 6.3 Environment Configuration
```bash
# Required environment variables
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=xxxxx
CLAUDE_FLOW_DB_PATH=.swarm/memory.db
CLAUDE_FLOW_MODE=stdio|websocket
```

### 7. File Structure Requirements

#### 7.1 Project Files
```
/project-root/
├── .claude-flow.json        # Project configuration
├── .swarm/
│   ├── memory.db           # SQLite database
│   └── logs/               # Hook execution logs
├── .claude/
│   ├── settings.json       # Claude Code settings
│   └── commands/           # Custom commands
└── node_modules/
    └── claude-flow/        # Installed package
```

#### 7.2 Global Installation
```
~/.npm/bin/claude-flow      # Global executable
~/.claude-flow/             # Global configuration
  ├── config.json
  ├── templates/
  └── cache/
```

### 8. Implementation Priorities

#### Phase 1: Core CLI & Database (Week 1)
1. Basic CLI structure with commander.js
2. SQLite initialization and management
3. Supabase connection and basic operations
4. Core commands (init, status, help)

#### Phase 2: MCP Server (Week 2)
1. Stdio-based MCP server implementation
2. Core MCP tools (swarm_init, agent_spawn, task_orchestrate)
3. Integration with Claude Code
4. Basic error handling

#### Phase 3: Hooks System (Week 3)
1. Hook manager implementation
2. Pre/post operation hooks
3. Session management hooks
4. Persistence to SQLite

#### Phase 4: Advanced Features (Week 4)
1. Neural pattern learning
2. Performance optimization
3. Template system
4. Advanced coordination features

### 9. Technical Stack

- **Runtime**: Node.js 18+
- **CLI Framework**: Commander.js or Yargs
- **Database**: SQLite (local) + Supabase (remote)
- **MCP Protocol**: JSON-RPC over stdio
- **Package Manager**: NPM
- **Testing**: Jest or Vitest
- **Build Tool**: ESBuild or Rollup

### 10. Success Criteria

1. ✅ Global installation via `npm install -g claude-flow@alpha`
2. ✅ `claude-flow` command available in PATH
3. ✅ MCP server starts with `claude mcp add claude-flow npx claude-flow@alpha mcp start`
4. ✅ All MCP tools accessible in Claude Code
5. ✅ Hooks execute and persist to database
6. ✅ Swarm coordination data persists in Supabase
7. ✅ Session state recoverable across restarts

## 📊 Current State Analysis

### Existing Assets
1. **Wrapper Scripts**: Unix/Windows/PowerShell wrappers exist
2. **Database Schema**: Complete Supabase schema with all required tables
3. **Project Structure**: Monorepo with workspaces configured
4. **Memory System**: Basic SQLite persistence at `.swarm/memory.db`

### Missing Components
1. **NPM Package**: No actual claude-flow package published
2. **MCP Server**: Implementation needed
3. **Hook System**: Basic hooks exist via npx, need full implementation
4. **CLI Commands**: Only wrapper exists, no actual CLI
5. **Database Integration**: Supabase client not connected
6. **Documentation**: User and developer documentation needed

## 🚀 Next Steps

1. Create NPM package structure
2. Implement core CLI with commander.js
3. Set up Supabase client integration
4. Build MCP server with stdio support
5. Implement hook system with SQLite persistence
6. Create comprehensive test suite
7. Publish to NPM as @alpha version

---

*This requirements document defines the complete specification for Claude-Flow v2.0.0 Alpha implementation.*