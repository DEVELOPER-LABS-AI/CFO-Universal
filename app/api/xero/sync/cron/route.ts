/**
 * Xero Sync Cron Job Endpoint
 *
 * Triggered daily by Vercel Cron at 2 AM UTC.
 * Processes all active Xero connections and syncs invoices/expenses.
 *
 * Security: Requires CRON_SECRET environment variable in Authorization header.
 *
 * Vercel cron configuration in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/xero/sync/cron",
 *     "schedule": "0 2 * * *"
 *   }]
 * }
 *
 * @see https://vercel.com/docs/cron-jobs
 */

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security using timing-safe comparison
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (!authHeader || !cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');
    const isValid = token.length === cronSecret.length &&
      crypto.timingSafeEqual(Buffer.from(token), Buffer.from(cronSecret));
    if (!isValid) {
      console.error('Unauthorized cron request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Starting scheduled Xero sync for all active connections...');

    // Find all active Xero connections with valid tokens
    const activeConnections = await prisma.xeroConnection.findMany({
      where: {
        connection_status: 'ACTIVE',
        token_expiry: {
          gt: new Date(Date.now() + 60 * 60 * 1000), // Token valid for at least 1 hour
        },
      },
      select: {
        id: true,
        organization_id: true,
        xero_tenant_id: true,
        last_sync_at: true,
      },
    });

    console.log(`Found ${activeConnections.length} active connections`);

    const results = [];

    // Process each connection
    for (const connection of activeConnections) {
      try {
        console.log(
          `Syncing connection ${connection.id} (tenant: ${connection.xero_tenant_id})`
        );

        // Trigger sync via internal API call
        const baseUrl =
          process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : 'http://localhost:3000';

        const response = await fetch(`${baseUrl}/api/xero/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Use internal service account or cron secret for authentication
            'x-cron-secret': process.env.CRON_SECRET!,
          },
          body: JSON.stringify({
            connection_id: connection.id,
            organization_id: connection.organization_id,
            sync_type: 'FULL',
            triggered_by: 'CRON',
          }),
        });

        const result = await response.json();

        results.push({
          connection_id: connection.id,
          organization_id: connection.organization_id,
          status: response.ok ? 'success' : 'failed',
          result,
        });

        console.log(
          `Sync ${response.ok ? 'completed' : 'failed'} for connection ${connection.id}`
        );
      } catch (error) {
        console.error(
          `Failed to sync connection ${connection.id}:`,
          error
        );
        results.push({
          connection_id: connection.id,
          organization_id: connection.organization_id,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successCount = results.filter((r) => r.status === 'success').length;
    const failedCount = results.filter((r) => r.status !== 'success').length;

    console.log(
      `Cron sync completed: ${successCount} succeeded, ${failedCount} failed`
    );

    return NextResponse.json({
      success: true,
      total_connections: activeConnections.length,
      successful: successCount,
      failed: failedCount,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
