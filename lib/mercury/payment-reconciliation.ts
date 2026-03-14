/**
 * Mercury Contractor Payment Reconciliation
 *
 * Matches pending ContractorPayment records against settled ExpenseRecords
 * that were synced from Mercury. Called after the daily transaction sync.
 *
 * Strategy:
 * 1. Primary match: ContractorPayment.mercury_request_id === ExpenseRecord.mercury_transaction_id
 * 2. Fallback match: amount + contractor_id + date window (±7 days from initiated_at)
 * 3. Stale detection: payments pending >30 days flagged for admin review
 */

import { prisma } from '@/lib/prisma';
import { getErrorMessage } from '@/lib/utils/error';

interface ReconciliationResult {
  reconciled: number;
  stale_flagged: number;
  errors: Array<{ payment_id: string; error: string }>;
  duration_ms: number;
}

/**
 * Reconcile pending contractor payments against synced Mercury transactions.
 *
 * @param organizationId - Organization ID to reconcile payments for
 * @returns Reconciliation result with counts of reconciled and stale payments
 */
export async function reconcileContractorPayments(
  organizationId: string
): Promise<ReconciliationResult> {
  const startTime = Date.now();
  const result: ReconciliationResult = {
    reconciled: 0,
    stale_flagged: 0,
    errors: [],
    duration_ms: 0,
  };

  try {
    // Find all pending/processing contractor payments for this org
    const pendingPayments = await prisma.contractorPayment.findMany({
      where: {
        organization_id: organizationId,
        status: { in: ['PENDING', 'PROCESSING'] },
      },
      select: {
        id: true,
        mercury_request_id: true,
        contractor_id: true,
        amount: true,
        initiated_at: true,
        status: true,
      },
    });

    if (pendingPayments.length === 0) {
      result.duration_ms = Date.now() - startTime;
      return result;
    }

    console.log(
      `[Payment Reconciliation] Found ${pendingPayments.length} pending payments for org ${organizationId}`
    );

    const now = new Date();
    const staleThresholdMs = 30 * 24 * 60 * 60 * 1000; // 30 days

    for (const payment of pendingPayments) {
      try {
        let matched = false;

        // Strategy 1: Match by mercury_request_id
        if (payment.mercury_request_id) {
          const matchedExpense = await prisma.expenseRecord.findFirst({
            where: {
              mercury_transaction_id: payment.mercury_request_id,
              organization_id: organizationId,
            },
            select: { id: true, mercury_transaction_id: true },
          });

          if (matchedExpense) {
            await prisma.contractorPayment.update({
              where: { id: payment.id },
              data: {
                status: 'COMPLETED',
                mercury_transaction_id: matchedExpense.mercury_transaction_id,
                completed_at: now,
              },
            });

            console.log(
              `[Payment Reconciliation] Matched payment ${payment.id} via mercury_request_id ${payment.mercury_request_id}`
            );
            result.reconciled++;
            matched = true;
          }
        }

        // Strategy 2: Fallback match by amount + contractor + date window
        if (!matched) {
          const dateWindowStart = new Date(
            payment.initiated_at.getTime() - 7 * 24 * 60 * 60 * 1000
          );
          const dateWindowEnd = new Date(
            payment.initiated_at.getTime() + 7 * 24 * 60 * 60 * 1000
          );

          const fallbackMatch = await prisma.expenseRecord.findFirst({
            where: {
              organization_id: organizationId,
              contractor_id: payment.contractor_id,
              amount: payment.amount,
              transaction_date: {
                gte: dateWindowStart,
                lte: dateWindowEnd,
              },
              mercury_transaction_id: { not: null },
            },
            select: { id: true, mercury_transaction_id: true },
          });

          if (fallbackMatch) {
            await prisma.contractorPayment.update({
              where: { id: payment.id },
              data: {
                status: 'COMPLETED',
                mercury_transaction_id: fallbackMatch.mercury_transaction_id,
                completed_at: now,
              },
            });

            console.log(
              `[Payment Reconciliation] Matched payment ${payment.id} via fallback (amount+contractor+date)`
            );
            result.reconciled++;
            matched = true;
          }
        }

        // Strategy 3: Flag stale payments (>30 days pending)
        if (!matched) {
          const ageMs = now.getTime() - payment.initiated_at.getTime();
          if (ageMs > staleThresholdMs) {
            await prisma.contractorPayment.update({
              where: { id: payment.id },
              data: {
                status: 'FAILED',
                failure_reason: 'Payment stale: no matching Mercury transaction found after 30 days',
              },
            });

            console.warn(
              `[Payment Reconciliation] Flagged stale payment ${payment.id} (${Math.round(ageMs / (24 * 60 * 60 * 1000))} days old)`
            );
            result.stale_flagged++;
          }
        }
      } catch (error: unknown) {
        console.error(
          `[Payment Reconciliation] Error processing payment ${payment.id}:`,
          error
        );
        result.errors.push({
          payment_id: payment.id,
          error: getErrorMessage(error),
        });
      }
    }

    result.duration_ms = Date.now() - startTime;

    console.log(
      `[Payment Reconciliation] Completed for org ${organizationId}: ` +
        `${result.reconciled} reconciled, ${result.stale_flagged} stale, ` +
        `${result.errors.length} errors (${result.duration_ms}ms)`
    );

    return result;
  } catch (error: unknown) {
    console.error('[Payment Reconciliation] Fatal error:', error);
    result.duration_ms = Date.now() - startTime;
    result.errors.push({
      payment_id: 'RECONCILIATION_ERROR',
      error: getErrorMessage(error),
    });
    return result;
  }
}
