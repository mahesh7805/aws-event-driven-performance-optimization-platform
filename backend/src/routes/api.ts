import { Router, Request, Response } from 'express';
import { globalRepository } from '../repositories/repository.js';
import { SerialProcessor } from '../services/serialProcessor.js';
import { ParallelProcessor } from '../services/parallelProcessor.js';
import { CacheService } from '../services/cacheService.js';
import { BenchmarkEngine } from '../services/benchmarkEngine.js';
import { FailureLabService } from '../services/failureLab.js';
import { globalTerraformService } from '../services/terraformService.js';
import { MetricsService } from '../services/metricsService.js';
import { globalEventLogService } from '../services/eventLogService.js';

export const apiRouter = Router();

const serialProcessor = new SerialProcessor(globalRepository);
const parallelProcessor = new ParallelProcessor(globalRepository);
const cacheService = new CacheService(globalRepository, 60);
const benchmarkEngine = new BenchmarkEngine(globalRepository);
const failureLabService = new FailureLabService(globalRepository);
const metricsService = new MetricsService(globalRepository);

// ==========================================
// Terraform & Infrastructure Endpoints
// ==========================================

// GET /api/terraform/status
apiRouter.get('/terraform/status', (_req: Request, res: Response) => {
  res.json(globalTerraformService.getStatus());
});

// POST /api/terraform/init
apiRouter.post('/terraform/init', async (_req: Request, res: Response) => {
  try {
    const result = await globalTerraformService.init();
    res.json(result);
  } catch (error: any) {
    const status = error.message?.includes('Another Terraform operation') ? 409 : 500;
    res.status(status).json({ error: error.message, success: false });
  }
});

// POST /api/terraform/validate
apiRouter.post('/terraform/validate', async (_req: Request, res: Response) => {
  try {
    const result = await globalTerraformService.validate();
    res.json(result);
  } catch (error: any) {
    const status = error.message?.includes('Another Terraform operation') ? 409 : 500;
    res.status(status).json({ error: error.message, success: false });
  }
});

// POST /api/terraform/plan
apiRouter.post('/terraform/plan', async (_req: Request, res: Response) => {
  try {
    const result = await globalTerraformService.plan();
    res.json(result);
  } catch (error: any) {
    const status = error.message?.includes('Another Terraform operation') ? 409 : 500;
    res.status(status).json({ error: error.message, success: false });
  }
});

// POST /api/terraform/apply
apiRouter.post('/terraform/apply', async (_req: Request, res: Response) => {
  try {
    const result = await globalTerraformService.apply();
    res.json(result);
  } catch (error: any) {
    const status = error.message?.includes('Another Terraform operation') ? 409 : 500;
    res.status(status).json({ error: error.message, success: false });
  }
});

// POST /api/terraform/destroy
apiRouter.post('/terraform/destroy', async (_req: Request, res: Response) => {
  try {
    const result = await globalTerraformService.destroy();
    res.json(result);
  } catch (error: any) {
    const status = error.message?.includes('Another Terraform operation') ? 409 : 500;
    res.status(status).json({ error: error.message, success: false });
  }
});

// GET /api/terraform/outputs
apiRouter.get('/terraform/outputs', async (_req: Request, res: Response) => {
  try {
    const result = await globalTerraformService.getOutputs();
    res.json(result);
  } catch (error: any) {
    const status = error.message?.includes('Another Terraform operation') ? 409 : 500;
    res.status(status).json({ error: error.message, success: false });
  }
});

// GET /api/infrastructure/sync-status
apiRouter.get('/infrastructure/sync-status', (_req: Request, res: Response) => {
  const repoStatus = globalRepository.getCloudSyncStatus();
  const sqsQueueUrl = globalTerraformService.getSqsQueueUrl();
  res.json({
    ...repoStatus,
    sqsConnected: Boolean(sqsQueueUrl),
    sqsQueueUrl,
    apiEndpoint: globalTerraformService.getApiEndpoint(),
  });
});

// ==========================================
// Canonical Batch & Job Endpoints
// ==========================================

