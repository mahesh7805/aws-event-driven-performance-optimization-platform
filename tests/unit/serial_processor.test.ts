import { describe, it, expect, beforeEach } from 'vitest';
import { SerialProcessor } from '../../backend/src/services/serialProcessor.js';
import { DataRepository } from '../../backend/src/repositories/repository.js';

describe('Layer 2 - Serial Processor Tests', () => {
  let repo: DataRepository;
  let processor: SerialProcessor;

  beforeEach(() => {
    repo = new DataRepository();
    processor = new SerialProcessor(repo);
  });

  it('should process 3 serial jobs sequentially and record correct total duration', async () => {
    const jobProcessingMs = 50; // Use small ms for fast unit tests
    const result = await processor.processBatch({ jobCount: 3, jobProcessingMs });

    expect(result.batch.totalJobs).toBe(3);
    expect(result.batch.completedJobs).toBe(3);
    expect(result.batch.failedJobs).toBe(0);
    expect(result.jobs).toHaveLength(3);

    // Total duration should be at least 3 * 50ms = 150ms
    expect(result.batch.totalDuration).toBeGreaterThanOrEqual(140);
  });

  it('should store deterministic calculation results for each job', async () => {
    const result = await processor.processBatch({ jobCount: 2, jobProcessingMs: 10 });

    expect(result.jobs[0].result).toBeDefined();
    expect((result.jobs[0].result as any).jobIndex).toBe(1);
    expect((result.jobs[1].result as any).jobIndex).toBe(2);
  });
});
