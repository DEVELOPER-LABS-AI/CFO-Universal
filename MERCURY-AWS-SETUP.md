# Mercury Integration with AWS Lambda + Static IP Setup

Deploy Mercury sync logic to AWS Lambda with a static Elastic IP for Mercury API whitelisting.

---

## Architecture Overview

```
Mercury API (requires static IP whitelist)
    ↑
    | HTTPS requests
    |
AWS Lambda Function (Mercury sync)
    ↑
    | Routes through NAT Gateway
    |
NAT Gateway (in public subnet)
    ↑
    | Has Elastic IP (static)
    |
Internet Gateway
```

**Your Vercel app** → Triggers Lambda via HTTP API → Lambda syncs with Mercury → Returns results

---

## Cost Breakdown

| Service | Cost | Details |
|---------|------|---------|
| **NAT Gateway** | ~$32/month | $0.045/hour + data transfer |
| **Elastic IP** | $0 | Free when attached to NAT Gateway |
| **Lambda** | ~$0-5/month | First 1M requests free, then $0.20/1M |
| **CloudWatch Logs** | ~$1/month | Log storage |
| **API Gateway** | ~$1/month | First 1M requests free |
| **Total** | **~$34-38/month** | Much cheaper than Vercel Enterprise |

---

## Prerequisites

1. AWS Account with admin access
2. AWS CLI installed and configured
3. Node.js and npm installed locally

---

## Step 1: Install AWS CLI (if not already installed)

### macOS:
```bash
brew install awscli
```

### Linux/Windows WSL:
```bash
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
```

### Verify installation:
```bash
aws --version
# Should show: aws-cli/2.x.x
```

---

## Step 2: Configure AWS Credentials

### 2.1 Create IAM User (if needed)

```bash
# Create IAM user for CLI access
aws iam create-user --user-name mercury-sync-deployer

# Attach admin policy (or create custom policy with limited permissions)
aws iam attach-user-policy \
  --user-name mercury-sync-deployer \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess

# Create access key
aws iam create-access-key --user-name mercury-sync-deployer
```

Save the `AccessKeyId` and `SecretAccessKey` from the output.

### 2.2 Configure AWS CLI

```bash
aws configure
```

Enter:
- **AWS Access Key ID**: [from step 2.1]
- **AWS Secret Access Key**: [from step 2.1]
- **Default region**: `us-east-1` (or your preferred region)
- **Default output format**: `json`

### 2.3 Verify Configuration

```bash
aws sts get-caller-identity
```

Should show your account details.

---

## Step 3: Create VPC Infrastructure

We'll create a VPC with public and private subnets, NAT Gateway, and Elastic IP.

### 3.1 Create Infrastructure Script

Create file: `aws-setup/create-mercury-vpc.sh`

