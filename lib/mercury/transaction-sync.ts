/**
 * Mercury Transaction Sync Service
 *
 * Handles fetching transactions from Mercury API and creating expense records.
 * Implements incremental sync with cursor-based pagination.
 *
 * Features:
 * - Incremental sync using last_sync_at timestamp
 * - Cursor-based pagination for large datasets
 * - Merchant-to-contractor mapping
 * - Automatic transaction categorization
 * - Two-tier duplicate detection:
 *   Tier 1: mercury_transaction_id uniqueness
 *   Tier 2: Business-level dedup (same merchant + amount + date)
 * - Status filtering: only imports settled ('sent') transactions
 * - Comprehensive error handling and logging
 */

import { prisma } from '@/lib/prisma';
import type { SyncSource, ExpenseRecordSyncStatus } from '@prisma/client';
import { getErrorMessage } from '@/lib/utils/error';
import { getMercuryClient } from './client-factory';
import { mapMerchantToContractor, mapMerchantToAgency } from './merchant-mapper';
import { categorizeTransaction } from './categorization-engine';
import { parseTransactionAmount, normalizeName, extractBaseVendorName } from './utils';
import { startSyncLog, completeSyncLog, failSyncLog } from './sync-logger';
import { runAutoAssociation } from './auto-association-engine';
import type {
  MercuryTransaction,
  TransactionSyncResult,
  TransactionSyncProgress,
} from '@/types/mercury';

interface SyncOptions {
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  dryRun?: boolean;
  forceUpdate?: boolean; // Bypass duplicate check to update existing records (e.g., backfill is_credit)
  batchSize?: number; // Max transactions to process per request (for timeout avoidance)
  cursor?: string; // Continuation cursor from previous batch
  isContinuation?: boolean; // True when continuing a previous batched sync
}

/**
 * Sync transactions for an organization
 *
 * @param organizationId - Organization ID
 * @param connectionId - Mercury connection ID
 * @param options - Sync options (date range, limits, dry run)
 * @returns Sync result with counts and errors
 */
