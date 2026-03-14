/**
 * Auto-Association Engine (T026)
 *
 * Runs after each Mercury sync to automatically associate transactions:
 * - DEBIT transactions only: subscription mapping → SubscriptionTransactionRecord
 * - CREDIT transactions: flagged for manual deposit linking queue (never linked to subscriptions)
 *
 * Implements partial commit: each transaction is committed independently.
 * Failures are recorded per-transaction and do NOT roll back prior commits.
 *
 * Called from transaction-sync.ts after the main sync loop completes (T027).
 */

import { prisma } from '@/lib/prisma';
import { mapMerchantToSubscription } from './subscription-mapper';
import { linkTransactionToSubscription } from './subscription-sync';
import { parseTransactionAmount } from './utils';
import {
  cascadeAllocationUpdates,
  updateClientROISubscriptionCosts,
  detectCostChangeAndNotify,
  computeSubscriptionPeriodCost,
} from '@/lib/calculations/subscription-cost-calculator';
import type { MercuryTransaction } from '@/types/mercury';
import { getErrorMessage } from '@/lib/utils/error';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AutoAssociationEngineError {
  transactionId: string;
  merchantName: string;
  error: string;
}

export interface AutoAssociationResult {
  subscriptionTransactionsCreated: number;
  contractorExpenseRecordsCreated: number;
  needsReviewCount: number;
  engineErrorCount: number;
  partialCommit: boolean;
  errors: AutoAssociationEngineError[];
  unassociatedDepositIds: string[];
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

/**
 * Run auto-association for a batch of Mercury transactions.
 *
 * Creates an AutoSyncRunLog, processes each transaction (partial commit),
 * and updates the log with final counts on completion.
 *
 * @param organizationId - Organization ID
 * @param connectionId   - Mercury connection ID
 * @param syncLogId      - Parent MercurySyncLog ID to link to
 * @param transactions   - Raw Mercury transactions from the sync batch
 */
export async function runAutoAssociation(
  organizationId: string,
  connectionId: string,
  syncLogId: string,
  transactions: MercuryTransaction[]
): Promise<AutoAssociationResult> {
  const startedAt = new Date();

  // Create run log entry
  const runLog = await prisma.autoSyncRunLog.create({
    data: {
      organization_id: organizationId,
      mercury_sync_log_id: syncLogId,
      started_at: startedAt,
    },
  });

  const result: AutoAssociationResult = {
    subscriptionTransactionsCreated: 0,
    contractorExpenseRecordsCreated: 0,
    needsReviewCount: 0,
    engineErrorCount: 0,
    partialCommit: false,
    errors: [],
    unassociatedDepositIds: [],
  };

  // Separate debits (amount < 0) from credits (amount > 0)
  const debits: MercuryTransaction[] = [];
  const credits: MercuryTransaction[] = [];

  for (const tx of transactions) {
    const amount = parseTransactionAmount(tx.amount);
    if (amount < 0) {
      debits.push(tx);
    } else if (amount > 0) {
      credits.push(tx);
    }
    // Zero-amount transactions are ignored
  }

  // Credits go straight to the deposit queue — they must never inflate
  // subscription costs (failed-payment refunds, chargebacks, etc.).
  const unmatchedCreditIds: string[] = credits.map((c) => c.id);

  // Track affected subscriptions for cascade updates (T031)
  // Key: "subscriptionId|month|year"
  const affectedSubscriptions = new Map<string, { subscriptionId: string; month: number; year: number }>();

  // Process ONLY debit transactions for subscription mapping.
  // Credits are never linked to subscriptions — they represent refunds,
  // failed-payment reversals, or income deposits, not subscription charges.
  const allTransactions = debits;
  for (const tx of allTransactions) {
    const merchantName =
      tx.counterpartyName || tx.bankDescription || 'Unknown Merchant';
    const amount = Math.abs(parseTransactionAmount(tx.amount));
    const transactionDate = new Date(tx.createdAt);

    try {
      // Check if already linked to a subscription
      const alreadyLinked = await prisma.subscriptionTransactionRecord.findUnique({
        where: { mercury_transaction_id: tx.id },
        select: { id: true },
      });

      if (alreadyLinked) {
        // Already processed by a previous run — skip silently
        continue;
      }

      // Tier: Try subscription mapping first
      const subscriptionId = await mapMerchantToSubscription(
        connectionId,
        organizationId,
        merchantName
      );

      if (subscriptionId) {
        const linkResult = await linkTransactionToSubscription(
          tx.id,
          subscriptionId,
          organizationId,
          amount,
          transactionDate,
          merchantName
        );

        if (linkResult.created) {
          result.subscriptionTransactionsCreated++;
          // Track for cascade updates (T031)
          const month = transactionDate.getMonth() + 1;
          const year = transactionDate.getFullYear();
          const key = `${subscriptionId}|${month}|${year}`;
          affectedSubscriptions.set(key, { subscriptionId, month, year });
        }
        // If skipped (duplicate), move on silently
        continue;
      }

      // No subscription mapping via merchant-level cache.
      // Check if a PER_TRANSACTION categorization rule linked to a subscription.
      const expenseRecord = await prisma.expenseRecord.findFirst({
        where: { mercury_transaction_id: tx.id },
        select: { id: true, contractor_id: true, agency_id: true, categorization_rule_id: true },
      });

      if (expenseRecord?.categorization_rule_id) {
        const rule = await prisma.transactionCategorizationRule.findUnique({
          where: { id: expenseRecord.categorization_rule_id },
          select: { subscription_id: true },
        });

        if (rule?.subscription_id) {
          const linkResult = await linkTransactionToSubscription(
            tx.id,
            rule.subscription_id,
            organizationId,
            amount,
            transactionDate,
            merchantName
          );

          if (linkResult.created) {
            result.subscriptionTransactionsCreated++;
            const month = transactionDate.getMonth() + 1;
            const year = transactionDate.getFullYear();
            const key = `${rule.subscription_id}|${month}|${year}`;
            affectedSubscriptions.set(key, { subscriptionId: rule.subscription_id, month, year });
          }
          continue;
        }
      }

      // Debit with no subscription mapping:
      // transaction-sync.ts already handles contractor mapping and expense
      // record creation. Check if it remains unassigned → needs review.

      if (expenseRecord && !expenseRecord.contractor_id && !expenseRecord.agency_id) {
        result.needsReviewCount++;
      }
    } catch (err: unknown) {
      result.engineErrorCount++;
      result.partialCommit = true;
      result.errors.push({
        transactionId: tx.id,
        merchantName,
        error: getErrorMessage(err),
      });

      console.error(
        `[AutoAssociation] Error processing transaction ${tx.id} (${merchantName}):`,
        err
      );
    }
  }

  // T031 + T032: Cascade allocation updates and cost-change notifications
  // Run once per unique (subscription × period) that had new transaction records.
  if (affectedSubscriptions.size > 0) {
    for (const { subscriptionId, month, year } of affectedSubscriptions.values()) {
      try {
        // Compute prior period total for notification comparison
        const priorMonth = month === 1 ? 12 : month - 1;
        const priorYear = month === 1 ? year - 1 : year;
        const priorTotal = await computeSubscriptionPeriodCost(subscriptionId, priorMonth, priorYear);

        // Cascade allocation cost updates
        await cascadeAllocationUpdates(subscriptionId, month, year);

        // Update ClientROI subscription costs
        await updateClientROISubscriptionCosts(subscriptionId, month, year);

        // Compute current period total and notify if significant change (T032)
        const currentTotal = await computeSubscriptionPeriodCost(subscriptionId, month, year);
        await detectCostChangeAndNotify(subscriptionId, currentTotal, priorTotal, organizationId);
      } catch (cascadeError: unknown) {
        console.error(
          `[AutoAssociation] Cascade error for subscription ${subscriptionId} ${month}/${year}:`,
          cascadeError
        );
        // Cascade failures are non-fatal; engine continues
        result.engineErrorCount++;
        result.partialCommit = true;
        result.errors.push({
          transactionId: 'CASCADE',
          merchantName: subscriptionId,
          error: cascadeError instanceof Error ? cascadeError.message : 'Cascade update failed',
        });
      }
    }
  }

  // Count contractor expense records created during this sync run
  // (expense records created by transaction-sync that have a contractor_id)
  const completedAt = new Date();
  const durationMs = completedAt.getTime() - startedAt.getTime();

  // Update run log with final counts
  await prisma.autoSyncRunLog.update({
    where: { id: runLog.id },
    data: {
      completed_at: completedAt,
      duration_ms: durationMs,
      subscription_transactions_created: result.subscriptionTransactionsCreated,
      contractor_expense_records_created: result.contractorExpenseRecordsCreated,
      needs_review_count: result.needsReviewCount,
      engine_error_count: result.engineErrorCount,
      partial_commit: result.partialCommit,
      errors: result.errors as any,
    },
  });

  // Only unmatched credits go to deposit queue
  result.unassociatedDepositIds = unmatchedCreditIds;

  console.log(
    `[AutoAssociation] Completed in ${durationMs}ms: ` +
    `${result.subscriptionTransactionsCreated} subscription records, ` +
    `${result.needsReviewCount} needs review, ` +
    `${result.engineErrorCount} errors`
  );

  return result;
}
