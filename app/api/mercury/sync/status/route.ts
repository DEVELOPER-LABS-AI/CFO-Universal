/**
 * GET /api/mercury/sync/status
 * Get Mercury sync status and history for an organization
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSyncHistory, getSyncStats, getLatestSync } from '@/lib/mercury/sync-logger';
import { getSyncStatistics } from '@/lib/mercury/transaction-sync';
import { getLatestAccountBalances } from '@/lib/mercury/account-sync';
import { getSyncSchedule } from '@/lib/mercury/scheduled-sync';
import { prisma } from '@/lib/prisma';
import { requireAdminOrExecutive } from '@/lib/auth/helpers';
import { getOrganizationId } from '@/lib/auth/organization';
import { getErrorMessage } from '@/lib/utils/error';

export async function GET(request: NextRequest) {
  try {
    await requireAdminOrExecutive();
    const organizationId = await getOrganizationId();

    // Get Mercury connection
    const connection = await prisma.mercuryConnection.findUnique({
      where: { organization_id: organizationId },
      select: {
        id: true,
        connection_status: true,
        last_sync_at: true,
        last_sync_status: true,
        created_at: true,
      },
    });

    if (!connection) {
      return NextResponse.json(
        { error: 'Mercury connection not found' },
        { status: 404 }
      );
    }

    // Get sync history (last 30 syncs)
    const syncHistory = await getSyncHistory(connection.id, 30);

    // Get sync statistics (last 90 days)
    const syncStats = await getSyncStats(connection.id, 90);

    // Get latest sync
    const latestSync = await getLatestSync(connection.id);

    // Get expense statistics
    const expenseStats = await getSyncStatistics(organizationId);

    // Get account balances
    const accountBalances = await getLatestAccountBalances(connection.id);

    // Get sync schedule
    const schedule = await getSyncSchedule(organizationId);

    return NextResponse.json({
      connection: {
        id: connection.id,
        status: connection.connection_status,
        last_sync_at: connection.last_sync_at,
        last_sync_status: connection.last_sync_status,
        connected_since: connection.created_at,
      },
      latest_sync: latestSync,
      sync_history: syncHistory,
      sync_stats: syncStats,
      expense_stats: expenseStats,
      account_balances: accountBalances,
      schedule,
    });
  } catch (error: unknown) {
    console.error('Error fetching sync status:', error);
    return NextResponse.json(
      {
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
