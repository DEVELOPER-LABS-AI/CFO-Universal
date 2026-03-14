'use client';

/**
 * T024: Hours Breakdown Component
 * Displays a donut chart showing the breakdown of available hours
 * into billable, non-billable, and bench/idle categories.
 */

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface HoursBreakdownProps {
  /** Total available hours in the period */
  availableHours: number;
  /** Billable hours worked */
  billableHours: number;
  /** Non-billable hours worked (internal meetings, admin, etc.) */
  nonBillableHours: number;
  /** Bench/idle hours (available minus billable minus non-billable) */
  benchHours: number;
}

const COLORS = {
  billable: '#22c55e',     // green-500
  nonBillable: '#3b82f6',  // blue-500
  bench: '#9ca3af',        // gray-400
};

/**
 * Custom tooltip for the donut chart showing hours and percentage.
 */
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];

  return (
    <div className="bg-white border rounded-lg shadow-lg p-3 text-sm">
      <p className="flex items-center gap-2">
        <span
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: entry.payload.fill }}
        />
        <span className="font-medium">{entry.name}</span>
      </p>
      <p className="text-muted-foreground mt-1">
        {entry.value.toFixed(1)} hours
      </p>
    </div>
  );
}

export function HoursBreakdown({
  availableHours,
  billableHours,
  nonBillableHours,
  benchHours,
}: HoursBreakdownProps) {
  const data = [
    { name: 'Billable', value: billableHours, fill: COLORS.billable },
    { name: 'Non-billable', value: nonBillableHours, fill: COLORS.nonBillable },
    { name: 'Bench / Idle', value: benchHours, fill: COLORS.bench },
  ].filter((d) => d.value > 0);

  const hasData = data.length > 0 && availableHours > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Hours Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="45%"
                innerRadius={60}
                outerRadius={95}
                paddingAngle={2}
                dataKey="value"
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="bottom"
                formatter={(value: string) => {
                  const item = data.find((d) => d.name === value);
                  const pct =
                    item && availableHours > 0
                      ? ((item.value / availableHours) * 100).toFixed(0)
                      : '0';
                  return (
                    <span className="text-sm">
                      {value} ({pct}%)
                    </span>
                  );
                }}
              />
              <text
                x="50%"
                y="45%"
                textAnchor="middle"
                dominantBaseline="central"
              >
                <tspan x="50%" dy="-10" fontSize="12" fill="#6b7280">
                  Available
                </tspan>
                <tspan x="50%" dy="22" fontSize="16" fontWeight="bold" fill="#111827">
                  {availableHours.toFixed(0)}h
                </tspan>
              </text>
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
            No hours data available for this period.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
