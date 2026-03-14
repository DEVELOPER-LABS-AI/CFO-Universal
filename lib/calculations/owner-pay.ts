/**
 * Owner Pay Calculations (server-only — uses Prisma)
 *
 * Computes expected vs actual monthly owner compensation using Mercury
 * transaction data linked via MerchantMappingCache.staff_id.
 *
 * Pure utility functions (computeExpectedAmount, getPaymentStatus) are
 * in owner-pay-utils.ts so client components can import them safely.
 */

import 'server-only';
import { prisma } from '@/lib/prisma';

// Re-export pure functions so existing server-side imports keep working
export { computeExpectedAmount, getPaymentStatus } from './owner-pay-utils';

/**
 * Build the OR conditions for matching owner transactions.
 * Shared by getOwnerMercuryActual and getOwnerTransactions.
 */
async function buildOwnerMatchConditions(
  staffId: string,
  organizationId: string
): Promise<Record<string, unknown>[]> {
  const orConditions: Record<string, unknown>[] = [];

  // Condition 1: ExpenseRecords directly tagged with this staff_id
  orConditions.push({ staff_id: staffId });

  // Condition 2: ExpenseRecords matching merchant names mapped to this owner
  const connection = await prisma.mercuryConnection.findUnique({
    where: { organization_id: organizationId },
    select: { id: true },
  });

  if (connection) {
    const mappings = await prisma.merchantMappingCache.findMany({
      where: { connection_id: connection.id, staff_id: staffId },
      select: { mercury_merchant_name: true },
    });

    if (mappings.length > 0) {
      const merchantNames = mappings.map((m) => m.mercury_merchant_name);
      orConditions.push({ merchant_name: { in: merchantNames } });
    }
  }

  return orConditions;
}

/**
 * Get actual Mercury payments for an owner in a given month.
 * Sums ExpenseRecord amounts where the merchant is mapped to this staff member
 * OR the record has staff_id set directly.
 */
export async function getOwnerMercuryActual(
  staffId: string,
  month: number,
  year: number,
  organizationId: string
): Promise<number> {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  const orConditions = await buildOwnerMatchConditions(staffId, organizationId);

  const result = await prisma.expenseRecord.aggregate({
    where: {
      organization_id: organizationId,
      is_credit: false,
      transaction_date: { gte: startDate, lt: endDate },
      OR: orConditions,
    },
    _sum: { amount: true },
  });

  return Math.abs(Number(result._sum.amount ?? 0));
}

/**
 * Get individual transactions for an owner in a given month.
 * Returns the breakdown of withdrawals that sum to the actual amount.
 */
export async function getOwnerTransactions(
  staffId: string,
  month: number,
  year: number,
  organizationId: string
): Promise<
  Array<{
    id: string;
    transaction_date: Date;
    merchant_name: string | null;
    amount: number;
    description: string | null;
  }>
> {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  const orConditions = await buildOwnerMatchConditions(staffId, organizationId);

  const records = await prisma.expenseRecord.findMany({
    where: {
      organization_id: organizationId,
      is_credit: false,
      transaction_date: { gte: startDate, lt: endDate },
      OR: orConditions,
    },
    select: {
      id: true,
      transaction_date: true,
      merchant_name: true,
      amount: true,
      description: true,
    },
    orderBy: { transaction_date: 'desc' },
  });

  return records.map((r) => ({
    id: r.id,
    transaction_date: r.transaction_date,
    merchant_name: r.merchant_name,
    amount: Math.abs(Number(r.amount)),
    description: r.description,
  }));
}

/**
 * Compute cumulative deferred compensation for an owner up to and including a given month.
 * Sums all shortfalls from the earliest record through (year, month).
 */
export async function computeCumulativeDeferred(
  staffId: string,
  month: number,
  year: number
): Promise<number> {
  const records = await prisma.ownerMonthlyPay.findMany({
    where: { staff_id: staffId },
    select: { month: true, year: true, shortfall: true },
    orderBy: [{ year: 'asc' }, { month: 'asc' }],
  });

  let cumulative = 0;
  for (const record of records) {
    if (record.year < year || (record.year === year && record.month <= month)) {
      cumulative += Number(record.shortfall);
    }
  }
  return cumulative;
}
