/**
 * Langfuse Token Enricher
 * 
 * Integrates token estimation with Langfuse spans to provide accurate
 * token counts and cost calculations for all traced operations.
 */

import { TokenEstimator, TokenUsage, ContentType, estimateTokens } from './token-estimator';
import { langfuseService } from '../services/langfuse/langfuse.service';
import logger from '../services/logger';

/**
 * Enrichment options for Langfuse spans
 */
export interface EnrichmentOptions {
  model?: string;
  autoDetectContent?: boolean;
  includeMetrics?: boolean;
  includeCost?: boolean;
  customMetadata?: Record<string, any>;
}

/**
 * Token metrics for tracking
 */
export interface TokenMetrics {
  tokens: TokenUsage;
  cost: number;
  efficiency: {
    tokensPerChar: number;
    tokensPerWord: number;
    compressionRatio: number;
  };
  performance: {
    estimationTimeMs: number;
    cached: boolean;
  };
}

/**
 * Langfuse Token Enricher class
 */
export class LangfuseTokenEnricher {
  private tokenEstimator: TokenEstimator;
  private metricsBuffer: TokenMetrics[] = [];
  private bufferFlushInterval: number = 60000; // 1 minute
  private flushTimer?: NodeJS.Timeout;

  constructor() {
    this.tokenEstimator = new TokenEstimator({
      strategy: 'hybrid',
      enableCaching: true,
      maxCacheSize: 2000
    });

    // Start periodic flush
    this.startPeriodicFlush();
  }

  /**
   * Enrich a Langfuse generation with token estimates
   */
  async enrichGeneration(
    traceId: string,
    model: string,
    input: string,
    output: string,
    options: EnrichmentOptions = {}
  ): Promise<TokenMetrics> {
    const startTime = performance.now();

    try {
      // Detect content types if enabled
      const inputType = options.autoDetectContent 
        ? this.tokenEstimator.detectContentType(input)
        : ContentType.TEXT;
      
      const outputType = options.autoDetectContent
        ? this.tokenEstimator.detectContentType(output)
        : ContentType.TEXT;

      // Estimate tokens
      const inputTokens = this.tokenEstimator.estimateTokens(input, model, inputType);
      const outputTokens = this.tokenEstimator.estimateTokens(output, model, outputType);
      
      const tokens: TokenUsage = {
        input: inputTokens,
        output: outputTokens,
        total: inputTokens + outputTokens
      };

      // Calculate cost
      const cost = options.includeCost !== false
        ? this.tokenEstimator.calculateCost(tokens, model)
        : 0;

      // Calculate efficiency metrics
      const efficiency = this.calculateEfficiency(input + output, tokens.total);

      // Performance metrics
      const estimationTimeMs = performance.now() - startTime;

      const metrics: TokenMetrics = {
        tokens,
        cost,
        efficiency,
        performance: {
          estimationTimeMs,
          cached: false // TODO: Track cache hits
        }
      };

      // Update Langfuse generation with enriched data
      if (langfuseService.isEnabled()) {
        await langfuseService.trackGeneration(
          traceId,
          model,
          input,
          output,
          tokens,
          0, // Latency will be set by the caller
          {
            ...options.customMetadata,
            tokenEstimation: {
              strategy: 'hybrid',
              inputContentType: inputType,
              outputContentType: outputType,
              efficiency,
              estimationTimeMs: Math.round(estimationTimeMs)
            },
            cost
          }
        );
      }

      // Buffer metrics for batch processing
      if (options.includeMetrics !== false) {
        this.bufferMetrics(metrics);
      }

      logger.debug('Enriched generation with token estimates', {
        traceId,
        model,
        tokens,
        cost,
        estimationTimeMs: Math.round(estimationTimeMs)
      });

      return metrics;

    } catch (error) {
      logger.error('Failed to enrich generation with tokens', { error, traceId });
      
      // Return fallback metrics
      return {
        tokens: { input: 0, output: 0, total: 0 },
        cost: 0,
        efficiency: {
          tokensPerChar: 0,
          tokensPerWord: 0,
          compressionRatio: 0
        },
        performance: {
          estimationTimeMs: performance.now() - startTime,
          cached: false
        }
      };
    }
  }

  /**
   * Enrich API call span with token estimates
   */
  async enrichApiCall(
    traceId: string,
    endpoint: string,
    requestBody: any,
    responseBody: any,
    options: EnrichmentOptions = {}
  ): Promise<TokenMetrics> {
    // Convert request/response to strings for estimation
    const input = typeof requestBody === 'string' 
      ? requestBody 
      : JSON.stringify(requestBody, null, 2);
    
    const output = typeof responseBody === 'string'
      ? responseBody
      : JSON.stringify(responseBody, null, 2);

    // Use a generic model for API calls
    const model = options.model || 'claude-3-haiku';

    return this.enrichGeneration(
      traceId,
      model,
      input,
      output,
      {
        ...options,
        customMetadata: {
          ...options.customMetadata,
          endpoint,
          spanType: 'api_call'
        }
      }
    );
  }

