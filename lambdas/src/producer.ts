import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { SQSClient, SendMessageBatchCommand } from '@aws-sdk/client-sqs';

const sqsClient = new SQSClient({
  region: process.env.AWS_REGION || 'us-east-1',
  endpoint: process.env.AWS_ENDPOINT || undefined,
});

/**
 * AWS Lambda SQS Producer Handler
 * Receives batch submission from API Gateway and pushes job payloads to Amazon SQS.
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const jobCount = Math.max(1, Math.min(100, body.jobCount || 20));
    const batchId = body.batchId || `batch-${Date.now()}`;
    const queueUrl = process.env.SQS_QUEUE_URL || '';

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

    if (queueUrl) {
      const command = new SendMessageBatchCommand({
        QueueUrl: queueUrl,
        Entries: entries,
      });
      await sqsClient.send(command);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `Successfully enqueued ${jobCount} jobs into SQS`,
        batchId,
        jobCount,
      }),
    };
  } catch (error: any) {
    console.error('[SQS Producer Error]', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message || 'Internal server error' }),
    };
  }
};
