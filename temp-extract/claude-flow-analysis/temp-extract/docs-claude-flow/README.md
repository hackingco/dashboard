# Claude Flow - Advanced Swarm Orchestration System

## Overview

Claude Flow is a cutting-edge orchestration platform for managing distributed AI agent swarms with advanced coordination, memory management, and real-time monitoring capabilities. It serves as the central nervous system for coordinating multiple AI agents in complex workflows.

## Core Features

### 🧠 Intelligent Swarm Coordination
- **Multi-topology Support**: Hierarchical, mesh, ring, and star topologies
- **Dynamic Agent Allocation**: Smart agent assignment based on task complexity
- **Parallel Execution**: Concurrent operations for maximum efficiency
- **Auto-scaling**: Dynamic resource allocation based on workload

### 🔗 Advanced Integration
- **MCP (Model Context Protocol) Integration**: Seamless coordination with Claude Code
- **Langfuse Observability**: Complete tracing and monitoring
- **GitHub Integration**: Repository-aware swarms for code management
- **Memory Persistence**: Cross-session memory with SQLite backend

### 🚀 Performance Optimized
- **84.8% SWE-Bench solve rate** - Industry-leading problem-solving capability
- **32.3% token reduction** - Efficient resource utilization
- **2.8-4.4x speed improvement** - Parallel coordination strategies
- **27+ neural models** - Diverse cognitive approaches

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Claude Flow Platform                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │    MCP      │  │   Memory     │  │   Coordination   │  │
│  │ Integration │  │  Management  │  │    Services      │  │
│  │             │  │              │  │                  │  │
│  └─────────────┘  └──────────────┘  └──────────────────┘  │
│                                                             │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │    Hook     │  │   Neural     │  │    GitHub        │  │
│  │   System    │  │  Patterns    │  │  Integration     │  │
│  └─────────────┘  └──────────────┘  └──────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │              Agent Orchestration Layer              │  │
│  │  • Task Distribution  • Performance Monitoring      │  │
│  │  • Resource Allocation  • Error Recovery            │  │
│  └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- Claude Code installation
- Git for version control

### Installation

1. **Install Claude Flow MCP Server**
   ```bash
   # Add to Claude Code using stdio (recommended)
   claude mcp add claude-flow npx claude-flow@alpha mcp start
   ```

2. **Configure Environment**
   ```bash
   # Copy environment template
   cp .env.example .env
   
   # Edit configuration
   nano .env
   ```

3. **Initialize First Swarm**
   ```javascript
   // In Claude Code, use MCP tools for coordination
   mcp__claude-flow__swarm_init({
     topology: "hierarchical",
     maxAgents: 5,
     strategy: "balanced"
   });
   ```

### Basic Usage

#### Initialize a Swarm
```javascript
// Set up coordination topology
const swarmConfig = {
  topology: "mesh",        // mesh, hierarchical, ring, star
  maxAgents: 6,           // Number of agents
  strategy: "parallel"    // Execution strategy
};
```

#### Spawn Agents
```javascript
// Create specialized agents
const agents = [
  { type: "researcher", name: "Data Analyst" },
  { type: "coder", name: "Backend Developer" },
  { type: "tester", name: "QA Engineer" },
  { type: "coordinator", name: "Project Manager" }
];
```

#### Orchestrate Tasks
```javascript
// Coordinate complex workflows
const task = {
  name: "Build REST API",
  strategy: "adaptive",
  components: ["auth", "database", "endpoints", "tests"]
};
```

## Configuration

### Environment Variables

```bash
# Core Configuration
CLAUDE_FLOW_ENABLED=true
CLAUDE_FLOW_TOPOLOGY=hierarchical
CLAUDE_FLOW_MAX_AGENTS=8

# Memory Configuration
MEMORY_DB_PATH=.swarm/memory.db
MEMORY_PERSISTENCE=true
CROSS_SESSION_MEMORY=true

# Langfuse Integration
LANGFUSE_PUBLIC_KEY=your_public_key
LANGFUSE_SECRET_KEY=your_secret_key
LANGFUSE_HOST=https://cloud.langfuse.com

# GitHub Integration
GITHUB_TOKEN=your_github_token
GITHUB_WEBHOOKS_ENABLED=true

# Performance Tuning
PARALLEL_EXECUTION=true
AUTO_OPTIMIZATION=true
NEURAL_TRAINING=true
```

### MCP Tools Reference

#### Coordination Tools
- `mcp__claude-flow__swarm_init` - Initialize swarm topology
- `mcp__claude-flow__agent_spawn` - Create specialized agents
- `mcp__claude-flow__task_orchestrate` - Coordinate complex tasks

#### Monitoring Tools
- `mcp__claude-flow__swarm_status` - Monitor swarm health
- `mcp__claude-flow__agent_metrics` - Track agent performance
- `mcp__claude-flow__task_results` - Review task outcomes

#### Memory & Neural Tools
- `mcp__claude-flow__memory_usage` - Persistent memory management
- `mcp__claude-flow__neural_train` - Improve coordination patterns
- `mcp__claude-flow__neural_patterns` - Analyze thinking approaches

#### GitHub Integration Tools
- `mcp__claude-flow__github_swarm` - Repository management swarms
- `mcp__claude-flow__repo_analyze` - Deep repository analysis
- `mcp__claude-flow__pr_enhance` - AI-powered PR improvements

## Hook System

Claude Flow includes powerful hooks for automation:

