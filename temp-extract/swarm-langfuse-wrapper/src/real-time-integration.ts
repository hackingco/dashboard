/**
 * Real-Time Integration Module
 * Orchestrates all real-time tracing components for comprehensive observability
 */

import { EventEmitter } from 'events';
import { LangfuseWrapper } from './index';
import { RealTimeObserver } from './real-time-observer';
import { StreamingTraceIntegration } from './streaming-trace-integration';
import { LiveDashboard } from './live-dashboard';
import { AdaptiveTracingSystem } from './adaptive-tracing';
import { AnomalyDetectionSystem } from './anomaly-detection';
import { FeedbackOptimizationSystem } from './feedback-optimization';

export interface RealTimeConfig {
  enableRealTimeObserver: boolean;
  enableStreamingIntegration: boolean;
  enableLiveDashboard: boolean;
  enableAdaptiveTracing: boolean;
  enableAnomalyDetection: boolean;
  enableFeedbackOptimization: boolean;
  
  // Observer configuration
  observerPort: number;
  observerRefreshInterval: number;
  
  // Dashboard configuration
  dashboardPort: number;
  dashboardTheme: 'light' | 'dark' | 'auto';
  
  // Adaptive tracing configuration
  adaptiveLearningRate: number;
  adaptiveThreshold: number;
  
  // Anomaly detection configuration
  anomalySensitivity: 'low' | 'medium' | 'high' | 'adaptive';
  anomalyWindowSize: number;
  
  // Feedback optimization configuration
  optimizationInterval: number;
  autoOptimizationEnabled: boolean;
  
  // Database paths
  databaseDirectory: string;
}

export interface SystemStatus {
  isRunning: boolean;
  components: {
    realTimeObserver: ComponentStatus;
    streamingIntegration: ComponentStatus;
    liveDashboard: ComponentStatus;
    adaptiveTracing: ComponentStatus;
    anomalyDetection: ComponentStatus;
    feedbackOptimization: ComponentStatus;
  };
  metrics: {
    totalObservations: number;
    activeTraces: number;
    anomaliesDetected: number;
    optimizationsApplied: number;
    systemUptime: number;
  };
  health: 'healthy' | 'degraded' | 'critical';
}

export interface ComponentStatus {
  enabled: boolean;
  running: boolean;
  healthy: boolean;
  lastActivity: number;
  errorCount: number;
  performance: {
    latency: number;
    throughput: number;
    memoryUsage: number;
  };
}

export class RealTimeIntegration extends EventEmitter {
  private langfuseWrapper: LangfuseWrapper;
  private config: RealTimeConfig;
  
  // Components
  private realTimeObserver?: RealTimeObserver;
  private streamingIntegration?: StreamingTraceIntegration;
  private liveDashboard?: LiveDashboard;
  private adaptiveTracing?: AdaptiveTracingSystem;
  private anomalyDetection?: AnomalyDetectionSystem;
  private feedbackOptimization?: FeedbackOptimizationSystem;
  
  private isRunning = false;
  private startTime = Date.now();
  private healthCheckTimer?: NodeJS.Timeout;
  private componentErrors: Map<string, number> = new Map();

  constructor(langfuseWrapper: LangfuseWrapper, config: Partial<RealTimeConfig> = {}) {
    super();
    
    this.langfuseWrapper = langfuseWrapper;
    
    this.config = {
      enableRealTimeObserver: true,
      enableStreamingIntegration: true,
      enableLiveDashboard: true,
      enableAdaptiveTracing: true,
      enableAnomalyDetection: true,
      enableFeedbackOptimization: true,
      
      observerPort: 8080,
      observerRefreshInterval: 2000,
      
      dashboardPort: 3001,
      dashboardTheme: 'dark',
      
      adaptiveLearningRate: 0.1,
      adaptiveThreshold: 0.2,
      
      anomalySensitivity: 'medium',
      anomalyWindowSize: 300000,
      
      optimizationInterval: 60000,
      autoOptimizationEnabled: true,
      
      databaseDirectory: '.swarm',
      
      ...config
    };
  }

