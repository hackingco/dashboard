import { Router } from 'express';
import { telemetryService } from '../services/telemetry.service';
import logger from '../services/logger';

const router = Router();

/**
 * GET /telemetry/metrics
 * Get performance metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    const { name, since, swarmId } = req.query;
    
    let sinceDate: Date | undefined;
    if (since) {
      if (typeof since === 'string') {
        // Handle relative time ranges
        const now = new Date();
        if (since === '1h') {
          sinceDate = new Date(now.getTime() - 60 * 60 * 1000);
        } else if (since === '6h') {
          sinceDate = new Date(now.getTime() - 6 * 60 * 60 * 1000);
        } else if (since === '24h') {
          sinceDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        } else if (since === '7d') {
          sinceDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        } else {
          sinceDate = new Date(since);
        }
      }
    }

    const metrics = telemetryService.getMetrics(name as string, sinceDate);
    
    // Filter by swarmId if provided
    let filteredMetrics = metrics;
    if (swarmId) {
      filteredMetrics = metrics.filter(m => 
        m.tags?.swarm === swarmId || m.tags?.swarmId === swarmId
      );
    }

    // Calculate summary statistics
    const summary = name ? telemetryService.getMetricSummary(name as string, sinceDate) : null;

    res.json({
      metrics: filteredMetrics,
      summary,
      count: filteredMetrics.length,
      timeRange: since || 'all',
      swarmId,
    });
  } catch (error) {
    logger.error('Failed to get telemetry metrics', { error });
    res.status(500).json({ error: 'Failed to get telemetry metrics' });
  }
});

/**
 * POST /telemetry/metrics
 * Record a performance metric
 */
router.post('/metrics', async (req, res) => {
  try {
    const { name, value, unit, tags } = req.body;

    if (!name || value === undefined || !unit) {
      return res.status(400).json({ 
        error: 'Missing required fields: name, value, unit' 
      });
    }

    telemetryService.recordMetric(name, value, unit, tags);
    
    res.json({ 
      success: true, 
      recorded: new Date().toISOString() 
    });
  } catch (error) {
    logger.error('Failed to record telemetry metric', { error });
    res.status(500).json({ error: 'Failed to record telemetry metric' });
  }
});

/**
 * GET /telemetry/spans
 * Get Langfuse spans (mock data for now)
 */
router.get('/spans', async (req, res) => {
  try {
    const { swarmId, status, name, timeRange = '1h' } = req.query;

    // In production, this would fetch from the telemetry service's active spans
    // For now, return information about spans that would be sent to Langfuse
    
    const timeRangeMs = {
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
    }[timeRange as string] || 60 * 60 * 1000;

    // Generate mock span data that would represent what's sent to Langfuse
    const spans = Array.from({ length: 25 }, (_, i) => {
      const startTime = new Date(Date.now() - Math.random() * timeRangeMs);
      const duration = Math.floor(Math.random() * 2000) + 100;
      const spanStatus = ['success', 'success', 'success', 'error', 'pending'][Math.floor(Math.random() * 5)];
      
      return {
        id: `span-${i + 1}`,
        name: [
          'SwarmCreation',
          'TaskExecution',
          'WorkerAssignment', 
          'ApiRequest',
          'DatabaseQuery'
        ][Math.floor(Math.random() * 5)],
        startTime,
        endTime: spanStatus === 'pending' ? undefined : new Date(startTime.getTime() + duration),
        duration: spanStatus === 'pending' ? undefined : duration,
        status: spanStatus,
        input: {
          swarmId: swarmId || `swarm-${Math.floor(Math.random() * 3) + 1}`,
          taskType: 'automated',
        },
        output: spanStatus === 'pending' ? undefined : {
          result: spanStatus,
          metrics: { cpu: Math.random() * 100 }
        },
        metadata: {
          environment: 'production',
          version: '1.0.0',
        }
      };
    });

    // Apply filters
    let filteredSpans = spans;
    if (swarmId) {
      filteredSpans = filteredSpans.filter(s => s.input.swarmId === swarmId);
    }
    if (status) {
      filteredSpans = filteredSpans.filter(s => s.status === status);
    }
    if (name) {
      filteredSpans = filteredSpans.filter(s => 
        s.name.toLowerCase().includes((name as string).toLowerCase())
      );
    }

    res.json({
      spans: filteredSpans,
      summary: {
        total: filteredSpans.length,
        success: filteredSpans.filter(s => s.status === 'success').length,
        error: filteredSpans.filter(s => s.status === 'error').length,
        pending: filteredSpans.filter(s => s.status === 'pending').length,
        avgDuration: filteredSpans.filter(s => s.duration).reduce((sum, s) => sum + (s.duration || 0), 0) / 
                    filteredSpans.filter(s => s.duration).length || 0,
      }
    });
  } catch (error) {
    logger.error('Failed to get telemetry spans', { error });
    res.status(500).json({ error: 'Failed to get telemetry spans' });
  }
});

