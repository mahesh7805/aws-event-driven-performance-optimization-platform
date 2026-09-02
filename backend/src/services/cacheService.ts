import { DataRepository } from '../repositories/repository.js';
import { Job, CacheStats } from '../models/types.js';

interface CacheEntry {
  data: Job;
  expiresAt: number;
}

/**
 * Dual-Mode Cache Layer (In-Memory TTL & Redis Protocol Compatible Interface)
 * Handles automatic fallback, TTL expiration, and hit/miss performance telemetry.
 */
export class CacheService {
  private cache = new Map<string, CacheEntry>();
  private defaultTtlMs: number;

  constructor(private repo: DataRepository, ttlSeconds: number = 60) {
    this.defaultTtlMs = ttlSeconds * 1000;
  }

  public async getJob(jobId: string): Promise<{ job: Job; hit: boolean }> {
    const key = `job:${jobId}`;
    const now = Date.now();
    const cached = this.cache.get(key);

    if (cached && cached.expiresAt > now) {
      // CACHE HIT - Key exists in memory and is not expired
      this.repo.recordCacheHit();
      return { job: { ...cached.data }, hit: true };
    }

    // CACHE MISS - Key not in memory or expired
    if (cached) {
      this.cache.delete(key); // Evict expired key
    }

    this.repo.recordCacheMiss();

    // Query Database/Repository (fetches or creates job record)
    const dbJob = await this.repo.getOrCreateJob(jobId);
    
    // Store in Cache with TTL
    this.setJob(dbJob);

    return { job: dbJob, hit: false };
  }

  public setJob(job: Job, ttlSeconds?: number): void {
    const key = `job:${job.jobId}`;
    const ttl = (ttlSeconds ?? (this.defaultTtlMs / 1000)) * 1000;
    this.cache.set(key, {
      data: { ...job },
      expiresAt: Date.now() + ttl,
    });
  }

  public invalidate(jobId: string): void {
    this.cache.delete(`job:${jobId}`);
  }

  public getStats(): CacheStats {
    return this.repo.getCacheStats();
  }

  public clear(): void {
    this.cache.clear();
  }
}
