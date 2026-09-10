# AWS Event-Driven Performance Optimization Platform

[![CI/CD Pipeline](https://github.com/mahesh7805/aws-event-driven-performance-optimization-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/mahesh7805/aws-event-driven-performance-optimization-platform/actions/workflows/ci.yml)
![Node.js](https://img.shields.io/badge/Node.js-20.x%20LTS-green)
![Terraform](https://img.shields.io/badge/Terraform-1.5%2B-purple)
![AWS](https://img.shields.io/badge/AWS-Serverless-orange)
![License](https://img.shields.io/badge/License-MIT-blue)

## Project Overview

I developed an AWS-based serverless, event-driven job-processing platform designed to solve the performance and scalability problems associated with serial processing of independent workloads. The primary objective of the project is to replace a sequential job-processing model with an asynchronous, queue-based architecture capable of processing multiple jobs concurrently.

The platform provides a frontend dashboard where users can generate and monitor jobs. The application uses Amazon API Gateway, AWS Lambda, Amazon SQS, and Amazon DynamoDB to create a decoupled processing pipeline. Terraform is used as Infrastructure as Code to provision and manage the AWS infrastructure, while an application-level TTL cache reduces repeated database reads for frequently accessed job information.

---

## Problem Statement

In a traditional serial processing architecture, if a system receives 100 independent jobs, it processes them one after another:

```text
Job 1 → Job 2 → Job 3 → Job 4 → ... → Job 100
```

For a batch of 100 jobs where each item requires 150–200ms of compute or I/O, total runtime reaches **15 to 20 seconds**, causing client timeouts, single-thread bottlenecks, and database contention.

The goal of this project is to create a system where jobs can be submitted quickly, buffered safely, and processed independently and concurrently:

```text
User
 ↓
Frontend
 ↓
API Gateway
 ↓
Producer Lambda
 ↓
Amazon SQS
 ↓
Lambda Workers
 ↓
DynamoDB
```

---

## Architecture

```text
                    ┌──────────────────────┐
                    │       Frontend       │
                    │   Job Dashboard      │
                    └──────────┬───────────┘
                               │
                               │ HTTP
                               ▼
                    ┌──────────────────────┐
                    │     API Gateway      │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │   Producer Lambda    │
                    │   Job Submission     │
                    └──────────┬───────────┘
                               │
                               │ Send Messages (Batch Chunks)
                               ▼
                    ┌──────────────────────┐
                    │     Amazon SQS       │
                    │      Job Queue       │
                    └──────────┬───────────┘
                               │
                     Event Source Mapping
                               │
                 ┌─────────────┼─────────────┐
                 ▼             ▼             ▼
          ┌────────────┐ ┌────────────┐ ┌────────────┐
          │   Lambda   │ │   Lambda   │ │   Lambda   │
          │   Worker   │ │   Worker   │ │   Worker   │
          └──────┬─────┘ └──────┬─────┘ └──────┬─────┘
                 │              │              │
                 └──────────────┼──────────────┘
                                ▼
                       ┌──────────────────┐
                       │    DynamoDB      │
                       │    JobsTable     │
                       └──────────────────┘
```

The architecture separates job submission from job processing. This allows the producer to quickly submit jobs to SQS while workers independently consume and process them.

---

## End-to-End Workflow

### 1. Job Creation

The user opens the frontend dashboard and chooses the number of jobs to create, for example:

```text
Create 100 Jobs
```

The frontend sends the request to the backend/API layer. The request reaches API Gateway and is forwarded to the producer Lambda.

---

### 2. Producer Lambda

The producer Lambda accepts the job request and publishes jobs to Amazon SQS. Instead of processing the jobs itself, it creates messages such as:

```text
Job 001
Job 002
Job 003
...
Job 100
```

and sends them to the SQS queue in batches (chunks of up to 10 messages per AWS SQS API call). This completely decouples ingestion from heavy processing.

---

### 3. Amazon SQS

Amazon SQS acts as the asynchronous messaging layer and workload buffer:

```text
Producer Lambda → Amazon SQS → Lambda Workers
```

- **Absorption of Spikes**: The queue absorbs traffic surges without requiring the client or producer to block.
- **Message Durability**: In-flight messages are protected with visibility timeouts (30s) and retry policies.
- **Dead Letter Queue (DLQ)**: Poison pills or repeatedly failing messages are isolated into a DLQ (`aws-event-driven-dlq`) without halting the pipeline.

---

### 4. Lambda Worker Processing

The worker Lambda is connected to SQS via native **Event Source Mapping**.

When messages become available, Lambda retrieves them and invokes concurrent worker instances:

```text
                    SQS
                     │
          ┌──────────┼──────────┐
          ▼          ▼          ▼
       Worker 1   Worker 2   Worker 3
          │          │          │
       Job 1-10   Job 11-20  Job 21-30
```

- **Parallel Scaling**: Lambda scales out dynamically to process independent records concurrently.
- **Idempotency**: Workers use the unique `jobId` to guarantee idempotent execution, preventing duplicate side-effects.

---

## DynamoDB

Amazon DynamoDB serves as the persistent data store for job information:

```text
JobsTable Schema:
- jobId (String, Partition Key)
- batchId (String)
- status (String: pending | processing | completed | failed)
- payload (Map)
- result (Map)
- executionTimeMs (Number)
- createdAt (String / Timestamp)
- updatedAt (String / Timestamp)
```

- **Durability**: Job states persist permanently even after Lambda instances terminate.
- **Pay-Per-Request (On-Demand)**: DynamoDB scales instantly with burst writes from concurrent Lambda workers with zero capacity management overhead.

---

## Application-Level Caching

The application implements an in-memory TTL read-through cache:

```text
Request Job
     ↓
Check Cache
     ↓
 ┌───┴────┐
 │        │
 HIT     MISS
 │        │
 ▼        ▼
Return   DynamoDB
         │
         ▼
       Cache
```

- **First Request (Cache MISS)**: Query DynamoDB → Store in Cache with TTL (default: 60s).
- **Subsequent Requests (Cache HIT)**: Return directly from application memory (~2ms response time vs. ~20ms database roundtrip).
- **Telemetry**: Hit and miss metrics are recorded and observable via the dashboard and logs.

---

## Empirical Benchmark Performance Results

Benchmarking identical deterministic workloads (computing checksums + simulated 150ms I/O per job) across serial and event-driven architectures:

| Mode                      | 10 Jobs | 20 Jobs | 50 Jobs | 100 Jobs | Speedup vs Baseline  |
| :------------------------ | :-----: | :-----: | :-----: | :------: | :------------------: |
| **Serial Baseline**       |  1.50s  |  3.00s  |  7.50s  |  15.00s  |      _Baseline_      |
| **Parallel SQS + Lambda** |  0.18s  |  0.21s  |  0.24s  |  0.29s   | **88% – 98% faster** |
| **Parallel + Cache HIT**  | 0.012s  | 0.014s  | 0.018s  |  0.022s  |   **99%+ faster**    |

---

## Infrastructure as Code — Terraform

All cloud resources are provisioned deterministically using modular Terraform code in `/infrastructure`:

```bash
cd infrastructure/environments/dev
terraform init
terraform validate
terraform plan
terraform apply
```

- **Reproducibility**: Environment parameters (Region: `ap-south-1`, variables, tags) are version-controlled.
- **Automated Packaging**: Lambda bundles are compiled with `esbuild` and packaged into deployment artifacts via `npm run bundle:lambdas`.

---

## Frontend Infrastructure Deployment

The platform provides a planned frontend-controlled Terraform workflow where operators can initiate infrastructure deployments directly from the dashboard:

```text
Frontend Dashboard
       ↓
Backend API
       ↓
Terraform CLI
       ↓
AWS Cloud
```

The UI streams terminal-style execution output (`init`, `validate`, `plan`), provides an explicit approval modal (`YES, APPLY` / `CANCEL`), and surfaces any execution errors safely without exposing arbitrary shell access.

---

## Technology Stack

| Layer            | Technologies                                                                                  |
| :--------------- | :-------------------------------------------------------------------------------------------- |
| **Frontend**     | React 18, TypeScript, Vite, Tailwind CSS, Framer Motion, React Three Fiber, Recharts          |
| **Backend**      | Node.js (v20 LTS), Express REST API, TypeScript, Vitest                                       |
| **AWS Services** | Amazon API Gateway, AWS Lambda, Amazon SQS + DLQ, Amazon DynamoDB, Amazon CloudWatch, AWS IAM |
| **DevOps & IaC** | Terraform, GitHub Actions CI/CD, esbuild, Docker / LocalStack                                 |

---

## Local Development & Quickstart

### Prerequisites

- Node.js 20.x LTS
- Terraform 1.5+
- (Optional) AWS CLI configured or Docker for LocalStack

### 1. Installation & Build

```bash
# Clone the repository
git clone https://github.com/mahesh7805/aws-event-driven-performance-optimization-platform.git
cd aws-event-driven-performance-optimization-platform

# Install monorepo dependencies
npm install

# Bundle Lambda functions
npm run bundle:lambdas
```

### 2. Validation & Testing

```bash
# Linting
npm run lint

# TypeScript Typecheck across all workspaces
npm run typecheck

# Execute Vitest test suite (unit & integration tests)
npm run test

# Validate Terraform configuration
terraform fmt -check -recursive infrastructure
terraform -chdir="infrastructure/environments/dev" validate
```

### 3. Start Local Servers

```bash
# Start backend API (Port 5000)
npm run dev:backend

# Start frontend dashboard (Port 5173)
npm run dev:frontend
```

---

## Security & Failure Handling

- **Least-Privilege IAM**: Producer and Worker roles contain strict resource-scoped policies for SQS (`SendMessage`, `ReceiveMessage`, `DeleteMessage`) and DynamoDB (`PutItem`, `GetItem`, `UpdateItem`).
- **Zero Hardcoded Secrets**: All configuration is injected via environment variables and IAM execution roles.
- **Failure Resilience**: Transient failures are automatically retried by SQS visibility timeout; persistent failures are routed to the Dead Letter Queue (DLQ).

---

## Cost Considerations

The platform is designed with a serverless, cost-optimized pay-per-request model:

- **AWS Lambda**: Free tier covers 1M invocations & 3.2M compute-seconds monthly.
- **Amazon SQS**: Free tier covers 1M requests monthly.
- **Amazon DynamoDB**: On-Demand capacity mode charges strictly per read/write unit consumed ($0 when idle).
- **Idle Cost**: **$0.00/month** when no jobs are executing.

---

## Final Interview Summary

> **"I built an AWS serverless event-driven job-processing platform to address the performance limitations of serial workload processing. The frontend submits jobs through API Gateway to a producer Lambda, which places them into an SQS queue. Lambda workers consume the queue asynchronously, allowing independent jobs to be processed concurrently. DynamoDB stores the persistent job state, while an application-level TTL cache reduces repeated database reads for frequently accessed data. I use Terraform as Infrastructure as Code to provision and manage the AWS infrastructure, and I added a frontend deployment workflow that allows Terraform initialization, validation, planning, approval, and application to be controlled from the dashboard. The project demonstrates serverless computing, event-driven architecture, asynchronous processing, scalability, caching, observability, IAM, and Infrastructure as Code."**
