/**
 * Margin forecasting using linear regression on historical data.
 */

import { prisma } from '@/lib/prisma';

interface ForecastResult {
  projectedMargin: number;
  projectedRevenue: number;
  projectedExpenses: number;
  dataPointsUsed: number;
}

/**
 * Project next month's margin using linear regression on last 3-6 months
 * of CompanyMetrics data.
 *
 * Returns null if fewer than 2 months of data exist.
 */
export async function projectNextMonthMargin(
  organizationId: string
): Promise<ForecastResult | null> {
  const metrics = await prisma.companyMetrics.findMany({
    where: { organization_id: organizationId },
    orderBy: { period_start: 'desc' },
    take: 6,
    select: {
      period_start: true,
      portfolio_margin: true,
      total_revenue: true,
      total_expenses: true,
    },
  });

  if (metrics.length < 2) {
    return null;
  }

  // Reverse so index 0 is oldest
  const sorted = [...metrics].reverse();

  const margins = sorted.map((m) => Number(m.portfolio_margin));
  const revenues = sorted.map((m) => Number(m.total_revenue));
  const expenses = sorted.map((m) => Number(m.total_expenses));

  const projectedMargin = linearProjectNext(margins);
  const projectedRevenue = linearProjectNext(revenues);
  const projectedExpenses = linearProjectNext(expenses);

  return {
    projectedMargin: clamp(projectedMargin, 0, 100),
    projectedRevenue: Math.max(projectedRevenue, 0),
    projectedExpenses: Math.max(projectedExpenses, 0),
    dataPointsUsed: sorted.length,
  };
}

/**
 * Simple linear regression to project the next value in a series.
 * x = index (0, 1, 2, ...), y = values.
 * Projects value at x = n (one step beyond last data point).
 */
function linearProjectNext(values: number[]): number {
  const n = values.length;
  if (n === 0) return 0;
  if (n === 1) return values[0];

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumXX += i * i;
  }

  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return values[n - 1];

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  return slope * n + intercept;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
