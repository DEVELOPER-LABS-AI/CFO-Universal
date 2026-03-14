#!/bin/bash

# Deploy Mercury Sync Lambda Proxy Function
# Simple proxy that calls Vercel endpoint with static IP

set -e

REGION="us-east-1"
FUNCTION_NAME="mercury-sync"
RUNTIME="nodejs20.x"
HANDLER="index.handler"
TIMEOUT=900  # 15 minutes
MEMORY=256  # 256 MB (minimal - just a proxy)

echo "=================================================="
echo "Mercury Lambda Proxy Deployment"
echo "=================================================="
echo ""

# Check if vpc-config.json exists
if [ ! -f "vpc-config.json" ]; then
    echo "❌ Error: vpc-config.json not found"
    echo "Please run create-mercury-vpc.sh first"
    exit 1
fi

# Load VPC configuration
VPC_ID=$(jq -r '.vpcId' vpc-config.json)
SUBNET_ID=$(jq -r '.privateSubnetId' vpc-config.json)
SG_ID=$(jq -r '.securityGroupId' vpc-config.json)

echo "VPC Configuration:"
echo "  VPC ID: $VPC_ID"
echo "  Subnet ID: $SUBNET_ID"
echo "  Security Group: $SG_ID"
echo ""

# Get Vercel URL
if [ -z "$VERCEL_URL" ]; then
    echo "❌ Error: VERCEL_URL environment variable not set"
    echo "Please set it:"
    echo "  export VERCEL_URL='https://your-app.vercel.app'"
    exit 1
fi

if [ -z "$CRON_SECRET" ]; then
    echo "❌ Error: CRON_SECRET environment variable not set"
    echo "Please set it (from your .env file)"
    exit 1
fi

echo "Vercel Configuration:"
echo "  URL: $VERCEL_URL"
echo "  Cron Secret: ${CRON_SECRET:0:10}..."
echo ""

# Create Lambda package directory
echo "[1/5] Creating Lambda package..."
rm -rf lambda-proxy
mkdir -p lambda-proxy
cd lambda-proxy

# Create simple proxy handler
cat > index.mjs <<'HANDLER_EOF'
/**
 * AWS Lambda Proxy for Mercury Sync
 * Calls Vercel endpoint with static IP from NAT Gateway
 */

export const handler = async (event) => {
  console.log('[Lambda Proxy] Starting Mercury sync via Vercel');
  console.log('[Lambda Proxy] Event:', JSON.stringify(event, null, 2));

  const startTime = Date.now();
  const vercelUrl = process.env.VERCEL_URL;
  const cronSecret = process.env.CRON_SECRET;

  if (!vercelUrl || !cronSecret) {
    const error = 'Missing VERCEL_URL or CRON_SECRET environment variables';
    console.error('[Lambda Proxy]', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error }),
    };
  }

  const endpoint = `${vercelUrl}/api/mercury/sync/cron`;

  try {
    console.log(`[Lambda Proxy] Calling ${endpoint}`);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cronSecret}`,
      },
      body: JSON.stringify({
        source: 'aws-lambda',
        triggered_at: new Date().toISOString(),
      }),
    });

    const duration = Date.now() - startTime;
    const result = await response.json();

    console.log(`[Lambda Proxy] Vercel response (${response.status}):`, result);
    console.log(`[Lambda Proxy] Completed in ${duration}ms`);

    return {
      statusCode: response.status,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: response.ok,
        vercel_response: result,
        duration_ms: duration,
        static_ip: 'via NAT Gateway',
      }),
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[Lambda Proxy] Error:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: false,
        error: error.message,
        duration_ms: duration,
      }),
    };
  }
};
HANDLER_EOF

echo "✓ Handler created"

# Create deployment package
echo "[2/5] Creating deployment package..."
zip -r ../mercury-sync-lambda.zip index.mjs > /dev/null

cd ..

PACKAGE_SIZE=$(du -h mercury-sync-lambda.zip | cut -f1)
echo "✓ Package created: mercury-sync-lambda.zip ($PACKAGE_SIZE)"

# Check if IAM role exists
echo "[3/5] Setting up IAM role..."
ROLE_NAME="mercury-sync-lambda-role"

if aws iam get-role --role-name $ROLE_NAME &> /dev/null; then
    echo "✓ IAM role exists: $ROLE_NAME"
    ROLE_ARN=$(aws iam get-role --role-name $ROLE_NAME --query 'Role.Arn' --output text)
else
    echo "  Creating IAM role..."

    cat > lambda-trust-policy.json <<'TRUST_EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
TRUST_EOF

    ROLE_ARN=$(aws iam create-role \
      --role-name $ROLE_NAME \
      --assume-role-policy-document file://lambda-trust-policy.json \
      --query 'Role.Arn' \
      --output text)

    aws iam attach-role-policy \
      --role-name $ROLE_NAME \
      --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

    aws iam attach-role-policy \
      --role-name $ROLE_NAME \
      --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole

    echo "✓ IAM role created"
    echo "  Waiting 10 seconds for propagation..."
    sleep 10
fi

echo ""
echo "=================================================="
echo "[4/5] Deploying Lambda Function..."
echo "=================================================="
echo ""

# Delete existing function if it exists
if aws lambda get-function --function-name $FUNCTION_NAME --region $REGION &> /dev/null; then
    echo "Deleting existing function..."
    aws lambda delete-function --function-name $FUNCTION_NAME --region $REGION
    echo "  Waiting 5 seconds..."
    sleep 5
fi

# Create new function
echo "Creating function..."
aws lambda create-function \
  --function-name $FUNCTION_NAME \
  --runtime $RUNTIME \
  --role $ROLE_ARN \
  --handler $HANDLER \
  --zip-file fileb://mercury-sync-lambda.zip \
  --timeout $TIMEOUT \
  --memory-size $MEMORY \
  --vpc-config SubnetIds=[$SUBNET_ID],SecurityGroupIds=[$SG_ID] \
  --environment "Variables={VERCEL_URL=${VERCEL_URL},CRON_SECRET=${CRON_SECRET}}" \
  --region $REGION \
  --output text > /dev/null

echo "✓ Function created"

# Wait for function to be active
echo "  Waiting for function to be active..."
aws lambda wait function-active --function-name $FUNCTION_NAME --region $REGION

FUNCTION_ARN=$(aws lambda get-function \
  --function-name $FUNCTION_NAME \
  --region $REGION \
  --query 'Configuration.FunctionArn' \
  --output text)

echo "[5/5] Cleanup..."
rm -rf lambda-proxy

echo ""
echo "=================================================="
echo "✅ Lambda Proxy Deployed Successfully!"
echo "=================================================="
echo ""
echo "Function Name:     $FUNCTION_NAME"
echo "Function ARN:      $FUNCTION_ARN"
echo "Runtime:           $RUNTIME"
echo "Timeout:           ${TIMEOUT}s"
echo "Memory:            ${MEMORY}MB"
echo "Region:            $REGION"
echo ""
echo "Configuration:"
echo "  Vercel URL:      $VERCEL_URL"
echo "  Static IP:       $(jq -r '.elasticIp' vpc-config.json)"
echo "  Subnet:          $SUBNET_ID"
echo "  Security Group:  $SG_ID"
echo ""
echo "=================================================="
echo "📋 Next Steps:"
echo "=================================================="
echo "1. Test the function:"
echo "   ./test-lambda.sh"
echo ""
echo "2. Set up EventBridge cron:"
echo "   ./setup-cron.sh"
echo ""
echo "=================================================="
