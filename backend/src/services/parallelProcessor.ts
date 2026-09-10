import { randomUUID } from 'crypto';
import { SQSClient, SendMessageBatchCommand, SendMessageBatchRequestEntry } from '@aws-sdk/client-sqs';
import { Job, Batch } from '../models/types.js';
import { DataRepository } from '../repositories/repository.js';
import { executeDeterministicWorkload } from './serialProcessor.js';
import { globalTerraformService } from './terraformService.js';
import { globalEventLogService } from './eventLogService.js';

export interface ParallelProcessorOptions {
  jobCount: number;
  jobProcessingMs?: number;
  simulationDelayMs?: number;
  failJobId?: string; // Optional for failure testing
}

export interface SQSMessagePayload {
  jobId: string;
  batchId: string;
  jobIndex: number;
  totalJobs: number;
  processingMs: number;
  simulationDelayMs: number;
  isPoisonPill?: boolean;
}

const SQS_MAX_BATCH_SIZE = 10;

/**
 * Decoupled Event-Driven Parallel SQS Processor.
 * Enqueues messages to SQS in chunks of max 10, returning batch ID immediately in QUEUED state.
 * AWS Lambda consumes via SQS Event Source Mapping and autoscales dynamically up to reserved limit.
 */
export class ParallelProcessor {
  constructor(private repo: DataRepository) {}

  private getSqsClient(): SQSClient {
    const region = globalTerraformService.getAwsRegion();
    return new SQSClient({
      region,
      endpoint: process.env.AWS_ENDPOINT || undefined,
    });
  }

  public async processBatch(options: ParallelProcessorOptions): Promise<{ batch: Batch; jobs: Job[] }> {
    const jobCount = Math.max(1, Math.min(500, options.jobCount));
    const processingMs = options.simulationDelayMs ?? options.jobProcessingMs ?? 0;

    const batchId = `batch-parallel-${randomUUID()}`;
    const startedAt = new Date().toISOString();

    const batch: Batch = {
      batchId,
      mode: 'PARALLEL',
      totalJobs: jobCount,
      completedJobs: 0,
      failedJobs: 0,
      queuedJobs: jobCount,
      startedAt,
    };

    await this.repo.createBatch(batch);
    globalEventLogService.log('BATCH', `[Parallel] Initialized batch ${batchId} for ${jobCount} jobs`, 'INFO', batchId);

    const jobs: Job[] = [];
    const sqsMessages: SQSMessagePayload[] = [];

    // Step 1: Initialize all jobs in QUEUED status (and persist to DynamoDB)
    for (let i = 1; i <= jobCount; i++) {
      const jobId = `job-${batchId}-${i}`;
      const isPoisonPill = options.failJobId === jobId || (options.failJobId === 'all' && i === 1);

      const job: Job = {
        jobId,
        batchId,
        status: 'QUEUED',
        createdAt: new Date().toISOString(),
        mode: 'PARALLEL',
      };

      await this.repo.createJob(job);
      jobs.push(job);

      sqsMessages.push({
        jobId,
        batchId,
        jobIndex: i,
        totalJobs: jobCount,
        processingMs,
        simulationDelayMs: processingMs,
        isPoisonPill,
      });
    }

    // Step 2: Enqueue to SQS in batches of max 10 (Strict AWS SendMessageBatch limit)
    const queueUrl = process.env.NODE_ENV === 'test' ? undefined : globalTerraformService.getSqsQueueUrl();

    if (queueUrl) {
      const entries: SendMessageBatchRequestEntry[] = sqsMessages.map((msg) => ({
        Id: msg.jobId.replace(/[^a-zA-Z0-9_-]/g, '_'),
        MessageBody: JSON.stringify(msg),
      }));

      try {
        const client = this.getSqsClient();
        for (let i = 0; i < entries.length; i += SQS_MAX_BATCH_SIZE) {
          const batchChunk = entries.slice(i, i + SQS_MAX_BATCH_SIZE);
          await client.send(
            new SendMessageBatchCommand({
              QueueUrl: queueUrl,
              Entries: batchChunk,
            })
          );
        }
        globalEventLogService.log(
          'SQS',
          `[Parallel] Dispatched ${sqsMessages.length} jobs to SQS queue (${queueUrl}) in chunks of 10`,
          'SUCCESS',
          batchId
        );
        globalEventLogService.log(
          'LAMBDA',
          `[Parallel] AWS SQS Event Source Mapping polling backlog; dynamic Lambda autoscaling active`,
          'INFO',
          batchId
        );
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        globalEventLogService.log('SQS', `[Parallel Warning] SQS dispatch error: ${errMsg}`, 'WARN', batchId);
        // Fall back to local worker simulation if SQS dispatch fails
        setImmediate(() => {
          this.dispatchBackgroundWorkers(batchId, sqsMessages).catch(console.error);
        });
      }
    } else {
      // Local fallback for offline development / unit tests
      setImmediate(() => {
        this.dispatchBackgroundWorkers(batchId, sqsMessages).catch(console.error);
      });
    }

    // Return IMMEDIATELY while jobs are in QUEUED status (Decoupled event-driven model)
    return { batch, jobs };
  }

