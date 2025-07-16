/**
 * Hook Performance Monitor for Swarm Coordination
 * Monitors and optimizes performance of hook-based agent coordination
 */

import { EventEmitter } from 'events';

export class HookPerformanceMonitor extends EventEmitter {
    constructor(hookListeners, communicationProtocols) {
        super();
        this.hookListeners = hookListeners;
        this.communicationProtocols = communicationProtocols;
        this.metrics = new Map();
        this.performanceProfiles = new Map();
        this.alertThresholds = new Map();
        this.monitoringActive = false;
        this.collectInterval = null;
        this.analysisInterval = null;
        
        this.setupDefaultThresholds();
        this.setupPerformanceHooks();
    }

    /**
     * Setup default performance thresholds
     */
    setupDefaultThresholds() {
        this.alertThresholds.set('hook-execution-time', {
            warning: 1000,   // 1 second
            critical: 5000,  // 5 seconds
            unit: 'ms'
        });

        this.alertThresholds.set('message-delivery-time', {
            warning: 2000,   // 2 seconds
            critical: 10000, // 10 seconds
            unit: 'ms'
        });

        this.alertThresholds.set('consensus-duration', {
            warning: 30000,  // 30 seconds
            critical: 120000, // 2 minutes
            unit: 'ms'
        });

        this.alertThresholds.set('agent-response-time', {
            warning: 3000,   // 3 seconds
            critical: 15000, // 15 seconds
            unit: 'ms'
        });

        this.alertThresholds.set('memory-usage', {
            warning: 100,    // 100 MB
            critical: 500,   // 500 MB
            unit: 'MB'
        });

        this.alertThresholds.set('error-rate', {
            warning: 0.05,   // 5%
            critical: 0.15,  // 15%
            unit: 'percentage'
        });

        console.log('⚡ Performance thresholds configured');
    }

    /**
     * Setup performance monitoring hooks
     */
    setupPerformanceHooks() {
        // Hook execution monitoring
        this.hookListeners.registerHook('pre-task', async (data, agentId) => {
            return await this.monitorHookExecution('pre-task', data, agentId);
        });

        this.hookListeners.registerHook('post-task', async (data, agentId) => {
            return await this.monitorHookExecution('post-task', data, agentId);
        });

        this.hookListeners.registerHook('performance-monitor', async (data, agentId) => {
            return await this.handlePerformanceData(data, agentId);
        });

        // Message performance monitoring
        this.communicationProtocols.on('protocol-message-sent', (data) => {
            this.trackMessagePerformance(data);
        });

        this.communicationProtocols.on('message-failed', (data) => {
            this.trackMessageFailure(data);
        });

        console.log('📊 Performance monitoring hooks registered');
    }

    /**
     * Start performance monitoring
     */
    async startMonitoring(interval = 10000) {
        if (this.monitoringActive) return;

        this.monitoringActive = true;
        
        // Start metric collection
        this.collectInterval = setInterval(async () => {
            await this.collectMetrics();
        }, interval);

        // Start performance analysis
        this.analysisInterval = setInterval(async () => {
            await this.analyzePerformance();
        }, interval * 3); // Analyze every 30 seconds

        console.log(`📈 Performance monitoring started (interval: ${interval}ms)`);
        this.emit('monitoring-started', { interval });
    }

    /**
     * Stop performance monitoring
     */
    stopMonitoring() {
        if (!this.monitoringActive) return;

        this.monitoringActive = false;

        if (this.collectInterval) {
            clearInterval(this.collectInterval);
            this.collectInterval = null;
        }

        if (this.analysisInterval) {
            clearInterval(this.analysisInterval);
            this.analysisInterval = null;
        }

        console.log('📉 Performance monitoring stopped');
        this.emit('monitoring-stopped');
    }

