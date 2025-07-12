#!/bin/bash

# CORS Proxy Startup Script
# This script starts a local CORS proxy to enable dashboard communication

echo "🚀 Starting CORS Proxy for Swarm Manager Dashboard"
echo "=================================================="

# Check if npm packages are installed
if [ ! -d "node_modules/http-proxy-middleware" ]; then
    echo "📦 Installing required packages..."
    npm install express cors http-proxy-middleware
fi

# Start the proxy server
echo "🔄 Starting proxy server on port 3456..."
echo ""
echo "Dashboard URL: https://dist-d4ex7zt2q-hackingco.vercel.app"
echo "Backend URL: https://swarm-manager-flat-water-2021.fly.dev"
echo ""

node cors-proxy-server.js