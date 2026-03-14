'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatCurrencyCompact } from '@/lib/utils/currency';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface CostSnapshotData {
  period_month: number;
  period_year: number;
  subscription_costs: number;
  staff_costs: number;
  contractor_costs: number;
  other_costs: number;
  total_costs: number;
  revenue: number;
}

interface CostTrendChartProps {
  snapshots: CostSnapshotData[];
}

const monthNames = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const COLORS = {
  subscriptions: '#3b82f6',
  staff: '#8b5cf6',
  contractors: '#f59e0b',
  other: '#6b7280',
  revenue: '#10b981',
} as const;

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    dataKey: string;
    value: number;
    color: string;
    name: string;
  }>;
  label?: string;
}

/**
 * Custom tooltip component that displays each cost category and revenue
 * formatted as currency values.
 */
function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border bg-background p-3 shadow-md">
      <p className="mb-2 font-medium">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 text-sm">
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{ backgroundColor: entry.color }}
          />
          <span className="capitalize">{entry.name}:</span>
          <span className="font-medium">{formatCurrency(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Displays a stacked bar chart of monthly costs by category (subscriptions,
 * staff, contractors, other) with a revenue line overlay using Recharts
 * ComposedChart inside a shadcn Card.
 */
export function CostTrendChart({ snapshots }: CostTrendChartProps) {
  const hasData =
    snapshots &&
    snapshots.length > 0 &&
    snapshots.some(
      (s) =>
        s.subscription_costs > 0 ||
        s.staff_costs > 0 ||
        s.contractor_costs > 0 ||
        s.other_costs > 0 ||
        s.revenue > 0
    );

  const chartData = snapshots
    ? [...snapshots]
        .sort((a, b) => {
          if (a.period_year !== b.period_year) {
            return a.period_year - b.period_year;
          }
          return a.period_month - b.period_month;
        })
        .map((s) => ({
          label: `${monthNames[s.period_month - 1]} ${s.period_year}`,
          subscriptions: s.subscription_costs,
          staff: s.staff_costs,
          contractors: s.contractor_costs,
          other: s.other_costs,
          revenue: s.revenue,
        }))
    : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cost Trend</CardTitle>
        <CardDescription>Monthly costs by category and revenue</CardDescription>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="flex h-[350px] items-center justify-center text-muted-foreground">
            No cost data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={350}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis width={80} tickFormatter={(value: number) => formatCurrencyCompact(value)} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar
                dataKey="subscriptions"
                name="Subscriptions"
                stackId="costs"
                fill={COLORS.subscriptions}
              />
              <Bar
                dataKey="staff"
                name="Staff"
                stackId="costs"
                fill={COLORS.staff}
              />
              <Bar
                dataKey="contractors"
                name="Contractors"
                stackId="costs"
                fill={COLORS.contractors}
              />
              <Bar
                dataKey="other"
                name="Other"
                stackId="costs"
                fill={COLORS.other}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                name="Revenue"
                stroke={COLORS.revenue}
                strokeWidth={2}
                dot
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
