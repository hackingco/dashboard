#!/usr/bin/env node

/**
 * Langfuse Worker for Hive Mind Swarm
 * Handles authentication, batch processing, and trace sending to Langfuse
 */

const { Langfuse } = require('langfuse');
const { WebSocket } = require('ws');
const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');

// Load environment configuration
try {
  require('dotenv').config({ path: '.env.langfuse' });
} catch (error) {
  // dotenv is optional, continue without it
  console.log('dotenv not available, using process.env directly');
}

class LangfuseWorker extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.config = {
      publicKey: options.publicKey || process.env.LANGFUSE_PUBLIC_KEY,
      secretKey: options.secretKey || process.env.LANGFUSE_SECRET_KEY,
      baseUrl: (options.baseUrl || process.env.LANGFUSE_HOST || 'http://localhost:3000').trim(),
      batchSize: parseInt(options.batchSize || process.env.CLAUDE_FLOW_BATCH_SIZE || '50'),
      flushInterval: parseInt(options.flushInterval || process.env.CLAUDE_FLOW_FLUSH_INTERVAL || '3000'),
      maxRetries: parseInt(options.maxRetries || process.env.LANGFUSE_MAX_RETRIES || '3'),
      requestTimeout: parseInt(options.requestTimeout || process.env.LANGFUSE_REQUEST_TIMEOUT || '30000'),
      workerEnabled: options.workerEnabled !== false && process.env.LANGFUSE_WORKER_ENABLED !== 'false',
      debug: options.debug || process.env.CLAUDE_FLOW_DEBUG_MODE === 'true'
    };

    this.client = null;
    this.initialized = false;
    this.connected = false;
    this.traceQueue = [];
    this.batchProcessor = null;
    this.retryQueue = [];
    this.metrics = {
      totalTraces: 0,
      successfulTraces: 0,
      failedTraces: 0,
      batches: 0,
      lastFlush: null,
      errors: []
    };

    // Auto-initialize if enabled
    if (this.config.workerEnabled) {
      this.initialize();
    }
  }

  /**
   * Initialize the Langfuse worker
   */
  async initialize() {
    try {
      this.log('🚀 Initializing Langfuse Worker...');
      
      // Validate configuration
      if (!this.config.publicKey || !this.config.secretKey) {
        throw new Error('Missing Langfuse credentials. Please set LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY');
      }

      // Initialize Langfuse client with proper authentication
      this.client = new Langfuse({
        publicKey: this.config.publicKey,
        secretKey: this.config.secretKey,
        baseUrl: this.config.baseUrl,
        flushAt: this.config.batchSize,
        flushInterval: this.config.flushInterval,
        requestTimeout: this.config.requestTimeout,
        debug: this.config.debug
      });

      // Test connection
      await this.testConnection();

      // Start batch processor
      this.startBatchProcessor();

      this.initialized = true;
      this.connected = true;
      
      this.log('✅ Langfuse Worker initialized successfully');
      this.log(`📡 Connected to: ${this.config.baseUrl}`);
      this.log(`⚙️  Batch size: ${this.config.batchSize}, Flush interval: ${this.config.flushInterval}ms`);
      
      this.emit('initialized');
      
    } catch (error) {
      this.logError('Failed to initialize Langfuse Worker', error);
      this.emit('error', error);
    }
  }

  /**
   * Test connection to Langfuse
   */
  async testConnection() {
    try {
      // Create a test trace to verify connection
      const testTrace = this.client.trace({
        id: `test-${Date.now()}`,
        name: 'Langfuse Worker Connection Test',
        input: { message: 'Testing connection' },
        metadata: {
          test: true,
          timestamp: new Date().toISOString(),
          worker: 'langfuse-worker'
        }
      });

      // Flush to ensure it's sent
      await this.client.flushAsync();
      
      this.log('✅ Connection test successful');
      return true;
      
    } catch (error) {
      this.logError('Connection test failed', error);
      throw error;
    }
  }

  /**
   * Start the batch processor
   */
  startBatchProcessor() {
    if (this.batchProcessor) {
      clearInterval(this.batchProcessor);
    }

    this.batchProcessor = setInterval(() => {
      this.processBatch();
    }, this.config.flushInterval);

    this.log('🔄 Batch processor started');
  }

  /**
   * Stop the batch processor
   */
  stopBatchProcessor() {
    if (this.batchProcessor) {
      clearInterval(this.batchProcessor);
      this.batchProcessor = null;
      this.log('⏹️  Batch processor stopped');
    }
  }

  /**
   * Add trace to processing queue
   */
  queueTrace(traceData) {
    if (!this.initialized || !this.connected) {
      this.log('⚠️  Worker not initialized, queuing trace for later processing');
    }

    this.traceQueue.push({
      ...traceData,
      timestamp: new Date().toISOString(),
      id: traceData.id || `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    });

    this.log(`📥 Queued trace: ${traceData.name || 'Unnamed'} (Queue size: ${this.traceQueue.length})`);

    // Process immediately if batch is full
    if (this.traceQueue.length >= this.config.batchSize) {
      this.processBatch();
    }
  }

  /**
   * Process batch of traces
   */
  async processBatch() {
    if (this.traceQueue.length === 0) return;

    const batch = this.traceQueue.splice(0, this.config.batchSize);
    this.metrics.batches++;

    this.log(`🔄 Processing batch of ${batch.length} traces...`);

    try {
      // Send each trace in the batch
      const promises = batch.map(async (traceData) => {
        try {
          await this.sendTrace(traceData);
          this.metrics.successfulTraces++;
          return { success: true, traceId: traceData.id };
        } catch (error) {
          this.metrics.failedTraces++;
          this.logError(`Failed to send trace ${traceData.id}`, error);
          
          // Add to retry queue
          this.retryQueue.push({
            ...traceData,
            retryCount: (traceData.retryCount || 0) + 1,
            lastError: error.message
          });
          
          return { success: false, traceId: traceData.id, error: error.message };
        }
      });

      const results = await Promise.allSettled(promises);
      
      // Flush to ensure all traces are sent
      await this.client.flushAsync();
      
      this.metrics.lastFlush = new Date().toISOString();
      
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const failed = results.length - successful;
      
      this.log(`✅ Batch processed: ${successful} successful, ${failed} failed`);
      
      // Process retry queue
      if (this.retryQueue.length > 0) {
        this.processRetryQueue();
      }
      
      this.emit('batch-processed', {
        batchSize: batch.length,
        successful,
        failed,
        totalQueue: this.traceQueue.length
      });
      
    } catch (error) {
      this.logError('Batch processing failed', error);
      // Re-queue failed traces
      this.traceQueue.unshift(...batch);
      this.emit('batch-failed', error);
    }
  }

  /**
   * Process retry queue
   */
  async processRetryQueue() {
    const retryBatch = this.retryQueue.filter(trace => 
      trace.retryCount <= this.config.maxRetries
    );

    if (retryBatch.length === 0) {
      // Clear permanently failed traces
      this.retryQueue = [];
      return;
    }

    this.log(`🔄 Processing ${retryBatch.length} traces from retry queue...`);

    for (const trace of retryBatch) {
      try {
        await this.sendTrace(trace);
        this.metrics.successfulTraces++;
        
        // Remove from retry queue
        this.retryQueue = this.retryQueue.filter(t => t.id !== trace.id);
        
      } catch (error) {
        this.logError(`Retry failed for trace ${trace.id}`, error);
        trace.retryCount++;
        trace.lastError = error.message;
        
        if (trace.retryCount >= this.config.maxRetries) {
          this.log(`⚠️  Trace ${trace.id} exceeded max retries, removing from queue`);
          this.retryQueue = this.retryQueue.filter(t => t.id !== trace.id);
          this.metrics.failedTraces++;
        }
      }
    }
  }

  /**
   * Send individual trace to Langfuse
   */
  async sendTrace(traceData) {
    if (!this.client || !this.initialized) {
      throw new Error('Langfuse client not initialized');
    }

    const trace = this.client.trace({
      id: traceData.id,
      name: traceData.name || 'Swarm Activity',
      sessionId: traceData.sessionId || 'hive-mind-swarm',
      userId: traceData.userId || 'swarm-agent',
      input: traceData.input || {},
      output: traceData.output || {},
      metadata: {
        ...traceData.metadata,
        swarmId: traceData.swarmId || 'hive-mind',
        agentId: traceData.agentId || 'worker',
        timestamp: traceData.timestamp,
        worker: 'langfuse-worker',
        version: '1.0.0'
      },
      tags: traceData.tags || ['hive-mind', 'swarm', 'worker']
    });

    // Add spans if present
    if (traceData.spans && Array.isArray(traceData.spans)) {
      for (const spanData of traceData.spans) {
        trace.span({
          id: spanData.id,
          name: spanData.name,
          input: spanData.input,
          output: spanData.output,
          metadata: spanData.metadata
        });
      }
    }

    // Add generations if present
    if (traceData.generations && Array.isArray(traceData.generations)) {
      for (const genData of traceData.generations) {
        trace.generation({
          id: genData.id,
          name: genData.name,
          input: genData.input,
          output: genData.output,
          model: genData.model,
          usage: genData.usage,
          metadata: genData.metadata
        });
      }
    }

    this.metrics.totalTraces++;
    this.log(`📤 Sent trace: ${traceData.name} (ID: ${traceData.id})`);
  }

  /**
   * Create trace from swarm activity
   */
  createSwarmTrace(activity) {
    const trace = {
      id: `swarm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: activity.name || 'Swarm Activity',
      sessionId: activity.sessionId || 'hive-mind-swarm',
      userId: activity.userId || 'swarm-coordinator',
      input: activity.input || { activity: activity.type },
      output: activity.output || { result: 'processed' },
      metadata: {
        activityType: activity.type,
        agentId: activity.agentId,
        swarmId: activity.swarmId || 'hive-mind',
        timestamp: new Date().toISOString(),
        ...activity.metadata
      },
      tags: ['hive-mind', 'swarm', activity.type || 'activity']
    };

    this.queueTrace(trace);
    return trace.id;
  }

  /**
   * Monitor swarm activities and create traces
   */
  monitorSwarmActivity() {
    const memoryDbPath = path.join(process.cwd(), '.swarm', 'memory.db');
    
    if (!fs.existsSync(memoryDbPath)) {
      this.log('⚠️  Swarm memory database not found, starting without monitoring');
      return;
    }

    // Watch for changes in swarm memory
    const Database = require('better-sqlite3');
    const db = new Database(memoryDbPath);

    // Check for new activities every 5 seconds
    setInterval(() => {
      try {
        const activities = db.prepare(`
          SELECT * FROM memory 
          WHERE key LIKE 'hive/%' 
          AND timestamp > datetime('now', '-5 seconds')
          ORDER BY timestamp DESC
        `).all();

        for (const activity of activities) {
          const activityData = JSON.parse(activity.value);
          
          this.createSwarmTrace({
            name: `Hive Activity: ${activity.key}`,
            type: 'hive-activity',
            input: { key: activity.key, data: activityData },
            output: { processed: true },
            metadata: {
              memoryKey: activity.key,
              timestamp: activity.timestamp,
              ...activityData
            },
            agentId: activityData.agentId || 'unknown',
            swarmId: activityData.swarmId || 'hive-mind'
          });
        }
      } catch (error) {
        this.logError('Error monitoring swarm activity', error);
      }
    }, 5000);

    this.log('👁️  Started monitoring swarm activities');
  }

  /**
   * Get worker status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      connected: this.connected,
      config: {
        baseUrl: this.config.baseUrl,
        batchSize: this.config.batchSize,
        flushInterval: this.config.flushInterval,
        maxRetries: this.config.maxRetries
      },
      queue: {
        pending: this.traceQueue.length,
        retrying: this.retryQueue.length
      },
      metrics: {
        ...this.metrics,
        uptime: Date.now() - (this.startTime || Date.now())
      }
    };
  }

  /**
   * Get worker metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      queueLength: this.traceQueue.length,
      retryQueueLength: this.retryQueue.length,
      successRate: this.metrics.totalTraces > 0 ? 
        (this.metrics.successfulTraces / this.metrics.totalTraces) * 100 : 0,
      uptime: Date.now() - (this.startTime || Date.now())
    };
  }

  /**
   * Shutdown the worker
   */
  async shutdown() {
    this.log('👋 Shutting down Langfuse Worker...');
    
    // Stop batch processor
    this.stopBatchProcessor();
    
    // Process remaining traces
    if (this.traceQueue.length > 0) {
      this.log(`📤 Processing ${this.traceQueue.length} remaining traces...`);
      await this.processBatch();
    }
    
    // Final flush
    if (this.client) {
      await this.client.flushAsync();
      await this.client.shutdownAsync();
    }
    
    this.connected = false;
    this.initialized = false;
    
    this.log('✅ Langfuse Worker shutdown complete');
    this.emit('shutdown');
  }

  /**
   * Log message with timestamp
   */
  log(message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
  }

  /**
   * Log error with details
   */
  logError(message, error) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] ❌ ${message}:`, error.message);
    
    if (this.config.debug) {
      console.error(error.stack);
    }
    
    // Store error in metrics
    this.metrics.errors.push({
      timestamp,
      message,
      error: error.message,
      stack: error.stack
    });
    
    // Keep only last 100 errors
    if (this.metrics.errors.length > 100) {
      this.metrics.errors = this.metrics.errors.slice(-100);
    }
  }
}

// CLI interface
if (require.main === module) {
  const worker = new LangfuseWorker();
  worker.startTime = Date.now();
  
  // Handle graceful shutdown
  process.on('SIGTERM', async () => {
    await worker.shutdown();
    process.exit(0);
  });
  
  process.on('SIGINT', async () => {
    await worker.shutdown();
    process.exit(0);
  });
  
  // Start monitoring
  worker.monitorSwarmActivity();
  
  // Status endpoint (simple HTTP server)
  const http = require('http');
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    
    if (req.url === '/status') {
      res.end(JSON.stringify(worker.getStatus(), null, 2));
    } else if (req.url === '/metrics') {
      res.end(JSON.stringify(worker.getMetrics(), null, 2));
    } else {
      res.end(JSON.stringify({ 
        message: 'Langfuse Worker',
        endpoints: ['/status', '/metrics']
      }));
    }
  });
  
  server.listen(8080, () => {
    console.log('📊 Status server running on http://localhost:8080');
  });
}

module.exports = LangfuseWorker;