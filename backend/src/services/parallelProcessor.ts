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
 * Parallel SQS + Lambda Worker Processor Simulator.
 * Models AWS SQS message fan-out and concurrent Lambda worker processing pool.
 */
export class ParallelProcessor {
  constructor(private repo: DataRepository) {}

  public async processBatch(options: ParallelProcessorOptions): Promise<{ batch: Batch; jobs: Job[] }> {
    const jobCount = Math.max(1, Math.min(200, options.jobCount));
    const processingMs = options.jobProcessingMs ?? 200;
    const maxConcurrency = options.maxConcurrency ?? 20;

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

    // Step 1: Enqueue all SQS Messages
    const sqsQueue: SQSMessagePayload[] = [];
    for (let i = 1; i <= jobCount; i++) {
      const jobId = `job-${batchId}-${i}`;
      const jobCreated = new Date().toISOString();

      await this.repo.createJob({
        jobId,
        batchId,
        status: 'PENDING',
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

    // Step 2: Fan-out processing across simulated Lambda worker pool concurrently
    const jobs: Job[] = [];

    // Chunk messages into concurrent worker execution batches
    const workerPromises = sqsQueue.map(async (msg) => {
      // Check Idempotency Key
      if (this.repo.isProcessed(msg.jobId)) {
        console.log(`[Idempotency] Message ${msg.jobId} already processed. Skipping duplicate execution.`);
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

        // Mark processed for idempotency
        this.repo.markProcessed(msg.jobId);

        const updated = await this.repo.updateJob(msg.jobId, {
          status: 'COMPLETED',
          completedAt: workerCompletedAt,
          duration,
          result,
        });

        if (updated) {
          batch.completedJobs++;
          return updated;
        }
      } catch (err: any) {
        batch.failedJobs++;
        const failed = await this.repo.updateJob(msg.jobId, {
          status: 'FAILED',
          error: err.message || 'Worker processing failed',
        });
        if (failed) return failed;
      }
      return null;
    });

    const processedResults = await Promise.all(workerPromises);
    for (const res of processedResults) {
      if (res) jobs.push(res);
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
