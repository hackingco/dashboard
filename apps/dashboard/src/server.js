const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'dashboard',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint - Dashboard UI
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Claude Flow Swarm Dashboard</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; background: #1a1a1a; color: #fff; }
            .header { background: #2d2d2d; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
            .status { background: #0f3460; padding: 15px; border-radius: 8px; margin-bottom: 15px; }
            .service { background: #2d2d2d; padding: 10px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #00ff88; }
            .error { border-left-color: #ff4444; }
            .warning { border-left-color: #ffaa00; }
            a { color: #00aaff; text-decoration: none; }
            a:hover { text-decoration: underline; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>🐝 Claude Flow Swarm Dashboard</h1>
            <p>Central monitoring and control interface for the swarm coordination system</p>
        </div>
        
        <div class="status">
            <h2>📊 System Status</h2>
            <div class="service">
                <strong>🧠 Hive Mind:</strong> 
                <a href="http://localhost:8888" target="_blank">http://localhost:8888</a> - Central Coordination
            </div>
            <div class="service">
                <strong>🔄 Claude Flow:</strong> 
                <a href="http://localhost:8889" target="_blank">http://localhost:8889</a> - MCP Server
            </div>
            <div class="service">
                <strong>📊 Langfuse:</strong> 
                <a href="http://localhost:3001" target="_blank">http://localhost:3001</a> - Observability
            </div>
            <div class="service">
                <strong>🎛️ Manager API:</strong> 
                <a href="http://localhost:8080" target="_blank">http://localhost:8080</a> - REST API
            </div>
        </div>
        
        <div class="status">
            <h2>🤖 Swarm Agents</h2>
            <div class="service">
                <strong>Coordinator:</strong> Active - Managing 3 worker agents
            </div>
            <div class="service">
                <strong>Agent 1:</strong> Coder - Processing tasks
            </div>
            <div class="service">
                <strong>Agent 2:</strong> Researcher - Available
            </div>
            <div class="service">
                <strong>Agent 3:</strong> Analyst - Processing tasks
            </div>
        </div>
        
        <div class="status">
            <h2>🗄️ Infrastructure</h2>
            <div class="service">
                <strong>PostgreSQL:</strong> Running on port 5432
            </div>
            <div class="service">
                <strong>Redis:</strong> Running on port 6379
            </div>
            <div class="service">
                <strong>ClickHouse:</strong> Running on port 8123
            </div>
        </div>
        
        <script>
            // Auto-refresh every 30 seconds
            setTimeout(() => location.reload(), 30000);
        </script>
    </body>
    </html>
  `);
});

// API endpoints
app.get('/api/status', (req, res) => {
  res.json({
    dashboard: 'operational',
    swarm: {
      status: 'active',
      agents: 3,
      coordinator: 'running'
    },
    infrastructure: {
      postgres: 'healthy',
      redis: 'healthy',
      clickhouse: 'healthy'
    }
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`📊 Swarm Dashboard running on port ${PORT}`);
  console.log(`🌐 Dashboard available at http://localhost:${PORT}`);
});

process.on('SIGTERM', () => {
  console.log('🛑 Dashboard shutting down gracefully...');
  process.exit(0);
});