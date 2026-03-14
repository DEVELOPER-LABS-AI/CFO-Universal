'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ApprovalQueue } from '@/components/timesheets/approval-queue';
import { TimesheetReviewDialog } from '@/components/timesheets/timesheet-review-dialog';
import { TimesheetStatusBadge } from '@/components/timesheets/timesheet-status-badge';
import { bulkApproveTimesheets } from '@/app/actions/timesheet-admin-actions';
import { toast } from 'sonner';
import { Clock, CheckCircle2, ChevronLeft, ChevronRight, FileBarChart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TimesheetExportSection } from '@/components/timesheets/timesheet-export-section';

interface TimesheetRow {
  id: string;
  staff_id: string;
  staff_name: string;
  period_start: string;
  period_end: string;
  status: string;
  total_hours: number;
  billable_hours: number;
  overtime_hours: number;
  submitted_at: string | null;
  entry_count: number;
}

interface TimesheetDashboardContentProps {
  timesheets: TimesheetRow[];
  activeTab: string;
  pendingCount: number;
  pendingHours: number;
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

function formatPeriod(start: string, end: string): string {
  const s = new Date(start + 'T00:00:00Z');
  const e = new Date(end + 'T00:00:00Z');
  return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })} – ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}`;
}

export function TimesheetDashboardContent({
  timesheets,
  activeTab,
  pendingCount,
  pendingHours,
  pagination,
}: TimesheetDashboardContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [reviewTarget, setReviewTarget] = useState<TimesheetRow | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [reportSummary, setReportSummary] = useState<{
    total_hours: number;
    billable_hours: number;
    overtime_hours: number;
    timesheet_count: number;
  } | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportStart, setReportStart] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  });
  const [reportEnd, setReportEnd] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  });

  /**
   * Fetch summary stats from the summary API for the reports tab.
   */
  async function fetchReportSummary(start: string, end: string) {
    setReportLoading(true);
    try {
      const params = new URLSearchParams({ period_start: start, period_end: end });
      const res = await fetch(`/api/timesheets/summary?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setReportSummary(data.summary);
      }
    } catch {
      // Silently fail; summary section will remain empty
    } finally {
      setReportLoading(false);
    }
  }

  function switchTab(tab: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    params.delete('page');
    router.push(`/dashboard/timesheets?${params.toString()}`);
  }

  function goToPage(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(page));
    router.push(`/dashboard/timesheets?${params.toString()}`);
  }

  async function handleBulkApprove(ids: string[]) {
    setBulkLoading(true);
    const result = await bulkApproveTimesheets({ timesheet_ids: ids });
    setBulkLoading(false);

    if (result.success) {
      toast.success(`${result.approved_count} timesheet(s) approved`);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <div className="rounded-full bg-amber-100 p-2">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pending Approval</p>
              <p className="text-2xl font-semibold">{pendingCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <div className="rounded-full bg-blue-100 p-2">
              <CheckCircle2 className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Hours Pending</p>
              <p className="text-2xl font-semibold">{pendingHours}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        <button
          onClick={() => switchTab('pending')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'pending'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          Pending Approval
          {pendingCount > 0 && (
            <span className="ml-2 rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-xs">
              {pendingCount}
            </span>
          )}
        </button>
        <button
          onClick={() => switchTab('all')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'all'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          All Timesheets
        </button>
        <button
          onClick={() => {
            switchTab('reports');
            fetchReportSummary(reportStart, reportEnd);
          }}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5',
            activeTab === 'reports'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          <FileBarChart className="h-3.5 w-3.5" />
          Reports
        </button>
      </div>

      {/* Content */}
      {activeTab === 'pending' ? (
        <ApprovalQueue
          timesheets={timesheets}
          onReview={(id) => {
            const ts = timesheets.find((t) => t.id === id);
            if (ts) setReviewTarget(ts);
          }}
          onBulkApprove={handleBulkApprove}
          isLoading={bulkLoading}
        />
      ) : activeTab === 'reports' ? (
        <div className="space-y-6">
          {/* Date Range & Summary */}
          <Card>
            <CardContent className="pt-5 space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label htmlFor="report-start" className="block text-xs text-muted-foreground mb-1">
                    Start Date
                  </label>
                  <input
                    id="report-start"
                    type="date"
                    value={reportStart}
                    onChange={(e) => setReportStart(e.target.value)}
                    className="rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div>
                  <label htmlFor="report-end" className="block text-xs text-muted-foreground mb-1">
                    End Date
                  </label>
                  <input
                    id="report-end"
                    type="date"
                    value={reportEnd}
                    onChange={(e) => setReportEnd(e.target.value)}
                    className="rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fetchReportSummary(reportStart, reportEnd)}
                  disabled={reportLoading}
                >
                  {reportLoading ? 'Loading...' : 'Refresh'}
                </Button>
              </div>

              {/* Summary Stats */}
              {reportSummary && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Timesheets</p>
                    <p className="text-xl font-semibold">{reportSummary.timesheet_count}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Total Hours</p>
                    <p className="text-xl font-semibold">{reportSummary.total_hours}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Billable Hours</p>
                    <p className="text-xl font-semibold text-emerald-600">{reportSummary.billable_hours}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Overtime Hours</p>
                    <p className="text-xl font-semibold text-amber-600">{reportSummary.overtime_hours}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Export Section */}
          <Card>
            <CardContent className="pt-5">
              <TimesheetExportSection
                basePath="/api/timesheets/export"
                title="Export to CSV"
              />
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Staff</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Period</th>
                <th className="px-3 py-2 text-center font-medium text-muted-foreground">Status</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">Hours</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">Billable</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {timesheets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                    No timesheets found.
                  </td>
                </tr>
              ) : (
                timesheets.map((ts) => (
                  <tr key={ts.id} className="border-b hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">{ts.staff_name}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {formatPeriod(ts.period_start, ts.period_end)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <TimesheetStatusBadge status={ts.status as 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'} />
                    </td>
                    <td className="px-3 py-2 text-right">{ts.total_hours}</td>
                    <td className="px-3 py-2 text-right">{ts.billable_hours}</td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/dashboard/timesheets/${ts.id}`)}
                      >
                        View
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(pagination.page - 1) * pagination.perPage + 1}–
            {Math.min(pagination.page * pagination.perPage, pagination.total)} of {pagination.total}
          </p>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(pagination.page - 1)}
              disabled={pagination.page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Review Dialog */}
      {reviewTarget && (
        <TimesheetReviewDialog
          open={!!reviewTarget}
          onOpenChange={(open) => { if (!open) setReviewTarget(null); }}
          timesheetId={reviewTarget.id}
          staffName={reviewTarget.staff_name}
          periodLabel={formatPeriod(reviewTarget.period_start, reviewTarget.period_end)}
          totalHours={reviewTarget.total_hours}
          onReviewComplete={() => {
            setReviewTarget(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
