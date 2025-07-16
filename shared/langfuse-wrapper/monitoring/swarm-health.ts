/**
 * Swarm Health Monitoring
 * Comprehensive health checks for the Claude Flow swarm system
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

export interface HealthStatus {
  component: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  metrics?: any;
  timestamp: Date;
}

export interface SwarmMetrics {
  agents: {
    total: number;
    active: number;
    idle: number;
    failed: number;
  };
  tasks: {
    completed: number;
    inProgress: number;
    failed: number;
    queued: number;
  };
  memory: {
    usage: number;
    available: number;
    percentage: number;
  };
  performance: {
    avgResponseTime: number;
    throughput: number;
    errorRate: number;
  };
}

export interface AlertRule {
  name: string;
  condition: (metrics: SwarmMetrics) => boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  enabled: boolean;
}

export class SwarmHealthMonitor {
  private healthChecks: HealthStatus[] = [];
  private metricsHistory: SwarmMetrics[] = [];
  private alerts: AlertRule[] = [];
  private maxHistorySize = 100;

  constructor() {
    this.initializeAlerts();
  }

  /**
   * Run comprehensive health check
   */
  async runHealthCheck(): Promise<HealthStatus[]> {
    console.log('🔍 Running swarm health check...');
    this.healthChecks = [];

    await Promise.all([
      this.checkSwarmStatus(),
      this.checkAgentHealth(),
      this.checkMemoryHealth(),
      this.checkStorageHealth(),
      this.checkNetworkHealth(),
      this.checkHookIntegration(),
      this.checkLangfuseIntegration()
    ]);

    return this.healthChecks;
  }

  /**
   * Check overall swarm status
   */
  private async checkSwarmStatus(): Promise<void> {
    try {
      // Check if swarm commands are available
      const { stdout } = await execAsync('npx claude-flow@alpha --version', { timeout: 5000 });
      
      if (stdout.includes('claude-flow')) {
        this.addHealthCheck('swarm-core', 'healthy', 'Claude Flow swarm core is available');
      } else {
        this.addHealthCheck('swarm-core', 'unhealthy', 'Claude Flow version check failed');
      }
    } catch (error: any) {
      this.addHealthCheck('swarm-core', 'unhealthy', `Swarm core unavailable: ${error.message}`);
    }
  }

  /**
   * Check agent health and coordination
   */
  private async checkAgentHealth(): Promise<void> {
    try {
      // Check for .swarm directory and agent coordination files
      const swarmDir = '.swarm';
      
      try {
        await fs.access(swarmDir);
        
        // Check memory database
        const memoryDb = path.join(swarmDir, 'memory.db');
        try {
          await fs.access(memoryDb);
          this.addHealthCheck('agent-coordination', 'healthy', 'Agent coordination database available');
        } catch {
          this.addHealthCheck('agent-coordination', 'degraded', 'Memory database not found');
        }

        // Check for recent agent activity
        const files = await fs.readdir(swarmDir);
        const recentFiles = [];
        
        for (const file of files) {
          const stats = await fs.stat(path.join(swarmDir, file));
          const ageMinutes = (Date.now() - stats.mtime.getTime()) / (1000 * 60);
          if (ageMinutes < 60) { // Files modified in last hour
            recentFiles.push(file);
          }
        }

        if (recentFiles.length > 0) {
          this.addHealthCheck('agent-activity', 'healthy', `Recent activity: ${recentFiles.length} files`);
        } else {
          this.addHealthCheck('agent-activity', 'degraded', 'No recent agent activity detected');
        }

      } catch {
        this.addHealthCheck('agent-coordination', 'unhealthy', 'Swarm directory not found - no active coordination');
      }
    } catch (error: any) {
      this.addHealthCheck('agent-health', 'unhealthy', `Agent health check failed: ${error.message}`);
    }
  }

  /**
   * Check memory usage and availability
   */
  private async checkMemoryHealth(): Promise<void> {
    try {
      const { stdout } = await execAsync('node -e "console.log(JSON.stringify(process.memoryUsage()))"');
      const memUsage = JSON.parse(stdout);
      
      const usedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      const totalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
      const percentage = (usedMB / totalMB) * 100;

      if (percentage < 70) {
        this.addHealthCheck('memory', 'healthy', `Memory usage: ${usedMB}MB/${totalMB}MB (${percentage.toFixed(1)}%)`);
      } else if (percentage < 85) {
        this.addHealthCheck('memory', 'degraded', `High memory usage: ${percentage.toFixed(1)}%`);
      } else {
        this.addHealthCheck('memory', 'unhealthy', `Critical memory usage: ${percentage.toFixed(1)}%`);
      }
    } catch (error: any) {
      this.addHealthCheck('memory', 'unhealthy', `Memory check failed: ${error.message}`);
    }
  }

  /**
   * Check storage space and file system health
   */
  private async checkStorageHealth(): Promise<void> {
    try {
      // Check disk space (Unix/Linux/macOS)
      const { stdout } = await execAsync('df -h . | tail -1');
      const parts = stdout.trim().split(/\s+/);
      const usage = parts[4]?.replace('%', '');
      
      if (usage) {
        const usagePercent = parseInt(usage);
        if (usagePercent < 80) {
          this.addHealthCheck('storage', 'healthy', `Disk usage: ${usage}%`);
        } else if (usagePercent < 90) {
          this.addHealthCheck('storage', 'degraded', `High disk usage: ${usage}%`);
        } else {
          this.addHealthCheck('storage', 'unhealthy', `Critical disk usage: ${usage}%`);
        }
      } else {
        this.addHealthCheck('storage', 'degraded', 'Could not determine disk usage');
      }
    } catch (error: any) {
      // Try alternative method for Windows or if df fails
      try {
        await fs.access('.');
        this.addHealthCheck('storage', 'healthy', 'File system accessible');
      } catch {
        this.addHealthCheck('storage', 'unhealthy', 'File system inaccessible');
      }
    }
  }

  /**
   * Check network connectivity
   */
  private async checkNetworkHealth(): Promise<void> {
    try {
      // Test npm registry connectivity (needed for claude-flow)
      const { stdout } = await execAsync('npm ping', { timeout: 10000 });
      
      if (stdout.includes('ok')) {
        this.addHealthCheck('network', 'healthy', 'NPM registry connectivity OK');
      } else {
        this.addHealthCheck('network', 'degraded', 'NPM registry connectivity issues');
      }
    } catch (error: any) {
      this.addHealthCheck('network', 'unhealthy', `Network connectivity failed: ${error.message}`);
    }
  }

  /**
   * Check hook integration
   */
  private async checkHookIntegration(): Promise<void> {
    try {
      // Test hook execution
      const { stdout, stderr } = await execAsync(
        'npx claude-flow@alpha hooks --help', 
        { timeout: 10000 }
      );
      
      if (stdout.includes('hooks') || stderr.includes('hooks')) {
        this.addHealthCheck('hooks', 'healthy', 'Hook system accessible');
        
        // Test a simple hook if possible
        try {
          await execAsync('npx claude-flow@alpha hooks notification --message "health-check" --test true', { timeout: 5000 });
          this.addHealthCheck('hook-execution', 'healthy', 'Hook execution working');
        } catch {
          this.addHealthCheck('hook-execution', 'degraded', 'Hook execution may have issues');
        }
      } else {
        this.addHealthCheck('hooks', 'unhealthy', 'Hook system not responding');
      }
    } catch (error: any) {
      this.addHealthCheck('hooks', 'unhealthy', `Hook integration failed: ${error.message}`);
    }
  }

  /**
   * Check Langfuse integration
   */
  private async checkLangfuseIntegration(): Promise<void> {
    try {
      // Check if Langfuse wrapper is available
      const packageJson = path.resolve('./package.json');
      try {
        const content = await fs.readFile(packageJson, 'utf-8');
        const pkg = JSON.parse(content);
        
        if (pkg.name?.includes('langfuse') || pkg.dependencies?.langfuse) {
          this.addHealthCheck('langfuse-wrapper', 'healthy', 'Langfuse wrapper package available');
        } else {
          this.addHealthCheck('langfuse-wrapper', 'degraded', 'Langfuse dependencies not found in package.json');
        }
      } catch {
        this.addHealthCheck('langfuse-wrapper', 'degraded', 'Package.json not found or invalid');
      }

      // Check environment variables
      const requiredVars = ['LANGFUSE_PUBLIC_KEY', 'LANGFUSE_SECRET_KEY', 'LANGFUSE_BASE_URL'];
      const missingVars = requiredVars.filter(v => !process.env[v]);
      
      if (missingVars.length === 0) {
        this.addHealthCheck('langfuse-config', 'healthy', 'Langfuse environment variables configured');
      } else {
        this.addHealthCheck('langfuse-config', 'degraded', `Missing variables: ${missingVars.join(', ')}`);
      }
    } catch (error: any) {
      this.addHealthCheck('langfuse-integration', 'unhealthy', `Langfuse check failed: ${error.message}`);
    }
  }

  /**
   * Collect comprehensive swarm metrics
   */
  async collectMetrics(): Promise<SwarmMetrics> {
    const metrics: SwarmMetrics = {
      agents: { total: 0, active: 0, idle: 0, failed: 0 },
      tasks: { completed: 0, inProgress: 0, failed: 0, queued: 0 },
      memory: { usage: 0, available: 0, percentage: 0 },
      performance: { avgResponseTime: 0, throughput: 0, errorRate: 0 }
    };

    try {
      // Collect memory metrics
      const memUsage = process.memoryUsage();
      metrics.memory.usage = memUsage.heapUsed;
      metrics.memory.available = memUsage.heapTotal;
      metrics.memory.percentage = (memUsage.heapUsed / memUsage.heapTotal) * 100;

      // Try to collect swarm-specific metrics from memory database
      try {
        const swarmDir = '.swarm';
        const files = await fs.readdir(swarmDir);
        
        // Count agent-related files as a proxy for agent activity
        const agentFiles = files.filter(f => f.includes('agent') || f.includes('task'));
        metrics.agents.total = agentFiles.length;
        metrics.agents.active = agentFiles.length; // Simplified - all detected are considered active

        // Check for task-related files
        const taskFiles = files.filter(f => f.includes('task') || f.includes('todo'));
        metrics.tasks.inProgress = taskFiles.length;

      } catch {
        // Swarm directory not available
      }

      this.metricsHistory.push(metrics);
      if (this.metricsHistory.length > this.maxHistorySize) {
        this.metricsHistory = this.metricsHistory.slice(-this.maxHistorySize);
      }

      this.checkAlerts(metrics);
      return metrics;

    } catch (error) {
      console.error('Error collecting metrics:', error);
      return metrics;
    }
  }

  /**
   * Initialize default alert rules
   */
  private initializeAlerts(): void {
    this.alerts = [
      {
        name: 'High Memory Usage',
        condition: (m) => m.memory.percentage > 85,
        severity: 'high',
        message: 'Memory usage is critically high',
        enabled: true
      },
      {
        name: 'No Active Agents',
        condition: (m) => m.agents.active === 0 && m.agents.total > 0,
        severity: 'medium',
        message: 'No agents are currently active',
        enabled: true
      },
      {
        name: 'High Task Failure Rate',
        condition: (m) => m.tasks.failed > m.tasks.completed && m.tasks.failed > 5,
        severity: 'high',
        message: 'High task failure rate detected',
        enabled: true
      },
      {
        name: 'Low Throughput',
        condition: (m) => m.performance.throughput < 0.1 && m.tasks.inProgress > 0,
        severity: 'medium',
        message: 'System throughput is low',
        enabled: true
      }
    ];
  }

  /**
   * Check alert conditions
   */
  private checkAlerts(metrics: SwarmMetrics): void {
    for (const alert of this.alerts) {
      if (!alert.enabled) continue;

      if (alert.condition(metrics)) {
        const severity = alert.severity === 'critical' ? '🚨' : 
                        alert.severity === 'high' ? '🔴' : 
                        alert.severity === 'medium' ? '🟡' : '🟢';
        
        console.warn(`${severity} ALERT: ${alert.name} - ${alert.message}`);
      }
    }
  }

  /**
   * Add health check result
   */
  private addHealthCheck(
    component: string, 
    status: 'healthy' | 'degraded' | 'unhealthy', 
    message: string,
    metrics?: any
  ): void {
    this.healthChecks.push({
      component,
      status,
      message,
      metrics,
      timestamp: new Date()
    });

    const icon = status === 'healthy' ? '✅' : status === 'degraded' ? '⚠️' : '❌';
    console.log(`${icon} ${component}: ${message}`);
  }

  /**
   * Get health summary
   */
  getHealthSummary(): { healthy: number; degraded: number; unhealthy: number; total: number } {
    return {
      healthy: this.healthChecks.filter(h => h.status === 'healthy').length,
      degraded: this.healthChecks.filter(h => h.status === 'degraded').length,
      unhealthy: this.healthChecks.filter(h => h.status === 'unhealthy').length,
      total: this.healthChecks.length
    };
  }

  /**
   * Save health report
   */
  async saveHealthReport(filename: string): Promise<void> {
    const report = {
      timestamp: new Date().toISOString(),
      summary: this.getHealthSummary(),
      healthChecks: this.healthChecks,
      metricsHistory: this.metricsHistory.slice(-10), // Last 10 metric snapshots
      alerts: this.alerts.filter(a => a.enabled)
    };

    await fs.writeFile(filename, JSON.stringify(report, null, 2));
    console.log(`📄 Health report saved to ${filename}`);
  }

  /**
   * Start continuous monitoring
   */
  startMonitoring(intervalMs: number = 60000): NodeJS.Timeout {
    console.log(`🔍 Starting swarm health monitoring (interval: ${intervalMs}ms)`);
    
    return setInterval(async () => {
      await this.runHealthCheck();
      await this.collectMetrics();
      
      const summary = this.getHealthSummary();
      console.log(`🩺 Health check complete: ${summary.healthy}/${summary.total} healthy`);
    }, intervalMs);
  }
}

