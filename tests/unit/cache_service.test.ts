import { describe, it, expect, beforeEach } from 'vitest';
import { CacheService } from '../../backend/src/services/cacheService.js';
import { DataRepository } from '../../backend/src/repositories/repository.js';
import { Job } from '../../backend/src/models/types.js';

describe('Layer 5 - Cache Service Tests', () => {
  let repo: DataRepository;
  let cacheService: CacheService;

  beforeEach(() => {
    repo = new DataRepository();
    cacheService = new CacheService(repo, 60); // 60 sec TTL
  });

  it('should record CACHE MISS on first request, then CACHE HIT on second request', async () => {
    const job: Job = {
      jobId: 'job-cache-1',
      batchId: 'batch-1',
      status: 'COMPLETED',
      createdAt: new Date().toISOString(),
      duration: 150,
    };

    await repo.createJob(job);

    // Request 1: Expect Cache Miss (must query DB)
    const req1 = await cacheService.getJob('job-cache-1');
    expect(req1.hit).toBe(false);
    expect(req1.job?.jobId).toBe('job-cache-1');

    // Request 2: Expect Cache Hit (from memory)
    const req2 = await cacheService.getJob('job-cache-1');
    expect(req2.hit).toBe(true);
    expect(req2.job?.jobId).toBe('job-cache-1');

    const stats = cacheService.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.databaseReads).toBe(1); // Only 1 read for the miss
    expect(stats.hitRate).toBe(0.5);
  });

  it('should expire entry after TTL', async () => {
    const shortCache = new CacheService(repo, 0.05); // 50ms TTL
    const job: Job = {
      jobId: 'job-ttl-1',
      batchId: 'batch-1',
      status: 'COMPLETED',
      createdAt: new Date().toISOString(),
    };
    await repo.createJob(job);

    // Initial query
    await shortCache.getJob('job-ttl-1');

    // Wait 70ms for TTL to expire
    await new Promise((res) => setTimeout(res, 70));

    // Subsequent query should miss
    const res = await shortCache.getJob('job-ttl-1');
    expect(res.hit).toBe(false);
  });
});
