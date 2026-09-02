import { randomUUID } from 'crypto';
import { Benchmark, ProcessingMode } from '../models/types.js';
import { DataRepository } from '../repositories/repository.js';
import { SerialProcessor } from './serialProcessor.js';
import { ParallelProcessor } from './parallelProcessor.js';
import { CacheService } from './cacheService.js';

export interface RunBenchmarkOptions {
  jobCount: number; // e.g. 10, 20, 50, 100
  jobProcessingMs?: number;
  mode?: ProcessingMode;
}

export interface BenchmarkComparisonResult {
  jobCount: number;
  serialDurationMs: number;
  parallelDurationMs: number;
  cachedDurationMs: number;
  improvementPercentage: number;
  throughputJobsPerSec: number;
  cacheHitRate: number;
  databaseReadsSaved: number;
  serialBatchId: string;
  parallelBatchId: string;
  benchmarkId: string;
  timestamp: string;
}

/**
 * Benchmark Engine calculating actual execution timestamps and speedup metrics.
 */
export class BenchmarkEngine {
  private serialProcessor: SerialProcessor;
  private parallelProcessor: ParallelProcessor;
  private cacheService: CacheService;

  constructor(private repo: DataRepository) {
    this.serialProcessor = new SerialProcessor(repo);
    this.parallelProcessor = new ParallelProcessor(repo);
    this.cacheService = new CacheService(repo, 60);
  }

  public async runComparison(options: RunBenchmarkOptions): Promise<BenchmarkComparisonResult> {
    const jobCount = Math.max(1, Math.min(200, options.jobCount));
    const processingMs = options.jobProcessingMs ?? 30;

    // Reset repository stats
    this.repo.resetStats();

    // 1. Measure Serial Baseline Execution
    const serialStartTime = Date.now();
    const serialRes = await this.serialProcessor.processBatch({
      jobCount,
      jobProcessingMs: processingMs,
    });
    const serialDurationMs = Date.now() - serialStartTime;

    // 2. Measure Decoupled Parallel SQS + Worker Processing
    const parallelStartTime = Date.now();
    const parallelRes = await this.parallelProcessor.processBatch({
      jobCount,
      jobProcessingMs: processingMs,
    });

    // Wait until all background worker tasks complete for accurate timestamp delta
    let currentBatch = await this.repo.getBatch(parallelRes.batch.batchId);
    while (currentBatch && currentBatch.completedJobs + currentBatch.failedJobs < jobCount) {
      await new Promise((r) => setTimeout(r, 20));
      currentBatch = await this.repo.getBatch(parallelRes.batch.batchId);
    }
    const parallelDurationMs = Math.max(1, Date.now() - parallelStartTime);

    // 3. Measure Cache Read Latency for all batch jobs
    const cacheStartTime = Date.now();
    for (const job of parallelRes.jobs) {
      await this.cacheService.getJob(job.jobId);
    }
    const cachedDurationMs = Date.now() - cacheStartTime;

    // Calculate empirical metrics from measured timestamps
    const rawImprovement = ((serialDurationMs - parallelDurationMs) / serialDurationMs) * 100;
    const improvementPercentage = Math.max(0, Math.round(rawImprovement * 10) / 10);
    const throughputJobsPerSec = Math.round((jobCount / (parallelDurationMs / 1000)) * 10) / 10;

    const stats = this.cacheService.getStats();
    const benchmarkId = `bm-${randomUUID()}`;

    const benchmarkRecord: Benchmark = {
      benchmarkId,
      mode: 'PARALLEL',
      totalJobs: jobCount,
      duration: parallelDurationMs,
      throughput: throughputJobsPerSec,
      cacheHits: stats.hits,
      cacheMisses: stats.misses,
      databaseReads: stats.databaseReads,
      createdAt: new Date().toISOString(),
    };

    await this.repo.createBenchmark(benchmarkRecord);

    return {
      jobCount,
      serialDurationMs,
      parallelDurationMs,
      cachedDurationMs,
      improvementPercentage,
      throughputJobsPerSec,
      cacheHitRate: stats.hitRate,
      databaseReadsSaved: Math.max(0, jobCount - stats.databaseReads),
      serialBatchId: serialRes.batch.batchId,
      parallelBatchId: parallelRes.batch.batchId,
      benchmarkId,
      timestamp: new Date().toISOString(),
    };
  }
}
