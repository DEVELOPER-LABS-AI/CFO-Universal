#!/bin/bash

# Deploy Mercury Sync Lambda Function
# Packages and deploys the Mercury sync logic to AWS Lambda

set -e

REGION="us-east-1"
FUNCTION_NAME="mercury-sync"
RUNTIME="nodejs20.x"
HANDLER="index.handler"
TIMEOUT=900  # 15 minutes
MEMORY=1024  # 1 GB

echo "=================================================="
echo "Mercury Lambda Function Deployment"
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

# Check for required environment variables
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL environment variable not set"
    echo "Please set it in your .env file:"
    echo "  export DATABASE_URL='your-supabase-connection-string'"
    exit 1
fi

if [ -z "$ENCRYPTION_KEY" ]; then
    echo "⚠️  Warning: ENCRYPTION_KEY not set"
    echo "Generating a new encryption key..."
    ENCRYPTION_KEY=$(openssl rand -base64 32)
    echo "Generated: $ENCRYPTION_KEY"
    echo "Add this to your .env file!"
fi

echo "Environment variables configured ✓"
echo ""

# Create Lambda package directory
echo "[1/7] Creating Lambda package directory..."
rm -rf lambda
mkdir -p lambda
cd lambda

echo "✓ Directory created"

# Copy Mercury library files and install build dependencies
echo "[2/7] Setting up project files..."
cp -r ../../lib .
cp -r ../../types .
mkdir -p prisma
cp ../../prisma/schema.prisma prisma/
cp ../../package.json package-temp.json
cp ../../tsconfig.json . 2>/dev/null || true

echo "✓ Files copied"

# Create Lambda handler
echo "[3/7] Creating Lambda handler..."
cat > index.mjs <<'HANDLER_EOF'
/**
 * AWS Lambda Handler for Mercury Sync
 * Triggered by EventBridge (cron) or HTTP API Gateway
 */

import { runScheduledSync } from './mercury/scheduled-sync.js';

