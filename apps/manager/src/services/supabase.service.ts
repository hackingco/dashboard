import { getSupabaseServiceClient, swarmOperations, workerOperations, taskOperations, logOperations, metricsOperations, statsOperations } from '@swarm/supabase';
import type { Database } from '@swarm/supabase';
import { logger } from '../lib/logger';
import { v4 as uuidv4 } from 'uuid';

// Types
type Swarm = Database['public']['Tables']['swarms']['Row'];
type Worker = Database['public']['Tables']['workers']['Row'];
type Task = Database['public']['Tables']['tasks']['Row'];
type Log = Database['public']['Tables']['logs']['Row'];

export class SupabaseService {
  private static instance: SupabaseService;
  private client = getSupabaseServiceClient();
  private subscriptions = new Map<string, any>();

  private constructor() {}

  static getInstance(): SupabaseService {
    if (!SupabaseService.instance) {
      SupabaseService.instance = new SupabaseService();
    }
    return SupabaseService.instance;
  }

  // Swarm operations
  async createSwarm(data: {
    name: string;
    purpose?: string;
    workerCount: number;
    config: any;
    flyAppName?: string;
  }): Promise<Swarm> {
    try {
      const swarm = await swarmOperations.create({
        id: uuidv4(),
        name: data.name,
        purpose: data.purpose,
        worker_count: data.workerCount,
        config: data.config,
        fly_app_name: data.flyAppName,
        status: 'creating',
        metrics: {
          tasks_completed: 0,
          tasks_failed: 0,
          average_task_duration: 0,
        },
      });

      logger.info('Created swarm in Supabase', { swarmId: swarm.id });
      return swarm;
    } catch (error) {
      logger.error('Failed to create swarm in Supabase', error);
      throw error;
    }
  }

  async updateSwarmStatus(swarmId: string, status: string, error?: string): Promise<Swarm> {
    try {
      const updates: Database['public']['Tables']['swarms']['Update'] = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (error) {
        updates.error = error;
      }

      const swarm = await swarmOperations.update(swarmId, updates);
      logger.info('Updated swarm status', { swarmId, status });
      return swarm;
    } catch (error) {
      logger.error('Failed to update swarm status', error);
      throw error;
    }
  }

  async getSwarm(swarmId: string): Promise<Swarm> {
    return swarmOperations.get(swarmId);
  }

  async listSwarms(): Promise<Swarm[]> {
    return swarmOperations.list();
  }

  async deleteSwarm(swarmId: string): Promise<void> {
    await swarmOperations.delete(swarmId);
  }

  // Worker operations
  async createWorker(data: {
    swarmId: string;
    name: string;
    type?: string;
    machineId?: string;
    config?: any;
  }): Promise<Worker> {
    try {
      const worker = await workerOperations.create({
        id: uuidv4(),
        swarm_id: data.swarmId,
        name: data.name,
        type: data.type || 'general',
        machine_id: data.machineId,
        config: data.config || {},
        status: 'starting',
        metrics: {
          tasks_completed: 0,
          tasks_failed: 0,
          cpu_usage: 0,
          memory_usage: 0,
        },
      });

      logger.info('Created worker in Supabase', { workerId: worker.id, swarmId: data.swarmId });
      return worker;
    } catch (error) {
      logger.error('Failed to create worker in Supabase', error);
      throw error;
    }
  }

  async updateWorkerHeartbeat(workerId: string): Promise<void> {
    await workerOperations.updateHeartbeat(workerId);
  }

  async getWorkersBySwarm(swarmId: string): Promise<Worker[]> {
    return workerOperations.listBySwarm(swarmId);
  }

