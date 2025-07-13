/**
 * Token Estimator Benchmark
 * 
 * Performance testing and validation for token estimation utilities
 */

import { TokenEstimator, TokenEstimationStrategy, ContentType } from './token-estimator';
import logger from '../services/logger';

interface BenchmarkResult {
  strategy: TokenEstimationStrategy;
  model: string;
  contentType: ContentType;
  textLength: number;
  estimatedTokens: number;
  executionTimeMs: number;
  tokensPerMs: number;
  accuracy?: number; // If we have ground truth
}

interface BenchmarkSummary {
  totalTests: number;
  avgExecutionTimeMs: number;
  maxExecutionTimeMs: number;
  minExecutionTimeMs: number;
  p95ExecutionTimeMs: number;
  p99ExecutionTimeMs: number;
  totalTokensEstimated: number;
  avgTokensPerMs: number;
  cacheHitRate: number;
  strategyPerformance: Record<TokenEstimationStrategy, {
    avgTimeMs: number;
    tests: number;
  }>;
}

export class TokenEstimatorBenchmark {
  private estimators: Map<TokenEstimationStrategy, TokenEstimator>;
  private results: BenchmarkResult[] = [];

  constructor() {
    // Initialize estimators with different strategies
    this.estimators = new Map([
      [TokenEstimationStrategy.SIMPLE, new TokenEstimator({ strategy: TokenEstimationStrategy.SIMPLE })],
      [TokenEstimationStrategy.CLAUDE, new TokenEstimator({ strategy: TokenEstimationStrategy.CLAUDE })],
      [TokenEstimationStrategy.UNICODE, new TokenEstimator({ strategy: TokenEstimationStrategy.UNICODE })],
      [TokenEstimationStrategy.HYBRID, new TokenEstimator({ strategy: TokenEstimationStrategy.HYBRID })]
    ]);
  }

  /**
   * Generate test samples
   */
  private generateTestSamples(): Array<{ text: string; type: ContentType; description: string }> {
    return [
      // Short texts
      {
        text: "Hello, world!",
        type: ContentType.TEXT,
        description: "Simple greeting"
      },
      {
        text: "The quick brown fox jumps over the lazy dog.",
        type: ContentType.TEXT,
        description: "Pangram"
      },
      
      // Code samples
      {
        text: `function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}`,
        type: ContentType.CODE,
        description: "JavaScript function"
      },
      {
        text: `import React from 'react';
export const Component = ({ name }) => {
  return <div>Hello, {name}!</div>;
};`,
        type: ContentType.CODE,
        description: "React component"
      },
      
      // Markdown
      {
        text: `# Token Estimation Guide
## Introduction
This guide explains how to estimate tokens for various LLM models.

### Key Points:
- Claude models use ~4 characters per token
- GPT models vary by version
- Code typically uses more tokens

\`\`\`javascript
const tokens = estimateTokens(text);
\`\`\``,
        type: ContentType.MARKDOWN,
        description: "Markdown document"
      },
      
      // JSON
      {
        text: JSON.stringify({
          users: [
            { id: 1, name: "Alice", role: "admin" },
            { id: 2, name: "Bob", role: "user" }
          ],
          settings: {
            theme: "dark",
            language: "en"
          }
        }, null, 2),
        type: ContentType.JSON,
        description: "JSON data"
      },
      
      // Long text
      {
        text: "Lorem ipsum dolor sit amet, ".repeat(100),
        type: ContentType.TEXT,
        description: "Long repetitive text"
      },
      
      // Unicode and emojis
      {
        text: "Hello 你好 こんにちは 🌍🚀💻 Special chars: €£¥",
        type: ContentType.TEXT,
        description: "Unicode and emojis"
      },
      
      // Mixed content
      {
        text: `# API Documentation
The \`getUserById\` function fetches user data:

\`\`\`typescript
async function getUserById(id: string): Promise<User> {
  const response = await fetch(\`/api/users/\${id}\`);
  return response.json();
}
\`\`\`

**Parameters:**
- \`id\` (string): The user's unique identifier

Returns: \`Promise<User>\``,
        type: ContentType.MIXED,
        description: "Mixed markdown and code"
      },
      
      // Large code file simulation
      {
        text: Array(50).fill(null).map((_, i) => `
export function processData${i}(input: any[]): any[] {
  return input
    .filter(item => item.active)
    .map(item => ({
      ...item,
      processed: true,
      timestamp: Date.now()
    }))
    .sort((a, b) => a.id - b.id);
}
`).join('\n'),
        type: ContentType.CODE,
        description: "Large code file"
      }
    ];
  }

