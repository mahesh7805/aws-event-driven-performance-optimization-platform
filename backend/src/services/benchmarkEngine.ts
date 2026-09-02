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
 * Benchmark Engine for calculating real-time performance metrics
 * comparing Serial vs Parallel SQS/Lambda vs Parallel + Cache.
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
    const processingMs = options.jobProcessingMs ?? 150;

    // Reset cache stats before benchmark run
    this.repo.resetStats();

    // 1. Run Serial Baseline
    const serialRes = await this.serialProcessor.processBatch({
      jobCount,
      jobProcessingMs: processingMs,
    });
    const serialDurationMs = serialRes.batch.totalDuration || jobCount * processingMs;

    // 2. Run Parallel SQS + Lambda Processing
    const parallelRes = await this.parallelProcessor.processBatch({
      jobCount,
      jobProcessingMs: processingMs,
    });
    const parallelDurationMs = parallelRes.batch.totalDuration || processingMs * 1.2;

    // 3. Run Cached Query Reads for all processed jobs
    const cacheStartTime = Date.now();
    for (const job of parallelRes.jobs) {
      await this.cacheService.getJob(job.jobId);
    }
    const cachedDurationMs = Date.now() - cacheStartTime;

    // Calculate real metrics
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
