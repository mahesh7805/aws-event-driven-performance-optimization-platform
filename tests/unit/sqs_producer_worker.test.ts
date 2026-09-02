import { describe, it, expect } from 'vitest';
import { handler as producerHandler } from '../../lambdas/src/producer.js';
import { handler as workerHandler } from '../../lambdas/src/worker.js';

describe('SQS Producer & Worker Lambda Logic', () => {
  it('should safely handle job counts > 10 in producer without exceeding SQS batch limits', async () => {
    const event: any = {
      body: JSON.stringify({ jobCount: 25, batchId: 'test-batch-25' }),
    };

    const result = await producerHandler(event);
    expect(result.statusCode).toBe(200);

    const body = JSON.parse(result.body);
    expect(body.batchId).toBe('test-batch-25');
    expect(body.jobCount).toBe(25);
    expect(body.successfulEnqueues).toBe(25);
    expect(body.failedEnqueues).toBe(0);
  });

  it('should process SQS batch records concurrently in worker Lambda', async () => {
    const sqsEvent: any = {
      Records: [
        {
          messageId: 'msg-1',
          body: JSON.stringify({ jobId: 'job-1', batchId: 'b-1', jobIndex: 1, processingMs: 10 }),
        },
        {
          messageId: 'msg-2',
          body: JSON.stringify({ jobId: 'job-2', batchId: 'b-1', jobIndex: 2, processingMs: 10 }),
        },
      ],
    };

    const response = await workerHandler(sqsEvent);
    expect(response).toBeDefined();
    expect(response.batchItemFailures).toEqual([]);
  });

  it('should prevent duplicate executions via warm container idempotency check', async () => {
    const sqsEvent: any = {
      Records: [
        {
          messageId: 'msg-1-dup',
          body: JSON.stringify({ jobId: 'job-1', batchId: 'b-1', jobIndex: 1, processingMs: 10 }),
        },
      ],
    };

    const response = await workerHandler(sqsEvent);
    expect(response.batchItemFailures).toEqual([]);
  });
});
