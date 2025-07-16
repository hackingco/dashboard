/**
 * Hook-Based Consensus Manager for Swarm Coordination
 * Implements distributed consensus mechanisms using hook listeners
 */

import { EventEmitter } from 'events';

export class HookConsensusManager extends EventEmitter {
    constructor(hookListeners, communicationProtocols) {
        super();
        this.hookListeners = hookListeners;
        this.communicationProtocols = communicationProtocols;
        this.consensusInstances = new Map();
        this.consensusStrategies = new Map();
        this.votingHooks = new Map();
        this.consensusResults = new Map();
        
        this.setupConsensusStrategies();
        this.setupVotingHooks();
    }

    /**
     * Setup consensus strategies
     */
    setupConsensusStrategies() {
        // Simple majority voting
        this.registerConsensusStrategy('majority', {
            requiredParticipation: 0.51, // 51% must participate
            passingThreshold: 0.5,      // 50% of votes must be positive
            timeout: 300000,            // 5 minutes
            allowAbstain: true
        });

        // Unanimous consensus
        this.registerConsensusStrategy('unanimous', {
            requiredParticipation: 1.0, // 100% must participate
            passingThreshold: 1.0,      // 100% must agree
            timeout: 600000,            // 10 minutes
            allowAbstain: false
        });

        // Supermajority (2/3)
        this.registerConsensusStrategy('supermajority', {
            requiredParticipation: 0.67, // 67% must participate
            passingThreshold: 0.67,      // 67% must agree
            timeout: 300000,
            allowAbstain: true
        });

        // Quorum-based consensus
        this.registerConsensusStrategy('quorum', {
            requiredParticipation: 0.6,  // 60% must participate
            passingThreshold: 0.5,       // 50% of participating votes
            timeout: 240000,             // 4 minutes
            allowAbstain: true
        });

        // Weighted voting (for specialized agents)
        this.registerConsensusStrategy('weighted', {
            requiredParticipation: 0.51,
            passingThreshold: 0.5,
            timeout: 300000,
            allowAbstain: true,
            useWeights: true
        });

        console.log('🗳️ Consensus strategies registered');
    }

    /**
     * Setup voting hooks for different agent events
     */
    setupVotingHooks() {
        // Pre-task consensus hook
        this.hookListeners.registerHook('pre-task', async (data, agentId) => {
            return await this.handlePreTaskConsensus(data, agentId);
        });

        // Resource allocation consensus hook
        this.hookListeners.registerHook('resource-allocation', async (data, agentId) => {
            return await this.handleResourceConsensus(data, agentId);
        });

        // Architecture decision consensus hook
        this.hookListeners.registerHook('architecture-decision', async (data, agentId) => {
            return await this.handleArchitectureConsensus(data, agentId);
        });

        // Performance optimization consensus hook
        this.hookListeners.registerHook('performance-optimization', async (data, agentId) => {
            return await this.handlePerformanceConsensus(data, agentId);
        });

        console.log('🔗 Voting hooks registered');
    }

    /**
     * Register a consensus strategy
     */
    registerConsensusStrategy(name, config) {
        this.consensusStrategies.set(name, {
            ...config,
            registeredAt: new Date().toISOString()
        });
        console.log(`📝 Consensus strategy registered: ${name}`);
    }

