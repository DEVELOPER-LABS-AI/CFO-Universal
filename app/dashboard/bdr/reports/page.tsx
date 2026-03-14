'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ReportReviewCard } from '@/components/bdr-admin/ReportReviewCard';
import { getBDRReportsForReview } from '@/app/actions/bdr-admin-actions';

/**
 * Admin page for reviewing and approving BDR monthly reports.
 */
export default function BDRReportsReviewPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [reports, setReports] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadReports = useCallback(async () => {
    setLoading(true);
    const result = await getBDRReportsForReview({ month, year });
    if (result.success) {
      setReports(result.data.reports);
      setSummary(result.data.summary);
    }
    setLoading(false);
  }, [month, year]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">BDR Report Review</h1>
        <p className="text-muted-foreground">Review and approve submitted monthly reports</p>
      </div>

      {/* Month/Year Selector */}
      <div className="flex gap-4 items-end">
        <div className="space-y-2">
          <Label>Month</Label>
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>
                  {new Date(2000, i).toLocaleString('default', { month: 'long' })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Year</Label>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 5 }, (_, i) => {
                const y = now.getFullYear() - 2 + i;
                return (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Reports</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalReports}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{summary.submitted}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Approved</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{summary.approved}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Bonus (Approved)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${summary.totalBonusApproved.toFixed(2)}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Reports List */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading reports...</div>
      ) : reports.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No submitted reports for {monthName} {year}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <ReportReviewCard key={report.id} report={report} onAction={loadReports} />
          ))}
        </div>
      )}
    </div>
  );
}