export const handler = async (event) => {
  console.log('[Lambda] Mercury sync triggered');
  console.log('[Lambda] Event:', JSON.stringify(event, null, 2));

  const startTime = Date.now();

  try {
    const result = await runScheduledSync();

    const duration = Date.now() - startTime;
    console.log(`[Lambda] Sync completed in ${duration}ms`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: true,
        result,
        duration_ms: duration,
      }),
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[Lambda] Mercury sync failed:', error);

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

# Create package.json with build tools
echo "[4/7] Creating package.json..."
cat > package.json <<'PACKAGE_EOF'
{
  "name": "mercury-sync-lambda",
  "version": "1.0.0",
  "type": "module",
  "description": "Mercury Banking integration sync Lambda function",
  "dependencies": {
    "@prisma/client": "^6.3.0",
    "axios": "^1.7.9",
    "https-proxy-agent": "^7.0.5",
    "string-similarity": "^4.0.4"
  },
  "devDependencies": {
    "esbuild": "^0.24.2",
    "typescript": "^5.3.3"
  }
}
PACKAGE_EOF

echo "✓ package.json created"

# Install dependencies
echo "[5/7] Installing dependencies and building..."
npm install --silent

# Bundle with esbuild
npx esbuild index.mjs \
  --bundle \
  --platform=node \
  --target=node20 \
  --outfile=dist/index.mjs \
  --format=esm \
  --external:@prisma/client \
  --external:axios \
  --external:https-proxy-agent \
  --external:string-similarity

# Copy to root and clean up dev dependencies
mv dist/index.mjs index.mjs
rm -rf dist lib types node_modules package-lock.json

# Install production dependencies only
npm install --production --silent

echo "✓ Dependencies bundled and installed"

# Create deployment package
echo "[6/7] Creating deployment package..."
zip -r ../mercury-sync-lambda.zip . > /dev/null

cd ..

PACKAGE_SIZE=$(du -h mercury-sync-lambda.zip | cut -f1)
echo "✓ Package created: mercury-sync-lambda.zip ($PACKAGE_SIZE)"

# Check if IAM role exists, create if not
echo "[7/7] Setting up IAM role..."
ROLE_NAME="mercury-sync-lambda-role"

if aws iam get-role --role-name $ROLE_NAME &> /dev/null; then
    echo "✓ IAM role already exists: $ROLE_NAME"
    ROLE_ARN=$(aws iam get-role --role-name $ROLE_NAME --query 'Role.Arn' --output text)
else
    echo "  Creating IAM role..."

    # Create trust policy
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

    # Create IAM role
    ROLE_ARN=$(aws iam create-role \
      --role-name $ROLE_NAME \
      --assume-role-policy-document file://lambda-trust-policy.json \
      --query 'Role.Arn' \
      --output text)

    # Attach policies
    aws iam attach-role-policy \
      --role-name $ROLE_NAME \
      --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

    aws iam attach-role-policy \
      --role-name $ROLE_NAME \
      --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole

    echo "✓ IAM role created: $ROLE_ARN"
    echo "  Waiting 10 seconds for role to propagate..."
    sleep 10
fi

echo ""
echo "=================================================="
echo "Deploying Lambda Function..."
echo "=================================================="
echo ""

# Check if function exists
if aws lambda get-function --function-name $FUNCTION_NAME --region $REGION &> /dev/null; then
    echo "Function exists, updating code..."

    # Update function code
    aws lambda update-function-code \
      --function-name $FUNCTION_NAME \
      --zip-file fileb://mercury-sync-lambda.zip \
      --region $REGION \
      --output text > /dev/null

    echo "✓ Function code updated"

    # Update function configuration
    aws lambda update-function-configuration \
      --function-name $FUNCTION_NAME \
      --runtime $RUNTIME \
      --handler $HANDLER \
      --timeout $TIMEOUT \
      --memory-size $MEMORY \
      --vpc-config SubnetIds=[$SUBNET_ID],SecurityGroupIds=[$SG_ID] \
      --environment "Variables={DATABASE_URL=${DATABASE_URL},ENCRYPTION_KEY=${ENCRYPTION_KEY}}" \
      --region $REGION \
      --output text > /dev/null

    echo "✓ Function configuration updated"

else
    echo "Creating new function..."

    # Create Lambda function
    aws lambda create-function \
      --function-name $FUNCTION_NAME \
      --runtime $RUNTIME \
      --role $ROLE_ARN \
      --handler $HANDLER \
      --zip-file fileb://mercury-sync-lambda.zip \
      --timeout $TIMEOUT \
      --memory-size $MEMORY \
      --vpc-config SubnetIds=[$SUBNET_ID],SecurityGroupIds=[$SG_ID] \
      --environment "Variables={DATABASE_URL=${DATABASE_URL},ENCRYPTION_KEY=${ENCRYPTION_KEY}}" \
      --region $REGION \
      --output text > /dev/null

    echo "✓ Function created"
fi

# Get function details
FUNCTION_ARN=$(aws lambda get-function \
  --function-name $FUNCTION_NAME \
  --region $REGION \
  --query 'Configuration.FunctionArn' \
  --output text)

echo ""
echo "=================================================="
echo "✅ Lambda Function Deployed Successfully!"
echo "=================================================="
echo ""
echo "Function Name:     $FUNCTION_NAME"
echo "Function ARN:      $FUNCTION_ARN"
echo "Runtime:           $RUNTIME"
echo "Timeout:           ${TIMEOUT}s"
echo "Memory:            ${MEMORY}MB"
echo "Region:            $REGION"
echo ""
echo "VPC Configuration:"
echo "  Subnet:          $SUBNET_ID"
echo "  Security Group:  $SG_ID"
echo ""
echo "=================================================="
echo "📋 Next Steps:"
echo "=================================================="
echo "1. Test the function:"
echo "   ./test-lambda.sh"
echo ""
echo "2. Set up EventBridge cron (daily at 2 AM UTC):"
echo "   ./setup-cron.sh"
echo ""
echo "3. Monitor logs:"
echo "   aws logs tail /aws/lambda/$FUNCTION_NAME --follow"
echo ""
echo "=================================================="
