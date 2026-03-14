#!/bin/bash

# Test Mercury Sync Lambda Function

set -e

REGION="us-east-1"
FUNCTION_NAME="mercury-sync"

echo "=================================================="
echo "Testing Mercury Sync Lambda Function"
echo "=================================================="
echo ""

# Invoke Lambda function
echo "Invoking Lambda function..."
echo ""

aws lambda invoke \
  --function-name $FUNCTION_NAME \
  --region $REGION \
  --payload '{"source":"manual-test"}' \
  --cli-binary-format raw-in-base64-out \
  response.json

echo ""
echo "=================================================="
echo "Lambda Response:"
echo "=================================================="
cat response.json | jq '.'
echo ""

# Check if successful
if jq -e '.success == true' response.json > /dev/null; then
    echo "✅ Test PASSED - Lambda executed successfully"
else
    echo "❌ Test FAILED - Check the error above"
    exit 1
fi

echo ""
echo "=================================================="
echo "View detailed logs:"
echo "=================================================="
echo "aws logs tail /aws/lambda/$FUNCTION_NAME --follow"
echo ""
