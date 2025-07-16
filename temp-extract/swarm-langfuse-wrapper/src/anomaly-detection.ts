/**
 * Automated Anomaly Detection System
 * Advanced anomaly detection with machine learning patterns and feedback loops
 */

import { EventEmitter } from 'events';
import { RealTimeObserver, RealTimeObservation } from './real-time-observer';
import { StreamingTraceIntegration } from './streaming-trace-integration';
import Database from 'better-sqlite3';

export interface AnomalyDetectionConfig {
  sensitivity: 'low' | 'medium' | 'high' | 'adaptive';
  windowSizeMs: number;
  anomalyThreshold: number;
  enableMLDetection: boolean;
  enablePatternLearning: boolean;
  enableFeedbackLoop: boolean;
  enablePredictiveDetection: boolean;
  falsePositiveThreshold: number;
}

export interface AnomalyEvent {
  id: string;
  timestamp: number;
  type: 'statistical' | 'pattern' | 'threshold' | 'ml_detected' | 'predictive';
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  description: string;
  affectedMetrics: string[];
  rootCause?: string;
  recommendation?: string;
  context: {
    observation: RealTimeObservation;
    baseline: any;
    deviation: number;
    pattern?: any;
  };
  resolved: boolean;
  falsePositive: boolean;
  feedback?: AnomalyFeedback;
}

export interface AnomalyFeedback {
  timestamp: number;
  isValid: boolean;
  severity: 'correct' | 'too_low' | 'too_high' | 'false_positive';
  userNotes?: string;
  suggestedAction?: string;
}

export interface AnomalyPattern {
  id: string;
  name: string;
  description: string;
  detectionLogic: string;
  thresholds: Record<string, number>;
  confidence: number;
  accuracy: number;
  falsePositiveRate: number;
  lastDetection: number;
  detectionCount: number;
  enabled: boolean;
}

export interface StatisticalBaseline {
  metric: string;
  mean: number;
  standardDeviation: number;
  median: number;
  percentile95: number;
  percentile99: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  lastUpdated: number;
  sampleSize: number;
}

export interface MLFeature {
  name: string;
  value: number;
  importance: number;
  normalized: boolean;
}

export class AnomalyDetectionSystem extends EventEmitter {
  private realTimeObserver: RealTimeObserver;
  private streamingIntegration: StreamingTraceIntegration;
  private config: AnomalyDetectionConfig;
  private db: Database.Database;
  private anomalies: Map<string, AnomalyEvent> = new Map();
  private patterns: Map<string, AnomalyPattern> = new Map();
  private baselines: Map<string, StatisticalBaseline> = new Map();
  private observationBuffer: RealTimeObservation[] = [];
  private detectionTimer?: NodeJS.Timeout;
  private isLearning = true;
  private mlModel: SimpleMLModel;

  constructor(
    realTimeObserver: RealTimeObserver,
    streamingIntegration: StreamingTraceIntegration,
    config: Partial<AnomalyDetectionConfig> = {},
    dbPath: string = '.swarm/anomaly-detection.db'
  ) {
    super();

    this.realTimeObserver = realTimeObserver;
    this.streamingIntegration = streamingIntegration;
    
    this.config = {
      sensitivity: 'medium',
      windowSizeMs: 300000, // 5 minutes
      anomalyThreshold: 2.5, // Standard deviations
      enableMLDetection: true,
      enablePatternLearning: true,
      enableFeedbackLoop: true,
      enablePredictiveDetection: true,
      falsePositiveThreshold: 0.1,
      ...config
    };

    this.initializeDatabase(dbPath);
    this.initializePatterns();
    this.loadPersistedData();
    this.mlModel = new SimpleMLModel();
    this.setupEventHandlers();
    this.startDetection();
  }

  private initializeDatabase(dbPath: string): void {
    try {
      this.db = new Database(dbPath);
      
      // Create anomalies table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS anomalies (
          id TEXT PRIMARY KEY,
          timestamp INTEGER,
          type TEXT,
          severity TEXT,
          confidence REAL,
          description TEXT,
          affected_metrics TEXT,
          root_cause TEXT,
          recommendation TEXT,
          context TEXT,
          resolved INTEGER,
          false_positive INTEGER,
          feedback TEXT
        )
      `);

      // Create patterns table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS anomaly_patterns (
          id TEXT PRIMARY KEY,
          name TEXT,
          description TEXT,
          detection_logic TEXT,
          thresholds TEXT,
          confidence REAL,
          accuracy REAL,
          false_positive_rate REAL,
          last_detection INTEGER,
          detection_count INTEGER,
          enabled INTEGER
        )
      `);

