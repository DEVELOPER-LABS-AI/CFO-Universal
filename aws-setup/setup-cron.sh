#!/bin/bash

# Set up EventBridge (CloudWatch Events) cron for daily Mercury sync

set -e

REGION="us-east-1"
FUNCTION_NAME="mercury-sync"
RULE_NAME="mercury-daily-sync"
SCHEDULE="cron(0 2 * * ? *)"  # Daily at 2 AM UTC

echo "=================================================="
echo "Setting Up EventBridge Cron Schedule"
echo "=================================================="
echo ""
echo "Schedule: Daily at 2 AM UTC"
echo "Function: $FUNCTION_NAME"
echo "Rule: $RULE_NAME"
echo ""

# Get AWS Account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Get Lambda function ARN
FUNCTION_ARN=$(aws lambda get-function \
  --function-name $FUNCTION_NAME \
  --region $REGION \
  --query 'Configuration.FunctionArn' \
  --output text)

echo "Account ID: $ACCOUNT_ID"
echo "Function ARN: $FUNCTION_ARN"
echo ""

# Check if rule exists
if aws events describe-rule --name $RULE_NAME --region $REGION &> /dev/null; then
    echo "EventBridge rule exists, updating..."

    # Update rule
    aws events put-rule \
      --name $RULE_NAME \
      --schedule-expression "$SCHEDULE" \
      --state ENABLED \
      --description "Daily Mercury Bank transaction sync at 2 AM UTC" \
      --region $REGION \
      --output text > /dev/null

    echo "✓ Rule updated"

else
    echo "Creating new EventBridge rule..."

    # Create rule
    aws events put-rule \
      --name $RULE_NAME \
      --schedule-expression "$SCHEDULE" \
      --state ENABLED \
      --description "Daily Mercury Bank transaction sync at 2 AM UTC" \
      --region $REGION \
      --output text > /dev/null

    echo "✓ Rule created"
fi

# Add Lambda as target
echo "Adding Lambda function as target..."

aws events put-targets \
  --rule $RULE_NAME \
  --targets "Id=1,Arn=$FUNCTION_ARN" \
  --region $REGION \
  --output text > /dev/null

echo "✓ Target added"

# Grant EventBridge permission to invoke Lambda
echo "Granting EventBridge permission to invoke Lambda..."

aws lambda add-permission \
  --function-name $FUNCTION_NAME \
  --statement-id eventbridge-invoke-mercury-sync \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn arn:aws:events:$REGION:$ACCOUNT_ID:rule/$RULE_NAME \
  --region $REGION \
  --output text > /dev/null 2>&1 || echo "  (Permission may already exist)"

echo "✓ Permissions configured"

# Verify rule
RULE_STATE=$(aws events describe-rule \
  --name $RULE_NAME \
  --region $REGION \
  --query 'State' \
  --output text)

echo ""
echo "=================================================="
echo "✅ EventBridge Cron Schedule Configured!"
echo "=================================================="
echo ""
echo "Rule Name:      $RULE_NAME"
echo "State:          $RULE_STATE"
echo "Schedule:       $SCHEDULE (Daily at 2 AM UTC)"
echo "Target:         $FUNCTION_NAME"
echo ""
echo "Next sync will occur at the next scheduled time."
echo ""
echo "=================================================="
echo "📋 Management Commands:"
echo "=================================================="
echo ""
echo "Disable cron:"
echo "  aws events disable-rule --name $RULE_NAME --region $REGION"
echo ""
echo "Enable cron:"
echo "  aws events enable-rule --name $RULE_NAME --region $REGION"
echo ""
echo "View rule details:"
echo "  aws events describe-rule --name $RULE_NAME --region $REGION"
echo ""
echo "View recent invocations:"
echo "  aws logs tail /aws/lambda/$FUNCTION_NAME --since 1h"
echo ""
echo "=================================================="
