import { randomUUID } from 'crypto';
import { Job, Batch } from '../models/types.js';
import { DataRepository } from '../repositories/repository.js';

export interface SerialProcessorOptions {
  jobCount: number;
  jobProcessingMs?: number;
}

/**
 * Deterministic synchronous job workload simulator.
 * Calculates Fibonacci or CPU work and waits for specified duration.
 */
export async function executeDeterministicWorkload(jobIndex: number, processingMs: number): Promise<Record<string, any>> {
  const startTime = Date.now();

  // Perform deterministic CPU math calculation
  let sum = 0;
  for (let i = 1; i <= 10000; i++) {
    sum += Math.sqrt(i * jobIndex);
  }

  // Simulate I/O or processing duration delay deterministically
  const targetMs = Math.max(10, processingMs);
  await new Promise((resolve) => setTimeout(resolve, targetMs));

  const durationMs = Date.now() - startTime;

  return {
    jobIndex,
    computedChecksum: Math.round(sum * 100) / 100,
    simulatedDurationMs: durationMs,
  };
}

/**
 * Serial Batch Processor
 * Processes a sequence of N independent jobs synchronously in series.
 */
export class SerialProcessor {
  constructor(private repo: DataRepository) {}

  public async processBatch(options: SerialProcessorOptions): Promise<{ batch: Batch; jobs: Job[] }> {
    const jobCount = Math.max(1, Math.min(200, options.jobCount));
    const processingMs = options.jobProcessingMs ?? 200;

    const batchId = `batch-serial-${randomUUID()}`;
    const startedAt = new Date().toISOString();
    const startTime = Date.now();

    const batch: Batch = {
      batchId,
      mode: 'SERIAL',
      totalJobs: jobCount,
      completedJobs: 0,
      failedJobs: 0,
      startedAt,
    };

    await this.repo.createBatch(batch);

    const jobs: Job[] = [];

    // Process jobs sequentially (Serial Paradigm)
    for (let i = 1; i <= jobCount; i++) {
      const jobId = `job-${batchId}-${i}`;
      const jobStartedAt = new Date().toISOString();

      const initialJob: Job = {
        jobId,
        batchId,
        status: 'PROCESSING',
        createdAt: jobStartedAt,
        startedAt: jobStartedAt,
      };

      await this.repo.createJob(initialJob);

      try {
        const result = await executeDeterministicWorkload(i, processingMs);
        const jobCompletedAt = new Date().toISOString();
        const duration = Date.now() - new Date(jobStartedAt).getTime();

        const completedJob = await this.repo.updateJob(jobId, {
          status: 'COMPLETED',
          completedAt: jobCompletedAt,
          duration,
          result,
        });

        if (completedJob) {
          jobs.push(completedJob);
          batch.completedJobs++;
        }
      } catch (err: any) {
        const failedJob = await this.repo.updateJob(jobId, {
          status: 'FAILED',
          error: err.message || 'Processing failed',
        });
        if (failedJob) jobs.push(failedJob);
        batch.failedJobs++;
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
