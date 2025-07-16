/**
 * Agent Communication Protocols
 * Implements standardized communication patterns for swarm coordination
 */

import { EventEmitter } from 'events';

export class AgentCommunicationProtocols extends EventEmitter {
    constructor(hookListeners) {
        super();
        this.hookListeners = hookListeners;
        this.protocols = new Map();
        this.messageHandlers = new Map();
        this.routingTable = new Map();
        this.messageQueue = new Map();
        this.retryQueue = new Map();
        
        this.setupStandardProtocols();
    }

    /**
     * Setup standard communication protocols
     */
    setupStandardProtocols() {
        // Task coordination protocol
        this.registerProtocol('task-coordination', {
            messageTypes: ['task-request', 'task-accept', 'task-reject', 'task-progress', 'task-complete'],
            requiredFields: ['taskId', 'type', 'payload'],
            timeout: 30000,
            retryAttempts: 3
        });

        // Consensus protocol
        this.registerProtocol('consensus', {
            messageTypes: ['consensus-propose', 'consensus-vote', 'consensus-result'],
            requiredFields: ['consensusId', 'type', 'payload'],
            timeout: 300000, // 5 minutes
            retryAttempts: 2
        });

        // Resource sharing protocol
        this.registerProtocol('resource-sharing', {
            messageTypes: ['resource-request', 'resource-offer', 'resource-transfer', 'resource-release'],
            requiredFields: ['resourceId', 'type', 'payload'],
            timeout: 60000,
            retryAttempts: 5
        });

        // Health monitoring protocol
        this.registerProtocol('health-monitoring', {
            messageTypes: ['health-check', 'health-response', 'health-alert'],
            requiredFields: ['type', 'payload'],
            timeout: 10000,
            retryAttempts: 1
        });

        // Knowledge sharing protocol
        this.registerProtocol('knowledge-sharing', {
            messageTypes: ['knowledge-share', 'knowledge-request', 'knowledge-update'],
            requiredFields: ['knowledgeId', 'type', 'payload'],
            timeout: 45000,
            retryAttempts: 3
        });

        console.log('📋 Standard communication protocols registered');
    }

    /**
     * Register a new communication protocol
     */
    registerProtocol(protocolName, config) {
        this.protocols.set(protocolName, {
            ...config,
            registeredAt: new Date().toISOString()
        });

        // Setup message handlers for this protocol
        for (const messageType of config.messageTypes) {
            if (!this.messageHandlers.has(messageType)) {
                this.messageHandlers.set(messageType, []);
            }
        }

        console.log(`📝 Protocol registered: ${protocolName}`);
    }

    /**
     * Register message handler for specific message type
     */
    registerMessageHandler(messageType, handler, agentId = null) {
        if (!this.messageHandlers.has(messageType)) {
            this.messageHandlers.set(messageType, []);
        }

        this.messageHandlers.get(messageType).push({
            handler,
            agentId,
            registeredAt: new Date().toISOString()
        });

        console.log(`🔗 Message handler registered: ${messageType} for agent: ${agentId || 'all'}`);
    }

    /**
     * Send protocol message with validation and routing
     */
    async sendProtocolMessage(fromAgentId, toAgentId, protocol, messageType, payload, options = {}) {
        // Validate protocol exists
        const protocolConfig = this.protocols.get(protocol);
        if (!protocolConfig) {
            throw new Error(`Unknown protocol: ${protocol}`);
        }

        // Validate message type
        if (!protocolConfig.messageTypes.includes(messageType)) {
            throw new Error(`Invalid message type ${messageType} for protocol ${protocol}`);
        }

        // Create standardized message
        const message = {
            id: this.generateMessageId(),
            protocol,
            type: messageType,
            payload,
            timestamp: new Date().toISOString(),
            timeout: options.timeout || protocolConfig.timeout,
            retryAttempts: options.retryAttempts || protocolConfig.retryAttempts,
            priority: options.priority || 'normal',
            metadata: options.metadata || {}
        };

        // Validate required fields
        for (const field of protocolConfig.requiredFields) {
            if (!(field in message) && !(field in payload)) {
                throw new Error(`Missing required field: ${field}`);
            }
        }

        try {
            // Route and send message
            const result = await this.routeMessage(fromAgentId, toAgentId, message);
            console.log(`📨 Protocol message sent: ${protocol}/${messageType} (${fromAgentId} → ${toAgentId})`);
            
            this.emit('protocol-message-sent', {
                fromAgentId,
                toAgentId,
                protocol,
                messageType,
                messageId: message.id
            });

            return result;
        } catch (error) {
            console.error(`❌ Failed to send protocol message:`, error);
            throw error;
        }
    }

