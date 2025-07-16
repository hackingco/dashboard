#!/bin/bash

# Container Management System Startup Script
# Comprehensive container orchestration and monitoring

set -e

echo "🚀 Starting Container Management System"
echo "========================================"

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Install required Node.js packages if needed
echo "📦 Installing required packages..."
npm install express socket.io chart.js --save-dev 2>/dev/null || echo "⚠️  Some packages may already be installed"

# Check system requirements
echo "🔍 Checking system requirements..."
node container-orchestrator.js check

# Start the orchestrator
echo "🚀 Starting Container Orchestrator..."
node container-orchestrator.js start

echo "✅ Container Management System started successfully!"
echo ""
echo "Available Services:"
echo "==================="
echo "🌐 Metrics Dashboard: http://localhost:9998"
echo "🔍 Health Monitor: http://localhost:9999/dashboard"
echo "📊 Metrics API: http://localhost:9998/api/metrics"
echo "🚨 Alerts API: http://localhost:9998/api/alerts"
echo ""
echo "To stop the system, press Ctrl+C"
echo ""

# Keep the script running
wait