import { Langfuse } from 'langfuse';
import { realTimeMonitor } from '../monitoring/real-time-monitor.js';
import { eventCollector } from '../monitoring/event-collector.js';

// Initialize Langfuse
const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  baseUrl: process.env.LANGFUSE_HOST || 'http://localhost:3000',
  flushAt: 1,
  flushInterval: 1000
});

// Instrumentation wrapper
export function trace(fn, name = fn.name) {
  return async function(...args) {
    const startTime = Date.now();
    const trace = langfuse.trace({
      name: name || 'Anonymous Function',
      sessionId: `claude-flow-${Date.now()}`,
      metadata: {
        args: args.length > 0 ? args : undefined,
        timestamp: new Date().toISOString()
      }
    });

    try {
      const result = await fn.apply(this, args);
      const duration = Date.now() - startTime;

      // Record to performance monitor
      if (global.performanceMonitor) {
        global.performanceMonitor.recordRequest(duration, false);
      }

      // Send to real-time monitor
      realTimeMonitor.addEvent('function', 'completed', {
        name,
        duration,
        success: true
      });

      // Collect event
      eventCollector.collectEvent('langfuse', 'trace.completed', [{
        name,
        duration,
        success: true
      }]);

      trace.generation({
        name: 'Function Execution',
        input: { function: name, args: args.length },
        output: { success: true, duration },
        metadata: { durationMs: duration }
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Record error to performance monitor
      if (global.performanceMonitor) {
        global.performanceMonitor.recordRequest(duration, true);
      }

      // Send to real-time monitor
      realTimeMonitor.addEvent('function', 'failed', {
        name,
        duration,
        error: error.message
      });

      // Collect error event
      eventCollector.collectEvent('langfuse', 'trace.failed', [{
        name,
        duration,
        error: error.message
      }]);

      trace.generation({
        name: 'Function Execution Error',
        input: { function: name, args: args.length },
        output: { error: error.message, duration },
        level: 'ERROR',
        metadata: { durationMs: duration }
      });

      throw error;
    } finally {
      await langfuse.flush();
    }
  };
}

// Export Langfuse instance for direct usage
export { langfuse };

// Initialize global performance monitor reference
import { performanceMonitor } from '../monitoring/performance-monitor.js';
global.performanceMonitor = performanceMonitor;