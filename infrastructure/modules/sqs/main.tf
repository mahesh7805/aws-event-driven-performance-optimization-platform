resource "aws_sqs_queue" "dlq" {
  name                      = "${var.project_name}-dlq-${var.environment}"
  message_retention_seconds = 1209600 # 14 days
}

resource "aws_sqs_queue" "main_queue" {
  name                       = "${var.project_name}-jobs-${var.environment}"
  visibility_timeout_seconds = 30
  message_retention_seconds  = 345600 # 4 days
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq.arn
    maxReceiveCount     = 3
  })
}

output "queue_url" {
  value = aws_sqs_queue.main_queue.id
}

output "queue_arn" {
  value = aws_sqs_queue.main_queue.arn
}

output "dlq_arn" {
  value = aws_sqs_queue.dlq.arn
}
