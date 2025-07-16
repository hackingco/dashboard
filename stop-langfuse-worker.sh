#!/bin/bash

# Stop Langfuse Worker for Hive Mind Swarm

echo "🛑 Stopping Langfuse Worker..."

# Check if PID file exists
if [ -f "logs/langfuse-worker.pid" ]; then
    PID=$(cat logs/langfuse-worker.pid)
    
    # Check if process is still running
    if kill -0 $PID 2>/dev/null; then
        echo "   - Sending SIGTERM to process $PID..."
        kill -TERM $PID
        
        # Wait for graceful shutdown
        sleep 3
        
        # Check if still running
        if kill -0 $PID 2>/dev/null; then
            echo "   - Process still running, sending SIGKILL..."
            kill -KILL $PID
        fi
        
        echo "✅ Worker stopped successfully"
    else
        echo "⚠️  Process $PID not found (already stopped)"
    fi
    
    # Remove PID file
    rm -f logs/langfuse-worker.pid
else
    echo "⚠️  PID file not found, attempting to find worker process..."
    
    # Try to find worker process
    WORKER_PID=$(pgrep -f "langfuse-worker.js")
    if [ ! -z "$WORKER_PID" ]; then
        echo "   - Found worker process: $WORKER_PID"
        kill -TERM $WORKER_PID
        sleep 2
        
        if kill -0 $WORKER_PID 2>/dev/null; then
            kill -KILL $WORKER_PID
        fi
        
        echo "✅ Worker stopped successfully"
    else
        echo "⚠️  No worker process found"
    fi
fi

# Check if status endpoint is still responding
if curl -s --connect-timeout 2 http://localhost:8080/status > /dev/null 2>&1; then
    echo "⚠️  Status endpoint still responding, worker may still be running"
else
    echo "✅ Status endpoint not responding, worker stopped"
fi

echo ""
echo "🎯 Langfuse Worker stopped."
echo "   - To restart: ./start-langfuse-worker.sh"
echo "   - Logs preserved in: logs/langfuse-worker.log"