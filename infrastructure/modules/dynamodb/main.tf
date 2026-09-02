resource "aws_dynamodb_table" "jobs_table" {
  name         = "${var.project_name}-JobsTable-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "jobId"
  range_key    = "batchId"

  attribute {
    name = "jobId"
    type = "S"
  }

  attribute {
    name = "batchId"
    type = "S"
  }

  global_secondary_index {
    name            = "BatchIndex"
    hash_key        = "batchId"
    projection_type = "ALL"
  }
}

resource "aws_dynamodb_table" "batches_table" {
  name         = "${var.project_name}-BatchesTable-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "batchId"

  attribute {
    name = "batchId"
    type = "S"
  }
}

resource "aws_dynamodb_table" "benchmarks_table" {
  name         = "${var.project_name}-BenchmarksTable-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "benchmarkId"

  attribute {
    name = "benchmarkId"
    type = "S"
  }
}

output "jobs_table_name" {
  value = aws_dynamodb_table.jobs_table.name
}

output "jobs_table_arn" {
  value = aws_dynamodb_table.jobs_table.arn
}
