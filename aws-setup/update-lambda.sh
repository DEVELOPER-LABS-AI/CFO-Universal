#!/bin/bash

# Quick update Lambda proxy code

set -e

echo "Creating updated Lambda proxy..."

mkdir -p lambda-proxy-update
cd lambda-proxy-update

cat > index.mjs <<'EOF'
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
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
      },
    });

    const duration = Date.now() - startTime;
    const responseText = await response.text();

    console.log(`[Lambda Proxy] Response status: ${response.status}`);
    console.log(`[Lambda Proxy] Response body: ${responseText.substring(0, 200)}`);

    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      console.error('[Lambda Proxy] Failed to parse JSON');
      result = { error: 'Invalid JSON response', raw: responseText.substring(0, 100) };
    }

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
        static_ip: '52.1.18.251',
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
EOF

zip mercury-sync-update.zip index.mjs

echo "Updating Lambda function code..."
aws lambda update-function-code \
  --function-name mercury-sync \
  --zip-file fileb://mercury-sync-update.zip \
  --region us-east-1 \
  --output text > /dev/null

cd ..
rm -rf lambda-proxy-update

echo "✅ Lambda function updated!"
echo "Wait 5 seconds for deployment..."
sleep 5
echo "Ready to test!"
