# AWS Event-Driven Performance Optimization Platform

## Project Overview

I developed an AWS-based serverless, event-driven job-processing platform designed to solve the performance and scalability problems associated with serial processing of independent workloads. The primary objective of the project is to replace a sequential job-processing model with an asynchronous, queue-based architecture capable of processing multiple jobs concurrently.

The platform provides a frontend dashboard where users can generate and monitor jobs. The application uses Amazon API Gateway, AWS Lambda, Amazon SQS, and Amazon DynamoDB to create a decoupled processing pipeline. Terraform is used as Infrastructure as Code to provision and manage the AWS infrastructure, while an application-level TTL cache reduces repeated database reads for frequently accessed job information.

---

## Problem Statement

In a traditional serial processing architecture, if a system receives 100 independent jobs, it may process them one after another:

```text
Job 1 → Job 2 → Job 3 → Job 4 → ... → Job 100
```

This increases total processing time and creates unnecessary dependency between independent tasks.

The goal of this project is to create a system where jobs can be submitted quickly, buffered safely, and processed independently and concurrently.

The resulting architecture is:

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
                               │ Send Messages
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

The frontend sends the request to the backend/API layer.

The request reaches API Gateway and is forwarded to the producer Lambda.

---

### 2. Producer Lambda

The producer Lambda is responsible for accepting the job request and publishing jobs to Amazon SQS.

Instead of processing the jobs itself, it creates messages such as:

```text
Job 001
Job 002
Job 003
...
Job 100
```

and sends them to the SQS queue.

This means job creation and job processing are decoupled.

---

### 3. Amazon SQS

Amazon SQS acts as the asynchronous messaging layer and workload buffer.

```text
Producer Lambda
       ↓
     SQS
       ↓
    Workers
```

The queue allows the system to absorb workload spikes without requiring the producer to wait for every job to finish.

SQS also provides message durability and supports retry-based processing when a worker cannot successfully process a message.

---

### 4. Lambda Worker Processing

The worker Lambda is connected to SQS using an event-source mapping.

When messages become available, Lambda retrieves them and invokes the worker function.

Because the jobs are independent, the workload can be distributed across multiple Lambda executions.

For example:

```text
                    SQS
                     │
          ┌──────────┼──────────┐
          ▼          ▼          ▼
       Worker 1   Worker 2   Worker 3
          │          │          │
       Job 1-10   Job 11-20  Job 21-30
```

This allows the architecture to process independent workloads concurrently instead of forcing all jobs through a single sequential execution path.

---

## DynamoDB

Amazon DynamoDB is used as the persistent data store for job information.

The application maintains a JobsTable where job records can contain information such as:

```text
jobId
status
createdAt
updatedAt
result
```

For example:

```text
JobsTable

job-001    completed
job-002    processing
job-003    completed
job-004    pending
```

The important distinction is that DynamoDB provides **persistent storage**. If the application or Lambda execution environment disappears, the job records remain stored in DynamoDB.

The project uses a pay-per-request DynamoDB configuration, making it suitable for a low-volume demonstration environment.

---

## Application-Level Caching

The application also implements an in-memory TTL cache.

This cache is different from DynamoDB.

DynamoDB stores persistent job data, while the cache temporarily stores frequently accessed records in application memory.

The implementation uses a JavaScript `Map` and expiration timestamps, with a default TTL of approximately 60 seconds.

The workflow is:

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

For the first request:

```text
Request → Cache MISS → DynamoDB → Store in Cache
```

For subsequent requests within the TTL:

```text
Request → Cache HIT → Return from Memory
```

The cache service also records cache hits and misses, making its behavior observable through application metrics/logs.

This reduces unnecessary repeated DynamoDB reads and can improve response latency.

---

## Infrastructure as Code — Terraform

All major AWS infrastructure is managed using Terraform.

Instead of manually creating AWS resources through the AWS Console, the infrastructure is defined as code.

The normal workflow is:

```text
terraform init
       ↓
terraform validate
       ↓
terraform plan
       ↓
terraform apply
```

### Terraform Init

Initializes the Terraform working directory and downloads the required providers/modules.

### Terraform Validate

Checks whether the Terraform configuration is syntactically and structurally valid.

