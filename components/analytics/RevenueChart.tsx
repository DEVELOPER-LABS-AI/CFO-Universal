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
  Legend,
} from 'recharts';

interface TrendDataPoint {
  label: string;
  revenue: number;
  costs: number;
  profit: number;
}

interface RevenueChartProps {
  data: TrendDataPoint[];
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-white border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium">{formatCurrency(entry.value)}</span>
        </p>
      ))}
    </div>
  );
}

export function RevenueChart({ data }: RevenueChartProps) {
  const hasData = data.some((d) => d.revenue > 0 || d.costs > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue & Profit Trend</CardTitle>
        <CardDescription>Monthly revenue, costs, and profit over the last 6 months</CardDescription>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorCosts" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Area
                type="monotone"
                dataKey="revenue"
                name="Revenue"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#colorRevenue)"
              />
              <Area
                type="monotone"
                dataKey="costs"
                name="Costs"
                stroke="#ef4444"
                strokeWidth={2}
                fill="url(#colorCosts)"
              />
              <Area
                type="monotone"
                dataKey="profit"
                name="Profit"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="none"
                strokeDasharray="5 5"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[350px] text-muted-foreground">
            No revenue data available. Refresh ROI from the Portfolio page to populate.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
