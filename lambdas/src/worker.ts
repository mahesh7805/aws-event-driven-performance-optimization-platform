import { SQSEvent, SQSBatchResponse } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const ddbClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  endpoint: process.env.AWS_ENDPOINT || undefined,
});
const docClient = DynamoDBDocumentClient.from(ddbClient);

const processedKeys = new Set<string>();

/**
 * Parallel SQS Worker Lambda Handler
 * Processes individual job messages from SQS with idempotency and updates DynamoDB.
 */
export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  const batchItemFailures: { itemIdentifier: string }[] = [];

  for (const record of event.Records) {
    try {
      const message = JSON.parse(record.body);
      const { jobId, batchId, jobIndex, processingMs } = message;

      // Idempotency check
      if (processedKeys.has(jobId)) {
        console.log(`[Lambda Worker Idempotency] Skipping duplicate message ${jobId}`);
        continue;
      }

      console.log(`[Lambda Worker] Processing Job ${jobId} (Index ${jobIndex})`);

      const startTime = Date.now();
      // Simulate deterministic workload calculation
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
          })
        );
      }
    } catch (err) {
      console.error(`[Lambda Worker Error] Failed processing record ${record.messageId}:`, err);
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
};
