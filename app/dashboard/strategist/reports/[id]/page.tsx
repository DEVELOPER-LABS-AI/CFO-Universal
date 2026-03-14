'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { getCfoReportDetail } from '@/app/actions/cfo-strategist';
import { ReportRenderer } from '@/components/cfo-strategist/ReportRenderer';
import { formatCurrency } from '@/lib/utils/currency';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils/error';

/** Report type badge styling. */
const TYPE_STYLES: Record<string, string> = {
  DAILY: 'bg-blue-100 text-blue-700 hover:bg-blue-100',
  WEEKLY: 'bg-violet-100 text-violet-700 hover:bg-violet-100',
  MONTHLY: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100',
};

type ReportDetail = Awaited<ReturnType<typeof getCfoReportDetail>>;

export default function ReportDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<ReportDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchReport() {
      setLoading(true);
      try {
        const result = await getCfoReportDetail(params.id);
        setData(result);
      } catch (error: unknown) {
        console.error('Failed to fetch report:', error);
        toast.error(getErrorMessage(error));
      } finally {
        setLoading(false);
      }
    }
    fetchReport();
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-muted-foreground">Report not found</p>
        <Link href="/dashboard/strategist/reports">
          <Button variant="outline">Back to Reports</Button>
        </Link>
      </div>
    );
  }

  /** Formats a date range for the header. */
  function formatDateRange(start: Date | string, end: Date | string): string {
    const s = new Date(start);
    const e = new Date(end);
    const opts: Intl.DateTimeFormatOptions = {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    };
    if (s.toDateString() === e.toDateString()) {
      return s.toLocaleDateString(undefined, opts);
    }
    return `${s.toLocaleDateString(undefined, opts)} - ${e.toLocaleDateString(undefined, opts)}`;
  }

  return (
    <div className="space-y-6 p-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          href="/dashboard/strategist"
          className="hover:text-foreground transition-colors"
        >
          CFO Strategist
        </Link>
        <span>/</span>
        <Link
          href="/dashboard/strategist/reports"
          className="hover:text-foreground transition-colors"
        >
          Reports
        </Link>
        <span>/</span>
        <span className="text-foreground">
          {data.reportType} Report
        </span>
      </div>

      {/* Report Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/strategist/reports">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">
                {data.reportType.charAt(0) + data.reportType.slice(1).toLowerCase()} Report
              </h1>
              <Badge
                className={
                  TYPE_STYLES[data.reportType] ??
                  'bg-gray-100 text-gray-700'
                }
              >
                {data.reportType}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {formatDateRange(data.periodStart, data.periodEnd)}
            </p>
          </div>
        </div>

        {/* Summary Metrics */}
        <div className="flex flex-wrap gap-6 text-sm">
          <div>
            <span className="text-muted-foreground">Margin: </span>
            <span className="font-semibold">
              {data.marginActual.toFixed(1)}%
            </span>
            <span className="text-muted-foreground">
              {' '}
              / {data.marginTarget.toFixed(1)}% target
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Revenue: </span>
            <span className="font-semibold">
              {formatCurrency(data.totalRevenue)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Expenses: </span>
            <span className="font-semibold">
              {formatCurrency(data.totalExpenses)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Recommendations: </span>
            <span className="font-semibold">{data.recommendationsCount}</span>
            {data.recommendationsActedCount > 0 && (
              <span className="text-muted-foreground">
                {' '}
                ({data.recommendationsActedCount} acted on)
              </span>
            )}
          </div>
          <div>
            <span className="text-muted-foreground">Potential Savings: </span>
            <span className="font-semibold text-green-700">
              {formatCurrency(data.totalPotentialSavings)}
            </span>
          </div>
        </div>
      </div>

      {/* Report Content */}
      <ReportRenderer
        reportType={data.reportType}
        content={data.reportContent}
      />
    </div>
  );
}
