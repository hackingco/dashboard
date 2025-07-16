/**
 * Chart Data Provider for Enhanced Live Dashboard
 * Generates Chart.js compatible data structures for real-time visualizations
 */

import { MetricsAggregator } from './metrics-aggregator';
import { DashboardMetrics, EnhancedMetrics } from '../enhanced-live-dashboard';

export interface ChartData {
  performanceTrend: TimeSeriesData[];
  swarmActivity: TimeSeriesData[];
  errorDistribution: PieChartData[];
  latencyHistogram: HistogramData[];
  tokenFlow: TimeSeriesData[];
}

export interface TimeSeriesData {
  timestamp: number;
  value: number;
  label?: string;
}

export interface PieChartData {
  label: string;
  value: number;
  color: string;
}

export interface HistogramData {
  range: string;
  count: number;
}

export interface ChartDataset {
  label: string;
  data: any[];
  borderColor?: string;
  backgroundColor?: string;
  fill?: boolean;
  tension?: number;
  pointRadius?: number;
  pointHoverRadius?: number;
  borderWidth?: number;
}

export interface ChartConfiguration {
  type: 'line' | 'bar' | 'pie' | 'doughnut' | 'radar' | 'scatter';
  data: {
    labels: string[];
    datasets: ChartDataset[];
  };
  options: any;
}

export class ChartDataProvider {
  private metricsAggregator: MetricsAggregator;
  private colorPalette: string[] = [
    '#667eea', // Purple
    '#764ba2', // Dark Purple
    '#4ade80', // Green
    '#fbbf24', // Yellow
    '#ef4444', // Red
    '#3b82f6', // Blue
    '#f97316', // Orange
    '#ec4899', // Pink
    '#10b981', // Emerald
    '#8b5cf6', // Violet
  ];

  constructor(metricsAggregator: MetricsAggregator) {
    this.metricsAggregator = metricsAggregator;
  }

  generateChartData(
    history: EnhancedMetrics[],
    currentMetrics: DashboardMetrics
  ): ChartData {
    return {
      performanceTrend: this.generatePerformanceTrend(history),
      swarmActivity: this.generateSwarmActivity(history),
      errorDistribution: this.generateErrorDistribution(currentMetrics),
      latencyHistogram: this.generateLatencyHistogram(history),
      tokenFlow: this.generateTokenFlow(history)
    };
  }

  private generatePerformanceTrend(history: EnhancedMetrics[]): TimeSeriesData[] {
    return history.map(metrics => ({
      timestamp: metrics.timestamp,
      value: metrics.performance.efficiency,
      label: 'Efficiency %'
    }));
  }

  private generateSwarmActivity(history: EnhancedMetrics[]): TimeSeriesData[] {
    return history.map(metrics => ({
      timestamp: metrics.timestamp,
      value: metrics.swarm.totalAgents,
      label: 'Active Agents'
    }));
  }

  private generateErrorDistribution(metrics: DashboardMetrics): PieChartData[] {
    const total = metrics.traces.totalTraces || 1;
    const errors = Math.round(metrics.traces.errorRate * total);
    const successful = total - errors;

    return [
      {
        label: 'Successful',
        value: successful,
        color: this.colorPalette[2] // Green
      },
      {
        label: 'Errors',
        value: errors,
        color: this.colorPalette[4] // Red
      }
    ];
  }

  private generateLatencyHistogram(history: EnhancedMetrics[]): HistogramData[] {
    const latencies = history.map(m => m.traces.averageLatency);
    const ranges = [
      { min: 0, max: 100, label: '0-100ms' },
      { min: 100, max: 250, label: '100-250ms' },
      { min: 250, max: 500, label: '250-500ms' },
      { min: 500, max: 1000, label: '500ms-1s' },
      { min: 1000, max: Infinity, label: '>1s' }
    ];

    return ranges.map(range => ({
      range: range.label,
      count: latencies.filter(l => l >= range.min && l < range.max).length
    }));
  }

  private generateTokenFlow(history: EnhancedMetrics[]): TimeSeriesData[] {
    return history.map(metrics => ({
      timestamp: metrics.timestamp,
      value: metrics.traces.tokenThroughput,
      label: 'Tokens/sec'
    }));
  }

  // Chart.js Configuration Generators