  /**
   * Batch enrich multiple spans
   */
  async batchEnrich(
    spans: Array<{
      traceId: string;
      model: string;
      input: string;
      output: string;
    }>,
    options: EnrichmentOptions = {}
  ): Promise<TokenMetrics[]> {
    const results = await Promise.all(
      spans.map(span => 
        this.enrichGeneration(
          span.traceId,
          span.model,
          span.input,
          span.output,
          options
        )
      )
    );

    return results;
  }

  /**
   * Calculate efficiency metrics
   */
  private calculateEfficiency(text: string, tokens: number): {
    tokensPerChar: number;
    tokensPerWord: number;
    compressionRatio: number;
  } {
    const charCount = text.length;
    const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;

    return {
      tokensPerChar: charCount > 0 ? tokens / charCount : 0,
      tokensPerWord: wordCount > 0 ? tokens / wordCount : 0,
      compressionRatio: charCount > 0 ? tokens / (charCount / 4) : 0 // Assuming 4 chars per token baseline
    };
  }

  /**
   * Buffer metrics for batch processing
   */
  private bufferMetrics(metrics: TokenMetrics): void {
    this.metricsBuffer.push(metrics);

    // Flush if buffer is large
    if (this.metricsBuffer.length >= 100) {
      this.flushMetrics();
    }
  }

  /**
   * Start periodic metric flush
   */
  private startPeriodicFlush(): void {
    this.flushTimer = setInterval(() => {
      if (this.metricsBuffer.length > 0) {
        this.flushMetrics();
      }
    }, this.bufferFlushInterval);
  }

  /**
   * Flush buffered metrics
   */
  private async flushMetrics(): Promise<void> {
    if (this.metricsBuffer.length === 0) return;

    const metrics = [...this.metricsBuffer];
    this.metricsBuffer = [];

    try {
      // Aggregate metrics
      const aggregated = this.aggregateMetrics(metrics);

      // Log aggregated metrics
      logger.info('Token estimation metrics', aggregated);

      // Could send to monitoring service here
      // await monitoringService.sendMetrics(aggregated);

    } catch (error) {
      logger.error('Failed to flush token metrics', { error });
      
      // Re-add metrics to buffer if flush failed
      this.metricsBuffer.unshift(...metrics);
    }
  }

  /**
   * Aggregate metrics for reporting
   */
  private aggregateMetrics(metrics: TokenMetrics[]): Record<string, any> {
    const totalTokens = metrics.reduce((sum, m) => sum + (m.tokens.total || 0), 0);
    const totalCost = metrics.reduce((sum, m) => sum + m.cost, 0);
    const avgEstimationTime = metrics.reduce((sum, m) => sum + m.performance.estimationTimeMs, 0) / metrics.length;

    return {
      period: {
        start: new Date(Date.now() - this.bufferFlushInterval),
        end: new Date()
      },
      summary: {
        totalRequests: metrics.length,
        totalTokens,
        totalCost: totalCost.toFixed(6),
        avgTokensPerRequest: Math.round(totalTokens / metrics.length),
        avgCostPerRequest: (totalCost / metrics.length).toFixed(6),
        avgEstimationTimeMs: Math.round(avgEstimationTime)
      },
      efficiency: {
        avgTokensPerChar: this.average(metrics.map(m => m.efficiency.tokensPerChar)),
        avgTokensPerWord: this.average(metrics.map(m => m.efficiency.tokensPerWord)),
        avgCompressionRatio: this.average(metrics.map(m => m.efficiency.compressionRatio))
      }
    };
  }

  /**
   * Calculate average of numbers
   */
  private average(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
  }

  /**
   * Get current metrics summary
   */
  getMetricsSummary(): Record<string, any> {
    return {
      bufferSize: this.metricsBuffer.length,
      estimatorStats: this.tokenEstimator.getCacheStats(),
      flushInterval: this.bufferFlushInterval
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    
    // Flush remaining metrics
    this.flushMetrics();
  }
}

/**
 * Singleton instance
 */
export const langfuseTokenEnricher = new LangfuseTokenEnricher();

/**
 * Convenience function for enriching spans
 */
export async function enrichLangfuseSpan(
  traceId: string,
  model: string,
  input: string,
  output: string,
  options?: EnrichmentOptions
): Promise<TokenMetrics> {
  return langfuseTokenEnricher.enrichGeneration(traceId, model, input, output, options);
}

/**
 * Middleware for automatic token enrichment
 */
export function createTokenEnrichmentMiddleware() {
  return async (traceData: any, next: Function) => {
    // Check if this is a generation span
    if (traceData.type === 'generation' && traceData.input && traceData.output) {
      const metrics = await langfuseTokenEnricher.enrichGeneration(
        traceData.traceId,
        traceData.model || 'claude-3-sonnet',
        traceData.input,
        traceData.output,
        {
          autoDetectContent: true,
          includeMetrics: true,
          includeCost: true
        }
      );

      // Add metrics to trace data
      traceData.tokenMetrics = metrics;
    }

    return next(traceData);
  };
}