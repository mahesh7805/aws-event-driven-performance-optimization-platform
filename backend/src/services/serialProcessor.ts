import { randomUUID } from 'crypto';
import { Job, Batch } from '../models/types.js';
import { DataRepository } from '../repositories/repository.js';
import { globalEventLogService } from './eventLogService.js';

export interface SerialProcessorOptions {
  jobCount: number;
  jobProcessingMs?: number;
}

/**
 * Deterministic synchronous job workload simulator.
 * Calculates CPU work and optionally waits for specified simulation delay (defaults to 0ms).
 */
export async function executeDeterministicWorkload(jobIndex: number, processingMs: number): Promise<Record<string, any>> {
  const startTime = Date.now();

  // Perform deterministic CPU math calculation
  let sum = 0;
  for (let i = 1; i <= 10000; i++) {
    sum += Math.sqrt(i * jobIndex);
  }

  // Explicit simulation delay: only sleeps if > 0
  if (processingMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, processingMs));
  }

  const durationMs = Date.now() - startTime;

  return {
    jobIndex,
    computedChecksum: Math.round(sum * 100) / 100,
    simulatedDurationMs: durationMs,
  };
}

/**
 * Serial Batch Processor
 * Processes a sequence of N independent jobs synchronously in series via a single execution path.
 * Concurrency is strictly 1.
 */
export class SerialProcessor {
  constructor(private repo: DataRepository) {}

  public async processBatch(options: SerialProcessorOptions): Promise<{ batch: Batch; jobs: Job[] }> {
    const jobCount = Math.max(1, Math.min(500, options.jobCount));
    const processingMs = options.jobProcessingMs ?? 0;

    const batchId = `batch-serial-${randomUUID()}`;
    const startedAt = new Date().toISOString();
    const startTime = Date.now();

    globalEventLogService.log('BATCH', `[Serial] Initialized batch ${batchId} for ${jobCount} jobs`, 'INFO', batchId);

    const batch: Batch = {
      batchId,
      mode: 'SERIAL',
      status: 'PROCESSING',
      totalJobs: jobCount,
      completedJobs: 0,
      failedJobs: 0,
      queuedJobs: jobCount,
      startedAt,
      peakConcurrency: 1,
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
        mode: 'SERIAL',
        workerId: 'serial-worker-singleton',
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
          processingTime: duration,
          mode: 'SERIAL',
          workerId: 'serial-worker-singleton',
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
          mode: 'SERIAL',
          workerId: 'serial-worker-singleton',
        });
        if (failedJob) jobs.push(failedJob);
        batch.failedJobs++;
      }
    }

    const totalDurationMs = Date.now() - startTime;
    const completedAt = new Date().toISOString();
    const throughput = Math.round((batch.completedJobs / (totalDurationMs / 1000)) * 10) / 10;
    const avgDuration = Math.round((totalDurationMs / jobCount) * 10) / 10;

    const finalBatch: Batch = {
      ...batch,
      status: 'COMPLETED',
      queuedJobs: 0,
      completedAt,
      durationMs: totalDurationMs,
      totalDuration: totalDurationMs,
      averageJobDuration: avgDuration,
      throughput,
      peakConcurrency: 1,
    };

    await this.repo.updateBatch(batchId, finalBatch);

    globalEventLogService.log(
      'BATCH',
      `[Serial] Completed ${batch.completedJobs}/${jobCount} jobs in ${(totalDurationMs / 1000).toFixed(2)}s (${throughput} jobs/sec, Peak Concurrency: 1)`,
      'SUCCESS',
      batchId
    );

    return { batch: finalBatch, jobs };
  }
}
