terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# --- Core Infrastructure Modules ---

module "sqs" {
  source       = "../../modules/sqs"
  project_name = var.project_name
  environment  = var.environment
}

module "dynamodb" {
  source       = "../../modules/dynamodb"
  project_name = var.project_name
  environment  = var.environment
}

resource "aws_s3_bucket" "artifacts" {
  bucket        = "${var.project_name}-artifacts-${var.environment}-${var.aws_region}"
  force_destroy = true
}

# --- IAM Roles and Policies ---

resource "aws_iam_role" "lambda_exec" {
  name = "${var.project_name}-lambda-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "lambda_policy" {
  name = "${var.project_name}-lambda-policy-${var.environment}"
  role = aws_iam_role.lambda_exec.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes",
          "sqs:GetQueueUrl"
        ]
        Resource = [
          module.sqs.queue_arn,
          module.sqs.dlq_arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          module.dynamodb.jobs_table_arn,
          "${module.dynamodb.jobs_table_arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject"
        ]
        Resource = "${aws_s3_bucket.artifacts.arn}/*"
      }
    ]
  })
}

# --- Dummy ZIP Archive for Initial Lambda Deployment ---

data "archive_file" "dummy_lambda_zip" {
  type        = "zip"
  output_path = "${path.module}/dummy_lambda.zip"

  source {
    content  = "exports.handler = async () => ({ statusCode: 200, body: 'OK' });"
    filename = "index.js"
  }
}

# --- Lambda Functions ---

resource "aws_lambda_function" "producer" {
  function_name    = "${var.project_name}-producer-${var.environment}"
  role             = aws_iam_role.lambda_exec.arn
  handler          = "producer.handler"
  runtime          = "nodejs20.x"
  filename         = data.archive_file.dummy_lambda_zip.output_path
  source_code_hash = data.archive_file.dummy_lambda_zip.output_base64sha256
  timeout          = 30

  environment {
    variables = {
      SQS_QUEUE_URL                       = module.sqs.queue_url
      AWS_NODEJS_CONNECTION_REUSE_ENABLED = "1"
    }
  }
}

resource "aws_lambda_function" "worker" {
  function_name                  = "${var.project_name}-worker-${var.environment}"
  role                           = aws_iam_role.lambda_exec.arn
  handler                        = "worker.handler"
  runtime                        = "nodejs20.x"
  filename                       = data.archive_file.dummy_lambda_zip.output_path
  source_code_hash               = data.archive_file.dummy_lambda_zip.output_base64sha256
  timeout                        = 30
  reserved_concurrent_executions = 50

  environment {
    variables = {
      DYNAMODB_JOBS_TABLE                 = module.dynamodb.jobs_table_name
      AWS_NODEJS_CONNECTION_REUSE_ENABLED = "1"
    }
  }
}

# --- SQS to Lambda Event Source Mapping ---

resource "aws_lambda_event_source_mapping" "sqs_trigger" {
  event_source_arn                   = module.sqs.queue_arn
  function_name                      = aws_lambda_function.worker.arn
  batch_size                         = 10
  maximum_batching_window_in_seconds = 1
  function_response_types            = ["ReportBatchItemFailures"]
}

# --- API Gateway HTTP API ---

resource "aws_apigatewayv2_api" "http_api" {
  name          = "${var.project_name}-api-${var.environment}"
  protocol_type = "HTTP"
  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET", "POST", "OPTIONS"]
    allow_headers = ["*"]
  }
}

resource "aws_apigatewayv2_integration" "producer_integration" {
  api_id                 = aws_apigatewayv2_api.http_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.producer.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "producer_route" {
  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = "POST /api/batches/parallel"
  target    = "integrations/${aws_apigatewayv2_integration.producer_integration.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.http_api.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_lambda_permission" "apigw_producer" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.producer.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http_api.execution_arn}/*/*"
}
