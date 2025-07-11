# Claude-Flow v2.0.0 CLI Command Structure

## Global Command Registration

```typescript
// Command Registry Pattern
interface CommandRegistry {
  commands: Map<string, Command>;
  aliases: Map<string, string>;
  
  register(command: Command): void;
  execute(args: string[]): Promise<void>;
}

// Command Definition
interface Command {
  name: string;
  description: string;
  aliases?: string[];
  subcommands?: Command[];
  options: Option[];
  handler: CommandHandler;
  examples?: Example[];
}
```

## Command Hierarchy

### Root Commands

```bash
claude-flow <command> [options]

Commands:
  swarm      Manage AI agent swarms
  agent      Control individual agents
  task       Orchestrate and monitor tasks
  memory     Persistent memory operations
  hooks      Manage coordination hooks
  mcp        MCP server management
  github     GitHub integration features
  sparc      SPARC development modes
  config     Configuration management
  plugin     Plugin management
  help       Show help information
```

### Swarm Commands

```bash
claude-flow swarm <subcommand> [options]

Subcommands:
  init       Initialize a new swarm
  list       List all active swarms
  status     Show swarm status and metrics
  monitor    Real-time swarm monitoring
  scale      Scale swarm size
  destroy    Gracefully shutdown swarm
  
Examples:
  # Initialize hierarchical swarm with 8 agents
  claude-flow swarm init --topology hierarchical --agents 8
  
  # Monitor swarm in real-time
  claude-flow swarm monitor --interval 1s
  
  # Scale swarm to 12 agents
  claude-flow swarm scale <swarm-id> --size 12
```

### Agent Commands

```bash
claude-flow agent <subcommand> [options]

Subcommands:
  spawn      Create a new agent
  list       List all agents
  status     Show agent status
  metrics    View agent performance metrics
  assign     Assign task to agent
  terminate  Remove agent from swarm
  
Examples:
  # Spawn a coder agent
  claude-flow agent spawn --type coder --name "API Developer"
  
  # View agent metrics
  claude-flow agent metrics <agent-id> --metric all
  
  # Assign task to specific agent
  claude-flow agent assign <agent-id> --task "Implement auth endpoints"
```

### Task Commands

```bash
claude-flow task <subcommand> [options]

Subcommands:
  orchestrate  Create and distribute tasks
  status       Check task execution status
  results      Retrieve task results
  cancel       Cancel running task
  retry        Retry failed task
  
Examples:
  # Orchestrate complex task
  claude-flow task orchestrate "Build REST API with auth" --strategy parallel --priority high
  
  # Check all task statuses
  claude-flow task status --detailed
  
  # Get results with formatting
  claude-flow task results <task-id> --format json
```

### Memory Commands

```bash
claude-flow memory <subcommand> [options]

Subcommands:
  store      Store value in memory
  get        Retrieve value from memory
  search     Search memory with patterns
  list       List memory entries
  delete     Delete memory entry
  sync       Force sync with remote
  export     Export memory to file
  import     Import memory from file
  
Examples:
  # Store decision in memory
  claude-flow memory store "decisions/auth" '{"type": "JWT", "expiry": "24h"}'
  
  # Search for patterns
  claude-flow memory search "decisions/*" --limit 10
  
  # Export session memory
  claude-flow memory export --namespace "session-123" --output session.json
```

### Hooks Commands

```bash
claude-flow hooks <subcommand> [options]

Subcommands:
  pre-task     Execute before task
  post-task    Execute after task
  pre-edit     Validate before edits
  post-edit    Process after edits
  notify       Send notifications
  list         List registered hooks
  enable       Enable hook
  disable      Disable hook
  
Examples:
  # Pre-task coordination
  claude-flow hooks pre-task --description "API implementation" --auto-spawn false
  
  # Post-edit with memory
  claude-flow hooks post-edit --file "api.js" --memory-key "edits/api"
  
  # Custom notification
  claude-flow hooks notify --message "Build complete" --level success
```

### MCP Commands

```bash
claude-flow mcp <subcommand> [options]

Subcommands:
  start      Start MCP server
  stop       Stop MCP server
  status     Check server status
  tools      List available tools
  test       Test MCP connection
  
Examples:
  # Start MCP server with stdio
  claude-flow mcp start --transport stdio
  
  # Start with WebSocket
  claude-flow mcp start --transport websocket --port 3000
  
  # List all tools
  claude-flow mcp tools --format table
```

### GitHub Commands

