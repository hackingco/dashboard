# Claude Flow - AI Agent Orchestration MCP Server

## Overview

Claude Flow is a powerful MCP (Model Context Protocol) server that enhances Claude Code with advanced agent orchestration, swarm coordination, and persistent memory capabilities. It provides a comprehensive suite of tools for managing AI agent workflows, real-time coordination, and intelligent task distribution.

## ✨ Key Features

🎯 **Advanced Agent Orchestration**
- Real-time swarm coordination and management
- Dynamic agent spawning and lifecycle management
- Intelligent task distribution and load balancing
- Multi-topology support (mesh, hierarchical, ring, star)

🧠 **Persistent Memory System**
- Cross-session memory persistence
- Intelligent context management
- Neural pattern learning and optimization
- Performance tracking and analytics

⚡ **High-Performance Architecture**
- Docker-based containerization
- Horizontal scaling capabilities
- Real-time WebSocket communication
- Langfuse integration for observability

🔧 **Developer Experience**
- Simple MCP server setup
- Comprehensive CLI tooling
- Hook system for automation
- Template-based project initialization

## Quick Start

### Installation

```bash
# Global installation
npm install -g claude-flow@alpha

# Or use directly with npx
npx claude-flow@alpha --help
```

### Adding to Claude Code

```bash
# Add as MCP server (recommended)
claude mcp add claude-flow npx claude-flow@alpha mcp start

# Verify installation
claude mcp list
```

### Basic Usage

```bash
# Initialize a new swarm
npx claude-flow@alpha init

# Start swarm coordination
npx claude-flow@alpha swarm init --topology mesh --agents 5

# Spawn specialized agents
npx claude-flow@alpha agent spawn --type researcher
npx claude-flow@alpha agent spawn --type coder

# Monitor swarm status
npx claude-flow@alpha swarm status
```

## Architecture

Claude Flow consists of several key components:

- **MCP Server**: Provides tools for Claude Code integration
- **Swarm Coordinator**: Manages agent lifecycle and coordination
- **Memory System**: Persistent storage and context management
- **Hook System**: Automated workflow triggers
- **Analytics Engine**: Performance monitoring and optimization

## Documentation

- [Getting Started Guide](docs/getting-started.md)
- [API Reference](docs/api-reference.md)
- [System Architecture](docs/architecture.md)
- [Configuration Options](docs/configuration.md)
- [Deployment Guide](docs/deployment.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Examples](docs/examples/)

## Requirements

- Node.js 18+ 
- Redis (for caching and coordination)
- PostgreSQL or SQLite (for persistence)
- Docker (optional, for containerized deployments)

## Environment Configuration

Create a `.env` file with the following variables:

```env
# Core Configuration
CLAUDE_FLOW_MODE=production
CLAUDE_FLOW_PORT=3000
CLAUDE_FLOW_HOST=localhost

# Database Configuration
DATABASE_URL=postgresql://user:pass@localhost:5432/claude_flow
# Or for SQLite: sqlite:./claude-flow.db

# Redis Configuration
REDIS_URL=redis://localhost:6379

# Langfuse Integration (Optional)
LANGFUSE_PUBLIC_KEY=pk_...
LANGFUSE_SECRET_KEY=sk_...
LANGFUSE_HOST=https://langfuse.example.com

# Agent Configuration
MAX_AGENTS=12
DEFAULT_TOPOLOGY=mesh
AUTO_SCALING=true
```

## Performance

Claude Flow is designed for high-performance scenarios:

- **Swarm Creation**: < 3 seconds (cold start)
- **Agent Spawning**: < 1 second per agent
- **Memory Operations**: < 100ms (with Redis)
- **Cross-Agent Coordination**: < 50ms latency
- **Horizontal Scaling**: 100+ concurrent agents

## Contributing

We welcome contributions! Please see our [Contributing Guide](../CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone and install
git clone https://github.com/your-org/claude-flow.git
cd claude-flow
npm install

# Start development server
npm run dev

# Run tests
npm test
```

## License

MIT License - see [LICENSE](../LICENSE) for details.

## Support

- [Documentation](docs/)
- [GitHub Issues](https://github.com/your-org/claude-flow/issues)
- [Discussions](https://github.com/your-org/claude-flow/discussions)

---

*Claude Flow is part of the Claude Code ecosystem, enhancing AI development workflows with intelligent agent coordination and persistent memory capabilities.*