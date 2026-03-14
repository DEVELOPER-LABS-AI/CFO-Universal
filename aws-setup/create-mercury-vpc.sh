#!/bin/bash

# Mercury VPC Setup Script
# Creates VPC, subnets, NAT Gateway, and Elastic IP for Lambda

set -e

REGION="us-east-1"
VPC_NAME="mercury-sync-vpc"
CIDR_BLOCK="10.0.0.0/16"

echo "=================================================="
echo "Mercury Banking Integration - AWS Infrastructure"
echo "=================================================="
echo ""
echo "This script will create:"
echo "  - VPC with public and private subnets"
echo "  - Internet Gateway"
echo "  - NAT Gateway with Elastic IP (static IP for Mercury)"
echo "  - Route tables and security groups"
echo ""
echo "Region: $REGION"
echo "VPC CIDR: $CIDR_BLOCK"
echo ""
read -p "Continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Aborted."
    exit 1
fi

echo ""
echo "Creating VPC infrastructure..."
echo ""

# Create VPC
echo "[1/12] Creating VPC..."
VPC_ID=$(aws ec2 create-vpc \
  --cidr-block $CIDR_BLOCK \
  --region $REGION \
  --tag-specifications "ResourceType=vpc,Tags=[{Key=Name,Value=$VPC_NAME}]" \
  --query 'Vpc.VpcId' \
  --output text)

echo "✓ Created VPC: $VPC_ID"

# Enable DNS hostnames
echo "[2/12] Enabling DNS hostnames..."
aws ec2 modify-vpc-attribute \
  --vpc-id $VPC_ID \
  --enable-dns-hostnames \
  --region $REGION

echo "✓ DNS hostnames enabled"

# Create Internet Gateway
echo "[3/12] Creating Internet Gateway..."
IGW_ID=$(aws ec2 create-internet-gateway \
  --region $REGION \
  --tag-specifications "ResourceType=internet-gateway,Tags=[{Key=Name,Value=$VPC_NAME-igw}]" \
  --query 'InternetGateway.InternetGatewayId' \
  --output text)

echo "✓ Created Internet Gateway: $IGW_ID"

# Attach Internet Gateway to VPC
echo "[4/12] Attaching Internet Gateway to VPC..."
aws ec2 attach-internet-gateway \
  --vpc-id $VPC_ID \
  --internet-gateway-id $IGW_ID \
  --region $REGION

echo "✓ Internet Gateway attached"

# Create Public Subnet
echo "[5/12] Creating Public Subnet..."
PUBLIC_SUBNET_ID=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.1.0/24 \
  --availability-zone ${REGION}a \
  --region $REGION \
  --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=$VPC_NAME-public}]" \
  --query 'Subnet.SubnetId' \
  --output text)

echo "✓ Created Public Subnet: $PUBLIC_SUBNET_ID"

# Create Private Subnet (for Lambda)
echo "[6/12] Creating Private Subnet (for Lambda)..."
PRIVATE_SUBNET_ID=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.2.0/24 \
  --availability-zone ${REGION}a \
  --region $REGION \
  --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=$VPC_NAME-private}]" \
  --query 'Subnet.SubnetId' \
  --output text)

echo "✓ Created Private Subnet: $PRIVATE_SUBNET_ID"

# Allocate Elastic IP for NAT Gateway
echo "[7/12] Allocating Elastic IP for NAT Gateway..."
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

echo "✓ Allocated Elastic IP: $EIP_ADDRESS"

# Create NAT Gateway
echo "[8/12] Creating NAT Gateway (this takes 1-2 minutes)..."
NAT_GW_ID=$(aws ec2 create-nat-gateway \
  --subnet-id $PUBLIC_SUBNET_ID \
  --allocation-id $EIP_ALLOC_ID \
  --region $REGION \
  --tag-specifications "ResourceType=natgateway,Tags=[{Key=Name,Value=$VPC_NAME-nat}]" \
  --query 'NatGateway.NatGatewayId' \
  --output text)

echo "✓ Created NAT Gateway: $NAT_GW_ID"
echo "  Waiting for NAT Gateway to become available..."

# Wait for NAT Gateway to be available
aws ec2 wait nat-gateway-available \
  --nat-gateway-ids $NAT_GW_ID \
  --region $REGION

echo "✓ NAT Gateway is now available!"

# Create Route Table for Public Subnet
echo "[9/12] Creating Public Route Table..."
PUBLIC_RT_ID=$(aws ec2 create-route-table \
  --vpc-id $VPC_ID \
  --region $REGION \
  --tag-specifications "ResourceType=route-table,Tags=[{Key=Name,Value=$VPC_NAME-public-rt}]" \
  --query 'RouteTable.RouteTableId' \
  --output text)

