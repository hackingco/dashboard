import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import bodyParser from 'body-parser';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// In-memory data store (replace with database in production)
const dataStore = {
  keys: [],
  validations: [],
  rotationSchedules: [],
  auditLogs: [],
  metrics: {
    totalRequests: 0,
    successfulValidations: 0,
    failedValidations: 0,
  }
};

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Helper function to emit events
const emitEvent = (event, data) => {
  io.emit(event, data);
};

// Dashboard stats endpoint
app.get('/api/dashboard/stats', (req, res) => {
  const activeKeys = dataStore.keys.filter(k => k.status === 'active').length;
  const expiredKeys = dataStore.keys.filter(k => k.status === 'expired').length;
  const validationRate = dataStore.metrics.totalRequests > 0 
    ? Math.round((dataStore.metrics.successfulValidations / dataStore.metrics.totalRequests) * 100)
    : 0;

  res.json({
    totalKeys: dataStore.keys.length,
    activeKeys,
    expiredKeys,
    rotationsToday: Math.floor(Math.random() * 10),
    validationRate,
    avgResponseTime: Math.floor(Math.random() * 100) + 20,
  });
});

// Dashboard activity endpoint
app.get('/api/dashboard/activity', (req, res) => {
  const recentActivity = dataStore.auditLogs
    .slice(-10)
    .map(log => ({
      id: log.id,
      type: log.eventType.split('.')[1],
      description: log.description,
      timestamp: log.timestamp,
    }));
  
  res.json(recentActivity);
});

// Dashboard performance endpoint
app.get('/api/dashboard/performance', (req, res) => {
  const data = [];
  for (let i = 0; i < 24; i++) {
    data.push({
      time: new Date(Date.now() - (24 - i) * 60 * 60 * 1000).toISOString(),
      responseTime: Math.floor(Math.random() * 50) + 30,
      validations: Math.floor(Math.random() * 100) + 50,
    });
  }
  res.json(data);
});

// Dashboard distribution endpoint
app.get('/api/dashboard/distribution', (req, res) => {
  res.json([
    { name: 'Production', value: 45 },
    { name: 'Development', value: 30 },
    { name: 'Testing', value: 15 },
    { name: 'Staging', value: 10 },
  ]);
});

// Keys endpoints
app.get('/api/keys', (req, res) => {
  const { status } = req.query;
  let keys = dataStore.keys;
  
  if (status) {
    keys = keys.filter(k => k.status === status);
  }
  
  res.json(keys);
});

app.post('/api/keys', (req, res) => {
  const newKey = {
    id: `key_${Date.now()}`,
    key: `sk_live_${Math.random().toString(36).substring(2, 15)}`,
    name: req.body.name,
    description: req.body.description,
    status: 'active',
    createdAt: new Date().toISOString(),
    lastUsed: null,
    expiresAt: req.body.expiresIn === 'never' 
      ? null 
      : new Date(Date.now() + parseInt(req.body.expiresIn) * 24 * 60 * 60 * 1000).toISOString(),
  };
  
  dataStore.keys.push(newKey);
  
  // Emit real-time update
  emitEvent('key:created', newKey);
  
  // Add audit log
  addAuditLog('key.created', `API key created: ${newKey.name}`, newKey.id);
  
  res.status(201).json(newKey);
});

app.delete('/api/keys/:id', (req, res) => {
  const { id } = req.params;
  const keyIndex = dataStore.keys.findIndex(k => k.id === id);
  
  if (keyIndex === -1) {
    return res.status(404).json({ error: 'Key not found' });
  }
  
  const deletedKey = dataStore.keys.splice(keyIndex, 1)[0];
  
  // Emit real-time update
  emitEvent('key:deleted', { id, name: deletedKey.name });
  
  // Add audit log
  addAuditLog('key.deleted', `API key deleted: ${deletedKey.name}`, id);
  
  res.status(204).send();
});

app.post('/api/keys/:id/rotate', (req, res) => {
  const { id } = req.params;
  const key = dataStore.keys.find(k => k.id === id);
  
  if (!key) {
    return res.status(404).json({ error: 'Key not found' });
  }
  
  const oldKey = key.key;
  key.key = `sk_live_${Math.random().toString(36).substring(2, 15)}`;
  key.lastRotated = new Date().toISOString();
  
  // Emit real-time update
  emitEvent('key:rotated', key);
  
  // Add audit log
  addAuditLog('key.rotated', `API key rotated: ${key.name}`, id);
  
  res.json(key);
});

