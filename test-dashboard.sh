#!/bin/bash

echo "🔥 DASHBOARD REAL-TIME TESTING"
echo "═════════════════════════════"
echo "📊 Dashboard: http://localhost:3004"
echo "🖥️  Backend: http://localhost:3002"
echo "🔗 Langfuse: http://localhost:3000"
echo ""

# Test 1: Backend Health
echo "🏥 Testing backend health..."
curl -s http://localhost:3002/api/health | head -5
echo ""

# Test 2: Create multiple test traces
echo "🧪 Creating test traces..."
for i in {1..5}; do
    echo "Creating trace $i..."
    curl -s -X POST http://localhost:3002/api/test/trace \
        -H "Content-Type: application/json" \
        -d "{\"name\":\"Real-Time Test $i\",\"input\":{\"test\":\"dashboard_$i\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)\"},\"output\":{\"status\":\"success\",\"test_number\":$i}}" \
        | head -3
    sleep 1
done
echo ""

# Test 3: Fetch traces
echo "📋 Fetching traces..."
curl -s http://localhost:3002/api/traces | head -10
echo ""

# Test 4: Test analytics
echo "📈 Testing analytics..."
curl -s http://localhost:3002/api/analytics | head -10
echo ""

# Test 5: Test swarm status
echo "🐝 Testing swarm status..."
curl -s http://localhost:3002/api/swarm/status | head -10
echo ""

# Test 6: Dashboard frontend
echo "🌐 Testing dashboard frontend..."
curl -s -I http://localhost:3004 | head -5
echo ""

echo "✅ DASHBOARD TESTING COMPLETED!"
echo "🌐 Open Dashboard: http://localhost:3004"
echo "🔗 Open Langfuse: http://localhost:3000"
echo ""
echo "🎯 The dashboard should now show real-time trace data!"