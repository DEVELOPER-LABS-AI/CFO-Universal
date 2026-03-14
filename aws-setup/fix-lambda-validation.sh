#!/bin/bash

# Fix Lambda validation to properly send Authorization header

set -e

echo "Fixing Lambda API key validation..."

mkdir -p lambda-proxy-fix
cd lambda-proxy-fix

cat > index.mjs <<'EOF'
/**
 * AWS Lambda Proxy for Mercury Integration
 * Handles:
 * 1. Scheduled sync (calls Vercel endpoint)
 * 2. API key validation (tests Mercury API directly)
 */

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

  try {
    console.log('[Lambda Proxy] Testing Mercury API with key:', apiKey.substring(0, 30) + '...');

    // Test Mercury API connection
    // Mercury requires the Authorization header with the full key including "secret-token:" prefix
    const response = await fetch('https://api.mercury.com/api/v1/accounts?limit=1', {
      method: 'GET',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    const duration = Date.now() - startTime;
    console.log('[Lambda Proxy] Mercury API response status:', response.status);

    if (response.ok) {
      const data = await response.json();
      console.log('[Lambda Proxy] API key validation successful, accounts found:', data.accounts?.length || 0);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          valid: true,
          duration_ms: duration,
          static_ip: '52.1.18.251',
          accounts_found: data.accounts?.length || 0,
        }),
      };
    } else {
      const errorText = await response.text();
      console.error('[Lambda Proxy] API key validation failed:', response.status, errorText);
      return {
        statusCode: response.status,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          valid: false,
          error: `Mercury API returned ${response.status}`,
          details: errorText.substring(0, 500),
          duration_ms: duration,
        }),
      };
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[Lambda Proxy] API key validation error:', error);

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        valid: false,
        error: error.message,
        duration_ms: duration,
      }),
    };
  }
}

/**
 * Run Mercury sync via Vercel endpoint
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

zip mercury-sync-fix.zip index.mjs

echo "Updating Lambda function..."
aws lambda update-function-code \
  --function-name mercury-sync \
  --zip-file fileb://mercury-sync-fix.zip \
  --region us-east-1

cd ..
rm -rf lambda-proxy-fix

echo "✅ Lambda fixed! Waiting for deployment..."
sleep 5
echo "Ready to test!"
