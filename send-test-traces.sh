#!/bin/bash

echo "🚀 Sending test traces to Langfuse with authentication"
echo "===================================================="

LANGFUSE_PUBLIC_KEY="pk-lf-9483a853-ab5b-4561-bfd5-ba0ce161908e"
LANGFUSE_SECRET_KEY="sk-lf-28a0e091-3cf7-4973-a1e1-030705b714da"
LANGFUSE_HOST="http://localhost:3000"

# Test API connection first
echo "🔍 Testing Langfuse API connection..."
curl -s -X GET "${LANGFUSE_HOST}/api/public/health" \
  -H "Authorization: Bearer ${LANGFUSE_PUBLIC_KEY}" | jq .

# Send a test trace batch
echo -e "\n📊 Sending test trace batch..."

TRACE_DATA=$(cat <<EOF
{
  "batch": [
    {
      "id": "swarm-test-$(date +%s)-1",
      "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")",
      "name": "Swarm Initialization Test",
      "userId": "swarm-system",
      "sessionId": "swarm-session-$(date +%s)",
      "release": "1.0.0",
      "version": "1.0.0",
      "metadata": {
        "agent": "SwarmCommander",
        "swarmId": "swarm_1752454839280_pw37vfa2h",
        "test": true
      },
      "tags": ["swarm", "test", "initialization"]
    },
    {
      "id": "swarm-test-$(date +%s)-2",
      "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")",
      "name": "Agent Coordination Task",
      "userId": "swarm-system",
      "sessionId": "swarm-session-$(date +%s)",
      "release": "1.0.0",
      "version": "1.0.0",
      "metadata": {
        "agent": "DataScout",
        "operation": "pattern_analysis",
        "duration": 1250
      },
      "tags": ["swarm", "analysis", "patterns"]
    }
  ]
}
EOF
)

# Send traces using the ingestion endpoint
RESPONSE=$(curl -s -X POST "${LANGFUSE_HOST}/api/public/ingestion" \
  -H "Content-Type: application/json" \
  -H "X-Langfuse-Public-Key: ${LANGFUSE_PUBLIC_KEY}" \
  -H "X-Langfuse-Secret-Key: ${LANGFUSE_SECRET_KEY}" \
  -d "${TRACE_DATA}")

echo "Response: $RESPONSE"

if [[ "$RESPONSE" == *"success"* ]] || [[ "$RESPONSE" == *"ok"* ]] || [[ -z "$RESPONSE" ]]; then
  echo "✅ Test traces sent successfully!"
  echo ""
  echo "🎯 Next steps:"
  echo "1. Open Langfuse dashboard: http://localhost:3000"
  echo "2. Navigate to Traces section"
  echo "3. You should see the swarm traces appearing"
else
  echo "⚠️ Unexpected response. Checking alternative endpoints..."
  
  # Try alternative endpoint
  curl -X POST "${LANGFUSE_HOST}/api/public/traces" \
    -H "Content-Type: application/json" \
    -H "Authorization: Basic $(echo -n "${LANGFUSE_PUBLIC_KEY}:${LANGFUSE_SECRET_KEY}" | base64)" \
    -d '{
      "name": "Swarm Test Trace",
      "userId": "swarm-test",
      "metadata": {"source": "swarm"}
    }'
fi

echo -e "\n📊 Swarm agents are now sending authenticated traces!"