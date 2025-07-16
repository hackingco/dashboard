/**
 * Agent Hook Listeners for Swarm Coordination
 * Implements inter-agent communication and coordination through hooks
 */

import { EventEmitter } from 'events';
import { SqliteMemoryStore } from '../memory/sqlite-store.js';
import { LangfuseTracer } from '../tracing/langfuse-wrapper.js';

class AgentHookListeners extends EventEmitter {
    constructor() {
        super();
        this.memoryStore = null;
        this.agents = new Map();
        this.activeOperations = new Map();
        this.consensusVotes = new Map();
        this.performanceMetrics = new Map();
        this.hooks = {
            'pre-task': [],
            'post-task': [],
            'pre-edit': [],
            'post-edit': [],
            'agent-spawn': [],
            'agent-consensus': [],
            'performance-monitor': []
        };
    }

    async initialize() {
        if (!this.memoryStore) {
            this.memoryStore = new SqliteMemoryStore();
            await this.memoryStore.initialize();
        }
        console.log('🔌 Agent Hook Listeners initialized');
    }

    /**
     * Register a hook listener for specific agent events
     */
    registerHook(eventType, handler, agentId = null) {
        if (!this.hooks[eventType]) {
            this.hooks[eventType] = [];
        }
        
        this.hooks[eventType].push({
            handler,
            agentId,
            registeredAt: new Date().toISOString()
        });

        console.log(`🔗 Registered hook listener: ${eventType} for agent: ${agentId || 'all'}`);
    }

    /**
     * Execute hooks for a specific event type
     */
    async executeHooks(eventType, data, agentId = null) {
        const hooks = this.hooks[eventType] || [];
        const relevantHooks = hooks.filter(hook => 
            !hook.agentId || hook.agentId === agentId
        );

        const results = [];
        for (const hook of relevantHooks) {
            try {
                const result = await hook.handler(data, agentId);
                results.push({ success: true, result });
            } catch (error) {
                console.error(`❌ Hook execution failed for ${eventType}:`, error);
                results.push({ success: false, error: error.message });
            }
        }

        return results;
    }

    /**
     * Agent Communication Channel Setup
     */
    async setupAgentCommunication(agentId, agentType, capabilities) {
        const agentData = {
            id: agentId,
            type: agentType,
            capabilities,
            status: 'active',
            connectedAt: new Date().toISOString(),
            lastHeartbeat: new Date().toISOString(),
            messageQueue: [],
            coordinationData: {}
        };

        this.agents.set(agentId, agentData);

        // Store in memory for persistence
        await this.memoryStore.store(`agent:${agentId}`, agentData, {
            namespace: 'agents',
            metadata: { type: agentType, capabilities }
        });

        // Execute agent spawn hooks
        await this.executeHooks('agent-spawn', agentData, agentId);

        console.log(`🤖 Agent communication setup: ${agentId} (${agentType})`);
        this.emit('agent-connected', agentData);

        return agentData;
    }

    /**
     * Inter-Agent Message Passing
     */
    async sendMessage(fromAgentId, toAgentId, message, priority = 'normal') {
        const messageData = {
            id: this.generateId('msg'),
            from: fromAgentId,
            to: toAgentId,
            message,
            priority,
            timestamp: new Date().toISOString(),
            status: 'pending'
        };

        // Store message in recipient's queue
        const recipient = this.agents.get(toAgentId);
        if (recipient) {
            recipient.messageQueue.push(messageData);
            recipient.lastActivity = new Date().toISOString();
            
            // Store in memory
            await this.memoryStore.store(`message:${messageData.id}`, messageData, {
                namespace: 'messages',
                metadata: { from: fromAgentId, to: toAgentId, priority }
            });

            console.log(`📨 Message sent: ${fromAgentId} → ${toAgentId}`);
            this.emit('message-sent', messageData);
            
            return messageData;
        } else {
            throw new Error(`Agent ${toAgentId} not found`);
        }
    }

