'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { reviewTimesheet } from '@/app/actions/timesheet-admin-actions';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TimesheetReviewDialogProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Callback to control dialog open state. */
  onOpenChange: (open: boolean) => void;
  /** The ID of the timesheet being reviewed. */
  timesheetId: string;
  /** Display name of the staff member who owns the timesheet. */
  staffName: string;
  /** Formatted period label (e.g. "Mar 3 - Mar 9, 2026"). */
  periodLabel: string;
  /** Total hours recorded on the timesheet. */
  totalHours: number;
  /** Called after a successful approve or reject to refresh parent data. */
  onReviewComplete: () => void;
}

// Minimum characters required for a rejection reason.
const MIN_REJECTION_REASON_LENGTH = 10;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TimesheetReviewDialog({
  open,
  onOpenChange,
  timesheetId,
  staffName,
  periodLabel,
  totalHours,
  onReviewComplete,
}: TimesheetReviewDialogProps) {
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [showRejectionInput, setShowRejectionInput] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  /** Whether any action is currently in-flight. */
  const isBusy = isApproving || isRejecting;

  /** Whether the rejection reason meets the minimum length. */
  const rejectionReasonValid = rejectionReason.trim().length >= MIN_REJECTION_REASON_LENGTH;

  /** Reset local state when the dialog closes. */
  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setShowRejectionInput(false);
      setRejectionReason('');
    }
    onOpenChange(nextOpen);
  }

  /** Approve the timesheet. */
  async function handleApprove() {
    setIsApproving(true);
    try {
      const result = await reviewTimesheet({
        timesheet_id: timesheetId,
        action: 'approve',
      });

      if (result.success) {
        toast.success(`Timesheet for ${staffName} approved`);
        onReviewComplete();
        handleOpenChange(false);
      } else {
        toast.error(result.error ?? 'Failed to approve timesheet');
      }
    } catch {
      toast.error('An unexpected error occurred');
    } finally {
      setIsApproving(false);
    }
  }

  /** Reject the timesheet with a reason. */
  async function handleReject() {
    if (!rejectionReasonValid) return;

    setIsRejecting(true);
    try {
      const result = await reviewTimesheet({
        timesheet_id: timesheetId,
        action: 'reject',
        rejection_reason: rejectionReason.trim(),
      });

      if (result.success) {
        toast.success(`Timesheet for ${staffName} rejected`);
        onReviewComplete();
        handleOpenChange(false);
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Review Timesheet</DialogTitle>
          <DialogDescription>
            Review and approve or reject this submitted timesheet.
          </DialogDescription>
        </DialogHeader>

        {/* Summary */}
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <span className="text-muted-foreground">Staff Member</span>
            <span className="font-medium">{staffName}</span>

            <span className="text-muted-foreground">Period</span>
            <span className="font-medium">{periodLabel}</span>

            <span className="text-muted-foreground">Total Hours</span>
            <span className="font-medium tabular-nums">{totalHours}</span>
          </div>
        </div>

        {/* Rejection reason input (shown after clicking Reject) */}
        {showRejectionInput && (
          <div className="space-y-2">
            <label htmlFor="rejection-reason" className="text-sm font-medium">
              Rejection Reason
            </label>
            <Textarea
              id="rejection-reason"
              placeholder="Explain why the timesheet is being rejected (min 10 characters)..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              disabled={isBusy}
              rows={3}
            />
            <p
              className={cn(
                'text-xs',
                rejectionReason.trim().length > 0 && !rejectionReasonValid
                  ? 'text-red-500'
                  : 'text-muted-foreground',
              )}
            >
              {rejectionReason.trim().length}/{MIN_REJECTION_REASON_LENGTH} characters minimum
            </p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {showRejectionInput ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setShowRejectionInput(false);
                  setRejectionReason('');
                }}
                disabled={isBusy}
              >
                Back
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={!rejectionReasonValid || isBusy}
              >
                {isRejecting ? 'Rejecting...' : 'Confirm Rejection'}
              </Button>
            </>
          ) : (
            <>
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
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
