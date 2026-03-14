'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, TrendingUp, TrendingDown, Users, BarChart3 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/currency';

interface KPIData {
  revenue: { value: number; change: number };
  profit: { value: number; change: number };
  margin: { value: number; change: number };
  activeClients: { value: number; change: number };
}

interface KPISummaryCardsProps {
  kpis: KPIData;
}

function TrendBadge({ change, suffix = '%' }: { change: number; suffix?: string }) {
  const isPositive = change > 0;
  const isZero = change === 0;

  if (isZero) {
    return <span className="text-xs text-muted-foreground">No change</span>;
  }

  return (
    <span className={`flex items-center gap-0.5 text-xs font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
      {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {isPositive ? '+' : ''}{change.toFixed(1)}{suffix}
      <span className="text-muted-foreground font-normal ml-1">vs last month</span>
    </span>
  );
}

export function KPISummaryCards({ kpis }: KPISummaryCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(kpis.revenue.value)}</div>
          <TrendBadge change={kpis.revenue.change} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Monthly Profit</CardTitle>
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(kpis.profit.value)}</div>
          <TrendBadge change={kpis.profit.change} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg Margin</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{kpis.margin.value.toFixed(1)}%</div>
          <TrendBadge change={kpis.margin.change} suffix="pp" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Clients</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{kpis.activeClients.value}</div>
          {kpis.activeClients.change !== 0 ? (
            <span className={`flex items-center gap-0.5 text-xs font-medium ${kpis.activeClients.change > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {kpis.activeClients.change > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {kpis.activeClients.change > 0 ? '+' : ''}{kpis.activeClients.change}
              <span className="text-muted-foreground font-normal ml-1">vs last month</span>
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">No change</span>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
