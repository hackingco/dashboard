#!/usr/bin/env node

/**
 * CORS Proxy Server for Swarm Manager Dashboard
 * 
 * This temporary solution allows the dashboard to communicate with the Fly.io backend
 * while the main deployment is being fixed.
 * 
 * Usage: node cors-proxy-server.js
 * 
 * The proxy will:
 * 1. Accept requests from the Vercel dashboard (https://dist-d4ex7zt2q-hackingco.vercel.app)
 * 2. Forward them to the Fly.io backend (https://swarm-manager-flat-water-2021.fly.dev)
 * 3. Add proper CORS headers to allow the communication
 */

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3456;

// Target Fly.io backend
const TARGET_URL = 'https://swarm-manager-flat-water-2021.fly.dev';

// Allowed dashboard URLs
const ALLOWED_ORIGINS = [
  'https://dist-d4ex7zt2q-hackingco.vercel.app',
  'https://dist-cqq7lpfmg-hackingco.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001'
];

// Enable CORS for dashboard
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);
    
    if (ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

// Proxy configuration
const proxyOptions = {
  target: TARGET_URL,
  changeOrigin: true,
  ws: true, // Enable WebSocket proxying
  logLevel: 'debug',
  onProxyReq: (proxyReq, req, res) => {
    // Log the request being proxied
    console.log(`[PROXY] ${req.method} ${req.url} -> ${TARGET_URL}${req.url}`);
    
    // Forward authentication headers
    if (req.headers.authorization) {
      proxyReq.setHeader('Authorization', req.headers.authorization);
    }
  },
  onProxyRes: (proxyRes, req, res) => {
    // Add CORS headers to the response
    proxyRes.headers['Access-Control-Allow-Origin'] = req.headers.origin || '*';
    proxyRes.headers['Access-Control-Allow-Credentials'] = 'true';
    proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS, PATCH';
    proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With, Accept';
    
    console.log(`[PROXY] Response: ${proxyRes.statusCode} for ${req.method} ${req.url}`);
  },
  onError: (err, req, res) => {
    console.error('[PROXY] Error:', err);
    res.status(500).json({
      error: 'Proxy error',
      message: err.message
    });
  }
};

// Create proxy middleware
const proxy = createProxyMiddleware(proxyOptions);

// Apply proxy to all routes
app.use('/', proxy);

// Start the server
app.listen(PORT, () => {
  console.log(`
🚀 CORS Proxy Server Running
==============================
Port: ${PORT}
Dashboard URL: ${ALLOWED_ORIGINS[0]}
Backend URL: ${TARGET_URL}
==============================

The proxy is now accepting requests from the dashboard and forwarding them to the Fly.io backend.

Test URLs:
- Health Check: http://localhost:${PORT}/health
- Auth Token: http://localhost:${PORT}/api/auth/token
- Swarms List: http://localhost:${PORT}/api/swarms
- Telemetry: http://localhost:${PORT}/api/telemetry

To use with the dashboard:
1. Update the dashboard API URL to: http://localhost:${PORT}
2. Or deploy this proxy to a cloud service and update accordingly
  `);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down CORS proxy server...');
  process.exit(0);
});