    /**
     * Monitor hook execution performance
     */
    async monitorHookExecution(hookType, data, agentId) {
        const startTime = Date.now();
        const executionId = this.generateId('hook-exec');

        try {
            // Track hook start
            this.trackMetric('hook-executions', {
                hookType,
                agentId,
                executionId,
                status: 'started',
                timestamp: new Date().toISOString(),
                startTime
            });

            return {
                executionId,
                startTime,
                hookType,
                agentId
            };
        } catch (error) {
            const duration = Date.now() - startTime;
            
            // Track hook failure
            this.trackMetric('hook-failures', {
                hookType,
                agentId,
                executionId,
                duration,
                error: error.message,
                timestamp: new Date().toISOString()
            });

            throw error;
        }
    }

    /**
     * Handle performance data from hooks
     */
    async handlePerformanceData(data, agentId) {
        const { performanceData, metrics } = data;
        
        // Update agent performance profile
        this.updateAgentProfile(agentId, performanceData, metrics);
        
        // Check for performance issues
        await this.checkPerformanceAlerts(agentId, performanceData);
        
        // Store performance data
        await this.storePerformanceData(agentId, performanceData);
        
        return { processed: true, agentId };
    }

    /**
     * Track message performance
     */
    trackMessagePerformance(messageData) {
        const timestamp = new Date().toISOString();
        
        this.trackMetric('message-performance', {
            ...messageData,
            timestamp,
            deliveryTime: Date.now() // Will be updated when delivery confirms
        });
    }

    /**
     * Track message failures
     */
    trackMessageFailure(failureData) {
        this.trackMetric('message-failures', {
            ...failureData,
            timestamp: new Date().toISOString()
        });

        // Update error rates
        this.updateErrorRate('message-delivery', failureData);
    }

    /**
     * Collect system metrics
     */
    async collectMetrics() {
        const timestamp = new Date().toISOString();
        const activeAgents = this.hookListeners.getActiveAgents();
        
        // System-level metrics
        const systemMetrics = {
            activeAgents: activeAgents.length,
            totalMessages: this.getMetricTotal('message-performance'),
            totalHookExecutions: this.getMetricTotal('hook-executions'),
            errorRate: this.calculateErrorRate(),
            avgResponseTime: this.calculateAverageResponseTime(),
            memoryUsage: process.memoryUsage(),
            timestamp
        };

        this.trackMetric('system-performance', systemMetrics);

        // Agent-level metrics
        for (const agent of activeAgents) {
            const agentMetrics = await this.collectAgentMetrics(agent.id);
            this.trackMetric('agent-performance', {
                agentId: agent.id,
                ...agentMetrics,
                timestamp
            });
        }

        // Communication metrics
        const commMetrics = this.communicationProtocols.getProtocolStats();
        this.trackMetric('communication-performance', {
            ...commMetrics,
            timestamp
        });

        this.emit('metrics-collected', { systemMetrics, timestamp });
    }

    /**
     * Collect metrics for specific agent
     */
    async collectAgentMetrics(agentId) {
        const profile = this.performanceProfiles.get(agentId);
        const agentMessages = this.getMetricsForAgent(agentId, 'message-performance');
        const agentHooks = this.getMetricsForAgent(agentId, 'hook-executions');
        
        return {
            messagesSent: agentMessages.length,
            hooksExecuted: agentHooks.length,
            avgMessageTime: this.calculateAverage(agentMessages, 'deliveryTime'),
            avgHookTime: this.calculateAverage(agentHooks, 'duration'),
            errorCount: this.getMetricsForAgent(agentId, 'hook-failures').length,
            performanceScore: this.calculatePerformanceScore(agentId),
            lastActivity: profile?.lastActivity || null
        };
    }

    /**
     * Analyze performance and detect issues
     */
    async analyzePerformance() {
        const analysis = {
            timestamp: new Date().toISOString(),
            issues: [],
            recommendations: [],
            systemHealth: 'good'
        };

        // Analyze hook execution times
        await this.analyzeHookPerformance(analysis);
        
        // Analyze message delivery performance
        await this.analyzeMessagePerformance(analysis);
        
        // Analyze agent performance
        await this.analyzeAgentPerformance(analysis);
        
        // Analyze consensus performance
        await this.analyzeConsensusPerformance(analysis);
        
        // Determine overall system health
        analysis.systemHealth = this.determineSystemHealth(analysis.issues);
        
        // Store analysis results
        this.trackMetric('performance-analysis', analysis);
        
        // Emit alerts if needed
        if (analysis.issues.length > 0) {
            this.emit('performance-issues', analysis);
        }
        
        // Send recommendations to agents
        if (analysis.recommendations.length > 0) {
            await this.sendPerformanceRecommendations(analysis.recommendations);
        }
        
        return analysis;
    }

