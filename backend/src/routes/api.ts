import { Router, Request, Response } from 'express';
import { globalRepository } from '../repositories/repository.js';
import { SerialProcessor } from '../services/serialProcessor.js';
import { ParallelProcessor } from '../services/parallelProcessor.js';
import { CacheService } from '../services/cacheService.js';
import { BenchmarkEngine } from '../services/benchmarkEngine.js';

export const apiRouter = Router();

const serialProcessor = new SerialProcessor(globalRepository);
const parallelProcessor = new ParallelProcessor(globalRepository);
const cacheService = new CacheService(globalRepository, 60);
const benchmarkEngine = new BenchmarkEngine(globalRepository);

// POST /api/batches/serial
apiRouter.post('/batches/serial', async (req: Request, res: Response) => {
  try {
    const jobCount = parseInt(req.body.jobCount || '20', 10);
    const jobProcessingMs = req.body.jobProcessingMs ? parseInt(req.body.jobProcessingMs, 10) : undefined;
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
    const jobProcessingMs = req.body.jobProcessingMs ? parseInt(req.body.jobProcessingMs, 10) : undefined;
    const result = await parallelProcessor.processBatch({ jobCount, jobProcessingMs });
    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Parallel execution failed' });
  }
});

// GET /api/batches/:batchId
apiRouter.get('/batches/:batchId', async (req: Request, res: Response) => {
  try {
    const batch = await globalRepository.getBatch(req.params.batchId);
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    const jobs = await globalRepository.getJobsByBatch(req.params.batchId);
    res.json({ batch, jobs });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/batches
apiRouter.get('/batches', async (_req: Request, res: Response) => {
  try {
    const batches = await globalRepository.getAllBatches();
    res.json({ batches });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/benchmarks
apiRouter.post('/benchmarks', async (req: Request, res: Response) => {
  try {
    const jobCount = parseInt(req.body.jobCount || '20', 10);
    const jobProcessingMs = req.body.jobProcessingMs ? parseInt(req.body.jobProcessingMs, 10) : undefined;
    const result = await benchmarkEngine.runComparison({ jobCount, jobProcessingMs });
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
    if (!result.job) {
      return res.status(404).json({ error: 'Job not found' });
    }
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
  const { scenario } = req.body;
  const timestamp = new Date().toISOString();

  switch (scenario) {
    case 'worker-failure':
      return res.json({
        scenario: 'worker-failure',
        status: 'RETRYING',
        sqsAction: 'Visibility timeout expired -> SQS re-delivered message to Worker 2',
        outcome: 'Successfully processed after SQS retry (1/3 max receive count)',
        timestamp,
      });
    case 'duplicate-message':
      return res.json({
        scenario: 'duplicate-message',
        status: 'SKIPPED',
        sqsAction: 'Worker received duplicate SQS message ID msg-104',
        outcome: 'Idempotency check intercepted request (jobId matched). Duplicate dropped.',
        timestamp,
      });
    case 'processing-timeout':
      return res.json({
        scenario: 'processing-timeout',
        status: 'TIMEOUT_RETRY',
        sqsAction: 'Lambda worker execution exceeded 15s limit',
        outcome: 'SQS returned message to queue. Concurrency limits prevented cascading backlog.',
        timestamp,
      });
    case 'database-error':
      return res.json({
        scenario: 'database-error',
        status: 'MOVED_TO_DLQ',
        sqsAction: 'DynamoDB ProvisionedThroughputExceededException after 3 retries',
        outcome: 'Message moved to SQS Dead Letter Queue (DLQ: aws-event-driven-dlq) for inspection.',
        timestamp,
      });
    case 'poison-pill':
      return res.json({
        scenario: 'poison-pill',
        status: 'ISOLATED_TO_DLQ',
        sqsAction: 'Corrupted payload format detected by JSON schema parser in Lambda Worker',
        outcome: 'Worker rejected message without processing. Sent to DLQ (MaxReceiveCount=3) to prevent queue poison loop.',
        timestamp,
      });
    case 'throttling-backoff':
      return res.json({
        scenario: 'throttling-backoff',
        status: 'BACKOFF_RETRY_SUCCESS',
        sqsAction: 'DynamoDB 400 ProvisionedThroughputExceededException intercepted',
        outcome: 'Applied Full Jitter Exponential Backoff (100ms → 200ms → 400ms). Retry 3 succeeded without data loss.',
        timestamp,
      });
    default:
      return res.status(400).json({ error: 'Invalid failure lab scenario' });
  }
});
