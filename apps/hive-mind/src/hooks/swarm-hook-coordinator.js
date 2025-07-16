/**
 * Swarm Hook Coordinator
 * Main integration layer for hook-based agent coordination system
 */

import { EventEmitter } from 'events';
import AgentHookListeners from './agent-hook-listeners.js';
import AgentCommunicationProtocols from '../communication/agent-protocols.js';
import HookConsensusManager from '../consensus/hook-consensus-manager.js';
import HookPerformanceMonitor from '../monitoring/hook-performance-monitor.js';

export class SwarmHookCoordinator extends EventEmitter {
    constructor(options = {}) {
        super();
        this.options = {
            autoStart: true,
            performanceMonitoring: true,
            consensusEnabled: true,
            heartbeatInterval: 30000, // 30 seconds
            ...options
        };
        
        this.initialized = false;
        this.components = {};
        this.agentRegistry = new Map();
        this.systemStats = {
            startedAt: null,
            totalOperations: 0,
            totalMessages: 0,
            totalConsensus: 0,
            uptime: 0
        };
        
        this.heartbeatInterval = null;
    }

    /**
     * Initialize the swarm hook coordination system
     */
    async initialize() {
        if (this.initialized) {
            console.log('🔄 Swarm Hook Coordinator already initialized');
            return;
        }

        console.log('🚀 Initializing Swarm Hook Coordinator...');
        
        try {
            // Initialize core components in dependency order
            await this.initializeHookListeners();
            await this.initializeCommunicationProtocols();
            await this.initializeConsensusManager();
            await this.initializePerformanceMonitor();
            
            // Setup inter-component communication
            this.setupComponentIntegration();
            
            // Start background services
            if (this.options.autoStart) {
                await this.startServices();
            }
            
            this.initialized = true;
            this.systemStats.startedAt = new Date().toISOString();
            
            console.log('✅ Swarm Hook Coordinator initialized successfully');
            this.emit('initialized', this.getSystemStatus());
            
        } catch (error) {
            console.error('❌ Failed to initialize Swarm Hook Coordinator:', error);
            throw error;
        }
    }

    /**
     * Initialize hook listeners component
     */
    async initializeHookListeners() {
        this.components.hookListeners = new AgentHookListeners();
        await this.components.hookListeners.initialize();
        
        // Setup event forwarding
        this.components.hookListeners.on('agent-connected', (data) => {
            this.handleAgentConnected(data);
        });
        
        this.components.hookListeners.on('agent-stale', (data) => {
            this.handleAgentStale(data);
        });
        
        console.log('🔌 Hook Listeners initialized');
    }

    /**
     * Initialize communication protocols component
     */
    async initializeCommunicationProtocols() {
        this.components.communicationProtocols = new AgentCommunicationProtocols(
            this.components.hookListeners
        );
        
        // Setup event forwarding
        this.components.communicationProtocols.on('protocol-message-sent', (data) => {
            this.systemStats.totalMessages++;
            this.emit('message-sent', data);
        });
        
        this.components.communicationProtocols.on('message-failed', (data) => {
            this.emit('message-failed', data);
        });
        
        // Start retry processor
        this.components.communicationProtocols.startRetryProcessor();
        
        console.log('📡 Communication Protocols initialized');
    }

    /**
     * Initialize consensus manager component
     */
    async initializeConsensusManager() {
        if (!this.options.consensusEnabled) {
            console.log('🗳️ Consensus Manager disabled by configuration');
            return;
        }
        
        this.components.consensusManager = new HookConsensusManager(
            this.components.hookListeners,
            this.components.communicationProtocols
        );
        
        // Setup event forwarding
        this.components.consensusManager.on('consensus-initiated', (data) => {
            this.systemStats.totalConsensus++;
            this.emit('consensus-initiated', data);
        });
        
        this.components.consensusManager.on('consensus-finalized', (data) => {
            this.emit('consensus-finalized', data);
        });
        
        this.components.consensusManager.on('consensus-timeout', (data) => {
            this.emit('consensus-timeout', data);
        });
        
        console.log('🗳️ Consensus Manager initialized');
    }