```bash
#!/bin/bash

# Mercury VPC Setup Script
# Creates VPC, subnets, NAT Gateway, and Elastic IP for Lambda

set -e

REGION="us-east-1"
VPC_NAME="mercury-sync-vpc"
CIDR_BLOCK="10.0.0.0/16"

echo "Creating VPC for Mercury sync..."

# Create VPC
VPC_ID=$(aws ec2 create-vpc \
  --cidr-block $CIDR_BLOCK \
  --region $REGION \
  --tag-specifications "ResourceType=vpc,Tags=[{Key=Name,Value=$VPC_NAME}]" \
  --query 'Vpc.VpcId' \
  --output text)

echo "Created VPC: $VPC_ID"

# Enable DNS hostnames
aws ec2 modify-vpc-attribute \
  --vpc-id $VPC_ID \
  --enable-dns-hostnames \
  --region $REGION

# Create Internet Gateway
IGW_ID=$(aws ec2 create-internet-gateway \
  --region $REGION \
  --tag-specifications "ResourceType=internet-gateway,Tags=[{Key=Name,Value=$VPC_NAME-igw}]" \
  --query 'InternetGateway.InternetGatewayId' \
  --output text)

echo "Created Internet Gateway: $IGW_ID"

# Attach Internet Gateway to VPC
aws ec2 attach-internet-gateway \
  --vpc-id $VPC_ID \
  --internet-gateway-id $IGW_ID \
  --region $REGION

# Create Public Subnet
PUBLIC_SUBNET_ID=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.1.0/24 \
  --availability-zone ${REGION}a \
  --region $REGION \
  --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=$VPC_NAME-public}]" \
  --query 'Subnet.SubnetId' \
  --output text)

echo "Created Public Subnet: $PUBLIC_SUBNET_ID"

# Create Private Subnet (for Lambda)
PRIVATE_SUBNET_ID=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.2.0/24 \
  --availability-zone ${REGION}a \
  --region $REGION \
  --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=$VPC_NAME-private}]" \
  --query 'Subnet.SubnetId' \
  --output text)

echo "Created Private Subnet: $PRIVATE_SUBNET_ID"

# Allocate Elastic IP for NAT Gateway
EIP_ALLOC_ID=$(aws ec2 allocate-address \
  --domain vpc \
  --region $REGION \
  --tag-specifications "ResourceType=elastic-ip,Tags=[{Key=Name,Value=$VPC_NAME-nat-eip}]" \
  --query 'AllocationId' \
  --output text)

# Get the actual Elastic IP address
EIP_ADDRESS=$(aws ec2 describe-addresses \
  --allocation-ids $EIP_ALLOC_ID \
  --region $REGION \
  --query 'Addresses[0].PublicIp' \
  --output text)

echo "Allocated Elastic IP: $EIP_ADDRESS (AllocationId: $EIP_ALLOC_ID)"

# Create NAT Gateway
NAT_GW_ID=$(aws ec2 create-nat-gateway \
  --subnet-id $PUBLIC_SUBNET_ID \
  --allocation-id $EIP_ALLOC_ID \
  --region $REGION \
  --tag-specifications "ResourceType=natgateway,Tags=[{Key=Name,Value=$VPC_NAME-nat}]" \
  --query 'NatGateway.NatGatewayId' \
  --output text)

echo "Created NAT Gateway: $NAT_GW_ID"
echo "Waiting for NAT Gateway to become available (this takes 1-2 minutes)..."

# Wait for NAT Gateway to be available
aws ec2 wait nat-gateway-available \
  --nat-gateway-ids $NAT_GW_ID \
  --region $REGION

echo "NAT Gateway is now available!"

# Create Route Table for Public Subnet
PUBLIC_RT_ID=$(aws ec2 create-route-table \
  --vpc-id $VPC_ID \
  --region $REGION \
  --tag-specifications "ResourceType=route-table,Tags=[{Key=Name,Value=$VPC_NAME-public-rt}]" \
  --query 'RouteTable.RouteTableId' \
  --output text)

echo "Created Public Route Table: $PUBLIC_RT_ID"

# Add route to Internet Gateway
aws ec2 create-route \
  --route-table-id $PUBLIC_RT_ID \
  --destination-cidr-block 0.0.0.0/0 \
  --gateway-id $IGW_ID \
  --region $REGION

# Associate Public Route Table with Public Subnet
aws ec2 associate-route-table \
  --subnet-id $PUBLIC_SUBNET_ID \
  --route-table-id $PUBLIC_RT_ID \
  --region $REGION

# Create Route Table for Private Subnet
PRIVATE_RT_ID=$(aws ec2 create-route-table \
  --vpc-id $VPC_ID \
  --region $REGION \
  --tag-specifications "ResourceType=route-table,Tags=[{Key=Name,Value=$VPC_NAME-private-rt}]" \
  --query 'RouteTable.RouteTableId' \
  --output text)

echo "Created Private Route Table: $PRIVATE_RT_ID"

# Add route to NAT Gateway
aws ec2 create-route \
  --route-table-id $PRIVATE_RT_ID \
  --destination-cidr-block 0.0.0.0/0 \
  --nat-gateway-id $NAT_GW_ID \
  --region $REGION

# Associate Private Route Table with Private Subnet
aws ec2 associate-route-table \
  --subnet-id $PRIVATE_SUBNET_ID \
  --route-table-id $PRIVATE_RT_ID \
  --region $REGION

# Create Security Group for Lambda
SG_ID=$(aws ec2 create-security-group \
  --group-name mercury-sync-lambda-sg \
  --description "Security group for Mercury sync Lambda function" \
  --vpc-id $VPC_ID \
  --region $REGION \
  --query 'GroupId' \
  --output text)

echo "Created Security Group: $SG_ID"

# Allow outbound HTTPS (443) traffic
aws ec2 authorize-security-group-egress \
  --group-id $SG_ID \
  --ip-permissions IpProtocol=tcp,FromPort=443,ToPort=443,IpRanges=[{CidrIp=0.0.0.0/0}] \
  --region $REGION

# Save IDs to config file
cat > aws-setup/vpc-config.json <<EOF
{
  "region": "$REGION",
  "vpcId": "$VPC_ID",
  "publicSubnetId": "$PUBLIC_SUBNET_ID",
  "privateSubnetId": "$PRIVATE_SUBNET_ID",
  "natGatewayId": "$NAT_GW_ID",
  "elasticIp": "$EIP_ADDRESS",
  "elasticIpAllocationId": "$EIP_ALLOC_ID",
  "securityGroupId": "$SG_ID"
}
EOF

echo ""
echo "=========================================="
echo "VPC Setup Complete!"
echo "=========================================="
echo "VPC ID: $VPC_ID"
echo "Public Subnet: $PUBLIC_SUBNET_ID"
echo "Private Subnet: $PRIVATE_SUBNET_ID"
echo "NAT Gateway: $NAT_GW_ID"
echo "Elastic IP: $EIP_ADDRESS"
echo "Security Group: $SG_ID"
echo ""
echo "✅ Whitelist this IP in Mercury: $EIP_ADDRESS"
echo ""
echo "Configuration saved to: aws-setup/vpc-config.json"
echo "=========================================="
```