    /**
     * Initiate consensus with hook integration
     */
    async initiateHookConsensus(proposerId, proposal, options = {}) {
        const consensusId = this.generateId('consensus');
        const strategy = options.strategy || 'majority';
        const participants = options.participants || this.getEligibleParticipants(proposal.type);
        
        const strategyConfig = this.consensusStrategies.get(strategy);
        if (!strategyConfig) {
            throw new Error(`Unknown consensus strategy: ${strategy}`);
        }

        const consensusData = {
            id: consensusId,
            proposer: proposerId,
            proposal,
            strategy,
            participants: this.calculateParticipants(participants, proposal),
            votes: {},
            weights: this.calculateVotingWeights(participants, proposal, strategyConfig.useWeights),
            status: 'initiated',
            createdAt: new Date().toISOString(),
            deadline: new Date(Date.now() + strategyConfig.timeout).toISOString(),
            strategyConfig,
            hooks: {
                onVoteCast: options.onVoteCast || [],
                onConsensusReached: options.onConsensusReached || [],
                onConsensusTimeout: options.onConsensusTimeout || []
            }
        };

        this.consensusInstances.set(consensusId, consensusData);

        // Store in memory for persistence
        await this.hookListeners.memoryStore.store(`consensus:${consensusId}`, consensusData, {
            namespace: 'hook-consensus',
            metadata: { strategy, proposer: proposerId, participantCount: participants.length }
        });

        // Execute pre-consensus hooks
        await this.executeConsensusHooks('pre-consensus', consensusData);

        // Send consensus invitations via communication protocols
        await this.sendConsensusInvitations(consensusData);

        console.log(`🗳️ Hook consensus initiated: ${consensusId} using ${strategy} strategy`);
        this.emit('consensus-initiated', consensusData);

        // Set timeout handler
        this.scheduleConsensusTimeout(consensusId, strategyConfig.timeout);

        return consensusData;
    }

    /**
     * Calculate participants based on proposal type and agent capabilities
     */
    calculateParticipants(baseParticipants, proposal) {
        const activeAgents = this.hookListeners.getActiveAgents();
        
        // Filter participants based on proposal requirements
        let eligibleParticipants = baseParticipants.filter(agentId => 
            activeAgents.some(agent => agent.id === agentId)
        );

        // Add domain experts if needed
        if (proposal.requiresExpertise) {
            const experts = activeAgents.filter(agent => 
                agent.capabilities && proposal.requiresExpertise.some(skill => 
                    agent.capabilities.includes(skill)
                )
            ).map(agent => agent.id);
            
            eligibleParticipants = [...new Set([...eligibleParticipants, ...experts])];
        }

        return eligibleParticipants;
    }

    /**
     * Calculate voting weights for participants
     */
    calculateVotingWeights(participants, proposal, useWeights = false) {
        if (!useWeights) {
            return participants.reduce((weights, agentId) => {
                weights[agentId] = 1.0;
                return weights;
            }, {});
        }

        const activeAgents = this.hookListeners.getActiveAgents();
        const weights = {};

        for (const agentId of participants) {
            const agent = activeAgents.find(a => a.id === agentId);
            if (!agent) {
                weights[agentId] = 1.0;
                continue;
            }

            let weight = 1.0;

            // Increase weight based on expertise
            if (proposal.requiresExpertise && agent.capabilities) {
                const expertiseMatch = proposal.requiresExpertise.filter(skill => 
                    agent.capabilities.includes(skill)
                ).length;
                weight += expertiseMatch * 0.5;
            }

            // Increase weight based on agent type
            if (agent.type === 'coordinator') weight += 0.3;
            if (agent.type === 'architect') weight += 0.2;
            if (agent.type === 'specialist') weight += 0.1;

            // Performance-based weight adjustment
            const performance = this.hookListeners.performanceMetrics.get(agentId);
            if (performance && performance.averageDuration) {
                const performanceBonus = Math.min(0.2, 1000 / performance.averageDuration);
                weight += performanceBonus;
            }

            weights[agentId] = Math.min(3.0, weight); // Cap at 3x weight
        }

        return weights;
    }

    /**
     * Send consensus invitations to participants
     */
    async sendConsensusInvitations(consensusData) {
        const invitationPromises = consensusData.participants.map(async (participantId) => {
            try {
                await this.communicationProtocols.sendProtocolMessage(
                    consensusData.proposer,
                    participantId,
                    'consensus',
                    'consensus-propose',
                    {
                        consensusId: consensusData.id,
                        proposal: consensusData.proposal,
                        strategy: consensusData.strategy,
                        deadline: consensusData.deadline,
                        weight: consensusData.weights[participantId] || 1.0
                    },
                    { priority: 'high' }
                );
            } catch (error) {
                console.error(`❌ Failed to send consensus invitation to ${participantId}:`, error);
            }
        });

        await Promise.allSettled(invitationPromises);
        console.log(`📨 Consensus invitations sent to ${consensusData.participants.length} participants`);
    }

