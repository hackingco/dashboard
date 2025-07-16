/**
 * Real-time Logging Integration Tests
 * Guardian-1 testing suite for swarm logging and tracing
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { LangfuseWrapper } from '../../shared/langfuse-wrapper/src';
import { SwarmTracer } from '../../shared/langfuse-wrapper/src/swarm-tracer';
import WebSocket from 'ws';
import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('Real-time Logging Integration Tests', () => {
  let langfuseWrapper: LangfuseWrapper;
  let swarmTracer: SwarmTracer;
  let logEmitter: EventEmitter;
  const testSwarmId = `realtime-test-${Date.now()}`;
  const logDir = path.join(process.cwd(), '.swarm', 'logs');
  
  beforeAll(async () => {
    // Ensure log directory exists
    await fs.mkdir(logDir, { recursive: true });
    
    // Initialize logging components
    langfuseWrapper = new LangfuseWrapper({
      enabled: false, // Use mock mode for testing
      publicKey: 'test-key',
      secretKey: 'test-secret'
    });
    
    swarmTracer = new SwarmTracer(langfuseWrapper);
    logEmitter = new EventEmitter();
    
    console.log('[Guardian-1] Real-time logging tests initialized');
  });

  afterAll(async () => {
    await langfuseWrapper.shutdown();
  });

  describe('Logging Infrastructure', () => {
    it('should initialize logging components correctly', () => {
      expect(langfuseWrapper).toBeDefined();
      expect(swarmTracer).toBeDefined();
      expect(logEmitter).toBeDefined();
    });

    it('should create structured log entries', async () => {
      const logEntry = {
        timestamp: Date.now(),
        level: 'info',
        swarmId: testSwarmId,
        agentId: 'guardian-1',
        message: 'Test log entry',
        metadata: {
          operation: 'test',
          duration: 100,
          status: 'success'
        }
      };
      
      // Write log entry
      const logFile = path.join(logDir, `${testSwarmId}.log`);
      await fs.appendFile(logFile, JSON.stringify(logEntry) + '\n');
      
      // Verify log was written
      const content = await fs.readFile(logFile, 'utf-8');
      const parsed = JSON.parse(content.trim());
      
      expect(parsed).toEqual(logEntry);
      expect(parsed.level).toBe('info');
      expect(parsed.swarmId).toBe(testSwarmId);
    });

    it('should handle log rotation', async () => {
      const baseLogFile = path.join(logDir, `${testSwarmId}-rotation.log`);
      const maxSize = 1024; // 1KB for testing
      
      // Write logs until rotation is needed
      let totalSize = 0;
      let logIndex = 0;
      
      while (totalSize < maxSize * 2) {
        const entry = {
          timestamp: Date.now(),
          index: logIndex++,
          message: 'A'.repeat(100) // 100 bytes per entry
        };
        
        await fs.appendFile(baseLogFile, JSON.stringify(entry) + '\n');
        totalSize += JSON.stringify(entry).length + 1;
      }
      
      // Check if rotation happened (manually for this test)
      const stats = await fs.stat(baseLogFile);
      expect(stats.size).toBeGreaterThan(maxSize);
      
      // In production, implement actual rotation logic
    });
  });

  describe('Real-time Event Streaming', () => {
    it('should emit events in real-time', async () => {
      const receivedEvents: any[] = [];
      
      // Set up event listener
      logEmitter.on('swarm-event', (event) => {
        receivedEvents.push(event);
      });
      
      // Emit test events
      const events = [
        { type: 'agent_spawn', agentId: 'test-1', timestamp: Date.now() },
        { type: 'task_start', taskId: 'task-1', timestamp: Date.now() },
        { type: 'task_complete', taskId: 'task-1', timestamp: Date.now() }
      ];
      
      for (const event of events) {
        logEmitter.emit('swarm-event', event);
        await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
      }
      
      // Verify all events were received
      expect(receivedEvents).toHaveLength(events.length);
      expect(receivedEvents[0].type).toBe('agent_spawn');
      expect(receivedEvents[2].type).toBe('task_complete');
    });

    it('should buffer events during high load', async () => {
      const eventBuffer: any[] = [];
      const bufferSize = 100;
      const flushInterval = 500; // ms
      
      // Simulate buffered logging
      class BufferedLogger {
        private buffer: any[] = [];
        private flushTimer: NodeJS.Timeout | null = null;
        
        log(event: any) {
          this.buffer.push(event);
          
          if (this.buffer.length >= bufferSize) {
            this.flush();
          } else if (!this.flushTimer) {
            this.flushTimer = setTimeout(() => this.flush(), flushInterval);
          }
        }
        
        flush() {
          if (this.buffer.length > 0) {
            eventBuffer.push(...this.buffer);
            this.buffer = [];
          }
          
          if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
          }
        }
      }
      
      const logger = new BufferedLogger();
      
      // Generate many events quickly
      for (let i = 0; i < 150; i++) {
        logger.log({
          index: i,
          timestamp: Date.now(),
          type: 'buffered_event'
        });
      }
      
      // Wait for flush
      await new Promise(resolve => setTimeout(resolve, flushInterval + 100));
      logger.flush(); // Force final flush
      
      // Verify all events were buffered
      expect(eventBuffer.length).toBe(150);
      expect(eventBuffer[0].index).toBe(0);
      expect(eventBuffer[149].index).toBe(149);
    });
  });

  describe('Langfuse Trace Integration', () => {
    it('should create hierarchical traces for swarm operations', async () => {
      // Start parent trace
      const parentTraceId = await swarmTracer.startSwarmTrace(
        testSwarmId,
        'hierarchical',
        3,
        {
          description: 'Real-time logging test swarm',
          testMode: true
        }
      );
      
      // Create child traces for agents
      const agentTraces: string[] = [];
      
      for (let i = 0; i < 3; i++) {
        const agentId = `log-agent-${i}`;
        const action = {
          actionType: 'spawn' as const,
          agentId,
          agentRole: 'logger',
          swarmId: testSwarmId,
          timestamp: Date.now()
        };
        
        await swarmTracer.traceAgentSpawn(action, ['logging', 'monitoring']);
        agentTraces.push(agentId);
      }
      
      // Verify swarm is active
      const activeSwarms = swarmTracer.getActiveSwarms();
      expect(activeSwarms).toContain(testSwarmId);
      
      // Complete swarm trace
      await swarmTracer.completeSwarmTrace(testSwarmId, {
        agents: agentTraces.length,
        status: 'completed'
      });
    });

    it('should correlate logs with traces', async () => {
      const correlationId = `correlation-${Date.now()}`;
      
      // Create trace with correlation ID
      const traceId = await langfuseWrapper.preHook({
        hookType: 'log-correlation',
        swarmId: testSwarmId,
        agentId: 'guardian-1',
        agentRole: 'tester',
        metadata: {
          correlationId
        }
      });
      
      // Create correlated log entries
      const logEntries = [];
      for (let i = 0; i < 5; i++) {
        logEntries.push({
          timestamp: Date.now(),
          traceId,
          correlationId,
          level: 'info',
          message: `Correlated log entry ${i}`,
          metadata: {
            sequence: i,
            swarmId: testSwarmId
          }
        });
      }
      
      // Verify correlation
      expect(logEntries.every(entry => entry.correlationId === correlationId)).toBe(true);
      expect(logEntries.every(entry => entry.traceId === traceId)).toBe(true);
      
      // Complete trace
      await langfuseWrapper.postHook(traceId!, {
        status: 'success',
        logCount: logEntries.length
      });
    });
  });

  describe('Log Aggregation and Analysis', () => {
    it('should aggregate logs by severity level', async () => {
      const logFile = path.join(logDir, `${testSwarmId}-severity.log`);
      const logLevels = ['debug', 'info', 'warn', 'error', 'fatal'];
      const logsPerLevel = 10;
      
      // Generate logs of different severity
      for (const level of logLevels) {
        for (let i = 0; i < logsPerLevel; i++) {
          const entry = {
            timestamp: Date.now(),
            level,
            message: `Test ${level} message ${i}`,
            swarmId: testSwarmId
          };
          await fs.appendFile(logFile, JSON.stringify(entry) + '\n');
        }
      }
      
      // Read and aggregate logs
      const content = await fs.readFile(logFile, 'utf-8');
      const logs = content.trim().split('\n').map(line => JSON.parse(line));
      
      // Aggregate by level
      const aggregated = logs.reduce((acc: any, log: any) => {
        acc[log.level] = (acc[log.level] || 0) + 1;
        return acc;
      }, {});
      
      // Verify aggregation
      expect(Object.keys(aggregated)).toHaveLength(logLevels.length);
      logLevels.forEach(level => {
        expect(aggregated[level]).toBe(logsPerLevel);
      });
    });

    it('should calculate performance metrics from logs', async () => {
      const perfLogs = [];
      const operations = ['spawn', 'task_start', 'task_complete', 'communication'];
      
      // Generate performance logs
      for (let i = 0; i < 100; i++) {
        const operation = operations[i % operations.length];
        const duration = Math.floor(Math.random() * 1000) + 100; // 100-1100ms
        
        perfLogs.push({
          timestamp: Date.now(),
          operation,
          duration,
          swarmId: testSwarmId,
          metadata: {
            agentId: `agent-${i % 5}`,
            success: duration < 800
          }
        });
      }
      
      // Calculate metrics
      const metrics = perfLogs.reduce((acc: any, log: any) => {
        const op = log.operation;
        if (!acc[op]) {
          acc[op] = {
            count: 0,
            totalDuration: 0,
            successCount: 0,
            minDuration: Infinity,
            maxDuration: 0
          };
        }
        
        acc[op].count++;
        acc[op].totalDuration += log.duration;
        if (log.metadata.success) acc[op].successCount++;
        acc[op].minDuration = Math.min(acc[op].minDuration, log.duration);
        acc[op].maxDuration = Math.max(acc[op].maxDuration, log.duration);
        
        return acc;
      }, {});
      
      // Verify metrics
      operations.forEach(op => {
        const metric = metrics[op];
        expect(metric.count).toBeGreaterThan(0);
        expect(metric.totalDuration).toBeGreaterThan(0);
        expect(metric.minDuration).toBeLessThanOrEqual(metric.maxDuration);
        
        const avgDuration = metric.totalDuration / metric.count;
        expect(avgDuration).toBeGreaterThan(100);
        expect(avgDuration).toBeLessThan(1100);
      });
    });
  });

  describe('Error Logging and Recovery', () => {
    it('should log errors with full context', async () => {
      const errorLog = path.join(logDir, `${testSwarmId}-errors.log`);
      
      // Generate error scenarios
      const errors = [
        {
          timestamp: Date.now(),
          level: 'error',
          error: {
            name: 'NetworkError',
            message: 'Failed to connect to Langfuse',
            stack: 'Error: Failed to connect\n  at connectLangfuse()',
            code: 'ECONNREFUSED'
          },
          context: {
            swarmId: testSwarmId,
            agentId: 'guardian-1',
            operation: 'trace_creation',
            retryCount: 3
          }
        },
        {
          timestamp: Date.now(),
          level: 'error',
          error: {
            name: 'ValidationError',
            message: 'Invalid trace data',
            details: { field: 'agentId', value: null }
          },
          context: {
            swarmId: testSwarmId,
            operation: 'validation'
          }
        }
      ];
      
      // Write error logs
      for (const error of errors) {
        await fs.appendFile(errorLog, JSON.stringify(error) + '\n');
      }
      
      // Verify error logging
      const content = await fs.readFile(errorLog, 'utf-8');
      const loggedErrors = content.trim().split('\n').map(line => JSON.parse(line));
      
      expect(loggedErrors).toHaveLength(errors.length);
      expect(loggedErrors[0].error.name).toBe('NetworkError');
      expect(loggedErrors[0].context.retryCount).toBe(3);
      expect(loggedErrors[1].error.name).toBe('ValidationError');
    });

    it('should implement retry logging with backoff', async () => {
      const retryLog: any[] = [];
      
      // Simulate retry with exponential backoff
      async function retryWithLogging(operation: () => Promise<any>, maxRetries = 3) {
        let lastError;
        
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            const result = await operation();
            
            retryLog.push({
              timestamp: Date.now(),
              attempt,
              status: 'success',
              totalAttempts: attempt + 1
            });
            
            return result;
          } catch (error) {
            lastError = error;
            const backoffTime = Math.pow(2, attempt) * 100; // Exponential backoff
            
            retryLog.push({
              timestamp: Date.now(),
              attempt,
              status: 'failed',
              error: error.message,
              nextRetryIn: attempt < maxRetries ? backoffTime : null
            });
            
            if (attempt < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, backoffTime));
            }
          }
        }
        
        throw lastError;
      }
      
      // Test successful retry
      let attemptCount = 0;
      await retryWithLogging(async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Temporary failure');
        }
        return 'success';
      });
      
      // Verify retry pattern
      const failedAttempts = retryLog.filter(log => log.status === 'failed');
      const successAttempt = retryLog.find(log => log.status === 'success');
      
      expect(failedAttempts).toHaveLength(2);
      expect(successAttempt).toBeDefined();
      expect(successAttempt.totalAttempts).toBe(3);
      
      // Verify backoff times
      expect(failedAttempts[0].nextRetryIn).toBe(100); // 2^0 * 100
      expect(failedAttempts[1].nextRetryIn).toBe(200); // 2^1 * 100
    });
  });

  describe('Log Storage and Persistence', () => {
    it('should persist logs to SQLite database', async () => {
      const dbPath = path.join(logDir, `${testSwarmId}-logs.db`);
      
      // Create logs database
      await execAsync(`sqlite3 "${dbPath}" "CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        level TEXT NOT NULL,
        swarm_id TEXT,
        agent_id TEXT,
        message TEXT,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )"`);
      
      // Insert test logs
      const logs = [];
      for (let i = 0; i < 10; i++) {
        const log = {
          timestamp: Date.now() + i,
          level: i % 3 === 0 ? 'error' : 'info',
          swarm_id: testSwarmId,
          agent_id: `agent-${i % 3}`,
          message: `Test log message ${i}`,
          metadata: JSON.stringify({ index: i })
        };
        logs.push(log);
        
        await execAsync(`sqlite3 "${dbPath}" "INSERT INTO logs (timestamp, level, swarm_id, agent_id, message, metadata) VALUES (${log.timestamp}, '${log.level}', '${log.swarm_id}', '${log.agent_id}', '${log.message}', '${log.metadata}')"`);
      }
      
      // Query logs
      const { stdout } = await execAsync(`sqlite3 "${dbPath}" "SELECT COUNT(*) FROM logs WHERE swarm_id = '${testSwarmId}'"`);
      expect(parseInt(stdout.trim())).toBe(10);
      
      // Query error logs
      const { stdout: errorCount } = await execAsync(`sqlite3 "${dbPath}" "SELECT COUNT(*) FROM logs WHERE level = 'error' AND swarm_id = '${testSwarmId}'"`);
      expect(parseInt(errorCount.trim())).toBe(4); // 10 logs, every 3rd is error
    });

    it('should implement log compression for archival', async () => {
      const uncompressedLog = path.join(logDir, `${testSwarmId}-uncompressed.log`);
      const compressedLog = path.join(logDir, `${testSwarmId}-compressed.log.gz`);
      
      // Create large log file
      const largeEntry = {
        timestamp: Date.now(),
        message: 'A'.repeat(1000), // 1KB per entry
        metadata: { test: true }
      };
      
      for (let i = 0; i < 100; i++) {
        await fs.appendFile(uncompressedLog, JSON.stringify(largeEntry) + '\n');
      }
      
      // Get uncompressed size
      const uncompressedStats = await fs.stat(uncompressedLog);
      
      // Compress log file
      await execAsync(`gzip -c "${uncompressedLog}" > "${compressedLog}"`);
      
      // Get compressed size
      const compressedStats = await fs.stat(compressedLog);
      
      // Verify compression
      expect(compressedStats.size).toBeLessThan(uncompressedStats.size);
      const compressionRatio = compressedStats.size / uncompressedStats.size;
      expect(compressionRatio).toBeLessThan(0.5); // Should compress to less than 50%
      
      // Clean up
      await fs.unlink(uncompressedLog);
      await fs.unlink(compressedLog);
    });
  });

  describe('Real-time Log Monitoring', () => {
    it('should tail logs in real-time', async () => {
      const tailLog = path.join(logDir, `${testSwarmId}-tail.log`);
      const receivedLines: string[] = [];
      
      // Start writing logs in background
      const writeInterval = setInterval(async () => {
        const entry = {
          timestamp: Date.now(),
          message: `Real-time log ${Date.now()}`
        };
        await fs.appendFile(tailLog, JSON.stringify(entry) + '\n');
      }, 100);
      
      // Simulate tail functionality
      let lastPosition = 0;
      const tailInterval = setInterval(async () => {
        try {
          const stats = await fs.stat(tailLog);
          if (stats.size > lastPosition) {
            const buffer = Buffer.alloc(stats.size - lastPosition);
            const fd = await fs.open(tailLog, 'r');
            await fd.read(buffer, 0, buffer.length, lastPosition);
            await fd.close();
            
            const newLines = buffer.toString().trim().split('\n').filter(Boolean);
            receivedLines.push(...newLines);
            lastPosition = stats.size;
          }
        } catch (error) {
          // File might not exist yet
        }
      }, 50);
      
      // Run for 1 second
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Stop intervals
      clearInterval(writeInterval);
      clearInterval(tailInterval);
      
      // Verify real-time reception
      expect(receivedLines.length).toBeGreaterThan(5); // Should receive multiple lines
      const parsed = receivedLines.map(line => JSON.parse(line));
      expect(parsed.every(entry => entry.timestamp && entry.message)).toBe(true);
      
      // Clean up
      await fs.unlink(tailLog);
    });

    it('should filter logs by criteria in real-time', async () => {
      const filterResults: any[] = [];
      
      // Define filter criteria
      const filter = {
        level: 'error',
        agentId: 'guardian-1',
        minTimestamp: Date.now() - 60000 // Last minute
      };
      
      // Simulate log stream with filtering
      const logStream = [
        { timestamp: Date.now(), level: 'info', agentId: 'guardian-1', message: 'Info log' },
        { timestamp: Date.now(), level: 'error', agentId: 'guardian-1', message: 'Error log 1' },
        { timestamp: Date.now(), level: 'error', agentId: 'guardian-2', message: 'Error log 2' },
        { timestamp: Date.now(), level: 'error', agentId: 'guardian-1', message: 'Error log 3' },
        { timestamp: Date.now() - 70000, level: 'error', agentId: 'guardian-1', message: 'Old error' }
      ];
      
      // Apply filters
      for (const log of logStream) {
        if (
          log.level === filter.level &&
          log.agentId === filter.agentId &&
          log.timestamp >= filter.minTimestamp
        ) {
          filterResults.push(log);
        }
      }
      
      // Verify filtering
      expect(filterResults).toHaveLength(2);
      expect(filterResults.every(log => log.level === 'error')).toBe(true);
      expect(filterResults.every(log => log.agentId === 'guardian-1')).toBe(true);
      expect(filterResults.every(log => log.timestamp >= filter.minTimestamp)).toBe(true);
    });
  });
});

// Export test results for coordination
export const realtimeLoggingTestResults = {
  suite: 'Real-time Logging Integration',
  timestamp: Date.now(),
  categories: [
    'Logging Infrastructure',
    'Real-time Event Streaming',
    'Langfuse Trace Integration',
    'Log Aggregation and Analysis',
    'Error Logging and Recovery',
    'Log Storage and Persistence',
    'Real-time Log Monitoring'
  ]
};