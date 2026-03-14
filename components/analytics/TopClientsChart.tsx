'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils/currency';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface ClientMarginData {
  name: string;
  margin: number;
  revenue: number;
  profit: number;
}

interface TopClientsChartProps {
  data: ClientMarginData[];
}

function getBarColor(margin: number): string {
  if (margin >= 30) return '#10b981';
  if (margin >= 10) return '#f59e0b';
  return '#ef4444';
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;

  return (
    <div className="bg-white border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium mb-1">{data.name}</p>
      <p className="text-muted-foreground">
        Margin: <span className="font-medium">{data.margin.toFixed(1)}%</span>
      </p>
      <p className="text-muted-foreground">
        Revenue: <span className="font-medium">{formatCurrency(data.revenue)}</span>
      </p>
      <p className="text-muted-foreground">
        Profit: <span className="font-medium">{formatCurrency(data.profit)}</span>
      </p>
    </div>
  );
}

export function TopClientsChart({ data }: TopClientsChartProps) {
  const hasData = data.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Clients by Margin</CardTitle>
        <CardDescription>Current month - clients with revenue, ranked by margin %</CardDescription>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `${value}%`}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11 }}
                width={120}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="margin" name="Margin %" radius={[0, 4, 4, 0]} maxBarSize={24}>
                {data.map((entry) => (
                  <Cell key={entry.name} fill={getBarColor(entry.margin)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            No client margin data available for the current month.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
