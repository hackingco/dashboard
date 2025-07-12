import { exec } from 'child_process';
import { promisify } from 'util';
import { HiveMemory } from './types';

const execAsync = promisify(exec);

export class MemoryService {
  private cache = new Map<string, HiveMemory>();

  async store(
    swarmId: string,
    key: string,
    value: any,
    options?: {
      namespace?: string;
      ttl?: number;
      agent?: string;
    }
  ): Promise<void> {
    const namespace = options?.namespace || swarmId;
    const memoryKey = `${namespace}/${key}`;

    try {
      // Store in Claude-Flow memory
      const ttlArg = options?.ttl ? `--ttl ${options.ttl}` : '';
      await execAsync(
        `npx claude-flow@alpha memory_usage --action store --key "${memoryKey}" --value ${JSON.stringify(value)} --namespace "${namespace}" ${ttlArg}`
      );

      // Update local cache
      const memory: HiveMemory = {
        key: memoryKey,
        value,
        namespace,
        timestamp: Date.now(),
        ttl: options?.ttl,
        agent: options?.agent
      };

      this.cache.set(memoryKey, memory);
    } catch (error) {
      throw new Error(`Failed to store memory: ${error}`);
    }
  }

  async retrieve(
    swarmId: string,
    key: string,
    namespace?: string
  ): Promise<any> {
    const ns = namespace || swarmId;
    const memoryKey = `${ns}/${key}`;

    // Check cache first
    const cached = this.cache.get(memoryKey);
    if (cached && this.isValid(cached)) {
      return cached.value;
    }

    try {
      // Retrieve from Claude-Flow memory
      const { stdout } = await execAsync(
        `npx claude-flow@alpha memory_usage --action retrieve --key "${memoryKey}" --namespace "${ns}"`
      );

      const data = JSON.parse(stdout);
      
      // Update cache
      if (data.value !== undefined) {
        this.cache.set(memoryKey, {
          key: memoryKey,
          value: data.value,
          namespace: ns,
          timestamp: Date.now()
        });
      }

      return data.value;
    } catch (error) {
      console.error(`Failed to retrieve memory: ${error}`);
      return null;
    }
  }

  async search(
    pattern: string,
    namespace?: string,
    limit?: number
  ): Promise<HiveMemory[]> {
    try {
      const namespaceArg = namespace ? `--namespace "${namespace}"` : '';
      const limitArg = limit ? `--limit ${limit}` : '';
      
      const { stdout } = await execAsync(
        `npx claude-flow@alpha memory_search --pattern "${pattern}" ${namespaceArg} ${limitArg}`
      );

      const results = JSON.parse(stdout);
      
      // Convert to HiveMemory format
      return results.map((item: any) => ({
        key: item.key,
        value: item.value,
        namespace: item.namespace || 'default',
        timestamp: item.timestamp || Date.now(),
        ttl: item.ttl
      }));
    } catch (error) {
      throw new Error(`Memory search failed: ${error}`);
    }
  }

  async list(swarmId: string): Promise<HiveMemory[]> {
    try {
      const { stdout } = await execAsync(
        `npx claude-flow@alpha memory_usage --action list --namespace "${swarmId}"`
      );

      const items = JSON.parse(stdout);
      
      return items.map((item: any) => ({
        key: item.key,
        value: item.value,
        namespace: swarmId,
        timestamp: item.timestamp || Date.now()
      }));
    } catch (error) {
      console.error(`Failed to list memory: ${error}`);
      return [];
    }
  }

  async delete(swarmId: string, key: string): Promise<void> {
    const memoryKey = `${swarmId}/${key}`;
    
    try {
      await execAsync(
        `npx claude-flow@alpha memory_usage --action delete --key "${memoryKey}" --namespace "${swarmId}"`
      );

      this.cache.delete(memoryKey);
    } catch (error) {
      throw new Error(`Failed to delete memory: ${error}`);
    }
  }

  async sync(sourceSwarmId: string, targetSwarmId: string): Promise<void> {
    try {
      // Get all memories from source
      const memories = await this.list(sourceSwarmId);
      
      // Store in target
      for (const memory of memories) {
        const key = memory.key.replace(`${sourceSwarmId}/`, '');
        await this.store(targetSwarmId, key, memory.value, {
          namespace: targetSwarmId,
          ttl: memory.ttl
        });
      }

      // Notify sync completion
      await execAsync(
        `npx claude-flow@alpha memory_sync --target "${targetSwarmId}"`
      );
    } catch (error) {
      throw new Error(`Memory sync failed: ${error}`);
    }
  }

  async getUsage(swarmId: string): Promise<any> {
    try {
      const { stdout } = await execAsync(
        `npx claude-flow@alpha memory_analytics --timeframe "24h"`
      );

      return JSON.parse(stdout);
    } catch (error) {
      console.error(`Failed to get memory usage: ${error}`);
      return { totalSize: 0, itemCount: 0 };
    }
  }

  private isValid(memory: HiveMemory): boolean {
    if (!memory.ttl) return true;
    
    const age = Date.now() - memory.timestamp;
    return age < memory.ttl;
  }

  clearCache(): void {
    this.cache.clear();
  }
}