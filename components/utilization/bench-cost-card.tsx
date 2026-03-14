'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatCurrencyCompact } from '@/lib/utils/currency';

/**
 * Card displaying organization-wide bench cost metrics.
 * Shows total bench cost, bench headcount, and bench cost as percentage of payroll.
 */

interface BenchCostCardProps {
  /** Total monetary bench cost for the period. */
  totalBenchCost: number;
  /** Number of staff members with bench hours. */
  benchStaffCount: number;
  /** Total number of active staff. */
  activeStaffCount: number;
  /** Total bench hours for the period. */
  totalBenchHours: number;
  /** Total available hours (used to estimate payroll share). */
  totalAvailableHours: number;
}

export function BenchCostCard({
  totalBenchCost,
  benchStaffCount,
  activeStaffCount,
  totalBenchHours,
  totalAvailableHours,
}: BenchCostCardProps) {
  const benchPercentage = totalAvailableHours > 0
    ? Math.round((totalBenchHours / totalAvailableHours) * 100)
    : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Bench Cost
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Primary metric: total bench cost */}
        <div>
          <p className="text-3xl font-bold tabular-nums">
            {totalBenchCost >= 10000
              ? formatCurrencyCompact(totalBenchCost)
              : formatCurrency(totalBenchCost)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Monthly idle cost
          </p>
        </div>

        {/* Secondary metrics */}
        <div className="grid grid-cols-2 gap-4 pt-2 border-t">
          <div>
            <p className="text-lg font-semibold tabular-nums">
              {benchStaffCount}
              <span className="text-sm font-normal text-muted-foreground">
                {' '}/ {activeStaffCount}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              Staff on bench
            </p>
          </div>
          <div>
            <p className="text-lg font-semibold tabular-nums">
              {benchPercentage}%
            </p>
            <p className="text-xs text-muted-foreground">
              Idle capacity
            </p>
          </div>
        </div>

        {/* Bench hours detail */}
        <div className="pt-2 border-t">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground tabular-nums">
              {totalBenchHours.toLocaleString('en-US', { maximumFractionDigits: 1 })}
            </span>
            {' '}bench hours this period
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