### 3.2 Run the Script

```bash
# Create directory
mkdir -p aws-setup

# Create the script (copy content above)
nano aws-setup/create-mercury-vpc.sh

# Make executable
chmod +x aws-setup/create-mercury-vpc.sh

# Run it
./aws-setup/create-mercury-vpc.sh
```

**Save the Elastic IP** from the output - you'll whitelist this in Mercury!

---

## Step 4: Whitelist Elastic IP in Mercury

1. Go to Mercury dashboard: https://app.mercury.com
2. Navigate to: **Settings** → **Developers** → **API Keys**
3. Click on your API key
4. Add the **Elastic IP** from Step 3 to the whitelist
5. Save changes
6. Wait 5-10 minutes for propagation

---

## Step 5: Create Lambda Function

### 5.1 Create Lambda Deployment Package

Create file: `aws-setup/package-lambda.sh`

```bash
#!/bin/bash

# Package Mercury sync Lambda function

set -e

echo "Packaging Mercury sync Lambda function..."

# Create lambda directory
mkdir -p aws-setup/lambda
cd aws-setup/lambda

# Copy necessary files from main project
cp -r ../../lib/mercury .
cp -r ../../types .
cp ../../prisma/schema.prisma .

# Create Lambda handler
cat > index.mjs <<'EOF'
/**
 * AWS Lambda Handler for Mercury Sync
 * Triggered by EventBridge (cron) or HTTP API Gateway
 */

import { runScheduledSync } from './mercury/scheduled-sync.js';

export const handler = async (event) => {
  console.log('[Lambda] Mercury sync triggered:', event);

  try {
    const result = await runScheduledSync();

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        result,
      }),
    };
  } catch (error) {
    console.error('[Lambda] Mercury sync failed:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message,
      }),
    };
  }
};
EOF

# Create package.json
cat > package.json <<'EOF'
{
  "name": "mercury-sync-lambda",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "@prisma/client": "^6.3.0",
    "axios": "^1.7.9",
    "https-proxy-agent": "^7.0.5",
    "string-similarity": "^4.0.4"
  }
}
EOF

# Install dependencies
npm install --production

# Create deployment package
zip -r ../mercury-sync-lambda.zip .

cd ../..

echo "Lambda package created: aws-setup/mercury-sync-lambda.zip"
```

### 5.2 Run packaging script

```bash
chmod +x aws-setup/package-lambda.sh
./aws-setup/package-lambda.sh
```

### 5.3 Create Lambda IAM Role

```bash
# Create trust policy
cat > aws-setup/lambda-trust-policy.json <<'EOF'
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
EOF

# Create IAM role
aws iam create-role \
  --role-name mercury-sync-lambda-role \
  --assume-role-policy-document file://aws-setup/lambda-trust-policy.json

# Attach basic Lambda execution policy
aws iam attach-role-policy \
  --role-name mercury-sync-lambda-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# Attach VPC execution policy (for NAT Gateway access)
aws iam attach-role-policy \
  --role-name mercury-sync-lambda-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole
```

### 5.4 Deploy Lambda Function

```bash
# Get Role ARN
ROLE_ARN=$(aws iam get-role --role-name mercury-sync-lambda-role --query 'Role.Arn' --output text)

# Get VPC config
VPC_ID=$(jq -r '.vpcId' aws-setup/vpc-config.json)
SUBNET_ID=$(jq -r '.privateSubnetId' aws-setup/vpc-config.json)
SG_ID=$(jq -r '.securityGroupId' aws-setup/vpc-config.json)

# Create Lambda function
aws lambda create-function \
  --function-name mercury-sync \
  --runtime nodejs20.x \
  --role $ROLE_ARN \
  --handler index.handler \
  --zip-file fileb://aws-setup/mercury-sync-lambda.zip \
  --timeout 900 \
  --memory-size 512 \
  --vpc-config SubnetIds=[$SUBNET_ID],SecurityGroupIds=[$SG_ID] \
  --environment "Variables={
    DATABASE_URL=${DATABASE_URL},
    ENCRYPTION_KEY=${ENCRYPTION_KEY}
  }" \
  --region us-east-1

echo "Lambda function deployed successfully!"
```

---

## Step 6: Create HTTP API Gateway (for Vercel to trigger)

### 6.1 Create API Gateway

