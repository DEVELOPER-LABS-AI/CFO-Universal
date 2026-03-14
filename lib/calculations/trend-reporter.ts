/**
 * Trend Reporter (T033)
 *
 * Month-over-month cost trend aggregation for subscriptions and contractors.
 * Supports up to 24 months of history; default window is 3 months.
 */

import { prisma } from '@/lib/prisma';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TrendDirection = 'UP' | 'DOWN' | 'FLAT' | 'NEW';

export interface TrendResult {
  direction: TrendDirection;
  absoluteChange: number;
  percentageChange: number;
}

export interface PeriodTotal {
  month: number;
  year: number;
  total: number;
}

export interface TrendResponse {
  currentPeriod: PeriodTotal;
  priorPeriod: PeriodTotal | null;
  trend: TrendResult;
  history: PeriodTotal[];
}

// ---------------------------------------------------------------------------
// Core helpers
// ---------------------------------------------------------------------------

/**
 * Compute month-over-month trend between two period totals.
 *
 * @param currentTotal - Total for the most recent period
 * @param priorTotal   - Total for the prior period (null/0 → direction 'NEW')
 */
export function computeTrend(currentTotal: number, priorTotal: number): TrendResult {
  if (priorTotal === 0) {
    return { direction: 'NEW', absoluteChange: currentTotal, percentageChange: 0 };
  }

  const absoluteChange = currentTotal - priorTotal;
  const percentageChange = (absoluteChange / priorTotal) * 100;

  let direction: TrendDirection;
  if (Math.abs(percentageChange) < 0.01) {
    direction = 'FLAT';
  } else if (absoluteChange > 0) {
    direction = 'UP';
  } else {
    direction = 'DOWN';
  }

  return {
    direction,
    absoluteChange: Math.round(absoluteChange * 100) / 100,
    percentageChange: Math.round(percentageChange * 100) / 100,
  };
}

/**
 * Build an ordered array of { month, year } periods going back N months
 * from (and including) the given current period, oldest first.
 */
function buildPeriodWindow(
  currentMonth: number,
  currentYear: number,
  historyMonths: number
): Array<{ month: number; year: number }> {
  const periods: Array<{ month: number; year: number }> = [];

  for (let i = historyMonths - 1; i >= 0; i--) {
    let month = currentMonth - i;
    let year = currentYear;

    while (month <= 0) {
      month += 12;
      year -= 1;
    }

    periods.push({ month, year });
  }

  return periods;
}

// ---------------------------------------------------------------------------
// Subscription trend
// ---------------------------------------------------------------------------

/**
 * Aggregate subscription_transaction_records by period for a subscription
 * and compute MoM trend.
 *
 * @param subscriptionId - Subscription to aggregate
 * @param currentMonth   - Current period month (1–12)
 * @param currentYear    - Current period year
 * @param historyMonths  - Number of periods to include (default 3)
 */
export async function getSubscriptionTrend(
  subscriptionId: string,
  currentMonth: number,
  currentYear: number,
  historyMonths: number = 3
): Promise<TrendResponse> {
  const periods = buildPeriodWindow(currentMonth, currentYear, historyMonths);

  // Fetch aggregated totals for all periods in a single query
  const rows = await prisma.subscriptionTransactionRecord.groupBy({
    by: ['period_month', 'period_year'],
    where: {
      subscription_id: subscriptionId,
      OR: periods.map((p) => ({ period_month: p.month, period_year: p.year })),
    },
    _sum: { amount: true },
  });

  // Build a lookup map keyed by "YYYY-MM"
  const totalsMap = new Map<string, number>();
  for (const row of rows) {
    const key = `${row.period_year}-${String(row.period_month).padStart(2, '0')}`;
    totalsMap.set(key, Number(row._sum.amount || 0));
  }

  // Map each window period to a PeriodTotal
  const history: PeriodTotal[] = periods.map((p) => ({
    month: p.month,
    year: p.year,
    total: totalsMap.get(`${p.year}-${String(p.month).padStart(2, '0')}`) ?? 0,
  }));

  const currentPeriod = history[history.length - 1];
  const priorPeriod = history.length >= 2 ? history[history.length - 2] : null;

  const trend = computeTrend(
    currentPeriod.total,
    priorPeriod?.total ?? 0
  );

  return { currentPeriod, priorPeriod: priorPeriod ?? null, trend, history };
}

// ---------------------------------------------------------------------------
// Contractor trend
// ---------------------------------------------------------------------------

/**
 * Aggregate financial_expense_records by period for a contractor
 * and compute MoM trend.
 *
 * Uses transaction_date to derive period (month/year) since
 * financial_expense_records does not have period_month/period_year columns.
 *
 * @param contractorId  - Contractor to aggregate
 * @param currentMonth  - Current period month (1–12)
 * @param currentYear   - Current period year
 * @param historyMonths - Number of periods to include (default 3)
 */
export async function getContractorTrend(
  contractorId: string,
  currentMonth: number,
  currentYear: number,
  historyMonths: number = 3
): Promise<TrendResponse> {
  const periods = buildPeriodWindow(currentMonth, currentYear, historyMonths);

  // Build a date range spanning all requested periods
  const oldest = periods[0];
  const windowStart = new Date(oldest.year, oldest.month - 1, 1); // 1st of oldest month
  const windowEnd = new Date(currentYear, currentMonth, 1);       // 1st of month after current

  // Fetch all expense records for contractor within the date window
  const records = await prisma.expenseRecord.findMany({
    where: {
      contractor_id: contractorId,
      transaction_date: {
        gte: windowStart,
        lt: windowEnd,
      },
    },
    select: {
      amount: true,
      transaction_date: true,
    },
  });

  // Aggregate into period buckets
  const totalsMap = new Map<string, number>();
  for (const record of records) {
    const d = record.transaction_date;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    totalsMap.set(key, (totalsMap.get(key) ?? 0) + Number(record.amount));
  }

  const history: PeriodTotal[] = periods.map((p) => ({
    month: p.month,
    year: p.year,
    total: totalsMap.get(`${p.year}-${String(p.month).padStart(2, '0')}`) ?? 0,
  }));

  const currentPeriod = history[history.length - 1];
  const priorPeriod = history.length >= 2 ? history[history.length - 2] : null;

  const trend = computeTrend(
    currentPeriod.total,
    priorPeriod?.total ?? 0
  );

  return { currentPeriod, priorPeriod: priorPeriod ?? null, trend, history };
}
