/**
 * Token Estimation Integration Example
 * 
 * Demonstrates how to use the token estimator with Langfuse tracing
 * for accurate cost tracking and performance monitoring.
 */

import { langfuseService } from '../services/langfuse/langfuse.service';
import { langfuseTracer } from '../utils/langfuse-tracer';
import { langfuseTokenEnricher } from '../utils/langfuse-token-enricher';
import { tokenEstimator, ContentType } from '../utils/token-estimator';
import { tokenEstimatorBenchmark } from '../utils/token-estimator-benchmark';
import logger from '../services/logger';

/**
 * Example 1: Basic token estimation for API calls
 */
async function basicTokenEstimationExample() {
  console.log('\n=== Basic Token Estimation Example ===\n');

  // Simulate an API call with token tracking
  const apiCall = async () => {
    const request = {
      app_name: 'test-app',
      method: 'GET',
      endpoint: '/api/machines'
    };

    const response = {
      machines: [
        { id: 'machine-1', state: 'running', region: 'iad' },
        { id: 'machine-2', state: 'stopped', region: 'sea' }
      ],
      total: 2
    };

    // Estimate tokens for request and response
    const inputTokens = tokenEstimator.estimateTokens(
      JSON.stringify(request),
      'claude-3-haiku',
      ContentType.JSON
    );
    
    const outputTokens = tokenEstimator.estimateTokens(
      JSON.stringify(response),
      'claude-3-haiku',
      ContentType.JSON
    );

    console.log(`Request tokens: ${inputTokens}`);
    console.log(`Response tokens: ${outputTokens}`);
    console.log(`Total tokens: ${inputTokens + outputTokens}`);
    
    const cost = tokenEstimator.calculateCost(
      { input: inputTokens, output: outputTokens },
      'claude-3-haiku'
    );
    
    console.log(`Estimated cost: $${cost.toFixed(6)}`);

    return response;
  };

  // Trace the API call with automatic token enrichment
  const tracedResponse = await langfuseTracer.traceApiCall(
    {
      spanName: 'fly.api.listMachines',
      tags: {
        endpoint: '/api/machines',
        app_name: 'test-app'
      }
    },
    apiCall
  );

  console.log(`\nTrace ID: ${tracedResponse.traceId}`);
  console.log(`Latency: ${tracedResponse.latency.toFixed(2)}ms`);
}

/**
 * Example 2: Conversation token tracking
 */
async function conversationTokenExample() {
  console.log('\n=== Conversation Token Tracking Example ===\n');

  const conversation = [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Explain how token estimation works in LLMs.' },
    { role: 'assistant', content: `Token estimation in LLMs involves counting the discrete units (tokens) that models process. 

Here's how it works:
1. **Tokenization**: Text is split into tokens using model-specific rules
2. **Character patterns**: Different models handle punctuation, whitespace, and special characters differently
3. **Language variations**: Non-English text often uses more tokens
4. **Cost calculation**: Each token has an associated cost for input/output

For accurate estimation, we consider the model family, content type, and special patterns.` },
    { role: 'user', content: 'How accurate are these estimates?' },
    { role: 'assistant', content: 'Token estimates are typically within 5-10% of actual usage when using sophisticated algorithms that account for model-specific tokenization rules.' }
  ];

  // Estimate tokens for the entire conversation
  const usage = tokenEstimator.estimateConversationTokens(conversation, 'claude-3-sonnet');
  
  console.log('Conversation Token Usage:');
  console.log(`- System + User tokens (input): ${usage.input}`);
  console.log(`- Assistant tokens (output): ${usage.output}`);
  console.log(`- Total tokens: ${usage.total}`);
  
  const cost = tokenEstimator.calculateCost(usage, 'claude-3-sonnet');
  console.log(`- Estimated cost: $${cost.toFixed(6)}`);

  // Track in Langfuse
  if (langfuseService.isEnabled()) {
    const traceId = langfuseService.startTrace('conversation-example', {
      messages: conversation.length,
      model: 'claude-3-sonnet'
    });

    await langfuseTokenEnricher.enrichGeneration(
      traceId,
      'claude-3-sonnet',
      conversation.filter(m => m.role !== 'assistant').map(m => m.content).join('\n'),
      conversation.filter(m => m.role === 'assistant').map(m => m.content).join('\n'),
      {
        autoDetectContent: true,
        includeMetrics: true,
        includeCost: true
      }
    );

    await langfuseService.endTrace(traceId);
  }
}

