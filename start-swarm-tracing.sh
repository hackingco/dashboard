#!/bin/bash

# Start Swarm Tracing on Port 3000
# This script activates comprehensive Langfuse tracing for all swarm activities

echo "🚀 Starting Swarm Tracing System..."
echo "🌐 Langfuse URL: http://localhost:3000"
echo "📊 Comprehensive tracing will monitor:"
echo "   - Agent lifecycle events (spawn, activate, communicate, complete)"
echo "   - Consensus voting processes"
echo "   - Memory operations and sharing"
echo "   - Task distribution and completion"
echo "   - Performance metrics and bottlenecks"
echo "   - Error handling and recovery"
echo ""

# Check if Langfuse is running
echo "🔍 Checking Langfuse status..."
if curl -s "http://localhost:3000/api/health" > /dev/null; then
    echo "✅ Langfuse is running on port 3000"
else
    echo "❌ Langfuse is not running on port 3000"
    echo "📋 To start Langfuse:"
    echo "   docker-compose -f docker-compose.langfuse.yml up -d"
    echo ""
    echo "🔄 Attempting to start Langfuse..."
    docker-compose -f docker-compose.langfuse.yml up -d
    
    echo "⏳ Waiting for Langfuse to start..."
    sleep 10
    
    if curl -s "http://localhost:3000/api/health" > /dev/null; then
        echo "✅ Langfuse started successfully"
    else
        echo "❌ Failed to start Langfuse. Please check Docker and try again."
        exit 1
    fi
fi

# Make scripts executable
chmod +x activate-swarm-tracing.js
chmod +x test-swarm-tracing.js

# Check if Node.js dependencies are available
echo "🔍 Checking Node.js dependencies..."
if ! npm list langfuse > /dev/null 2>&1; then
    echo "📦 Installing Langfuse Node.js client..."
    npm install langfuse
fi

echo ""
echo "🎯 Choose what to run:"
echo "1. Run comprehensive tracing tests"
echo "2. Start real-time tracing monitor"
echo "3. Run both tests and monitor"
echo ""
read -p "Enter your choice (1-3): " choice

case $choice in
    1)
        echo "🧪 Running comprehensive tracing tests..."
        node test-swarm-tracing.js
        ;;
    2)
        echo "👁️ Starting real-time tracing monitor..."
        node activate-swarm-tracing.js
        ;;
    3)
        echo "🧪 First running tests..."
        node test-swarm-tracing.js
        echo ""
        echo "👁️ Now starting real-time monitor..."
        node activate-swarm-tracing.js
        ;;
    *)
        echo "❌ Invalid choice. Running tests by default..."
        node test-swarm-tracing.js
        ;;
esac

echo ""
echo "🎉 Swarm tracing session complete!"
echo "🌐 View traces at: http://localhost:3000"
echo "📊 Check the Langfuse dashboard for detailed analytics"