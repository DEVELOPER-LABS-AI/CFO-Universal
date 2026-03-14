'use client';

/**
 * T036: Bench Cost Trend Chart Component
 *
 * Displays bench cost over time as an area chart with bench headcount
 * as a secondary line. Uses Recharts AreaChart.
 */

import {
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/** Shape of a single data point for the bench cost trend chart. */
interface BenchCostTrendDataPoint {
  /** Period start date (ISO string) */
  period_start: string;
  /** Total bench cost in dollars for this period */
  bench_cost: number;
  /** Number of staff on bench in this period */
  bench_headcount: number;
}

interface BenchCostTrendChartProps {
  /** Historical bench cost data points */
  data: BenchCostTrendDataPoint[];
}

/**
 * Format a period label for the x-axis from an ISO date string.
 *
 * @param dateStr - ISO date string
 * @returns Short month + 2-digit year label (e.g., "Jan '25")
 */
function formatPeriodLabel(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

/**
 * Format a currency value for axis labels.
 *
 * @param value - Dollar amount
 * @returns Formatted currency string (e.g., "$12K", "$1.5M")
 */
function formatCurrencyAxis(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

/**
 * Custom tooltip for the bench cost trend chart.
 */
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;

  const entry = payload[0]?.payload;
  if (!entry) return null;

  return (
    <div className="bg-white border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium mb-1">
        {formatPeriodLabel(entry.period_start)}
      </p>
      <p className="text-red-600">
        Bench Cost: ${entry.bench_cost.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </p>
      <p className="text-blue-600">
        Bench Headcount: {entry.bench_headcount}
      </p>
    </div>
  );
}

/**
 * BenchCostTrendChart renders a Recharts AreaChart showing bench cost over
 * time with bench headcount as a secondary line overlay.
 */
export function BenchCostTrendChart({ data }: BenchCostTrendChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    label: formatPeriodLabel(d.period_start),
  }));

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Bench Cost Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
            No historical bench cost data available yet.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Bench Cost Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis
              yAxisId="cost"
              tick={{ fontSize: 12 }}
              tickFormatter={formatCurrencyAxis}
            />
            <YAxis
              yAxisId="headcount"
              orientation="right"
              tick={{ fontSize: 12 }}
              allowDecimals={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Area
              yAxisId="cost"
              type="monotone"
              dataKey="bench_cost"
              name="Bench Cost"
              stroke="#ef4444"
              fill="#fecaca"
              strokeWidth={2}
              dot={{ fill: '#ef4444', r: 3 }}
            />
            <Line
              yAxisId="headcount"
              type="monotone"
              dataKey="bench_headcount"
              name="Bench Headcount"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ fill: '#3b82f6', r: 3 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