  /**
   * Run benchmark for a single sample
   */
  private benchmarkSample(
    text: string,
    contentType: ContentType,
    model: string,
    strategy: TokenEstimationStrategy
  ): BenchmarkResult {
    const estimator = this.estimators.get(strategy)!;
    
    const startTime = performance.now();
    const estimatedTokens = estimator.estimateTokens(text, model, contentType);
    const executionTimeMs = performance.now() - startTime;
    
    return {
      strategy,
      model,
      contentType,
      textLength: text.length,
      estimatedTokens,
      executionTimeMs,
      tokensPerMs: estimatedTokens / executionTimeMs
    };
  }

  /**
   * Run comprehensive benchmark
   */
  async runBenchmark(options: {
    models?: string[];
    iterations?: number;
    warmupRuns?: number;
  } = {}): Promise<BenchmarkSummary> {
    const models = options.models || ['claude-3-sonnet', 'gpt-4', 'llama-2-70b'];
    const iterations = options.iterations || 10;
    const warmupRuns = options.warmupRuns || 3;
    
    const samples = this.generateTestSamples();
    this.results = [];
    
    logger.info('Starting token estimator benchmark', {
      models,
      iterations,
      warmupRuns,
      samples: samples.length,
      strategies: Array.from(this.estimators.keys())
    });
    
    // Warmup runs
    for (let i = 0; i < warmupRuns; i++) {
      for (const sample of samples) {
        for (const strategy of this.estimators.keys()) {
          this.benchmarkSample(sample.text, sample.type, models[0], strategy);
        }
      }
    }
    
    // Actual benchmark runs
    for (let iter = 0; iter < iterations; iter++) {
      for (const sample of samples) {
        for (const model of models) {
          for (const strategy of this.estimators.keys()) {
            const result = this.benchmarkSample(sample.text, sample.type, model, strategy);
            this.results.push(result);
          }
        }
      }
      
      // Log progress
      if ((iter + 1) % Math.ceil(iterations / 10) === 0) {
        logger.info(`Benchmark progress: ${Math.round((iter + 1) / iterations * 100)}%`);
      }
    }
    
    return this.analyzeBenchmarkResults();
  }

  /**
   * Analyze benchmark results
   */
  private analyzeBenchmarkResults(): BenchmarkSummary {
    const executionTimes = this.results.map(r => r.executionTimeMs).sort((a, b) => a - b);
    const totalTokens = this.results.reduce((sum, r) => sum + r.estimatedTokens, 0);
    
    // Calculate percentiles
    const p95Index = Math.floor(executionTimes.length * 0.95);
    const p99Index = Math.floor(executionTimes.length * 0.99);
    
    // Strategy performance
    const strategyPerformance: Record<string, { avgTimeMs: number; tests: number }> = {};
    
    for (const strategy of this.estimators.keys()) {
      const strategyResults = this.results.filter(r => r.strategy === strategy);
      strategyPerformance[strategy] = {
        avgTimeMs: strategyResults.reduce((sum, r) => sum + r.executionTimeMs, 0) / strategyResults.length,
        tests: strategyResults.length
      };
    }
    
    const summary: BenchmarkSummary = {
      totalTests: this.results.length,
      avgExecutionTimeMs: executionTimes.reduce((sum, t) => sum + t, 0) / executionTimes.length,
      maxExecutionTimeMs: executionTimes[executionTimes.length - 1],
      minExecutionTimeMs: executionTimes[0],
      p95ExecutionTimeMs: executionTimes[p95Index],
      p99ExecutionTimeMs: executionTimes[p99Index],
      totalTokensEstimated: totalTokens,
      avgTokensPerMs: this.results.reduce((sum, r) => sum + r.tokensPerMs, 0) / this.results.length,
      cacheHitRate: 0, // Would need to track this in the estimator
      strategyPerformance: strategyPerformance as any
    };
    
    return summary;
  }

