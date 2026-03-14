'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { RefreshCw, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { getCfoReports } from '@/app/actions/cfo-strategist';
import { formatCurrency } from '@/lib/utils/currency';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils/error';

/** Report type badge styling. */
const TYPE_STYLES: Record<string, string> = {
  DAILY: 'bg-blue-100 text-blue-700 hover:bg-blue-100',
  WEEKLY: 'bg-violet-100 text-violet-700 hover:bg-violet-100',
  MONTHLY: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100',
};

type Report = Awaited<ReturnType<typeof getCfoReports>>[number];

export default function ReportsPage() {
  const [data, setData] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const reportType =
        typeFilter !== 'all'
          ? (typeFilter as 'DAILY' | 'WEEKLY' | 'MONTHLY')
          : undefined;
      const result = await getCfoReports(reportType);
      setData(result);
    } catch (error: unknown) {
      console.error('Failed to fetch reports:', error);
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [typeFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /** Formats a date range string for display. */
  function formatDateRange(start: Date | string, end: Date | string): string {
    const s = new Date(start);
    const e = new Date(end);
    const opts: Intl.DateTimeFormatOptions = {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    };
    if (s.toDateString() === e.toDateString()) {
      return s.toLocaleDateString(undefined, opts);
    }
    return `${s.toLocaleDateString(undefined, opts)} - ${e.toLocaleDateString(undefined, opts)}`;
  }

  if (loading && data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/strategist">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">
            Historical financial reports and analysis
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-4">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Report Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="DAILY">Daily</SelectItem>
            <SelectItem value="WEEKLY">Weekly</SelectItem>
            <SelectItem value="MONTHLY">Monthly</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {data.length} report{data.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Reports Table */}
      {data.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center h-32">
            <p className="text-muted-foreground">
              No reports match your filters
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date Range</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">
                    Potential Savings
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((report) => (
                  <TableRow key={report.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell>
                      <Link
                        href={`/dashboard/strategist/reports/${report.id}`}
                        className="font-medium hover:underline"
                      >
                        {formatDateRange(report.periodStart, report.periodEnd)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          TYPE_STYLES[report.reportType] ??
                          'bg-gray-100 text-gray-700'
                        }
                      >
                        {report.reportType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {report.marginActual.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(report.totalRevenue)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(report.totalPotentialSavings)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
