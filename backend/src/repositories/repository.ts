import { Job, Batch, Benchmark, CacheStats } from '../models/types.js';

/**
 * Data Repository for Jobs, Batches, and Benchmarks.
 * Backed by high-performance in-memory storage with optional DynamoDB sync.
 */
export class DataRepository {
  private jobs = new Map<string, Job>();
  private batches = new Map<string, Batch>();
  private benchmarks = new Map<string, Benchmark>();
  private processedIdempotencyKeys = new Set<string>();

  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    databaseReads: 0,
  };

  // --- Job Operations ---
  public async createJob(job: Job): Promise<Job> {
    this.jobs.set(job.jobId, { ...job });
    return job;
  }

  public async getJob(jobId: string): Promise<Job | null> {
    this.stats.databaseReads++;
    const job = this.jobs.get(jobId);
    return job ? { ...job } : null;
  }

  public async updateJob(jobId: string, updates: Partial<Job>): Promise<Job | null> {
    const existing = this.jobs.get(jobId);
    if (!existing) return null;
    const updated = { ...existing, ...updates };
    this.jobs.set(jobId, updated);
    return updated;
  }

  public async getJobsByBatch(batchId: string): Promise<Job[]> {
    this.stats.databaseReads++;
    const result: Job[] = [];
    for (const job of this.jobs.values()) {
      if (job.batchId === batchId) {
        result.push({ ...job });
      }
    }
    return result;
  }

  // --- Batch Operations ---
  public async createBatch(batch: Batch): Promise<Batch> {
    this.batches.set(batch.batchId, { ...batch });
    return batch;
  }

  public async getBatch(batchId: string): Promise<Batch | null> {
    this.stats.databaseReads++;
    const batch = this.batches.get(batchId);
    return batch ? { ...batch } : null;
  }

  public async updateBatch(batchId: string, updates: Partial<Batch>): Promise<Batch | null> {
    const existing = this.batches.get(batchId);
    if (!existing) return null;
    const updated = { ...existing, ...updates };
    this.batches.set(batchId, updated);
    return updated;
  }

  public async getAllBatches(): Promise<Batch[]> {
    this.stats.databaseReads++;
    return Array.from(this.batches.values()).map((b) => ({ ...b }));
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
}

export const globalRepository = new DataRepository();
