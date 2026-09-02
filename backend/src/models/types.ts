export type JobStatus = 'PENDING' | 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
export type ProcessingMode = 'SERIAL' | 'PARALLEL' | 'PARALLEL_CACHED';

export interface Job {
  jobId: string;
  batchId: string;
  status: JobStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  duration?: number;
  result?: Record<string, any> | string | number;
  error?: string;
}

export interface Batch {
  batchId: string;
  mode: ProcessingMode;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  startedAt: string;
  completedAt?: string;
  totalDuration?: number;
}

export interface Benchmark {
  benchmarkId: string;
  mode: ProcessingMode;
  totalJobs: number;
  duration: number; // ms
  throughput: number; // jobs/sec
  cacheHits: number;
  cacheMisses: number;
  databaseReads: number;
  createdAt: string;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  databaseReads: number;
}
