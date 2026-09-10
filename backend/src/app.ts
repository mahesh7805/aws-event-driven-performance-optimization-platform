import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { apiRouter } from './routes/api.js';

export const createApp = () => {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/', (_req, res) => {
    res.json({
      name: 'AWS Event-Driven Performance Optimization Platform API',
      status: 'ONLINE',
      version: '1.0.0',
      endpoints: {
        health: '/api/health',
        serialBatch: 'POST /api/batches/serial',
        parallelBatch: 'POST /api/batches/parallel',
        getBatch: 'GET /api/batches/:batchId',
        benchmarks: 'POST /api/benchmarks',
        getJob: 'GET /api/jobs/:jobId',
        cacheStats: 'GET /api/cache/stats',
        simulateFailure: 'POST /api/failure-lab/simulate',
        terraformStatus: 'GET /api/terraform/status',
        terraformInit: 'POST /api/terraform/init',
        terraformValidate: 'POST /api/terraform/validate',
        terraformPlan: 'POST /api/terraform/plan',
        terraformApply: 'POST /api/terraform/apply',
        terraformDestroy: 'POST /api/terraform/destroy',
        terraformOutputs: 'GET /api/terraform/outputs',
      },
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'aws-event-driven-platform-backend',
      timestamp: new Date().toISOString(),
      environment: config.nodeEnv,
    });
  });

  app.use('/api', apiRouter);

  return app;
};
