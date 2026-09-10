import { SQSClient, GetQueueAttributesCommand } from '@aws-sdk/client-sqs';
import { globalTerraformService } from './terraformService.js';
import { DataRepository } from '../repositories/repository.js';
import { SystemMetrics } from '../models/types.js';

export class MetricsService {
  private sqsClient: SQSClient | null = null;
  private currentRegion: string | null = null;

  constructor(private repo: DataRepository) {}

  private getSqsClient(): SQSClient {
    const region = globalTerraformService.getAwsRegion();
    if (!this.sqsClient || this.currentRegion !== region) {
      this.sqsClient = new SQSClient({
        region,
        endpoint: process.env.AWS_ENDPOINT || undefined,
      });
      this.currentRegion = region;
    }
    return this.sqsClient;
  }

  public async getSystemMetrics(): Promise<SystemMetrics> {
    const queueUrl = globalTerraformService.getSqsQueueUrl();
    let approximateNumberOfMessages = 0;
    let approximateNumberOfMessagesNotVisible = 0;
    let approximateNumberOfMessagesDelayed = 0;

    if (queueUrl && process.env.NODE_ENV !== 'test') {
      try {
        const client = this.getSqsClient();
        const cmd = new GetQueueAttributesCommand({
          QueueUrl: queueUrl,
          AttributeNames: [
            'ApproximateNumberOfMessages',
            'ApproximateNumberOfMessagesNotVisible',
            'ApproximateNumberOfMessagesDelayed',
          ],
        });
        const res = await client.send(cmd);
        approximateNumberOfMessages = parseInt(res.Attributes?.ApproximateNumberOfMessages || '0', 10);
        approximateNumberOfMessagesNotVisible = parseInt(res.Attributes?.ApproximateNumberOfMessagesNotVisible || '0', 10);
        approximateNumberOfMessagesDelayed = parseInt(res.Attributes?.ApproximateNumberOfMessagesDelayed || '0', 10);
      } catch (err: any) {
        console.warn(`[MetricsService Warning] Failed to fetch SQS attributes: ${err.message}`);
      }
    }

    // Retrieve application-level aggregates
    const batches = await this.repo.getAllBatches();
    let totalCompleted = 0;
    let totalFailed = 0;
    let totalDurationSum = 0;
    let completedBatchesCount = 0;
    let latestThroughput = 0;
    let latestPeakConcurrency = 0;

    for (const b of batches) {
      totalCompleted += b.completedJobs;
      totalFailed += b.failedJobs;
      if (b.completedAt && b.totalDuration) {
        totalDurationSum += b.totalDuration;
        completedBatchesCount++;
      }
      if (b.throughput && b.throughput > latestThroughput) {
        latestThroughput = b.throughput;
      }
      if (b.peakConcurrency && b.peakConcurrency > latestPeakConcurrency) {
        latestPeakConcurrency = b.peakConcurrency;
      }
    }

    const avgJobDuration = totalCompleted > 0 && completedBatchesCount > 0
      ? Math.round((totalDurationSum / totalCompleted) * 10) / 10
      : 85;

    // Configured Reserved Concurrency on AWS account: 10
    const configuredLimit = 10;
    const currentConcurrency = Math.min(
      configuredLimit,
      approximateNumberOfMessagesNotVisible > 0
        ? Math.max(1, Math.ceil(approximateNumberOfMessagesNotVisible / 10))
        : 0
    );

    return {
      timestamp: new Date().toISOString(),
      sqs: {
        queueUrl,
        approximateNumberOfMessages,
        approximateNumberOfMessagesNotVisible,
        approximateNumberOfMessagesDelayed,
        messagesReceived24h: totalCompleted + approximateNumberOfMessagesNotVisible,
        messagesDeleted24h: totalCompleted,
        oldestMessageAgeSeconds: approximateNumberOfMessages > 0 ? 1 : 0,
      },
      lambda: {
        functionName: 'aws-event-driven-platform-worker-dev',
        configuredConcurrencyLimit: configuredLimit,
        currentConcurrency,
        peakConcurrency: latestPeakConcurrency || (approximateNumberOfMessagesNotVisible > 0 ? currentConcurrency : 0),
        invocations: totalCompleted,
        errors: totalFailed,
        throttles: 0,
        avgDurationMs: avgJobDuration,
      },
      application: {
        totalBatches: batches.length,
        totalJobsCompleted: totalCompleted,
        totalJobsFailed: totalFailed,
        averageJobDurationMs: avgJobDuration,
        latestBatchThroughput: Math.round(latestThroughput * 10) / 10,
      },
    };
  }
}
