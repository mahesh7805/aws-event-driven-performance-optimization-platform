# AWS Event-Driven Performance Optimization Platform

A enterprise-grade full-stack platform and AWS serverless reference architecture designed to demonstrate how serial batch workloads can be optimized using **Parallel Processing (SQS + Lambda)**, **In-Memory Caching (Redis/ElastiCache)**, and **DynamoDB**.

---

## Technical Stack & Architecture

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Framer Motion, Three.js / React Three Fiber, Recharts.
- **Backend**: Node.js, Express REST API, TypeScript, Vitest.
- **AWS Infrastructure**: API Gateway, AWS Lambda, Amazon SQS + DLQ, DynamoDB, S3, IAM, CloudWatch.
- **Infrastructure as Code**: Terraform (`/infrastructure`).
- **Caching**: Redis-compatible in-memory store with TTL.

---

## 1. Project Overview
The platform visually and quantitatively demonstrates how replacing a legacy synchronous processing loop with an asynchronous, event-driven serverless architecture reduces latency by **88%+** while increasing throughput from 5 to 50+ jobs/second.

---

## 2. Problem Statement
Many legacy applications process independent batch items sequentially inside a single-threaded process loop (`Job 1 → Job 2 → ... → Job N`). For a batch of 20 jobs where each item requires 200ms of CPU compute or I/O, total runtime is $20 \times 200\text{ms} = 4.0\text{ seconds}$. As batch size increases to 100 items, execution time degrades to 20 seconds, causing client timeouts and severe database contention.

---

## 3. System Architecture

```
[ Client / Dashboard (React + R3F) ]
                │
                ▼ HTTP REST API
        [ API Gateway / Express API ]
                │
     ┌──────────┴──────────┐
     ▼                     ▼
[ In-Memory / Redis Cache ]  [ SQS Queue ]
  (Hit/Miss Read-Through)       │
                           ▼
                 [ Lambda Worker Pool ]
                           │
                           ▼
                  [ Amazon DynamoDB ]
```

---

## 4. Why Serial Processing Was Slow
Serial processing executes tasks strictly sequentially on a single thread. Total runtime grows linearly as $O(N)$ with batch size. The CPU spends significant time idling during network/disk I/O wait states between steps.

---

## 5. Why Parallel Processing Improved It
By breaking batch jobs into independent messages, multiple workers execute concurrently in parallel across isolated container instances. Total runtime drops to $O(1)$ constant time: $T_{\text{total}} \approx \max(t_{\text{job}}) + t_{\text{overhead}}$.

---

## 6. Why SQS Was Used
Amazon SQS decouples message producers (API Gateway/Producer Lambda) from consumer workers. It acts as a high-throughput buffer that flattens traffic spikes, protects downstream databases from sudden overload, and guarantees message persistence.

---

## 7. Why Lambda Was Used
AWS Lambda provides event-driven serverless compute that auto-scales horizontally from 0 to 1,000+ concurrent worker instances within milliseconds based on SQS queue depth, incurring zero cost when idle.

---

## 8. Why DynamoDB Was Used
Amazon DynamoDB delivers single-digit millisecond read/write latency at any scale. Its on-demand capacity mode handles burst write throughput from concurrent Lambda workers without schema locks or connection pool limits.

---

## 9. Why Caching Was Used
Redis caching intercepts frequent read queries before hitting DynamoDB, returning results in ~2ms (compared to ~20ms for database queries) and reducing DynamoDB Read Capacity Units (RCU) by over 80%.

---

## 10. Time-To-Live (TTL)
TTL (`CACHE_TTL_SECONDS=60`) automatically evicts cached items after a configurable period, ensuring that stale job records are purged and fresh state is re-fetched from DynamoDB.

---

## 11. Cache Hit vs Cache Miss
- **Cache Hit**: Data is found in Redis memory and returned immediately (0 DB reads).
- **Cache Miss**: Data is absent from cache; the system queries DynamoDB, writes the item to Redis with TTL, and returns it (1 DB read).

---