echo "✓ Created Public Route Table: $PUBLIC_RT_ID"

# Add route to Internet Gateway
aws ec2 create-route \
  --route-table-id $PUBLIC_RT_ID \
  --destination-cidr-block 0.0.0.0/0 \
  --gateway-id $IGW_ID \
  --region $REGION > /dev/null

echo "✓ Added route to Internet Gateway"

# Associate Public Route Table with Public Subnet
aws ec2 associate-route-table \
  --subnet-id $PUBLIC_SUBNET_ID \
  --route-table-id $PUBLIC_RT_ID \
  --region $REGION > /dev/null

echo "✓ Associated Public Route Table with Public Subnet"

# Create Route Table for Private Subnet
echo "[10/12] Creating Private Route Table..."
PRIVATE_RT_ID=$(aws ec2 create-route-table \
  --vpc-id $VPC_ID \
  --region $REGION \
  --tag-specifications "ResourceType=route-table,Tags=[{Key=Name,Value=$VPC_NAME-private-rt}]" \
  --query 'RouteTable.RouteTableId' \
  --output text)

echo "✓ Created Private Route Table: $PRIVATE_RT_ID"

# Add route to NAT Gateway
aws ec2 create-route \
  --route-table-id $PRIVATE_RT_ID \
  --destination-cidr-block 0.0.0.0/0 \
  --nat-gateway-id $NAT_GW_ID \
  --region $REGION > /dev/null

echo "✓ Added route to NAT Gateway"

# Associate Private Route Table with Private Subnet
aws ec2 associate-route-table \
  --subnet-id $PRIVATE_SUBNET_ID \
  --route-table-id $PRIVATE_RT_ID \
  --region $REGION > /dev/null

echo "✓ Associated Private Route Table with Private Subnet"

# Create Security Group for Lambda
echo "[11/12] Creating Security Group for Lambda..."
SG_ID=$(aws ec2 create-security-group \
  --group-name mercury-sync-lambda-sg \
  --description "Security group for Mercury sync Lambda function" \
  --vpc-id $VPC_ID \
  --region $REGION \
  --query 'GroupId' \
  --output text)

echo "✓ Created Security Group: $SG_ID"

# Allow outbound HTTPS (443) traffic
aws ec2 authorize-security-group-egress \
  --group-id $SG_ID \
  --ip-permissions IpProtocol=tcp,FromPort=443,ToPort=443,IpRanges=[{CidrIp=0.0.0.0/0}] \
  --region $REGION > /dev/null 2>&1 || true

echo "✓ Configured Security Group egress rules"

# Save IDs to config file
echo "[12/12] Saving configuration..."
cat > vpc-config.json <<EOF
{
  "region": "$REGION",
  "vpcId": "$VPC_ID",
  "publicSubnetId": "$PUBLIC_SUBNET_ID",
  "privateSubnetId": "$PRIVATE_SUBNET_ID",
  "natGatewayId": "$NAT_GW_ID",
  "elasticIp": "$EIP_ADDRESS",
  "elasticIpAllocationId": "$EIP_ALLOC_ID",
  "securityGroupId": "$SG_ID",
  "internetGatewayId": "$IGW_ID",
  "publicRouteTableId": "$PUBLIC_RT_ID",
  "privateRouteTableId": "$PRIVATE_RT_ID"
}
EOF

echo "✓ Configuration saved to vpc-config.json"

echo ""
echo "=========================================="
echo "✅ VPC Infrastructure Setup Complete!"
echo "=========================================="
echo ""
echo "VPC ID:                $VPC_ID"
echo "Public Subnet:         $PUBLIC_SUBNET_ID"
echo "Private Subnet:        $PRIVATE_SUBNET_ID"
echo "NAT Gateway:           $NAT_GW_ID"
echo "Elastic IP:            $EIP_ADDRESS  ⭐ WHITELIST THIS IN MERCURY"
echo "Security Group:        $SG_ID"
echo ""
echo "Configuration saved to: aws-setup/vpc-config.json"
echo ""
echo "=========================================="
echo "📋 Next Steps:"
echo "=========================================="
echo "1. Whitelist the Elastic IP in Mercury dashboard:"
echo "   https://app.mercury.com → Settings → Developers → API Keys"
echo "   Add IP: $EIP_ADDRESS"
echo ""
echo "2. Wait 5-10 minutes for Mercury to propagate the whitelist"
echo ""
echo "3. Continue with Lambda deployment (next script)"
echo ""
echo "=========================================="
