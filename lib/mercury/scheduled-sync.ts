/**
 * Mercury Scheduled Sync Service
 *
 * Handles automated daily syncs for all active Mercury connections.
 * Called by cron job at 2 AM UTC daily.
 *
 * Features:
 * - Syncs all active connections
 * - Handles errors gracefully (continues with other connections)
 * - Logs all operations
 * - Sends notifications for failures
 */

import { prisma } from '@/lib/prisma';
import { syncTransactions } from './transaction-sync';
import { syncAccountBalances } from './account-sync';
import { reconcileContractorPayments } from './payment-reconciliation';
import { getErrorMessage } from '@/lib/utils/error';

interface ScheduledSyncResult {
  total_connections: number;
  successful_connections: number;
  failed_connections: number;
  total_transactions_synced: number;
  total_accounts_synced: number;
  duration_ms: number;
  errors: Array<{
    organization_id: string;
    connection_id: string;
    error: string;
  }>;
}

/**
 * Run scheduled sync for all active connections
 *
 * @returns Sync results for all connections
 */
export async function runScheduledSync(): Promise<ScheduledSyncResult> {
  const startTime = Date.now();
  const result: ScheduledSyncResult = {
    total_connections: 0,
    successful_connections: 0,
    failed_connections: 0,
    total_transactions_synced: 0,
    total_accounts_synced: 0,
    duration_ms: 0,
    errors: [],
  };

  try {
    console.log('[Scheduled Sync] Starting daily Mercury sync job');

    // Get all active Mercury connections
    const connections = await prisma.mercuryConnection.findMany({
      where: {
        connection_status: 'ACTIVE',
        deleted_at: null,
      },
      select: {
        id: true,
        organization_id: true,
        last_sync_at: true,
      },
    });

    result.total_connections = connections.length;
    console.log(`[Scheduled Sync] Found ${connections.length} active connections`);

    // Process each connection
    for (const connection of connections) {
      try {
        console.log(
          `[Scheduled Sync] Processing connection ${connection.id} for org ${connection.organization_id}`
        );

        // Sync transactions
        const transactionResult = await syncTransactions(
          connection.organization_id,
          connection.id,
          {}, // options
          'SYSTEM' // triggeredBy
        );

        if (!transactionResult.success) {
          throw new Error(
            `Transaction sync failed: ${transactionResult.errors[0]?.error || 'Unknown error'}`
          );
        }

        result.total_transactions_synced += transactionResult.created;

        // Sync account balances
        const balanceResult = await syncAccountBalances(
          connection.organization_id,
          connection.id,
          {}, // options
          'SYSTEM' // triggeredBy
        );

        if (!balanceResult.success) {
          console.warn(
            `[Scheduled Sync] Balance sync failed for ${connection.id}, continuing...`
          );
        } else {
          result.total_accounts_synced += balanceResult.created;
        }

        result.successful_connections++;
        console.log(
          `[Scheduled Sync] Completed connection ${connection.id}: ${transactionResult.created} transactions, ${balanceResult.created} balances`
        );
      } catch (error: unknown) {
        console.error(
          `[Scheduled Sync] Error syncing connection ${connection.id}:`,
          error
        );
        result.failed_connections++;
        result.errors.push({
          organization_id: connection.organization_id,
          connection_id: connection.id,
          error: getErrorMessage(error),
        });

        // Continue with next connection
        continue;
      }
    }

    // Reconcile contractor payments against newly synced transactions.
    // Runs once per org after all connections are processed.
    const reconciledOrgs = new Set<string>();
    for (const connection of connections) {
      if (!reconciledOrgs.has(connection.organization_id)) {
        reconciledOrgs.add(connection.organization_id);
        try {
          const reconciliation = await reconcileContractorPayments(connection.organization_id);
          if (reconciliation.reconciled > 0 || reconciliation.stale_flagged > 0) {
            console.log(
              `[Scheduled Sync] Payment reconciliation for org ${connection.organization_id}: ` +
                `${reconciliation.reconciled} reconciled, ${reconciliation.stale_flagged} stale`
            );
          }
        } catch (error: unknown) {
          console.error(
            `[Scheduled Sync] Payment reconciliation error for org ${connection.organization_id}:`,
            error
          );
        }
      }
    }

    result.duration_ms = Date.now() - startTime;

    console.log(
      `[Scheduled Sync] Completed: ${result.successful_connections}/${result.total_connections} successful, ${result.total_transactions_synced} transactions, ${result.total_accounts_synced} accounts (${result.duration_ms}ms)`
    );

    // Send notifications for failures if any
    if (result.failed_connections > 0) {
      await notifyScheduledSyncFailures(result);
    }

    return result;
  } catch (error: unknown) {
    console.error('[Scheduled Sync] Fatal error during scheduled sync:', error);
    result.duration_ms = Date.now() - startTime;
    return result;
  }
}

