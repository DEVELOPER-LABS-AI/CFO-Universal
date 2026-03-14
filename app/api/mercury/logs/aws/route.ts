/**
 * GET /api/mercury/logs/aws
 * Fetch AWS CloudWatch logs for Mercury Lambda function
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrExecutive } from '@/lib/auth/helpers';
import { getErrorMessage } from '@/lib/utils/error';

export async function GET(request: NextRequest) {
  try {
    await requireAdminOrExecutive();
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const hours = parseInt(searchParams.get('hours') || '24');

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Missing required parameter: organizationId' },
        { status: 400 }
      );
    }

    // Import AWS SDK only when needed (server-side)
    const { CloudWatchLogsClient, FilterLogEventsCommand } = await import('@aws-sdk/client-cloudwatch-logs');

    // Initialize AWS CloudWatch client
    const client = new CloudWatchLogsClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });

    // Calculate start time (default: last 24 hours)
    const startTime = Date.now() - (hours * 60 * 60 * 1000);

    // Fetch logs from CloudWatch
    const command = new FilterLogEventsCommand({
      logGroupName: '/aws/lambda/mercury-sync',
      startTime,
      limit,
      // No filter pattern - fetch all logs
    });

    const response = await client.send(command);

    // Format logs for frontend
    const logs = (response.events || []).map((event) => ({
      timestamp: event.timestamp ? new Date(event.timestamp).toISOString() : null,
      message: event.message || '',
      logStreamName: event.logStreamName || '',
    }));

    return NextResponse.json({
      success: true,
      logs,
      count: logs.length,
      period: `Last ${hours} hours`,
    });
  } catch (error: unknown) {
    console.error('Error fetching AWS CloudWatch logs:', error);

    // Handle AWS SDK errors
    if (error instanceof Error && error.name === 'ResourceNotFoundException') {
      return NextResponse.json(
        {
          success: false,
          error: 'Lambda function logs not found. Ensure the function has been invoked at least once.',
          logs: [],
        },
        { status: 404 }
      );
    }

    if (error instanceof Error && (error.name === 'UnrecognizedClientException' || error.name === 'InvalidSignatureException')) {
      return NextResponse.json(
        {
          success: false,
          error: 'AWS credentials not configured or invalid. Add AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY to environment variables.',
          logs: [],
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: getErrorMessage(error),
        logs: [],
      },
      { status: 500 }
    );
  }
}
