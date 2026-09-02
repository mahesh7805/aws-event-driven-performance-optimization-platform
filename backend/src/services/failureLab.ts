import { DataRepository } from '../repositories/repository.js';
import { executeDeterministicWorkload } from './serialProcessor.js';

export class FailureLabService {
  constructor(private repo: DataRepository) {}

  public async simulateScenario(scenario: string): Promise<any> {
    const timestamp = new Date().toISOString();

    switch (scenario) {
      case 'worker-failure': {
        // Simulates an SQS worker execution failure followed by visibility timeout SQS redelivery
        const jobId = `job-fail-${Date.now()}`;
        try {
          // Attempt 1: Worker failure simulation
          throw new Error('Lambda worker transient timeout exception');
        } catch {
          // Attempt 2: SQS automatic redelivery succeeds
          const res = await executeDeterministicWorkload(1, 30);
          await this.repo.createJob({
            jobId,
            batchId: 'batch-dlq-lab',
            status: 'COMPLETED',
            createdAt: timestamp,
            completedAt: new Date().toISOString(),
            duration: 30,
            result: res,
          });
          return {
            scenario: 'worker-failure',
            status: 'RECOVERED_VIA_RETRY',
            sqsAction: 'SQS Visibility timeout expired -> Redelivered to Lambda Worker Instance 2',
            outcome: `Worker recovered job ${jobId}. Processed successfully on retry 1/3.`,
            timestamp,
          };
        }
      }
      case 'duplicate-message': {
        // Simulates duplicate SQS delivery intercepted by Idempotency check
        const jobId = `job-dup-${Date.now()}`;
        this.repo.markProcessed(jobId);
        const isDuplicate = this.repo.isProcessed(jobId);
        return {
          scenario: 'duplicate-message',
          status: 'SKIPPED_IDEMPOTENT',
          sqsAction: `Worker received duplicate SQS message ID msg-${jobId}`,
          outcome: `Idempotency check intercepted request (isProcessed=${isDuplicate}). Duplicate execution dropped.`,
          timestamp,
        };
      }
      case 'poison-pill': {
        // Simulates invalid payload format rejected and routed to SQS DLQ
        return {
          scenario: 'poison-pill',
          status: 'MOVED_TO_DLQ',
          sqsAction: 'Corrupted JSON format intercepted by Lambda Worker parser',
          outcome: 'Worker returned batchItemFailure. SQS moved message to Dead Letter Queue (DLQ) after 3 retries.',
          timestamp,
        };
      }
      case 'processing-timeout':
        return {
          scenario: 'processing-timeout',
          status: 'TIMEOUT_RETRY',
          sqsAction: 'Lambda worker execution exceeded 15s timeout limit',
          outcome: 'SQS returned message to queue. Reserved concurrency limits prevented cascading backlog.',
          timestamp,
        };
      case 'database-error':
        return {
          scenario: 'database-error',
          status: 'MOVED_TO_DLQ',
          sqsAction: 'DynamoDB ProvisionedThroughputExceededException after 3 retries',
          outcome: 'Message moved to SQS Dead Letter Queue (aws-event-driven-dlq) for inspection.',
          timestamp,
        };
      case 'throttling-backoff':
        return {
          scenario: 'throttling-backoff',
          status: 'BACKOFF_RETRY_SUCCESS',
          sqsAction: 'DynamoDB 400 ProvisionedThroughputExceededException intercepted',
          outcome: 'Applied Full Jitter Exponential Backoff (100ms -> 200ms -> 400ms). Retry 3 succeeded.',
          timestamp,
        };
      default:
        throw new Error('Invalid failure lab scenario');
    }
  }
}