  async initialize(): Promise<void> {
    try {
      console.log('🚀 Initializing Real-Time Tracing Integration...');
      
      await this.initializeComponents();
      await this.setupInterComponentCommunication();
      this.startHealthMonitoring();
      
      console.log('✅ Real-Time Tracing Integration initialized successfully');
      this.emit('initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize real-time integration:', error);
      throw error;
    }
  }

  private async initializeComponents(): Promise<void> {
    const startTime = performance.now();
    
    try {
      // Initialize Real-Time Observer
      if (this.config.enableRealTimeObserver) {
        console.log('🔧 Initializing Real-Time Observer...');
        this.realTimeObserver = new RealTimeObserver(
          this.config.observerPort,
          `${this.config.databaseDirectory}/realtime-observations.db`
        );
        await this.realTimeObserver.start();
        console.log(`✅ Real-Time Observer started on port ${this.config.observerPort}`);
      }

      // Initialize Streaming Integration
      if (this.config.enableStreamingIntegration && this.realTimeObserver) {
        console.log('🔧 Initializing Streaming Integration...');
        this.streamingIntegration = new StreamingTraceIntegration(
          this.langfuseWrapper,
          this.realTimeObserver,
          {
            enableRealTimeUpdates: true,
            updateIntervalMs: this.config.observerRefreshInterval,
            enablePerformanceMetrics: true,
            enableAnomalyDetection: true,
            enableSwarmCoordination: true,
            adaptiveThresholds: true
          }
        );
        console.log('✅ Streaming Integration initialized');
      }

      // Initialize Adaptive Tracing
      if (this.config.enableAdaptiveTracing && this.realTimeObserver && this.streamingIntegration) {
        console.log('🔧 Initializing Adaptive Tracing...');
        this.adaptiveTracing = new AdaptiveTracingSystem(
          this.realTimeObserver,
          this.streamingIntegration,
          {
            learningRate: this.config.adaptiveLearningRate,
            adaptationThreshold: this.config.adaptiveThreshold,
            enablePredictiveTracing: true,
            enableSmartSampling: true,
            enableResourceOptimization: true,
            enableContextualAdaptation: true
          },
          `${this.config.databaseDirectory}/adaptive-tracing.db`
        );
        console.log('✅ Adaptive Tracing initialized');
      }

      // Initialize Anomaly Detection
      if (this.config.enableAnomalyDetection && this.realTimeObserver && this.streamingIntegration) {
        console.log('🔧 Initializing Anomaly Detection...');
        this.anomalyDetection = new AnomalyDetectionSystem(
          this.realTimeObserver,
          this.streamingIntegration,
          {
            sensitivity: this.config.anomalySensitivity,
            windowSizeMs: this.config.anomalyWindowSize,
            enableMLDetection: true,
            enablePatternLearning: true,
            enableFeedbackLoop: true,
            enablePredictiveDetection: true
          },
          `${this.config.databaseDirectory}/anomaly-detection.db`
        );
        console.log('✅ Anomaly Detection initialized');
      }

      // Initialize Feedback Optimization
      if (this.config.enableFeedbackOptimization && 
          this.realTimeObserver && 
          this.streamingIntegration && 
          this.adaptiveTracing && 
          this.anomalyDetection) {
        console.log('🔧 Initializing Feedback Optimization...');
        this.feedbackOptimization = new FeedbackOptimizationSystem(
          this.realTimeObserver,
          this.streamingIntegration,
          this.adaptiveTracing,
          this.anomalyDetection,
          {
            optimizationInterval: this.config.optimizationInterval,
            enableAutoOptimization: this.config.autoOptimizationEnabled,
            enablePerformanceTuning: true,
            enableResourceOptimization: true,
            enableCoordinationOptimization: true
          },
          `${this.config.databaseDirectory}/feedback-optimization.db`
        );
        console.log('✅ Feedback Optimization initialized');
      }

      // Initialize Live Dashboard
      if (this.config.enableLiveDashboard && this.realTimeObserver && this.streamingIntegration) {
        console.log('🔧 Initializing Live Dashboard...');
        this.liveDashboard = new LiveDashboard(
          this.realTimeObserver,
          this.streamingIntegration,
          {
            port: this.config.dashboardPort,
            theme: this.config.dashboardTheme,
            refreshIntervalMs: this.config.observerRefreshInterval,
            enableMetricsExport: true,
            enableAlerts: true
          }
        );
        await this.liveDashboard.start();
        console.log(`✅ Live Dashboard started on http://localhost:${this.config.dashboardPort}`);
      }

      const initTime = performance.now() - startTime;
      console.log(`🎯 All components initialized in ${initTime.toFixed(2)}ms`);

    } catch (error) {
      console.error('Failed to initialize components:', error);
      throw error;
    }
  }