    /**
     * Initialize performance monitor component
     */
    async initializePerformanceMonitor() {
        if (!this.options.performanceMonitoring) {
            console.log('📊 Performance Monitor disabled by configuration');
            return;
        }
        
        this.components.performanceMonitor = new HookPerformanceMonitor(
            this.components.hookListeners,
            this.components.communicationProtocols
        );
        
        // Setup event forwarding
        this.components.performanceMonitor.on('performance-alert', (data) => {
            this.handlePerformanceAlert(data);
        });
        
        this.components.performanceMonitor.on('performance-issues', (data) => {
            this.handlePerformanceIssues(data);
        });
        
        console.log('📊 Performance Monitor initialized');
    }

    /**
     * Setup integration between components
     */
    setupComponentIntegration() {
        // Hook listeners integration
        const { hookListeners, communicationProtocols, consensusManager, performanceMonitor } = this.components;
        
        // Agent registration integration
        hookListeners.on('agent-connected', async (agentData) => {
            this.agentRegistry.set(agentData.id, {
                ...agentData,
                registeredAt: new Date().toISOString(),
                messageCount: 0,
                consensusParticipation: 0,
                performanceScore: 1.0
            });
            
            // Notify other agents of new connection
            if (communicationProtocols) {
                await communicationProtocols.broadcastMessage('system', {
                    type: 'agent-joined',
                    agentData,
                    timestamp: new Date().toISOString()
                });
            }
        });
        
        // Performance integration with consensus
        if (performanceMonitor && consensusManager) {
            performanceMonitor.on('performance-alert', async (alertData) => {
                // If performance is critical, initiate consensus for remediation
                if (alertData.type === 'critical') {
                    await this.initiatePerformanceConsensus(alertData);
                }
            });
        }
        
        // Message tracking integration
        if (communicationProtocols) {
            communicationProtocols.on('protocol-message-sent', (data) => {
                const agent = this.agentRegistry.get(data.fromAgentId);
                if (agent) {
                    agent.messageCount++;
                    agent.lastActivity = new Date().toISOString();
                }
            });
        }
        
        console.log('🔗 Component integration setup complete');
    }

    /**
     * Start background services
     */
    async startServices() {
        // Start performance monitoring
        if (this.components.performanceMonitor) {
            await this.components.performanceMonitor.startMonitoring();
        }
        
        // Start agent health monitoring
        this.startHealthMonitoring();
        
        console.log('🎯 Background services started');
    }

    /**
     * Start agent health monitoring
     */
    startHealthMonitoring() {
        this.heartbeatInterval = setInterval(async () => {
            await this.performHealthCheck();
        }, this.options.heartbeatInterval);
        
        console.log(`💓 Health monitoring started (interval: ${this.options.heartbeatInterval}ms)`);
    }

    /**
     * Register an agent with the coordination system
     */
    async registerAgent(agentId, agentType, capabilities = [], metadata = {}) {
        try {
            const agentData = await this.components.hookListeners.setupAgentCommunication(
                agentId,
                agentType,
                capabilities
            );
            
            // Enhanced registration data
            const registrationData = {
                ...agentData,
                metadata,
                registeredVia: 'coordinator',
                coordinatorVersion: '1.0.0'
            };
            
            this.agentRegistry.set(agentId, registrationData);
            
            console.log(`🤖 Agent registered: ${agentId} (${agentType})`);
            this.emit('agent-registered', registrationData);
            
            return registrationData;
        } catch (error) {
            console.error(`❌ Failed to register agent ${agentId}:`, error);
            throw error;
        }
    }

