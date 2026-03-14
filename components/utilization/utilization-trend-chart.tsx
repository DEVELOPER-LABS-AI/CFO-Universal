'use client';

/**
 * Utilization Trend Chart Component
 * Displays historical utilization rate over time as a line chart
 * with target threshold reference lines.
 */

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface HistoryEntry {
  /** Period start date (ISO string) */
  period_start: string;
  /** Utilization rate as a percentage (0-100) */
  utilization_rate: number;
  /** Billable hours in the period */
  billable_hours: number;
  /** Bench hours in the period */
  bench_hours: number;
  /** Data source used for this period */
  data_source: string;
}

interface UtilizationTrendChartProps {
  /** Historical utilization snapshots */
  history: HistoryEntry[];
  /** Target utilization rate percentage */
  targetRate: number;
  /** Warning threshold percentage */
  warningThreshold: number;
  /** Critical threshold percentage */
  criticalThreshold: number;
}

/**
 * Format a period label for the x-axis.
 */
function formatPeriodLabel(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

/**
 * Custom tooltip for the trend chart.
 */
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  const entry = payload[0]?.payload;
  if (!entry) return null;

  return (
    <div className="bg-white border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium mb-1">{label}</p>
      <p className="text-blue-600">
        Utilization: {entry.utilization_rate.toFixed(1)}%
      </p>
      <p className="text-green-600">
        Billable: {entry.billable_hours.toFixed(1)}h
      </p>
      <p className="text-gray-500">
        Bench: {entry.bench_hours.toFixed(1)}h
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        Source: {entry.data_source}
      </p>
    </div>
  );
}

export function UtilizationTrendChart({
  history,
  targetRate,
  warningThreshold,
  criticalThreshold,
}: UtilizationTrendChartProps) {
  const chartData = history.map((h) => ({
    ...h,
    label: formatPeriodLabel(h.period_start),
  }));

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Utilization Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
            No historical utilization data available yet.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Utilization Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 12 }}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <ReferenceLine
              y={targetRate}
              stroke="#22c55e"
              strokeDasharray="6 3"
              label={{ value: 'Target', position: 'right', fontSize: 11, fill: '#22c55e' }}
            />
            <ReferenceLine
              y={warningThreshold}
              stroke="#eab308"
              strokeDasharray="4 4"
              label={{ value: 'Warning', position: 'right', fontSize: 11, fill: '#eab308' }}
            />
            <ReferenceLine
              y={criticalThreshold}
              stroke="#ef4444"
              strokeDasharray="4 4"
              label={{ value: 'Critical', position: 'right', fontSize: 11, fill: '#ef4444' }}
            />
            <Line
              type="monotone"
              dataKey="utilization_rate"
              name="Utilization %"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ fill: '#3b82f6', r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
