import { describe, it, expect, beforeEach } from 'vitest';
import { DataRepository } from '../../backend/src/repositories/repository.js';
import { Job, Batch, Benchmark } from '../../backend/src/models/types.js';

describe('Layer 1 - Data Model & Repository CRUD Tests', () => {
  let repo: DataRepository;

  beforeEach(() => {
    repo = new DataRepository();
  });

  it('should create and retrieve a Job entity', async () => {
    const job: Job = {
      jobId: 'job-123',
      batchId: 'batch-456',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };

    await repo.createJob(job);
    const retrieved = await repo.getJob('job-123');

    expect(retrieved).not.toBeNull();
    expect(retrieved?.jobId).toBe('job-123');
    expect(retrieved?.status).toBe('PENDING');
  });

  it('should update a Job status and duration', async () => {
    const job: Job = {
      jobId: 'job-1',
      batchId: 'batch-1',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };

    await repo.createJob(job);
    const updated = await repo.updateJob('job-1', {
      status: 'COMPLETED',
      duration: 215,
      completedAt: new Date().toISOString(),
    });

    expect(updated?.status).toBe('COMPLETED');
    expect(updated?.duration).toBe(215);
  });

  it('should create and retrieve a Batch with nested jobs', async () => {
    const batch: Batch = {
      batchId: 'batch-1',
      mode: 'SERIAL',
      totalJobs: 2,
      completedJobs: 2,
      failedJobs: 0,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      totalDuration: 410,
    };

    await repo.createBatch(batch);
    await repo.createJob({ jobId: 'j-1', batchId: 'batch-1', status: 'COMPLETED', createdAt: new Date().toISOString() });
    await repo.createJob({ jobId: 'j-2', batchId: 'batch-1', status: 'COMPLETED', createdAt: new Date().toISOString() });

    const retrievedBatch = await repo.getBatch('batch-1');
    const jobs = await repo.getJobsByBatch('batch-1');

    expect(retrievedBatch?.totalJobs).toBe(2);
    expect(jobs).toHaveLength(2);
  });

  it('should create and calculate benchmark metrics', async () => {
    const bench: Benchmark = {
      benchmarkId: 'bench-1',
      mode: 'PARALLEL',
      totalJobs: 50,
      duration: 850,
      throughput: 58.82,
      cacheHits: 0,
      cacheMisses: 50,
      databaseReads: 50,
      createdAt: new Date().toISOString(),
    };

    await repo.createBenchmark(bench);
    const retrieved = await repo.getBenchmark('bench-1');
    expect(retrieved?.throughput).toBe(58.82);
  });

  it('should track idempotency keys correctly', () => {
    expect(repo.isProcessed('msg-id-123')).toBe(false);
    repo.markProcessed('msg-id-123');
    expect(repo.isProcessed('msg-id-123')).toBe(true);
  });

  it('should accurately calculate cache hit rates and database reads', () => {
    repo.recordCacheHit();
    repo.recordCacheHit();
    repo.recordCacheMiss();

    const stats = repo.getCacheStats();
    expect(stats.hits).toBe(2);
    expect(stats.misses).toBe(1);
    expect(stats.hitRate).toBe(0.6667);
  });

  it('should report cloud sync status correctly', () => {
    const status = repo.getCloudSyncStatus();
    expect(status).toHaveProperty('dynamoDbConnected');
    expect(status).toHaveProperty('region');
    expect(typeof status.region).toBe('string');
  });

  it('should gracefully handle job creation and updates with or without cloud persistence', async () => {
    const job: Job = {
      jobId: 'job-resilience-1',
      batchId: 'batch-resilience-1',
      status: 'QUEUED',
      createdAt: new Date().toISOString(),
    };

    const created = await repo.createJob(job);
    expect(created.jobId).toBe('job-resilience-1');
    expect(created.status).toBe('QUEUED');

    const updated = await repo.updateJob('job-resilience-1', {
      status: 'COMPLETED',
      duration: 50,
      completedAt: new Date().toISOString(),
    });
    expect(updated?.status).toBe('COMPLETED');
    expect(updated?.duration).toBe(50);
  });
});