/**
 * GET /telemetry/trustgraph/nodes
 * Get TrustGraph nodes
 */
router.get('/trustgraph/nodes', async (req, res) => {
  try {
    const { swarmId, type } = req.query;

    // Mock TrustGraph nodes - in production would come from actual TrustGraph API
    const nodeTypes = ['swarm', 'worker', 'task', 'manager', 'database'];
    const nodes = Array.from({ length: 15 }, (_, i) => ({
      id: `node-${i + 1}`,
      type: nodeTypes[Math.floor(Math.random() * nodeTypes.length)],
      label: `Node ${i + 1}`,
      metadata: {
        createdAt: new Date(Date.now() - Math.random() * 86400000).toISOString(),
        status: Math.random() > 0.1 ? 'active' : 'inactive',
        swarmId: swarmId || `swarm-${Math.floor(Math.random() * 3) + 1}`,
      },
    }));

    // Apply filters
    let filteredNodes = nodes;
    if (swarmId) {
      filteredNodes = filteredNodes.filter(n => n.metadata.swarmId === swarmId);
    }
    if (type) {
      filteredNodes = filteredNodes.filter(n => n.type === type);
    }

    res.json({
      nodes: filteredNodes,
      summary: {
        total: filteredNodes.length,
        active: filteredNodes.filter(n => n.metadata.status === 'active').length,
        byType: nodeTypes.reduce((acc, t) => {
          acc[t] = filteredNodes.filter(n => n.type === t).length;
          return acc;
        }, {} as Record<string, number>),
      }
    });
  } catch (error) {
    logger.error('Failed to get TrustGraph nodes', { error });
    res.status(500).json({ error: 'Failed to get TrustGraph nodes' });
  }
});

/**
 * GET /telemetry/trustgraph/edges  
 * Get TrustGraph edges
 */
router.get('/trustgraph/edges', async (req, res) => {
  try {
    const { swarmId, label } = req.query;

    // Mock TrustGraph edges
    const edgeLabels = ['deployed', 'assigned', 'executed', 'linked', 'depends_on', 'manages'];
    const edges = Array.from({ length: 20 }, (_, i) => ({
      source: `node-${Math.floor(Math.random() * 15) + 1}`,
      target: `node-${Math.floor(Math.random() * 15) + 1}`,
      label: edgeLabels[Math.floor(Math.random() * edgeLabels.length)],
      metadata: {
        createdAt: new Date(Date.now() - Math.random() * 86400000).toISOString(),
        strength: Math.random(),
        verified: Math.random() > 0.2,
        swarmId: swarmId || `swarm-${Math.floor(Math.random() * 3) + 1}`,
      },
    }));

    // Apply filters
    let filteredEdges = edges;
    if (swarmId) {
      filteredEdges = filteredEdges.filter(e => e.metadata.swarmId === swarmId);
    }
    if (label) {
      filteredEdges = filteredEdges.filter(e => e.label === label);
    }

    res.json({
      edges: filteredEdges,
      summary: {
        total: filteredEdges.length,
        verified: filteredEdges.filter(e => e.metadata.verified).length,
        byLabel: edgeLabels.reduce((acc, l) => {
          acc[l] = filteredEdges.filter(e => e.label === l).length;
          return acc;
        }, {} as Record<string, number>),
      }
    });
  } catch (error) {
    logger.error('Failed to get TrustGraph edges', { error });
    res.status(500).json({ error: 'Failed to get TrustGraph edges' });
  }
});

/**
 * GET /telemetry/status
 * Get telemetry service status
 */
router.get('/status', async (req, res) => {
  try {
    // Get current telemetry configuration and status
    res.json({
      status: 'active',
      langfuse: {
        enabled: process.env.LANGFUSE_SECRET_KEY ? true : false,
        host: process.env.LANGFUSE_HOST || 'https://cloud.langfuse.com',
        queueSize: Math.floor(Math.random() * 10), // Mock queue size
        lastFlush: new Date().toISOString(),
      },
      trustGraph: {
        enabled: process.env.TRUSTGRAPH_API_KEY ? true : false,
        host: process.env.TRUSTGRAPH_API_URL || 'https://api.trustgraph.ai',
        nodeQueue: Math.floor(Math.random() * 5),
        edgeQueue: Math.floor(Math.random() * 8),
        lastFlush: new Date().toISOString(),
      },
      metrics: {
        totalRecorded: Math.floor(Math.random() * 10000) + 1000,
        uniqueNames: Math.floor(Math.random() * 50) + 20,
        retentionPeriod: '7 days',
      },
      uptime: process.uptime(),
      version: '1.0.0',
    });
  } catch (error) {
    logger.error('Failed to get telemetry status', { error });
    res.status(500).json({ error: 'Failed to get telemetry status' });
  }
});

export default router;