    /**
     * Analyze hook execution performance
     */
    async analyzeHookPerformance(analysis) {
        const recentHooks = this.getRecentMetrics('hook-executions', 300000); // Last 5 minutes
        const avgHookTime = this.calculateAverage(recentHooks, 'duration');
        const threshold = this.alertThresholds.get('hook-execution-time');
        
        if (avgHookTime > threshold.critical) {
            analysis.issues.push({
                type: 'critical',
                component: 'hook-execution',
                message: `Average hook execution time (${avgHookTime}ms) exceeds critical threshold (${threshold.critical}ms)`,
                impact: 'high',
                recommendations: [
                    'Optimize hook handlers',
                    'Reduce hook complexity',
                    'Consider parallel execution'
                ]
            });
        } else if (avgHookTime > threshold.warning) {
            analysis.issues.push({
                type: 'warning',
                component: 'hook-execution',
                message: `Average hook execution time (${avgHookTime}ms) exceeds warning threshold (${threshold.warning}ms)`,
                impact: 'medium',
                recommendations: [
                    'Review hook performance',
                    'Monitor for trends'
                ]
            });
        }
    }

    /**
     * Analyze message delivery performance
     */
    async analyzeMessagePerformance(analysis) {
        const recentMessages = this.getRecentMetrics('message-performance', 300000);
        const failedMessages = this.getRecentMetrics('message-failures', 300000);
        const errorRate = failedMessages.length / (recentMessages.length || 1);
        const threshold = this.alertThresholds.get('error-rate');
        
        if (errorRate > threshold.critical) {
            analysis.issues.push({
                type: 'critical',
                component: 'message-delivery',
                message: `Message error rate (${(errorRate * 100).toFixed(2)}%) exceeds critical threshold (${threshold.critical * 100}%)`,
                impact: 'high',
                recommendations: [
                    'Check network connectivity',
                    'Increase retry attempts',
                    'Review routing configuration'
                ]
            });
        }
    }

    /**
     * Analyze agent performance
     */
    async analyzeAgentPerformance(analysis) {
        const activeAgents = this.hookListeners.getActiveAgents();
        const staleAgents = [];
        const slowAgents = [];
        
        for (const agent of activeAgents) {
            const profile = this.performanceProfiles.get(agent.id);
            const score = this.calculatePerformanceScore(agent.id);
            
            // Check for stale agents
            if (profile && profile.lastActivity) {
                const timeSinceActivity = Date.now() - new Date(profile.lastActivity).getTime();
                if (timeSinceActivity > 300000) { // 5 minutes
                    staleAgents.push(agent.id);
                }
            }
            
            // Check for slow agents
            if (score < 0.5) {
                slowAgents.push({ agentId: agent.id, score });
            }
        }
        
        if (staleAgents.length > 0) {
            analysis.issues.push({
                type: 'warning',
                component: 'agent-activity',
                message: `${staleAgents.length} agents appear inactive`,
                impact: 'medium',
                affectedAgents: staleAgents,
                recommendations: [
                    'Check agent health',
                    'Restart inactive agents',
                    'Review heartbeat configuration'
                ]
            });
        }
        
        if (slowAgents.length > 0) {
            analysis.issues.push({
                type: 'warning',
                component: 'agent-performance',
                message: `${slowAgents.length} agents performing below average`,
                impact: 'medium',
                affectedAgents: slowAgents,
                recommendations: [
                    'Optimize agent workflows',
                    'Review resource allocation',
                    'Consider agent rebalancing'
                ]
            });
        }
    }

