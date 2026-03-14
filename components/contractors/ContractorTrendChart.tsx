'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, Sparkles } from 'lucide-react';
import type { TrendResult, PeriodTotal } from '@/lib/calculations/trend-reporter';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ContractorTrendChartProps {
  contractorName: string;
  history: PeriodTotal[];
  trend: TrendResult;
  currentPeriod: PeriodTotal;
  priorPeriod: PeriodTotal | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatCurrency(value: number): string {
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}k`;
  }
  return `$${value.toFixed(2)}`;
}

function TrendBadge({ trend }: { trend: TrendResult }) {
  if (trend.direction === 'NEW') {
    return (
      <Badge className="gap-1 bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-50">
        <Sparkles className="h-3 w-3" />
        New
      </Badge>
    );
  }

  if (trend.direction === 'FLAT') {
    return (
      <Badge className="gap-1 bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-50">
        <Minus className="h-3 w-3" />
        Flat
      </Badge>
    );
  }

  if (trend.direction === 'UP') {
    return (
      <Badge className="gap-1 bg-red-50 text-red-700 border-red-200 hover:bg-red-50">
        <TrendingUp className="h-3 w-3" />
        +{trend.percentageChange.toFixed(1)}%
      </Badge>
    );
  }

  return (
    <Badge className="gap-1 bg-green-50 text-green-700 border-green-200 hover:bg-green-50">
      <TrendingDown className="h-3 w-3" />
      {trend.percentageChange.toFixed(1)}%
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Bar chart (Tailwind-only, no library dependency)
// ---------------------------------------------------------------------------

function BarChart({ history }: { history: PeriodTotal[] }) {
  const maxTotal = Math.max(...history.map((p) => p.total), 1);

  return (
    <div className="flex items-end gap-2 h-32 mt-4">
      {history.map((period, idx) => {
        const heightPct = (period.total / maxTotal) * 100;
        const isLast = idx === history.length - 1;

        return (
          <div key={`${period.year}-${period.month}`} className="flex flex-col items-center flex-1 gap-1">
            <span className="text-xs text-muted-foreground truncate w-full text-center">
              {formatCurrency(period.total)}
            </span>
            <div className="w-full flex flex-col justify-end" style={{ height: '80px' }}>
              <div
                className={`w-full rounded-t transition-all ${
                  isLast ? 'bg-orange-500' : 'bg-orange-200'
                }`}
                style={{ height: `${Math.max(heightPct, 2)}%` }}
                title={`${MONTH_NAMES[period.month - 1]} ${period.year}: $${period.total.toFixed(2)}`}
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {MONTH_NAMES[period.month - 1]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ContractorTrendChart({
  contractorName,
  history,
  trend,
  currentPeriod,
  priorPeriod,
}: ContractorTrendChartProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{contractorName} — Expense Trend</CardTitle>
          <TrendBadge trend={trend} />
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary row */}
        <div className="grid grid-cols-2 gap-4 mb-2">
          <div>
            <p className="text-xs text-muted-foreground">
              {MONTH_NAMES[currentPeriod.month - 1]} {currentPeriod.year}
            </p>
            <p className="text-2xl font-bold">${currentPeriod.total.toFixed(2)}</p>
          </div>
          {priorPeriod && (
            <div>
              <p className="text-xs text-muted-foreground">
                vs {MONTH_NAMES[priorPeriod.month - 1]} {priorPeriod.year}
              </p>
              <p className="text-sm text-muted-foreground">
                {trend.absoluteChange >= 0 ? '+' : ''}
                ${trend.absoluteChange.toFixed(2)}
              </p>
            </div>
          )}
        </div>

        {/* Bar chart */}
        {history.length > 0 ? (
          <BarChart history={history} />
        ) : (
          <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">
            No expense data for this period
          </div>
        )}
      </CardContent>
    </Card>
  );
}
