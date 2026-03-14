#!/bin/bash

# Fix Lambda to use "Bearer secret-token:..." format

set -e

echo "Fixing Lambda to use correct Bearer format with secret-token prefix..."

mkdir -p lambda-bearer-prefix
cd lambda-bearer-prefix

cat > index.mjs <<'EOF'
/**
 * AWS Lambda Proxy for Mercury Integration
 * Uses Bearer token with secret-token prefix
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

  let apiKey = event.apiKey;

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

  // Mercury API expects: "Bearer secret-token:mercury_production_rma_..."
  // Keep the secret-token prefix if present, add if missing
  if (!apiKey.startsWith('secret-token:')) {
    apiKey = `secret-token:${apiKey}`;
  }

  // Format as Bearer token WITH secret-token prefix
  const authHeader = `Bearer ${apiKey}`;

  return new Promise((resolve) => {
    console.log('[Lambda Proxy] Testing Mercury API with Bearer token (with secret-token prefix)');

    const options = {
      hostname: 'api.mercury.com',
      port: 443,
      path: '/api/v1/accounts?limit=1',
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    };

    console.log('[Lambda Proxy] Authorization format: Bearer secret-token:mercury_...');

    const req = https.request(options, (res) => {
      console.log('[Lambda Proxy] Response status:', res.statusCode);

      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const duration = Date.now() - startTime;
        console.log('[Lambda Proxy] Response body:', data.substring(0, 300));

        if (res.statusCode === 200) {
          const accounts = JSON.parse(data);
          console.log('[Lambda Proxy] ✅ API key validation successful!');
          console.log('[Lambda Proxy] Accounts found:', accounts.accounts?.length || 0);
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
          console.error('[Lambda Proxy] ❌ API key validation failed:', res.statusCode);
          console.error('[Lambda Proxy] Error details:', data);
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

zip mercury-final.zip index.mjs

echo "Updating Lambda function..."
aws lambda update-function-code \
  --function-name mercury-sync \
  --zip-file fileb://mercury-final.zip \
  --region us-east-1

cd ..
rm -rf lambda-bearer-prefix

echo "✅ Lambda updated with correct Bearer format!"
echo "Waiting for deployment..."
sleep 5
echo "Ready to test!"
