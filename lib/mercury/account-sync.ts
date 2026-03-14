/**
 * Mercury Account Balance Sync Service
 *
 * Syncs account balances from Mercury and stores historical data.
 * Tracks balance changes over time for trend analysis.
 */

import { prisma } from '@/lib/prisma';
import { getMercuryClient } from './client-factory';
import { startSyncLog, completeSyncLog, failSyncLog } from './sync-logger';
import { getErrorMessage } from '@/lib/utils/error';
import type { TransactionSyncResult } from '@/types/mercury';

/**
 * Map Mercury account type to Prisma enum value
 * Mercury returns: 'checking', 'savings', 'treasury' (lowercase) OR 'mercury'
 * Prisma expects: 'CHECKING', 'SAVINGS', 'TREASURY' (uppercase)
 *
 * Fallback: If type is 'mercury' or unknown, parse account name for keywords
 */
function mapAccountType(
  mercuryType: string | undefined,
  accountName: string
): 'CHECKING' | 'SAVINGS' | 'TREASURY' {
  const normalized = (mercuryType || '').toLowerCase().trim();

  // Try direct type mapping first
  switch (normalized) {
    case 'checking':
      return 'CHECKING';
    case 'savings':
      return 'SAVINGS';
    case 'treasury':
      return 'TREASURY';
  }

  // Fallback: Parse account name for type keywords
  // Account names like "Mercury Checking ••2898" or "Mercury Savings ••1490"
  const nameLower = accountName.toLowerCase();

  if (nameLower.includes('checking')) {
    console.log(`[Account Sync] Detected CHECKING from account name: "${accountName}"`);
    return 'CHECKING';
  }

  if (nameLower.includes('savings')) {
    console.log(`[Account Sync] Detected SAVINGS from account name: "${accountName}"`);
    return 'SAVINGS';
  }

  if (nameLower.includes('treasury')) {
    console.log(`[Account Sync] Detected TREASURY from account name: "${accountName}"`);
    return 'TREASURY';
  }

  // Final fallback
  console.warn(
    `[Account Sync] Unknown account type "${mercuryType}" and could not parse name "${accountName}", defaulting to CHECKING`
  );
  return 'CHECKING';
}

interface AccountSyncOptions {
  dryRun?: boolean;
}

/**
 * Sync account balances for an organization
 *
 * @param organizationId - Organization ID
 * @param connectionId - Mercury connection ID
 * @param options - Sync options
 * @returns Sync result
 */
export async function syncAccountBalances(
  organizationId: string,
  connectionId: string,
  options: AccountSyncOptions = {},
  triggeredBy: 'SYSTEM' | 'MANUAL' | 'RETRY' = 'MANUAL',
  triggeredByUserId?: string
): Promise<TransactionSyncResult> {
  const startTime = Date.now();
  const result: TransactionSyncResult = {
    success: false,
    processed: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
    duration_ms: 0,
  };

  // Start sync log (skip if dry run)
  let syncLogId: string | null = null;
  if (!options.dryRun) {
    syncLogId = await startSyncLog(connectionId, 'BALANCES', triggeredBy, triggeredByUserId);
  }

  try {
    console.log(`[Account Sync] Starting balance sync for org ${organizationId}`);

    // Get Mercury connection
    const connection = await prisma.mercuryConnection.findUnique({
      where: { id: connectionId },
      select: {
        id: true,
        organization_id: true,
        connection_status: true,
      },
    });

    if (!connection) {
      throw new Error(`Mercury connection not found: ${connectionId}`);
    }

    if (connection.connection_status !== 'ACTIVE') {
      throw new Error(`Mercury connection is not active: ${connection.connection_status}`);
    }

    // Initialize Mercury client
    const client = await getMercuryClient(organizationId);

    // Fetch accounts
    const accountsResponse = await client.getAccounts();
    const accounts = accountsResponse.accounts || [];

    console.log(`[Account Sync] Found ${accounts.length} accounts`);

    // Process each account
    for (const account of accounts) {
      try {
        result.processed++;

        // Get current balance
        const balanceResponse = await client.getAccountBalance(account.id);
        const currentBalance = balanceResponse.currentBalance;
        const availableBalance = balanceResponse.availableBalance;

        console.log(
          `[Account Sync] Account ${account.id} (${account.name}): current=${currentBalance}, available=${availableBalance}`
        );

        if (!options.dryRun) {
          // Get today's date at midnight (date-only, no time component)
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          // Upsert balance history (update if exists for today, create if not)
          const balanceRecord = await prisma.accountBalanceHistory.upsert({
            where: {
              connection_id_mercury_account_id_snapshot_date: {
                connection_id: connectionId,
                mercury_account_id: account.id,
                snapshot_date: today,
              },
            },
            update: {
              account_name: account.name,
              account_type: mapAccountType(account.type, account.name),
              current_balance: currentBalance,
              available_balance: availableBalance,
            },
            create: {
              connection_id: connectionId,
              mercury_account_id: account.id,
              account_name: account.name,
              account_type: mapAccountType(account.type, account.name),
              current_balance: currentBalance,
              available_balance: availableBalance,
              snapshot_date: today,
            },
          });

          result.created++;
          console.log(`[Account Sync] ${balanceRecord.created_at.toISOString() === balanceRecord.created_at.toISOString() ? 'Created' : 'Updated'} balance for account ${account.id}`);
        } else {
          result.created++;
          console.log(`[Account Sync] [DRY RUN] Would record balance for account ${account.id}`);
        }
      } catch (error: unknown) {
        console.error(`[Account Sync] Error syncing account ${account.id}:`, error);
        result.failed++;
        result.errors.push({
          transaction_id: account.id,
          error: getErrorMessage(error),
        });
      }
    }

    // Update connection metadata with account info
    if (!options.dryRun && accounts.length > 0) {
      // Get total balances across all accounts
      const totalCurrent = accounts.reduce(
        (sum, acc) => sum + (acc.currentBalance || 0),
        0
      );
      const totalAvailable = accounts.reduce(
        (sum, acc) => sum + (acc.availableBalance || 0),
        0
      );

      // Note: Balance summary stored in AccountBalanceHistory
      // Connection record tracks last sync time only
      console.log(
        `[Account Sync] Synced balances for ${accounts.length} accounts, $${totalCurrent.toFixed(2)} total balance`
      );
    }

    // Mark sync as successful
    result.success = true;

    // Complete sync log
    if (!options.dryRun && syncLogId) {
      await completeSyncLog(syncLogId, result);
    }

    result.duration_ms = Date.now() - startTime;

    console.log(
      `[Account Sync] Completed: ${result.created} balances recorded, ${result.failed} failed (${result.duration_ms}ms)`
    );

    return result;
  } catch (error: unknown) {
    console.error('[Account Sync] Fatal error during sync:', error);
    result.success = false;
    result.duration_ms = Date.now() - startTime;
    result.errors.push({
      transaction_id: 'SYNC_ERROR',
      error: getErrorMessage(error),
    });

    // Fail sync log
    if (!options.dryRun && syncLogId) {
      await failSyncLog(syncLogId, getErrorMessage(error), {
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
      });
    }

    return result;
  }
}