```bash
claude-flow github <subcommand> [options]

Subcommands:
  swarm      Create GitHub-focused swarm
  analyze    Analyze repository
  pr         Manage pull requests
  issue      Manage issues
  workflow   GitHub Actions automation
  
Examples:
  # Create repo management swarm
  claude-flow github swarm --repo owner/name --agents 5
  
  # Deep repository analysis
  claude-flow github analyze --repo owner/name --include "issues,prs,code"
  
  # Enhance pull request
  claude-flow github pr enhance --repo owner/name --pr 123 --add-tests
```

### SPARC Commands

```bash
claude-flow sparc <mode> [options]

Modes:
  dev        Development mode
  api        API development mode
  ui         UI development mode
  test       Test development mode
  refactor   Refactoring mode
  
Examples:
  # Start SPARC dev mode
  claude-flow sparc dev --task "Build authentication system"
  
  # API-focused development
  claude-flow sparc api --openapi spec.yaml
  
  # Refactoring mode
  claude-flow sparc refactor --target "src/legacy" --pattern "modernize"
```

## Option Patterns

### Global Options
```bash
--help, -h          Show help
--version, -v       Show version
--config, -c        Config file path
--verbose           Verbose output
--quiet, -q         Suppress output
--json              JSON output format
--no-telemetry      Disable telemetry
--profile           Enable profiling
```

### Common Patterns
```bash
# Resource identifiers
--id <id>           Resource ID
--name <name>       Resource name

# Formatting
--format <fmt>      Output format (json|table|yaml)
--output <file>     Output to file

# Filtering
--filter <expr>     Filter expression
--limit <n>         Result limit
--offset <n>        Result offset

# Async operations
--wait              Wait for completion
--timeout <dur>     Operation timeout
--poll <interval>   Polling interval
```

## Interactive Mode

```bash
# Start interactive REPL
claude-flow interactive

> swarm init mesh 6
🐝 Swarm initialized: swarm-abc123

> agent spawn coder "Backend Dev"
🤖 Agent spawned: agent-def456

> task orchestrate "Build REST API"
📋 Task orchestrated: task-ghi789

> memory store "progress" "25%"
💾 Memory stored

> exit
👋 Goodbye!
```

## Command Composition

```bash
# Pipe commands together
claude-flow swarm list --json | jq '.[] | select(.status == "active")'

# Use with other tools
claude-flow task results <id> --format json | python analyze.py

# Batch operations
cat agents.txt | xargs -I {} claude-flow agent spawn --type {}

# Watch mode
watch -n 1 claude-flow swarm status <id>
```

## Configuration File

```yaml
# .claude-flow.yml
defaults:
  swarm:
    topology: hierarchical
    maxAgents: 8
  memory:
    namespace: project-x
    syncInterval: 30s
  hooks:
    autoFormat: true
    telemetry: true

aliases:
  si: swarm init
  as: agent spawn
  to: task orchestrate
  
profiles:
  dev:
    verbose: true
    telemetry: false
  prod:
    quiet: true
    telemetry: true
```

## Environment Variables

```bash
# API Configuration
CLAUDE_FLOW_API_KEY=your-api-key
CLAUDE_FLOW_API_URL=https://api.claude-flow.com

# Database
CLAUDE_FLOW_DB_URL=postgresql://...
CLAUDE_FLOW_SUPABASE_KEY=your-key

# Local Storage
CLAUDE_FLOW_DATA_DIR=~/.claude-flow
CLAUDE_FLOW_MEMORY_DB=.swarm/memory.db

# Behavior
CLAUDE_FLOW_AUTO_SYNC=true
CLAUDE_FLOW_TELEMETRY=true
CLAUDE_FLOW_LOG_LEVEL=info
```

## Error Handling

```bash
# Structured errors
{
  "error": {
    "code": "SWARM_NOT_FOUND",
    "message": "Swarm with ID 'xyz' not found",
    "details": {
      "id": "xyz",
      "suggestion": "Run 'claude-flow swarm list' to see available swarms"
    }
  }
}

# Exit codes
0   Success
1   General error
2   Command not found
3   Invalid arguments
4   Resource not found
5   Permission denied
6   Network error
7   Database error
8   Timeout
```

## Shell Completions

```bash
# Bash completion
claude-flow completion bash > /etc/bash_completion.d/claude-flow

# Zsh completion
claude-flow completion zsh > ~/.zsh/completions/_claude-flow

# Fish completion
claude-flow completion fish > ~/.config/fish/completions/claude-flow.fish

# PowerShell completion
claude-flow completion powershell > $PROFILE
```