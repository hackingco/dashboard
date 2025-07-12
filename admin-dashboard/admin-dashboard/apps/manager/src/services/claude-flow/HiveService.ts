import { exec } from 'child_process';
import { promisify } from 'util';
import { 
  HiveConfig, 
  HiveStatus, 
  HiveTask, 
  ConsensusResult,
  SwarmTopology 
} from './types';

const execAsync = promisify(exec);

export class HiveService {
  private hives = new Map<string, HiveStatus>();

  async initializeHive(swarmId: string, config: HiveConfig): Promise<HiveStatus> {
    try {
      // Initialize Claude-Flow swarm
      const { stdout } = await execAsync(
        `npx claude-flow@alpha swarm_init --topology ${config.topology} --maxAgents ${config.maxAgents} --strategy balanced`
      );

      const hiveStatus: HiveStatus = {
        id: swarmId,
        topology: config.topology,
        agents: [],
        activeTasks: 0,
        completedTasks: 0,
        memoryUsage: 0,
        consensusHistory: [],
        performance: {
          avgTaskTime: 0,
          successRate: 0,
          throughput: 0
        }
      };

      this.hives.set(swarmId, hiveStatus);

      // Store initialization in Claude-Flow memory
      await execAsync(
        `npx claude-flow@alpha hooks notification --message "Hive initialized: ${swarmId}" --telemetry true`
      );

      return hiveStatus;
    } catch (error) {
      throw new Error(`Failed to initialize hive: ${error}`);
    }
  }

  async orchestrateTask(swarmId: string, task: HiveTask): Promise<any> {
    const hive = this.hives.get(swarmId);
    if (!hive) {
      throw new Error(`Hive ${swarmId} not found`);
    }

    try {
      // Update hive status
      hive.activeTasks++;
      
      // Execute task orchestration through Claude-Flow
      const { stdout } = await execAsync(
        `npx claude-flow@alpha task_orchestrate --task "${task.objective}" --strategy ${task.strategy} --priority ${task.priority}`
      );

      // Parse and return results
      const results = JSON.parse(stdout);
      
      // Update performance metrics
      hive.completedTasks++;
      hive.activeTasks--;
      
      return results;
    } catch (error) {
      hive.activeTasks--;
      throw new Error(`Task orchestration failed: ${error}`);
    }
  }

  async triggerConsensus(
    swarmId: string, 
    taskId: string, 
    proposal: any
  ): Promise<ConsensusResult> {
    const hive = this.hives.get(swarmId);
    if (!hive) {
      throw new Error(`Hive ${swarmId} not found`);
    }

    try {
      // Get consensus from agents through Claude-Flow
      const { stdout } = await execAsync(
        `npx claude-flow@alpha daa_consensus --agents ${JSON.stringify(hive.agents.map(a => a.id))} --proposal ${JSON.stringify(proposal)}`
      );

      const consensusData = JSON.parse(stdout);
      
      const result: ConsensusResult = {
        taskId,
        consensus: consensusData.consensus,
        votes: consensusData.votes,
        algorithm: 'majority',
        timestamp: Date.now()
      };

      // Store in history
      hive.consensusHistory.push(result);

      return result;
    } catch (error) {
      throw new Error(`Consensus failed: ${error}`);
    }
  }

  async getHiveStatus(swarmId: string): Promise<HiveStatus> {
    const hive = this.hives.get(swarmId);
    if (!hive) {
      throw new Error(`Hive ${swarmId} not found`);
    }

    try {
      // Get real-time status from Claude-Flow
      const { stdout } = await execAsync(
        `npx claude-flow@alpha swarm_status --swarmId ${swarmId} --verbose true`
      );

      const status = JSON.parse(stdout);
      
      // Update local hive status
      hive.agents = status.agents || [];
      hive.memoryUsage = status.memoryUsage || 0;
      
      // Calculate performance metrics
      if (hive.completedTasks > 0) {
        hive.performance.successRate = 
          (hive.completedTasks / (hive.completedTasks + hive.activeTasks)) * 100;
      }

      return hive;
    } catch (error) {
      console.error('Failed to get hive status:', error);
      return hive;
    }
  }

  async shutdownHive(swarmId: string): Promise<void> {
    const hive = this.hives.get(swarmId);
    if (!hive) {
      throw new Error(`Hive ${swarmId} not found`);
    }

    try {
      // Gracefully shutdown swarm
      await execAsync(
        `npx claude-flow@alpha swarm_destroy --swarmId ${swarmId}`
      );

      this.hives.delete(swarmId);
    } catch (error) {
      throw new Error(`Failed to shutdown hive: ${error}`);
    }
  }

  getActiveHives(): string[] {
    return Array.from(this.hives.keys());
  }
}