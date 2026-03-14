'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { TimesheetStatusBadge } from '@/components/timesheets/timesheet-status-badge';
import { TimesheetGrid } from '@/components/timesheets/timesheet-grid';
import { reviewAgencyTimesheet } from '@/app/actions/agency-portal-actions';
import { toast } from 'sonner';
import { ArrowLeft, Clock, DollarSign, User } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AgencyTimesheetDetailProps {
  /** Timesheet record ID. */
  timesheetId: string;
  /** Display name of the staff member. */
  staffName: string;
  /** Staff rate (already serialized from Decimal to number). */
  staffRate: number;
  /** Rate type (HOURLY, DAILY, MONTHLY). */
  staffRateType: string;
  /** Period start date as YYYY-MM-DD string. */
  periodStart: string;
  /** Period end date as YYYY-MM-DD string. */
  periodEnd: string;
  /** Current timesheet status. */
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  /** Total hours on the timesheet. */
  totalHours: number;
  /** Billable hours on the timesheet. */
  billableHours: number;
  /** Overtime hours on the timesheet. */
  overtimeHours: number;
  /** Rejection reason if status is REJECTED. */
  rejectionReason: string | null;
  /** Name of the reviewer if reviewed. */
  reviewerName: string | null;
  /** ISO timestamp of when the review occurred. */
  reviewedAt: string | null;
  /** ISO timestamp of when the timesheet was submitted. */
  submittedAt: string | null;
  /** Serialized time entries for the grid. */
  entries: Array<{
    id?: string;
    assignment_id: string | null;
    entry_date: string;
    hours: number;
    description: string | null;
    is_billable: boolean;
  }>;
  /** Active assignments for the staff member. */
  assignments: Array<{ id: string; client_name: string }>;
}

// Minimum characters required for a rejection reason.
const MIN_REJECTION_REASON_LENGTH = 10;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format a date range as "March 3 – March 9, 2026".
 */
function formatPeriod(start: string, end: string): string {
  const s = new Date(start + 'T00:00:00Z');
  const e = new Date(end + 'T00:00:00Z');
  return `${s.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })} – ${e.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}`;
}

/**
 * Format an ISO timestamp as a readable date-time string.
 */
function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AgencyTimesheetDetail({
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
}: AgencyTimesheetDetailProps) {
  const router = useRouter();
  const canReview = status === 'SUBMITTED';
  const nonBillableHours = totalHours - billableHours;

  // Review action state
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [showRejectionInput, setShowRejectionInput] = useState(false);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');

  const isBusy = isApproving || isRejecting;
  const rejectionReasonValid =
    rejectionReasonInput.trim().length >= MIN_REJECTION_REASON_LENGTH;

  /** Approve the timesheet via the agency-scoped server action. */
  async function handleApprove() {
    setIsApproving(true);
    try {
      const result = await reviewAgencyTimesheet({
        timesheet_id: timesheetId,
        action: 'approve',
      });

      if (result.success) {
        toast.success(`Timesheet for ${staffName} approved`);
        router.refresh();
      } else {
        toast.error(result.error ?? 'Failed to approve timesheet');
      }
    } catch {
      toast.error('An unexpected error occurred');
    } finally {
      setIsApproving(false);
    }
  }

  /** Reject the timesheet with a reason via the agency-scoped server action. */
  async function handleReject() {
    if (!rejectionReasonValid) return;

    setIsRejecting(true);
    try {
      const result = await reviewAgencyTimesheet({
        timesheet_id: timesheetId,
        action: 'reject',
        rejection_reason: rejectionReasonInput.trim(),
      });

      if (result.success) {
        toast.success(`Timesheet for ${staffName} rejected`);
        setShowRejectionInput(false);
        setRejectionReasonInput('');
        router.refresh();
      } else {
        toast.error(result.error ?? 'Failed to reject timesheet');
      }
    } catch {
      toast.error('An unexpected error occurred');
    } finally {
      setIsRejecting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/agency-portal/timesheets')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">
              {formatPeriod(periodStart, periodEnd)}
            </h1>
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

        {/* Review actions in header for quick access */}
        {canReview && !showRejectionInput && (
          <div className="flex gap-2">
            <Button
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => setShowRejectionInput(true)}
              disabled={isBusy}
            >
              Reject
            </Button>
            <Button
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={handleApprove}
              disabled={isBusy}
            >
              {isApproving ? 'Approving...' : 'Approve'}
            </Button>
          </div>
        )}
      </div>

      {/* Inline rejection reason input */}
      {canReview && showRejectionInput && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <label htmlFor="rejection-reason" className="text-sm font-medium">
              Rejection Reason
            </label>
            <Textarea
              id="rejection-reason"
              placeholder="Explain why the timesheet is being rejected (min 10 characters)..."
              value={rejectionReasonInput}
              onChange={(e) => setRejectionReasonInput(e.target.value)}
              disabled={isBusy}
              rows={3}
            />
            <p
              className={cn(
                'text-xs',
                rejectionReasonInput.trim().length > 0 && !rejectionReasonValid
                  ? 'text-red-500'
                  : 'text-muted-foreground',
              )}
            >
              {rejectionReasonInput.trim().length}/{MIN_REJECTION_REASON_LENGTH} characters minimum
            </p>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowRejectionInput(false);
                  setRejectionReasonInput('');
                }}
                disabled={isBusy}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={!rejectionReasonValid || isBusy}
              >
                {isRejecting ? 'Rejecting...' : 'Confirm Rejection'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Staff Info & Summary Cards */}
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
            {nonBillableHours > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {nonBillableHours}h non-billable
              </p>
            )}
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

      {/* Read-only Time Entry Grid */}
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
    </div>
  );
}
