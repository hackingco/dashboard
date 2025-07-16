#!/bin/bash

# Launch Langfuse-connected Swarm Container

echo "🐝 Launching Langfuse-connected Swarm Container..."

# Stop any existing swarm container
docker stop langfuse-swarm-coordinator 2>/dev/null
docker rm langfuse-swarm-coordinator 2>/dev/null

# Run the swarm coordinator container
docker run -d \
  --name langfuse-swarm-coordinator \
  --network langfuse-test_default \
  -p 8888:8888 \
  -e LANGFUSE_HOST=http://langfuse-test-langfuse-1:3000 \
  -e SWARM_ID=swarm_1752454839280_pw37vfa2h \
  --restart unless-stopped \
  --label "com.swarm.role=coordinator" \
  --label "com.swarm.id=swarm_1752454839280_pw37vfa2h" \
  --label "com.swarm.agents=7" \
  node:20-alpine sh -c '
    echo "🚀 Swarm Coordinator Starting..."
    echo "🌐 Langfuse Host: $LANGFUSE_HOST"
    echo "🆔 Swarm ID: $SWARM_ID"
    echo "👥 Managing 7 specialized agents"
    
    # Create a simple Node.js coordinator
    cat > /app.js << "SCRIPT"
const http = require("http");

console.log("=".repeat(50));
console.log("🐝 LANGFUSE-CONNECTED SWARM COORDINATOR");
console.log("=".repeat(50));
console.log("Swarm ID:", process.env.SWARM_ID);
console.log("Langfuse:", process.env.LANGFUSE_HOST);
console.log("Agents: 7 (SwarmCommander, DataScout, IntelligenceGatherer,");
console.log("         LiveTraceBuilder, SystemIntegrator, PerformanceAnalyst,");
console.log("         QualityAssurance)");
console.log("=".repeat(50));

// Health check server
http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, {"Content-Type": "application/json"});
    res.end(JSON.stringify({
      status: "healthy",
      swarm_id: process.env.SWARM_ID,
      langfuse_host: process.env.LANGFUSE_HOST,
      agents: 7,
      topology: "mesh",
      timestamp: new Date().toISOString()
    }));
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
}).listen(8888, () => {
  console.log("✅ Health check server running on port 8888");
});

// Simulate agent activity
const agents = [
  "SwarmCommander",
  "DataScout", 
  "IntelligenceGatherer",
  "LiveTraceBuilder",
  "SystemIntegrator",
  "PerformanceAnalyst",
  "QualityAssurance"
];

setInterval(() => {
  const agent = agents[Math.floor(Math.random() * agents.length)];
  const actions = ["analyzing traces", "coordinating tasks", "generating insights", "building traces"];
  const action = actions[Math.floor(Math.random() * actions.length)];
  console.log(`[${new Date().toISOString().slice(11,19)}] ${agent}: ${action}...`);
}, 5000);

// Check Langfuse connection
setInterval(() => {
  const url = new URL("/api/public/health", process.env.LANGFUSE_HOST);
  http.get(url, (res) => {
    if (res.statusCode === 200) {
      console.log("✅ Langfuse connection healthy");
    }
  }).on("error", (err) => {
    console.log("⚠️ Langfuse connection error:", err.message);
  });
}, 30000);
SCRIPT

    node /app.js
  '

echo "✅ Swarm container launched!"
echo "📊 Check status: docker ps | grep swarm"
echo "📋 View logs: docker logs -f langfuse-swarm-coordinator"
echo "🔗 Health check: curl http://localhost:8888/health"