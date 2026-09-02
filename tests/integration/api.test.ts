import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../../backend/src/app.js';
import { Server } from 'http';

describe('Layer 6 & 7 - REST API & Benchmark Integration Tests', () => {
  let server: Server;
  const PORT = 4005;
  const BASE_URL = `http://localhost:${PORT}/api`;

  beforeAll(async () => {
    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(PORT, resolve);
    });
  });

  afterAll((done) => {
    if (server) server.close();
  });

  it('GET /api/health should return ok', async () => {
    const res = await fetch(`${BASE_URL}/health`);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe('ok');
  });

  it('POST /api/batches/serial should process batch serially', async () => {
    const res = await fetch(`${BASE_URL}/batches/serial`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobCount: 2, jobProcessingMs: 20 }),
    });

    const data = await res.json();
    expect(res.status).toBe(201);
    expect(data.batch.mode).toBe('SERIAL');
    expect(data.batch.completedJobs).toBe(2);
  });

  it('POST /api/batches/parallel should process batch in parallel', async () => {
    const res = await fetch(`${BASE_URL}/batches/parallel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobCount: 3, jobProcessingMs: 20 }),
    });

    const data = await res.json();
    expect(res.status).toBe(201);
    expect(data.batch.mode).toBe('PARALLEL');
    expect(data.batch.completedJobs).toBe(3);
  });

  it('POST /api/benchmarks should run real comparison and return metrics', async () => {
    const res = await fetch(`${BASE_URL}/benchmarks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobCount: 4, jobProcessingMs: 20 }),
    });

    const data = await res.json();
    expect(res.status).toBe(201);
    expect(data.jobCount).toBe(4);
    expect(data.serialDurationMs).toBeGreaterThan(data.parallelDurationMs);
    expect(data.improvementPercentage).toBeGreaterThan(0);
    expect(data.throughputJobsPerSec).toBeGreaterThan(0);
  });

  it('GET /api/jobs/:jobId should demonstrate cache miss then cache hit', async () => {
    // 1. Create a job via serial batch
    const createRes = await fetch(`${BASE_URL}/batches/serial`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobCount: 1, jobProcessingMs: 10 }),
    });
    const createData = await createRes.json();
    const jobId = createData.jobs[0].jobId;

    // 2. First query -> Cache Miss
    const res1 = await fetch(`${BASE_URL}/jobs/${jobId}`);
    const data1 = await res1.json();
    expect(data1.cacheHit).toBe(false);

    // 3. Second query -> Cache Hit
    const res2 = await fetch(`${BASE_URL}/jobs/${jobId}`);
    const data2 = await res2.json();
    expect(data2.cacheHit).toBe(true);
  });

  it('POST /api/failure-lab/simulate should return correct scenario telemetry', async () => {
    const res = await fetch(`${BASE_URL}/failure-lab/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario: 'worker-failure' }),
    });

    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.scenario).toBe('worker-failure');
    expect(data.status).toBe('RECOVERED_VIA_RETRY');
  });
});