    /**
     * Broadcast message to all agents or specific group
     */
    async broadcastMessage(fromAgentId, message, agentFilter = null) {
        const broadcasts = [];
        
        for (const [agentId, agent] of this.agents) {
            if (agentId === fromAgentId) continue; // Don't send to self
            
            if (!agentFilter || agentFilter(agent)) {
                const broadcast = await this.sendMessage(fromAgentId, agentId, {
                    ...message,
                    type: 'broadcast'
                }, 'high');
                broadcasts.push(broadcast);
            }
        }

        console.log(`📡 Broadcast sent from ${fromAgentId} to ${broadcasts.length} agents`);
        return broadcasts;
    }

    /**
     * Get messages for an agent
     */
    async getMessages(agentId, unreadOnly = true) {
        const agent = this.agents.get(agentId);
        if (!agent) return [];

        let messages = agent.messageQueue;
        if (unreadOnly) {
            messages = messages.filter(msg => msg.status === 'pending');
        }

        // Mark as read
        agent.messageQueue.forEach(msg => {
            if (msg.status === 'pending') {
                msg.status = 'read';
                msg.readAt = new Date().toISOString();
            }
        });

        return messages;
    }

    /**
     * Consensus Mechanism Implementation
     */
    async initiateConsensus(proposerId, proposal, participantIds) {
        const consensusId = this.generateId('consensus');
        const consensusData = {
            id: consensusId,
            proposer: proposerId,
            proposal,
            participants: participantIds,
            votes: {},
            status: 'voting',
            createdAt: new Date().toISOString(),
            deadline: new Date(Date.now() + 300000).toISOString() // 5 minutes
        };

        this.consensusVotes.set(consensusId, consensusData);

        // Store in memory
        await this.memoryStore.store(`consensus:${consensusId}`, consensusData, {
            namespace: 'consensus',
            metadata: { proposer: proposerId, participants: participantIds.length }
        });

        // Notify participants
        const notification = {
            type: 'consensus-request',
            consensusId,
            proposal,
            proposer: proposerId,
            deadline: consensusData.deadline
        };

        for (const participantId of participantIds) {
            await this.sendMessage(proposerId, participantId, notification, 'critical');
        }

        // Execute consensus hooks
        await this.executeHooks('agent-consensus', consensusData);

        console.log(`🗳️ Consensus initiated: ${consensusId} with ${participantIds.length} participants`);
        this.emit('consensus-initiated', consensusData);

        return consensusData;
    }

    /**
     * Cast vote in consensus
     */
    async castVote(consensusId, agentId, vote, reasoning = '') {
        const consensus = this.consensusVotes.get(consensusId);
        if (!consensus) {
            throw new Error(`Consensus ${consensusId} not found`);
        }

        if (consensus.status !== 'voting') {
            throw new Error(`Consensus ${consensusId} is not accepting votes`);
        }

        if (!consensus.participants.includes(agentId)) {
            throw new Error(`Agent ${agentId} is not a participant in consensus ${consensusId}`);
        }

        // Record vote
        consensus.votes[agentId] = {
            vote,
            reasoning,
            timestamp: new Date().toISOString()
        };

        // Update in memory
        await this.memoryStore.store(`consensus:${consensusId}`, consensus, {
            namespace: 'consensus'
        });

        console.log(`🗳️ Vote cast: ${agentId} voted ${vote} on ${consensusId}`);
        this.emit('vote-cast', { consensusId, agentId, vote });

        // Check if all votes are in
        const totalVotes = Object.keys(consensus.votes).length;
        if (totalVotes === consensus.participants.length) {
            return await this.finalizeConsensus(consensusId);
        }

        return consensus;
    }

    /**
     * Finalize consensus based on votes
     */
    async finalizeConsensus(consensusId) {
        const consensus = this.consensusVotes.get(consensusId);
        if (!consensus) return null;

        const votes = Object.values(consensus.votes);
        const approveCount = votes.filter(v => v.vote === 'approve').length;
        const rejectCount = votes.filter(v => v.vote === 'reject').length;
        const abstainCount = votes.filter(v => v.vote === 'abstain').length;

        const result = {
            approved: approveCount > rejectCount,
            votes: { approve: approveCount, reject: rejectCount, abstain: abstainCount },
            finalizedAt: new Date().toISOString()
        };

        consensus.status = 'finalized';
        consensus.result = result;

        // Update in memory
        await this.memoryStore.store(`consensus:${consensusId}`, consensus, {
            namespace: 'consensus'
        });

        // Notify all participants
        const notification = {
            type: 'consensus-result',
            consensusId,
            result,
            proposal: consensus.proposal
        };

        for (const participantId of consensus.participants) {
            await this.sendMessage('system', participantId, notification, 'high');
        }

        console.log(`🏁 Consensus finalized: ${consensusId} - ${result.approved ? 'APPROVED' : 'REJECTED'}`);
        this.emit('consensus-finalized', { consensusId, result });

        return consensus;
    }

