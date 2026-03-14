'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, DollarSign, Users, Target, Percent } from 'lucide-react';
import { formatCurrency, formatCurrencyCompact } from '@/lib/utils/currency';

// T134: PortfolioSummaryCards component showing 6 summary metrics

interface PortfolioSummary {
  totalClients: number;
  totalRevenue: number;
  totalCosts: number;
  totalProfit: number;
  avgMargin: number;
  avgROI: number;
}

interface PortfolioSummaryCardsProps {
  summary: PortfolioSummary;
  compact?: boolean;
}

function formatPercentage(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

export function PortfolioSummaryCards({ summary, compact = false }: PortfolioSummaryCardsProps) {
  const currencyFormatter = compact ? formatCurrencyCompact : formatCurrency;

  const cards = [
    {
      title: 'Total Clients',
      value: summary.totalClients.toString(),
      icon: Users,
      description: 'Active client accounts',
      trend: null,
    },
    {
      title: 'Total Revenue',
      value: currencyFormatter(summary.totalRevenue),
      icon: DollarSign,
      description: 'Across all clients',
      trend: summary.totalRevenue >= 0 ? 'up' : 'down',
      trendColor: summary.totalRevenue >= 0 ? 'text-green-600' : 'text-red-600',
    },
    {
      title: 'Total Costs',
      value: currencyFormatter(summary.totalCosts),
      icon: Target,
      description: 'All attributed costs',
      trend: null,
    },
    {
      title: 'Total Profit',
      value: currencyFormatter(summary.totalProfit),
      icon: summary.totalProfit >= 0 ? TrendingUp : TrendingDown,
      description: 'Revenue minus costs',
      trend: summary.totalProfit >= 0 ? 'up' : 'down',
      trendColor: summary.totalProfit >= 0 ? 'text-green-600' : 'text-red-600',
    },
    {
      title: 'Average ROI',
      value: formatPercentage(summary.avgROI),
      icon: Percent,
      description: 'Investment efficiency',
      trend: summary.avgROI >= 0 ? 'up' : 'down',
      trendColor: summary.avgROI >= 100 ? 'text-green-600' : summary.avgROI >= 0 ? 'text-yellow-600' : 'text-red-600',
    },
    {
      title: 'Average Margin',
      value: formatPercentage(summary.avgMargin),
      icon: Percent,
      description: 'Pricing health',
      trend: summary.avgMargin >= 0 ? 'up' : 'down',
      trendColor: summary.avgMargin >= 50 ? 'text-green-600' : summary.avgMargin >= 20 ? 'text-yellow-600' : 'text-red-600',
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {cards.map((card, index) => {
        const Icon = card.icon;

        return (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <Icon className={`h-4 w-4 ${card.trendColor || 'text-muted-foreground'}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${card.trendColor || ''}`}>
                {card.value}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