```bash
# Create HTTP API
API_ID=$(aws apigatewayv2 create-api \
  --name mercury-sync-api \
  --protocol-type HTTP \
  --target arn:aws:lambda:us-east-1:YOUR_ACCOUNT_ID:function:mercury-sync \
  --query 'ApiId' \
  --output text)

echo "Created API Gateway: $API_ID"

# Get API endpoint
API_ENDPOINT=$(aws apigatewayv2 get-api --api-id $API_ID --query 'ApiEndpoint' --output text)

echo "API Endpoint: $API_ENDPOINT"

# Grant API Gateway permission to invoke Lambda
aws lambda add-permission \
  --function-name mercury-sync \
  --statement-id apigateway-invoke \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com
```

### 6.2 Save API Endpoint

```bash
# Add to VPC config
jq '.apiEndpoint = "$API_ENDPOINT"' aws-setup/vpc-config.json > aws-setup/vpc-config.tmp.json
mv aws-setup/vpc-config.tmp.json aws-setup/vpc-config.json
```

---

## Step 7: Update Vercel to Use Lambda

### 7.1 Add Lambda Endpoint to Vercel Env

1. Go to Vercel Dashboard → Environment Variables
2. Add:
   - **Name**: `MERCURY_SYNC_LAMBDA_URL`
   - **Value**: API endpoint from Step 6
   - **Environments**: Production, Preview, Development

### 7.2 Update Mercury Sync Endpoint (Optional)

You can keep the existing Vercel endpoint or redirect to Lambda:

```typescript
// app/api/mercury/sync/manual/route.ts
export async function POST(request: NextRequest) {
  // Delegate to Lambda if configured
  if (process.env.MERCURY_SYNC_LAMBDA_URL) {
    const response = await fetch(process.env.MERCURY_SYNC_LAMBDA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(await request.json()),
    });

    return NextResponse.json(await response.json());
  }

  // Fall back to local sync (existing code)
  // ...
}
```

---

## Step 8: Set Up Scheduled Sync (EventBridge)

### 8.1 Create EventBridge Rule

```bash
# Create cron rule (daily at 2 AM UTC)
aws events put-rule \
  --name mercury-daily-sync \
  --schedule-expression "cron(0 2 * * ? *)" \
  --state ENABLED

# Add Lambda as target
aws events put-targets \
  --rule mercury-daily-sync \
  --targets "Id=1,Arn=arn:aws:lambda:us-east-1:YOUR_ACCOUNT_ID:function:mercury-sync"

# Grant EventBridge permission to invoke Lambda
aws lambda add-permission \
  --function-name mercury-sync \
  --statement-id eventbridge-invoke \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn arn:aws:events:us-east-1:YOUR_ACCOUNT_ID:rule/mercury-daily-sync
```

---

## Step 9: Test the Setup

### 9.1 Test Lambda Directly

```bash
aws lambda invoke \
  --function-name mercury-sync \
  --payload '{}' \
  --cli-binary-format raw-in-base64-out \
  response.json

cat response.json
```

### 9.2 Test via API Gateway

```bash
curl -X POST $API_ENDPOINT
```

### 9.3 Check CloudWatch Logs

```bash
aws logs tail /aws/lambda/mercury-sync --follow
```

---

## Monitoring & Maintenance

### View Lambda Logs
```bash
aws logs tail /aws/lambda/mercury-sync --follow --format short
```

### View NAT Gateway Metrics
```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/NATGateway \
  --metric-name BytesOutToSource \
  --dimensions Name=NatGatewayId,Value=$NAT_GW_ID \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 3600 \
  --statistics Sum
```

### Update Lambda Code
```bash
# Repackage
./aws-setup/package-lambda.sh

# Update function
aws lambda update-function-code \
  --function-name mercury-sync \
  --zip-file fileb://aws-setup/mercury-sync-lambda.zip
```

---

## Cleanup (if needed)

To remove all AWS resources and stop charges:

```bash
# Delete Lambda function
aws lambda delete-function --function-name mercury-sync

# Delete API Gateway
aws apigatewayv2 delete-api --api-id $API_ID

# Delete NAT Gateway
aws ec2 delete-nat-gateway --nat-gateway-id $NAT_GW_ID

# Release Elastic IP (after NAT Gateway is deleted)
aws ec2 release-address --allocation-id $EIP_ALLOC_ID

# Delete subnets, route tables, Internet Gateway, VPC
# (run manually to avoid accidental deletion)
```

---

## Summary

**What You Built**:
- ✅ VPC with NAT Gateway and static Elastic IP
- ✅ Lambda function for Mercury sync
- ✅ HTTP API Gateway for Vercel integration
- ✅ EventBridge cron for daily sync
- ✅ CloudWatch logging and monitoring

**Cost**: ~$34-38/month
**Static IP**: Yes (Elastic IP)
**Scalable**: Yes (Lambda auto-scales)
**Full Control**: Yes (your AWS account)

**Next**: Whitelist the Elastic IP in Mercury dashboard!
