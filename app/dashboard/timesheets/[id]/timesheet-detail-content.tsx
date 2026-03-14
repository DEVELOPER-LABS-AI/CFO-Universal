'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TimesheetStatusBadge } from '@/components/timesheets/timesheet-status-badge';
import { TimesheetGrid } from '@/components/timesheets/timesheet-grid';
import { TimesheetReviewDialog } from '@/components/timesheets/timesheet-review-dialog';
import { ArrowLeft, Clock, DollarSign, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimesheetDetailContentProps {
  timesheetId: string;
  staffName: string;
  staffRate: number;
  staffRateType: string;
  periodStart: string;
  periodEnd: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  totalHours: number;
  billableHours: number;
  overtimeHours: number;
  rejectionReason: string | null;
  reviewerName: string | null;
  reviewedAt: string | null;
  submittedAt: string | null;
  entries: Array<{
    id?: string;
    assignment_id: string | null;
    entry_date: string;
    hours: number;
    description: string | null;
    is_billable: boolean;
  }>;
  assignments: Array<{ id: string; client_name: string }>;
  backUrl: string;
}

function formatPeriod(start: string, end: string): string {
  const s = new Date(start + 'T00:00:00Z');
  const e = new Date(end + 'T00:00:00Z');
  return `${s.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })} – ${e.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function TimesheetDetailContent({
  timesheetId,
  staffName,
  staffRate,
  staffRateType,
  periodStart,
  periodEnd,
  status,
  totalHours,
  billableHours,
  overtimeHours,
  rejectionReason,
  reviewerName,
  reviewedAt,
  submittedAt,
  entries,
  assignments,
  backUrl,
}: TimesheetDetailContentProps) {
  const router = useRouter();
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const canReview = status === 'SUBMITTED';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push(backUrl)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">{formatPeriod(periodStart, periodEnd)}</h1>
            <div className="flex items-center gap-2 mt-1">
              <TimesheetStatusBadge status={status} />
              {overtimeHours > 0 && (
                <span className="text-xs text-amber-600 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {overtimeHours}h overtime
                </span>
              )}
            </div>
          </div>
        </div>

        {canReview && (
          <Button onClick={() => setShowReviewDialog(true)}>
            Review Timesheet
          </Button>
        )}
      </div>

      {/* Staff Info & Status */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <User className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Staff Member</p>
              <p className="font-medium text-sm">{staffName}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Rate</p>
              <p className="font-medium text-sm">
                ${staffRate}/{staffRateType === 'HOURLY' ? 'hr' : staffRateType === 'DAILY' ? 'day' : 'mo'}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Total Hours</p>
            <p className="text-2xl font-semibold">{totalHours}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Billable</p>
            <p className="text-2xl font-semibold text-emerald-600">{billableHours}</p>
          </CardContent>
        </Card>
      </div>

      {/* Rejection Banner */}
      {status === 'REJECTED' && rejectionReason && (
        <div className="rounded-md bg-red-50 border border-red-200 p-4">
          <h3 className="text-sm font-medium text-red-800">Rejection Reason</h3>
          <p className="mt-1 text-sm text-red-700">{rejectionReason}</p>
          {reviewerName && reviewedAt && (
            <p className="mt-2 text-xs text-red-600">
              Rejected by {reviewerName} on {formatDateTime(reviewedAt)}
            </p>
          )}
        </div>
      )}

      {/* Approval Info */}
      {status === 'APPROVED' && reviewerName && reviewedAt && (
        <div className="rounded-md bg-emerald-50 border border-emerald-200 p-4">
          <p className="text-sm text-emerald-700">
            Approved by {reviewerName} on {formatDateTime(reviewedAt)}
          </p>
        </div>
      )}

      {/* Submission Info */}
      {submittedAt && (
        <p className="text-xs text-muted-foreground">
          Submitted on {formatDateTime(submittedAt)}
        </p>
      )}

      {/* Read-only Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Time Entries</CardTitle>
        </CardHeader>
        <CardContent>
          <TimesheetGrid
            timesheetId={timesheetId}
            periodStart={periodStart}
            status={status === 'SUBMITTED' ? 'APPROVED' : status}
            entries={entries}
            assignments={assignments}
          />
        </CardContent>
      </Card>

      {/* Billing Summary - only for SUBMITTED or APPROVED */}
      {(status === 'SUBMITTED' || status === 'APPROVED') && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Billing Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Regular Hours</p>
                <p className="text-lg font-semibold">{totalHours - overtimeHours}h</p>
              </div>
              <div>
                <p className="text-muted-foreground">Overtime Hours</p>
                <p className="text-lg font-semibold text-amber-600">{overtimeHours}h</p>
              </div>
              <div>
                <p className="text-muted-foreground">Regular Amount</p>
                <p className="text-lg font-semibold">${((totalHours - overtimeHours) * staffRate).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Total Estimated</p>
                <p className="text-lg font-semibold text-emerald-600">
                  ${((totalHours - overtimeHours) * staffRate + overtimeHours * staffRate * 1.5).toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Review Dialog */}
      <TimesheetReviewDialog
        open={showReviewDialog}
        onOpenChange={setShowReviewDialog}
        timesheetId={timesheetId}
        staffName={staffName}
        periodLabel={formatPeriod(periodStart, periodEnd)}
        totalHours={totalHours}
        onReviewComplete={() => {
          setShowReviewDialog(false);
          router.refresh();
        }}
      />
    </div>
  );
}
