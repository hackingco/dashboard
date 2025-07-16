#!/bin/bash

# Load Langfuse environment variables
source .env.langfuse

# Export environment variables for the command
export LANGFUSE_PUBLIC_KEY="$LANGFUSE_PUBLIC_KEY"
export LANGFUSE_SECRET_KEY="$LANGFUSE_SECRET_KEY"
export LANGFUSE_HOST="http://localhost:3000"
export CLAUDE_FLOW_LANGFUSE_ENABLED="true"
export CLAUDE_FLOW_AUTO_FLUSH="true"
export CLAUDE_FLOW_LOG_COORDINATION="true"
export CLAUDE_FLOW_LOG_AGENT_ACTIVITIES="true"
export CLAUDE_FLOW_LOG_MCP_TOOLS="true"

# Generate session ID with timestamp
SESSION_ID="hive-mind-$(date +%s)"

echo "🐝 Starting Hive Mind with Langfuse Tracing"
echo "📊 Langfuse Host: http://localhost:3000"
echo "🔑 Public Key: $LANGFUSE_PUBLIC_KEY"
echo "🆔 Session ID: $SESSION_ID"
echo ""

# Test Langfuse connection first
echo "🔍 Testing Langfuse connection..."
curl -s -H "Content-Type: application/json" -X POST http://localhost:3000/api/public/ingestion \
  -d '{"batch":[{"type":"trace-create","timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","body":{"id":"test-trace","name":"Claude Flow Test","sessionId":"test-session","metadata":{"source":"claude-flow"}}}]}' \
  && echo "✅ Langfuse connection successful!" \
  || echo "❌ Langfuse connection failed!"

echo ""
echo "🚀 Launching hive mind..."

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