'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils/currency';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

interface MarginDataPoint {
  /** Numeric month (1-12). */
  month: number;
  /** Four-digit year. */
  year: number;
  /** Display label (e.g. "Jan 2026"). */
  label: string;
  /** Margin percentage. */
  margin: number;
  /** Target margin percentage. */
  target: number;
  /** Total revenue for the month. */
  revenue: number;
  /** Total expenses for the month. */
  expenses: number;
}

interface MarginTrendChartProps {
  /** Array of monthly data points for the chart. */
  data: MarginDataPoint[];
}

/**
 * Custom tooltip that renders margin %, revenue, and expenses for the hovered
 * data point.
 */
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  const point = payload[0]?.payload as MarginDataPoint | undefined;
  if (!point) return null;

  return (
    <div className="bg-white border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium mb-1">{label}</p>
      <p className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#3b82f6' }} />
        <span className="text-muted-foreground">Margin:</span>
        <span className="font-medium">{point.margin.toFixed(1)}%</span>
      </p>
      <p className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#10b981' }} />
        <span className="text-muted-foreground">Revenue:</span>
        <span className="font-medium">{formatCurrency(point.revenue)}</span>
      </p>
      <p className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#ef4444' }} />
        <span className="text-muted-foreground">Expenses:</span>
        <span className="font-medium">{formatCurrency(point.expenses)}</span>
      </p>
    </div>
  );
}

/**
 * Renders a 6-month margin trend area chart with a dashed target reference
 * line. Falls back to an empty state message when no data is available.
 */
export function MarginTrendChart({ data }: MarginTrendChartProps) {
  const hasData = data.length > 0 && data.some((d) => d.margin > 0);
  const targetValue = data.length > 0 ? data[0].target : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Margin Trend</CardTitle>
        <CardDescription>Monthly margin percentage over the last 6 months</CardDescription>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorMargin" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis
                tick={{ fontSize: 12 }}
                domain={[0, 100]}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine
                y={targetValue}
                stroke="#ef4444"
                strokeDasharray="6 4"
                label={{
                  value: `Target ${targetValue}%`,
                  position: 'insideTopRight',
                  fontSize: 11,
                  fill: '#ef4444',
                }}
              />
              <Area
                type="monotone"
                dataKey="margin"
                name="Margin"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#colorMargin)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[350px] text-muted-foreground">
            No margin data available
          </div>
        )}
      </CardContent>
    </Card>
  );
}
