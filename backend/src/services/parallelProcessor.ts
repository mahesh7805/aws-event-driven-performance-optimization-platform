import { randomUUID } from 'crypto';
import { Job, Batch } from '../models/types.js';
import { DataRepository } from '../repositories/repository.js';
import { executeDeterministicWorkload } from './serialProcessor.js';

export interface ParallelProcessorOptions {
  jobCount: number;
  jobProcessingMs?: number;
  maxConcurrency?: number;
}

export interface SQSMessagePayload {
  jobId: string;
  batchId: string;
  jobIndex: number;
  totalJobs: number;
  processingMs: number;
}

/**
 * Parallel SQS + Lambda Worker Processor.
 * Handles job counts from 10 to 500+ with concurrent worker pool execution and real-time state tracking.
 */
export class ParallelProcessor {
  constructor(private repo: DataRepository) {}

  public async processBatch(options: ParallelProcessorOptions): Promise<{ batch: Batch; jobs: Job[] }> {
    const jobCount = Math.max(1, Math.min(500, options.jobCount));
    const processingMs = options.jobProcessingMs ?? 50; // Optimized default processing per worker
    const maxConcurrency = options.maxConcurrency ?? 50;

    const batchId = `batch-parallel-${randomUUID()}`;
    const startedAt = new Date().toISOString();
    const startTime = Date.now();

    const batch: Batch = {
      batchId,
      mode: 'PARALLEL',
      totalJobs: jobCount,
      completedJobs: 0,
      failedJobs: 0,
      startedAt,
    };

    await this.repo.createBatch(batch);

    // Step 1: Enqueue all SQS Messages in QUEUED state
    const sqsQueue: SQSMessagePayload[] = [];
    for (let i = 1; i <= jobCount; i++) {
      const jobId = `job-${batchId}-${i}`;
      const jobCreated = new Date().toISOString();

      await this.repo.createJob({
        jobId,
        batchId,
        status: 'QUEUED',
        createdAt: jobCreated,
      });

      sqsQueue.push({
        jobId,
        batchId,
        jobIndex: i,
        totalJobs: jobCount,
        processingMs,
      });
    }

    // Step 2: Fan-out processing across simulated Lambda worker pool in concurrent chunks
    const jobs: Job[] = [];

    // Helper to process a single SQS message worker execution
    const processSingleMessage = async (msg: SQSMessagePayload): Promise<Job | null> => {
      // Check Idempotency Key
      if (this.repo.isProcessed(msg.jobId)) {
        const existing = await this.repo.getJob(msg.jobId);
        if (existing) return existing;
      }

      const workerStartedAt = new Date().toISOString();
      await this.repo.updateJob(msg.jobId, {
        status: 'PROCESSING',
        startedAt: workerStartedAt,
      });

      try {
        // Execute deterministic workload in worker
        const result = await executeDeterministicWorkload(msg.jobIndex, msg.processingMs);
        const workerCompletedAt = new Date().toISOString();
        const duration = Date.now() - new Date(workerStartedAt).getTime();

        this.repo.markProcessed(msg.jobId);

        const updated = await this.repo.updateJob(msg.jobId, {
          status: 'COMPLETED',
          completedAt: workerCompletedAt,
          duration,
          result,
        });

        if (updated) {
          batch.completedJobs++;
          await this.repo.updateBatch(batchId, { completedJobs: batch.completedJobs });
          return updated;
        }
      } catch (err: any) {
        batch.failedJobs++;
        await this.repo.updateBatch(batchId, { failedJobs: batch.failedJobs });
        const failed = await this.repo.updateJob(msg.jobId, {
          status: 'FAILED',
          error: err.message || 'Worker processing failed',
        });
        if (failed) return failed;
      }
      return null;
    };

    // Execute messages in concurrency-bounded batches to prevent thread exhaustion for 500+ jobs
    for (let i = 0; i < sqsQueue.length; i += maxConcurrency) {
      const chunk = sqsQueue.slice(i, i + maxConcurrency);
      const chunkResults = await Promise.all(chunk.map(processSingleMessage));
      for (const res of chunkResults) {
        if (res) jobs.push(res);
      }
    }

    const totalDuration = Date.now() - startTime;
    const completedAt = new Date().toISOString();

    const updatedBatch = await this.repo.updateBatch(batchId, {
      completedJobs: batch.completedJobs,
      failedJobs: batch.failedJobs,
      completedAt,
      totalDuration,
    });

    return {
      batch: updatedBatch || batch,
      jobs,
    };
  }
}
