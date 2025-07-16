#!/bin/bash

echo "🔥 CONTINUOUS TRACE GENERATOR FOR REAL-TIME DASHBOARD"
echo "═══════════════════════════════════════════════════"
echo "📊 Dashboard: http://localhost:3004"
echo "🖥️  Backend: http://localhost:3002"
echo "🔗 Langfuse: http://localhost:3000"
echo ""
echo "🎯 This will create traces every 3 seconds to demonstrate real-time monitoring"
echo "🛑 Press Ctrl+C to stop"
echo ""

# Counter for traces
counter=1

# Array of test scenarios for variety
scenarios=(
    "Agent Coordination Test"
    "Performance Analysis Task"
    "Code Generation Request"
    "Data Processing Job"
    "API Integration Test"
    "Database Query Operation"
    "Real-Time Monitoring"
    "Error Handling Test"
    "Load Balancing Check"
    "Security Validation"
)

# Main loop
while true; do
    # Pick random scenario
    scenario_index=$((RANDOM % ${#scenarios[@]}))
    scenario="${scenarios[$scenario_index]}"
    
    # Generate timestamp
    timestamp=$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)
    
    echo "🧪 Creating trace #$counter: $scenario"
    
    # Create trace with varied data
    curl -s -X POST http://localhost:3002/api/test/trace \
        -H "Content-Type: application/json" \
        -d "{
            \"name\":\"$scenario #$counter\",
            \"input\":{
                \"test\":\"continuous_monitoring\",
                \"timestamp\":\"$timestamp\",
                \"trace_number\":$counter,
                \"scenario\":\"$scenario\",
                \"priority\":\"$([ $((RANDOM % 2)) -eq 0 ] && echo 'high' || echo 'medium')\",
                \"agent_type\":\"$([ $((RANDOM % 3)) -eq 0 ] && echo 'researcher' || echo 'coder')\",
                \"complexity\":$((RANDOM % 10 + 1))
            },
            \"output\":{
                \"status\":\"success\",
                \"trace_number\":$counter,
                \"execution_time\":$((RANDOM % 1000 + 100)),
                \"memory_usage\":$((RANDOM % 512 + 128)),
                \"cpu_usage\":$((RANDOM % 100 + 10)),
                \"real_time_demo\":true
            }
        }" | head -3
    
    echo "✅ Trace #$counter completed"
    echo ""
    
    # Increment counter
    ((counter++))
    
    # Show progress every 10 traces
    if [ $((counter % 10)) -eq 1 ]; then
        echo "📊 Progress: $counter traces created"
        echo "🌐 Dashboard should show real-time updates at: http://localhost:3004"
        echo "🔗 Langfuse traces at: http://localhost:3000"
        echo ""
    fi
    
    # Wait 3 seconds before next trace
    sleep 3
done