  private async setupInterComponentCommunication(): Promise<void> {
    console.log('🔗 Setting up inter-component communication...');

    // Real-Time Observer events
    if (this.realTimeObserver) {
      this.realTimeObserver.on('anomaly', (anomaly) => {
        this.emit('system_anomaly', anomaly);
      });

      this.realTimeObserver.on('started', () => {
        this.updateComponentStatus('realTimeObserver', 'started');
      });

      this.realTimeObserver.on('stopped', () => {
        this.updateComponentStatus('realTimeObserver', 'stopped');
      });
    }

    // Streaming Integration events
    if (this.streamingIntegration) {
      this.streamingIntegration.on('trace_started', (event) => {
        this.emit('trace_lifecycle', { type: 'started', ...event });
      });

      this.streamingIntegration.on('trace_completed', (event) => {
        this.emit('trace_lifecycle', { type: 'completed', ...event });
      });

      this.streamingIntegration.on('trace_error', (event) => {
        this.emit('trace_lifecycle', { type: 'error', ...event });
      });

      this.streamingIntegration.on('streaming_anomaly', (event) => {
        this.emit('system_anomaly', event);
      });
    }

    // Adaptive Tracing events
    if (this.adaptiveTracing) {
      this.adaptiveTracing.on('strategy_changed', (event) => {
        console.log(`🔄 Adaptive strategy changed: ${event.current.name} (${event.reason})`);
        this.emit('strategy_change', event);
      });

      this.adaptiveTracing.on('adaptation', (event) => {
        this.emit('system_adaptation', event);
      });
    }

    // Anomaly Detection events
    if (this.anomalyDetection) {
      this.anomalyDetection.on('anomaly_detected', (anomaly) => {
        console.warn(`🚨 Anomaly detected: ${anomaly.description} (${anomaly.severity})`);
        this.emit('anomaly_detected', anomaly);
      });

      this.anomalyDetection.on('feedback_received', (event) => {
        this.emit('anomaly_feedback', event);
      });
    }

    // Feedback Optimization events
    if (this.feedbackOptimization) {
      this.feedbackOptimization.on('optimization_applied', (event) => {
        console.log(`⚡ Optimization applied: ${event.recommendation.description}`);
        this.emit('optimization_applied', event);
      });

      this.feedbackOptimization.on('feedback_added', (feedback) => {
        this.emit('performance_feedback', feedback);
      });

      this.feedbackOptimization.on('trends_analyzed', (trends) => {
        this.emit('performance_trends', trends);
      });
    }

    // Live Dashboard events
    if (this.liveDashboard) {
      this.liveDashboard.on('started', () => {
        this.updateComponentStatus('liveDashboard', 'started');
      });

      this.liveDashboard.on('stopped', () => {
        this.updateComponentStatus('liveDashboard', 'stopped');
      });

      this.liveDashboard.on('alert_created', (alert) => {
        this.emit('dashboard_alert', alert);
      });
    }

    console.log('✅ Inter-component communication setup complete');
  }

  private startHealthMonitoring(): void {
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, 30000); // Every 30 seconds

