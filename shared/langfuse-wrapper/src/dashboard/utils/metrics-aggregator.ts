/**
 * Metrics Aggregator for Enhanced Live Dashboard
 * Handles time-series data aggregation and statistical analysis
 */

import { performance } from 'perf_hooks';

export interface AggregationWindow {
  start: number;
  end: number;
  samples: number;
  min: number;
  max: number;
  avg: number;
  sum: number;
  p50: number;
  p95: number;
  p99: number;
  stdDev: number;
}

export interface MetricPoint {
  timestamp: number;
  value: number;
  metadata?: any;
}

export interface AggregatedMetric {
  name: string;
  current: number;
  trend: 'up' | 'down' | 'stable';
  changePercent: number;
  windows: {
    '1m': AggregationWindow;
    '5m': AggregationWindow;
    '15m': AggregationWindow;
    '1h': AggregationWindow;
  };
  forecast?: {
    next5m: number;
    next15m: number;
    confidence: number;
  };
}

export class MetricsAggregator {
  private metricsBuffer: Map<string, MetricPoint[]> = new Map();
  private aggregationCache: Map<string, Map<string, AggregationWindow>> = new Map();
  private maxDataPoints: number;
  private retentionPeriod: number = 3600000; // 1 hour
  private lastCleanup: number = Date.now();

  constructor(maxDataPoints: number = 1000) {
    this.maxDataPoints = maxDataPoints;
    this.startCleanupTimer();
  }

  addMetric(name: string, value: number, metadata?: any): void {
    if (!this.metricsBuffer.has(name)) {
      this.metricsBuffer.set(name, []);
    }

    const buffer = this.metricsBuffer.get(name)!;
    buffer.push({
      timestamp: Date.now(),
      value,
      metadata
    });

    // Maintain buffer size
    if (buffer.length > this.maxDataPoints) {
      buffer.shift();
    }

    // Invalidate cache for this metric
    this.aggregationCache.delete(name);
  }

  addMetrics(metrics: Record<string, number>): void {
    for (const [name, value] of Object.entries(metrics)) {
      this.addMetric(name, value);
    }
  }

  getAggregatedMetric(name: string): AggregatedMetric | null {
    const buffer = this.metricsBuffer.get(name);
    if (!buffer || buffer.length === 0) return null;

    const current = buffer[buffer.length - 1].value;
    const previous = buffer.length > 1 ? buffer[buffer.length - 2].value : current;
    
    const changePercent = previous !== 0 
      ? ((current - previous) / Math.abs(previous)) * 100 
      : 0;

    const trend = changePercent > 1 ? 'up' : changePercent < -1 ? 'down' : 'stable';

    return {
      name,
      current,
      trend,
      changePercent,
      windows: {
        '1m': this.aggregateWindow(name, 60000),
        '5m': this.aggregateWindow(name, 300000),
        '15m': this.aggregateWindow(name, 900000),
        '1h': this.aggregateWindow(name, 3600000)
      },
      forecast: this.generateForecast(name)
    };
  }

  private aggregateWindow(metricName: string, windowMs: number): AggregationWindow {
    const cacheKey = `${windowMs}`;
    
    // Check cache
    if (this.aggregationCache.has(metricName)) {
      const metricCache = this.aggregationCache.get(metricName)!;
      if (metricCache.has(cacheKey)) {
        const cached = metricCache.get(cacheKey)!;
        // Cache valid for 10 seconds
        if (Date.now() - cached.end < 10000) {
          return cached;
        }
      }
    }

    const buffer = this.metricsBuffer.get(metricName) || [];
    const now = Date.now();
    const start = now - windowMs;
    
    const windowData = buffer.filter(p => p.timestamp >= start);
    
    if (windowData.length === 0) {
      return {
        start,
        end: now,
        samples: 0,
        min: 0,
        max: 0,
        avg: 0,
        sum: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        stdDev: 0
      };
    }

    const values = windowData.map(p => p.value).sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    
    // Calculate standard deviation
    const variance = values.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    const result: AggregationWindow = {
      start,
      end: now,
      samples: values.length,
      min: values[0],
      max: values[values.length - 1],
      avg,
      sum,
      p50: this.percentile(values, 0.5),
      p95: this.percentile(values, 0.95),
      p99: this.percentile(values, 0.99),
      stdDev
    };

    // Cache result
    if (!this.aggregationCache.has(metricName)) {
      this.aggregationCache.set(metricName, new Map());
    }
    this.aggregationCache.get(metricName)!.set(cacheKey, result);

    return result;
  }

