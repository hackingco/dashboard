#!/usr/bin/env node

/**
 * Real-time Swarm Dashboard Server
 * Live monitoring and tracing visualization
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const config = {
  port: process.env.DASHBOARD_PORT || 3001,
  langfuseHost: process.env.LANGFUSE_HOST || 'http://langfuse:3000',
  redisUrl: process.env.REDIS_URL || 'redis://redis:6379',
  memoryPath: process.env.MEMORY_DB_PATH || '/app/data/memory.db',
  coordinatorUrl: process.env.COORDINATOR_URL || 'http://swarm-coordinator:8000'
};

console.log('📊 REAL-TIME SWARM DASHBOARD STARTING');
console.log('════════════════════════════════════');
console.log(`Dashboard Port: ${config.port}`);
console.log(`Langfuse Host: ${config.langfuseHost}`);
console.log(`Coordinator: ${config.coordinatorUrl}`);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Dashboard state
const dashboardState = {
  startTime: Date.now(),
  connections: new Set(),
  metrics: {
    totalRequests: 0,
    errors: 0,
    uptime: 0
  },
  swarmData: {
    agents: [],
    tasks: [],
    traces: [],
    performance: {},
    lessons: []
  }
};

// Serve dashboard HTML
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Swarm Intelligence Dashboard</title>
    <script src="/socket.io/socket.io.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #0a0a0a;
            color: #e0e0e0;
            overflow-x: hidden;
        }
        .dashboard {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            grid-template-rows: auto 1fr 1fr;
            gap: 20px;
            padding: 20px;
            min-height: 100vh;
        }
        .header {
            grid-column: 1 / -1;
            text-align: center;
            background: linear-gradient(135deg, #1a1a2e, #16213e);
            padding: 20px;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        }
        .header h1 {
            font-size: 2.5em;
            background: linear-gradient(45deg, #00d4aa, #00b4d8);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 10px;
        }
        .status { font-size: 1.2em; opacity: 0.8; }
        .panel {
            background: linear-gradient(135deg, #1a1a2e, #16213e);
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            border: 1px solid rgba(255,255,255,0.1);
        }
        .panel h3 {
            color: #00d4aa;
            margin-bottom: 15px;
            font-size: 1.3em;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .metric {
            display: flex;
            justify-content: space-between;
            margin: 10px 0;
            padding: 8px 12px;
            background: rgba(255,255,255,0.05);
            border-radius: 6px;
            border-left: 3px solid #00d4aa;
        }
        .metric.error { border-left-color: #ff6b6b; }
        .metric.warning { border-left-color: #feca57; }
        .agent {
            background: rgba(255,255,255,0.05);
            margin: 8px 0;
            padding: 12px;
            border-radius: 8px;
            border-left: 4px solid #00d4aa;
        }
        .agent.inactive { border-left-color: #ff6b6b; opacity: 0.6; }
        .agent-header {
            font-weight: bold;
            margin-bottom: 5px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .status-indicator {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #00d4aa;
            animation: pulse 2s infinite;
        }
        .status-indicator.inactive { background: #ff6b6b; animation: none; }
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
        }
        .task {
            background: rgba(255,255,255,0.03);
            margin: 5px 0;
            padding: 10px;
            border-radius: 6px;
            font-size: 0.9em;
        }
        .task.high { border-left: 3px solid #ff6b6b; }
        .task.medium { border-left: 3px solid #feca57; }
        .task.low { border-left: 3px solid #00d4aa; }
        .lesson {
            background: rgba(0, 212, 170, 0.1);
            margin: 8px 0;
            padding: 12px;
            border-radius: 8px;
            border-left: 4px solid #00d4aa;
        }
        .lesson-category {
            font-weight: bold;
            color: #00d4aa;
            margin-bottom: 5px;
        }
        .lesson-confidence {
            float: right;
            background: rgba(0, 212, 170, 0.2);
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 0.8em;
        }
        .chart {
            width: 100%;
            height: 200px;
            background: rgba(255,255,255,0.02);
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 15px 0;
            border: 1px dashed rgba(255,255,255,0.1);
        }
        .scroll-area {
            max-height: 300px;
            overflow-y: auto;
            scrollbar-width: thin;
            scrollbar-color: #00d4aa #1a1a2e;
        }
        .scroll-area::-webkit-scrollbar {
            width: 6px;
        }
        .scroll-area::-webkit-scrollbar-track {
            background: #1a1a2e;
        }
        .scroll-area::-webkit-scrollbar-thumb {
            background: #00d4aa;
            border-radius: 3px;
        }
        .connection-status {
            position: fixed;
            top: 10px;
            right: 10px;
            padding: 8px 15px;
            background: #00d4aa;
            color: #000;
            border-radius: 20px;
            font-weight: bold;
            z-index: 1000;
        }
        .connection-status.disconnected {
            background: #ff6b6b;
            color: #fff;
        }
        @media (max-width: 1024px) {
            .dashboard {
                grid-template-columns: 1fr 1fr;
            }
        }
        @media (max-width: 768px) {
            .dashboard {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="connection-status" id="connectionStatus">🔗 Connecting...</div>
    
    <div class="dashboard">
        <div class="header">
            <h1>🐝 Swarm Intelligence Dashboard</h1>
            <div class="status">Real-time monitoring with Langfuse integration</div>
            <div id="swarmInfo">Initializing...</div>
        </div>

        <div class="panel">
            <h3>🤖 Active Agents</h3>
            <div id="agentsList" class="scroll-area">
                <div style="text-align: center; opacity: 0.5;">Loading agents...</div>
            </div>
        </div>

        <div class="panel">
            <h3>📋 Recent Tasks</h3>
            <div id="tasksList" class="scroll-area">
                <div style="text-align: center; opacity: 0.5;">Loading tasks...</div>
            </div>
        </div>

        <div class="panel">
            <h3>📚 Lessons Learned</h3>
            <div id="lessonsList" class="scroll-area">
                <div style="text-align: center; opacity: 0.5;">Loading lessons...</div>
            </div>
        </div>

        <div class="panel">
            <h3>📊 Performance Metrics</h3>
            <div id="performanceMetrics">
                <div class="metric">
                    <span>Total Tasks:</span>
                    <span id="totalTasks">0</span>
                </div>
                <div class="metric">
                    <span>Success Rate:</span>
                    <span id="successRate">0%</span>
                </div>
                <div class="metric">
                    <span>Avg Response Time:</span>
                    <span id="avgResponseTime">0ms</span>
                </div>
                <div class="metric">
                    <span>Active Traces:</span>
                    <span id="activeTraces">0</span>
                </div>
            </div>
        </div>

        <div class="panel">
            <h3>🔍 Real-time Observations</h3>
            <div id="observationsList" class="scroll-area">
                <div style="text-align: center; opacity: 0.5;">Waiting for observations...</div>
            </div>
        </div>

        <div class="panel">
            <h3>⚡ System Health</h3>
            <div id="systemHealth">
                <div class="metric">
                    <span>Dashboard Uptime:</span>
                    <span id="uptime">0s</span>
                </div>
                <div class="metric">
                    <span>Memory Usage:</span>
                    <span id="memoryUsage">0 MB</span>
                </div>
                <div class="metric">
                    <span>Coordinator Status:</span>
                    <span id="coordinatorStatus">Unknown</span>
                </div>
                <div class="metric">
                    <span>Langfuse Status:</span>
                    <span id="langfuseStatus">Unknown</span>
                </div>
            </div>
        </div>
    </div>

    <script>
        const socket = io();
        const startTime = Date.now();

        // Connection status
        const connectionStatus = document.getElementById('connectionStatus');
        
        socket.on('connect', () => {
            connectionStatus.textContent = '🔗 Connected';
            connectionStatus.className = 'connection-status';
        });

        socket.on('disconnect', () => {
            connectionStatus.textContent = '❌ Disconnected';
            connectionStatus.className = 'connection-status disconnected';
        });

        // Initial state
        socket.on('initialState', (data) => {
            console.log('Initial state received:', data);
            updateSwarmInfo(data);
            updateAgents(data.agents || []);
            updateTasks(data.tasks || []);
            updatePerformance(data.performance || {});
        });

        // Real-time updates
        socket.on('agentRegistered', (agent) => {
            console.log('Agent registered:', agent);
            addObservation('agent_registration', \`Agent \${agent.type} (\${agent.id}) joined the swarm\`);
        });

        socket.on('taskCompleted', (task) => {
            console.log('Task completed:', task);
            addObservation('task_completion', \`Task \${task.taskId} completed in \${task.duration}ms\`);
        });

        socket.on('lessonLearned', (lesson) => {
            console.log('Lesson learned:', lesson);
            addLesson(lesson);
            addObservation('lesson_learned', \`New lesson in \${lesson.category}: \${lesson.lesson}\`);
        });

        socket.on('traceUpdate', (trace) => {
            console.log('Trace update:', trace);
            addObservation('trace_update', \`\${trace.observation.type}: \${trace.observation.details}\`);
        });

        socket.on('healthUpdate', (health) => {
            console.log('Health update:', health);
            updateSystemHealth(health);
        });

        socket.on('agentMetrics', (metrics) => {
            console.log('Agent metrics:', metrics);
            updateAgentMetrics(metrics);
        });

        // Update functions
        function updateSwarmInfo(data) {
            const swarmInfo = document.getElementById('swarmInfo');
            swarmInfo.innerHTML = \`
                <strong>Swarm ID:</strong> \${data.swarmId || 'Unknown'} | 
                <strong>Agents:</strong> \${(data.agents || []).length} | 
                <strong>Tasks:</strong> \${(data.tasks || []).length}
            \`;
        }

        function updateAgents(agents) {
            const agentsList = document.getElementById('agentsList');
            if (!agents || agents.length === 0) {
                agentsList.innerHTML = '<div style="text-align: center; opacity: 0.5;">No agents registered</div>';
                return;
            }

            agentsList.innerHTML = agents.map(agent => \`
                <div class="agent \${agent.status === 'active' ? '' : 'inactive'}">
                    <div class="agent-header">
                        <span>\${agent.type} (\${agent.id})</span>
                        <div class="status-indicator \${agent.status === 'active' ? '' : 'inactive'}"></div>
                    </div>
                    <div style="font-size: 0.85em; opacity: 0.8;">
                        Tasks: \${agent.tasks || 0} | 
                        Uptime: \${formatDuration(Date.now() - agent.registeredAt)} |
                        Avg: \${(agent.performance?.avgResponseTime || 0).toFixed(0)}ms
                    </div>
                </div>
            \`).join('');
        }

        function updateTasks(tasks) {
            const tasksList = document.getElementById('tasksList');
            if (!tasks || tasks.length === 0) {
                tasksList.innerHTML = '<div style="text-align: center; opacity: 0.5;">No recent tasks</div>';
                return;
            }

            const recentTasks = tasks.slice(-10).reverse();
            tasksList.innerHTML = recentTasks.map(task => \`
                <div class="task \${task.priority}">
                    <div><strong>\${task.id}</strong> (\${task.status})</div>
                    <div style="font-size: 0.8em; opacity: 0.7;">
                        Agent: \${task.agentId} | 
                        Priority: \${task.priority} |
                        \${task.completedAt ? \`Duration: \${task.duration}ms\` : 'In progress'}
                    </div>
                </div>
            \`).join('');
        }

        function updatePerformance(performance) {
            document.getElementById('totalTasks').textContent = performance.totalTasks || 0;
            document.getElementById('completedTasks').textContent = performance.completedTasks || 0;
            const successRate = performance.totalTasks > 0 ? 
                ((performance.completedTasks || 0) / performance.totalTasks * 100).toFixed(1) : 0;
            document.getElementById('successRate').textContent = successRate + '%';
            document.getElementById('avgResponseTime').textContent = (performance.avgExecutionTime || 0).toFixed(0) + 'ms';
        }

        function updateSystemHealth(health) {
            document.getElementById('uptime').textContent = formatDuration(Date.now() - startTime);
            document.getElementById('coordinatorStatus').textContent = 
                health.totalAgents > 0 ? \`✅ \${health.activeAgents}/\${health.totalAgents} agents\` : '❌ No agents';
            
            // Update performance metrics
            document.getElementById('totalTasks').textContent = health.performance?.totalTasks || 0;
            document.getElementById('activeTraces').textContent = health.performance?.activeTraces || 0;
        }

        function addObservation(type, message) {
            const observationsList = document.getElementById('observationsList');
            const observation = document.createElement('div');
            observation.className = 'task';
            observation.innerHTML = \`
                <div><strong>\${type}</strong></div>
                <div style="font-size: 0.85em; opacity: 0.8;">\${message}</div>
                <div style="font-size: 0.75em; opacity: 0.6;">\${new Date().toLocaleTimeString()}</div>
            \`;
            
            observationsList.insertBefore(observation, observationsList.firstChild);
            
            // Keep only last 20 observations
            while (observationsList.children.length > 20) {
                observationsList.removeChild(observationsList.lastChild);
            }
        }

        function addLesson(lesson) {
            const lessonsList = document.getElementById('lessonsList');
            const lessonEl = document.createElement('div');
            lessonEl.className = 'lesson';
            lessonEl.innerHTML = \`
                <div class="lesson-category">
                    \${lesson.category}
                    <span class="lesson-confidence">\${(lesson.confidence * 100).toFixed(0)}%</span>
                </div>
                <div>\${lesson.lesson}</div>
                <div style="font-size: 0.75em; opacity: 0.6; margin-top: 5px;">
                    \${new Date(lesson.timestamp).toLocaleTimeString()}
                </div>
            \`;
            
            lessonsList.insertBefore(lessonEl, lessonsList.firstChild);
            
            // Keep only last 15 lessons
            while (lessonsList.children.length > 15) {
                lessonsList.removeChild(lessonsList.lastChild);
            }
        }

        function formatDuration(ms) {
            const seconds = Math.floor(ms / 1000);
            const minutes = Math.floor(seconds / 60);
            const hours = Math.floor(minutes / 60);
            
            if (hours > 0) return \`\${hours}h \${minutes % 60}m\`;
            if (minutes > 0) return \`\${minutes}m \${seconds % 60}s\`;
            return \`\${seconds}s\`;
        }

        // Auto-refresh system status
        setInterval(() => {
            document.getElementById('uptime').textContent = formatDuration(Date.now() - startTime);
        }, 1000);

        // Initial observation
        setTimeout(() => {
            addObservation('dashboard_start', 'Real-time dashboard initialized and connected');
        }, 1000);
    </script>
</body>
</html>
  `);
});

// Health check endpoint
app.get('/health', (req, res) => {
  dashboardState.metrics.uptime = Date.now() - dashboardState.startTime;
  
  res.json({
    status: 'healthy',
    uptime: dashboardState.metrics.uptime,
    connections: dashboardState.connections.size,
    metrics: dashboardState.metrics,
    timestamp: Date.now()
  });
});

// API endpoints for external integration
app.get('/api/swarm/status', async (req, res) => {
  try {
    // Fetch current swarm status from coordinator
    const response = await fetch(`${config.coordinatorUrl}/dashboard/state`);
    const swarmData = await response.json();
    
    dashboardState.swarmData = swarmData;
    res.json(swarmData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/metrics/export', (req, res) => {
  const metrics = {
    dashboard: dashboardState.metrics,
    swarm: dashboardState.swarmData,
    timestamp: new Date().toISOString(),
    format: 'json'
  };
  
  res.setHeader('Content-Disposition', 'attachment; filename=swarm-metrics.json');
  res.json(metrics);
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('📡 Dashboard client connected:', socket.id);
  dashboardState.connections.add(socket.id);
  
  // Send initial state
  socket.emit('initialState', dashboardState.swarmData);
  
  socket.on('disconnect', () => {
    console.log('📡 Dashboard client disconnected:', socket.id);
    dashboardState.connections.delete(socket.id);
  });
});

// Periodic data fetching from coordinator
async function fetchSwarmData() {
  try {
    const response = await fetch(`${config.coordinatorUrl}/dashboard/state`);
    if (response.ok) {
      const data = await response.json();
      dashboardState.swarmData = data;
      
      // Broadcast updates to all connected clients
      io.emit('swarmUpdate', data);
    }
  } catch (error) {
    console.warn('Failed to fetch swarm data:', error.message);
    dashboardState.metrics.errors++;
  }
}

// Periodic system health check
async function checkSystemHealth() {
  try {
    // Check coordinator health
    const coordinatorResponse = await fetch(`${config.coordinatorUrl}/health`);
    const coordinatorHealthy = coordinatorResponse.ok;
    
    // Check Langfuse health (if available)
    let langfuseHealthy = false;
    try {
      const langfuseResponse = await fetch(`${config.langfuseHost}/api/health`);
      langfuseHealthy = langfuseResponse.ok;
    } catch (e) {
      // Langfuse might not be available
    }
    
    const healthStatus = {
      coordinator: coordinatorHealthy,
      langfuse: langfuseHealthy,
      dashboard: true,
      timestamp: Date.now(),
      uptime: Date.now() - dashboardState.startTime,
      connections: dashboardState.connections.size
    };
    
    io.emit('systemHealth', healthStatus);
    
  } catch (error) {
    console.warn('Health check failed:', error.message);
  }
}

// Start periodic tasks
setInterval(fetchSwarmData, 5000);  // Every 5 seconds
setInterval(checkSystemHealth, 10000);  // Every 10 seconds

// Start server
server.listen(config.port, '0.0.0.0', () => {
  console.log(`🚀 Dashboard running on port ${config.port}`);
  console.log(`📊 Access at http://localhost:${config.port}`);
  console.log('⚡ Real-time monitoring active...');
  
  // Initial health check
  setTimeout(checkSystemHealth, 2000);
});