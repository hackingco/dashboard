import { exec } from 'child_process';
import { promisify } from 'util';
import { HiveAgent, AgentType } from './types';

const execAsync = promisify(exec);

export class AgentService {
  private agents = new Map<string, HiveAgent>();

  async spawnAgent(
    swarmId: string,
    type: AgentType,
    name?: string,
    capabilities?: string[]
  ): Promise<HiveAgent> {
    try {
      // Spawn agent through Claude-Flow
      const capabilitiesArg = capabilities ? 
        `--capabilities ${JSON.stringify(capabilities)}` : '';
      const nameArg = name ? `--name "${name}"` : '';
      
      const { stdout } = await execAsync(
        `npx claude-flow@alpha agent_spawn --type ${type} --swarmId ${swarmId} ${nameArg} ${capabilitiesArg}`
      );

      const agentData = JSON.parse(stdout);
      
      const agent: HiveAgent = {
        id: agentData.id,
        type,
        name: name || agentData.name,
        capabilities: capabilities || [],
        status: 'idle',
        performance: {
          tasksCompleted: 0,
          successRate: 0,
          avgResponseTime: 0
        }
      };

      this.agents.set(agent.id, agent);

      // Register agent in Claude-Flow memory
      await execAsync(
        `npx claude-flow@alpha hooks notification --message "Agent spawned: ${agent.id} (${type})" --telemetry true`
      );

      return agent;
    } catch (error) {
      throw new Error(`Failed to spawn agent: ${error}`);
    }
  }

  async spawnMultipleAgents(
    swarmId: string,
    distribution: Record<AgentType, number>
  ): Promise<HiveAgent[]> {
    const agents: HiveAgent[] = [];

    for (const [type, count] of Object.entries(distribution)) {
      for (let i = 0; i < count; i++) {
        const agent = await this.spawnAgent(
          swarmId,
          type as AgentType,
          `${type}-${i + 1}`
        );
        agents.push(agent);
      }
    }

    return agents;
  }

  async getAgentMetrics(agentId: string): Promise<any> {
    try {
      const { stdout } = await execAsync(
        `npx claude-flow@alpha agent_metrics --agentId ${agentId} --metric all`
      );

      const metrics = JSON.parse(stdout);
      
      // Update local agent performance
      const agent = this.agents.get(agentId);
      if (agent) {
        agent.performance.tasksCompleted = metrics.tasksCompleted || 0;
        agent.performance.successRate = metrics.successRate || 0;
        agent.performance.avgResponseTime = metrics.avgResponseTime || 0;
      }

      return metrics;
    } catch (error) {
      throw new Error(`Failed to get agent metrics: ${error}`);
    }
  }

  async listAgents(swarmId: string, filter?: string): Promise<HiveAgent[]> {
    try {
      const filterArg = filter ? `--filter ${filter}` : '';
      const { stdout } = await execAsync(
        `npx claude-flow@alpha agent_list --swarmId ${swarmId} ${filterArg}`
      );

      const agentList = JSON.parse(stdout);
      
      // Update local agent statuses
      for (const agentData of agentList) {
        const agent = this.agents.get(agentData.id);
        if (agent) {
          agent.status = agentData.status;
        }
      }

      return Array.from(this.agents.values()).filter(
        agent => agentList.some((a: any) => a.id === agent.id)
      );
    } catch (error) {
      throw new Error(`Failed to list agents: ${error}`);
    }
  }

  async updateAgentStatus(agentId: string, status: HiveAgent['status']): Promise<void> {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.status = status;
      
      // Notify Claude-Flow of status change
      await execAsync(
        `npx claude-flow@alpha hooks notification --message "Agent ${agentId} status: ${status}" --telemetry true`
      );
    }
  }

  async coordinateAgents(
    fromAgentId: string,
    toAgentId: string,
    message: any
  ): Promise<void> {
    try {
      await execAsync(
        `npx claude-flow@alpha daa_communication --from ${fromAgentId} --to ${toAgentId} --message ${JSON.stringify(message)}`
      );
    } catch (error) {
      throw new Error(`Agent coordination failed: ${error}`);
    }
  }

  getAgentsByType(type: AgentType): HiveAgent[] {
    return Array.from(this.agents.values()).filter(agent => agent.type === type);
  }

  getAgentById(agentId: string): HiveAgent | undefined {
    return this.agents.get(agentId);
  }

  getAllAgents(): HiveAgent[] {
    return Array.from(this.agents.values());
  }
}