// Validation endpoints
app.post('/api/validation/validate', (req, res) => {
  const { key } = req.body;
  dataStore.metrics.totalRequests++;
  
  const apiKey = dataStore.keys.find(k => k.key === key);
  const valid = !!apiKey && apiKey.status === 'active';
  
  if (valid) {
    dataStore.metrics.successfulValidations++;
    apiKey.lastUsed = new Date().toISOString();
  } else {
    dataStore.metrics.failedValidations++;
  }
  
  const validation = {
    id: `val_${Date.now()}`,
    key: key.substring(0, 10) + '...',
    keyMasked: key.substring(0, 10) + '...' + key.substring(key.length - 4),
    valid,
    reason: valid ? null : (apiKey ? 'Key is inactive' : 'Key not found'),
    keyName: apiKey?.name,
    timestamp: new Date().toISOString(),
    responseTime: Math.floor(Math.random() * 50) + 10,
  };
  
  dataStore.validations.unshift(validation);
  if (dataStore.validations.length > 100) {
    dataStore.validations = dataStore.validations.slice(0, 100);
  }
  
  // Add audit log
  addAuditLog('key.validated', `API key validation: ${valid ? 'success' : 'failed'}`, apiKey?.id);
  
  res.json({
    valid,
    reason: validation.reason,
    keyInfo: valid ? {
      name: apiKey.name,
      status: apiKey.status,
      createdAt: apiKey.createdAt,
      permissions: ['read', 'write'],
    } : null,
  });
});