// POST /api/batches - Unified Batch Creation (Serial or Parallel)
apiRouter.post('/batches', async (req: Request, res: Response) => {
  try {
    const mode = (req.body.mode || 'PARALLEL').toUpperCase();
    const jobCount = parseInt(req.body.jobCount || '20', 10);
    const simulationDelayMs = req.body.simulationDelayMs !== undefined
      ? parseInt(req.body.simulationDelayMs, 10)
      : (req.body.jobProcessingMs !== undefined ? parseInt(req.body.jobProcessingMs, 10) : 0);

    if (mode === 'SERIAL') {
      const result = await serialProcessor.processBatch({ jobCount, jobProcessingMs: simulationDelayMs });
      res.status(201).json(result);
    } else {
      const result = await parallelProcessor.processBatch({ jobCount, simulationDelayMs });
      res.status(201).json(result);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Batch creation failed' });
  }
});

// POST /api/batches/:batchId/jobs - Append/Submit jobs if needed
apiRouter.post('/batches/:batchId/jobs', async (req: Request, res: Response) => {
  try {
    const batch = await globalRepository.getBatch(req.params.batchId);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    const jobs = await globalRepository.getJobsByBatch(req.params.batchId);
    res.json({ batch, jobs });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/batches/:batchId - Get Batch Status, aggregates & jobs
apiRouter.get('/batches/:batchId', async (req: Request, res: Response) => {
  try {
    const jobs = await globalRepository.getJobsByBatch(req.params.batchId);
    const batch = await globalRepository.getBatch(req.params.batchId);
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    const concurrencyInfo = globalRepository.calculateBatchConcurrency(jobs);
    const completedJobs = jobs.filter((j) => j.status === 'COMPLETED').length;
    const failedJobs = jobs.filter((j) => j.status === 'FAILED').length;
    const queuedJobs = Math.max(0, batch.totalJobs - completedJobs - failedJobs);
    const isCompleted = completedJobs + failedJobs >= batch.totalJobs && batch.totalJobs > 0;
    const currentStatus = isCompleted ? 'COMPLETED' : (batch.status || 'PROCESSING');

    let completedAt = batch.completedAt;
    let durationMs = batch.durationMs;
    if (isCompleted && (!completedAt || !durationMs)) {
      const endTimestamps = jobs.map((j) => (j.completedAt ? new Date(j.completedAt).getTime() : 0)).filter((t) => t > 0);
      if (endTimestamps.length > 0) {
        const maxEnd = Math.max(...endTimestamps);
        completedAt = new Date(maxEnd).toISOString();
        if (batch.startedAt) {
          durationMs = Math.max(0, maxEnd - new Date(batch.startedAt).getTime());
        }
      }
    }

    const peakConcurrency = batch.peakConcurrency || concurrencyInfo.peakConcurrency;

    if (isCompleted && batch.status !== 'COMPLETED') {
      await globalRepository.updateBatch(batch.batchId, {
        status: 'COMPLETED',
        completedJobs,
        failedJobs,
        completedAt,
        durationMs,
        peakConcurrency,
      });
    }

    res.json({
      batch: {
        ...batch,
        status: currentStatus,
        completedJobs,
        failedJobs,
        queuedJobs,
        completedAt,
        durationMs,
        peakConcurrency,
      },
      jobs,
      concurrencyTimeline: concurrencyInfo.concurrencyTimeline,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/batches/:batchId/jobs - Paginated Jobs for a Batch
apiRouter.get('/batches/:batchId/jobs', async (req: Request, res: Response) => {
  try {
    const jobs = await globalRepository.getJobsByBatch(req.params.batchId);
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.max(1, parseInt((req.query.limit as string) || '50', 10));
    const startIndex = (page - 1) * limit;
    const paginatedJobs = jobs.slice(startIndex, startIndex + limit);

    res.json({
      jobs: paginatedJobs,
      total: jobs.length,
      page,
      limit,
      totalPages: Math.ceil(jobs.length / limit),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/batches/:batchId/metrics - Get Batch Benchmark Metrics
apiRouter.get('/batches/:batchId/metrics', async (req: Request, res: Response) => {
  try {
    const batch = await globalRepository.getBatch(req.params.batchId);
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    const jobs = await globalRepository.getJobsByBatch(req.params.batchId);
    const concurrency = globalRepository.calculateBatchConcurrency(jobs);

    res.json({
      batchId: batch.batchId,
      mode: batch.mode,
      totalJobs: batch.totalJobs,
      completedJobs: batch.completedJobs,
      failedJobs: batch.failedJobs,
      queuedJobs: batch.queuedJobs ?? (batch.totalJobs - batch.completedJobs - batch.failedJobs),
      totalDurationMs: batch.totalDuration,
      averageJobDurationMs: batch.averageJobDuration,
      throughputJobsPerSec: batch.throughput,
      peakConcurrency: batch.peakConcurrency || concurrency.peakConcurrency,
      concurrencyTimeline: concurrency.concurrencyTimeline,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/batches - List all batches
apiRouter.get('/batches', async (_req: Request, res: Response) => {
  try {
    const batches = await globalRepository.getAllBatches();
    const batchesTableName = globalTerraformService.getBatchesTableName();
    res.json({
      batches,
      totalBatches: batches.length,
      dynamoDbConnected: Boolean(batchesTableName),
      batchesTableName,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Legacy / Backward Compatibility Batch Endpoints
// POST /api/batches/serial
apiRouter.post('/batches/serial', async (req: Request, res: Response) => {
  try {
    const jobCount = parseInt(req.body.jobCount || '20', 10);
    const jobProcessingMs = req.body.simulationDelayMs !== undefined
      ? parseInt(req.body.simulationDelayMs, 10)
      : (req.body.jobProcessingMs ? parseInt(req.body.jobProcessingMs, 10) : 0);
    const result = await serialProcessor.processBatch({ jobCount, jobProcessingMs });
    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Serial execution failed' });
  }
});

// POST /api/batches/parallel
apiRouter.post('/batches/parallel', async (req: Request, res: Response) => {
  try {
    const jobCount = parseInt(req.body.jobCount || '20', 10);
    const simulationDelayMs = req.body.simulationDelayMs !== undefined
      ? parseInt(req.body.simulationDelayMs, 10)
      : (req.body.jobProcessingMs ? parseInt(req.body.jobProcessingMs, 10) : 0);
    const result = await parallelProcessor.processBatch({ jobCount, simulationDelayMs });
    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Parallel execution failed' });
  }
});

// ==========================================
// Observability, Metrics & Telemetry Endpoints
// ==========================================

// GET /api/metrics/system - Live System Observability
apiRouter.get('/metrics/system', async (_req: Request, res: Response) => {
  try {
    const metrics = await metricsService.getSystemMetrics();
    res.json(metrics);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/logs - Real Terminal / Event Stream Logs
apiRouter.get('/logs', (req: Request, res: Response) => {
  const batchId = req.query.batchId as string | undefined;
  const limit = parseInt((req.query.limit as string) || '100', 10);
  const logs = globalEventLogService.getLogs(batchId, limit);
  res.json({ logs, count: logs.length });
});

// ==========================================
// Benchmarks, Cache & Failure Lab Endpoints
// ==========================================

// POST /api/benchmarks
apiRouter.post('/benchmarks', async (req: Request, res: Response) => {
  try {
    const jobCount = parseInt(req.body.jobCount || '20', 10);
    const simulationDelayMs = req.body.simulationDelayMs !== undefined
      ? parseInt(req.body.simulationDelayMs, 10)
      : (req.body.jobProcessingMs ? parseInt(req.body.jobProcessingMs, 10) : 0);
    const result = await benchmarkEngine.runComparison({ jobCount, jobProcessingMs: simulationDelayMs });
    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Benchmark execution failed' });
  }
});

// GET /api/benchmarks
apiRouter.get('/benchmarks', async (_req: Request, res: Response) => {
  try {
    const benchmarks = await globalRepository.getAllBenchmarks();
    res.json({ benchmarks });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/benchmarks/:benchmarkId
apiRouter.get('/benchmarks/:benchmarkId', async (req: Request, res: Response) => {
  try {
    const benchmark = await globalRepository.getBenchmark(req.params.benchmarkId);
    if (!benchmark) {
      return res.status(404).json({ error: 'Benchmark not found' });
    }
    res.json(benchmark);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/jobs/:jobId
apiRouter.get('/jobs/:jobId', async (req: Request, res: Response) => {
  try {
    const result = await cacheService.getJob(req.params.jobId);
    res.json({
      job: result.job,
      cacheHit: result.hit,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/cache/stats
apiRouter.get('/cache/stats', (_req: Request, res: Response) => {
  const stats = cacheService.getStats();
  res.json(stats);
});

// POST /api/failure-lab/simulate
apiRouter.post('/failure-lab/simulate', async (req: Request, res: Response) => {
  try {
    const { scenario } = req.body;
    const outcome = await failureLabService.simulateScenario(scenario);
    res.json(outcome);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Invalid scenario' });
  }
});