### Pre-Operation Hooks
```bash
# Before file edits
npx claude-flow@alpha hooks pre-edit --file "src/app.js" --auto-assign-agents true

# Before command execution
npx claude-flow@alpha hooks pre-command --command "npm test" --validate-safety true

# Before task execution
npx claude-flow@alpha hooks pre-task --description "Build API" --load-context true
```

### Post-Operation Hooks
```bash
# After file edits
npx claude-flow@alpha hooks post-edit --file "src/app.js" --format true --train-neural true

# After command execution
npx claude-flow@alpha hooks post-command --command "build" --track-metrics true

# After task completion
npx claude-flow@alpha hooks post-task --task-id "api-build" --analyze-performance true
```

### Session Management
```bash
# End session
npx claude-flow@alpha hooks session-end --generate-summary true --export-metrics true

# Restore session
npx claude-flow@alpha hooks session-restore --session-id "previous-session"
```

## Advanced Features

### Neural Pattern Learning
Claude Flow continuously learns from successful operations:
- **Pattern Recognition**: Identifies optimal coordination strategies
- **Performance Optimization**: Automatically improves based on metrics
- **Adaptive Topologies**: Dynamic topology selection based on task complexity

### GitHub Integration
Repository-aware swarms for code management:
```javascript
// Create GitHub-specific swarm
mcp__claude-flow__github_swarm({
  repository: "owner/repo",
  agents: 5,
  focus: "maintenance"
});

// Analyze repository health
mcp__claude-flow__repo_analyze({
  deep: true,
  include: ["issues", "prs", "code"]
});
```

### Cross-Session Memory
Persistent context across sessions:
```javascript
// Store important decisions
mcp__claude-flow__memory_usage({
  action: "store",
  key: "project/decisions",
  value: { architecture: "microservices", database: "postgresql" }
});

// Retrieve context
mcp__claude-flow__memory_usage({
  action: "retrieve",
  key: "project/decisions"
});
```

## Best Practices

### Coordination Patterns
1. **Always use parallel execution** - Batch operations in single messages
2. **Leverage memory** - Store decisions and context for consistency
3. **Monitor performance** - Use metrics to optimize coordination
4. **Train neural patterns** - Enable continuous learning
5. **GitHub integration** - Use repository-aware swarms

### Performance Optimization
- **Batch TodoWrite calls** - Include 5-10+ todos in single call
- **Spawn agents in parallel** - Never spawn sequentially
- **Use efficient topologies** - Match topology to task complexity
- **Enable auto-optimization** - Let system learn optimal patterns

### Error Handling
- **Graceful degradation** - System works without external dependencies
- **Auto-recovery** - Self-healing workflows
- **Comprehensive logging** - Full traceability with Langfuse

## Workflow Examples

### Research Coordination
```javascript
// 1. Initialize research swarm
mcp__claude-flow__swarm_init({
  topology: "mesh",
  maxAgents: 5,
  strategy: "balanced"
});

// 2. Spawn research agents
agents.forEach(agent => {
  mcp__claude-flow__agent_spawn({
    type: agent.type,
    name: agent.name
  });
});

// 3. Coordinate research execution
mcp__claude-flow__task_orchestrate({
  task: "Research neural architecture search papers",
  strategy: "adaptive"
});
```

### Development Coordination
```javascript
// 1. Set up development swarm
mcp__claude-flow__swarm_init({
  topology: "hierarchical",
  maxAgents: 8,
  strategy: "specialized"
});

// 2. Define development roles
const roles = [
  { type: "architect", name: "System Designer" },
  { type: "coder", name: "API Developer" },
  { type: "tester", name: "QA Engineer" },
  { type: "coordinator", name: "Tech Lead" }
];

// 3. Coordinate implementation
mcp__claude-flow__task_orchestrate({
  task: "Implement user authentication with JWT",
  strategy: "parallel"
});
```

## Troubleshooting

### Common Issues

#### MCP Connection Issues
```bash
# Check MCP server status
claude mcp list

# Restart MCP server
claude mcp restart claude-flow
```

#### Memory Database Issues
```bash
# Check database integrity
npx claude-flow@alpha hooks session-restore --validate-db true

# Reset database if corrupted
rm .swarm/memory.db
npx claude-flow@alpha hooks pre-task --description "Initialize fresh database"
```

#### Performance Issues
```bash
# Check coordination metrics
mcp__claude-flow__agent_metrics

# Analyze bottlenecks
npx claude-flow@alpha hooks session-end --analyze-performance true
```

### Debug Mode
Enable verbose logging:
```bash
export DEBUG=claude-flow:*
export CLAUDE_FLOW_VERBOSE=true
```

## Development

### Building from Source
```bash
# Clone repository
git clone https://github.com/ruvnet/claude-flow.git
cd claude-flow

# Install dependencies
npm install

# Build TypeScript
npm run build

# Run tests
npm test
```

### Contributing
1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## Support & Community

- **Documentation**: [https://github.com/ruvnet/claude-flow](https://github.com/ruvnet/claude-flow)
- **Issues**: [GitHub Issues](https://github.com/ruvnet/claude-flow/issues)
- **Examples**: [Example Repository](https://github.com/ruvnet/claude-flow/tree/main/examples)
- **Discussions**: [GitHub Discussions](https://github.com/ruvnet/claude-flow/discussions)

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- Built with TypeScript and Node.js
- Powered by MCP (Model Context Protocol)
- Integrated with Langfuse for observability
- Designed for Claude Code compatibility

---

**Claude Flow coordinates, Claude Code creates!** Start with `mcp__claude-flow__swarm_init` to enhance your development workflow.