  // Task operations
  async createTask(data: {
    swarmId: string;
    type: string;
    input?: any;
    priority?: number;
  }): Promise<Task> {
    try {
      const task = await taskOperations.create({
        id: uuidv4(),
        swarm_id: data.swarmId,
        type: data.type,
        input: data.input,
        priority: data.priority || 0,
        status: 'pending',
        retry_count: 0,
        max_retries: 3,
      });

      logger.info('Created task in Supabase', { taskId: task.id, swarmId: data.swarmId });
      return task;
    } catch (error) {
      logger.error('Failed to create task in Supabase', error);
      throw error;
    }
  }

  async assignTaskToWorker(taskId: string, workerId: string): Promise<Task> {
    return taskOperations.assignToWorker(taskId, workerId);
  }

  async completeTask(taskId: string, output: any): Promise<Task> {
    return taskOperations.complete(taskId, output);
  }

  async failTask(taskId: string, error: string): Promise<Task> {
    return taskOperations.fail(taskId, error);
  }

  async getTasksBySwarm(swarmId: string, status?: string): Promise<Task[]> {
    return taskOperations.listBySwarm(swarmId, status);
  }

  // Log operations
  async createLog(data: {
    swarmId?: string;
    workerId?: string;
    taskId?: string;
    level: string;
    source?: string;
    message: string;
    metadata?: any;
  }): Promise<void> {
    try {
      await logOperations.create({
        id: uuidv4(),
        swarm_id: data.swarmId,
        worker_id: data.workerId,
        task_id: data.taskId,
        level: data.level,
        source: data.source,
        message: data.message,
        metadata: data.metadata,
      });
    } catch (error) {
      // Don't throw on log errors to prevent cascading failures
      logger.error('Failed to create log in Supabase', error);
    }
  }

  async getLogsBySwarm(swarmId: string, limit = 100): Promise<Log[]> {
    return logOperations.listBySwarm(swarmId, limit);
  }

  // Metrics operations
  async recordMetric(data: {
    swarmId?: string;
    workerId?: string;
    metricName: string;
    metricValue: number;
    tags?: any;
  }): Promise<void> {
    try {
      await metricsOperations.record({
        id: uuidv4(),
        swarm_id: data.swarmId,
        worker_id: data.workerId,
        metric_name: data.metricName,
        metric_value: data.metricValue,
        tags: data.tags,
      });
    } catch (error) {
      // Don't throw on metric errors to prevent cascading failures
      logger.error('Failed to record metric in Supabase', error);
    }
  }

  async queryMetrics(swarmId: string, metricName: string, since: Date): Promise<any[]> {
    return metricsOperations.query(swarmId, metricName, since);
  }

  // Stats operations
  async getSwarmStats(swarmId?: string): Promise<any[]> {
    return statsOperations.getSwarmStats(swarmId);
  }

  async getRecentActivity(limit = 20): Promise<any[]> {
    return statsOperations.getRecentActivity(limit);
  }

  // Real-time subscriptions
  subscribeToSwarm(swarmId: string, callback: (payload: any) => void): void {
    const subscription = swarmOperations.subscribe((payload) => {
      if (payload.new && payload.new.id === swarmId) {
        callback(payload);
      }
    });
    this.subscriptions.set(`swarm-${swarmId}`, subscription);
  }

  subscribeToWorkers(swarmId: string, callback: (payload: any) => void): void {
    const subscription = workerOperations.subscribeToSwarm(swarmId, callback);
    this.subscriptions.set(`workers-${swarmId}`, subscription);
  }

  subscribeToLogs(swarmId: string, callback: (payload: any) => void): void {
    const subscription = logOperations.subscribeToSwarm(swarmId, callback);
    this.subscriptions.set(`logs-${swarmId}`, subscription);
  }

  unsubscribe(key: string): void {
    const subscription = this.subscriptions.get(key);
    if (subscription) {
      subscription.unsubscribe();
      this.subscriptions.delete(key);
    }
  }

  unsubscribeAll(): void {
    for (const [key, subscription] of this.subscriptions) {
      subscription.unsubscribe();
    }
    this.subscriptions.clear();
  }
}

export const supabaseService = SupabaseService.getInstance();