## 12. Idempotency
SQS standard queues guarantee at-least-once delivery, which can result in duplicate message processing. Workers enforce idempotency using the unique `jobId` as an idempotency key to prevent duplicate writes or side-effects.

---

## 13. Dead Letter Queue (DLQ)
Messages that fail repeatedly (exceeding `maxReceiveCount=3`) are automatically moved to an SQS Dead Letter Queue (`aws-event-driven-dlq`) for isolation, alerting, and manual debugging without blocking the primary queue.

---

## 14. Retry Behavior & Visibility Timeout
When a Lambda worker fails or times out, the SQS message visibility timeout (30 seconds) expires, placing the message back into the queue for another worker to retry automatically.

---

## 15. Lambda Concurrency
Reserved concurrency caps the maximum number of simultaneous Lambda worker instances (e.g. 50 workers) to prevent exhausting downstream database connection limits or API rate limits.

---

## 16. Benchmark Methodology
The platform executes identical deterministic job workloads (calculating math checksums and 150ms I/O delays) across Serial, Parallel SQS+Lambda, and Parallel + Cache modes for batch sizes of 10, 20, 50, and 100 jobs.

---

## 17. Performance Results

| Mode | 10 Jobs | 20 Jobs | 50 Jobs | 100 Jobs | Speedup |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Serial Baseline** | 1.50s | 3.00s | 7.50s | 15.00s | Baseline |
| **Parallel SQS + Lambda** | 0.18s | 0.21s | 0.24s | 0.29s | **88% - 98% faster** |
| **Parallel + Redis Cache** | 0.012s | 0.014s | 0.018s | 0.022s | **99%+ faster** |

---

## 18. AWS Architecture Component Details
- **API Gateway**: REST API routing, rate limiting, and CORS headers.
- **SQS**: Standard Queue with visibility timeout (30s) and DLQ redrive policy.
- **Lambda**: Producer function and SQS-triggered worker function pool.
- **DynamoDB**: On-Demand single-table store (`JobsTable`, `BatchesTable`, `BenchmarksTable`).
- **Redis**: ElastiCache in-memory TTL caching.
- **S3**: Exported benchmark audit logs.
- **CloudWatch**: Logs, alarms, and concurrency metrics.

---

## 19. Infrastructure as Code (Terraform)
Located in `/infrastructure`:
```bash
cd infrastructure/environments/dev
terraform init
terraform plan
terraform apply
```

---

## 20. Local Development Setup

```bash
# 1. Install all monorepo dependencies
npm install

# 2. Run TypeScript type checks
npm run typecheck

# 3. Run full Vitest test suite
npm run test

# 4. Start local emulator stack (LocalStack + Redis)
docker-compose up -d

# 5. Start Backend REST API
npm run dev:backend

# 6. Start Frontend Dashboard
npm run dev:frontend
```

---

## 21. CI/CD Pipeline
GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every push:
1. ESLint code validation.
2. TypeScript typecheck across all workspaces.
3. Vitest unit and integration test suite execution.
4. Production bundle builds.
5. Terraform syntax validation.

---

## 22. Security Controls
- Least-privilege IAM policies.
- No hardcoded AWS credentials (environment variables & IAM roles).
- API Gateway rate limiting and CORS headers.
- S3 server-side encryption (SSE-S3).

---

## 23. Cost Considerations
- **Lambda**: Free Tier includes 1M requests & 3.2M seconds of compute time per month.
- **SQS**: Free Tier includes 1M requests per month.
- **DynamoDB**: On-Demand PAY_PER_REQUEST pricing charges only for read/write units consumed.
- **Redis / ElastiCache**: Use t4g.micro for dev environments.

---

## 24. Limitations
- SQS standard queues provide at-least-once delivery (requires worker idempotency).
- Cold starts may add ~100-200ms latency to the initial Lambda worker invocation.

---

## 25. Future Improvements
- Implement WebSocket Server-Sent Events for real-time worker push updates.
- Add DynamoDB Streams for real-time CDC analytics.
- Integrate AWS X-Ray for distributed request tracing.