  getPerformanceChartConfig(data: TimeSeriesData[]): ChartConfiguration {
    const labels = data.map(d => this.formatTimestamp(d.timestamp));
    
    return {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Performance Efficiency',
          data: data.map(d => d.value),
          borderColor: this.colorPalette[0],
          backgroundColor: this.hexToRgba(this.colorPalette[0], 0.1),
          fill: true,
          tension: 0.4,
          pointRadius: 2,
          pointHoverRadius: 4,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              label: (context: any) => `Efficiency: ${context.parsed.y.toFixed(1)}%`
            }
          }
        },
        scales: {
          x: {
            display: true,
            grid: {
              display: false
            }
          },
          y: {
            display: true,
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              callback: (value: any) => `${value}%`
            }
          }
        },
        interaction: {
          mode: 'nearest',
          axis: 'x',
          intersect: false
        }
      }
    };
  }

  getSwarmActivityChartConfig(data: TimeSeriesData[]): ChartConfiguration {
    const labels = data.map(d => this.formatTimestamp(d.timestamp));
    
    return {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Active Agents',
          data: data.map(d => d.value),
          backgroundColor: this.colorPalette[2],
          borderColor: this.colorPalette[2],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          x: {
            display: true,
            grid: {
              display: false
            }
          },
          y: {
            display: true,
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              stepSize: 1
            }
          }
        }
      }
    };
  }

  getErrorDistributionChartConfig(data: PieChartData[]): ChartConfiguration {
    return {
      type: 'doughnut',
      data: {
        labels: data.map(d => d.label),
        datasets: [{
          data: data.map(d => d.value),
          backgroundColor: data.map(d => d.color),
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 20,
              usePointStyle: true
            }
          }
        },
        cutout: '60%'
      }
    };
  }

  getLatencyHistogramChartConfig(data: HistogramData[]): ChartConfiguration {
    return {
      type: 'bar',
      data: {
        labels: data.map(d => d.range),
        datasets: [{
          label: 'Request Count',
          data: data.map(d => d.count),
          backgroundColor: this.colorPalette[3],
          borderColor: this.colorPalette[3],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          x: {
            display: true,
            grid: {
              display: false
            }
          },
          y: {
            display: true,
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            }
          }
        }
      }
    };
  }

  getTokenFlowChartConfig(data: TimeSeriesData[]): ChartConfiguration {
    const labels = data.map(d => this.formatTimestamp(d.timestamp));
    
    return {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Token Throughput',
          data: data.map(d => d.value),
          borderColor: this.colorPalette[1],
          backgroundColor: this.hexToRgba(this.colorPalette[1], 0.1),
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 3,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              label: (context: any) => `Tokens/sec: ${context.parsed.y.toFixed(1)}`
            }
          }
        },
        scales: {
          x: {
            display: true,
            grid: {
              display: false
            }
          },
          y: {
            display: true,
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            }
          }
        }
      }
    };
  }

  getMultiMetricChartConfig(
    metrics: string[],
    windowMs: number = 300000
  ): ChartConfiguration {
    const datasets: ChartDataset[] = [];
    let commonLabels: string[] = [];

    metrics.forEach((metricName, index) => {
      const data = this.metricsAggregator.getTimeSeriesData(metricName, windowMs);
      
      if (index === 0) {
        commonLabels = data.map(d => this.formatTimestamp(d.timestamp));
      }

      datasets.push({
        label: this.formatMetricName(metricName),
        data: data.map(d => d.value),
        borderColor: this.colorPalette[index % this.colorPalette.length],
        backgroundColor: 'transparent',
        fill: false,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 3,
        borderWidth: 2
      });
    });

    return {
      type: 'line',
      data: {
        labels: commonLabels,
        datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              usePointStyle: true,
              padding: 10
            }
          },
          tooltip: {
            mode: 'index',
            intersect: false
          }
        },
        scales: {
          x: {
            display: true,
            grid: {
              display: false
            }
          },
          y: {
            display: true,
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            }
          }
        },
        interaction: {
          mode: 'nearest',
          axis: 'x',
          intersect: false
        }
      }
    };
  }

  getCorrelationMatrixConfig(metrics: string[]): ChartConfiguration {
    const matrix: number[][] = [];
    
    for (let i = 0; i < metrics.length; i++) {
      matrix[i] = [];
      for (let j = 0; j < metrics.length; j++) {
        if (i === j) {
          matrix[i][j] = 1;
        } else {
          matrix[i][j] = this.metricsAggregator.getCorrelation(metrics[i], metrics[j]);
        }
      }
    }

    const data: any[] = [];
    for (let i = 0; i < metrics.length; i++) {
      for (let j = 0; j < metrics.length; j++) {
        data.push({
          x: j,
          y: i,
          v: matrix[i][j]
        });
      }
    }

    return {
      type: 'scatter',
      data: {
        labels: metrics.map(m => this.formatMetricName(m)),
        datasets: [{
          label: 'Correlation',
          data,
          backgroundColor: (context: any) => {
            const value = context.raw.v;
            const alpha = Math.abs(value);
            return value >= 0 
              ? `rgba(76, 175, 80, ${alpha})`  // Green for positive
              : `rgba(244, 67, 54, ${alpha})`;  // Red for negative
          },
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: (context: any) => {
                const x = metrics[context.raw.x];
                const y = metrics[context.raw.y];
                const v = context.raw.v.toFixed(2);
                return `${y} vs ${x}: ${v}`;
              }
            }
          }
        },
        scales: {
          x: {
            type: 'category',
            labels: metrics.map(m => this.formatMetricName(m)),
            grid: {
              display: false
            }
          },
          y: {
            type: 'category',
            labels: metrics.map(m => this.formatMetricName(m)),
            grid: {
              display: false
            }
          }
        }
      }
    };
  }

  // Utility methods

  private formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  private formatMetricName(name: string): string {
    return name
      .split(/[._-]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // Public API for custom chart generation

  createCustomChart(
    type: ChartConfiguration['type'],
    data: any[],
    options: any = {}
  ): ChartConfiguration {
    return {
      type,
      data: {
        labels: data.map((_, i) => i.toString()),
        datasets: [{
          data,
          backgroundColor: this.colorPalette[0],
          borderColor: this.colorPalette[0],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        ...options
      }
    };
  }

  getColorPalette(): string[] {
    return [...this.colorPalette];
  }

  generateGradient(startColor: string, endColor: string, steps: number): string[] {
    const start = this.hexToRgb(startColor);
    const end = this.hexToRgb(endColor);
    const gradient: string[] = [];

    for (let i = 0; i < steps; i++) {
      const r = Math.round(start.r + (end.r - start.r) * (i / (steps - 1)));
      const g = Math.round(start.g + (end.g - start.g) * (i / (steps - 1)));
      const b = Math.round(start.b + (end.b - start.b) * (i / (steps - 1)));
      gradient.push(`#${this.rgbToHex(r)}${this.rgbToHex(g)}${this.rgbToHex(b)}`);
    }

    return gradient;
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
  }

  private rgbToHex(value: number): string {
    const hex = value.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }
}

export { ChartDataProvider };