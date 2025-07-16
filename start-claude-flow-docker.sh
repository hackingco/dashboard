#!/bin/bash

# Start Claude Flow with Docker-based agents and Langfuse tracing

echo "🚀 Starting Claude Flow with Docker-based execution..."

# Set environment variables
export LANGFUSE_PUBLIC_KEY=${LANGFUSE_PUBLIC_KEY:-"pk-lf-5f279f3c-1d20-47de-b408-3ab49854d3e0"}
export LANGFUSE_SECRET_KEY=${LANGFUSE_SECRET_KEY:-"sk-lf-5f3b4323-450a-49bb-9dfc-f55da800d343"}
export LANGFUSE_HOST=${LANGFUSE_HOST:-"http://localhost:3000"}

# Check if Langfuse is running
echo "🔍 Checking Langfuse status..."
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Langfuse is running on port 3000"
else
    echo "⚠️ Langfuse is not accessible, but tracing will queue traces"
fi

# Create network if it doesn't exist
docker network create swarm03_default 2>/dev/null || true

# Start Claude Flow agents
echo "🐳 Starting Claude Flow Docker containers..."
docker-compose -f docker-compose.claude-flow-agents.yml up -d

# Wait for coordinator to be ready
echo "⏳ Waiting for coordinator to start..."
sleep 5

# Check agent status
echo "📊 Checking agent status..."
curl -s http://localhost:8080/agents | jq .

echo ""
echo "✅ Claude Flow is ready!"
echo ""
echo "🎯 Usage:"
echo "   npx claude-flow@alpha swarm init --agents 4"
echo "   npx claude-flow@alpha task 'Build a REST API'"
echo "   npx claude-flow@alpha status"
echo ""
echo "📊 View traces at: http://localhost:3000"
echo "🛑 To stop: docker-compose -f docker-compose.claude-flow-agents.yml down"