/**
 * Pure owner pay utility functions (client-safe, no Prisma dependency).
 *
 * These functions were extracted from owner-pay.ts so they can be imported
 * in 'use client' components without pulling in PrismaClient.
 */

import { toMonthlyCost } from '@/lib/utils/currency';

/**
 * Compute expected monthly amount from staff rate, normalized to monthly.
 * If compensationStartDate is provided, returns 0 for months before the
 * start month and the full monthly amount for the start month onward.
 */
export function computeExpectedAmount(
  rate: number,
  rateType: string,
  month?: number,
  year?: number,
  compensationStartDate?: Date | null
): number {
  const fullMonthly = toMonthlyCost(rate, rateType);

  // If no start date or no month/year context, return full amount
  if (!compensationStartDate || !month || !year) {
    return fullMonthly;
  }

  const startYear = compensationStartDate.getFullYear();
  const startMonth = compensationStartDate.getMonth() + 1; // 1-indexed

  // Target month is before start month → no expected pay
  if (year < startYear || (year === startYear && month < startMonth)) {
    return 0;
  }

  // Start month or later → full amount
  return fullMonthly;
}

/**
 * Determine payment status for an owner in a given month.
 *
 * @returns 'paid' | 'upcoming' | 'overdue' | 'n/a'
 */
export function getPaymentStatus(
  payDay: number | null,
  actualAmount: number,
  expectedAmount: number,
  month: number,
  year: number
): 'paid' | 'upcoming' | 'overdue' | 'n/a' {
  // No expected pay (before start date or $0 rate)
  if (expectedAmount <= 0) return 'n/a';

  // Fully paid or overpaid
  if (actualAmount >= expectedAmount) return 'paid';

  // No pay day set — can't determine if overdue vs upcoming
  if (!payDay) {
    return actualAmount > 0 ? 'upcoming' : 'upcoming';
  }

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // Past months are always overdue if not fully paid
  if (year < currentYear || (year === currentYear && month < currentMonth)) {
    return 'overdue';
  }

  // Future months
  if (year > currentYear || (year === currentYear && month > currentMonth)) {
    return 'upcoming';
  }

  // Current month — check if past pay day
  const today = now.getDate();
  if (today >= payDay) {
    return 'overdue';
  }

  return 'upcoming';
}