    /**
     * Route message based on routing table and agent availability
     */
    async routeMessage(fromAgentId, toAgentId, message) {
        // Check if direct routing is possible
        if (await this.isAgentAvailable(toAgentId)) {
            return await this.deliverMessage(fromAgentId, toAgentId, message);
        }

        // Check routing table for alternative routes
        const route = this.routingTable.get(toAgentId);
        if (route && route.proxy) {
            console.log(`🔄 Routing via proxy: ${toAgentId} → ${route.proxy}`);
            message.metadata.originalTarget = toAgentId;
            message.metadata.routedVia = route.proxy;
            return await this.deliverMessage(fromAgentId, route.proxy, message);
        }

        // Queue message for later delivery
        await this.queueMessage(toAgentId, message);
        console.log(`📮 Message queued for offline agent: ${toAgentId}`);
        
        return { queued: true, messageId: message.id };
    }

    /**
     * Deliver message to target agent
     */
    async deliverMessage(fromAgentId, toAgentId, message) {
        try {
            // Use hook listeners to send message
            const result = await this.hookListeners.sendMessage(fromAgentId, toAgentId, message, message.priority);
            
            // Execute message handlers
            await this.executeMessageHandlers(message.type, message, toAgentId);
            
            return result;
        } catch (error) {
            // Add to retry queue if delivery fails
            await this.addToRetryQueue(fromAgentId, toAgentId, message);
            throw error;
        }
    }

    /**
     * Execute message handlers for specific message type
     */
    async executeMessageHandlers(messageType, message, targetAgentId) {
        const handlers = this.messageHandlers.get(messageType) || [];
        const relevantHandlers = handlers.filter(h => 
            !h.agentId || h.agentId === targetAgentId
        );

        for (const handlerInfo of relevantHandlers) {
            try {
                await handlerInfo.handler(message, targetAgentId);
            } catch (error) {
                console.error(`❌ Message handler failed for ${messageType}:`, error);
            }
        }
    }

    /**
     * Task Coordination Protocol Implementation
     */
    async requestTask(fromAgentId, toAgentId, taskDetails) {
        return await this.sendProtocolMessage(
            fromAgentId,
            toAgentId,
            'task-coordination',
            'task-request',
            {
                taskId: taskDetails.taskId || this.generateId('task'),
                description: taskDetails.description,
                requirements: taskDetails.requirements || [],
                deadline: taskDetails.deadline,
                priority: taskDetails.priority || 'medium'
            }
        );
    }

    async acceptTask(fromAgentId, toAgentId, taskId, estimatedDuration = null) {
        return await this.sendProtocolMessage(
            fromAgentId,
            toAgentId,
            'task-coordination',
            'task-accept',
            {
                taskId,
                estimatedDuration,
                acceptedAt: new Date().toISOString()
            }
        );
    }

    async rejectTask(fromAgentId, toAgentId, taskId, reason) {
        return await this.sendProtocolMessage(
            fromAgentId,
            toAgentId,
            'task-coordination',
            'task-reject',
            {
                taskId,
                reason,
                rejectedAt: new Date().toISOString()
            }
        );
    }

    async reportTaskProgress(fromAgentId, toAgentId, taskId, progress) {
        return await this.sendProtocolMessage(
            fromAgentId,
            toAgentId,
            'task-coordination',
            'task-progress',
            {
                taskId,
                progress: {
                    percentage: progress.percentage || 0,
                    description: progress.description,
                    milestone: progress.milestone,
                    blockers: progress.blockers || []
                },
                reportedAt: new Date().toISOString()
            }
        );
    }

    async completeTask(fromAgentId, toAgentId, taskId, results) {
        return await this.sendProtocolMessage(
            fromAgentId,
            toAgentId,
            'task-coordination',
            'task-complete',
            {
                taskId,
                results,
                completedAt: new Date().toISOString()
            }
        );
    }

    /**
     * Resource Sharing Protocol Implementation
     */
    async requestResource(fromAgentId, toAgentId, resourceType, requirements) {
        return await this.sendProtocolMessage(
            fromAgentId,
            toAgentId,
            'resource-sharing',
            'resource-request',
            {
                resourceId: this.generateId('resource-req'),
                resourceType,
                requirements,
                requestedAt: new Date().toISOString()
            }
        );
    }

    async offerResource(fromAgentId, toAgentId, resourceId, resourceData) {
        return await this.sendProtocolMessage(
            fromAgentId,
            toAgentId,
            'resource-sharing',
            'resource-offer',
            {
                resourceId,
                resourceData,
                availableUntil: resourceData.availableUntil,
                offeredAt: new Date().toISOString()
            }
        );
    }