app.get('/api/validation/stats', (req, res) => {
  const successRate = dataStore.metrics.totalRequests > 0
    ? Math.round((dataStore.metrics.successfulValidations / dataStore.metrics.totalRequests) * 100)
    : 0;
    
  const failureReasons = {};
  dataStore.validations
    .filter(v => !v.valid)
    .forEach(v => {
      failureReasons[v.reason] = (failureReasons[v.reason] || 0) + 1;
    });
    
  const sortedReasons = Object.entries(failureReasons)
    .map(([reason, count]) => ({
      reason,
      count,
      percentage: Math.round((count / dataStore.metrics.failedValidations) * 100),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  
  res.json({
    totalValidations: dataStore.metrics.totalRequests,
    successRate,
    avgResponseTime: Math.floor(Math.random() * 50) + 20,
    failureReasons: sortedReasons,
  });
});

app.get('/api/validation/history', (req, res) => {
  res.json(dataStore.validations.slice(0, 20));
});

// Rotation endpoints
app.get('/api/rotation/schedules', (req, res) => {
  res.json(dataStore.rotationSchedules);
});

app.post('/api/rotation/schedules', (req, res) => {
  const { keyId, frequencyDays, notificationsEnabled, notifyBeforeDays } = req.body;
  const key = dataStore.keys.find(k => k.id === keyId);
  
  if (!key) {
    return res.status(400).json({ error: 'Invalid key ID' });
  }
  
  const schedule = {
    id: `sched_${Date.now()}`,
    keyId,
    keyName: key.name,
    frequencyDays: parseInt(frequencyDays),
    nextRotation: new Date(Date.now() + parseInt(frequencyDays) * 24 * 60 * 60 * 1000).toISOString(),
    lastRotated: null,
    status: 'active',
    notificationsEnabled,
    notifyBeforeDays: parseInt(notifyBeforeDays),
    createdAt: new Date().toISOString(),
  };
  
  dataStore.rotationSchedules.push(schedule);
  res.status(201).json(schedule);
});

app.get('/api/rotation/stats', (req, res) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  const dueToday = dataStore.rotationSchedules.filter(s => {
    const nextRotation = new Date(s.nextRotation);
    return nextRotation >= today && nextRotation < new Date(today.getTime() + 24 * 60 * 60 * 1000);
  }).length;
  
  const overdue = dataStore.rotationSchedules.filter(s => 
    new Date(s.nextRotation) < now && s.status === 'active'
  ).length;
  
  res.json({
    totalScheduled: dataStore.rotationSchedules.filter(s => s.status === 'active').length,
    dueToday,
    overdue,
    completedThisMonth: Math.floor(Math.random() * 20) + 10,
  });
});

// Metrics endpoint
app.get('/api/metrics/performance', (req, res) => {
  const { range } = req.query;
  const hours = range === '1h' ? 1 : range === '7d' ? 168 : range === '30d' ? 720 : 24;
  
  const timeSeries = [];
  for (let i = 0; i < Math.min(hours, 48); i++) {
    timeSeries.push({
      time: new Date(Date.now() - (hours - i) * 60 * 60 * 1000).toISOString(),
      responseTime: Math.floor(Math.random() * 50) + 30,
      requests: Math.floor(Math.random() * 1000) + 500,
      errors: Math.floor(Math.random() * 50),
    });
  }
  
  res.json({
    overview: {
      avgResponseTime: Math.floor(Math.random() * 50) + 30,
      totalRequests: Math.floor(Math.random() * 100000) + 50000,
      successRate: 95 + Math.floor(Math.random() * 4),
      errorRate: 1 + Math.floor(Math.random() * 4),
      activeKeys: dataStore.keys.filter(k => k.status === 'active').length,
      peakLoad: Math.floor(Math.random() * 1000) + 500,
    },
    timeSeries,
    keyUsage: [
      { name: 'Production API', value: 45 },
      { name: 'Development API', value: 30 },
      { name: 'Testing API', value: 15 },
      { name: 'Internal Services', value: 10 },
    ],
    errorBreakdown: [
      { type: 'Invalid Key', count: 150 },
      { type: 'Rate Limit', count: 80 },
      { type: 'Expired Key', count: 45 },
      { type: 'Network Error', count: 20 },
    ],
    systemHealth: [
      { name: 'CPU Usage', value: 65 },
      { name: 'Memory Usage', value: 72 },
      { name: 'Disk I/O', value: 45 },
      { name: 'Network I/O', value: 58 },
    ],
  });
});

// Audit logs endpoints
app.get('/api/audit/logs', (req, res) => {
  const { page = 1, perPage = 50, search, eventType, dateRange } = req.query;
  let logs = [...dataStore.auditLogs];
  
  // Apply filters
  if (search) {
    logs = logs.filter(log => 
      log.description.toLowerCase().includes(search.toLowerCase()) ||
      log.resource?.toLowerCase().includes(search.toLowerCase())
    );
  }
  
  if (eventType && eventType !== 'all') {
    logs = logs.filter(log => log.eventType === eventType);
  }
  
  // Pagination
  const start = (page - 1) * perPage;
  const paginatedLogs = logs.slice(start, start + perPage);
  
  res.json({
    logs: paginatedLogs,
    total: logs.length,
  });
});

// Security settings endpoints
app.get('/api/security/settings', (req, res) => {
  res.json({
    general: {
      enforceHttps: true,
      allowApiKeyInQuery: false,
      requireUserAgent: true,
      maxFailedAttempts: 5,
      lockoutDuration: 300,
    },
    rotation: {
      enforceRotation: true,
      maxKeyAge: 90,
      warningBeforeExpiry: 7,
      autoRotateOnExpiry: false,
    },
    validation: {
      strictValidation: true,
      checkIpWhitelist: false,
      ipWhitelist: [],
      checkRateLimit: true,
      rateLimitPerMinute: 60,
      rateLimitPerHour: 1000,
    },
    notifications: {
      emailOnKeyCreation: true,
      emailOnKeyRotation: true,
      emailOnKeyDeletion: true,
      emailOnSuspiciousActivity: true,
      webhookEnabled: false,
      webhookUrl: '',
    },
  });
});

// Helper function to add audit logs
function addAuditLog(eventType, description, resource = null) {
  const log = {
    id: `log_${Date.now()}`,
    eventType,
    description,
    resource,
    user: { name: 'Admin User', email: 'admin@example.com' },
    ipAddress: '127.0.0.1',
    userAgent: 'Mozilla/5.0...',
    timestamp: new Date().toISOString(),
    metadata: {},
  };
  
  dataStore.auditLogs.unshift(log);
  if (dataStore.auditLogs.length > 1000) {
    dataStore.auditLogs = dataStore.auditLogs.slice(0, 1000);
  }
}

// Initialize with sample data
function initializeSampleData() {
  // Add sample API keys
  for (let i = 1; i <= 5; i++) {
    dataStore.keys.push({
      id: `key_${i}`,
      key: `sk_live_${Math.random().toString(36).substring(2, 15)}`,
      name: `API Key ${i}`,
      description: `Sample API key for testing`,
      status: i === 5 ? 'expired' : 'active',
      createdAt: new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000).toISOString(),
      lastUsed: i < 3 ? new Date(Date.now() - i * 60 * 60 * 1000).toISOString() : null,
      expiresAt: i === 5 ? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() : null,
    });
  }
  
  // Add sample audit logs
  addAuditLog('key.created', 'API key created: Sample Key 1', 'key_1');
  addAuditLog('key.validated', 'API key validation: success', 'key_2');
  addAuditLog('auth.login', 'User logged in', null);
}

// Initialize sample data
initializeSampleData();

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});