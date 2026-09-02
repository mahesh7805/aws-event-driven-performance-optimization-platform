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

module "sqs" {
  source       = "../../modules/sqs"
  project_name = var.project_name
  environment  = "dev"
}

module "dynamodb" {
  source       = "../../modules/dynamodb"
  project_name = var.project_name
  environment  = "dev"
}

resource "aws_s3_bucket" "artifacts" {
  bucket        = "${var.project_name}-artifacts-dev-${var.aws_region}"
  force_destroy = true
}