      // Create baselines table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS statistical_baselines (
          metric TEXT PRIMARY KEY,
          mean REAL,
          standard_deviation REAL,
          median REAL,
          percentile_95 REAL,
          percentile_99 REAL,
          trend TEXT,
          last_updated INTEGER,
          sample_size INTEGER
        )
      `);

      // Create ML features table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS ml_features (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp INTEGER,
          features TEXT,
          label INTEGER,
          prediction REAL
        )
      `);

      // Create indices
      this.db.exec(`CREATE INDEX IF NOT EXISTS idx_anomalies_timestamp ON anomalies(timestamp)`);
      this.db.exec(`CREATE INDEX IF NOT EXISTS idx_anomalies_severity ON anomalies(severity)`);
      this.db.exec(`CREATE INDEX IF NOT EXISTS idx_patterns_accuracy ON anomaly_patterns(accuracy DESC)`);

    } catch (error) {
      console.error('Failed to initialize anomaly detection database:', error);
      throw error;
    }
  }

  private initializePatterns(): void {
    const defaultPatterns: AnomalyPattern[] = [
      {
        id: 'latency_spike',
        name: 'Latency Spike',
        description: 'Sudden increase in response latency',
        detectionLogic: 'latency > baseline.mean + (2 * baseline.standardDeviation)',
        thresholds: { multiplier: 2.0, minValue: 100 },
        confidence: 0.8,
        accuracy: 0.85,
        falsePositiveRate: 0.05,
        lastDetection: 0,
        detectionCount: 0,
        enabled: true
      },
      {
        id: 'error_burst',
        name: 'Error Burst',
        description: 'Rapid increase in error rate',
        detectionLogic: 'errors_per_minute > baseline.mean + (3 * baseline.standardDeviation)',
        thresholds: { errorRate: 0.1, timeWindow: 60000 },
        confidence: 0.9,
        accuracy: 0.92,
        falsePositiveRate: 0.03,
        lastDetection: 0,
        detectionCount: 0,
        enabled: true
      },
      {
        id: 'memory_leak',
        name: 'Memory Leak',
        description: 'Continuously increasing memory usage',
        detectionLogic: 'memory trend = increasing AND duration > 10 minutes',
        thresholds: { trendDuration: 600000, growthRate: 1.2 },
        confidence: 0.75,
        accuracy: 0.80,
        falsePositiveRate: 0.08,
        lastDetection: 0,
        detectionCount: 0,
        enabled: true
      },
      {
        id: 'coordination_failure',
        name: 'Coordination Failure',
        description: 'Breakdown in swarm coordination',
        detectionLogic: 'coordination_latency > 1000 OR sync_errors > 5',
        thresholds: { maxLatency: 1000, maxSyncErrors: 5 },
        confidence: 0.85,
        accuracy: 0.88,
        falsePositiveRate: 0.04,
        lastDetection: 0,
        detectionCount: 0,
        enabled: true
      },
      {
        id: 'token_exhaustion',
        name: 'Token Exhaustion',
        description: 'Unusual token consumption patterns',
        detectionLogic: 'token_rate > baseline.percentile95 AND cost_spike = true',
        thresholds: { costMultiplier: 3.0, tokenRateMultiplier: 2.5 },
        confidence: 0.7,
        accuracy: 0.78,
        falsePositiveRate: 0.1,
        lastDetection: 0,
        detectionCount: 0,
        enabled: true
      },
      {
        id: 'deadlock_pattern',
        name: 'Deadlock Pattern',
        description: 'Detection of potential deadlock conditions',
        detectionLogic: 'no_progress > 30s AND active_traces > 0',
        thresholds: { maxIdleTime: 30000, minActiveTraces: 1 },
        confidence: 0.9,
        accuracy: 0.85,
        falsePositiveRate: 0.06,
        lastDetection: 0,
        detectionCount: 0,
        enabled: true
      }
    ];

    for (const pattern of defaultPatterns) {
      this.patterns.set(pattern.id, pattern);
    }
  }

  private loadPersistedData(): void {
    try {
      // Load anomalies
      const anomaliesStmt = this.db.prepare('SELECT * FROM anomalies WHERE timestamp > ? ORDER BY timestamp DESC LIMIT 1000');
      const recentAnomalies = anomaliesStmt.all(Date.now() - 86400000); // Last 24 hours
      
      for (const row of recentAnomalies) {
        const anomaly: AnomalyEvent = {
          id: row.id,
          timestamp: row.timestamp,
          type: row.type as any,
          severity: row.severity as any,
          confidence: row.confidence,
          description: row.description,
          affectedMetrics: JSON.parse(row.affected_metrics || '[]'),
          rootCause: row.root_cause,
          recommendation: row.recommendation,
          context: JSON.parse(row.context || '{}'),
          resolved: Boolean(row.resolved),
          falsePositive: Boolean(row.false_positive),
          feedback: row.feedback ? JSON.parse(row.feedback) : undefined
        };
        this.anomalies.set(anomaly.id, anomaly);
      }

      // Load patterns
      const patternsStmt = this.db.prepare('SELECT * FROM anomaly_patterns');
      const savedPatterns = patternsStmt.all();
      
      for (const row of savedPatterns) {
        const pattern: AnomalyPattern = {
          id: row.id,
          name: row.name,
          description: row.description,
          detectionLogic: row.detection_logic,
          thresholds: JSON.parse(row.thresholds || '{}'),
          confidence: row.confidence,
          accuracy: row.accuracy,
          falsePositiveRate: row.false_positive_rate,
          lastDetection: row.last_detection,
          detectionCount: row.detection_count,
          enabled: Boolean(row.enabled)
        };
        this.patterns.set(pattern.id, pattern);
      }

      // Load baselines
      const baselinesStmt = this.db.prepare('SELECT * FROM statistical_baselines');
      const savedBaselines = baselinesStmt.all();
      
      for (const row of savedBaselines) {
        const baseline: StatisticalBaseline = {
          metric: row.metric,
          mean: row.mean,
          standardDeviation: row.standard_deviation,
          median: row.median,
          percentile95: row.percentile_95,
          percentile99: row.percentile_99,
          trend: row.trend as any,
          lastUpdated: row.last_updated,
          sampleSize: row.sample_size
        };
        this.baselines.set(baseline.metric, baseline);
      }

    } catch (error) {
      console.warn('Failed to load persisted anomaly detection data:', error);
    }
  }

  private setupEventHandlers(): void {
    // Listen to real-time observations
    this.realTimeObserver.on('observation', (observation: RealTimeObservation) => {
      this.processObservation(observation);
    });

    // Listen to streaming events
    this.streamingIntegration.on('trace_error', (event) => {
      this.handleTraceError(event);
    });

    this.streamingIntegration.on('trace_completed', (event) => {
      this.updateBaselines(event);
    });
  }

  private startDetection(): void {
    this.detectionTimer = setInterval(() => {
      this.runDetectionCycle();
    }, 10000); // Every 10 seconds
  }

  private processObservation(observation: RealTimeObservation): void {
    // Add to buffer
    this.observationBuffer.push(observation);
    
    // Keep buffer size manageable
    if (this.observationBuffer.length > 1000) {
      this.observationBuffer.shift();
    }

    // Update baselines
    if (this.isLearning) {
      this.updateStatisticalBaselines(observation);
    }

    // Immediate anomaly detection
    this.detectImmediateAnomalies(observation);

    // Train ML model
    if (this.config.enableMLDetection) {
      this.trainMLModel(observation);
    }
  }

  private updateStatisticalBaselines(observation: RealTimeObservation): void {
    const metrics = [
      { name: 'latency', value: observation.performanceMetrics.latencyMs },
      { name: 'memory', value: observation.performanceMetrics.memoryUsageMB || 0 },
      { name: 'cpu', value: observation.performanceMetrics.cpuUsagePercent || 0 },
      { name: 'tokens_per_second', value: observation.performanceMetrics.tokensPerSecond || 0 }
    ];

    for (const metric of metrics) {
      this.updateBaseline(metric.name, metric.value);
    }
  }

  private updateBaseline(metricName: string, value: number): void {
    let baseline = this.baselines.get(metricName);
    
    if (!baseline) {
      baseline = {
        metric: metricName,
        mean: value,
        standardDeviation: 0,
        median: value,
        percentile95: value,
        percentile99: value,
        trend: 'stable',
        lastUpdated: Date.now(),
        sampleSize: 1
      };
    } else {
      // Update using exponential moving average
      const alpha = 0.1;
      baseline.mean = baseline.mean * (1 - alpha) + value * alpha;
      
      // Update standard deviation (simplified)
      const variance = Math.pow(value - baseline.mean, 2);
      baseline.standardDeviation = Math.sqrt(baseline.standardDeviation * (1 - alpha) + variance * alpha);
      
      baseline.sampleSize++;
      baseline.lastUpdated = Date.now();
    }

    this.baselines.set(metricName, baseline);
    
    // Persist baseline periodically
    if (baseline.sampleSize % 100 === 0) {
      this.persistBaseline(baseline);
    }
  }

  private detectImmediateAnomalies(observation: RealTimeObservation): void {
    const anomalies: AnomalyEvent[] = [];

    // Statistical anomaly detection
    anomalies.push(...this.detectStatisticalAnomalies(observation));

    // Pattern-based detection
    anomalies.push(...this.detectPatternAnomalies(observation));

    // ML-based detection
    if (this.config.enableMLDetection) {
      anomalies.push(...this.detectMLAnomalies(observation));
    }

    // Process detected anomalies
    for (const anomaly of anomalies) {
      this.handleDetectedAnomaly(anomaly);
    }
  }

  private detectStatisticalAnomalies(observation: RealTimeObservation): AnomalyEvent[] {
    const anomalies: AnomalyEvent[] = [];
    const threshold = this.getAnomalyThreshold();

    const metrics = [
      { name: 'latency', value: observation.performanceMetrics.latencyMs },
      { name: 'memory', value: observation.performanceMetrics.memoryUsageMB || 0 },
      { name: 'cpu', value: observation.performanceMetrics.cpuUsagePercent || 0 }
    ];

    for (const metric of metrics) {
      const baseline = this.baselines.get(metric.name);
      if (!baseline || baseline.sampleSize < 10) continue;

      const deviation = Math.abs(metric.value - baseline.mean) / Math.max(baseline.standardDeviation, 0.1);
      
      if (deviation > threshold) {
        const severity = this.assessSeverity(deviation);
        const confidence = Math.min(0.95, deviation / threshold);

        anomalies.push({
          id: `stat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: observation.timestamp,
          type: 'statistical',
          severity,
          confidence,
          description: `Statistical anomaly in ${metric.name}: ${metric.value} (${deviation.toFixed(2)}σ from baseline)`,
          affectedMetrics: [metric.name],
          rootCause: `${metric.name} deviates significantly from statistical baseline`,
          recommendation: this.generateRecommendation(metric.name, metric.value, baseline),
          context: {
            observation,
            baseline,
            deviation,
          },
          resolved: false,
          falsePositive: false
        });
      }
    }

    return anomalies;
  }

  private detectPatternAnomalies(observation: RealTimeObservation): AnomalyEvent[] {
    const anomalies: AnomalyEvent[] = [];

    for (const [patternId, pattern] of this.patterns) {
      if (!pattern.enabled) continue;

      const detected = this.evaluatePattern(pattern, observation);
      if (detected) {
        pattern.lastDetection = Date.now();
        pattern.detectionCount++;

        anomalies.push({
          id: `pattern-${patternId}-${Date.now()}`,
          timestamp: observation.timestamp,
          type: 'pattern',
          severity: this.assessPatternSeverity(pattern),
          confidence: pattern.confidence,
          description: `Pattern anomaly detected: ${pattern.description}`,
          affectedMetrics: this.extractAffectedMetrics(pattern),
          rootCause: pattern.description,
          recommendation: this.generatePatternRecommendation(pattern),
          context: {
            observation,
            baseline: {},
            deviation: 0,
            pattern
          },
          resolved: false,
          falsePositive: false
        });

        this.persistPattern(pattern);
      }
    }

    return anomalies;
  }

  private detectMLAnomalies(observation: RealTimeObservation): AnomalyEvent[] {
    const anomalies: AnomalyEvent[] = [];

    try {
      const features = this.extractFeatures(observation);
      const prediction = this.mlModel.predict(features);
      
      if (prediction > 0.7) { // Anomaly threshold
        anomalies.push({
          id: `ml-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: observation.timestamp,
          type: 'ml_detected',
          severity: prediction > 0.9 ? 'critical' : prediction > 0.8 ? 'high' : 'medium',
          confidence: prediction,
          description: `ML model detected anomaly (confidence: ${(prediction * 100).toFixed(1)}%)`,
          affectedMetrics: this.identifyImportantFeatures(features),
          rootCause: 'ML model detected unusual pattern',
          recommendation: 'Investigate recent changes and performance metrics',
          context: {
            observation,
            baseline: {},
            deviation: prediction
          },
          resolved: false,
          falsePositive: false
        });
      }
    } catch (error) {
      console.warn('ML anomaly detection failed:', error);
    }

    return anomalies;
  }

  private evaluatePattern(pattern: AnomalyPattern, observation: RealTimeObservation): boolean {
    // Simplified pattern evaluation
    switch (pattern.id) {
      case 'latency_spike':
        const baseline = this.baselines.get('latency');
        if (!baseline) return false;
        return observation.performanceMetrics.latencyMs > (baseline.mean + pattern.thresholds.multiplier * baseline.standardDeviation);

      case 'error_burst':
        return observation.type === 'error' && this.getRecentErrorRate() > pattern.thresholds.errorRate;

      case 'memory_leak':
        return this.detectMemoryTrend() === 'increasing';

      case 'coordination_failure':
        const metrics = this.realTimeObserver.getMetrics();
        return metrics.swarmCoordination.coordinationLatency > pattern.thresholds.maxLatency;

      case 'token_exhaustion':
        const tokenRate = observation.performanceMetrics.tokensPerSecond || 0;
        const tokenBaseline = this.baselines.get('tokens_per_second');
        return tokenBaseline && tokenRate > tokenBaseline.percentile95 * pattern.thresholds.tokenRateMultiplier;

      case 'deadlock_pattern':
        return this.detectDeadlock();

      default:
        return false;
    }
  }

  private getRecentErrorRate(): number {
    const recent = this.observationBuffer.filter(obs => 
      obs.timestamp > Date.now() - 60000 // Last minute
    );
    const errors = recent.filter(obs => obs.type === 'error');
    return recent.length > 0 ? errors.length / recent.length : 0;
  }

  private detectMemoryTrend(): 'increasing' | 'decreasing' | 'stable' {
    const recentMemory = this.observationBuffer
      .filter(obs => obs.timestamp > Date.now() - 600000) // Last 10 minutes
      .map(obs => obs.performanceMetrics.memoryUsageMB || 0)
      .slice(-20); // Last 20 observations

    if (recentMemory.length < 5) return 'stable';

    const firstHalf = recentMemory.slice(0, Math.floor(recentMemory.length / 2));
    const secondHalf = recentMemory.slice(Math.floor(recentMemory.length / 2));

    const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;

    const change = (secondAvg - firstAvg) / firstAvg;

    if (change > 0.1) return 'increasing';
    if (change < -0.1) return 'decreasing';
    return 'stable';
  }

  private detectDeadlock(): boolean {
    const activeTraces = this.streamingIntegration.getActiveTraces();
    const recentActivity = this.observationBuffer.filter(obs => 
      obs.timestamp > Date.now() - 30000 // Last 30 seconds
    );

    return activeTraces.length > 0 && recentActivity.length === 0;
  }

  private extractFeatures(observation: RealTimeObservation): MLFeature[] {
    return [
      { name: 'latency', value: observation.performanceMetrics.latencyMs, importance: 1.0, normalized: false },
      { name: 'memory', value: observation.performanceMetrics.memoryUsageMB || 0, importance: 0.8, normalized: false },
      { name: 'cpu', value: observation.performanceMetrics.cpuUsagePercent || 0, importance: 0.7, normalized: false },
      { name: 'tokens_per_second', value: observation.performanceMetrics.tokensPerSecond || 0, importance: 0.6, normalized: false },
      { name: 'is_error', value: observation.type === 'error' ? 1 : 0, importance: 0.9, normalized: true },
      { name: 'severity_numeric', value: this.severityToNumeric(observation.severity), importance: 0.5, normalized: true },
      { name: 'hour_of_day', value: new Date().getHours(), importance: 0.3, normalized: true }
    ];
  }

  private identifyImportantFeatures(features: MLFeature[]): string[] {
    return features
      .filter(f => f.importance > 0.7)
      .map(f => f.name);
  }

  private severityToNumeric(severity: string): number {
    switch (severity) {
      case 'low': return 0.25;
      case 'medium': return 0.5;
      case 'high': return 0.75;
      case 'critical': return 1.0;
      default: return 0.5;
    }
  }

  private trainMLModel(observation: RealTimeObservation): void {
    const features = this.extractFeatures(observation);
    const isAnomaly = this.isObservationAnomaly(observation);
    
    this.mlModel.addTrainingData(features, isAnomaly ? 1 : 0);
    
    // Retrain periodically
    if (this.mlModel.getTrainingDataSize() % 100 === 0) {
      this.mlModel.train();
    }
  }

  private isObservationAnomaly(observation: RealTimeObservation): boolean {
    // Simple heuristic to label data for ML training
    const threshold = this.getAnomalyThreshold();
    
    const latencyBaseline = this.baselines.get('latency');
    if (latencyBaseline) {
      const deviation = Math.abs(observation.performanceMetrics.latencyMs - latencyBaseline.mean) / Math.max(latencyBaseline.standardDeviation, 0.1);
      if (deviation > threshold) return true;
    }

    return observation.type === 'error' || observation.severity === 'critical';
  }

  private runDetectionCycle(): void {
    try {
      // Update ML model if needed
      if (this.config.enableMLDetection && this.mlModel.needsTraining()) {
        this.mlModel.train();
      }

      // Run predictive detection
      if (this.config.enablePredictiveDetection) {
        this.runPredictiveDetection();
      }

      // Update pattern accuracy
      this.updatePatternAccuracy();

      // Cleanup old anomalies
      this.cleanupOldAnomalies();

    } catch (error) {
      console.warn('Detection cycle error:', error);
    }
  }

  private runPredictiveDetection(): void {
    // Analyze trends and predict potential anomalies
    const recentObservations = this.observationBuffer.slice(-50);
    if (recentObservations.length < 10) return;

    // Predict latency spikes
    const latencyTrend = this.calculateTrend(recentObservations.map(obs => obs.performanceMetrics.latencyMs));
    if (latencyTrend.slope > 5 && latencyTrend.r2 > 0.7) {
      this.createPredictiveAnomaly('latency_spike_predicted', 'Latency trend indicates potential spike', latencyTrend);
    }

    // Predict memory issues
    const memoryTrend = this.calculateTrend(recentObservations.map(obs => obs.performanceMetrics.memoryUsageMB || 0));
    if (memoryTrend.slope > 2 && memoryTrend.r2 > 0.6) {
      this.createPredictiveAnomaly('memory_increase_predicted', 'Memory usage trend indicates potential issue', memoryTrend);
    }
  }

  private calculateTrend(values: number[]): { slope: number; r2: number; prediction: number } {
    if (values.length < 3) return { slope: 0, r2: 0, prediction: values[values.length - 1] || 0 };

    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = values;

    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);
    const sumYY = y.reduce((sum, val) => sum + val * val, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R²
    const yMean = sumY / n;
    const ssRes = y.reduce((sum, val, i) => sum + Math.pow(val - (slope * x[i] + intercept), 2), 0);
    const ssTot = y.reduce((sum, val) => sum + Math.pow(val - yMean, 2), 0);
    const r2 = 1 - (ssRes / ssTot);

    const prediction = slope * n + intercept;

    return { slope, r2, prediction };
  }

  private createPredictiveAnomaly(type: string, description: string, trend: any): void {
    const anomaly: AnomalyEvent = {
      id: `pred-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      type: 'predictive',
      severity: 'medium',
      confidence: trend.r2,
      description,
      affectedMetrics: [type.split('_')[0]],
      rootCause: `Predictive analysis based on trend (R²=${trend.r2.toFixed(3)})`,
      recommendation: `Monitor ${type.split('_')[0]} closely and prepare mitigation strategies`,
      context: {
        observation: {} as RealTimeObservation,
        baseline: {},
        deviation: trend.slope,
        pattern: { trend }
      },
      resolved: false,
      falsePositive: false
    };

    this.handleDetectedAnomaly(anomaly);
  }

  private updatePatternAccuracy(): void {
    // Update pattern accuracy based on feedback
    for (const [patternId, pattern] of this.patterns) {
      const recentAnomalies = Array.from(this.anomalies.values())
        .filter(a => a.context.pattern?.id === patternId && a.timestamp > Date.now() - 86400000);

      if (recentAnomalies.length > 0) {
        const validAnomalies = recentAnomalies.filter(a => !a.falsePositive);
        const accuracy = validAnomalies.length / recentAnomalies.length;
        const falsePositiveRate = (recentAnomalies.length - validAnomalies.length) / recentAnomalies.length;

        pattern.accuracy = (pattern.accuracy * 0.8) + (accuracy * 0.2);
        pattern.falsePositiveRate = (pattern.falsePositiveRate * 0.8) + (falsePositiveRate * 0.2);

        // Disable patterns with high false positive rates
        if (pattern.falsePositiveRate > this.config.falsePositiveThreshold) {
          pattern.enabled = false;
          console.warn(`Disabled pattern ${pattern.name} due to high false positive rate: ${pattern.falsePositiveRate.toFixed(3)}`);
        }

        this.persistPattern(pattern);
      }
    }
  }

  private handleDetectedAnomaly(anomaly: AnomalyEvent): void {
    this.anomalies.set(anomaly.id, anomaly);
    this.persistAnomaly(anomaly);

    console.warn(`🚨 Anomaly detected: ${anomaly.description} (${anomaly.severity}, confidence: ${(anomaly.confidence * 100).toFixed(1)}%)`);
    
    this.emit('anomaly_detected', anomaly);

    // Auto-resolve low-confidence anomalies after some time
    if (anomaly.confidence < 0.5) {
      setTimeout(() => {
        this.resolveAnomaly(anomaly.id, 'auto_resolved_low_confidence');
      }, 300000); // 5 minutes
    }
  }

  private getAnomalyThreshold(): number {
    const baseTresholds = {
      'low': 3.0,
      'medium': 2.5,
      'high': 2.0,
      'adaptive': this.calculateAdaptiveThreshold()
    };

    return baseTresholds[this.config.sensitivity];
  }

  private calculateAdaptiveThreshold(): number {
    // Adaptive threshold based on recent false positive rate
    const recentAnomalies = Array.from(this.anomalies.values())
      .filter(a => a.timestamp > Date.now() - 3600000); // Last hour

    if (recentAnomalies.length === 0) return 2.5;

    const falsePositives = recentAnomalies.filter(a => a.falsePositive).length;
    const falsePositiveRate = falsePositives / recentAnomalies.length;

    // Increase threshold if too many false positives
    if (falsePositiveRate > 0.2) return 3.0;
    if (falsePositiveRate > 0.1) return 2.7;
    if (falsePositiveRate < 0.05) return 2.0;
    
    return 2.5;
  }

  private assessSeverity(deviation: number): AnomalyEvent['severity'] {
    if (deviation > 4) return 'critical';
    if (deviation > 3) return 'high';
    if (deviation > 2) return 'medium';
    return 'low';
  }

  private assessPatternSeverity(pattern: AnomalyPattern): AnomalyEvent['severity'] {
    if (pattern.confidence > 0.9) return 'high';
    if (pattern.confidence > 0.7) return 'medium';
    return 'low';
  }

  private generateRecommendation(metric: string, value: number, baseline: StatisticalBaseline): string {
    switch (metric) {
      case 'latency':
        return value > baseline.mean * 2 ? 'Investigate performance bottlenecks and optimize slow operations' : 'Monitor latency trends';
      case 'memory':
        return value > baseline.mean * 1.5 ? 'Check for memory leaks and optimize memory usage' : 'Monitor memory consumption';
      case 'cpu':
        return value > baseline.mean * 1.5 ? 'Investigate high CPU usage and optimize processing' : 'Monitor CPU utilization';
      default:
        return 'Investigate the anomaly and take appropriate action';
    }
  }

  private generatePatternRecommendation(pattern: AnomalyPattern): string {
    switch (pattern.id) {
      case 'latency_spike':
        return 'Check system resources and optimize slow operations';
      case 'error_burst':
        return 'Investigate error logs and fix underlying issues';
      case 'memory_leak':
        return 'Profile memory usage and fix memory leaks';
      case 'coordination_failure':
        return 'Check network connectivity and swarm health';
      case 'token_exhaustion':
        return 'Review token usage patterns and optimize API calls';
      case 'deadlock_pattern':
        return 'Investigate blocked operations and resolve deadlocks';
      default:
        return 'Investigate the detected pattern and take appropriate action';
    }
  }

  private extractAffectedMetrics(pattern: AnomalyPattern): string[] {
    switch (pattern.id) {
      case 'latency_spike':
        return ['latency'];
      case 'error_burst':
        return ['error_rate'];
      case 'memory_leak':
        return ['memory'];
      case 'coordination_failure':
        return ['coordination_latency', 'sync_errors'];
      case 'token_exhaustion':
        return ['token_rate', 'cost'];
      case 'deadlock_pattern':
        return ['progress', 'active_traces'];
      default:
        return [];
    }
  }

  private handleTraceError(event: any): void {
    // Create anomaly for trace errors
    const anomaly: AnomalyEvent = {
      id: `trace-error-${Date.now()}`,
      timestamp: Date.now(),
      type: 'threshold',
      severity: 'high',
      confidence: 0.9,
      description: `Trace error: ${event.error.message}`,
      affectedMetrics: ['error_rate'],
      rootCause: event.error.message,
      recommendation: 'Investigate trace error and fix underlying issues',
      context: {
        observation: {} as RealTimeObservation,
        baseline: {},
        deviation: 1,
        pattern: { traceId: event.traceId }
      },
      resolved: false,
      falsePositive: false
    };

    this.handleDetectedAnomaly(anomaly);
  }

  private updateBaselines(event: any): void {
    // Update baselines with completed trace data
    if (event.duration) {
      this.updateBaseline('trace_duration', event.duration);
    }
  }

  private cleanupOldAnomalies(): void {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days
    
    for (const [id, anomaly] of this.anomalies) {
      if (anomaly.timestamp < cutoff) {
        this.anomalies.delete(id);
      }
    }

    // Cleanup database
    try {
      this.db.prepare('DELETE FROM anomalies WHERE timestamp < ?').run(cutoff);
    } catch (error) {
      console.warn('Failed to cleanup old anomalies:', error);
    }
  }

  private persistAnomaly(anomaly: AnomalyEvent): void {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO anomalies (
          id, timestamp, type, severity, confidence, description, affected_metrics,
          root_cause, recommendation, context, resolved, false_positive, feedback
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        anomaly.id,
        anomaly.timestamp,
        anomaly.type,
        anomaly.severity,
        anomaly.confidence,
        anomaly.description,
        JSON.stringify(anomaly.affectedMetrics),
        anomaly.rootCause,
        anomaly.recommendation,
        JSON.stringify(anomaly.context),
        anomaly.resolved ? 1 : 0,
        anomaly.falsePositive ? 1 : 0,
        anomaly.feedback ? JSON.stringify(anomaly.feedback) : null
      );
    } catch (error) {
      console.warn('Failed to persist anomaly:', error);
    }
  }

  private persistPattern(pattern: AnomalyPattern): void {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO anomaly_patterns (
          id, name, description, detection_logic, thresholds, confidence,
          accuracy, false_positive_rate, last_detection, detection_count, enabled
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        pattern.id,
        pattern.name,
        pattern.description,
        pattern.detectionLogic,
        JSON.stringify(pattern.thresholds),
        pattern.confidence,
        pattern.accuracy,
        pattern.falsePositiveRate,
        pattern.lastDetection,
        pattern.detectionCount,
        pattern.enabled ? 1 : 0
      );
    } catch (error) {
      console.warn('Failed to persist pattern:', error);
    }
  }

  private persistBaseline(baseline: StatisticalBaseline): void {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO statistical_baselines (
          metric, mean, standard_deviation, median, percentile_95, percentile_99,
          trend, last_updated, sample_size
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        baseline.metric,
        baseline.mean,
        baseline.standardDeviation,
        baseline.median,
        baseline.percentile95,
        baseline.percentile99,
        baseline.trend,
        baseline.lastUpdated,
        baseline.sampleSize
      );
    } catch (error) {
      console.warn('Failed to persist baseline:', error);
    }
  }

  // Public API

  getAnomalies(hours: number = 24): AnomalyEvent[] {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    return Array.from(this.anomalies.values())
      .filter(a => a.timestamp > cutoff)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  getPatterns(): AnomalyPattern[] {
    return Array.from(this.patterns.values());
  }

  getBaselines(): StatisticalBaseline[] {
    return Array.from(this.baselines.values());
  }

  provideFeedback(anomalyId: string, feedback: AnomalyFeedback): boolean {
    const anomaly = this.anomalies.get(anomalyId);
    if (!anomaly) return false;

    anomaly.feedback = feedback;
    if (feedback.severity === 'false_positive') {
      anomaly.falsePositive = true;
    }

    this.persistAnomaly(anomaly);
    this.emit('feedback_received', { anomaly, feedback });
    
    return true;
  }

  resolveAnomaly(anomalyId: string, reason: string): boolean {
    const anomaly = this.anomalies.get(anomalyId);
    if (!anomaly) return false;

    anomaly.resolved = true;
    this.persistAnomaly(anomaly);
    this.emit('anomaly_resolved', { anomaly, reason });
    
    return true;
  }

  addCustomPattern(pattern: AnomalyPattern): void {
    this.patterns.set(pattern.id, pattern);
    this.persistPattern(pattern);
    console.log(`Added custom anomaly pattern: ${pattern.name}`);
  }

  enablePattern(patternId: string): boolean {
    const pattern = this.patterns.get(patternId);
    if (pattern) {
      pattern.enabled = true;
      this.persistPattern(pattern);
      return true;
    }
    return false;
  }

  disablePattern(patternId: string): boolean {
    const pattern = this.patterns.get(patternId);
    if (pattern) {
      pattern.enabled = false;
      this.persistPattern(pattern);
      return true;
    }
    return false;
  }

  getDetectionMetrics(): any {
    const recentAnomalies = this.getAnomalies(24);
    const falsePositives = recentAnomalies.filter(a => a.falsePositive).length;
    
    return {
      totalAnomalies: recentAnomalies.length,
      falsePositives,
      falsePositiveRate: recentAnomalies.length > 0 ? falsePositives / recentAnomalies.length : 0,
      patternsEnabled: Array.from(this.patterns.values()).filter(p => p.enabled).length,
      baselinesCount: this.baselines.size,
      mlModelTrainingSize: this.mlModel.getTrainingDataSize(),
      averageAccuracy: Array.from(this.patterns.values()).reduce((sum, p) => sum + p.accuracy, 0) / this.patterns.size
    };
  }

  async shutdown(): Promise<void> {
    if (this.detectionTimer) {
      clearInterval(this.detectionTimer);
    }
    
    this.db.close();
    this.emit('shutdown');
  }
}

// Simple ML Model implementation
class SimpleMLModel {
  private trainingData: { features: MLFeature[]; label: number }[] = [];
  private weights: number[] = [];
  private trained = false;

  addTrainingData(features: MLFeature[], label: number): void {
    this.trainingData.push({ features, label });
    if (this.trainingData.length > 1000) {
      this.trainingData.shift(); // Keep recent data
    }
  }

  train(): void {
    if (this.trainingData.length < 10) return;

    // Simple logistic regression implementation
    const featureCount = this.trainingData[0].features.length;
    this.weights = new Array(featureCount).fill(0);

    // Gradient descent (simplified)
    const learningRate = 0.01;
    const iterations = 100;

    for (let iter = 0; iter < iterations; iter++) {
      for (const data of this.trainingData) {
        const prediction = this.predict(data.features);
        const error = data.label - prediction;

        for (let i = 0; i < featureCount; i++) {
          this.weights[i] += learningRate * error * data.features[i].value;
        }
      }
    }

    this.trained = true;
  }

  predict(features: MLFeature[]): number {
    if (!this.trained || this.weights.length === 0) return 0.5;

    let sum = 0;
    for (let i = 0; i < features.length && i < this.weights.length; i++) {
      sum += this.weights[i] * features[i].value;
    }

    // Sigmoid function
    return 1 / (1 + Math.exp(-sum));
  }

  needsTraining(): boolean {
    return !this.trained && this.trainingData.length >= 10;
  }

  getTrainingDataSize(): number {
    return this.trainingData.length;
  }
}

export { AnomalyDetectionSystem, SimpleMLModel };