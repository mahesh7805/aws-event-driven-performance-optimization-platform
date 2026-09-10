import { Router, Request, Response } from 'express';
import { execSync } from 'child_process';
import { globalRepository } from '../repositories/repository.js';
import { SerialProcessor } from '../services/serialProcessor.js';
import { ParallelProcessor } from '../services/parallelProcessor.js';
import { CacheService } from '../services/cacheService.js';
import { BenchmarkEngine } from '../services/benchmarkEngine.js';
import { FailureLabService } from '../services/failureLab.js';
import { globalTerraformService } from '../services/terraformService.js';

export const apiRouter = Router();

const serialProcessor = new SerialProcessor(globalRepository);
const parallelProcessor = new ParallelProcessor(globalRepository);
const cacheService = new CacheService(globalRepository, 60);
const benchmarkEngine = new BenchmarkEngine(globalRepository);
const failureLabService = new FailureLabService(globalRepository);

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

// GET /api/metrics/lambda-concurrency (Temporary Diagnostic Metric for Concurrency Test)
apiRouter.get('/metrics/lambda-concurrency', async (_req: Request, res: Response) => {
  try {
    const functionName = 'aws-event-driven-platform-worker-dev';
    const region = globalTerraformService.getAwsRegion();
    const endTime = new Date().toISOString();
    const startTime = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const cmd = `aws cloudwatch get-metric-statistics --namespace AWS/Lambda --metric-name ConcurrentExecutions --dimensions Name=FunctionName,Value=${functionName} --start-time ${startTime} --end-time ${endTime} --period 60 --statistics Maximum Average --region ${region}`;

    const output = execSync(cmd, { encoding: 'utf-8', timeout: 5000 });
    const data = JSON.parse(output);
    const datapoints = (data.Datapoints || [])
      .map((d: any) => ({
        timestamp: d.Timestamp,
        maximum: d.Maximum ?? 0,
        average: Math.round((d.Average ?? 0) * 100) / 100,
        unit: d.Unit,
      }))
      .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const peakMaximum = datapoints.length > 0 ? Math.max(...datapoints.map((d: any) => d.maximum)) : 0;
    const latestMaximum = datapoints.length > 0 ? datapoints[0].maximum : 0;

    res.json({
      functionName,
      region,
      targetConcurrency: 10,
      peakMaximum,
      latestMaximum,
      datapoints,
      queryTime: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(200).json({
      functionName: 'aws-event-driven-platform-worker-dev',
      region: globalTerraformService.getAwsRegion(),
      targetConcurrency: 10,
      peakMaximum: 0,
      latestMaximum: 0,
      datapoints: [],
      error: err.message || 'CloudWatch query unavailable',
      queryTime: new Date().toISOString(),
    });
  }
});

