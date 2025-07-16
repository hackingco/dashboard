#!/bin/bash

# ===================================================================
# WORKING LANGFUSE COMMAND FOR HIVE MIND
# ===================================================================

# Set environment variables for Langfuse tracing
export LANGFUSE_HOST="http://localhost:3000"
export CLAUDE_FLOW_LANGFUSE_ENABLED="true"
export CLAUDE_FLOW_AUTO_FLUSH="true"
export CLAUDE_FLOW_LOG_COORDINATION="true"
export CLAUDE_FLOW_LOG_AGENT_ACTIVITIES="true"
export CLAUDE_FLOW_LOG_MCP_TOOLS="true"
export CLAUDE_FLOW_LOG_METRICS="true"
export CLAUDE_FLOW_LOG_NEURAL="true"
export CLAUDE_FLOW_LOG_MEMORY="true"

# Generate unique session ID
SESSION_ID="hive-mind-$(date +%s)"
TRACE_NAME="Hive-Mind-Swarm-Launch-$(date +%Y%m%d-%H%M%S)"

echo "🐝 HIVE MIND WITH LANGFUSE TRACING"
echo "================================="
echo "📊 Langfuse Host: $LANGFUSE_HOST"
echo "🆔 Session ID: $SESSION_ID"
echo "🏷️  Trace Name: $TRACE_NAME"
echo "📈 Tracing: ENABLED"
echo ""

# THE WORKING COMMAND:
npx claude-flow@alpha hive-mind spawn \
  "Launch a swarm of 8 agents with Queen coordination. Await instructions at claude command-line." \
  --config ./swarm-config.json \
  --agents 8 \
  --claude \
  --session-id="$SESSION_ID" \
  --trace-name="$TRACE_NAME" \
  --verbose \
  --auto-flush \
  --trace-coordination \
  --trace-agent-activities \
  --trace-mcp-tools \
  --trace-metrics \
  --trace-neural \
  --trace-memory

echo ""
echo "✅ Hive Mind launched with Langfuse tracing!"
echo "🔍 View traces at: $LANGFUSE_HOST"
echo "🆔 Session ID: $SESSION_ID"