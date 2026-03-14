#!/bin/bash

# Fix Lambda to use correct Bearer token format for Mercury API
# Mercury API expects: Authorization: Bearer secret-token:mercury_production_rma_...

set -e

echo "Fixing Lambda Bearer token format for Mercury API..."

mkdir -p lambda-mercury-fix
cd lambda-mercury-fix

cat > index.mjs <<'EOF'
/**
 * AWS Lambda Proxy for Mercury Integration
 * Mercury API format: Authorization: Bearer secret-token:mercury_production_rma_...
 */

import https from 'https';

export const handler = async (event) => {
  console.log('[Lambda Proxy] Event:', JSON.stringify(event, null, 2));

  const startTime = Date.now();

  // Route based on action
  if (event.action === 'validate-api-key') {
    return await validateApiKey(event, startTime);
  } else if (event.action === 'proxy') {
    return await proxyMercuryRequest(event, startTime);
  }

  // Default: sync request
  return await runSync(event, startTime);
};

/**
 * Proxy Mercury API request through Lambda with whitelisted IP
 */
async function proxyMercuryRequest(event, startTime) {
  console.log('[Lambda Proxy] Proxying Mercury API request');

  const method = event.method || 'GET';
  const path = event.path || '/api/v1/accounts';
  let apiKey = event.apiKey;
  const params = event.params || {};

  if (!apiKey) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Missing apiKey parameter',
      }),
    };
  }

  // Ensure "secret-token:" prefix
  if (!apiKey.startsWith('secret-token:')) {
    apiKey = `secret-token:${apiKey}`;
  }

  // Build query string
  const queryString = Object.keys(params).length > 0
    ? '?' + Object.entries(params)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join('&')
    : '';

  const fullPath = `${path}${queryString}`;

  console.log('[Lambda Proxy] Forwarding:', method, fullPath);
  console.log('[Lambda Proxy] Using whitelisted IP: 52.1.18.251');

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.mercury.com',
      port: 443,
      path: fullPath,
      method: method,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const duration = Date.now() - startTime;

        console.log('[Lambda Proxy] Response status:', res.statusCode);
        console.log('[Lambda Proxy] Duration:', duration + 'ms');
        console.log('[Lambda Proxy] Body preview:', data.substring(0, 200));

        let parsedData;
        try {
          parsedData = JSON.parse(data);
        } catch (e) {
          parsedData = data;
        }

        resolve({
          statusCode: res.statusCode,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: res.statusCode >= 200 && res.statusCode < 300,
            data: parsedData,
            duration_ms: duration,
            static_ip: '52.1.18.251',
            errorType: res.statusCode >= 400 ? 'MERCURY_API_ERROR' : undefined,
          }),
        });
      });
    });

    req.on('error', (error) => {
      const duration = Date.now() - startTime;
      console.error('[Lambda Proxy] Request error:', error);

      resolve({
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: error.message,
          errorType: 'NETWORK_ERROR',
          duration_ms: duration,
        }),
      });
    });

    req.end();
  });
}

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

  // Ensure "secret-token:" prefix is present
  // Mercury API expects: "Bearer secret-token:mercury_production_rma_..."
  if (!apiKey.startsWith('secret-token:')) {
    apiKey = `secret-token:${apiKey}`;
  }

  // Format as Bearer token
  const authHeader = `Bearer ${apiKey}`;

  return new Promise((resolve) => {
    console.log('[Lambda Proxy] Testing Mercury API');
    console.log('[Lambda Proxy] Auth format: Bearer secret-token:...');

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

    const req = https.request(options, (res) => {
      console.log('[Lambda Proxy] Response status:', res.statusCode);

      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const duration = Date.now() - startTime;
        console.log('[Lambda Proxy] Response body:', data.substring(0, 200));

        if (res.statusCode === 200) {
          const accounts = JSON.parse(data);
          console.log('[Lambda Proxy] API key validation successful, accounts:', accounts.accounts?.length || 0);
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

zip mercury-fix.zip index.mjs

echo "Updating Lambda function..."
aws lambda update-function-code \
  --function-name mercury-sync \
  --zip-file fileb://mercury-fix.zip \
  --region us-east-1

cd ..
rm -rf lambda-mercury-fix

echo "✅ Lambda updated with correct Bearer token format!"
echo "✅ Mercury API expects: Bearer secret-token:mercury_production_rma_..."
echo ""
echo "Waiting for deployment..."
sleep 5
echo "Ready!"