    /**
     * Cast vote with hook integration
     */
    async castHookVote(consensusId, agentId, vote, reasoning = '', metadata = {}) {
        const consensus = this.consensusInstances.get(consensusId);
        if (!consensus) {
            throw new Error(`Consensus ${consensusId} not found`);
        }

        if (consensus.status !== 'initiated' && consensus.status !== 'voting') {
            throw new Error(`Consensus ${consensusId} is not accepting votes (status: ${consensus.status})`);
        }

        if (!consensus.participants.includes(agentId)) {
            throw new Error(`Agent ${agentId} is not a participant in consensus ${consensusId}`);
        }

        if (consensus.votes[agentId]) {
            throw new Error(`Agent ${agentId} has already voted in consensus ${consensusId}`);
        }

        // Validate vote value
        const validVotes = ['approve', 'reject'];
        if (consensus.strategyConfig.allowAbstain) {
            validVotes.push('abstain');
        }
        
        if (!validVotes.includes(vote)) {
            throw new Error(`Invalid vote: ${vote}. Valid votes: ${validVotes.join(', ')}`);
        }

        // Record vote with hook data
        const voteData = {
            vote,
            reasoning,
            metadata,
            weight: consensus.weights[agentId] || 1.0,
            timestamp: new Date().toISOString(),
            hookSource: true
        };

        consensus.votes[agentId] = voteData;
        consensus.status = 'voting';

        // Store updated consensus
        await this.hookListeners.memoryStore.store(`consensus:${consensusId}`, consensus, {
            namespace: 'hook-consensus'
        });

        // Execute vote cast hooks
        await this.executeConsensusHooks('vote-cast', { consensus, agentId, voteData });

        console.log(`🗳️ Hook vote cast: ${agentId} voted ${vote} on ${consensusId} (weight: ${voteData.weight})`);
        this.emit('vote-cast', { consensusId, agentId, vote, voteData });

        // Check if consensus is reached
        const result = await this.checkConsensusReached(consensusId);
        if (result.reached) {
            await this.finalizeHookConsensus(consensusId, result);
        }

        return voteData;
    }

    /**
     * Check if consensus has been reached
     */
    async checkConsensusReached(consensusId) {
        const consensus = this.consensusInstances.get(consensusId);
        if (!consensus) return { reached: false };

        const strategy = consensus.strategyConfig;
        const totalParticipants = consensus.participants.length;
        const totalVotes = Object.keys(consensus.votes).length;
        
        // Calculate participation rate
        const participationRate = totalVotes / totalParticipants;
        if (participationRate < strategy.requiredParticipation) {
            return { 
                reached: false, 
                reason: 'insufficient_participation',
                participation: participationRate,
                required: strategy.requiredParticipation
            };
        }

        // Calculate weighted vote totals
        let approveWeight = 0;
        let rejectWeight = 0;
        let abstainWeight = 0;
        let totalWeight = 0;

        for (const [agentId, voteData] of Object.entries(consensus.votes)) {
            const weight = voteData.weight || 1.0;
            totalWeight += weight;
            
            switch (voteData.vote) {
                case 'approve':
                    approveWeight += weight;
                    break;
                case 'reject':
                    rejectWeight += weight;
                    break;
                case 'abstain':
                    abstainWeight += weight;
                    break;
            }
        }

        // Calculate approval rate
        const approvalRate = approveWeight / (totalWeight - abstainWeight);
        const passed = approvalRate >= strategy.passingThreshold;

        return {
            reached: true,
            passed,
            votes: {
                approve: approveWeight,
                reject: rejectWeight,
                abstain: abstainWeight,
                total: totalWeight
            },
            rates: {
                participation: participationRate,
                approval: approvalRate
            },
            strategy: consensus.strategy
        };
    }