### Terraform Plan

Creates a preview of the infrastructure changes Terraform intends to make.

For example:

```text
+ aws_dynamodb_table.jobs
+ aws_sqs_queue.jobs
+ aws_lambda_function.worker

Plan: 3 to add, 0 to change, 0 to destroy
```

`terraform plan` does not create the resources.

### Terraform Apply

Actually provisions or modifies the AWS infrastructure.

---

## Frontend Infrastructure Deployment

The project also includes a planned frontend-controlled Terraform workflow.

Instead of opening a terminal, the user can initiate infrastructure deployment from the dashboard.

The architecture is:

```text
Frontend
   ↓
Backend
   ↓
Terraform CLI
   ↓
AWS
```

The frontend provides a terminal-style output window showing:

```text
$ terraform init
✓ Terraform initialized

$ terraform validate
✓ Configuration valid

$ terraform plan

+ DynamoDB
+ SQS
+ Lambda

Plan: 3 to add, 0 to change, 0 to destroy
```

After the plan succeeds, the user receives an explicit confirmation:

```text
Terraform wants to apply these changes.

[ YES, APPLY ]    [ CANCEL ]
```

If the user selects YES, the backend executes Terraform Apply.

If the user selects NO, the infrastructure is not modified.

If Terraform fails, the backend captures the error and displays it in the frontend terminal/log interface.

This provides a simple infrastructure deployment experience while keeping Terraform execution safely on the backend.

---

## Monitoring and Observability

The project uses application logs and AWS monitoring capabilities to understand what is happening during processing.

Important information that can be monitored includes:

- Lambda execution
- Job processing
- SQS activity
- DynamoDB operations
- Cache hits
- Cache misses
- Terraform execution results
- Infrastructure errors

For Lambda, CloudWatch Logs can be used to inspect execution logs.

For example:

```text
[CACHE MISS] job-123
[DYNAMODB READ] job-123
[CACHE SET] job-123

[CACHE HIT] job-123
```

This makes it possible to demonstrate that the cache is actually being used rather than simply claiming that caching exists.

---

# Technology Stack

## Frontend

- React
- JavaScript/TypeScript
- HTML
- CSS
- Dashboard-based UI
- REST API communication

## Backend

- Node.js
- Backend API
- AWS SDK
- Job processing logic
- Application-level TTL caching
- Terraform process execution

## AWS

- Amazon API Gateway
- AWS Lambda
- Amazon SQS
- Amazon DynamoDB
- Amazon CloudWatch
- AWS IAM
- Amazon S3 where required by the infrastructure

## DevOps / Infrastructure

- Terraform
- Infrastructure as Code
- Git
- GitHub
- AWS CLI
- Serverless architecture
- Event-driven architecture
- CI/CD concepts

---

# Key Features

### 1. Event-Driven Processing

Jobs are processed asynchronously through SQS instead of requiring synchronous serial processing.

### 2. Parallel Processing

Multiple Lambda executions can process independent jobs concurrently.

### 3. Queue-Based Decoupling

SQS separates job submission from job execution.

### 4. Serverless Architecture

Lambda provides compute without requiring continuously running servers.

### 5. Persistent Job Storage

DynamoDB stores job information and processing state.

### 6. Application-Level Caching

Frequently accessed data can be served from an in-memory TTL cache.

### 7. Infrastructure as Code

Terraform allows infrastructure to be version-controlled, reproducible, and deployed consistently.

### 8. Infrastructure Deployment Dashboard

The frontend can provide a user-friendly interface for Terraform initialization, validation, planning, approval, and deployment.

### 9. Error Visibility

Terraform and application errors can be surfaced through the frontend and backend logs.

### 10. Observability

CloudWatch and application logging provide visibility into Lambda executions and application behavior.

---

# Why This Architecture?

The main architectural decision was to separate **ingestion** from **processing**.

Instead of:

```text
Frontend
   ↓
Backend
   ↓
Process Job 1
   ↓
Process Job 2
   ↓
Process Job 3
   ↓
...
```

the project uses:

```text
Frontend
   ↓
API Gateway
   ↓
Producer Lambda
   ↓
SQS
   ↓
Lambda Workers
   ↓
DynamoDB
```

