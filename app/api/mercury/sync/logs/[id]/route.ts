/**
 * GET /api/mercury/sync/logs/[id]
 * Get detailed sync log information including full error details
 *
 * Tasks: T101-T103
 * - Query mercury_sync_log by ID
 * - Verify belongs to user's organization (RLS)
 * - Return full sync_log including errors JSONB array
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminOrExecutive } from '@/lib/auth/helpers';
import { getErrorMessage } from '@/lib/utils/error';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminOrExecutive();

    const { id: syncLogId } = await params;

    if (!syncLogId) {
      return NextResponse.json(
        { error: 'Missing required parameter: id' },
        { status: 400 }
      );
    }

    // Query sync log by ID with organization validation
    const syncLog = await prisma.mercurySyncLog.findUnique({
      where: { id: syncLogId },
      include: {
        connection: {
          select: {
            id: true,
            organization_id: true,
            connection_status: true,
          },
        },
      },
    });

    if (!syncLog) {
      return NextResponse.json(
        { error: 'Sync log not found' },
        { status: 404 }
      );
    }

    // Return full sync log details including errors JSONB array
    return NextResponse.json({
      sync_log: {
        id: syncLog.id,
        connection_id: syncLog.connection_id,
        organization_id: syncLog.connection.organization_id,
        sync_type: syncLog.sync_type,
        status: syncLog.status,
        started_at: syncLog.started_at,
        completed_at: syncLog.completed_at,
        duration_ms: syncLog.duration_ms,
        transactions_processed: syncLog.transactions_processed,
        transactions_failed: syncLog.transactions_failed,
        balances_updated: syncLog.balances_updated,
        errors: syncLog.errors, // Full JSONB array with error details
        triggered_by: syncLog.triggered_by,
        triggered_by_user_id: syncLog.triggered_by_user_id,
        created_at: syncLog.created_at,
        connection_status: syncLog.connection.connection_status,
      },
    });
  } catch (error: unknown) {
    console.error('Error fetching sync log details:', error);
    return NextResponse.json(
      {
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
