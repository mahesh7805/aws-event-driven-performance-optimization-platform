import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  awsRegion: process.env.AWS_REGION || 'us-east-1',
  awsEndpoint: process.env.AWS_ENDPOINT || 'http://localhost:4566',
  jobProcessingMs: parseInt(process.env.JOB_PROCESSING_MS || '200', 10),
  cacheTtlSeconds: parseInt(process.env.CACHE_TTL_SECONDS || '60', 10),
  redisHost: process.env.REDIS_HOST || 'localhost',
  redisPort: parseInt(process.env.REDIS_PORT || '6379', 10),
};