This provides better decoupling, scalability, resilience, and workload management.

---

# Example: 100 Jobs

If the user submits 100 jobs:

```text
Frontend
    ↓
API Gateway
    ↓
Producer Lambda
    ↓
100 messages
    ↓
SQS
    ↓
Lambda workers
    ↓
Process jobs
    ↓
DynamoDB
```

The producer does not need to wait for all 100 jobs to complete.

SQS stores the workload until workers process it.

Lambda can create multiple executions depending on the workload and concurrency configuration.

The final job state is stored in DynamoDB.

---

# Handling Failures

If a worker fails while processing a job, the SQS-based architecture allows the message to be retried according to the configured processing behavior.

Conceptually:

```text
SQS
 ↓
Worker
 ↓
Processing Failure
 ↓
Retry
 ↓
Worker
 ↓
Success
```

For a production implementation, a Dead Letter Queue could also be introduced to isolate messages that repeatedly fail.

---

# Security

The architecture uses IAM permissions so AWS resources can communicate without embedding credentials directly into application code.

For example:

```text
Lambda
 ↓
IAM Role
 ↓
Permission
 ↓
SQS / DynamoDB
```

The Terraform deployment interface is also designed so that arbitrary shell commands are not exposed to the frontend.

The frontend requests predefined Terraform operations, while the backend controls the actual Terraform execution.

---

# Cost Considerations

The project was designed with a low-cost serverless approach.

Instead of maintaining an always-running EC2 server, the architecture primarily uses usage-based/serverless services.

For example:

- Lambda charges based on execution rather than requiring a continuously running server.
- SQS is usage-based.
- DynamoDB is configured for pay-per-request usage.
- IAM itself does not require a normal per-resource charge.
- CloudWatch costs depend on logs/metrics generated.

For an interview demonstration involving a relatively small number of jobs, the expected usage is very small, although AWS billing should always be monitored.

---

# Main DevOps Concepts Demonstrated

This project demonstrates practical knowledge of:

- AWS serverless architecture
- Event-driven architecture
- Asynchronous processing
- Message queues
- SQS → Lambda integration
- Lambda concurrency
- DynamoDB
- Application caching
- TTL-based caching
- API Gateway
- IAM
- CloudWatch
- Infrastructure as Code
- Terraform
- Infrastructure deployment automation
- Error handling
- Observability
- Scalability
- Decoupled architecture

---

# Project Architecture in One View

```text
                         USER
                           │
                           ▼
                    ┌─────────────┐
                    │  Frontend   │
                    │  Dashboard  │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ API Gateway │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  Producer   │
                    │   Lambda    │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │     SQS     │
                    │ Job Queue   │
                    └──────┬──────┘
                           │
               ┌───────────┼───────────┐
               │           │           │
               ▼           ▼           ▼
           ┌───────┐   ┌───────┐   ┌───────┐
           │Lambda │   │Lambda │   │Lambda │
           │Worker │   │Worker │   │Worker │
           └───┬───┘   └───┬───┘   └───┬───┘
               │           │           │
               └───────────┼───────────┘
                           ▼
                    ┌─────────────┐
                    │  DynamoDB   │
                    │  JobsTable  │
                    └─────────────┘

             Application-Level Cache
                     │
                     ▼
              In-Memory TTL Cache

             Infrastructure Layer
                     │
                     ▼
                  Terraform
                     │
                     ▼
                    AWS
```

---

# Final Interview Summary

> **I built an AWS serverless event-driven job-processing platform to address the performance limitations of serial workload processing. The frontend submits jobs through API Gateway to a producer Lambda, which places them into an SQS queue. Lambda workers consume the queue asynchronously, allowing independent jobs to be processed concurrently. DynamoDB stores the persistent job state, while an application-level TTL cache reduces repeated database reads for frequently accessed data. I use Terraform as Infrastructure as Code to provision and manage the AWS infrastructure, and I added a frontend deployment workflow that allows Terraform initialization, validation, planning, approval, and application to be controlled from the dashboard. The project demonstrates serverless computing, event-driven architecture, asynchronous processing, scalability, caching, observability, IAM, and Infrastructure as Code.**