  /**
   * Background Async Worker Pool.
   * Simulates asynchronous SQS consumer worker handling in background only when running offline or in unit tests.
   */
  private async dispatchBackgroundWorkers(batchId: string, messages: SQSMessagePayload[]): Promise<void> {
    const maxConcurrency = 10;

    const processSingleWorker = async (msg: SQSMessagePayload) => {
      // Check Idempotency Key
      if (this.repo.isProcessed(msg.jobId)) {
        return;
      }

      const workerStartedAt = new Date().toISOString();
      const mockWorkerId = `local-worker-${(msg.jobIndex % 10) + 1}`;
      await this.repo.updateJob(msg.jobId, {
        status: 'PROCESSING',
        startedAt: workerStartedAt,
        workerId: mockWorkerId,
        requestId: mockWorkerId,
      });

      try {
        if (msg.isPoisonPill) {
          throw new Error(`Poison pill payload detected for job ${msg.jobId}`);
        }

        const result = await executeDeterministicWorkload(msg.jobIndex, msg.processingMs);
        const workerCompletedAt = new Date().toISOString();
        const duration = Date.now() - new Date(workerStartedAt).getTime();

        this.repo.markProcessed(msg.jobId);

        await this.repo.updateJob(msg.jobId, {
          status: 'COMPLETED',
          completedAt: workerCompletedAt,
          duration,
          processingTime: duration,
          workerId: mockWorkerId,
          requestId: mockWorkerId,
          result,
        });

        const currentBatch = await this.repo.getBatch(batchId);
        if (currentBatch) {
          const completedJobs = currentBatch.completedJobs + 1;
          const isFinished = completedJobs + currentBatch.failedJobs >= currentBatch.totalJobs;
          await this.repo.updateBatch(batchId, {
            completedJobs,
            queuedJobs: Math.max(0, currentBatch.totalJobs - completedJobs - currentBatch.failedJobs),
            ...(isFinished ? { completedAt: new Date().toISOString(), totalDuration: Date.now() - new Date(currentBatch.startedAt).getTime() } : {}),
          });
        }
      } catch (err: any) {
        await this.repo.updateJob(msg.jobId, {
          status: 'FAILED',
          error: err.message || 'Worker processing failed',
          workerId: mockWorkerId,
          requestId: mockWorkerId,
        });

        const currentBatch = await this.repo.getBatch(batchId);
        if (currentBatch) {
          const failedJobs = currentBatch.failedJobs + 1;
          const isFinished = currentBatch.completedJobs + failedJobs >= currentBatch.totalJobs;
          await this.repo.updateBatch(batchId, {
            failedJobs,
            queuedJobs: Math.max(0, currentBatch.totalJobs - currentBatch.completedJobs - failedJobs),
            ...(isFinished ? { completedAt: new Date().toISOString(), totalDuration: Date.now() - new Date(currentBatch.startedAt).getTime() } : {}),
          });
        }
      }
    };

    // Execute background worker pool in concurrent chunks
    for (let i = 0; i < messages.length; i += maxConcurrency) {
      const chunk = messages.slice(i, i + maxConcurrency);
      await Promise.all(chunk.map(processSingleWorker));
    }
  }
}
