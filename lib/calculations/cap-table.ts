import type { EquityTransactionType } from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

interface HoldingInput {
  stakeholder_id: string;
  share_class_id: string;
  shares_held: number;
}

interface TransactionInput {
  transaction_type: EquityTransactionType;
  transaction_date: Date;
  share_class_id: string;
  from_stakeholder_id: string | null;
  to_stakeholder_id: string | null;
  shares_affected: number;
}

interface OwnershipPercentage {
  stakeholder_id: string;
  share_class_id: string;
  shares_held: number;
  ownership_percentage: number;
}

interface ReplayedHoldings {
  /** Map of `${stakeholder_id}:${share_class_id}` to shares held */
  holdings: Map<string, number>;
}

// ============================================================================
// Ownership Percentage Calculation
// ============================================================================

/**
 * Calculate ownership percentages from holdings data.
 * Returns percentages to 4 decimal places.
 * Returns 0.0000% for all if total issued is 0 (no division-by-zero).
 */
export function calculateOwnershipPercentages(
  holdings: HoldingInput[],
  totalIssued: number
): OwnershipPercentage[] {
  return holdings.map((h) => ({
    stakeholder_id: h.stakeholder_id,
    share_class_id: h.share_class_id,
    shares_held: h.shares_held,
    ownership_percentage:
      totalIssued > 0
        ? Math.round((h.shares_held / totalIssued) * 100 * 10000) / 10000
        : 0,
  }));
}

// ============================================================================
// Point-in-Time Transaction Replay
// ============================================================================

/**
 * Replay transactions up to a given date to reconstruct holdings at that point in time.
 * Transactions must be ordered by transaction_date ASC, created_at ASC.
 *
 * Returns a Map keyed by `${stakeholder_id}:${share_class_id}` with shares held.
 */
export function replayTransactionsAsOfDate(
  transactions: TransactionInput[],
  asOfDate: Date
): ReplayedHoldings {
  const holdings = new Map<string, number>();

  const holdingKey = (stakeholderId: string, shareClassId: string) =>
    `${stakeholderId}:${shareClassId}`;

  const addShares = (stakeholderId: string, shareClassId: string, shares: number) => {
    const key = holdingKey(stakeholderId, shareClassId);
    holdings.set(key, (holdings.get(key) || 0) + shares);
  };

  const removeShares = (stakeholderId: string, shareClassId: string, shares: number) => {
    const key = holdingKey(stakeholderId, shareClassId);
    const current = holdings.get(key) || 0;
    holdings.set(key, Math.max(0, current - shares));
  };

  for (const tx of transactions) {
    // Only include transactions on or before the target date
    if (tx.transaction_date > asOfDate) continue;

    switch (tx.transaction_type) {
      case 'GRANT':
      case 'PURCHASE':
        if (tx.to_stakeholder_id) {
          addShares(tx.to_stakeholder_id, tx.share_class_id, tx.shares_affected);
        }
        break;

      case 'TRANSFER':
        if (tx.from_stakeholder_id) {
          removeShares(tx.from_stakeholder_id, tx.share_class_id, tx.shares_affected);
        }
        if (tx.to_stakeholder_id) {
          addShares(tx.to_stakeholder_id, tx.share_class_id, tx.shares_affected);
        }
        break;

      case 'CANCELLATION':
        if (tx.from_stakeholder_id) {
          removeShares(tx.from_stakeholder_id, tx.share_class_id, tx.shares_affected);
        }
        break;
    }
  }

  return { holdings };
}

// ============================================================================
// Share Availability Validation
// ============================================================================

/**
 * Calculate available shares for a share class.
 * available = authorized - issued - reserved
 */
export function calculateAvailableShares(
  authorizedShares: number,
  reservedShares: number,
  issuedShares: number
): number {
  return authorizedShares - issuedShares - reservedShares;
}
