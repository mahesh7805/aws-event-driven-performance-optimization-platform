import { SQSEvent, SQSBatchResponse, Context } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const ddbClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  endpoint: process.env.AWS_ENDPOINT || undefined,
});
const docClient = DynamoDBDocumentClient.from(ddbClient);

// In-memory cache for warm container executions
const processedKeys = new Set<string>();

/**
 * Parallel SQS Worker Lambda Handler
 * Processes job messages from SQS concurrently within a batch, enforcing DynamoDB idempotency.
 * Fully stateless: AWS dynamically scales execution environments based on backlog.
 */
export const handler = async (event: SQSEvent, context?: Context): Promise<SQSBatchResponse> => {
  const batchItemFailures: { itemIdentifier: string }[] = [];
  const workerId = context?.awsRequestId || `worker-env-${Math.random().toString(36).substring(2, 9)}`;

  // Process all records in the SQS event batch concurrently using Promise.all
  const processPromises = event.Records.map(async (record) => {
    try {
      const message = JSON.parse(record.body);
      const { jobId, batchId, jobIndex, processingMs, simulationDelayMs } = message;

      // Primary Warm Container Idempotency check
      if (processedKeys.has(jobId)) {
        console.log(`[Lambda Worker Idempotency] Warm container skipping duplicate message ${jobId}`);
        return;
      }

      console.log(`[Lambda Worker] Processing Job ${jobId} (Index ${jobIndex}) on Worker ${workerId}`);

      const startTime = Date.now();
      const startedAt = new Date(startTime).toISOString();

      // CPU-bound computation simulation
      let sum = 0;
      for (let i = 1; i <= 10000; i++) {
        sum += Math.sqrt(i * (jobIndex || 1));
      }

      // Explicit simulation delay: defaults to 0ms (no artificial delay in production)
      const targetDelay = simulationDelayMs ?? processingMs ?? Number(process.env.JOB_SIMULATION_DELAY_MS || 0);
      if (targetDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, targetDelay));
      }

      const duration = Date.now() - startTime;
      const completedAt = new Date().toISOString();
      processedKeys.add(jobId);

      const tableName = process.env.DYNAMODB_JOBS_TABLE || 'JobsTable';

      if (process.env.AWS_ENDPOINT || process.env.DYNAMODB_JOBS_TABLE) {
        try {
          await docClient.send(
            new PutCommand({
              TableName: tableName,
              Item: {
                jobId,
                batchId,
                status: 'COMPLETED',
                createdAt: message.createdAt || startedAt,
                startedAt,
                completedAt,
                processingTime: duration,
                duration,
                mode: 'PARALLEL',
                workerId,
                requestId: workerId,
                result: {
                  computedChecksum: Math.round(sum * 100) / 100,
                  simulatedDurationMs: duration,
                },
              },
              // Enforce idempotency: prevent duplicate processing overwrites for already-completed jobs
              ConditionExpression: 'attribute_not_exists(completedAt)',
            })
          );
        } catch (err: any) {
          if (err.name === 'ConditionalCheckFailedException') {
            console.log(`[Lambda Worker Idempotency] DynamoDB skipped duplicate write for ${jobId} (already completed)`);
          } else {
            throw err;
          }
        }
      }
    } catch (err: any) {
      console.error(`[Lambda Worker Error] Failed processing record ${record.messageId}:`, err);
      batchItemFailures.push({ itemIdentifier: record.messageId });

      try {
        const message = JSON.parse(record.body);
        if (message.jobId && (process.env.AWS_ENDPOINT || process.env.DYNAMODB_JOBS_TABLE)) {
          await docClient.send(
            new PutCommand({
              TableName: process.env.DYNAMODB_JOBS_TABLE || 'JobsTable',
              Item: {
                jobId: message.jobId,
                batchId: message.batchId || 'unknown-batch',
                status: 'FAILED',
                createdAt: message.createdAt || new Date().toISOString(),
                completedAt: new Date().toISOString(),
                mode: 'PARALLEL',
                workerId,
                requestId: workerId,
                error: err.message || 'Worker processing failed',
              },
            })
          );
        }
      } catch (writeErr) {
        console.error('[Lambda Worker Error] Failed to write failed status to DynamoDB:', writeErr);
      }
    }
  });

  await Promise.all(processPromises);

  return { batchItemFailures };
};
