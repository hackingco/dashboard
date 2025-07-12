import { Router } from 'express';
import { observabilityOrchestrator } from '../services/observability-orchestrator.service';
import { trustGraphService } from '../services/trustgraph/trustgraph.service';
import { langfuseService } from '../services/langfuse/langfuse.service';
import logger from '../services/logger';

const router = Router();

// Initialize observability orchestrator
observabilityOrchestrator.initialize().catch(err => {
  logger.error('Failed to initialize observability orchestrator', { error: err });
});

// Get observability session by ID
router.get('/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = observabilityOrchestrator.getSessionById(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    res.json(session);
  } catch (error) {
    logger.error('Failed to get observability session', { error });
    res.status(500).json({ error: 'Failed to get session' });
  }
});

// Get all sessions for a swarm
router.get('/swarms/:swarmId', async (req, res) => {
  try {
    const { swarmId } = req.params;
    const data = await observabilityOrchestrator.getSwarmObservabilityData(swarmId);
    res.json(data);
  } catch (error) {
    logger.error('Failed to get swarm observability data', { error });
    res.status(500).json({ error: 'Failed to get swarm data' });
  }
});

// Get current metrics
router.get('/metrics', async (req, res) => {
  try {
    const metrics = observabilityOrchestrator.getCurrentMetrics();
    const history = observabilityOrchestrator.getMetricsHistory();
    
    res.json({
      current: metrics,
      history: history.slice(-10) // Last 10 data points
    });
  } catch (error) {
    logger.error('Failed to get observability metrics', { error });
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

// Get TrustGraph visualization data
router.get('/trustgraph/:swarmId', async (req, res) => {
  try {
    const { swarmId } = req.params;
    const data = trustGraphService.getSwarmVisualizationData(swarmId);
    const analysis = trustGraphService.analyzeSwarmDAG(swarmId);
    
    res.json({
      ...data,
      analysis
    });
  } catch (error) {
    logger.error('Failed to get TrustGraph data', { error });
    res.status(500).json({ error: 'Failed to get TrustGraph data' });
  }
});

// Export entire TrustGraph
router.get('/trustgraph/export', async (req, res) => {
  try {
    const graph = trustGraphService.exportGraph();
    res.json(graph);
  } catch (error) {
    logger.error('Failed to export TrustGraph', { error });
    res.status(500).json({ error: 'Failed to export graph' });
  }
});

// Get Langfuse traces by correlation ID
router.get('/langfuse/traces', async (req, res) => {
  try {
    const { correlation_id, swarm_id, start_time, end_time } = req.query;
    
    const filters: any = {};
    if (start_time) filters.startTime = new Date(start_time as string);
    if (end_time) filters.endTime = new Date(end_time as string);
    
    const traces = langfuseService.getTraces(filters);
    
    // Filter by metadata if correlation_id or swarm_id provided
    let filteredTraces = traces;
    if (correlation_id) {
      filteredTraces = traces.filter(t => 
        t.metadata?.correlation_id === correlation_id
      );
    }
    if (swarm_id) {
      filteredTraces = filteredTraces.filter(t => 
        t.metadata?.swarm_id === swarm_id
      );
    }
    
    const metrics = langfuseService.getMetrics();
    
    res.json({
      traces: filteredTraces,
      metrics
    });
  } catch (error) {
    logger.error('Failed to get Langfuse traces', { error });
    res.status(500).json({ error: 'Failed to get traces' });
  }
});

// Start new observability session
router.post('/sessions', async (req, res) => {
  try {
    const { swarm_id, operation_type, metadata } = req.body;
    
    if (!swarm_id || !operation_type) {
      return res.status(400).json({ error: 'swarm_id and operation_type required' });
    }
    
    const session = await observabilityOrchestrator.startObservabilitySession(
      swarm_id,
      operation_type,
      metadata
    );
    
    res.json(session);
  } catch (error) {
    logger.error('Failed to start observability session', { error });
    res.status(500).json({ error: 'Failed to start session' });
  }
});

// End observability session
router.post('/sessions/:sessionId/end', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { status, error } = req.body;
    
    const session = await observabilityOrchestrator.endObservabilitySession(
      sessionId,
      status || 'completed',
      error ? new Error(error) : undefined
    );
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    res.json(session);
  } catch (error) {
    logger.error('Failed to end observability session', { error });
    res.status(500).json({ error: 'Failed to end session' });
  }
});

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    const health = {
      status: 'ok',
      services: {
        orchestrator: observabilityOrchestrator.isOrchestratorInitialized(),
        langfuse: langfuseService.isEnabled(),
        trustgraph: true,
        sessions: observabilityOrchestrator.getActiveSessions().length
      }
    };
    
    res.json(health);
  } catch (error) {
    logger.error('Observability health check failed', { error });
    res.status(500).json({ 
      status: 'error',
      error: error.message 
    });
  }
});

export default router;