#!/bin/bash

# Load Langfuse environment variables
source .env.langfuse

# Export environment variables for the command
export LANGFUSE_PUBLIC_KEY="$LANGFUSE_PUBLIC_KEY"
export LANGFUSE_SECRET_KEY="$LANGFUSE_SECRET_KEY"
export LANGFUSE_HOST="$LANGFUSE_HOST"
export CLAUDE_FLOW_LANGFUSE_ENABLED="true"
export CLAUDE_FLOW_AUTO_FLUSH="true"
export CLAUDE_FLOW_LOG_COORDINATION="true"
export CLAUDE_FLOW_LOG_AGENT_ACTIVITIES="true"
export CLAUDE_FLOW_LOG_MCP_TOOLS="true"

# Generate session ID with timestamp
SESSION_ID="hive-mind-$(date +%s)"

echo "🐝 Starting Hive Mind with Langfuse Tracing"
echo "📊 Langfuse Host: $LANGFUSE_HOST"
echo "🔑 Public Key: $LANGFUSE_PUBLIC_KEY"
echo "🆔 Session ID: $SESSION_ID"
echo ""

# Run the command with all environment variables
npx claude-flow@alpha hive-mind spawn \
  "Launch a swarm of 8 agents with Queen coordination. Await instructions at claude command-line." \
  --config ./swarm-config.json \
  --agents 8 \
  --claude \
  --session-id="$SESSION_ID" \
  --verbose \
  --auto-flush \
  --trace-coordination \
  --trace-agent-activities \
  --trace-mcp-tools