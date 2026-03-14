/**
 * POST /api/mercury/connect
 * Connect Mercury Bank account using API key
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { encryptToken } from '@/lib/xero/crypto';
import { validateApiKey } from '@/lib/mercury/utils';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { requireAdmin } from '@/lib/auth/helpers';
import { getOrganizationId } from '@/lib/auth/organization';
import { getErrorMessage } from '@/lib/utils/error';
import type { ConnectMercuryRequest, ConnectMercuryResponse } from '@/types/mercury';

export async function POST(request: NextRequest) {
  try {
    // Require admin access
    await requireAdmin();
    const organizationId = await getOrganizationId();

    // Parse request body
    const body: ConnectMercuryRequest = await request.json();
    const { apiKey } = body;

    // Validate inputs
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: apiKey' },
        { status: 400 }
      );
    }

    // Validate API key format
    if (!validateApiKey(apiKey)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid API key format. API key must be at least 20 characters and contain no whitespace.',
        },
        { status: 400 }
      );
    }

    // Test API key validity via AWS Lambda proxy (uses whitelisted static IP)
    console.log('[Connect] Validating API key via Lambda proxy');

    try {
      const lambdaClient = new LambdaClient({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        },
      });

      const command = new InvokeCommand({
        FunctionName: 'mercury-sync',
        InvocationType: 'RequestResponse',
        Payload: JSON.stringify({
          action: 'validate-api-key',
          apiKey: apiKey,
        }),
      });

      const lambdaResponse = await lambdaClient.send(command);
      const payload = JSON.parse(new TextDecoder().decode(lambdaResponse.Payload));
      const lambdaBody = typeof payload.body === 'string'
        ? JSON.parse(payload.body)
        : payload.body;

      console.log('[Connect] Lambda validation result:', lambdaBody);

      if (!lambdaBody.valid) {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid Mercury API key: ${lambdaBody.error || 'Connection test failed'}`,
          },
          { status: 401 }
        );
      }

      console.log('[Connect] API key validated successfully via static IP');
    } catch (error: unknown) {
      console.error('[Connect] Lambda validation error:', error);
      return NextResponse.json(
        {
          success: false,
          error: `API key validation failed: ${getErrorMessage(error)}`,
        },
        { status: 500 }
      );
    }

    // Encrypt API key for storage
    const encryptedApiKey = await encryptToken(apiKey);

    if (!encryptedApiKey) {
      return NextResponse.json(
        { success: false, error: 'Failed to encrypt API key' },
        { status: 500 }
      );
    }

    // Check if connection already exists
    const existingConnection = await prisma.mercuryConnection.findUnique({
      where: { organization_id: organizationId },
    });

    let connection;

    if (existingConnection) {
      // Update existing connection
      connection = await prisma.mercuryConnection.update({
        where: { id: existingConnection.id },
        data: {
          api_key_encrypted: encryptedApiKey,
          connection_status: 'ACTIVE',
          deleted_at: null, // Clear soft delete if reconnecting
          updated_at: new Date(),
        },
      });
    } else {
      // Create new connection
      connection = await prisma.mercuryConnection.create({
        data: {
          organization_id: organizationId,
          api_key_encrypted: encryptedApiKey,
          connection_status: 'ACTIVE',
        },
      });
    }

    // Return success response
    const response: ConnectMercuryResponse = {
      success: true,
      connection: {
        id: connection.id,
        organization_id: connection.organization_id,
        connection_status: connection.connection_status,
        created_at: connection.created_at.toISOString(),
      },
      message: existingConnection
        ? 'Mercury connection updated successfully'
        : 'Mercury connected successfully',
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error: unknown) {
    console.error('Error connecting Mercury:', error);
    return NextResponse.json(
      {
        success: false,
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