    /**
     * Finalize consensus with hook integration
     */
    async finalizeHookConsensus(consensusId, result) {
        const consensus = this.consensusInstances.get(consensusId);
        if (!consensus) return;

        consensus.status = 'finalized';
        consensus.result = result;
        consensus.finalizedAt = new Date().toISOString();

        // Store final result
        await this.hookListeners.memoryStore.store(`consensus:${consensusId}:result`, {
            consensusId,
            result,
            finalizedAt: consensus.finalizedAt
        }, {
            namespace: 'consensus-results'
        });

        // Execute consensus reached hooks
        await this.executeConsensusHooks('consensus-reached', { consensus, result });

        // Notify all participants via communication protocols
        await this.notifyConsensusResult(consensus, result);

        console.log(`🏁 Hook consensus finalized: ${consensusId} - ${result.passed ? 'PASSED' : 'FAILED'}`);
        this.emit('consensus-finalized', { consensusId, result, consensus });

        // Clean up timeout
        this.clearConsensusTimeout(consensusId);

        return consensus;
    }

    /**
     * Notify participants of consensus result
     */
    async notifyConsensusResult(consensus, result) {
        const notificationPromises = consensus.participants.map(async (participantId) => {
            try {
                await this.communicationProtocols.sendProtocolMessage(
                    'system',
                    participantId,
                    'consensus',
                    'consensus-result',
                    {
                        consensusId: consensus.id,
                        proposal: consensus.proposal,
                        result,
                        finalizedAt: consensus.finalizedAt
                    },
                    { priority: 'high' }
                );
            } catch (error) {
                console.error(`❌ Failed to notify ${participantId} of consensus result:`, error);
            }
        });

        await Promise.allSettled(notificationPromises);
    }

    /**
     * Execute consensus hooks
     */
    async executeConsensusHooks(hookType, data) {
        const hooks = data.consensus?.hooks?.[hookType] || [];
        
        for (const hook of hooks) {
            try {
                if (typeof hook === 'function') {
                    await hook(data);
                } else if (typeof hook === 'string') {
                    // Execute named hook
                    await this.hookListeners.executeHooks(hook, data);
                }
            } catch (error) {
                console.error(`❌ Consensus hook execution failed for ${hookType}:`, error);
            }
        }
    }

    /**
     * Handle specific consensus types via hooks
     */
    async handlePreTaskConsensus(data, agentId) {
        if (data.requiresConsensus) {
            const consensus = await this.initiateHookConsensus(agentId, {
                type: 'task-execution',
                taskId: data.taskId,
                description: data.description,
                requiresExpertise: data.requiredSkills || []
            }, {
                strategy: 'majority',
                participants: data.consensusParticipants || []
            });
            
            return { consensusRequired: true, consensusId: consensus.id };
        }
        return { consensusRequired: false };
    }

    async handleResourceConsensus(data, agentId) {
        const consensus = await this.initiateHookConsensus(agentId, {
            type: 'resource-allocation',
            resourceType: data.resourceType,
            amount: data.amount,
            duration: data.duration
        }, {
            strategy: 'quorum',
            participants: this.getResourceManagerAgents()
        });
        
        return { consensusId: consensus.id };
    }

    async handleArchitectureConsensus(data, agentId) {
        const consensus = await this.initiateHookConsensus(agentId, {
            type: 'architecture-decision',
            component: data.component,
            proposal: data.architectureProposal,
            impact: data.impact || 'medium',
            requiresExpertise: ['architect', 'senior-developer']
        }, {
            strategy: 'supermajority',
            participants: this.getArchitectureTeam()
        });
        
        return { consensusId: consensus.id };
    }

