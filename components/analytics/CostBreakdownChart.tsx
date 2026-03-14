'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils/currency';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface CostItem {
  name: string;
  value: number;
  color: string;
}

interface CostBreakdownChartProps {
  data: CostItem[];
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];

  return (
    <div className="bg-white border rounded-lg shadow-lg p-3 text-sm">
      <p className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.payload.color }} />
        <span className="font-medium">{entry.name}</span>
      </p>
      <p className="text-muted-foreground mt-1">{formatCurrency(entry.value)}</p>
    </div>
  );
}

export function CostBreakdownChart({ data }: CostBreakdownChartProps) {
  const totalValue = data.reduce((sum, item) => sum + item.value, 0);
  const hasData = data.length > 0 && totalValue > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cost Breakdown</CardTitle>
        <CardDescription>Current month expense distribution by category</CardDescription>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <ResponsiveContainer width="100%" height={350}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="45%"
                innerRadius={70}
                outerRadius={110}
                paddingAngle={2}
                dataKey="value"
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="bottom"
                formatter={(value: string) => {
                  const item = data.find((d) => d.name === value);
                  const pct = item ? ((item.value / totalValue) * 100).toFixed(0) : '0';
                  return <span className="text-sm">{value} ({pct}%)</span>;
                }}
              />
              {/* Use Customized to get actual computed center from Pie */}
              <text x="50%" y="45%" textAnchor="middle" dominantBaseline="central">
                <tspan x="50%" dy="-10" fontSize="13" fill="#6b7280">
                  Total
                </tspan>
                <tspan x="50%" dy="24" fontSize="18" fontWeight="bold" fill="#111827">
                  {formatCurrency(totalValue)}
                </tspan>
              </text>
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            No cost data available for the current month.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