/**
 * Sync a specific organization on schedule
 *
 * @param organizationId - Organization ID
 * @returns Sync result
 */
export async function runScheduledSyncForOrganization(
  organizationId: string
): Promise<{
  success: boolean;
  transactions_synced: number;
  accounts_synced: number;
  error?: string;
}> {
  try {
    // Get Mercury connection
    const connection = await prisma.mercuryConnection.findUnique({
      where: { organization_id: organizationId },
      select: {
        id: true,
        connection_status: true,
      },
    });

    if (!connection) {
      throw new Error('Mercury connection not found');
    }

    if (connection.connection_status !== 'ACTIVE') {
      throw new Error(`Connection is not active: ${connection.connection_status}`);
    }

    // Sync transactions
    const transactionResult = await syncTransactions(
      organizationId,
      connection.id,
      {}, // options
      'SYSTEM' // triggeredBy
    );

    if (!transactionResult.success) {
      throw new Error(
        `Transaction sync failed: ${transactionResult.errors[0]?.error || 'Unknown error'}`
      );
    }

    // Sync balances
    const balanceResult = await syncAccountBalances(
      organizationId,
      connection.id,
      {}, // options
      'SYSTEM' // triggeredBy
    );

    return {
      success: true,
      transactions_synced: transactionResult.created,
      accounts_synced: balanceResult.created,
    };
  } catch (error: unknown) {
    console.error(`[Scheduled Sync] Error syncing org ${organizationId}:`, error);
    return {
      success: false,
      transactions_synced: 0,
      accounts_synced: 0,
      error: getErrorMessage(error),
    };
  }
}

/**
 * Send notifications for scheduled sync failures
 *
 * @param result - Scheduled sync result
 */
async function notifyScheduledSyncFailures(
  result: ScheduledSyncResult
): Promise<void> {
  // TODO: Implement notification system
  // Options:
  // 1. Email to admin
  // 2. Slack webhook
  // 3. Create notification record in database
  // 4. PagerDuty/Sentry alert

  console.warn(
    `[Scheduled Sync] ${result.failed_connections} connections failed sync:`,
    result.errors
  );

  // TODO: Create notification records in database
  // Requires notification system to be implemented first
  // for (const error of result.errors) {
  //   try {
  //     await prisma.notification.create({
  //       data: {
  //         organization_id: error.organization_id,
  //         user_id: null, // System notification
  //         type: 'SYNC_ERROR',
  //         message: `Failed to sync Mercury data: ${error.error}`,
  //         metadata: {
  //           connection_id: error.connection_id,
  //           error: error.error,
  //           sync_type: 'scheduled',
  //         },
  //       },
  //     });
  //   } catch (notifError) {
  //     console.error('[Scheduled Sync] Failed to create notification:', notifError);
  //   }
  // }
}

/**
 * Get sync schedule configuration
 *
 * @param organizationId - Organization ID
 * @returns Sync schedule settings
 */
export async function getSyncSchedule(organizationId: string) {
  const connection = await prisma.mercuryConnection.findUnique({
    where: { organization_id: organizationId },
    select: {
      id: true,
      last_sync_at: true,
    },
  });

  if (!connection) {
    return null;
  }

  // Fixed schedule: Daily at 2 AM UTC (24 hours)
  const frequencyHours = 24;
  const nextSync = connection.last_sync_at
    ? new Date(connection.last_sync_at.getTime() + frequencyHours * 60 * 60 * 1000)
    : new Date();

  return {
    connection_id: connection.id,
    last_sync_at: connection.last_sync_at,
    sync_frequency_hours: frequencyHours,
    next_scheduled_sync: nextSync,
    is_overdue: nextSync < new Date(),
  };
}

/**
 * Update sync schedule for an organization
 *
 * @param organizationId - Organization ID
 * @param frequencyHours - Sync frequency in hours (default: 24)
 */
export async function updateSyncSchedule(
  organizationId: string,
  frequencyHours: number
): Promise<void> {
  // Note: Sync schedule is currently fixed at 24 hours (daily at 2 AM UTC)
  // This function is a placeholder for future custom schedule support
  console.log(
    `[Scheduled Sync] Schedule update requested for org ${organizationId}, but sync frequency is currently fixed at 24 hours`
  );

  // Future: When custom schedules are supported, add sync_frequency_hours column
  // and implement custom schedule logic here
}
