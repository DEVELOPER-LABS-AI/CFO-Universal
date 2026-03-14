/**
 * POST /api/mercury/validate-key
 * Validate Mercury API key via AWS Lambda proxy (uses whitelisted static IP)
 *
 * This endpoint proxies through AWS Lambda to ensure all Mercury API calls
 * originate from the whitelisted static IP (52.1.18.251)
 */

import { NextRequest, NextResponse } from 'next/server';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { requireAdmin } from '@/lib/auth/helpers';
import { getErrorMessage } from '@/lib/utils/error';

export async function POST(request: NextRequest) {
  try {
    // Require admin access
    await requireAdmin();

    const { apiKey } = await request.json();

    if (!apiKey) {
      return NextResponse.json(
        { valid: false, error: 'Missing apiKey' },
        { status: 400 }
      );
    }

    // Create Lambda client
    const lambdaClient = new LambdaClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });

    // Invoke Lambda function to validate API key
    const command = new InvokeCommand({
      FunctionName: 'mercury-sync',
      InvocationType: 'RequestResponse',
      Payload: JSON.stringify({
        action: 'validate-api-key',
        apiKey: apiKey,
      }),
    });

    console.log('[Validate Key] Invoking Lambda for API key validation');
    const response = await lambdaClient.send(command);

    // Parse Lambda response
    const payload = JSON.parse(new TextDecoder().decode(response.Payload));

    // Lambda returns a response with statusCode and body
    const lambdaStatus = payload.statusCode || 500;
    const lambdaBody = typeof payload.body === 'string'
      ? JSON.parse(payload.body)
      : payload.body;

    console.log('[Validate Key] Lambda response:', lambdaStatus, lambdaBody);

    // Return the validation result
    return NextResponse.json(lambdaBody, { status: lambdaStatus });

  } catch (error: unknown) {
    console.error('[Validate Key] Error:', error);
    return NextResponse.json(
      {
        valid: false,
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