    /**
     * Analyze consensus performance
     */
    async analyzeConsensusPerformance(analysis) {
        // This would integrate with the consensus manager
        // For now, we'll simulate based on available metrics
        const recentConsensus = this.getRecentMetrics('consensus-performance', 600000); // Last 10 minutes
        
        if (recentConsensus.length > 0) {
            const avgDuration = this.calculateAverage(recentConsensus, 'duration');
            const threshold = this.alertThresholds.get('consensus-duration');
            
            if (avgDuration > threshold.warning) {
                analysis.issues.push({
                    type: 'warning',
                    component: 'consensus',
                    message: `Consensus decisions taking longer than expected (avg: ${avgDuration}ms)`,
                    impact: 'medium',
                    recommendations: [
                        'Review consensus strategy',
                        'Reduce participant count',
                        'Optimize voting process'
                    ]
                });
            }
        }
    }

    /**
     * Send performance recommendations to agents
     */
    async sendPerformanceRecommendations(recommendations) {
        const coordinators = this.hookListeners.getActiveAgents()
            .filter(agent => agent.type === 'coordinator')
            .map(agent => agent.id);
        
        for (const coordinatorId of coordinators) {
            try {
                await this.communicationProtocols.sendProtocolMessage(
                    'performance-monitor',
                    coordinatorId,
                    'performance-optimization',
                    'recommendations',
                    {
                        recommendations,
                        timestamp: new Date().toISOString(),
                        priority: 'medium'
                    }
                );
            } catch (error) {
                console.error(`❌ Failed to send recommendations to ${coordinatorId}:`, error);
            }
        }
    }

    /**
     * Update agent performance profile
     */
    updateAgentProfile(agentId, performanceData, metrics) {
        if (!this.performanceProfiles.has(agentId)) {
            this.performanceProfiles.set(agentId, {
                agentId,
                createdAt: new Date().toISOString(),
                totalOperations: 0,
                totalDuration: 0,
                operations: [],
                averagePerformance: 0
            });
        }
        
        const profile = this.performanceProfiles.get(agentId);
        profile.lastActivity = new Date().toISOString();
        profile.totalOperations++;
        profile.totalDuration += performanceData.duration;
        profile.operations.push(performanceData);
        
        // Keep only recent operations (last 100)
        if (profile.operations.length > 100) {
            profile.operations = profile.operations.slice(-100);
        }
        
        // Update metrics
        if (metrics) {
            profile.averagePerformance = metrics.averageDuration;
            profile.operationTypes = metrics.operationTypes;
        }
    }

    /**
     * Track metric data
     */
    trackMetric(metricType, data) {
        if (!this.metrics.has(metricType)) {
            this.metrics.set(metricType, []);
        }
        
        const metricData = {
            ...data,
            recordedAt: new Date().toISOString()
        };
        
        this.metrics.get(metricType).push(metricData);
        
        // Keep only recent metrics (last 1000 per type)
        const metrics = this.metrics.get(metricType);
        if (metrics.length > 1000) {
            this.metrics.set(metricType, metrics.slice(-1000));
        }
    }

    /**
     * Store performance data persistently
     */
    async storePerformanceData(agentId, performanceData) {
        await this.hookListeners.memoryStore.store(
            `performance:${agentId}:${Date.now()}`,
            performanceData,
            {
                namespace: 'hook-performance',
                metadata: { agentId, operationType: performanceData.operationType }
            }
        );
    }