    /**
     * Coordinate a task across multiple agents
     */
    async coordinateTask(taskId, taskDescription, requirements = {}) {
        this.systemStats.totalOperations++;
        
        try {
            // Select appropriate agents for the task
            const selectedAgents = await this.selectAgentsForTask(requirements);
            
            if (selectedAgents.length === 0) {
                throw new Error('No suitable agents available for task');
            }
            
            // Initiate task coordination
            const coordination = {
                taskId,
                description: taskDescription,
                requirements,
                selectedAgents,
                status: 'initiated',
                startedAt: new Date().toISOString()
            };
            
            // Send task requests to selected agents
            const taskPromises = selectedAgents.map(async (agentId) => {
                return await this.components.communicationProtocols.requestTask(
                    'coordinator',
                    agentId,
                    {
                        taskId,
                        description: taskDescription,
                        requirements,
                        deadline: requirements.deadline,
                        priority: requirements.priority || 'medium'
                    }
                );
            });
            
            const results = await Promise.allSettled(taskPromises);
            coordination.taskResults = results;
            coordination.status = 'coordinated';
            coordination.completedAt = new Date().toISOString();
            
            console.log(`📋 Task coordinated: ${taskId} with ${selectedAgents.length} agents`);
            this.emit('task-coordinated', coordination);
            
            return coordination;
        } catch (error) {
            console.error(`❌ Task coordination failed for ${taskId}:`, error);
            throw error;
        }
    }

    /**
     * Select agents for a task based on requirements
     */
    async selectAgentsForTask(requirements) {
        const activeAgents = this.components.hookListeners.getActiveAgents();
        const selectedAgents = [];
        
        for (const agent of activeAgents) {
            let score = 1.0;
            
            // Check required capabilities
            if (requirements.requiredCapabilities) {
                const hasCapabilities = requirements.requiredCapabilities.every(cap => 
                    agent.capabilities.includes(cap)
                );
                if (!hasCapabilities) continue;
                score += 0.5;
            }
            
            // Check agent type preference
            if (requirements.preferredTypes && requirements.preferredTypes.includes(agent.type)) {
                score += 0.3;
            }
            
            // Consider performance score
            const agentInfo = this.agentRegistry.get(agent.id);
            if (agentInfo) {
                score *= agentInfo.performanceScore;
            }
            
            selectedAgents.push({ agentId: agent.id, score });
        }
        
        // Sort by score and select top agents
        selectedAgents.sort((a, b) => b.score - a.score);
        const maxAgents = requirements.maxAgents || Math.min(3, selectedAgents.length);
        
        return selectedAgents.slice(0, maxAgents).map(item => item.agentId);
    }

    /**
     * Initiate consensus for performance issues
     */
    async initiatePerformanceConsensus(alertData) {
        if (!this.components.consensusManager) return;
        
        try {
            const consensus = await this.components.consensusManager.initiateHookConsensus(
                'performance-monitor',
                {
                    type: 'performance-remediation',
                    alert: alertData,
                    proposedActions: [
                        'restart-agent',
                        'redistribute-load',
                        'optimize-configuration',
                        'escalate-to-admin'
                    ]
                },
                {
                    strategy: 'majority',
                    participants: this.getCoordinatorAgents()
                }
            );
            
            console.log(`🗳️ Performance consensus initiated: ${consensus.id}`);
            return consensus;
        } catch (error) {
            console.error('❌ Failed to initiate performance consensus:', error);
        }
    }

    /**
     * Handle agent connection events
     */
    handleAgentConnected(agentData) {
        console.log(`🔗 Agent connected: ${agentData.id}`);
        this.emit('agent-connected', agentData);
    }

    /**
     * Handle stale agent detection
     */
    handleAgentStale(data) {
        console.log(`⚠️ Agent stale: ${data.agentId}`);
        
        // Update agent status in registry
        const agent = this.agentRegistry.get(data.agentId);
        if (agent) {
            agent.status = 'stale';
            agent.staleDetectedAt = new Date().toISOString();
        }
        
        this.emit('agent-stale', data);
    }

