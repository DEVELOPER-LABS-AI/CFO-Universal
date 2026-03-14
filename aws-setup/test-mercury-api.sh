#!/bin/bash

# Test Mercury API connection through Lambda proxy

echo "Testing Mercury API key validation..."

API_KEY="$1"

if [ -z "$API_KEY" ]; then
  echo "Usage: ./test-mercury-api.sh <mercury-api-key>"
  exit 1
fi

# Create test Lambda function that validates the API key
cat > /tmp/test-mercury.mjs <<'LAMBDA_EOF'
export const handler = async (event) => {
  const apiKey = event.apiKey;
  
  try {
    const response = await fetch('https://api.mercury.com/api/v1/accounts?limit=1', {
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
      },
    });
    
    const text = await response.text();
    
    return {
      statusCode: response.status,
      body: JSON.stringify({
        valid: response.ok,
        status: response.status,
        response: text.substring(0, 200),
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        valid: false,
        error: error.message,
      }),
    };
  }
};
LAMBDA_EOF

cd /tmp
zip test-mercury.zip test-mercury.mjs

# Invoke Lambda to test
aws lambda invoke \
  --function-name mercury-sync \
  --payload "{\"apiKey\":\"$API_KEY\"}" \
  --cli-binary-format raw-in-base64-out \
  response.json

cat response.json | jq '.'
rm -f test-mercury.zip test-mercury.mjs response.json
