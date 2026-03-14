#!/bin/bash

# Fix Lambda to use https module instead of fetch

set -e

echo "Updating Lambda to use https module..."

mkdir -p lambda-proxy-https
cd lambda-proxy-https

cat > index.mjs <<'EOF'
/**
 * AWS Lambda Proxy for Mercury Integration
 * Uses Node.js https module for reliable header transmission
 */

import https from 'https';

export const handler = async (event) => {
  console.log('[Lambda Proxy] Event:', JSON.stringify(event, null, 2));

  const startTime = Date.now();

  // Check if this is an API key validation request
  if (event.action === 'validate-api-key') {
    return await validateApiKey(event, startTime);
  }

  // Otherwise, it's a sync request
  return await runSync(event, startTime);
};

/**
 * Validate Mercury API key by testing connection
 */
async function validateApiKey(event, startTime) {
  console.log('[Lambda Proxy] Validating Mercury API key');

  const apiKey = event.apiKey;

  if (!apiKey) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        valid: false,
        error: 'Missing apiKey parameter',
      }),
    };
  }

  return new Promise((resolve) => {
    console.log('[Lambda Proxy] Testing Mercury API with Authorization:', apiKey.substring(0, 30) + '...');

    const options = {
      hostname: 'api.mercury.com',
      port: 443,
      path: '/api/v1/accounts?limit=1',
      method: 'GET',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    };

    console.log('[Lambda Proxy] Request options:', JSON.stringify(options, null, 2));

    const req = https.request(options, (res) => {
      console.log('[Lambda Proxy] Response status:', res.statusCode);
      console.log('[Lambda Proxy] Response headers:', JSON.stringify(res.headers, null, 2));

      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const duration = Date.now() - startTime;
        console.log('[Lambda Proxy] Response body:', data);

        if (res.statusCode === 200) {
          const accounts = JSON.parse(data);
          console.log('[Lambda Proxy] API key validation successful');
          resolve({
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              valid: true,
              duration_ms: duration,
              static_ip: '52.1.18.251',
              accounts_found: accounts.accounts?.length || 0,
            }),
          });
        } else {
          console.error('[Lambda Proxy] API key validation failed:', res.statusCode, data);
          resolve({
            statusCode: res.statusCode,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              valid: false,
              error: `Mercury API returned ${res.statusCode}`,
              details: data.substring(0, 500),
              duration_ms: duration,
            }),
          });
        }
      });
    });

    req.on('error', (error) => {
      const duration = Date.now() - startTime;
      console.error('[Lambda Proxy] Request error:', error);
      resolve({
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          valid: false,
          error: error.message,
          duration_ms: duration,
        }),
      });
    });

    req.end();
  });
}

/**
 * Run Mercury sync via Vercel endpoint (using fetch)
 */
async function runSync(event, startTime) {
  console.log('[Lambda Proxy] Starting Mercury sync via Vercel');

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
}
EOF

zip mercury-sync-https.zip index.mjs

echo "Updating Lambda function..."
aws lambda update-function-code \
  --function-name mercury-sync \
  --zip-file fileb://mercury-sync-https.zip \
  --region us-east-1

cd ..
rm -rf lambda-proxy-https

echo "✅ Lambda updated with https module!"
echo "Waiting for deployment..."
sleep 5
echo "Ready to test!"
