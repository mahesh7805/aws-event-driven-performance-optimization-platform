#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# AWS Event-Driven Platform - Interview Demo Script
# Windows Git Bash / WSL compatible
# Automatically moves to the Terraform dev environment.
# ============================================================

PROJECT_DIR="/e/AWS Project/infrastructure/environments/dev"
REGION="ap-south-1"
TABLE="aws-event-driven-platform-JobsTable-dev"
QUEUE="aws-event-driven-platform-jobs-dev"
PRODUCER="aws-event-driven-platform-producer-dev"
WORKER="aws-event-driven-platform-worker-dev"
API="https://2486dvc4kb.execute-api.ap-south-1.amazonaws.com"

cd "$PROJECT_DIR"

echo
echo "============================================================"
echo " AWS EVENT-DRIVEN PLATFORM - INTERVIEW DEMO"
echo "============================================================"
echo "Directory : $(pwd)"
echo "Region    : $REGION"
echo

echo "[1/7] Checking AWS identity..."
aws sts get-caller-identity --query '{Account:Account,Arn:Arn}' --output table

echo
echo "[2/7] Checking Terraform..."
terraform version
echo
terraform plan

echo
read -rp "Apply Terraform changes? (y/N): " APPLY
if [[ "$APPLY" =~ ^[Yy]$ ]]; then
    terraform apply
fi

echo
echo "[3/7] Checking AWS resources..."
echo "--- DynamoDB ---"
aws dynamodb describe-table \
  --table-name "$TABLE" \
  --region "$REGION" \
  --query 'Table.[TableName,TableStatus,BillingModeSummary.BillingMode]' \
  --output table

echo
echo "--- Producer Lambda ---"
aws lambda get-function \
  --function-name "$PRODUCER" \
  --region "$REGION" \
  --query 'Configuration.[FunctionName,Runtime,Handler,State]' \
  --output table

echo
echo "--- Worker Lambda ---"
aws lambda get-function \
  --function-name "$WORKER" \
  --region "$REGION" \
  --query 'Configuration.[FunctionName,Runtime,Handler,ReservedConcurrentExecutions]' \
  --output table

echo
echo "--- SQS -> Worker mapping ---"
aws lambda list-event-source-mappings \
  --function-name "$WORKER" \
  --region "$REGION" \
  --query 'EventSourceMappings[].{State:State,BatchSize:BatchSize,Queue:EventSourceArn}' \
  --output table

echo
echo "[4/7] Testing API with 10 jobs..."
BODY='{"jobCount":10,"processingMs":200}'
curl -sS -X POST \
  "$API/api/batches/parallel" \
  -H "Content-Type: application/json" \
  -d "$BODY"
echo

echo
echo "[5/7] Waiting for Lambda/SQS processing..."
sleep 10

echo
echo "[6/7] Checking DynamoDB job count..."
aws dynamodb scan \
  --table-name "$TABLE" \
  --region "$REGION" \
  --select COUNT \
  --query '{Items:Count,Scanned:ScannedCount}' \
  --output table

echo
echo "--- Producer logs (last 5 minutes) ---"
aws logs tail "/aws/lambda/$PRODUCER" \
  --region "$REGION" \
  --since 5m \
  --format short || true

echo
echo "--- Worker logs (last 5 minutes) ---"
aws logs tail "/aws/lambda/$WORKER" \
  --region "$REGION" \
  --since 5m \
  --format short || true

echo
echo "[7/7] Terraform final state..."
terraform state list

echo
echo "============================================================"
echo " DEMO COMPLETE"
echo "============================================================"
echo "API: $API"
echo
echo "For another test, run:"
echo 'curl -sS -X POST "$API/api/batches/parallel" -H "Content-Type: application/json" -d '\''{"jobCount":100,"processingMs":200}'\'''
echo
