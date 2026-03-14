'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/ui/empty-state';
import { Users, TrendingUp, TrendingDown } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/currency';

// T145: BDRPerformanceTable component showing ROI metrics and meetings attended

interface BDRPerformanceData {
  id: string;
  bdr_id: string;
  month: number;
  year: number;
  revenue_attributed: any;
  bdr_cost: any;
  profit: any;
  roi_percentage: any;
  margin_percentage: any;
  meetings_attended_total: number;
  calculated_at: Date;
  bdr: {
    id: string;
    name: string;
    staff_type: string;
  };
}

interface BDRPerformanceTableProps {
  bdrs: BDRPerformanceData[];
  summary?: {
    totalBDRs: number;
    totalRevenueAttributed: number;
    totalBDRCosts: number;
    totalProfit: number;
    avgROI: number;
    avgMargin: number;
    totalMeetingsAttended: number;
  };
}

function formatPercentage(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function getROIBadgeVariant(roi: number): 'default' | 'secondary' | 'destructive' {
  if (roi >= 100) return 'default'; // Green for positive ROI
  if (roi >= 0) return 'secondary'; // Gray for break-even
  return 'destructive'; // Red for negative ROI
}

function getMarginBadgeVariant(margin: number): 'default' | 'secondary' | 'destructive' {
  if (margin >= 50) return 'default'; // Green for healthy margin
  if (margin >= 20) return 'secondary'; // Gray for acceptable margin
  return 'destructive'; // Red for low/negative margin
}

export function BDRPerformanceTable({ bdrs, summary }: BDRPerformanceTableProps) {
  if (bdrs.length === 0) {
    return (
      <EmptyState
        icon={<Users className="h-12 w-12" />}
        title="No BDR performance data found"
        description="Refresh BDR ROI calculations to see performance metrics."
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Statistics */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
          <div>
            <p className="text-xs text-muted-foreground">Total BDRs</p>
            <p className="text-2xl font-bold">{summary.totalBDRs}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Revenue Attributed</p>
            <p className="text-2xl font-bold">{formatCurrency(summary.totalRevenueAttributed)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total BDR Costs</p>
            <p className="text-2xl font-bold">{formatCurrency(summary.totalBDRCosts)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Profit</p>
            <p className={`text-2xl font-bold ${summary.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(summary.totalProfit)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Avg ROI</p>
            <p className="text-2xl font-bold">{formatPercentage(summary.avgROI)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Avg Margin</p>
            <p className="text-2xl font-bold">{formatPercentage(summary.avgMargin)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Meetings</p>
            <p className="text-2xl font-bold">{summary.totalMeetingsAttended}</p>
          </div>
        </div>
      )}

      {/* BDR Performance Table */}
      <div className="hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>BDR Name</TableHead>
              <TableHead>Period</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">Profit</TableHead>
              <TableHead>ROI %</TableHead>
              <TableHead>Margin %</TableHead>
              <TableHead className="text-right">Meetings</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bdrs.map((bdr) => {
              const roi = Number(bdr.roi_percentage);
              const margin = Number(bdr.margin_percentage);
              const profit = Number(bdr.profit);
              const revenue = Number(bdr.revenue_attributed);
              const cost = Number(bdr.bdr_cost);

              return (
                <TableRow key={bdr.id}>
                  <TableCell>
                    <Link
                      href={`/dashboard/staff/${bdr.bdr_id}`}
                      className="hover:underline font-medium"
                    >
                      {bdr.bdr.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {bdr.month}/{bdr.year}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(revenue)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatCurrency(cost)}
                  </TableCell>
                  <TableCell className={`text-right font-semibold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(profit)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getROIBadgeVariant(roi)} className="font-mono">
                      {formatPercentage(roi)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getMarginBadgeVariant(margin)} className="font-mono">
                      {formatPercentage(margin)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <span className="font-medium">{bdr.meetings_attended_total}</span>
                      {bdr.meetings_attended_total > 0 && (
                        <TrendingUp className="h-3 w-3 text-green-600" />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Mobile View */}
      <div className="sm:hidden space-y-4">
        {bdrs.map((bdr) => {
          const roi = Number(bdr.roi_percentage);
          const margin = Number(bdr.margin_percentage);
          const profit = Number(bdr.profit);
          const revenue = Number(bdr.revenue_attributed);
          const cost = Number(bdr.bdr_cost);

          return (
            <div key={bdr.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <Link
                    href={`/dashboard/staff/${bdr.bdr_id}`}
                    className="hover:underline font-medium"
                  >
                    {bdr.bdr.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {bdr.month}/{bdr.year}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge variant={getROIBadgeVariant(roi)} className="font-mono text-xs">
                    {formatPercentage(roi)}
                  </Badge>
                  <Badge variant={getMarginBadgeVariant(margin)} className="font-mono text-xs">
                    {formatPercentage(margin)}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Revenue</p>
                  <p className="font-semibold">{formatCurrency(revenue)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Cost</p>
                  <p className="text-muted-foreground">{formatCurrency(cost)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Profit</p>
                  <p className={`font-semibold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(profit)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Meetings</p>
                  <p className="font-semibold">{bdr.meetings_attended_total}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