// CLI usage example
if (require.main === module) {
  (async () => {
    console.log('🩺 Swarm Health Monitor');
    console.log('========================');
    
    const monitor = new SwarmHealthMonitor();
    
    // Run health check
    const healthResults = await monitor.runHealthCheck();
    
    // Collect metrics
    const metrics = await monitor.collectMetrics();
    
    // Show summary
    console.log('\n📊 Health Summary');
    console.log('=================');
    const summary = monitor.getHealthSummary();
    console.log(`✅ Healthy: ${summary.healthy}`);
    console.log(`⚠️  Degraded: ${summary.degraded}`);
    console.log(`❌ Unhealthy: ${summary.unhealthy}`);
    console.log(`📊 Total Components: ${summary.total}`);
    
    console.log('\n📈 System Metrics');
    console.log('=================');
    console.log(`Memory Usage: ${(metrics.memory.percentage).toFixed(1)}%`);
    console.log(`Active Agents: ${metrics.agents.active}/${metrics.agents.total}`);
    console.log(`Tasks in Progress: ${metrics.tasks.inProgress}`);
    
    // Save report
    await monitor.saveHealthReport(`swarm-health-${Date.now()}.json`);
    
    if (summary.unhealthy > 0) {
      console.log('\n❌ System has unhealthy components - check logs above');
      process.exit(1);
    } else if (summary.degraded > 0) {
      console.log('\n⚠️  System has degraded components - monitor closely');
    } else {
      console.log('\n✅ All systems healthy');
    }
  })();
}