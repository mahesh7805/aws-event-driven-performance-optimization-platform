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
 */
export const handler = async (event: SQSEvent, context?: Context): Promise<SQSBatchResponse> => {
  console.log("TEST: Lambda invocation started", {
    timestamp: new Date().toISOString(),
    requestId: context?.awsRequestId
  });

  await new Promise((resolve) => setTimeout(resolve, process.env.NODE_ENV === 'test' ? 10 : 20000));

  console.log("TEST: 20-second delay completed", {
    timestamp: new Date().toISOString(),
    requestId: context?.awsRequestId
  });

  const batchItemFailures: { itemIdentifier: string }[] = [];

  // Process all records in the SQS event batch concurrently using Promise.all
  const processPromises = event.Records.map(async (record) => {
    try {
      const message = JSON.parse(record.body);
      const { jobId, batchId, jobIndex, processingMs } = message;

      // Primary Warm Container Idempotency check
      if (processedKeys.has(jobId)) {
        console.log(`[Lambda Worker Idempotency] Warm container skipping duplicate message ${jobId}`);
        return;
      }

      console.log(`[Lambda Worker] Processing Job ${jobId} (Index ${jobIndex})`);

      const startTime = Date.now();
      // CPU-bound computation simulation
      let sum = 0;
      for (let i = 1; i <= 10000; i++) {
        sum += Math.sqrt(i * (jobIndex || 1));
      }

      const targetMs = Math.max(10, processingMs || 200);
      await new Promise((resolve) => setTimeout(resolve, targetMs));

      const duration = Date.now() - startTime;
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
                completedAt: new Date().toISOString(),
                duration,
                result: {
                  computedChecksum: Math.round(sum * 100) / 100,
                  simulatedDurationMs: duration,
                },
              },
              // Enforce table-level idempotency to prevent duplicate processing overwrites
              ConditionExpression: 'attribute_not_exists(jobId)',
            })
          );
        } catch (err: any) {
          if (err.name === 'ConditionalCheckFailedException') {
            console.log(`[Lambda Worker Idempotency] DynamoDB skipped duplicate write for ${jobId}`);
          } else {
            throw err;
          }
        }
      }
    } catch (err) {
      console.error(`[Lambda Worker Error] Failed processing record ${record.messageId}:`, err);
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  });

  await Promise.all(processPromises);

  return { batchItemFailures };
};