    /**
     * Check performance alerts
     */
    async checkPerformanceAlerts(agentId, performanceData) {
        const duration = performanceData.duration;
        const thresholds = this.alertThresholds.get('agent-response-time');
        
        if (duration > thresholds.critical) {
            this.emit('performance-alert', {
                type: 'critical',
                agentId,
                metric: 'response-time',
                value: duration,
                threshold: thresholds.critical,
                timestamp: new Date().toISOString()
            });
        } else if (duration > thresholds.warning) {
            this.emit('performance-alert', {
                type: 'warning',
                agentId,
                metric: 'response-time',
                value: duration,
                threshold: thresholds.warning,
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * Utility methods for metric calculations
     */
    getMetricTotal(metricType) {
        const metrics = this.metrics.get(metricType) || [];
        return metrics.length;
    }

    getRecentMetrics(metricType, timeWindow) {
        const metrics = this.metrics.get(metricType) || [];
        const cutoff = Date.now() - timeWindow;
        return metrics.filter(metric => 
            new Date(metric.timestamp || metric.recordedAt).getTime() > cutoff
        );
    }

    getMetricsForAgent(agentId, metricType) {
        const metrics = this.metrics.get(metricType) || [];
        return metrics.filter(metric => metric.agentId === agentId);
    }

    calculateAverage(metrics, field) {
        if (metrics.length === 0) return 0;
        const sum = metrics.reduce((total, metric) => total + (metric[field] || 0), 0);
        return sum / metrics.length;
    }

    calculateErrorRate() {
        const totalMessages = this.getMetricTotal('message-performance');
        const failedMessages = this.getMetricTotal('message-failures');
        return totalMessages > 0 ? failedMessages / totalMessages : 0;
    }

    calculateAverageResponseTime() {
        const recentHooks = this.getRecentMetrics('hook-executions', 300000);
        return this.calculateAverage(recentHooks, 'duration');
    }

    calculatePerformanceScore(agentId) {
        const profile = this.performanceProfiles.get(agentId);
        if (!profile || profile.operations.length === 0) return 1.0;
        
        const recentOps = profile.operations.slice(-10); // Last 10 operations
        const avgDuration = this.calculateAverage(recentOps, 'duration');
        const errorCount = recentOps.filter(op => op.error).length;
        const errorRate = errorCount / recentOps.length;
        
        // Score based on speed and reliability
        const speedScore = Math.max(0, Math.min(1, 1 - (avgDuration / 10000))); // Normalized to 10s max
        const reliabilityScore = 1 - errorRate;
        
        return (speedScore + reliabilityScore) / 2;
    }

    updateErrorRate(component, errorData) {
        this.trackMetric('error-rates', {
            component,
            error: errorData.error || errorData.message,
            timestamp: new Date().toISOString()
        });
    }

    determineSystemHealth(issues) {
        const criticalIssues = issues.filter(issue => issue.type === 'critical').length;
        const warningIssues = issues.filter(issue => issue.type === 'warning').length;
        
        if (criticalIssues > 0) return 'critical';
        if (warningIssues > 2) return 'degraded';
        if (warningIssues > 0) return 'warning';
        return 'good';
    }

    /**
     * Get performance dashboard data
     */
    getPerformanceDashboard() {
        const stats = this.communicationProtocols.getProtocolStats();
        const systemMetrics = this.getRecentMetrics('system-performance', 300000);
        const latestSystem = systemMetrics[systemMetrics.length - 1] || {};
        
        return {
            overview: {
                systemHealth: this.determineSystemHealth([]),
                activeAgents: latestSystem.activeAgents || 0,
                totalMessages: latestSystem.totalMessages || 0,
                errorRate: this.calculateErrorRate(),
                avgResponseTime: this.calculateAverageResponseTime()
            },
            communication: stats,
            agents: Array.from(this.performanceProfiles.values()).map(profile => ({
                agentId: profile.agentId,
                performance: this.calculatePerformanceScore(profile.agentId),
                lastActivity: profile.lastActivity,
                operations: profile.totalOperations
            })),
            recentIssues: this.getRecentMetrics('performance-analysis', 600000)
                .flatMap(analysis => analysis.issues || [])
                .slice(-10)
        };
    }

    generateId(prefix = 'id') {
        return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Cleanup and shutdown
     */
    async cleanup() {
        this.stopMonitoring();
        this.metrics.clear();
        this.performanceProfiles.clear();
        this.alertThresholds.clear();
        this.removeAllListeners();
        console.log('🧹 Hook Performance Monitor cleaned up');
    }
}

export default HookPerformanceMonitor;