  private percentile(sortedValues: number[], p: number): number {
    if (sortedValues.length === 0) return 0;
    
    const index = Math.ceil(sortedValues.length * p) - 1;
    return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))];
  }

  private generateForecast(metricName: string): AggregatedMetric['forecast'] | undefined {
    const buffer = this.metricsBuffer.get(metricName);
    if (!buffer || buffer.length < 10) return undefined;

    // Simple linear regression for forecasting
    const recentPoints = buffer.slice(-20);
    const n = recentPoints.length;
    
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    const startTime = recentPoints[0].timestamp;
    
    recentPoints.forEach((point, i) => {
      const x = (point.timestamp - startTime) / 1000; // Convert to seconds
      const y = point.value;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    });

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R-squared for confidence
    const yMean = sumY / n;
    let ssTotal = 0, ssResidual = 0;
    
    recentPoints.forEach((point, i) => {
      const x = (point.timestamp - startTime) / 1000;
      const yPred = slope * x + intercept;
      ssTotal += Math.pow(point.value - yMean, 2);
      ssResidual += Math.pow(point.value - yPred, 2);
    });

    const rSquared = 1 - (ssResidual / ssTotal);
    const confidence = Math.max(0, Math.min(100, rSquared * 100));

    // Predict future values
    const now = Date.now();
    const x5m = ((now + 300000) - startTime) / 1000;
    const x15m = ((now + 900000) - startTime) / 1000;

    return {
      next5m: Math.max(0, slope * x5m + intercept),
      next15m: Math.max(0, slope * x15m + intercept),
      confidence
    };
  }

  getTimeSeriesData(
    metricName: string,
    windowMs?: number,
    interval?: number
  ): Array<{ timestamp: number; value: number }> {
    const buffer = this.metricsBuffer.get(metricName);
    if (!buffer || buffer.length === 0) return [];

    let data = buffer;
    
    if (windowMs) {
      const cutoff = Date.now() - windowMs;
      data = buffer.filter(p => p.timestamp >= cutoff);
    }

    if (interval && interval > 0) {
      // Downsample data
      const downsampled: Array<{ timestamp: number; value: number }> = [];
      let currentBucket = 0;
      let bucketSum = 0;
      let bucketCount = 0;

      for (const point of data) {
        const bucket = Math.floor(point.timestamp / interval);
        
        if (bucket > currentBucket && bucketCount > 0) {
          downsampled.push({
            timestamp: currentBucket * interval,
            value: bucketSum / bucketCount
          });
          bucketSum = 0;
          bucketCount = 0;
        }
        
        currentBucket = bucket;
        bucketSum += point.value;
        bucketCount++;
      }

      if (bucketCount > 0) {
        downsampled.push({
          timestamp: currentBucket * interval,
          value: bucketSum / bucketCount
        });
      }

      return downsampled;
    }

    return data.map(p => ({ timestamp: p.timestamp, value: p.value }));
  }

  getCorrelation(metric1: string, metric2: string, windowMs?: number): number {
    const data1 = this.metricsBuffer.get(metric1);
    const data2 = this.metricsBuffer.get(metric2);
    
    if (!data1 || !data2 || data1.length < 2 || data2.length < 2) {
      return 0;
    }

    // Align timestamps
    const cutoff = windowMs ? Date.now() - windowMs : 0;
    const aligned = this.alignTimeSeries(
      data1.filter(p => p.timestamp >= cutoff),
      data2.filter(p => p.timestamp >= cutoff)
    );

    if (aligned.length < 2) return 0;

    // Calculate Pearson correlation coefficient
    const n = aligned.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;

    aligned.forEach(([p1, p2]) => {
      sumX += p1.value;
      sumY += p2.value;
      sumXY += p1.value * p2.value;
      sumX2 += p1.value * p1.value;
      sumY2 += p2.value * p2.value;
    });

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    return denominator !== 0 ? numerator / denominator : 0;
  }

  private alignTimeSeries(
    series1: MetricPoint[],
    series2: MetricPoint[]
  ): Array<[MetricPoint, MetricPoint]> {
    const aligned: Array<[MetricPoint, MetricPoint]> = [];
    let i = 0, j = 0;

    while (i < series1.length && j < series2.length) {
      const diff = series1[i].timestamp - series2[j].timestamp;
      
      if (Math.abs(diff) < 1000) { // Within 1 second
        aligned.push([series1[i], series2[j]]);
        i++;
        j++;
      } else if (diff < 0) {
        i++;
      } else {
        j++;
      }
    }

    return aligned;
  }

  getAnomalies(metricName: string, sensitivity: number = 2): MetricPoint[] {
    const buffer = this.metricsBuffer.get(metricName);
    if (!buffer || buffer.length < 10) return [];

    const window = this.aggregateWindow(metricName, 300000); // 5 minute window
    if (window.samples < 10) return [];

    const threshold = window.avg + (sensitivity * window.stdDev);
    const lowerThreshold = window.avg - (sensitivity * window.stdDev);

    return buffer.filter(p => 
      p.value > threshold || p.value < lowerThreshold
    );
  }

  private startCleanupTimer(): void {
    setInterval(() => {
      const now = Date.now();
      const cutoff = now - this.retentionPeriod;

      // Clean up old data
      for (const [metricName, buffer] of this.metricsBuffer) {
        const filtered = buffer.filter(p => p.timestamp >= cutoff);
        if (filtered.length === 0) {
          this.metricsBuffer.delete(metricName);
          this.aggregationCache.delete(metricName);
        } else if (filtered.length < buffer.length) {
          this.metricsBuffer.set(metricName, filtered);
          this.aggregationCache.delete(metricName);
        }
      }

      this.lastCleanup = now;
    }, 60000); // Run every minute
  }

  // Public API

  getAllMetrics(): string[] {
    return Array.from(this.metricsBuffer.keys());
  }

  getMetricsSummary(): Record<string, AggregatedMetric> {
    const summary: Record<string, AggregatedMetric> = {};
    
    for (const metricName of this.metricsBuffer.keys()) {
      const aggregated = this.getAggregatedMetric(metricName);
      if (aggregated) {
        summary[metricName] = aggregated;
      }
    }

    return summary;
  }

  clear(): void {
    this.metricsBuffer.clear();
    this.aggregationCache.clear();
  }

  exportData(): any {
    const data: any = {
      metrics: {},
      metadata: {
        exportTime: Date.now(),
        retention: this.retentionPeriod,
        maxDataPoints: this.maxDataPoints
      }
    };

    for (const [name, buffer] of this.metricsBuffer) {
      data.metrics[name] = buffer;
    }

    return data;
  }

  importData(data: any): void {
    if (!data.metrics) return;

    for (const [name, points] of Object.entries(data.metrics)) {
      if (Array.isArray(points)) {
        this.metricsBuffer.set(name, points as MetricPoint[]);
      }
    }

    this.aggregationCache.clear();
  }
}

export { MetricsAggregator };