export async function syncTransactions(
  organizationId: string,
  connectionId: string,
  options: SyncOptions = {},
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
    syncLogId = await startSyncLog(connectionId, 'TRANSACTIONS', triggeredBy, triggeredByUserId);
  }

  // Collect all transactions processed this run for auto-association (T027)
  const collectedTransactions: import('@/types/mercury').MercuryTransaction[] = [];

  try {
    console.log(`[Mercury Sync] Starting transaction sync for org ${organizationId}`);

    // Get Mercury connection
    const connection = await prisma.mercuryConnection.findUnique({
      where: { id: connectionId },
      select: {
        id: true,
        organization_id: true,
        last_sync_at: true,
        connection_status: true,
      },
    });

    if (!connection) {
      throw new Error(`Mercury connection not found: ${connectionId}`);
    }

    if (connection.connection_status !== 'ACTIVE') {
      throw new Error(`Mercury connection is not active: ${connection.connection_status}`);
    }

    // Determine sync date range
    const startDate = options.startDate || connection.last_sync_at || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // Default: 90 days
    const endDate = options.endDate || new Date();

    console.log(`[Mercury Sync] Fetching transactions from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // Initialize Mercury client
    const client = await getMercuryClient(organizationId);

    // Fetch transactions with pagination
    let cursor: string | undefined = options.cursor;
    let hasMore = true;
    let pageCount = 0;
    const batchSize = options.batchSize; // If set, limits total transactions processed per request
    let batchProcessed = 0;

    while (hasMore) {
      // Check if we've reached the total limit (for test mode or limited syncs)
      if (options.limit && result.processed >= options.limit) {
        console.log(`[Mercury Sync] Reached limit of ${options.limit} transactions, stopping`);
        hasMore = false;
        break;
      }

      // Check if we've reached the batch size limit (for timeout avoidance)
      // This fires between pages — cursor points to last transaction of previous page
      if (batchSize && batchProcessed >= batchSize) {
        console.log(`[Mercury Sync] Reached batch size of ${batchSize}, pausing for continuation`);
        result.hasMore = true;
        result.nextCursor = cursor; // cursor here is from previous page end
        break;
      }

      pageCount++;
      console.log(`[Mercury Sync] Fetching page ${pageCount}${cursor ? ` (cursor: ${cursor.substring(0, 20)}...)` : ''}`);

      // Determine page size for API call
      // Use limit for page size, or default to 100
      const pageSize = options.limit || 100;

      // Fetch transaction page
      const response = await client.getTransactions({
        limit: pageSize,
        start_after: cursor,
        start: startDate.toISOString().split('T')[0], // YYYY-MM-DD format
        end: endDate.toISOString().split('T')[0], // YYYY-MM-DD format
      });

      const transactions = response.transactions || [];
      console.log(`[Mercury Sync] Retrieved ${transactions.length} transactions (page ${pageCount})`);

      // If no transactions returned, we're done
      if (transactions.length === 0) {
        hasMore = false;
        break;
      }

      // Buffer only settled ('sent') transactions for auto-association (T027).
      // Non-settled transactions (pending, cancelled, failed) must be excluded
      // to prevent inflating subscription costs with failed payment retries.
      if (!options.dryRun) {
        const settledTransactions = transactions.filter(
          (tx) => !tx.status || tx.status === 'sent'
        );
        collectedTransactions.push(...settledTransactions);
      }

      // Process each transaction
      let lastProcessedTransactionId: string | undefined;
      for (const transaction of transactions) {
        // Check if we've reached the limit before processing this transaction
        if (options.limit && result.processed >= options.limit) {
          console.log(`[Mercury Sync] Reached limit of ${options.limit} transactions during processing, stopping`);
          hasMore = false;
          break;
        }

        // Check batch size limit
        if (batchSize && batchProcessed >= batchSize) {
          console.log(`[Mercury Sync] Reached batch size of ${batchSize} during processing, pausing`);
          // Use the last processed transaction ID as cursor for continuation
          result.hasMore = true;
          result.nextCursor = lastProcessedTransactionId;
          hasMore = false;
          break;
        }

        try {
          result.processed++;
          batchProcessed++;
          lastProcessedTransactionId = transaction.id;

          // Skip non-settled transactions (pending, cancelled, failed)
          if (transaction.status && transaction.status !== 'sent') {
            console.log(`[Mercury Sync] Skipping non-settled transaction: ${transaction.id} (status: ${transaction.status})`);
            result.skipped++;
            continue;
          }

          // Tier 1: Skip if already processed (check by mercury_transaction_id)
          // When forceUpdate is true, allow processing to reach the upsert for backfilling fields
          if (!options.dryRun && !options.forceUpdate) {
            const existing = await prisma.expenseRecord.findFirst({
              where: { mercury_transaction_id: transaction.id },
              select: { id: true },
            });

            if (existing) {
              console.log(`[Mercury Sync] Skipping duplicate transaction: ${transaction.id}`);
              result.skipped++;
              continue;
            }
          }

          // Tier 2: Business-level duplicate check
          // Same org + same base merchant name + same amount + same calendar day
          // Catches cases where Mercury returns multiple IDs for the same logical charge
          if (!options.dryRun && !options.forceUpdate) {
            const merchantName = transaction.counterpartyName || transaction.bankDescription || 'Unknown';
            const txAmount = Math.abs(parseTransactionAmount(transaction.amount));
            const txDate = new Date(transaction.createdAt);
            const dayStart = new Date(txDate.getFullYear(), txDate.getMonth(), txDate.getDate());
            const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
            const baseVendor = extractBaseVendorName(merchantName);

            // Only check if we have a meaningful vendor name
            if (baseVendor.length >= 3) {
              const businessDupe = await prisma.expenseRecord.findFirst({
                where: {
                  organization_id: organizationId,
                  amount: txAmount,
                  transaction_date: { gte: dayStart, lt: dayEnd },
                  mercury_transaction_id: { not: null },
                  // Match on first significant word of normalized merchant name
                  merchant_name: { contains: baseVendor.split(' ')[0], mode: 'insensitive' },
                },
                select: { id: true, mercury_transaction_id: true },
              });

              if (businessDupe) {
                console.log(
                  `[Mercury Sync] Skipping business duplicate: ${transaction.id} ` +
                  `(matches existing ${businessDupe.mercury_transaction_id} — same merchant/amount/date)`
                );
                result.skipped++;
                continue;
              }
            }
          }

          // Process transaction
          await processTransaction(
            transaction,
            organizationId,
            connectionId,
            result,
            options.dryRun || false
          );
        } catch (error: unknown) {
          console.error(`[Mercury Sync] Error processing transaction ${transaction.id}:`, error);
          result.failed++;
          result.errors.push({
            transaction_id: transaction.id,
            error: getErrorMessage(error),
          });
        }
      }

      // Don't fetch more pages if we've reached the limit or batch size
      if (options.limit && result.processed >= options.limit) {
        hasMore = false;
        break;
      }

      if (batchSize && batchProcessed >= batchSize) {
        break;
      }

      // Check if there are more pages (if we got a full page, likely more to fetch)
      if (transactions.length < pageSize) {
        hasMore = false;
      } else {
        // Use last transaction ID as cursor for next page
        cursor = transactions[transactions.length - 1].id;
      }
    }

    // Update last_sync_at if not dry run
    // Only finalize sync state when all batches are complete (no more data to process)
    if (!options.dryRun) {
      result.success = true;

      if (!result.hasMore) {
        // Final batch — update connection sync timestamp and status
        await prisma.mercuryConnection.update({
          where: { id: connectionId },
          data: {
            last_sync_at: new Date(),
            last_sync_status: result.failed === 0 ? 'SUCCESS' : 'PARTIAL',
          },
        });

        // Complete sync log
        if (syncLogId) {
          await completeSyncLog(syncLogId, result);
        }

        // T027: Run auto-association engine after sync completes.
        // Wrapped in try/catch — engine failure must NOT fail the parent sync.
        if (syncLogId && collectedTransactions.length > 0) {
          try {
            await runAutoAssociation(
              organizationId,
              connectionId,
              syncLogId,
              collectedTransactions
            );
          } catch (engineError: unknown) {
            console.error('[Mercury Sync] Auto-association engine error (non-fatal):', engineError);
          }
        }
      } else {
        console.log(`[Mercury Sync] Batch complete — more data available. Cursor: ${result.nextCursor}`);
      }
    }

    result.duration_ms = Date.now() - startTime;

    console.log(
      `[Mercury Sync] Completed: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped, ${result.failed} failed ` +
      `(${result.processed} total processed across ${pageCount} pages, ${result.duration_ms}ms)`
    );

    return result;
  } catch (error: unknown) {
    console.error('[Mercury Sync] Fatal error during sync:', error);
    result.success = false;
    result.duration_ms = Date.now() - startTime;
    result.errors.push({
      transaction_id: 'SYNC_ERROR',
      error: getErrorMessage(error),
    });

    // Update connection status to API_ERROR if not dry run
    if (!options.dryRun) {
      await prisma.mercuryConnection.update({
        where: { id: connectionId },
        data: {
          connection_status: 'API_ERROR',
          last_sync_status: 'FAILED',
        },
      });

      // Fail sync log
      if (syncLogId) {
        await failSyncLog(syncLogId, getErrorMessage(error), {
          stack: error instanceof Error ? error.stack : undefined,
          name: error instanceof Error ? error.name : undefined,
        });
      }
    }

    return result;
  }
}

/**
 * Get the mapping mode for a merchant
 * Returns 'PER_TRANSACTION' if the merchant has been set to per-transaction mode,
 * 'SINGLE' otherwise (including when no mapping exists).
 *
 * @param connectionId - Mercury connection ID
 * @param merchantName - Raw merchant name
 * @returns Mapping mode
 */
export async function getMerchantMappingMode(
  connectionId: string,
  merchantName: string
): Promise<'SINGLE' | 'PER_TRANSACTION'> {
  const normalizedName = normalizeName(merchantName);

  const mapping = await prisma.merchantMappingCache.findUnique({
    where: {
      connection_id_normalized_merchant_name: {
        connection_id: connectionId,
        normalized_merchant_name: normalizedName,
      },
    },
    select: { mapping_mode: true },
  });

  return mapping?.mapping_mode || 'SINGLE';
}

/**
 * Detect if a transaction is an internal transfer or Mercury Credit payment
 * Internal transfers between checking/savings/credit are not real expenses.
 *
 * @param transaction - Mercury transaction data
 * @returns true if this is an internal transfer
 */
function isInternalTransfer(transaction: MercuryTransaction): boolean {
  // Mercury API explicitly marks internal transfers
  if (transaction.kind === 'internalTransfer') {
    return true;
  }

  // Fallback: detect by counterparty name for Mercury Credit payments
  // and account-to-account transfers that may not have kind set
  const name = (transaction.counterpartyName || '').toLowerCase();
  const desc = (transaction.bankDescription || '').toLowerCase();
  const combined = `${name} ${desc}`;

  const transferPatterns = [
    /mercury\s*(checking|savings|credit|treasury)/i,
    /internal\s*transfer/i,
    /transfer\s*(to|from)\s*mercury/i,
    /mercury\s*card\s*payment/i,
  ];

  return transferPatterns.some((pattern) => pattern.test(combined));
}

/**
 * Process a single transaction
 *
 * @param transaction - Mercury transaction data
 * @param organizationId - Organization ID
 * @param connectionId - Mercury connection ID
 * @param result - Result object to update
 * @param dryRun - If true, don't create records
 */
async function processTransaction(
  transaction: MercuryTransaction,
  organizationId: string,
  connectionId: string,
  result: TransactionSyncResult,
  dryRun: boolean
): Promise<void> {
  // Extract transaction data
  const merchantName = transaction.counterpartyName || transaction.bankDescription || 'Unknown Merchant';
  const amount = parseTransactionAmount(transaction.amount);
  const isCredit = amount > 0; // Positive Mercury amount = credit/income
  const transactionDate = new Date(transaction.createdAt);

  // Build description: bankDescription + account number info from routing details.
  // Account numbers enable PER_TRANSACTION rules to match on specific accounts
  // (e.g., Chase transfers where different account numbers belong to different owners).
  let description = transaction.bankDescription || null;
  const accountNumber =
    transaction.details?.electronicRoutingInfo?.accountNumber ||
    transaction.details?.domesticWireRoutingInfo?.accountNumber ||
    null;
  if (accountNumber) {
    const suffix = accountNumber.length > 4 ? accountNumber.slice(-4) : accountNumber;
    description = description
      ? `${description} [acct:${suffix}]`
      : `[acct:${suffix}]`;
  }

  console.log(`[Mercury Sync] Processing: ${merchantName} - ${amount} (${isCredit ? 'CREDIT' : 'DEBIT'}, kind: ${transaction.kind})`);

  // Early detection: internal transfers and Mercury Credit payments
  // These are not real expenses — categorize as TRANSFER and skip entity mapping
  if (isInternalTransfer(transaction)) {
    console.log(`[Mercury Sync] Detected internal transfer: ${merchantName} (kind: ${transaction.kind})`);

    if (!dryRun) {
      await prisma.expenseRecord.upsert({
        where: { mercury_transaction_id: transaction.id },
        create: {
          organization_id: organizationId,
          mercury_transaction_id: transaction.id,
          merchant_name: merchantName,
          transaction_date: transactionDate,
          amount: Math.abs(amount),
          description,
          category: 'TRANSFER',
          categorization_confidence: 1.0,
          mercury_sync_status: 'SYNCED',
          sync_source: 'MERCURY',
          is_credit: isCredit,
        },
        update: {
          merchant_name: merchantName,
          amount: Math.abs(amount),
          description,
          category: 'TRANSFER',
          categorization_confidence: 1.0,
          is_credit: isCredit,
          // Clear any entity FKs that may have been set before this logic existed
          contractor_id: null,
          agency_id: null,
          subscription_id: null,
          expense_category_id: null,
          staff_id: null,
          categorization_rule_id: null,
        },
      });

      result.created++;
      console.log(`[Mercury Sync] Created/upserted TRANSFER record for ${transaction.id}`);
    } else {
      result.created++;
      console.log(`[Mercury Sync] [DRY RUN] Would create TRANSFER record for ${transaction.id}`);
    }
    return;
  }

  // Check merchant mapping mode
  const mappingMode = await getMerchantMappingMode(connectionId, merchantName);

  let contractorId: string | null = null;
  let agencyId: string | null = null;
  let subscriptionId: string | null = null;
  let expenseCategoryId: string | null = null;
  let staffId: string | null = null;
  let merchantNameScope: string | null = null;

  if (mappingMode === 'PER_TRANSACTION') {
    // PER_TRANSACTION mode: skip merchant-level entity mapping,
    // let categorization rules handle per-transaction entity assignment
    merchantNameScope = merchantName;
    console.log(`[Mercury Sync] PER_TRANSACTION mode — using scoped rules for ${merchantName}`);
  } else {
    // SINGLE mode: standard merchant-level mapping
    // Check for owner (staff) mapping first — MerchantMappingCache.staff_id
    const staffMapping = await prisma.merchantMappingCache.findFirst({
      where: {
        connection_id: connectionId,
        normalized_merchant_name: normalizeName(merchantName),
        staff_id: { not: null },
      },
      select: { staff_id: true },
    });

    if (staffMapping?.staff_id) {
      staffId = staffMapping.staff_id;
      console.log(`[Mercury Sync] Owner (staff) match: ${staffId}`);
    } else {
      contractorId = await mapMerchantToContractor(
        connectionId,
        organizationId,
        merchantName,
        transactionDate
      );
      console.log(`[Mercury Sync] Contractor match: ${contractorId ? 'Found' : 'None'}`);

      if (!contractorId) {
        agencyId = await mapMerchantToAgency(connectionId, organizationId, merchantName, transactionDate);
        console.log(`[Mercury Sync] Agency match: ${agencyId ? 'Found' : 'None'}`);
      }
    }
  }

  // Categorize transaction (with optional merchant scope for PER_TRANSACTION)
  const categorization = await categorizeTransaction(
    {
      merchantName,
      description,
      amount: Math.abs(amount),
    },
    organizationId,
    contractorId,
    merchantNameScope
  );

  console.log(`[Mercury Sync] Category: ${categorization.category} (${categorization.confidence.toFixed(2)})`);

  // For PER_TRANSACTION, extract entity FKs from categorization result
  if (mappingMode === 'PER_TRANSACTION') {
    contractorId = categorization.contractor_id || null;
    agencyId = categorization.agency_id || null;
    subscriptionId = categorization.subscription_id || null;
    expenseCategoryId = categorization.expense_category_id || null;
    staffId = categorization.staff_id || null;
  }

  // Create expense record
  if (!dryRun) {
    await prisma.expenseRecord.upsert({
      where: { mercury_transaction_id: transaction.id },
      create: {
        organization_id: organizationId,
        mercury_transaction_id: transaction.id,
        merchant_name: merchantName,
        transaction_date: transactionDate,
        amount: Math.abs(amount),
        description,
        category: categorization.category as any, // Type cast to ExpenseCategory enum
        categorization_confidence: categorization.confidence,
        categorization_rule_id: categorization.rule_id || null,
        contractor_id: contractorId,
        agency_id: agencyId,
        subscription_id: subscriptionId,
        expense_category_id: expenseCategoryId,
        staff_id: staffId,
        mercury_sync_status: 'SYNCED',
        sync_source: 'MERCURY',
        is_credit: isCredit,
      },
      update: {
        merchant_name: merchantName,
        amount: Math.abs(amount),
        description,
        category: categorization.category as any,
        categorization_confidence: categorization.confidence,
        categorization_rule_id: categorization.rule_id || null,
        contractor_id: contractorId,
        agency_id: agencyId,
        subscription_id: subscriptionId,
        expense_category_id: expenseCategoryId,
        staff_id: staffId,
        is_credit: isCredit,
      },
    });

    result.created++;
    console.log(`[Mercury Sync] Created/upserted expense record for ${transaction.id}`);

    // Auto-create ClientCashReceipt for credit transactions with client merchant mapping
    if (isCredit) {
      const clientMapping = await prisma.merchantMappingCache.findFirst({
        where: {
          connection_id: connectionId,
          normalized_merchant_name: normalizeName(merchantName),
          client_id: { not: null },
        },
        select: { client_id: true },
      });

      if (clientMapping?.client_id) {
        const existing = await prisma.clientCashReceipt.findUnique({
          where: { mercury_transaction_id: transaction.id },
          select: { id: true },
        });

        if (!existing) {
          await prisma.clientCashReceipt.create({
            data: {
              organization_id: organizationId,
              client_id: clientMapping.client_id,
              mercury_transaction_id: transaction.id,
              amount: Math.abs(amount),
              receipt_date: transactionDate,
              period_month: transactionDate.getMonth() + 1,
              period_year: transactionDate.getFullYear(),
              linked_by_user_id: 'system',
            },
          });
          console.log(`[Mercury Sync] Auto-created ClientCashReceipt for deposit ${transaction.id} → client ${clientMapping.client_id}`);
        }
      }
    }
  } else {
    result.created++;
    console.log(`[Mercury Sync] [DRY RUN] Would create expense record for ${transaction.id}`);
  }
}

/**
 * Sync transactions with progress callback
 *
 * @param organizationId - Organization ID
 * @param connectionId - Mercury connection ID
 * @param onProgress - Progress callback
 * @param options - Sync options
 * @returns Sync result
 */
export async function syncTransactionsWithProgress(
  organizationId: string,
  connectionId: string,
  onProgress: (progress: TransactionSyncProgress) => void,
  options: SyncOptions = {}
): Promise<TransactionSyncResult> {
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

  const startTime = Date.now();

  try {
    // Get connection
    const connection = await prisma.mercuryConnection.findUnique({
      where: { id: connectionId },
      select: {
        id: true,
        organization_id: true,
        last_sync_at: true,
      },
    });

    if (!connection) {
      throw new Error(`Mercury connection not found: ${connectionId}`);
    }

    const startDate = options.startDate || connection.last_sync_at || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const endDate = options.endDate || new Date();

    const client = await getMercuryClient(organizationId);

    let cursor: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const response = await client.getTransactions({
        limit: options.limit || 100,
        start_after: cursor,
      });

      const transactions = response.transactions || [];

      for (const transaction of transactions) {
        try {
          result.processed++;

          // Check for duplicates
          if (!options.dryRun) {
            const existing = await prisma.expenseRecord.findFirst({
              where: { mercury_transaction_id: transaction.id },
            });

            if (existing) {
              result.skipped++;
              continue;
            }
          }

          await processTransaction(
            transaction,
            organizationId,
            connectionId,
            result,
            options.dryRun || false
          );

          // Report progress
          onProgress({
            processed: result.processed,
            created: result.created,
            updated: result.updated,
            skipped: result.skipped,
            failed: result.failed,
            currentMerchant: transaction.counterpartyName || 'Unknown',
            percentage: 0, // Can't calculate without total count
          });
        } catch (error: unknown) {
          result.failed++;
          result.errors.push({
            transaction_id: transaction.id,
            error: getErrorMessage(error),
          });
        }
      }

      // Mercury API doesn't support pagination
      hasMore = false;
    }

    if (!options.dryRun) {
      await prisma.mercuryConnection.update({
        where: { id: connectionId },
        data: {
          last_sync_at: new Date(),
          last_sync_status: result.failed === 0 ? 'SUCCESS' : 'PARTIAL',
        },
      });
    }

    result.success = true;
    result.duration_ms = Date.now() - startTime;

    return result;
  } catch (error: unknown) {
    result.success = false;
    result.duration_ms = Date.now() - startTime;
    result.errors.push({
      transaction_id: 'SYNC_ERROR',
      error: getErrorMessage(error),
    });

    if (!options.dryRun) {
      await prisma.mercuryConnection.update({
        where: { id: connectionId },
        data: {
          connection_status: 'API_ERROR',
          last_sync_status: 'FAILED',
        },
      });
    }

    return result;
  }
}

/**
 * Get sync statistics for an organization
 *
 * @param organizationId - Organization ID
 * @returns Sync statistics
 */
export async function getSyncStatistics(organizationId: string) {
  const connection = await prisma.mercuryConnection.findUnique({
    where: { organization_id: organizationId },
    select: {
      id: true,
      last_sync_at: true,
      last_sync_status: true,
      created_at: true,
    },
  });

  if (!connection) {
    return null;
  }

  // Count synced expenses
  const totalExpenses = await prisma.expenseRecord.count({
    where: {
      organization_id: organizationId,
      mercury_transaction_id: { not: null },
    },
  });

  // Count by category
  const byCategory = await prisma.expenseRecord.groupBy({
    by: ['category'],
    where: {
      organization_id: organizationId,
      mercury_transaction_id: { not: null },
    },
    _count: true,
  });

  // Count by sync status
  const byStatus = await prisma.expenseRecord.groupBy({
    by: ['mercury_sync_status'],
    where: {
      organization_id: organizationId,
      mercury_transaction_id: { not: null },
    },
    _count: true,
  });

  // Recent sync logs
  const recentSyncs = await prisma.mercurySyncLog.findMany({
    where: { connection_id: connection.id },
    orderBy: { started_at: 'desc' },
    take: 10,
    select: {
      id: true,
      sync_type: true,
      status: true,
      started_at: true,
      completed_at: true,
      duration_ms: true,
      transactions_processed: true,
      transactions_failed: true,
      balances_updated: true,
      errors: true,
      triggered_by: true,
    },
  });

  return {
    connection: {
      id: connection.id,
      last_sync_at: connection.last_sync_at,
      last_sync_status: connection.last_sync_status,
      connected_since: connection.created_at,
    },
    totals: {
      expenses: totalExpenses,
    },
    breakdown: {
      by_category: byCategory,
      by_status: byStatus,
    },
    recent_syncs: recentSyncs,
  };
}