    /**
     * Performance Monitoring Hooks
     */
    async trackPerformance(agentId, operationType, startTime, endTime, metadata = {}) {
        const duration = endTime - startTime;
        const performanceData = {
            agentId,
            operationType,
            duration,
            startTime: new Date(startTime).toISOString(),
            endTime: new Date(endTime).toISOString(),
            metadata,
            timestamp: new Date().toISOString()
        };

        // Update agent performance metrics
        if (!this.performanceMetrics.has(agentId)) {
            this.performanceMetrics.set(agentId, {
                totalOperations: 0,
                totalDuration: 0,
                averageDuration: 0,
                operationTypes: {},
                lastUpdate: new Date().toISOString()
            });
        }

        const metrics = this.performanceMetrics.get(agentId);
        metrics.totalOperations++;
        metrics.totalDuration += duration;
        metrics.averageDuration = metrics.totalDuration / metrics.totalOperations;
        metrics.operationTypes[operationType] = (metrics.operationTypes[operationType] || 0) + 1;
        metrics.lastUpdate = new Date().toISOString();

        // Store performance data
        await this.memoryStore.store(`performance:${agentId}:${Date.now()}`, performanceData, {
            namespace: 'performance',
            metadata: { agentId, operationType }
        });

        // Execute performance monitoring hooks
        await this.executeHooks('performance-monitor', { performanceData, metrics }, agentId);

        console.log(`📊 Performance tracked: ${agentId} - ${operationType} (${duration}ms)`);
        this.emit('performance-tracked', performanceData);

        return performanceData;
    }

    /**
     * Get agent performance metrics
     */
    async getPerformanceMetrics(agentId) {
        return this.performanceMetrics.get(agentId) || null;
    }

    /**
     * Agent heartbeat for health monitoring
     */
    async agentHeartbeat(agentId, statusData = {}) {
        const agent = this.agents.get(agentId);
        if (!agent) return false;

        agent.lastHeartbeat = new Date().toISOString();
        agent.status = 'active';
        agent.statusData = statusData;

        // Update in memory
        await this.memoryStore.store(`agent:${agentId}`, agent, {
            namespace: 'agents'
        });

        this.emit('agent-heartbeat', { agentId, statusData });
        return true;
    }

    /**
     * Monitor agent health
     */
    async monitorAgentHealth() {
        const now = Date.now();
        const staleThreshold = 60000; // 1 minute

        for (const [agentId, agent] of this.agents) {
            const lastHeartbeat = new Date(agent.lastHeartbeat).getTime();
            if (now - lastHeartbeat > staleThreshold) {
                agent.status = 'stale';
                console.log(`⚠️ Agent ${agentId} appears stale (last heartbeat: ${agent.lastHeartbeat})`);
                this.emit('agent-stale', { agentId, agent });
            }
        }
    }

    /**
     * Utility function to generate IDs
     */
    generateId(prefix = 'id') {
        return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get all active agents
     */
    getActiveAgents() {
        return Array.from(this.agents.values()).filter(agent => agent.status === 'active');
    }

    /**
     * Cleanup and shutdown
     */
    async shutdown() {
        console.log('🔌 Shutting down Agent Hook Listeners...');
        
        // Notify all agents of shutdown
        for (const agentId of this.agents.keys()) {
            await this.sendMessage('system', agentId, {
                type: 'system-shutdown',
                timestamp: new Date().toISOString()
            }, 'critical').catch(console.error);
        }

        this.agents.clear();
        this.activeOperations.clear();
        this.consensusVotes.clear();
        this.performanceMetrics.clear();
        
        if (this.memoryStore) {
            await this.memoryStore.close();
        }

        this.removeAllListeners();
        console.log('✅ Agent Hook Listeners shutdown complete');
    }
}

export default AgentHookListeners;
export { AgentHookListeners };