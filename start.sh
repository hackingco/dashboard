  #!/bin/bash

  # Set environment variables for Langfuse tracing
  export LANGFUSE_HOST="http://localhost:3000"
  export CLAUDE_FLOW_LANGFUSE_ENABLED="true"
  export CLAUDE_FLOW_AUTO_FLUSH="true"
  export CLAUDE_FLOW_LOG_COORDINATION="true"
  export CLAUDE_FLOW_LOG_AGENT_ACTIVITIES="true"
  export CLAUDE_FLOW_LOG_MCP_TOOLS="true"

  # Generate unique session ID
  SESSION_ID="hive-mind-$(date +%s)"

  # THE WORKING COMMAND:
  npx claude-flow@alpha hive-mind spawn \
    "Launch a swarm of 8 agents with Queen 
  coordination. Await instructions at claude 
  command-line." \
    --config ./swarm-config.json \
    --agents 8 \
    --claude \
    --session-id="$SESSION_ID" \
    --verbose \
    --auto-flush \
    --trace-coordination \
    --trace-agent-activities \
    --trace-mcp-tools
