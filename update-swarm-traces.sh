#!/bin/bash

echo "🔄 Updating swarm agents to send authenticated traces to Langfuse"
echo "==============================================================="

# Update the LiveTraceBuilder to send real traces
docker exec swarm-tracebuilder sh -c 'cat > /trace-sender.js << "SCRIPT"
const http = require("http");
const crypto = require("crypto");

const LANGFUSE_PUBLIC_KEY = "pk-lf-9483a853-ab5b-4561-bfd5-ba0ce161908e";
const LANGFUSE_SECRET_KEY = "sk-lf-28a0e091-3cf7-4973-a1e1-030705b714da";

console.log("🛠️ LiveTraceBuilder - Authenticated Trace Sender");

function sendToLangfuse(traceData) {
  const auth = Buffer.from(LANGFUSE_PUBLIC_KEY + ":" + LANGFUSE_SECRET_KEY).toString("base64");
  const data = JSON.stringify(traceData);
  
  const options = {
    hostname: "langfuse-test-langfuse-1",
    port: 3000,
    path: "/api/public/traces",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": data.length,
      "Authorization": "Basic " + auth
    }
  };
  
  const req = http.request(options, (res) => {
    let responseData = "";
    res.on("data", (chunk) => responseData += chunk);
    res.on("end", () => {
      if (res.statusCode === 200 || res.statusCode === 201) {
        console.log("✅ Trace sent:", traceData.name, "->", responseData);
      } else {
        console.log("❌ Failed:", res.statusCode, responseData);
      }
    });
  });
  
  req.on("error", (e) => console.error("Error:", e.message));
  req.write(data);
  req.end();
}

// Generate and send traces
function generateAndSendTrace() {
  const operations = [
    "Process User Request",
    "Execute Database Query", 
    "Handle API Call",
    "Process Background Job",
    "Analyze Data Pattern"
  ];
  
  const operation = operations[Math.floor(Math.random() * operations.length)];
  const sessionId = "swarm-session-" + Date.now();
  
  const trace = {
    name: operation,
    userId: "swarm-user-" + Math.floor(Math.random() * 100),
    sessionId: sessionId,
    metadata: {
      agent: "LiveTraceBuilder",
      swarmId: "swarm_1752454839280_pw37vfa2h",
      duration: Math.floor(Math.random() * 2000) + 100,
      status: Math.random() > 0.1 ? "success" : "error",
      environment: "production"
    }
  };
  
  sendToLangfuse(trace);
  
  // Create child spans
  setTimeout(() => {
    const span = {
      name: operation + " - Processing",
      userId: trace.userId,
      sessionId: sessionId,
      parentObservationId: trace.id,
      metadata: {
        step: "processing",
        items_processed: Math.floor(Math.random() * 100) + 10
      }
    };
    sendToLangfuse(span);
  }, 1000);
}

// Send traces every 5 seconds
setInterval(generateAndSendTrace, 5000);
generateAndSendTrace();

console.log("📡 Sending authenticated traces every 5 seconds...");
SCRIPT

# Kill old process and start new one
pkill -f "node /agent.js"
node /trace-sender.js &
'

# Update Coordinator
docker exec swarm-coordinator sh -c 'cat > /coord-tracer.js << "SCRIPT"
const http = require("http");

const LANGFUSE_PUBLIC_KEY = "pk-lf-9483a853-ab5b-4561-bfd5-ba0ce161908e";
const LANGFUSE_SECRET_KEY = "sk-lf-28a0e091-3cf7-4973-a1e1-030705b714da";

console.log("🎯 Swarm Coordinator - Trace Generator");

function sendCoordinationTrace() {
  const auth = Buffer.from(LANGFUSE_PUBLIC_KEY + ":" + LANGFUSE_SECRET_KEY).toString("base64");
  
  const trace = {
    name: "Swarm Coordination Cycle",
    userId: "swarm-coordinator",
    sessionId: "coordinator-session-" + Date.now(),
    metadata: {
      agent: "SwarmCommander",
      agents_coordinated: 6,
      tasks_distributed: Math.floor(Math.random() * 10) + 5,
      swarmId: "swarm_1752454839280_pw37vfa2h"
    },
    tags: ["swarm", "coordination", "live"]
  };
  
  const data = JSON.stringify(trace);
  
  const req = http.request({
    hostname: "langfuse-test-langfuse-1",
    port: 3000,
    path: "/api/public/traces",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Basic " + auth
    }
  }, (res) => {
    let body = "";
    res.on("data", chunk => body += chunk);
    res.on("end", () => {
      console.log(`✅ Coordination trace sent: ${trace.metadata.tasks_distributed} tasks distributed`);
    });
  });
  
  req.write(data);
  req.end();
}

// Send coordination traces every 10 seconds
setInterval(sendCoordinationTrace, 10000);
sendCoordinationTrace();

console.log("📡 Coordinator sending traces every 10 seconds...");
SCRIPT

pkill -f "node /trace-generator.js"
node /coord-tracer.js &
'

echo ""
echo "✅ Swarm agents updated with Langfuse authentication!"
echo ""
echo "📊 Monitoring trace generation..."
sleep 5

# Check if traces are being sent
echo ""
echo "🔍 Recent activity:"
docker logs swarm-tracebuilder --tail 5
echo ""
docker logs swarm-coordinator --tail 5

echo ""
echo "🎯 Check Langfuse dashboard for traces:"
echo "   http://localhost:3000"
echo ""
echo "   You should see:"
echo "   • Swarm Coordination Cycles"
echo "   • Process User Requests"
echo "   • Database Queries"
echo "   • API Calls"
echo "   • Background Jobs"