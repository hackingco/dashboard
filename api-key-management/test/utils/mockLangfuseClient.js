/**
 * Mock Langfuse Client for Testing
 */

class MockLangfuseClient {
  constructor(config = {}) {
    this.config = config;
    this.traces = [];
    this.spans = [];
    this.flushed = false;
    this.shutdown = false;
    this.flushCallCount = 0;
    this.errors = [];
  }

  trace(params) {
    const trace = {
      id: params.id || `trace-${Date.now()}`,
      name: params.name,
      sessionId: params.sessionId,
      input: params.input,
      metadata: params.metadata,
      tags: params.tags,
      timestamp: Date.now(),
      spans: []
    };
    
    this.traces.push(trace);
    
    return {
      span: (spanParams) => this.createSpan(trace, spanParams),
      end: () => {},
      update: (updates) => Object.assign(trace, updates)
    };
  }

  createSpan(trace, params) {
    const span = {
      id: `span-${Date.now()}`,
      traceId: trace.id,
      name: params.name,
      input: params.input,
      metadata: params.metadata,
      startTime: Date.now(),
      endTime: null
    };
    
    this.spans.push(span);
    trace.spans.push(span);
    
    return {
      end: () => {
        span.endTime = Date.now();
      },
      update: (updates) => Object.assign(span, updates)
    };
  }

  async flushAsync() {
    this.flushCallCount++;
    this.flushed = true;
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 10));
    return Promise.resolve();
  }

  async shutdownAsync() {
    this.shutdown = true;
    await this.flushAsync();
    return Promise.resolve();
  }

  // Test utilities
  getTraces() {
    return this.traces;
  }

  getSpans() {
    return this.spans;
  }

  reset() {
    this.traces = [];
    this.spans = [];
    this.flushed = false;
    this.shutdown = false;
    this.flushCallCount = 0;
    this.errors = [];
  }

  // Simulate errors
  simulateError(error) {
    this.errors.push(error);
    throw error;
  }
}

// Mock Langfuse module
export const Langfuse = jest.fn().mockImplementation((config) => {
  return new MockLangfuseClient(config);
});

export default MockLangfuseClient;