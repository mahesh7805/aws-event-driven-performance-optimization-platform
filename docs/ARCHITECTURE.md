# AWS Event-Driven Performance Optimization Platform - Architecture Specification

## 1. Executive Overview

This platform provides a visual, real-time benchmark and observatory comparison between two execution paradigms for high-volume batch processing:
1. **Baseline Serial Processing**: Standard sequential loop execution (`Job 1 → Job 2 → ... → Job N`).
2. **Event-Driven Parallel Processing**: Asynchronous job distribution via **Amazon SQS** with fan-out **AWS Lambda workers**, augmented by **Redis TTL Caching** and backed by **Amazon DynamoDB**.

---

## 2. High-Level System Architecture

```
[ Frontend (React + Vite + Tailwind + R3F) ]
                    │
                    ▼ HTTP REST / WebSockets
             [ API Gateway / Express API ]
                    │
       ┌────────────┴────────────┐
       ▼                         ▼
 [ Redis Cache ]          [ SQS Queue ]
       │                         │
 (Hit / Miss)                    ▼
       │               [ Lambda Worker Pool ]
       │ (Miss)                  │
       └────────────┬────────────┘
                    ▼
            [ Amazon DynamoDB ]
                    │
                    ▼
          [ Amazon S3 / CloudWatch ]
```

---

## 3. Data & Execution Flow Comparison

### Paradigm A: Serial Execution Loop
- **Client Request**: `POST /api/batches/serial` with `{ jobCount: 20 }`.
- **Processor**: Executes jobs synchronously in a single process loop.
- **Latency**: $T_{\text{total}} = \sum_{i=1}^{N} t_{\text{job\_i}}$. For 20 jobs @ 200ms = ~4.0 seconds.

### Paradigm B: Event-Driven SQS + Lambda Workers
- **Client Request**: `POST /api/batches/parallel` with `{ jobCount: 20 }`.
- **Producer**: Writes $N$ job messages into SQS Queue in batch mode.
- **SQS Consumer**: AWS Lambda triggers up to $N$ concurrent worker invocations.
- **Worker Execution**: Workers process jobs concurrently and record state directly into DynamoDB.
- **Latency**: $T_{\text{total}} \approx \max(t_{\text{job\_i}}) + t_{\text{overhead}}$. For 20 jobs @ 200ms = ~0.3 - 0.5 seconds.

### Caching Strategy: Redis with TTL Expiration
- **Endpoint**: `GET /api/jobs/:jobId`
- **Lookup Flow**:
  1. Check Redis memory cache by key `job:{jobId}`.
  2. If **HIT**: Return payload immediately without DynamoDB query. Increment `cacheHits`.
  3. If **MISS**: Query DynamoDB, populate Redis with configurable TTL (`CACHE_TTL_SECONDS`), and return payload. Increment `cacheMisses` and `databaseReads`.

---

## 4. Key AWS Services & Roles

- **API Gateway / Rest API**: Entry point for job submissions, status polling, and benchmark executions.
- **Amazon SQS**: Message queue for decoupling job submission from asynchronous worker execution. Provides built-in Dead Letter Queue (DLQ) for fault tolerance.
- **AWS Lambda**: Serverless execution layer. Scales horizontally to process SQS messages concurrently.
- **Amazon DynamoDB**: NoSQL database holding Job execution states, Batch summaries, and Benchmark runs.
- **ElastiCache / Redis**: In-memory cache layer for fast repeated read requests.
- **Amazon S3**: Artifact storage for benchmark reports and exported system metrics.
- **Amazon CloudWatch**: Centralized metrics collection, request logs, and error telemetry.
