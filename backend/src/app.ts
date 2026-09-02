import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { apiRouter } from './routes/api.js';

export const createApp = () => {
  const app = express();

  app.use(cors());
  app.use(express.json());

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
