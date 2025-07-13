import { langfuseService } from '../services/langfuse/langfuse.service';
import logger from '../services/logger';

interface TracerOptions {
  spanName: string;
  tags: {
    endpoint: string;
    app_name?: string;
    [key: string]: any;
  };
}

interface TracedResponse<T> {
  data: T;
  latency: number;
  traceId: string;
}

/**
 * Wrapper for tracing Fly API calls with Langfuse
 * Provides consistent span naming, tagging, and error tracking
 */
export class LangfuseTracer {
  /**
   * Trace a Fly API call with automatic span management
   * @param options - Tracing options including span name and tags
   * @param apiCall - The async function that makes the API call
   * @returns The API response wrapped with trace metadata
   */
  async traceApiCall<T>(
    options: TracerOptions,
    apiCall: () => Promise<T>
  ): Promise<TracedResponse<T>> {
    const startTime = performance.now();
    const traceId = langfuseService.startTrace(options.spanName, options.tags);
    
    try {
      // Execute the API call
      const result = await apiCall();
      
      // Calculate latency
      const latency = performance.now() - startTime;
      
      // Track successful generation
      await langfuseService.trackGeneration(
        traceId,
        options.spanName,
        JSON.stringify(options.tags),
        JSON.stringify(result),
        { input: 50, output: 100 }, // Estimate tokens based on typical API payloads
        latency,
        {
          ...options.tags,
          http_status: 200,
          latency_ms: Math.round(latency),
          status: 'success'
        }
      );
      
      // End trace successfully
      await langfuseService.endTrace(traceId, {
        status: 'success',
        latency_ms: Math.round(latency),
        ...options.tags
      });
      
      logger.info(`Fly API call successful: ${options.spanName}`, {
        traceId,
        latency: Math.round(latency),
        endpoint: options.tags.endpoint
      });
      
      return {
        data: result,
        latency,
        traceId
      };
    } catch (error) {
      // Calculate latency even for errors
      const latency = performance.now() - startTime;
      
      // Extract error details
      const errorMessage = error instanceof Error ? error.message : String(error);
      const httpStatus = this.extractHttpStatus(errorMessage);
      
      // Track error in Langfuse
      await langfuseService.trackGeneration(
        traceId,
        options.spanName,
        JSON.stringify(options.tags),
        JSON.stringify({ error: errorMessage }),
        { input: 50, output: 50 },
        latency,
        {
          ...options.tags,
          http_status: httpStatus,
          latency_ms: Math.round(latency),
          status: 'error',
          error: errorMessage
        }
      );
      
      // End trace with error
      await langfuseService.endTrace(traceId, {
        status: 'error',
        error: errorMessage,
        http_status: httpStatus,
        latency_ms: Math.round(latency),
        ...options.tags
      });
      
      logger.error(`Fly API call failed: ${options.spanName}`, {
        traceId,
        latency: Math.round(latency),
        endpoint: options.tags.endpoint,
        error: errorMessage,
        httpStatus
      });
      
      // Re-throw the error to maintain original behavior
      throw error;
    }
  }
  
  /**
   * Create a traced version of the Fly API request method
   * @param method - HTTP method
   * @param url - API endpoint URL
   * @param operation - Operation name for span naming
   * @returns Traced API request function
   */
  createTracedRequest(method: string, url: string, operation: string) {
    return async <T>(body?: any): Promise<T> => {
      const endpoint = new URL(url).pathname;
      const appName = this.extractAppName(endpoint);
      
      const options: TracerOptions = {
        spanName: `fly.api.${operation}`,
        tags: {
          endpoint,
          app_name: appName || 'unknown',
          http_method: method
        }
      };
      
      // The actual API call will be provided by the caller
      // This is just creating the traced wrapper
      const response = await this.traceApiCall<T>(options, async () => {
        // This will be replaced by the actual API call in the FlyService
        throw new Error('API call implementation must be provided');
      });
      
      return response.data;
    };
  }
  
  /**
   * Extract HTTP status code from error message
   */
  private extractHttpStatus(errorMessage: string): number {
    const match = errorMessage.match(/(\d{3})/);
    return match ? parseInt(match[1], 10) : 500;
  }
  
  /**
   * Extract app name from API endpoint
   */
  private extractAppName(endpoint: string): string | null {
    const match = endpoint.match(/\/apps\/([^\/]+)/);
    return match ? match[1] : null;
  }
  
  /**
   * Create performance metrics summary
   */
  async getPerformanceMetrics(spanPrefix: string, timeWindow: number = 3600000): Promise<any> {
    // This would query Langfuse for performance metrics
    // For now, return a placeholder
    return {
      spanPrefix,
      timeWindow,
      metrics: {
        totalCalls: 0,
        successRate: 0,
        avgLatency: 0,
        p95Latency: 0,
        p99Latency: 0
      }
    };
  }
}

// Export singleton instance
export const langfuseTracer = new LangfuseTracer();