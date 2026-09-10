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
    status: 'PENDING' | 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
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

export async function getBatchDetails(batchId: string): Promise<BatchResponse> {
  const res = await fetch(`/api/batches/${batchId}`);
  if (!res.ok) throw new Error(`Failed to fetch batch ${batchId}`);
  return res.json();
}

export interface BatchRecord {
  batchId: string;
  mode: 'SERIAL' | 'PARALLEL' | 'PARALLEL_CACHED';
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  startedAt: string;
  completedAt?: string;
  totalDuration?: number;
  durationMs?: number;
  status?: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | string;
}

export interface BatchesListResponse {
  batches: BatchRecord[];
  totalBatches: number;
  dynamoDbConnected?: boolean;
  batchesTableName?: string | null;
}

export async function getAllBatches(): Promise<BatchesListResponse> {
  const res = await fetch('/api/batches');
  if (!res.ok) throw new Error(`Failed to fetch batches (${res.status})`);
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

export interface TerraformPlanDetails {
  add: number;
  change: number;
  destroy: number;
  noChanges: boolean;
  summaryText: string;
}

export interface TerraformCommandResult {
  command: string;
  success: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  summary?: string;
  planDetails?: TerraformPlanDetails;
  outputs?: Record<string, any>;
  timestamp: string;
  error?: string;
}

export interface TerraformStatus {
  isBusy: boolean;
  currentOperation: string | null;
  terraformDir: string;
  lastRun?: {
    command: string;
    success: boolean;
    timestamp: string;
    durationMs: number;
  };
}

export async function getTerraformStatus(): Promise<TerraformStatus> {
  const res = await fetch('/api/terraform/status');
  if (!res.ok) throw new Error(`Failed to fetch terraform status (${res.status})`);
  return res.json();
}

export async function runTerraformInit(): Promise<TerraformCommandResult> {
  const res = await fetch('/api/terraform/init', { method: 'POST' });
  return res.json();
}

export async function runTerraformValidate(): Promise<TerraformCommandResult> {
  const res = await fetch('/api/terraform/validate', { method: 'POST' });
  return res.json();
}

export async function runTerraformPlan(): Promise<TerraformCommandResult> {
  const res = await fetch('/api/terraform/plan', { method: 'POST' });
  return res.json();
}

export async function runTerraformApply(): Promise<TerraformCommandResult> {
  const res = await fetch('/api/terraform/apply', { method: 'POST' });
  return res.json();
}

export async function runTerraformDestroy(): Promise<TerraformCommandResult> {
  const res = await fetch('/api/terraform/destroy', { method: 'POST' });
  return res.json();
}

export async function getTerraformOutputs(): Promise<TerraformCommandResult> {
  const res = await fetch('/api/terraform/outputs');
  return res.json();
}

export interface CloudSyncStatus {
  dynamoDbConnected: boolean;
  jobsTableName: string | null;
  batchesTableName: string | null;
  sqsConnected: boolean;
  sqsQueueUrl: string | null;
  apiEndpoint: string | null;
  region: string;
}

export async function getCloudSyncStatus(): Promise<CloudSyncStatus> {
  const res = await fetch('/api/infrastructure/sync-status');
  if (!res.ok) throw new Error(`Failed to fetch sync status (${res.status})`);
  return res.json();
}

export interface LambdaConcurrencyDatapoint {
  timestamp: string;
  maximum: number;
  average: number;
  unit: string;
}

export interface LambdaConcurrencyMetrics {
  functionName: string;
  region: string;
  targetConcurrency: number;
  peakMaximum: number;
  latestMaximum: number;
  datapoints: LambdaConcurrencyDatapoint[];
  queryTime: string;
  error?: string;
}

export async function getLambdaConcurrencyMetrics(): Promise<LambdaConcurrencyMetrics> {
  const res = await fetch('/api/metrics/lambda-concurrency');
  if (!res.ok) throw new Error(`Failed to fetch Lambda concurrency metrics (${res.status})`);
  return res.json();
}

