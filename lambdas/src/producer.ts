import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { SQSClient, SendMessageBatchCommand } from '@aws-sdk/client-sqs';

const sqsClient = new SQSClient({
  region: process.env.AWS_REGION || 'us-east-1',
  endpoint: process.env.AWS_ENDPOINT || undefined,
});

/**
 * AWS Lambda SQS Producer Handler
 * Receives batch submission from API Gateway and pushes job payloads to Amazon SQS.
 * Handles arbitrary job counts safely by chunking into max 10-message SendMessageBatch requests.
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const jobCount = Math.max(1, Math.min(500, parseInt(body.jobCount || '20', 10)));
    const batchId = body.batchId || `batch-${Date.now()}`;
    const queueUrl = process.env.SQS_QUEUE_URL || '';

    if (!queueUrl && !process.env.AWS_ENDPOINT) {
      console.warn('[SQS Producer Warning] SQS_QUEUE_URL is not set.');
    }

    console.log(`[SQS Producer] Queueing ${jobCount} jobs for batch ${batchId}`);

    const entries = Array.from({ length: jobCount }, (_, i) => ({
      Id: `msg-${i + 1}`,
      MessageBody: JSON.stringify({
        jobId: `job-${batchId}-${i + 1}`,
        batchId,
        jobIndex: i + 1,
        totalJobs: jobCount,
        processingMs: body.processingMs || 200,
      }),
    }));

    // SQS SendMessageBatch supports a MAXIMUM of 10 messages per API call
    const SQS_MAX_BATCH_SIZE = 10;
    let successfulEnqueues = 0;
    let failedEnqueues = 0;

    for (let i = 0; i < entries.length; i += SQS_MAX_BATCH_SIZE) {
      const batchChunk = entries.slice(i, i + SQS_MAX_BATCH_SIZE);
      
      if (queueUrl) {
        const command = new SendMessageBatchCommand({
          QueueUrl: queueUrl,
          Entries: batchChunk,
        });
        const response = await sqsClient.send(command);
        successfulEnqueues += response.Successful ? response.Successful.length : batchChunk.length;
        if (response.Failed && response.Failed.length > 0) {
          failedEnqueues += response.Failed.length;
          console.error(`[SQS Producer] ${response.Failed.length} messages failed in batch chunk starting at ${i}`);
        }
      } else {
        successfulEnqueues += batchChunk.length;
      }
    }

    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        message: `Successfully enqueued ${successfulEnqueues} jobs into SQS`,
        batchId,
        jobCount,
        successfulEnqueues,
        failedEnqueues,
      }),
    };
  } catch (error: any) {
    console.error('[SQS Producer Error]', error);
    return {
      statusCode: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: error.message || 'Internal server error' }),
    };
  }
};