    /**
     * Knowledge Sharing Protocol Implementation
     */
    async shareKnowledge(fromAgentId, toAgentId, knowledgeData) {
        return await this.sendProtocolMessage(
            fromAgentId,
            toAgentId,
            'knowledge-sharing',
            'knowledge-share',
            {
                knowledgeId: knowledgeData.id || this.generateId('knowledge'),
                domain: knowledgeData.domain,
                content: knowledgeData.content,
                confidence: knowledgeData.confidence || 1.0,
                source: knowledgeData.source,
                sharedAt: new Date().toISOString()
            }
        );
    }

    async requestKnowledge(fromAgentId, toAgentId, domain, query) {
        return await this.sendProtocolMessage(
            fromAgentId,
            toAgentId,
            'knowledge-sharing',
            'knowledge-request',
            {
                knowledgeId: this.generateId('knowledge-req'),
                domain,
                query,
                requestedAt: new Date().toISOString()
            }
        );
    }

    /**
     * Health Monitoring Protocol Implementation
     */
    async sendHealthCheck(fromAgentId, toAgentId) {
        return await this.sendProtocolMessage(
            fromAgentId,
            toAgentId,
            'health-monitoring',
            'health-check',
            {
                checkId: this.generateId('health-check'),
                sentAt: new Date().toISOString()
            }
        );
    }

    async sendHealthResponse(fromAgentId, toAgentId, checkId, healthData) {
        return await this.sendProtocolMessage(
            fromAgentId,
            toAgentId,
            'health-monitoring',
            'health-response',
            {
                checkId,
                health: healthData,
                respondedAt: new Date().toISOString()
            }
        );
    }

    /**
     * Utility methods
     */
    async isAgentAvailable(agentId) {
        const agents = this.hookListeners.getActiveAgents();
        return agents.some(agent => agent.id === agentId && agent.status === 'active');
    }

    async queueMessage(agentId, message) {
        if (!this.messageQueue.has(agentId)) {
            this.messageQueue.set(agentId, []);
        }
        this.messageQueue.get(agentId).push(message);
    }

    async addToRetryQueue(fromAgentId, toAgentId, message) {
        const retryKey = `${fromAgentId}-${toAgentId}-${message.id}`;
        this.retryQueue.set(retryKey, {
            fromAgentId,
            toAgentId,
            message,
            attempts: 0,
            nextRetry: Date.now() + 5000 // 5 seconds
        });
    }

    generateMessageId() {
        return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    generateId(prefix = 'id') {
        return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Process retry queue
     */
    async processRetryQueue() {
        const now = Date.now();
        
        for (const [retryKey, retryInfo] of this.retryQueue) {
            if (now >= retryInfo.nextRetry && retryInfo.attempts < retryInfo.message.retryAttempts) {
                try {
                    await this.deliverMessage(retryInfo.fromAgentId, retryInfo.toAgentId, retryInfo.message);
                    this.retryQueue.delete(retryKey);
                    console.log(`✅ Message retry successful: ${retryKey}`);
                } catch (error) {
                    retryInfo.attempts++;
                    retryInfo.nextRetry = now + (5000 * Math.pow(2, retryInfo.attempts)); // Exponential backoff
                    
                    if (retryInfo.attempts >= retryInfo.message.retryAttempts) {
                        this.retryQueue.delete(retryKey);
                        console.error(`❌ Message retry failed permanently: ${retryKey}`);
                        this.emit('message-failed', retryInfo);
                    }
                }
            }
        }
    }

    /**
     * Start retry processor
     */
    startRetryProcessor() {
        this.retryInterval = setInterval(() => {
            this.processRetryQueue().catch(console.error);
        }, 10000); // Check every 10 seconds
    }

    /**
     * Stop retry processor
     */
    stopRetryProcessor() {
        if (this.retryInterval) {
            clearInterval(this.retryInterval);
            this.retryInterval = null;
        }
    }

    /**
     * Get protocol statistics
     */
    getProtocolStats() {
        return {
            registeredProtocols: this.protocols.size,
            messageHandlers: this.messageHandlers.size,
            queuedMessages: Array.from(this.messageQueue.values()).reduce((sum, queue) => sum + queue.length, 0),
            retryQueueSize: this.retryQueue.size
        };
    }

    /**
     * Cleanup
     */
    async cleanup() {
        this.stopRetryProcessor();
        this.protocols.clear();
        this.messageHandlers.clear();
        this.routingTable.clear();
        this.messageQueue.clear();
        this.retryQueue.clear();
        this.removeAllListeners();
        console.log('🧹 Agent Communication Protocols cleaned up');
    }
}

export default AgentCommunicationProtocols;