    /**
     * Handle performance alerts
     */
    handlePerformanceAlert(alertData) {
        console.log(`⚡ Performance alert: ${alertData.type} - ${alertData.metric}`);
        this.emit('performance-alert', alertData);
    }

    /**
     * Handle performance issues
     */
    handlePerformanceIssues(issuesData) {
        console.log(`📊 Performance issues detected: ${issuesData.issues.length} issues`);
        
        // Update system health status
        this.systemStats.lastHealthCheck = new Date().toISOString();
        this.systemStats.systemHealth = issuesData.systemHealth;
        
        this.emit('performance-issues', issuesData);
    }

    /**
     * Perform health check on all agents
     */
    async performHealthCheck() {
        try {
            await this.components.hookListeners.monitorAgentHealth();
            
            // Update system uptime
            if (this.systemStats.startedAt) {
                this.systemStats.uptime = Date.now() - new Date(this.systemStats.startedAt).getTime();
            }
            
            // Get agent health status
            const activeAgents = this.components.hookListeners.getActiveAgents();
            const staleAgents = activeAgents.filter(agent => agent.status === 'stale');
            
            if (staleAgents.length > 0) {
                console.log(`⚠️ Health check: ${staleAgents.length} stale agents detected`);
            }
            
            this.emit('health-check-completed', {
                totalAgents: activeAgents.length,
                staleAgents: staleAgents.length,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('❌ Health check failed:', error);
        }
    }

    /**
     * Get coordinator agents for system decisions
     */
    getCoordinatorAgents() {
        return Array.from(this.agentRegistry.values())
            .filter(agent => agent.type === 'coordinator' && agent.status === 'active')
            .map(agent => agent.id);
    }

    /**
     * Get system status and statistics
     */
    getSystemStatus() {
        const activeAgents = this.components.hookListeners?.getActiveAgents() || [];
        const consensusStats = this.components.consensusManager?.getConsensusStats() || {};
        const communicationStats = this.components.communicationProtocols?.getProtocolStats() || {};
        const performanceDashboard = this.components.performanceMonitor?.getPerformanceDashboard() || {};
        
        return {
            initialized: this.initialized,
            systemStats: this.systemStats,
            agents: {
                total: this.agentRegistry.size,
                active: activeAgents.length,
                stale: activeAgents.filter(a => a.status === 'stale').length
            },
            consensus: consensusStats,
            communication: communicationStats,
            performance: performanceDashboard,
            components: {
                hookListeners: !!this.components.hookListeners,
                communicationProtocols: !!this.components.communicationProtocols,
                consensusManager: !!this.components.consensusManager,
                performanceMonitor: !!this.components.performanceMonitor
            }
        };
    }

    /**
     * Shutdown the coordination system
     */
    async shutdown() {
        console.log('🔽 Shutting down Swarm Hook Coordinator...');
        
        try {
            // Stop health monitoring
            if (this.heartbeatInterval) {
                clearInterval(this.heartbeatInterval);
                this.heartbeatInterval = null;
            }
            
            // Shutdown components in reverse order
            if (this.components.performanceMonitor) {
                await this.components.performanceMonitor.cleanup();
            }
            
            if (this.components.consensusManager) {
                await this.components.consensusManager.cleanup();
            }
            
            if (this.components.communicationProtocols) {
                await this.components.communicationProtocols.cleanup();
            }
            
            if (this.components.hookListeners) {
                await this.components.hookListeners.shutdown();
            }
            
            // Clear state
            this.agentRegistry.clear();
            this.components = {};
            this.initialized = false;
            
            console.log('✅ Swarm Hook Coordinator shutdown complete');
            this.emit('shutdown');
            
        } catch (error) {
            console.error('❌ Error during shutdown:', error);
            throw error;
        }
    }
}

export default SwarmHookCoordinator;