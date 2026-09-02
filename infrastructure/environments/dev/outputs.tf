output "sqs_queue_url" {
  value       = module.sqs.queue_url
  description = "Primary SQS Queue URL"
}

output "sqs_queue_arn" {
  value       = module.sqs.queue_arn
  description = "Primary SQS Queue ARN"
}

output "sqs_dlq_arn" {
  value       = module.sqs.dlq_arn
  description = "Dead Letter Queue ARN"
}

output "jobs_table_name" {
  value       = module.dynamodb.jobs_table_name
  description = "DynamoDB Jobs Table Name"
}

output "s3_bucket_name" {
  value       = aws_s3_bucket.artifacts.id
  description = "S3 Artifacts Bucket Name"
}

output "producer_lambda_arn" {
  value       = aws_lambda_function.producer.arn
  description = "Producer Lambda Function ARN"
}

output "worker_lambda_arn" {
  value       = aws_lambda_function.worker.arn
  description = "Worker Lambda Function ARN"
}

output "api_endpoint" {
  value       = aws_apigatewayv2_stage.default.invoke_url
  description = "HTTP API Gateway Invoke URL"
}
