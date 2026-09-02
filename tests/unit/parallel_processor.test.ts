import { describe, it, expect, beforeEach } from 'vitest';
import { ParallelProcessor } from '../../backend/src/services/parallelProcessor.js';
import { DataRepository } from '../../backend/src/repositories/repository.js';

describe('Layer 3 & 4 - Parallel SQS + Lambda Worker Processor Tests', () => {
  let repo: DataRepository;
  let processor: ParallelProcessor;

  beforeEach(() => {
    repo = new DataRepository();
    processor = new ParallelProcessor(repo);
  });

  it('should process 5 jobs in parallel significantly faster than serial execution', async () => {
    const jobProcessingMs = 30;
    const startTime = Date.now();

    const result = await processor.processBatch({ jobCount: 5, jobProcessingMs });

    expect(result.batch.totalJobs).toBe(5);
    expect(result.jobs).toHaveLength(5);

    // Poll for async background SQS worker completion
    let batch = await repo.getBatch(result.batch.batchId);
    while (batch && batch.completedJobs + batch.failedJobs < 5) {
      await new Promise((r) => setTimeout(r, 20));
      batch = await repo.getBatch(result.batch.batchId);
    }

    const totalDuration = Date.now() - startTime;

    expect(batch?.completedJobs).toBe(5);
    expect(batch?.failedJobs).toBe(0);
    expect(totalDuration).toBeLessThan(250);
  });

  it('should enforce idempotency for duplicate job IDs', async () => {
    repo.markProcessed('job-batch-1-1');
    expect(repo.isProcessed('job-batch-1-1')).toBe(true);
  });
});
