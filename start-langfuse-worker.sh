#!/bin/bash

# Start Langfuse Worker for Hive Mind Swarm
# This script starts the Langfuse worker with proper configuration

echo "🚀 Starting Langfuse Worker for Hive Mind Swarm"
echo "=============================================="

# Check if required environment files exist
if [ ! -f ".env.langfuse" ]; then
    echo "❌ Error: .env.langfuse file not found!"
    echo "Please create .env.langfuse with your Langfuse configuration"
    exit 1
fi

# Check if Langfuse is running
echo "🔍 Checking Langfuse connection..."
if ! curl -s --connect-timeout 5 http://localhost:3000 > /dev/null 2>&1; then
    echo "⚠️  Warning: Langfuse server not responding at http://localhost:3000"
    echo "Please ensure Langfuse is running with: docker-compose up langfuse"
fi

# Check if Node.js and required packages are available
echo "📦 Checking dependencies..."
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js not found!"
    exit 1
fi

if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found!"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Check if langfuse package is installed
if ! npm list langfuse &> /dev/null; then
    echo "📦 Installing langfuse package..."
    npm install langfuse
fi

# Check if better-sqlite3 is installed (for swarm memory monitoring)
if ! npm list better-sqlite3 &> /dev/null; then
    echo "📦 Installing better-sqlite3..."
    npm install better-sqlite3
fi

# Create logs directory
mkdir -p logs

# Set up environment
export NODE_ENV=production
export LANGFUSE_WORKER_ENABLED=true

# Start the worker
echo "🔄 Starting Langfuse Worker..."
echo "   - Configuration: .env.langfuse"
echo "   - Logs: logs/langfuse-worker.log"
echo "   - Status: http://localhost:8080/status"
echo "   - Metrics: http://localhost:8080/metrics"
echo ""

# Start with logging and process management
node langfuse-worker.js 2>&1 | tee logs/langfuse-worker.log &
WORKER_PID=$!

# Save PID for later cleanup
echo $WORKER_PID > logs/langfuse-worker.pid

echo "✅ Langfuse Worker started successfully!"
echo "   - PID: $WORKER_PID"
echo "   - Log file: logs/langfuse-worker.log"
echo "   - Status endpoint: http://localhost:8080/status"
echo ""

# Wait a moment for startup
sleep 2

# Check if worker is responding
echo "🔍 Checking worker status..."
if curl -s http://localhost:8080/status > /dev/null 2>&1; then
    echo "✅ Worker is responding on port 8080"
    echo ""
    echo "📊 Worker Status:"
    curl -s http://localhost:8080/status | jq '.' 2>/dev/null || curl -s http://localhost:8080/status
else
    echo "⚠️  Worker status endpoint not responding"
fi

echo ""
echo "🎯 Worker is now running and monitoring swarm activities!"
echo "   - All swarm activities will be automatically traced to Langfuse"
echo "   - Check your Langfuse dashboard at: http://localhost:3000"
echo "   - To stop the worker: kill $WORKER_PID"
echo ""

# Keep script running to show logs
echo "📋 Recent logs (Ctrl+C to stop viewing):"
tail -f logs/langfuse-worker.log