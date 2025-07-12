import { Router } from 'express';
import { telemetryService } from '../services/telemetry.service';
import { trustGraphService } from '../services/trustgraph';
import { langfuseService } from '../services/langfuse';
import logger from '../services/logger';
import { TraceEndpoint } from '../services/langfuse/decorators';

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
 * GET /telemetry/langfuse/traces
 * Get Langfuse traces
 */
router.get('/langfuse/traces', async (req, res) => {
  try {
    const { model, startTime, endTime, minCost, maxCost } = req.query;

    const filters: any = {};
    if (model) filters.model = model as string;
    if (startTime) filters.startTime = new Date(startTime as string);
    if (endTime) filters.endTime = new Date(endTime as string);
    if (minCost) filters.minCost = parseFloat(minCost as string);
    if (maxCost) filters.maxCost = parseFloat(maxCost as string);

    const traces = langfuseService.getTraces(filters);
    const metrics = langfuseService.getMetrics(
      startTime && endTime ? {
        start: new Date(startTime as string),
        end: new Date(endTime as string)
      } : undefined
    );

    res.json({ traces, metrics });
  } catch (error) {
    logger.error('Failed to get Langfuse traces', { error });
    res.status(500).json({ error: 'Failed to get Langfuse traces' });
  }
});

/**
 * GET /telemetry/trustgraph/nodes
 * Get TrustGraph nodes
 */
router.get('/trustgraph/nodes', async (req, res) => {
  try {
    const { swarmId, type } = req.query;

    // Get actual nodes from TrustGraph service
    const graphData = trustGraphService.exportGraph();
    let nodes = graphData.nodes;

    // Apply filters
    if (swarmId) {
      nodes = nodes.filter(n => n.metadata?.swarmId === swarmId);
    }
    if (type) {
      nodes = nodes.filter(n => n.type === type);
    }

    // Calculate summary
    const nodeTypes = ['swarm', 'worker', 'task', 'api', 'dependency'];
    const summary = {
      total: nodes.length,
      active: nodes.filter(n => n.metadata?.status === 'active').length,
      byType: nodeTypes.reduce((acc, t) => {
        acc[t] = nodes.filter(n => n.type === t).length;
        return acc;
      }, {} as Record<string, number>),
    };

    res.json({ nodes, summary });
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

    // Get actual edges from TrustGraph service
    const graphData = trustGraphService.exportGraph();
    let edges = graphData.edges;

    // Apply filters
    if (swarmId) {
      edges = edges.filter(e => e.metadata?.swarmId === swarmId);
    }
    if (label) {
      edges = edges.filter(e => e.label === label);
    }

    // Calculate summary
    const edgeTypes = ['depends_on', 'executes', 'triggers', 'creates', 'calls'];
    const summary = {
      total: edges.length,
      verified: edges.filter(e => e.metadata?.verified).length,
      byLabel: edges.reduce((acc, e) => {
        acc[e.label] = (acc[e.label] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      byType: edgeTypes.reduce((acc, t) => {
        acc[t] = edges.filter(e => e.type === t).length;
        return acc;
      }, {} as Record<string, number>),
    };

    res.json({ edges, summary });
  } catch (error) {
    logger.error('Failed to get TrustGraph edges', { error });
    res.status(500).json({ error: 'Failed to get TrustGraph edges' });
  }
});

/**
 * GET /telemetry/trustgraph/dag
 * Get TrustGraph DAG analysis
 */
router.get('/trustgraph/dag', async (req, res) => {
  try {
    const analysis = trustGraphService.analyzeDAG();
    res.json(analysis);
  } catch (error) {
    logger.error('Failed to get DAG analysis', { error });
    res.status(500).json({ error: 'Failed to get DAG analysis' });
  }
});

/**
 * GET /telemetry/visualization
 * Get visualization data for the Dashboard
 */
router.get('/visualization', async (req, res) => {
  try {
    const graphData = trustGraphService.getVisualizationData();
    const langfuseMetrics = langfuseService.getMetrics();
    const performanceMetrics = telemetryService.getMetrics();

    res.json({
      graph: graphData,
      langfuse: langfuseMetrics,
      performance: {
        metrics: performanceMetrics,
        summary: performanceMetrics.length > 0 ? {
          spanDuration: telemetryService.getMetricSummary('span.duration'),
          taskCompletion: telemetryService.getMetricSummary('task.completion'),
          swarmOperations: telemetryService.getMetricSummary('swarm.operation')
        } : null
      }
    });
  } catch (error) {
    logger.error('Failed to get visualization data', { error });
    res.status(500).json({ error: 'Failed to get visualization data' });
  }
});

/**
 * GET /telemetry/status
 * Get telemetry service status
 */
router.get('/status', async (req, res) => {
  try {
    const langfuseEnabled = langfuseService.isEnabled();
    const graphData = trustGraphService.exportGraph();
    
    res.json({
      status: 'active',
      langfuse: {
        enabled: langfuseEnabled,
        host: process.env.LANGFUSE_HOST || 'https://cloud.langfuse.com',
        tracesCount: langfuseService.getTraces().length,
        metrics: langfuseEnabled ? langfuseService.getMetrics() : null,
      },
      trustGraph: {
        enabled: !!process.env.TRUSTGRAPH_API_KEY,
        host: process.env.TRUSTGRAPH_API_URL || 'https://api.trustgraph.ai',
        nodesCount: graphData.nodes.length,
        edgesCount: graphData.edges.length,
        dagAnalysis: trustGraphService.analyzeDAG(),
      },
      metrics: {
        totalRecorded: telemetryService.getMetrics().length,
        uniqueNames: new Set(telemetryService.getMetrics().map(m => m.name)).size,
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