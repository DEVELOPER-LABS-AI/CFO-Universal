'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TimesheetStatusBadge } from '@/components/timesheets/timesheet-status-badge';
import { TimesheetGrid } from '@/components/timesheets/timesheet-grid';
import { submitTimesheet } from '@/app/actions/timesheet-actions';
import { ArrowLeft, Send, AlertTriangle, Clock } from 'lucide-react';

interface TimesheetEntryViewProps {
  timesheetId: string;
  periodStart: string;
  periodEnd: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  totalHours: number;
  billableHours: number;
  overtimeHours: number;
  rejectionReason: string | null;
  entries: Array<{
    id?: string;
    assignment_id: string | null;
    entry_date: string;
    hours: number;
    description: string | null;
    is_billable: boolean;
  }>;
  assignments: Array<{
    id: string;
    client_name: string;
  }>;
}

function formatWeek(start: string, end: string): string {
  const s = new Date(start + 'T00:00:00Z');
  const e = new Date(end + 'T00:00:00Z');
  const opts: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', timeZone: 'UTC' };
  return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`;
}

export function TimesheetEntryView({
  timesheetId,
  periodStart,
  periodEnd,
  status,
  totalHours,
  billableHours,
  overtimeHours,
  rejectionReason,
  entries,
  assignments,
}: TimesheetEntryViewProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [currentTotals, setCurrentTotals] = useState({ total: totalHours, billable: billableHours });

  const canSubmit = status === 'DRAFT' || status === 'REJECTED';
  const nonBillableHours = currentTotals.total - currentTotals.billable;

  /** Opens the confirmation dialog instead of submitting directly. */
  function handleSubmitClick() {
    setSubmitError(null);
    setConfirmOpen(true);
  }

  /** Executes the actual submission after user confirms. */
  async function handleConfirmSubmit() {
    setSubmitting(true);
    setSubmitError(null);

    const result = await submitTimesheet({ timesheet_id: timesheetId });

    setSubmitting(false);
    setConfirmOpen(false);

    if (result.success) {
      toast.success('Timesheet submitted successfully');
      router.refresh();
    } else {
      setSubmitError(result.error ?? 'Submission failed. Please try again.');
      toast.error('Timesheet submission failed');
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/staff-portal/timesheets')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">{formatWeek(periodStart, periodEnd)}</h1>
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

        {canSubmit && (
          <Button onClick={handleSubmitClick} disabled={submitting || currentTotals.total === 0}>
            <Send className="mr-2 h-4 w-4" />
            {submitting ? 'Submitting...' : 'Submit Timesheet'}
          </Button>
        )}
      </div>

      {/* Rejection banner */}
      {status === 'REJECTED' && rejectionReason && (
        <div className="rounded-md bg-red-50 border border-red-200 p-4 flex gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-red-800">Timesheet Rejected</h3>
            <p className="mt-1 text-sm text-red-700">{rejectionReason}</p>
            <p className="mt-2 text-xs text-red-600">
              Please make the required changes and resubmit.
            </p>
          </div>
        </div>
      )}

      {/* Submit error */}
      {submitError && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {submitError}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Total Hours</p>
            <p className="text-2xl font-semibold">{currentTotals.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Billable</p>
            <p className="text-2xl font-semibold text-emerald-600">{currentTotals.billable}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Non-Billable</p>
            <p className="text-2xl font-semibold text-gray-500">
              {currentTotals.total - currentTotals.billable}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Time Entries</CardTitle>
        </CardHeader>
        <CardContent>
          <TimesheetGrid
            timesheetId={timesheetId}
            periodStart={periodStart}
            status={status}
            entries={entries}
            assignments={assignments}
            onTotalsChange={setCurrentTotals}
          />
        </CardContent>
      </Card>

      {/* Submission confirmation dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Timesheet</DialogTitle>
            <DialogDescription>
              Please review the summary below before submitting your timesheet for{' '}
              {formatWeek(periodStart, periodEnd)}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {/* Hours summary */}
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-md border p-3 text-center">
                <p className="text-muted-foreground">Total</p>
                <p className="text-lg font-semibold">{currentTotals.total}h</p>
              </div>
              <div className="rounded-md border p-3 text-center">
                <p className="text-muted-foreground">Billable</p>
                <p className="text-lg font-semibold text-emerald-600">{currentTotals.billable}h</p>
              </div>
              <div className="rounded-md border p-3 text-center">
                <p className="text-muted-foreground">Non-Billable</p>
                <p className="text-lg font-semibold text-gray-500">{nonBillableHours}h</p>
              </div>
            </div>

            {/* Overtime warning */}
            {overtimeHours > 0 && (
              <div className="flex items-center gap-2 rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-600" />
                <span>
                  This timesheet includes <strong>{overtimeHours}h</strong> of overtime.
                </span>
              </div>
            )}

            <p className="text-sm text-muted-foreground">
              Once submitted, this timesheet will be locked for editing until reviewed.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirmSubmit} disabled={submitting}>
              <Send className="mr-2 h-4 w-4" />
              {submitting ? 'Submitting...' : 'Confirm & Submit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
