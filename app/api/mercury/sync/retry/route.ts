/**
 * POST /api/mercury/sync/retry
 * Retry a failed sync operation
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { syncTransactions } from '@/lib/mercury/transaction-sync';
import { syncAccountBalances } from '@/lib/mercury/account-sync';
import { requireAdminOrExecutive } from '@/lib/auth/helpers';
import { getErrorMessage } from '@/lib/utils/error';

export async function POST(request: NextRequest) {
  try {
    await requireAdminOrExecutive();

    const body = await request.json();
    const { syncLogId } = body;

    if (!syncLogId) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameter: syncLogId' },
        { status: 400 }
      );
    }

    // Get original sync log
    const originalSync = await prisma.mercurySyncLog.findUnique({
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

    if (!originalSync) {
      return NextResponse.json(
        { success: false, error: 'Sync log not found' },
        { status: 404 }
      );
    }

    // Verify sync can be retried
    if (originalSync.status !== 'FAILED' && originalSync.status !== 'PARTIAL') {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot retry sync with status ${originalSync.status}. Only FAILED or PARTIAL syncs can be retried.`,
        },
        { status: 400 }
      );
    }

    // Verify connection is active
    if (originalSync.connection.connection_status !== 'ACTIVE') {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot retry: connection status is ${originalSync.connection.connection_status}`,
        },
        { status: 400 }
      );
    }

    console.log(`[Retry Sync] Retrying sync ${syncLogId} for org ${originalSync.connection.organization_id}`);

    const results: any = {};

    // Retry based on original sync type
    if (originalSync.sync_type === 'FULL') {
      // Retry both transactions and balances
      const transactionResult = await syncTransactions(
        originalSync.connection.organization_id,
        originalSync.connection.id,
        {}, // options
        'RETRY' // triggeredBy
      );
      results.transactions = transactionResult;

      const balanceResult = await syncAccountBalances(
        originalSync.connection.organization_id,
        originalSync.connection.id,
        {}, // options
        'RETRY' // triggeredBy
      );
      results.balances = balanceResult;
    } else if (originalSync.sync_type === 'BALANCES') {
      // Retry balance sync only
      const balanceResult = await syncAccountBalances(
        originalSync.connection.organization_id,
        originalSync.connection.id,
        {}, // options
        'RETRY' // triggeredBy
      );
      results.balances = balanceResult;
    } else {
      // Default: retry transactions
      const transactionResult = await syncTransactions(
        originalSync.connection.organization_id,
        originalSync.connection.id,
        {}, // options
        'RETRY' // triggeredBy
      );
      results.transactions = transactionResult;
    }

    // Determine overall success
    const allSuccessful = Object.values(results).every(
      (r: any) => r.success
    );

    return NextResponse.json(
      {
        success: allSuccessful,
        message: allSuccessful
          ? 'Retry completed successfully'
          : 'Retry completed with errors',
        original_sync_log_id: syncLogId,
        results,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error('Error during sync retry:', error);
    return NextResponse.json(
      {
        success: false,
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
