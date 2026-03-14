/**
 * POST /api/mercury/sync/manual
 * Manually trigger Mercury transaction sync
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { syncTransactions } from '@/lib/mercury/transaction-sync';
import { syncAccountBalances } from '@/lib/mercury/account-sync';
import { requireAdminOrExecutive } from '@/lib/auth/helpers';
import { getOrganizationId } from '@/lib/auth/organization';
import { getErrorMessage } from '@/lib/utils/error';

export async function POST(request: NextRequest) {
  try {
    await requireAdminOrExecutive();
    const organizationId = await getOrganizationId();

    const body = await request.json();
    const { syncType = 'both', syncMode = 'incremental', cursor, batchSize } = body;

    // Validate syncMode
    if (!['test', 'first-time', 'incremental'].includes(syncMode)) {
      return NextResponse.json(
        { success: false, error: 'Invalid syncMode. Must be: test, first-time, or incremental' },
        { status: 400 }
      );
    }

    // Get Mercury connection
    const connection = await prisma.mercuryConnection.findUnique({
      where: { organization_id: organizationId },
      select: {
        id: true,
        connection_status: true,
      },
    });

    if (!connection) {
      return NextResponse.json(
        { success: false, error: 'Mercury connection not found' },
        { status: 404 }
      );
    }

    if (connection.connection_status !== 'ACTIVE') {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot sync: connection status is ${connection.connection_status}`,
        },
        { status: 400 }
      );
    }

    const results: any = {};

    // Sync transactions
    if (syncType === 'transactions' || syncType === 'both') {
      console.log(`[Manual Sync] Starting transaction sync for org ${organizationId} (mode: ${syncMode})`);

      // Configure options based on sync mode
      const syncOptions: any = {};

      // Pass continuation cursor if provided (for batched sync)
      if (cursor) {
        syncOptions.cursor = cursor;
        syncOptions.isContinuation = true;
      }

      if (syncMode === 'test') {
        // Test mode: Only sync 1 transaction
        syncOptions.limit = 1;
      } else if (syncMode === 'first-time') {
        // First-time: Ignore last_sync_at, fetch all historical data
        // forceUpdate bypasses duplicate check so existing records get updated (backfills is_credit, etc.)
        syncOptions.startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // 1 year back
        syncOptions.forceUpdate = true;
        // Default batch size of 40 to stay within Vercel 60s timeout (~0.75s per transaction)
        syncOptions.batchSize = batchSize || 40;
      } else {
        // Incremental mode: also use batching for safety
        syncOptions.batchSize = batchSize || 80;
      }
      // Incremental mode uses default behavior (uses last_sync_at from connection)

      const transactionResult = await syncTransactions(
        organizationId,
        connection.id,
        syncOptions,
        'MANUAL' // triggeredBy
      );
      results.transactions = transactionResult;
    }

    // Sync account balances (skip on continuation batches — only on first call or when transactions are done)
    const hasMoreTransactions = results.transactions?.hasMore;
    if ((syncType === 'balances' || syncType === 'both') && !cursor && !hasMoreTransactions) {
      console.log(`[Manual Sync] Starting balance sync for org ${organizationId}`);
      const balanceResult = await syncAccountBalances(
        organizationId,
        connection.id,
        {}, // options
        'MANUAL' // triggeredBy
      );
      results.balances = balanceResult;
    }

    // Determine overall success
    const allSuccessful = Object.values(results).every(
      (r: any) => r.success
    );

    return NextResponse.json(
      {
        success: allSuccessful,
        message: hasMoreTransactions
          ? `Batch complete — ${results.transactions.processed} transactions processed. More remaining...`
          : allSuccessful
            ? 'Sync completed successfully'
            : 'Sync completed with errors',
        results,
        // Continuation info for client-side batching
        hasMore: hasMoreTransactions || false,
        nextCursor: results.transactions?.nextCursor || null,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error('Error during manual sync:', error);
    return NextResponse.json(
      {
        success: false,
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