    async handlePerformanceConsensus(data, agentId) {
        const consensus = await this.initiateHookConsensus(agentId, {
            type: 'performance-optimization',
            optimization: data.optimization,
            expectedGain: data.expectedGain,
            cost: data.cost,
            requiresExpertise: ['performance-engineer', 'architect']
        }, {
            strategy: 'weighted',
            participants: this.getPerformanceTeam()
        });
        
        return { consensusId: consensus.id };
    }

    /**
     * Get specialized agent groups
     */
    getEligibleParticipants(proposalType) {
        const allAgents = this.hookListeners.getActiveAgents().map(agent => agent.id);
        
        switch (proposalType) {
            case 'architecture-decision':
                return this.getArchitectureTeam();
            case 'resource-allocation':
                return this.getResourceManagerAgents();
            case 'performance-optimization':
                return this.getPerformanceTeam();
            default:
                return allAgents;
        }
    }

    getArchitectureTeam() {
        return this.hookListeners.getActiveAgents()
            .filter(agent => ['architect', 'coordinator', 'senior-developer'].includes(agent.type))
            .map(agent => agent.id);
    }

    getResourceManagerAgents() {
        return this.hookListeners.getActiveAgents()
            .filter(agent => ['coordinator', 'resource-manager'].includes(agent.type))
            .map(agent => agent.id);
    }

    getPerformanceTeam() {
        return this.hookListeners.getActiveAgents()
            .filter(agent => ['performance-engineer', 'architect', 'optimizer'].includes(agent.type))
            .map(agent => agent.id);
    }

    /**
     * Timeout management
     */
    scheduleConsensusTimeout(consensusId, timeout) {
        const timeoutId = setTimeout(async () => {
            await this.handleConsensusTimeout(consensusId);
        }, timeout);
        
        this.votingHooks.set(consensusId, { timeoutId });
    }

    clearConsensusTimeout(consensusId) {
        const hookData = this.votingHooks.get(consensusId);
        if (hookData?.timeoutId) {
            clearTimeout(hookData.timeoutId);
            this.votingHooks.delete(consensusId);
        }
    }

    async handleConsensusTimeout(consensusId) {
        const consensus = this.consensusInstances.get(consensusId);
        if (!consensus || consensus.status === 'finalized') return;

        consensus.status = 'timeout';
        consensus.timeoutAt = new Date().toISOString();

        // Execute timeout hooks
        await this.executeConsensusHooks('consensus-timeout', { consensus });

        console.log(`⏰ Consensus timeout: ${consensusId}`);
        this.emit('consensus-timeout', { consensusId, consensus });

        // Store timeout result
        await this.hookListeners.memoryStore.store(`consensus:${consensusId}:timeout`, {
            consensusId,
            timeoutAt: consensus.timeoutAt,
            partialVotes: consensus.votes
        }, {
            namespace: 'consensus-timeouts'
        });
    }

    /**
     * Utility methods
     */
    generateId(prefix = 'id') {
        return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get consensus statistics
     */
    getConsensusStats() {
        const active = Array.from(this.consensusInstances.values()).filter(c => c.status === 'initiated' || c.status === 'voting').length;
        const finalized = Array.from(this.consensusInstances.values()).filter(c => c.status === 'finalized').length;
        const timeout = Array.from(this.consensusInstances.values()).filter(c => c.status === 'timeout').length;

        return {
            total: this.consensusInstances.size,
            active,
            finalized,
            timeout,
            strategies: this.consensusStrategies.size
        };
    }

    /**
     * Cleanup
     */
    async cleanup() {
        // Clear all timeouts
        for (const consensusId of this.votingHooks.keys()) {
            this.clearConsensusTimeout(consensusId);
        }

        this.consensusInstances.clear();
        this.consensusStrategies.clear();
        this.votingHooks.clear();
        this.consensusResults.clear();
        this.removeAllListeners();
        
        console.log('🧹 Hook Consensus Manager cleaned up');
    }
}

export default HookConsensusManager;