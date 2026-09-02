export interface BatchResponse {
  batch: {
    batchId: string;
    mode: 'SERIAL' | 'PARALLEL' | 'PARALLEL_CACHED';
    totalJobs: number;
    completedJobs: number;
    failedJobs: number;
    startedAt: string;
    completedAt?: string;
    totalDuration?: number;
  };
  jobs: Array<{
    jobId: string;
    batchId: string;
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    createdAt: string;
    startedAt?: string;
    completedAt?: string;
    duration?: number;
    result?: any;
    error?: string;
  }>;
}

export interface BenchmarkResponse {
  jobCount: number;
  serialDurationMs: number;
  parallelDurationMs: number;
  cachedDurationMs: number;
  improvementPercentage: number;
  throughputJobsPerSec: number;
  cacheHitRate: number;
  databaseReadsSaved: number;
  serialBatchId: string;
  parallelBatchId: string;
  benchmarkId: string;
  timestamp: string;
}

export interface CacheStatsResponse {
  hits: number;
  misses: number;
  hitRate: number;
  databaseReads: number;
}

export interface JobQueryResponse {
  job: {
    jobId: string;
    batchId: string;
    status: string;
    duration?: number;
    result?: any;
  };
  cacheHit: boolean;
  timestamp: string;
}

export interface FailureSimulationResponse {
  scenario: string;
  status: string;
  sqsAction: string;
  outcome: string;
  timestamp: string;
}

export async function runSerialBatch(jobCount: number, jobProcessingMs: number = 150): Promise<BatchResponse> {
  const res = await fetch('/api/batches/serial', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobCount, jobProcessingMs }),
  });
  if (!res.ok) throw new Error(`Serial execution failed with status ${res.status}`);
  return res.json();
}

export async function runParallelBatch(jobCount: number, jobProcessingMs: number = 150): Promise<BatchResponse> {
  const res = await fetch('/api/batches/parallel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobCount, jobProcessingMs }),
  });
  if (!res.ok) throw new Error(`Parallel execution failed with status ${res.status}`);
  return res.json();
}

export async function runBenchmark(jobCount: number, jobProcessingMs: number = 150): Promise<BenchmarkResponse> {
  const res = await fetch('/api/benchmarks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobCount, jobProcessingMs }),
  });
  if (!res.ok) throw new Error(`Benchmark execution failed with status ${res.status}`);
  return res.json();
}

export async function getCacheStats(): Promise<CacheStatsResponse> {
  const res = await fetch('/api/cache/stats');
  if (!res.ok) throw new Error(`Failed to fetch cache stats (${res.status})`);
  return res.json();
}

export async function queryJobWithCache(jobId: string): Promise<JobQueryResponse> {
  const res = await fetch(`/api/jobs/${jobId}`);
  if (!res.ok) throw new Error(`Job lookup failed with status ${res.status}`);
  return res.json();
}

export async function simulateFailure(scenario: string): Promise<FailureSimulationResponse> {
  const res = await fetch('/api/failure-lab/simulate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenario }),
  });
  if (!res.ok) throw new Error(`Failure simulation failed (${res.status})`);
  return res.json();
}
