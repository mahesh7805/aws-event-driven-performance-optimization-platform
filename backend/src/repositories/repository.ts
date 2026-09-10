import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand, ScanCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { Job, Batch, Benchmark, CacheStats } from '../models/types.js';
import { globalTerraformService } from '../services/terraformService.js';

/**
 * Data Repository for Jobs, Batches, and Benchmarks.
 * Backed by high-performance in-memory cache with automatic Amazon DynamoDB cloud sync.
 */
export class DataRepository {
  private jobs = new Map<string, Job>();
  private batches = new Map<string, Batch>();
  private benchmarks = new Map<string, Benchmark>();
  private processedIdempotencyKeys = new Set<string>();
  private docClientInstance: DynamoDBDocumentClient | null = null;
  private currentRegion: string | null = null;

  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    databaseReads: 0,
  };

  private getDocClient(): DynamoDBDocumentClient {
    const region = globalTerraformService.getAwsRegion();
    if (!this.docClientInstance || this.currentRegion !== region) {
      const ddbClient = new DynamoDBClient({
        region,
        endpoint: process.env.AWS_ENDPOINT || undefined,
      });
      this.docClientInstance = DynamoDBDocumentClient.from(ddbClient, {
        marshallOptions: { removeUndefinedValues: true },
      });
      this.currentRegion = region;
    }
    return this.docClientInstance;
  }

  private getJobsTableName(): string | null {
    if (process.env.NODE_ENV === 'test') return null;
    return globalTerraformService.getJobsTableName();
  }

  private getBatchesTableName(): string | null {
    if (process.env.NODE_ENV === 'test') return null;
    return globalTerraformService.getBatchesTableName();
  }

  // --- Job Operations ---
  public async createJob(job: Job): Promise<Job> {
    this.jobs.set(job.jobId, { ...job });

    const tableName = this.getJobsTableName();
    if (tableName) {
      try {
        const client = this.getDocClient();
        await client.send(
          new PutCommand({
            TableName: tableName,
            Item: {
              jobId: job.jobId,
              batchId: job.batchId,
              status: job.status,
              createdAt: job.createdAt,
              startedAt: job.startedAt,
              completedAt: job.completedAt,
              duration: job.duration,
              result: job.result,
              error: job.error,
            },
          })
        );
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.warn(`[DynamoDB Warning] Failed to persist job ${job.jobId} to ${tableName}: ${errMsg}`);
      }
    }
    return job;
  }

  public async getJob(jobId: string): Promise<Job | null> {
    this.stats.databaseReads++;
    const job = this.jobs.get(jobId);
    if (job) return { ...job };

    const tableName = this.getJobsTableName();
    if (tableName) {
      try {
        const client = this.getDocClient();
        const queryRes = await client.send(
          new QueryCommand({
            TableName: tableName,
            KeyConditionExpression: 'jobId = :jid',
            ExpressionAttributeValues: {
              ':jid': jobId,
            },
            Limit: 1,
          })
        );
        if (queryRes.Items && queryRes.Items.length > 0) {
          const item = queryRes.Items[0] as Job;
          this.jobs.set(item.jobId, item);
          return { ...item };
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.warn(`[DynamoDB Warning] Failed to query job ${jobId} from ${tableName}: ${errMsg}`);
      }
    }
    return null;
  }

  public async getOrCreateJob(jobId: string): Promise<Job> {
    this.stats.databaseReads++;
    let job = this.jobs.get(jobId);
    if (!job) {
      job = {
        jobId,
        batchId: `batch-auto-${jobId}`,
        status: 'COMPLETED',
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        duration: 45,
        result: {
          computedChecksum: 987.65,
          simulatedDurationMs: 45,
        },
      };
      this.jobs.set(jobId, job);
      const tableName = this.getJobsTableName();
      if (tableName) {
        await this.createJob(job);
      }
    }
    return { ...job };
  }

  public async updateJob(jobId: string, updates: Partial<Job>): Promise<Job | null> {
    const existing = this.jobs.get(jobId);
    if (!existing) return null;
    const updated: Job = { ...existing, ...updates };
    this.jobs.set(jobId, updated);

    const tableName = this.getJobsTableName();
    if (tableName) {
      try {
        const client = this.getDocClient();
        await client.send(
          new PutCommand({
            TableName: tableName,
            Item: {
              jobId: updated.jobId,
              batchId: updated.batchId,
              status: updated.status,
              createdAt: updated.createdAt,
              startedAt: updated.startedAt,
              completedAt: updated.completedAt,
              duration: updated.duration,
              result: updated.result,
              error: updated.error,
            },
          })
        );
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.warn(`[DynamoDB Warning] Failed to update job ${jobId} in ${tableName}: ${errMsg}`);
      }
    }
    return updated;
  }

  public calculateBatchConcurrency(jobs: Job[]): { peakConcurrency: number; concurrencyTimeline: { timeMs: number; concurrency: number }[] } {
    const activeJobs = jobs.filter((j) => j.startedAt && j.completedAt);
    if (activeJobs.length === 0) {
      return { peakConcurrency: jobs.some((j) => j.status === 'PROCESSING') ? 1 : 0, concurrencyTimeline: [] };
    }

    interface TimeEvent {
      time: number;
      delta: number;
    }

    const events: TimeEvent[] = [];
    for (const job of activeJobs) {
      const start = new Date(job.startedAt!).getTime();
      const end = new Date(job.completedAt!).getTime();
      events.push({ time: start, delta: 1 });
      events.push({ time: end, delta: -1 });
    }

    events.sort((a, b) => a.time - b.time || b.delta - a.delta);

    let current = 0;
    let peak = 0;
    const timeline: { timeMs: number; concurrency: number }[] = [];

    for (const evt of events) {
      current += evt.delta;
      if (current < 0) current = 0;
      if (current > peak) peak = current;
      timeline.push({ timeMs: evt.time, concurrency: current });
    }

    return { peakConcurrency: peak, concurrencyTimeline: timeline };
  }

  public async getJobsByBatch(batchId: string): Promise<Job[]> {
    this.stats.databaseReads++;
    const jobsMap = new Map<string, Job>();

    // 1. Gather any existing in-memory jobs for this batch
    for (const job of this.jobs.values()) {
      if (job.batchId === batchId) {
        jobsMap.set(job.jobId, { ...job });
      }
    }

    // 2. Query DynamoDB BatchIndex if available to get updates from Lambda
    const tableName = this.getJobsTableName();
    if (tableName) {
      try {
        const client = this.getDocClient();
        const queryRes = await client.send(
          new QueryCommand({
            TableName: tableName,
            IndexName: 'BatchIndex',
            KeyConditionExpression: 'batchId = :bid',
            ExpressionAttributeValues: {
              ':bid': batchId,
            },
          })
        );
        if (queryRes.Items && queryRes.Items.length > 0) {
          for (const item of queryRes.Items) {
            const cloudJob = item as Job;
            jobsMap.set(cloudJob.jobId, cloudJob);
            this.jobs.set(cloudJob.jobId, cloudJob);
          }
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.warn(`[DynamoDB Warning] Failed to query jobs for batch ${batchId} from ${tableName}: ${errMsg}`);
      }
    }

    const result = Array.from(jobsMap.values());
    if (result.length > 0) {
      const completed = result.filter((j) => j.status === 'COMPLETED').length;
      const failed = result.filter((j) => j.status === 'FAILED').length;
      const queued = result.filter((j) => j.status === 'QUEUED').length;
      const existingBatch = this.batches.get(batchId);
      if (existingBatch) {
        const totalDuration = existingBatch.startedAt && (completed + failed >= existingBatch.totalJobs)
          ? (existingBatch.totalDuration || Date.now() - new Date(existingBatch.startedAt).getTime())
          : existingBatch.totalDuration;
        const totalJobDurationSum = result.filter((j) => j.duration).reduce((acc, curr) => acc + (curr.duration || 0), 0);
        const averageJobDuration = completed > 0 ? Math.round(totalJobDurationSum / completed) : undefined;
        const throughput = totalDuration && totalDuration > 0 ? Math.round((completed / (totalDuration / 1000)) * 10) / 10 : undefined;
        const { peakConcurrency } = this.calculateBatchConcurrency(result);

        const updatedBatch: Batch = {
          ...existingBatch,
          completedJobs: completed,
          failedJobs: failed,
          queuedJobs: queued,
          ...(totalDuration ? { totalDuration } : {}),
          ...(averageJobDuration ? { averageJobDuration } : {}),
          ...(throughput ? { throughput } : {}),
          ...(peakConcurrency ? { peakConcurrency } : {}),
          ...(completed + failed >= existingBatch.totalJobs ? { completedAt: existingBatch.completedAt || new Date().toISOString() } : {}),
        };
        this.batches.set(batchId, updatedBatch);
      }
    }

    return result;
  }

  // --- Batch Operations ---
  public async createBatch(batch: Batch): Promise<Batch> {
    this.batches.set(batch.batchId, { ...batch });

    const tableName = this.getBatchesTableName();
    if (tableName) {
      try {
        const client = this.getDocClient();
        await client.send(
          new PutCommand({
            TableName: tableName,
            Item: { ...batch },
          })
        );
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.warn(`[DynamoDB Warning] Failed to persist batch ${batch.batchId} to ${tableName}: ${errMsg}`);
      }
    }
    return batch;
  }

  public async getBatch(batchId: string): Promise<Batch | null> {
    this.stats.databaseReads++;
    const batch = this.batches.get(batchId);
    if (batch) return { ...batch };

    const tableName = this.getBatchesTableName();
    if (tableName && process.env.NODE_ENV !== 'test') {
      try {
        const client = this.getDocClient();
        const res = await client.send(
          new GetCommand({
            TableName: tableName,
            Key: { batchId },
          })
        );
        if (res.Item) {
          const cloudBatch = res.Item as Batch;
          this.batches.set(cloudBatch.batchId, cloudBatch);
          return { ...cloudBatch };
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.warn(`[DynamoDB Warning] Failed to get batch ${batchId} from ${tableName}: ${errMsg}`);
      }
    }
    return null;
  }

  public async updateBatch(batchId: string, updates: Partial<Batch>): Promise<Batch | null> {
    const existing = this.batches.get(batchId);
    if (!existing) return null;
    const updated: Batch = { ...existing, ...updates };
    this.batches.set(batchId, updated);

    const tableName = this.getBatchesTableName();
    if (tableName) {
      try {
        const client = this.getDocClient();
        await client.send(
          new PutCommand({
            TableName: tableName,
            Item: { ...updated },
          })
        );
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.warn(`[DynamoDB Warning] Failed to update batch ${batchId} in ${tableName}: ${errMsg}`);
      }
    }
    return updated;
  }

  public async getAllBatches(): Promise<Batch[]> {
    this.stats.databaseReads++;
    const batchesMap = new Map<string, Batch>();

    // 1. Seed from local in-memory batches
    for (const batch of this.batches.values()) {
      batchesMap.set(batch.batchId, { ...batch });
    }

    // 2. Query DynamoDB BatchesTable if configured
    const tableName = this.getBatchesTableName();
    if (tableName && process.env.NODE_ENV !== 'test') {
      try {
        const client = this.getDocClient();
        const scanRes = await client.send(
          new ScanCommand({
            TableName: tableName,
          })
        );
        if (scanRes.Items && scanRes.Items.length > 0) {
          for (const item of scanRes.Items) {
            const cloudBatch = item as Batch;
            const existing = batchesMap.get(cloudBatch.batchId);
            if (!existing || (cloudBatch.completedJobs ?? 0) >= (existing.completedJobs ?? 0)) {
              batchesMap.set(cloudBatch.batchId, cloudBatch);
              this.batches.set(cloudBatch.batchId, cloudBatch);
            }
          }
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.warn(`[DynamoDB Warning] Failed to scan batches from ${tableName}: ${errMsg}`);
      }
    }

    return Array.from(batchesMap.values()).sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
  }

  // --- Benchmark Operations ---
  public async createBenchmark(benchmark: Benchmark): Promise<Benchmark> {
    this.benchmarks.set(benchmark.benchmarkId, { ...benchmark });
    return benchmark;
  }

  public async getBenchmark(benchmarkId: string): Promise<Benchmark | null> {
    this.stats.databaseReads++;
    const b = this.benchmarks.get(benchmarkId);
    return b ? { ...b } : null;
  }

  public async getAllBenchmarks(): Promise<Benchmark[]> {
    this.stats.databaseReads++;
    return Array.from(this.benchmarks.values()).map((b) => ({ ...b }));
  }

  // --- Idempotency Check ---
  public isProcessed(idempotencyKey: string): boolean {
    return this.processedIdempotencyKeys.has(idempotencyKey);
  }

  public markProcessed(idempotencyKey: string): void {
    this.processedIdempotencyKeys.add(idempotencyKey);
  }

  // --- Cache Metrics ---
  public recordCacheHit(): void {
    this.stats.hits++;
    this.updateHitRate();
  }

  public recordCacheMiss(): void {
    this.stats.misses++;
    this.updateHitRate();
  }

  public getCacheStats(): CacheStats {
    return { ...this.stats };
  }

  public resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      databaseReads: 0,
    };
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? parseFloat((this.stats.hits / total).toFixed(4)) : 0;
  }

  public clearAll(): void {
    this.jobs.clear();
    this.batches.clear();
    this.benchmarks.clear();
    this.processedIdempotencyKeys.clear();
    this.resetStats();
  }

  public getCloudSyncStatus(): {
    dynamoDbConnected: boolean;
    jobsTableName: string | null;
    batchesTableName: string | null;
    region: string;
  } {
    const jobsTableName = this.getJobsTableName();
    const batchesTableName = this.getBatchesTableName();
    return {
      dynamoDbConnected: Boolean(jobsTableName),
      jobsTableName,
      batchesTableName,
      region: globalTerraformService.getAwsRegion(),
    };
  }
}

export const globalRepository = new DataRepository();
