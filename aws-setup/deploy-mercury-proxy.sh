#!/bin/bash

# Deploy Lambda as full Mercury API proxy with static IP
# Routes ALL Mercury API calls through whitelisted IP 52.1.18.251

set -e

echo "Deploying Mercury API proxy Lambda..."

mkdir -p lambda-mercury-proxy
cd lambda-mercury-proxy

cat > index.mjs <<'EOF'
/**
 * AWS Lambda - Full Mercury API Proxy
 * Forwards all Mercury API calls using whitelisted static IP
 */

import https from 'https';

export const handler = async (event) => {
  console.log('[Mercury Proxy] Event:', JSON.stringify(event, null, 2));

  const startTime = Date.now();

  // Extract request details
  const method = event.method || 'GET';
  const path = event.path || '/api/v1/accounts';
  const apiKey = event.apiKey;
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
  const formattedKey = apiKey.startsWith('secret-token:')
    ? apiKey
    : `secret-token:${apiKey}`;

  // Build query string
  const queryString = Object.keys(params).length > 0
    ? '?' + Object.entries(params)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join('&')
    : '';

  const fullPath = `${path}${queryString}`;

  console.log('[Mercury Proxy] Forwarding:', method, fullPath);
  console.log('[Mercury Proxy] Auth:', `Bearer secret-token:...`);

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.mercury.com',
      port: 443,
      path: fullPath,
      method: method,
      headers: {
        'Authorization': `Bearer ${formattedKey}`,
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

        console.log('[Mercury Proxy] Response:', res.statusCode);
        console.log('[Mercury Proxy] Duration:', duration + 'ms');
        console.log('[Mercury Proxy] Body preview:', data.substring(0, 200));

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
          }),
        });
      });
    });

    req.on('error', (error) => {
      const duration = Date.now() - startTime;
      console.error('[Mercury Proxy] Error:', error);

      resolve({
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: error.message,
          duration_ms: duration,
        }),
      });
    });

    req.end();
  });
};
EOF

zip mercury-proxy.zip index.mjs

echo "Updating Lambda function..."
aws lambda update-function-code \
  --function-name mercury-sync \
  --zip-file fileb://mercury-proxy.zip \
  --region us-east-1

cd ..
rm -rf lambda-mercury-proxy

echo "✅ Mercury API proxy deployed!"
echo "✅ All Mercury API calls will use static IP: 52.1.18.251"
echo ""
echo "Waiting for deployment..."
sleep 5
echo "Ready!"