/**
 * Example 3: Content type detection and specialized estimation
 */
async function contentTypeExample() {
  console.log('\n=== Content Type Detection Example ===\n');

  const samples = [
    {
      name: 'Plain Text',
      content: 'This is a simple paragraph of text without any special formatting.'
    },
    {
      name: 'Code',
      content: `
async function processData(items: Item[]): Promise<Result[]> {
  return items
    .filter(item => item.active)
    .map(item => transform(item))
    .sort((a, b) => a.score - b.score);
}`
    },
    {
      name: 'Markdown',
      content: `
# API Documentation

## Overview
This API provides **token estimation** capabilities.

### Features:
- Accurate counting
- Multi-model support
- Cost calculation

\`\`\`javascript
const tokens = estimateTokens(text);
\`\`\`
`
    },
    {
      name: 'JSON',
      content: JSON.stringify({
        user: { id: 1, name: 'Alice', roles: ['admin', 'user'] },
        settings: { theme: 'dark', language: 'en' },
        metadata: { created: '2024-01-01', version: '1.0.0' }
      }, null, 2)
    }
  ];

  for (const sample of samples) {
    const detectedType = tokenEstimator.detectContentType(sample.content);
    const tokens = tokenEstimator.estimateTokens(sample.content, 'claude-3-sonnet');
    
    console.log(`\n${sample.name}:`);
    console.log(`- Detected type: ${detectedType}`);
    console.log(`- Estimated tokens: ${tokens}`);
    console.log(`- Tokens per character: ${(tokens / sample.content.length).toFixed(3)}`);
  }
}

/**
 * Example 4: Performance benchmarking
 */
async function performanceBenchmarkExample() {
  console.log('\n=== Performance Benchmark Example ===\n');

  console.log('Running quick benchmark (this may take a few seconds)...\n');

  const summary = await tokenEstimatorBenchmark.runBenchmark({
    models: ['claude-3-sonnet', 'gpt-4'],
    iterations: 10,
    warmupRuns: 2
  });

  console.log('Benchmark Results:');
  console.log(`- Average execution time: ${summary.avgExecutionTimeMs.toFixed(3)}ms`);
  console.log(`- P95 execution time: ${summary.p95ExecutionTimeMs.toFixed(3)}ms`);
  console.log(`- Total tokens estimated: ${summary.totalTokensEstimated.toLocaleString()}`);
  console.log(`- Tokens per millisecond: ${summary.avgTokensPerMs.toFixed(2)}`);

  console.log('\nStrategy Performance:');
  Object.entries(summary.strategyPerformance).forEach(([strategy, perf]) => {
    console.log(`- ${strategy}: ${perf.avgTimeMs.toFixed(3)}ms average`);
  });
}

/**
 * Example 5: Batch processing with enrichment
 */
async function batchProcessingExample() {
  console.log('\n=== Batch Processing Example ===\n');

  // Simulate multiple API responses to process
  const apiResponses = [
    {
      traceId: 'trace-1',
      model: 'claude-3-haiku',
      input: JSON.stringify({ action: 'list', resource: 'machines' }),
      output: JSON.stringify({ machines: ['m1', 'm2', 'm3'], count: 3 })
    },
    {
      traceId: 'trace-2',
      model: 'claude-3-haiku',
      input: JSON.stringify({ action: 'create', config: { size: 'large' } }),
      output: JSON.stringify({ id: 'new-machine', status: 'created' })
    },
    {
      traceId: 'trace-3',
      model: 'claude-3-haiku',
      input: JSON.stringify({ action: 'delete', id: 'old-machine' }),
      output: JSON.stringify({ success: true, deleted: 'old-machine' })
    }
  ];

  // Batch enrich all responses
  const metrics = await langfuseTokenEnricher.batchEnrich(apiResponses, {
    autoDetectContent: true,
    includeMetrics: true,
    includeCost: true
  });

  console.log('Batch Processing Results:');
  metrics.forEach((metric, index) => {
    console.log(`\nResponse ${index + 1}:`);
    console.log(`- Input tokens: ${metric.tokens.input}`);
    console.log(`- Output tokens: ${metric.tokens.output}`);
    console.log(`- Total tokens: ${metric.tokens.total}`);
    console.log(`- Cost: $${metric.cost.toFixed(6)}`);
    console.log(`- Estimation time: ${metric.performance.estimationTimeMs.toFixed(2)}ms`);
  });

  // Calculate totals
  const totalTokens = metrics.reduce((sum, m) => sum + (m.tokens.total || 0), 0);
  const totalCost = metrics.reduce((sum, m) => sum + m.cost, 0);
  
  console.log('\nBatch Totals:');
  console.log(`- Total tokens: ${totalTokens}`);
  console.log(`- Total cost: $${totalCost.toFixed(6)}`);
}