/**
 * Get balance history for a specific account
 *
 * @param connectionId - Mercury connection ID
 * @param mercuryAccountId - Mercury account ID
 * @param days - Number of days of history to retrieve
 * @returns Balance history entries
 */
export async function getAccountBalanceHistory(
  connectionId: string,
  mercuryAccountId: string,
  days: number = 90
) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  return await prisma.accountBalanceHistory.findMany({
    where: {
      connection_id: connectionId,
      mercury_account_id: mercuryAccountId,
      snapshot_date: { gte: since },
    },
    orderBy: { snapshot_date: 'desc' },
    select: {
      id: true,
      account_name: true,
      account_type: true,
      current_balance: true,
      available_balance: true,
      snapshot_date: true,
    },
  });
}

/**
 * Get latest balance for all accounts
 *
 * @param connectionId - Mercury connection ID
 * @returns Latest balance for each account
 */
export async function getLatestAccountBalances(connectionId: string) {
  // Get distinct account IDs
  const accounts = await prisma.accountBalanceHistory.findMany({
    where: { connection_id: connectionId },
    distinct: ['mercury_account_id'],
    select: { mercury_account_id: true },
  });

  // Get latest balance for each account
  const balances = await Promise.all(
    accounts.map(async (account) => {
      const latest = await prisma.accountBalanceHistory.findFirst({
        where: {
          connection_id: connectionId,
          mercury_account_id: account.mercury_account_id,
        },
        orderBy: { snapshot_date: 'desc' },
        select: {
          id: true,
          mercury_account_id: true,
          account_name: true,
          account_type: true,
          current_balance: true,
          available_balance: true,
          snapshot_date: true,
        },
      });

      return latest;
    })
  );

  return balances.filter((b) => b !== null);
}

/**
 * Get balance trend for an account
 *
 * @param connectionId - Mercury connection ID
 * @param mercuryAccountId - Mercury account ID
 * @param days - Number of days to analyze
 * @returns Balance trend data
 */
export async function getBalanceTrend(
  connectionId: string,
  mercuryAccountId: string,
  days: number = 30
) {
  const history = await getAccountBalanceHistory(connectionId, mercuryAccountId, days);

  if (history.length === 0) {
    return null;
  }

  const latest = history[0];
  const earliest = history[history.length - 1];

  const change = latest.current_balance.toNumber() - earliest.current_balance.toNumber();
  const changePercent =
    earliest.current_balance.toNumber() !== 0
      ? (change / earliest.current_balance.toNumber()) * 100
      : 0;

  // Calculate average daily balance
  const avgBalance =
    history.reduce((sum, h) => sum + h.current_balance.toNumber(), 0) / history.length;

  // Find min and max
  const balances = history.map((h) => h.current_balance.toNumber());
  const minBalance = Math.min(...balances);
  const maxBalance = Math.max(...balances);

  return {
    account_id: mercuryAccountId,
    account_name: latest.account_name,
    period_days: days,
    data_points: history.length,
    current_balance: latest.current_balance.toNumber(),
    earliest_balance: earliest.current_balance.toNumber(),
    change,
    change_percent: changePercent,
    avg_balance: avgBalance,
    min_balance: minBalance,
    max_balance: maxBalance,
    currency: 'USD' // USD only for MVP,
  };
}

/**
 * Check for low balance alerts
 *
 * @param connectionId - Mercury connection ID
 * @param threshold - Balance threshold for alerts
 * @returns Accounts below threshold
 */
export async function checkLowBalanceAlerts(
  connectionId: string,
  threshold: number = 10000
) {
  const latestBalances = await getLatestAccountBalances(connectionId);

  const lowBalanceAccounts = latestBalances.filter(
    (balance) => balance && balance.current_balance.toNumber() < threshold
  );

  return lowBalanceAccounts.map((account) => ({
    account_id: account!.mercury_account_id,
    account_name: account!.account_name,
    current_balance: account!.current_balance.toNumber(),
    threshold,
    deficit: threshold - account!.current_balance.toNumber(),
    snapshot_date: account!.snapshot_date,
  }));
}