  /**
   * Compare estimation accuracy (requires ground truth)
   */
  async compareAccuracy(
    groundTruth: Array<{ text: string; actualTokens: number; model: string }>
  ): Promise<Record<TokenEstimationStrategy, { avgError: number; rmse: number }>> {
    const accuracyResults: Record<string, { errors: number[] }> = {};
    
    for (const strategy of this.estimators.keys()) {
      accuracyResults[strategy] = { errors: [] };
    }
    
    for (const sample of groundTruth) {
      const contentType = new TokenEstimator().detectContentType(sample.text);
      
      for (const [strategy, estimator] of this.estimators) {
        const estimated = estimator.estimateTokens(sample.text, sample.model, contentType);
        const error = Math.abs(estimated - sample.actualTokens) / sample.actualTokens;
        accuracyResults[strategy].errors.push(error);
      }
    }
    
    // Calculate metrics
    const results: Record<TokenEstimationStrategy, { avgError: number; rmse: number }> = {} as any;
    
    for (const [strategy, data] of Object.entries(accuracyResults)) {
      const errors = data.errors;
      const avgError = errors.reduce((sum, e) => sum + e, 0) / errors.length;
      const rmse = Math.sqrt(errors.reduce((sum, e) => sum + e * e, 0) / errors.length);
      
      results[strategy as TokenEstimationStrategy] = { avgError, rmse };
    }
    
    return results;
  }

  /**
   * Generate performance report
   */
  generateReport(summary: BenchmarkSummary): string {
    return `
# Token Estimator Performance Report

## Summary
- Total Tests: ${summary.totalTests}
- Average Execution Time: ${summary.avgExecutionTimeMs.toFixed(3)}ms
- Min/Max Time: ${summary.minExecutionTimeMs.toFixed(3)}ms / ${summary.maxExecutionTimeMs.toFixed(3)}ms
- P95/P99 Time: ${summary.p95ExecutionTimeMs.toFixed(3)}ms / ${summary.p99ExecutionTimeMs.toFixed(3)}ms
- Total Tokens Estimated: ${summary.totalTokensEstimated.toLocaleString()}
- Average Tokens/ms: ${summary.avgTokensPerMs.toFixed(2)}

## Strategy Performance
${Object.entries(summary.strategyPerformance)
  .map(([strategy, perf]) => `- ${strategy}: ${perf.avgTimeMs.toFixed(3)}ms avg (${perf.tests} tests)`)
  .join('\n')}

## Recommendations
${this.generateRecommendations(summary)}
`;
  }

  /**
   * Generate recommendations based on results
   */
  private generateRecommendations(summary: BenchmarkSummary): string {
    const recommendations: string[] = [];
    
    // Find fastest strategy
    const fastestStrategy = Object.entries(summary.strategyPerformance)
      .sort((a, b) => a[1].avgTimeMs - b[1].avgTimeMs)[0];
    
    recommendations.push(`- Use '${fastestStrategy[0]}' strategy for best performance (${fastestStrategy[1].avgTimeMs.toFixed(3)}ms avg)`);
    
    // Check if caching would help
    if (summary.avgExecutionTimeMs > 1) {
      recommendations.push('- Enable caching for frequently estimated texts');
    }
    
    // Check P99 performance
    if (summary.p99ExecutionTimeMs > summary.avgExecutionTimeMs * 3) {
      recommendations.push('- Consider implementing timeout or fallback for edge cases');
    }
    
    return recommendations.join('\n');
  }

  /**
   * Export detailed results
   */
  exportResults(format: 'json' | 'csv' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify(this.results, null, 2);
    } else {
      const headers = Object.keys(this.results[0]).join(',');
      const rows = this.results.map(r => Object.values(r).join(','));
      return [headers, ...rows].join('\n');
    }
  }
}

// Export singleton for easy benchmarking
export const tokenEstimatorBenchmark = new TokenEstimatorBenchmark();

// CLI interface if run directly
if (require.main === module) {
  (async () => {
    const benchmark = new TokenEstimatorBenchmark();
    const summary = await benchmark.runBenchmark({
      models: ['claude-3-sonnet', 'gpt-4'],
      iterations: 100,
      warmupRuns: 10
    });
    
    console.log(benchmark.generateReport(summary));
  })();
}