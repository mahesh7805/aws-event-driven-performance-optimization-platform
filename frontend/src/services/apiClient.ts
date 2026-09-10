export interface BatchResponse {
  batch: {
    batchId: string;
    mode: 'SERIAL' | 'PARALLEL' | 'PARALLEL_CACHED';
    totalJobs: number;
    completedJobs: number;
    failedJobs: number;
    queuedJobs?: number;
    startedAt: string;
    completedAt?: string;
    totalDuration?: number;
    averageJobDuration?: number;
    throughput?: number;
    peakConcurrency?: number;
  };
  jobs: Array<{
    jobId: string;
    batchId: string;
    status: 'PENDING' | 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    createdAt: string;
    startedAt?: string;
    completedAt?: string;
    duration?: number;
    processingTime?: number;
    mode?: 'SERIAL' | 'PARALLEL' | 'PARALLEL_CACHED';
    workerId?: string;
    requestId?: string;
    result?: any;
    error?: string;
  }>;
  concurrencyTimeline?: Array<{ timeMs: number; concurrency: number }>;
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
  serialPeakConcurrency?: number;
  parallelPeakConcurrency?: number;
  speedupMultiplier?: number;
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

export interface BatchRecord {
  batchId: string;
  mode: 'SERIAL' | 'PARALLEL' | 'PARALLEL_CACHED';
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  queuedJobs?: number;
  startedAt: string;
  completedAt?: string;
  totalDuration?: number;
  durationMs?: number;
  throughput?: number;
  peakConcurrency?: number;
  status?: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | string;
}

export interface BatchesListResponse {
  batches: BatchRecord[];
  totalBatches: number;
  dynamoDbConnected?: boolean;
  batchesTableName?: string | null;
}

export interface SystemMetricsResponse {
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

export interface EventLogItem {
  id: string;
  timestamp: string;
  timeFormatted: string;
  category: 'BATCH' | 'SQS' | 'LAMBDA' | 'DYNAMODB' | 'SYSTEM';
  level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';
  message: string;
  batchId?: string;
  metadata?: Record<string, any>;
}

export interface LogsResponse {
  logs: EventLogItem[];
  count: number;
}

export interface PaginatedJobsResponse {
  jobs: Array<{
    jobId: string;
    batchId: string;
    status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    createdAt: string;
    startedAt?: string;
    completedAt?: string;
    duration?: number;
    processingTime?: number;
    mode?: string;
    workerId?: string;
    requestId?: string;
    error?: string;
    result?: any;
  }>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ==========================================
// Batch Operations
// ==========================================

export async function createBatch(params: {
  mode: 'SERIAL' | 'PARALLEL';
  jobCount: number;
  simulationDelayMs?: number;
}): Promise<BatchResponse> {
  const res = await fetch('/api/batches', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`Batch creation failed with status ${res.status}`);
  return res.json();
}

export async function runSerialBatch(jobCount: number, simulationDelayMs: number = 0): Promise<BatchResponse> {
  return createBatch({ mode: 'SERIAL', jobCount, simulationDelayMs });
}

export async function runParallelBatch(jobCount: number, simulationDelayMs: number = 0): Promise<BatchResponse> {
  return createBatch({ mode: 'PARALLEL', jobCount, simulationDelayMs });
}

export async function getBatchDetails(batchId: string): Promise<BatchResponse> {
  const res = await fetch(`/api/batches/${batchId}`);
  if (!res.ok) throw new Error(`Failed to fetch batch ${batchId}`);
  return res.json();
}

export async function getPaginatedJobs(batchId: string, page = 1, limit = 50): Promise<PaginatedJobsResponse> {
  const res = await fetch(`/api/batches/${batchId}/jobs?page=${page}&limit=${limit}`);
  if (!res.ok) throw new Error(`Failed to fetch jobs for batch ${batchId}`);
  return res.json();
}

export async function getAllBatches(): Promise<BatchesListResponse> {
  const res = await fetch('/api/batches');
  if (!res.ok) throw new Error(`Failed to fetch batches (${res.status})`);
  return res.json();
}

// ==========================================
// Metrics & Observability Operations
// ==========================================

export async function getSystemMetrics(): Promise<SystemMetricsResponse> {
  const res = await fetch('/api/metrics/system');
  if (!res.ok) throw new Error(`Failed to fetch system metrics (${res.status})`);
  return res.json();
}

export async function getExecutionLogs(batchId?: string, limit = 100): Promise<LogsResponse> {
  const url = batchId ? `/api/logs?batchId=${batchId}&limit=${limit}` : `/api/logs?limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch logs (${res.status})`);
  return res.json();
}

export async function runBenchmark(jobCount: number, simulationDelayMs: number = 0): Promise<BenchmarkResponse> {
  const res = await fetch('/api/benchmarks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobCount, simulationDelayMs, jobProcessingMs: simulationDelayMs }),
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

// ==========================================
// Terraform Operations (Untouched)
// ==========================================

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
