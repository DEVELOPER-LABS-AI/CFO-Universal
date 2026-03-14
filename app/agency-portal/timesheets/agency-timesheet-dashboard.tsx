'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ApprovalQueue } from '@/components/timesheets/approval-queue';
import { TimesheetStatusBadge } from '@/components/timesheets/timesheet-status-badge';
import { bulkApproveAgencyTimesheets } from '@/app/actions/agency-portal-actions';
import { toast } from 'sonner';
import { Clock, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

interface AgencyTimesheetDashboardProps {
  /** Serialized timesheet rows for the current page. */
  timesheets: TimesheetRow[];
  /** Currently active tab ('pending' or 'all'). */
  activeTab: string;
  /** Count of timesheets with SUBMITTED status. */
  pendingCount: number;
  /** Sum of total_hours for SUBMITTED timesheets. */
  pendingHours: number;
  /** Pagination metadata. */
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format a date range as "Mar 3 – Mar 9, 2026".
 */
function formatPeriod(start: string, end: string): string {
  const s = new Date(start + 'T00:00:00Z');
  const e = new Date(end + 'T00:00:00Z');
  return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })} – ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AgencyTimesheetDashboard({
  timesheets,
  activeTab,
  pendingCount,
  pendingHours,
  pagination,
}: AgencyTimesheetDashboardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [bulkLoading, setBulkLoading] = useState(false);

  /** Switch between "pending" and "all" tabs via URL search params. */
  function switchTab(tab: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    params.delete('page');
    router.push(`/agency-portal/timesheets?${params.toString()}`);
  }

  /** Navigate to a specific page number. */
  function goToPage(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(page));
    router.push(`/agency-portal/timesheets?${params.toString()}`);
  }

  /** Navigate to the detail page for a specific timesheet. */
  function handleReview(timesheetId: string) {
    router.push(`/agency-portal/timesheets/${timesheetId}`);
  }

  /** Bulk approve selected timesheets via server action. */
  async function handleBulkApprove(ids: string[]) {
    setBulkLoading(true);
    try {
      const result = await bulkApproveAgencyTimesheets({ timesheet_ids: ids });

      if (result.success) {
        toast.success(`${result.approved_count} timesheet(s) approved`);
        router.refresh();
      } else {
        toast.error(result.error ?? 'Failed to bulk approve timesheets');
      }
    } catch {
      toast.error('An unexpected error occurred');
    } finally {
      setBulkLoading(false);
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
      </div>

      {/* Content */}
      {activeTab === 'pending' ? (
        <ApprovalQueue
          timesheets={timesheets}
          onReview={handleReview}
          onBulkApprove={handleBulkApprove}
          isLoading={bulkLoading}
        />
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
                    <td className="px-3 py-2 text-right tabular-nums">{ts.total_hours}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{ts.billable_hours}</td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/agency-portal/timesheets/${ts.id}`)}
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
    </div>
  );
}