    console.log('❤️  Health monitoring started');
  }

  private performHealthCheck(): void {
    try {
      const status = this.getSystemStatus();
      
      // Check for component failures
      let criticalIssues = 0;
      let degradedComponents = 0;

      for (const [componentName, componentStatus] of Object.entries(status.components)) {
        if (componentStatus.enabled && !componentStatus.running) {
          criticalIssues++;
          console.error(`❌ Critical: ${componentName} is enabled but not running`);
        } else if (componentStatus.enabled && !componentStatus.healthy) {
          degradedComponents++;
          console.warn(`⚠️  Warning: ${componentName} is running but unhealthy`);
        }
      }

      // Update system health
      let systemHealth: SystemStatus['health'] = 'healthy';
      if (criticalIssues > 0) {
        systemHealth = 'critical';
      } else if (degradedComponents > 1) {
        systemHealth = 'degraded';
      }

      if (systemHealth !== 'healthy') {
        this.emit('health_alert', {
          health: systemHealth,
          criticalIssues,
          degradedComponents,
          status
        });
      }

      // Auto-recovery for failed components
      if (this.config.autoOptimizationEnabled && criticalIssues > 0) {
        this.attemptAutoRecovery();
      }

    } catch (error) {
      console.error('Health check failed:', error);
    }
  }

  private async attemptAutoRecovery(): Promise<void> {
    console.log('🔧 Attempting auto-recovery...');

    try {
      // Try to restart failed components
      if (this.realTimeObserver && !this.realTimeObserver.isRunning()) {
        console.log('Restarting Real-Time Observer...');
        await this.realTimeObserver.start();
      }

      if (this.liveDashboard && !this.liveDashboard.isRunning()) {
        console.log('Restarting Live Dashboard...');
        await this.liveDashboard.start();
      }

      console.log('✅ Auto-recovery completed');
      this.emit('auto_recovery_completed');

    } catch (error) {
      console.error('Auto-recovery failed:', error);
      this.emit('auto_recovery_failed', error);
    }
  }

  private updateComponentStatus(componentName: string, status: string): void {
    this.emit('component_status_changed', { component: componentName, status });
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Real-Time Integration is already running');
      return;
    }

    try {
      await this.initialize();
      this.isRunning = true;
      
      console.log('🎯 Real-Time Tracing Integration is now running');
      console.log(`📊 Dashboard: http://localhost:${this.config.dashboardPort}`);
      console.log(`🔍 Observer: http://localhost:${this.config.observerPort}/health`);
      
      this.emit('started');

    } catch (error) {
      console.error('Failed to start real-time integration:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    console.log('🛑 Stopping Real-Time Tracing Integration...');

    try {
      // Stop health monitoring
      if (this.healthCheckTimer) {
        clearInterval(this.healthCheckTimer);
      }

      // Stop all components
      if (this.feedbackOptimization) {
        await this.feedbackOptimization.shutdown();
      }

      if (this.anomalyDetection) {
        await this.anomalyDetection.shutdown();
      }

      if (this.adaptiveTracing) {
        await this.adaptiveTracing.shutdown();
      }

      if (this.streamingIntegration) {
        await this.streamingIntegration.shutdown();
      }

      if (this.liveDashboard) {
        await this.liveDashboard.stop();
      }

      if (this.realTimeObserver) {
        await this.realTimeObserver.stop();
      }

      this.isRunning = false;
      console.log('✅ Real-Time Tracing Integration stopped');
      this.emit('stopped');

    } catch (error) {
      console.error('Error stopping real-time integration:', error);
    }
  }

  // Unified tracing interface
  async startTrace(context: any): Promise<string | null> {
    if (!this.streamingIntegration) {
      return await this.langfuseWrapper.preHook(context);
    }
    
    return await this.streamingIntegration.startTrace(context);
  }

  async updateTrace(traceId: string, data: any, spanId?: string): Promise<void> {
    if (!this.streamingIntegration) return;
    
    await this.streamingIntegration.updateTrace(traceId, data, spanId);
  }

  async completeTrace(traceId: string, result: any, tokenUsage?: any): Promise<void> {
    if (!this.streamingIntegration) {
      await this.langfuseWrapper.postHook(traceId, result, tokenUsage);
      return;
    }
    
    await this.streamingIntegration.completeTrace(traceId, result, tokenUsage);
  }

  async errorTrace(traceId: string, error: Error): Promise<void> {
    if (!this.streamingIntegration) {
      await this.langfuseWrapper.errorHook(traceId, error);
      return;
    }
    
    await this.streamingIntegration.errorTrace(traceId, error);
  }

  // System information and control
  getSystemStatus(): SystemStatus {
    const uptime = Date.now() - this.startTime;
    
    return {
      isRunning: this.isRunning,
      components: {
        realTimeObserver: this.getComponentStatus('realTimeObserver'),
        streamingIntegration: this.getComponentStatus('streamingIntegration'),
        liveDashboard: this.getComponentStatus('liveDashboard'),
        adaptiveTracing: this.getComponentStatus('adaptiveTracing'),
        anomalyDetection: this.getComponentStatus('anomalyDetection'),
        feedbackOptimization: this.getComponentStatus('feedbackOptimization')
      },
      metrics: {
        totalObservations: this.realTimeObserver?.getRecentObservations(1000).length || 0,
        activeTraces: this.streamingIntegration?.getActiveTraces().length || 0,
        anomaliesDetected: this.anomalyDetection?.getAnomalies(1).length || 0,
        optimizationsApplied: this.feedbackOptimization?.getOptimizationResults(1).filter(r => r.applied).length || 0,
        systemUptime: uptime
      },
      health: this.calculateSystemHealth()
    };
  }

  private getComponentStatus(componentName: string): ComponentStatus {
    const component = (this as any)[componentName];
    const enabled = this.config[`enable${componentName.charAt(0).toUpperCase() + componentName.slice(1)}` as keyof RealTimeConfig] as boolean;
    const errorCount = this.componentErrors.get(componentName) || 0;
    
    return {
      enabled,
      running: component ? (component.isRunning?.() ?? true) : false,
      healthy: errorCount < 5,
      lastActivity: Date.now(), // Simplified
      errorCount,
      performance: {
        latency: 0, // Would need actual measurements
        throughput: 0,
        memoryUsage: 0
      }
    };
  }

  private calculateSystemHealth(): SystemStatus['health'] {
    const status = this.getSystemStatus();
    let criticalIssues = 0;
    let degradedComponents = 0;

    for (const componentStatus of Object.values(status.components)) {
      if (componentStatus.enabled && !componentStatus.running) {
        criticalIssues++;
      } else if (componentStatus.enabled && !componentStatus.healthy) {
        degradedComponents++;
      }
    }

    if (criticalIssues > 0) return 'critical';
    if (degradedComponents > 1) return 'degraded';
    return 'healthy';
  }

  // Component access methods
  getRealTimeObserver(): RealTimeObserver | undefined {
    return this.realTimeObserver;
  }

  getStreamingIntegration(): StreamingTraceIntegration | undefined {
    return this.streamingIntegration;
  }

  getLiveDashboard(): LiveDashboard | undefined {
    return this.liveDashboard;
  }

  getAdaptiveTracing(): AdaptiveTracingSystem | undefined {
    return this.adaptiveTracing;
  }

  getAnomalyDetection(): AnomalyDetectionSystem | undefined {
    return this.anomalyDetection;
  }

  getFeedbackOptimization(): FeedbackOptimizationSystem | undefined {
    return this.feedbackOptimization;
  }

  // Configuration methods
  updateConfig(newConfig: Partial<RealTimeConfig>): void {
    Object.assign(this.config, newConfig);
    this.emit('config_updated', newConfig);
  }

  getConfig(): RealTimeConfig {
    return { ...this.config };
  }

  // Utility methods
  async exportSystemData(): Promise<any> {
    const status = this.getSystemStatus();
    
    return {
      timestamp: Date.now(),
      status,
      config: this.config,
      observations: this.realTimeObserver?.getRecentObservations(100) || [],
      anomalies: this.anomalyDetection?.getAnomalies(24) || [],
      optimizations: this.feedbackOptimization?.getOptimizationResults(24) || [],
      strategies: this.adaptiveTracing?.getStrategies() || [],
      patterns: this.adaptiveTracing?.getPatterns() || []
    };
  }

  async importSystemData(data: any): Promise<void> {
    // This would implement system data import functionality
    console.log('System data import not yet implemented');
  }
}

// Export singleton instance for easy access
export let realTimeIntegration: RealTimeIntegration | null = null;

export function initializeRealTimeIntegration(langfuseWrapper: LangfuseWrapper, config?: Partial<RealTimeConfig>): RealTimeIntegration {
  if (realTimeIntegration) {
    console.warn('Real-Time Integration already initialized');
    return realTimeIntegration;
  }
  
  realTimeIntegration = new RealTimeIntegration(langfuseWrapper, config);
  return realTimeIntegration;
}

export function getRealTimeIntegration(): RealTimeIntegration | null {
  return realTimeIntegration;
}

export { RealTimeIntegration };