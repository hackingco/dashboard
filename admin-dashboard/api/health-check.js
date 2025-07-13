// Vercel API endpoint for health checks and monitoring
export default async function handler(req, res) {
  const startTime = Date.now();
  
  try {
    // Basic health check response
    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.VITE_DASHBOARD_VERSION || 'unknown',
      commit: process.env.VITE_COMMIT_SHA || 'unknown',
      branch: process.env.VITE_BRANCH || 'unknown',
      responseTime: Date.now() - startTime
    };

    // Check external dependencies
    const checks = await Promise.allSettled([
      checkSwarmManagerAPI(),
      checkWebSocketEndpoint()
    ]);

    // Evaluate check results
    healthData.dependencies = {
      swarmManager: checks[0].status === 'fulfilled' ? checks[0].value : { status: 'error', error: checks[0].reason?.message },
      webSocket: checks[1].status === 'fulfilled' ? checks[1].value : { status: 'error', error: checks[1].reason?.message }
    };

    // Determine overall health
    const allHealthy = Object.values(healthData.dependencies).every(dep => dep.status === 'healthy');
    healthData.overallStatus = allHealthy ? 'healthy' : 'degraded';

    // Set appropriate HTTP status
    const httpStatus = allHealthy ? 200 : 503;

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    res.status(httpStatus).json(healthData);
  } catch (error) {
    console.error('Health check error:', error);
    
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message,
      responseTime: Date.now() - startTime
    });
  }
}

async function checkSwarmManagerAPI() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch('https://swarm-manager-live.fly.dev/api/health', {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Dashboard-Health-Check/1.0'
      }
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      return {
        status: 'healthy',
        responseTime: response.headers.get('x-response-time') || 'unknown',
        lastCheck: new Date().toISOString()
      };
    } else {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    return {
      status: 'error',
      error: error.message,
      lastCheck: new Date().toISOString()
    };
  }
}

async function checkWebSocketEndpoint() {
  try {
    // Since we can't establish WebSocket connections in serverless functions,
    // we'll do a basic HTTP check to the WebSocket endpoint
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch('https://swarm-manager-live.fly.dev/ws', {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Upgrade': 'websocket',
        'Connection': 'Upgrade',
        'User-Agent': 'Dashboard-Health-Check/1.0'
      }
    });

    clearTimeout(timeoutId);

    // WebSocket endpoints typically return 400 or 426 for HTTP requests
    // This indicates the endpoint is available but expects WebSocket upgrade
    if (response.status === 400 || response.status === 426) {
      return {
        status: 'healthy',
        note: 'WebSocket endpoint available (HTTP upgrade required)',
        lastCheck: new Date().toISOString()
      };
    } else {
      return {
        status: 'degraded',
        note: `Unexpected response: HTTP ${response.status}`,
        lastCheck: new Date().toISOString()
      };
    }
  } catch (error) {
    return {
      status: 'error',
      error: error.message,
      lastCheck: new Date().toISOString()
    };
  }
}