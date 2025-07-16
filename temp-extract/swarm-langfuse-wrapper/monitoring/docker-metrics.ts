/**
 * Docker Container Metrics Collection
 * Real-time monitoring of container health and performance
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';

const execAsync = promisify(exec);

export interface ContainerMetrics {
  id: string;
  name: string;
  status: string;
  cpu: number;
  memory: {
    usage: number;
    limit: number;
    percentage: number;
  };
  network: {
    rx: number;
    tx: number;
  };
  timestamp: Date;
}

export interface AlertThreshold {
  cpu: number;
  memory: number;
  enabled: boolean;
}

export class DockerMetricsCollector {
  private alerts: AlertThreshold = {
    cpu: 80, // 80% CPU threshold
    memory: 85, // 85% memory threshold
    enabled: true
  };

  private metricsHistory: ContainerMetrics[] = [];
  private maxHistorySize = 1000;

  constructor(private containerFilter: string = '') {}

  /**
   * Collect metrics for all containers or filtered containers
   */
  async collectMetrics(): Promise<ContainerMetrics[]> {
    try {
      const containers = await this.getRunningContainers();
      const metrics: ContainerMetrics[] = [];

      for (const container of containers) {
        const containerMetrics = await this.getContainerMetrics(container);
        if (containerMetrics) {
          metrics.push(containerMetrics);
          this.checkAlerts(containerMetrics);
        }
      }

      this.updateHistory(metrics);
      return metrics;
    } catch (error) {
      console.error('Error collecting metrics:', error);
      return [];
    }
  }

  /**
   * Get list of running containers
   */
  private async getRunningContainers(): Promise<string[]> {
    const filterCmd = this.containerFilter 
      ? `--filter "name=${this.containerFilter}"` 
      : '';
    
    const { stdout } = await execAsync(
      `docker ps --format "{{.Names}}" ${filterCmd}`
    );
    
    return stdout.trim().split('\n').filter(name => name.length > 0);
  }

  /**
   * Get detailed metrics for a specific container
   */
  private async getContainerMetrics(containerName: string): Promise<ContainerMetrics | null> {
    try {
      // Get container stats
      const { stdout: statsOutput } = await execAsync(
        `docker stats ${containerName} --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"`
      );

      const lines = statsOutput.trim().split('\n');
      if (lines.length < 2) return null;

      const data = lines[1].split('\t');
      const cpuStr = data[1]?.replace('%', '') || '0';
      const memStr = data[2] || '0B / 0B';
      const netStr = data[3] || '0B / 0B';

      // Parse memory usage
      const memParts = memStr.split(' / ');
      const memUsage = this.parseBytes(memParts[0]);
      const memLimit = this.parseBytes(memParts[1]);
      const memPercentage = memLimit > 0 ? (memUsage / memLimit) * 100 : 0;

      // Parse network I/O
      const netParts = netStr.split(' / ');
      const netRx = this.parseBytes(netParts[0]);
      const netTx = this.parseBytes(netParts[1]);

      // Get container ID and status
      const { stdout: inspectOutput } = await execAsync(
        `docker inspect ${containerName} --format "{{.Id}}\t{{.State.Status}}"`
      );
      const [id, status] = inspectOutput.trim().split('\t');

      return {
        id: id.substring(0, 12),
        name: containerName,
        status,
        cpu: parseFloat(cpuStr),
        memory: {
          usage: memUsage,
          limit: memLimit,
          percentage: memPercentage
        },
        network: {
          rx: netRx,
          tx: netTx
        },
        timestamp: new Date()
      };
    } catch (error) {
      console.error(`Error getting metrics for ${containerName}:`, error);
      return null;
    }
  }

  /**
   * Parse byte strings (e.g., "1.5GiB", "256MiB") to bytes
   */
  private parseBytes(str: string): number {
    const units: { [key: string]: number } = {
      'B': 1,
      'KiB': 1024,
      'MiB': 1024 * 1024,
      'GiB': 1024 * 1024 * 1024,
      'TiB': 1024 * 1024 * 1024 * 1024
    };

    const match = str.match(/^([\d.]+)(\w+)?$/);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2] || 'B';
    
    return value * (units[unit] || 1);
  }

  /**
   * Check if metrics exceed alert thresholds
   */
  private checkAlerts(metrics: ContainerMetrics): void {
    if (!this.alerts.enabled) return;

    const alerts: string[] = [];

    if (metrics.cpu > this.alerts.cpu) {
      alerts.push(`High CPU usage: ${metrics.cpu.toFixed(1)}%`);
    }

    if (metrics.memory.percentage > this.alerts.memory) {
      alerts.push(`High memory usage: ${metrics.memory.percentage.toFixed(1)}%`);
    }

    if (alerts.length > 0) {
      console.warn(`🚨 ALERT - Container ${metrics.name}:`);
      alerts.forEach(alert => console.warn(`  - ${alert}`));
    }
  }

  /**
   * Update metrics history
   */
  private updateHistory(metrics: ContainerMetrics[]): void {
    this.metricsHistory.push(...metrics);
    
    // Keep only recent metrics
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory = this.metricsHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Get metrics history for analysis
   */
  getHistory(): ContainerMetrics[] {
    return [...this.metricsHistory];
  }

  /**
   * Save metrics to JSON file
   */
  async saveMetrics(metrics: ContainerMetrics[], filename: string): Promise<void> {
    try {
      const data = {
        timestamp: new Date().toISOString(),
        metrics,
        summary: this.generateSummary(metrics)
      };
      
      await fs.writeFile(filename, JSON.stringify(data, null, 2));
      console.log(`📊 Metrics saved to ${filename}`);
    } catch (error) {
      console.error('Error saving metrics:', error);
    }
  }

  /**
   * Generate summary statistics
   */
  private generateSummary(metrics: ContainerMetrics[]) {
    if (metrics.length === 0) return null;

    const cpuValues = metrics.map(m => m.cpu);
    const memValues = metrics.map(m => m.memory.percentage);

    return {
      containerCount: metrics.length,
      avgCpu: cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length,
      maxCpu: Math.max(...cpuValues),
      avgMemory: memValues.reduce((a, b) => a + b, 0) / memValues.length,
      maxMemory: Math.max(...memValues),
      healthyContainers: metrics.filter(m => m.status === 'running').length
    };
  }

  /**
   * Update alert thresholds
   */
  setAlertThresholds(cpu: number, memory: number, enabled: boolean = true): void {
    this.alerts = { cpu, memory, enabled };
    console.log(`🔔 Alert thresholds updated: CPU=${cpu}%, Memory=${memory}%`);
  }

  /**
   * Start continuous monitoring
   */
  startMonitoring(intervalMs: number = 30000): NodeJS.Timeout {
    console.log(`🔍 Starting Docker metrics monitoring (interval: ${intervalMs}ms)`);
    
    return setInterval(async () => {
      const metrics = await this.collectMetrics();
      console.log(`📊 Collected metrics for ${metrics.length} containers`);
    }, intervalMs);
  }
}

// CLI usage example
if (require.main === module) {
  const collector = new DockerMetricsCollector('langfuse');
  
  (async () => {
    console.log('🐳 Docker Metrics Collector');
    console.log('============================');
    
    const metrics = await collector.collectMetrics();
    
    if (metrics.length === 0) {
      console.log('No containers found matching filter');
      return;
    }
    
    console.table(metrics.map(m => ({
      Name: m.name,
      Status: m.status,
      'CPU %': `${m.cpu.toFixed(1)}%`,
      'Memory %': `${m.memory.percentage.toFixed(1)}%`,
      'Memory Usage': `${(m.memory.usage / 1024 / 1024).toFixed(0)}MB`,
      'Network RX': `${(m.network.rx / 1024).toFixed(0)}KB`,
      'Network TX': `${(m.network.tx / 1024).toFixed(0)}KB`
    })));
    
    await collector.saveMetrics(metrics, `metrics-${Date.now()}.json`);
  })();
}