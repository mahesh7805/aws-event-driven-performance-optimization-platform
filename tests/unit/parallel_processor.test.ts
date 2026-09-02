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
    const jobProcessingMs = 50;
    const startTime = Date.now();

    const result = await processor.processBatch({ jobCount: 5, jobProcessingMs });

    const totalDuration = Date.now() - startTime;

    expect(result.batch.totalJobs).toBe(5);
    expect(result.batch.completedJobs).toBe(5);
    expect(result.batch.failedJobs).toBe(0);
    expect(result.jobs).toHaveLength(5);

    // Parallel execution for 5 jobs @ 50ms should take ~50-80ms total (not 250ms serial time)
    expect(totalDuration).toBeLessThan(200);
  });

  it('should enforce idempotency for duplicate job IDs', async () => {
    repo.markProcessed('job-batch-1-1');
    expect(repo.isProcessed('job-batch-1-1')).toBe(true);
  });
});
