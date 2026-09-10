export type JobStatus = 'PENDING' | 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
export type ProcessingMode = 'SERIAL' | 'PARALLEL' | 'PARALLEL_CACHED';

export interface Job {
  jobId: string;
  batchId: string;
  status: JobStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  processingTime?: number;
  duration?: number;
  mode?: ProcessingMode;
  workerId?: string;
  requestId?: string;
  result?: Record<string, any> | string | number;
  error?: string;
}

export interface Batch {
  batchId: string;
  mode: ProcessingMode;
  status?: JobStatus;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  queuedJobs?: number;
  startedAt: string;
  completedAt?: string;
  totalDuration?: number;
  durationMs?: number;
  averageJobDuration?: number;
  throughput?: number;
  peakConcurrency?: number;
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

export interface SystemMetrics {
  timestamp: string;
  sqs: {
    queueUrl: string | null;
    approximateNumberOfMessages: number;
    approximateNumberOfMessagesNotVisible: number;
    approximateNumberOfMessagesDelayed: number;
    messagesReceived24h?: number;
    messagesDeleted24h?: number;
    oldestMessageAgeSeconds?: number;
  };
  lambda: {
    functionName: string;
    configuredConcurrencyLimit: number;
    currentConcurrency: number;
    peakConcurrency: number;
    invocations?: number;
    errors?: number;
    throttles?: number;
    avgDurationMs?: number;
  };
  application: {
    totalBatches: number;
    totalJobsCompleted: number;
    totalJobsFailed: number;
    averageJobDurationMs: number;
    latestBatchThroughput: number;
  };
}