/**
 * Example 6: Real-world integration pattern
 */
async function realWorldIntegrationExample() {
  console.log('\n=== Real-World Integration Example ===\n');

  // Simulate a complex API operation with multiple steps
  class FlyApiClientWithTokens {
    private traceId: string;

    constructor() {
      this.traceId = langfuseService.startTrace('fly-api-operation', {
        operation: 'deploy-app'
      });
    }

    async deployApp(appName: string, config: any) {
      try {
        // Step 1: Create app
        const createRequest = { name: appName, org: 'personal' };
        const createResponse = await this.trackedApiCall(
          'createApp',
          createRequest,
          { id: 'app-123', name: appName, status: 'created' }
        );

        // Step 2: Configure app
        const configRequest = { ...config, app_id: createResponse.id };
        const configResponse = await this.trackedApiCall(
          'configureApp',
          configRequest,
          { success: true, config: config }
        );

        // Step 3: Deploy app
        const deployRequest = { app_id: createResponse.id, image: 'myapp:latest' };
        const deployResponse = await this.trackedApiCall(
          'deployApp',
          deployRequest,
          { deployment_id: 'dep-456', status: 'deploying', machines: 3 }
        );

        // Get total metrics
        const trace = langfuseService.getTrace(this.traceId);
        if (trace) {
          console.log('\nDeployment Operation Metrics:');
          console.log(`- Total tokens: ${trace.tokens.total}`);
          console.log(`- Total cost: $${trace.cost.toFixed(6)}`);
          console.log(`- Total latency: ${trace.latency.toFixed(2)}ms`);
        }

        return deployResponse;

      } finally {
        await langfuseService.endTrace(this.traceId);
      }
    }

    private async trackedApiCall(operation: string, request: any, response: any) {
      const spanId = `span-${Date.now()}`;
      
      // Start span
      langfuseService.startSpan(spanId, operation, this.traceId, request);

      // Simulate API latency
      await new Promise(resolve => setTimeout(resolve, 100));

      // Enrich with token data
      const metrics = await langfuseTokenEnricher.enrichApiCall(
        this.traceId,
        `/api/${operation}`,
        request,
        response,
        {
          model: 'claude-3-haiku',
          autoDetectContent: true,
          includeMetrics: true
        }
      );

      console.log(`\n${operation}:`);
      console.log(`- Tokens: ${metrics.tokens.total}`);
      console.log(`- Cost: $${metrics.cost.toFixed(6)}`);

      // End span
      langfuseService.endSpan(spanId, response);

      return response;
    }
  }

  const client = new FlyApiClientWithTokens();
  await client.deployApp('my-token-app', {
    regions: ['iad', 'sea'],
    size: 'shared-cpu-1x',
    services: [
      { port: 8080, protocol: 'tcp' }
    ]
  });
}

/**
 * Main function to run all examples
 */
async function main() {
  console.log('Token Estimation Integration Examples');
  console.log('=====================================');

  try {
    // Initialize Langfuse if not already done
    if (!langfuseService.isEnabled()) {
      console.log('\nNote: Langfuse is not enabled. Set LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY to enable tracing.\n');
    }

    // Run examples
    await basicTokenEstimationExample();
    await conversationTokenExample();
    await contentTypeExample();
    await performanceBenchmarkExample();
    await batchProcessingExample();
    await realWorldIntegrationExample();

    // Show final metrics
    console.log('\n=== Token Enricher Summary ===\n');
    const enricherStats = langfuseTokenEnricher.getMetricsSummary();
    console.log('Enricher Statistics:', enricherStats);

  } catch (error) {
    console.error('Error running examples:', error);
  } finally {
    // Cleanup
    langfuseTokenEnricher.destroy();
    await langfuseService.shutdown();
  }
}

// Run examples if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

// Export individual examples for testing
export {
  basicTokenEstimationExample,
  conversationTokenExample,
  contentTypeExample,
  performanceBenchmarkExample,
  batchProcessingExample,
  realWorldIntegrationExample
};