# DynamoDB Data Model Specification

## Table Design: Single Table vs Multi-Table Strategy

For clarity and direct alignment with interview topics, the platform models entities cleanly with primary partition keys and sort keys:

### 1. Job Entity (`JobsTable`)
- **Partition Key (`PK`)**: `jobId` (String, UUID)
- **Sort Key (`SK`)**: `batchId` (String, UUID)
- **Global Secondary Index (`GSI1`)**:
  - `GSI1PK`: `batchId`
  - `GSI1SK`: `createdAt`

#### Attributes:
- `jobId`: `STRING` (Unique identifier for the job)
- `batchId`: `STRING` (Parent batch container identifier)
- `status`: `STRING` (`PENDING` | `PROCESSING` | `COMPLETED` | `FAILED`)
- `createdAt`: `STRING` (ISO-8601 string)
- `startedAt`: `STRING` (ISO-8601 string)
- `completedAt`: `STRING` (ISO-8601 string)
- `duration`: `NUMBER` (Processing duration in milliseconds)
- `result`: `MAP / STRING` (Deterministic calculation result)
- `error`: `STRING` (Failure message if applicable)

---

### 2. Batch Entity (`BatchesTable`)
- **Partition Key (`PK`)**: `batchId` (String, UUID)

#### Attributes:
- `batchId`: `STRING` (Unique identifier)
- `mode`: `STRING` (`SERIAL` | `PARALLEL` | `PARALLEL_CACHED`)
- `totalJobs`: `NUMBER` (Total submitted jobs count)
- `completedJobs`: `NUMBER` (Count of successfully finished jobs)
- `failedJobs`: `NUMBER` (Count of failed jobs)
- `startedAt`: `STRING` (ISO timestamp)
- `completedAt`: `STRING` (ISO timestamp)
- `totalDuration`: `NUMBER` (Total batch runtime in milliseconds)

---

### 3. Benchmark Entity (`BenchmarksTable`)
- **Partition Key (`PK`)**: `benchmarkId` (String, UUID)

#### Attributes:
- `benchmarkId`: `STRING` (Unique identifier)
- `mode`: `STRING` (`SERIAL` | `PARALLEL` | `PARALLEL_CACHED`)
- `totalJobs`: `NUMBER` (Job batch size used for benchmark)
- `duration`: `NUMBER` (Execution duration in milliseconds)
- `throughput`: `NUMBER` (Jobs processed per second)
- `cacheHits`: `NUMBER` (Total cache hit occurrences)
- `cacheMisses`: `NUMBER` (Total cache miss occurrences)
- `databaseReads`: `NUMBER` (Total DB read operations performed)
- `createdAt`: `STRING` (ISO timestamp)
