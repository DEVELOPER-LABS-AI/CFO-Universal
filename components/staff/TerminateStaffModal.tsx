'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { terminateStaff } from '@/app/actions/staff-management';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils/error';

interface TerminateStaffModalProps {
  staffId: string;
  staffName: string;
  activeAssignmentCount: number;
  trigger: React.ReactNode;
}

export function TerminateStaffModal({
  staffId,
  staffName,
  activeAssignmentCount,
  trigger,
}: TerminateStaffModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reason, setReason] = useState('');

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      const result = await terminateStaff({
        staff_id: staffId,
        termination_reason: reason,
        terminated_at: new Date(),
      });
      toast.success(
        `${staffName} terminated. ${result.assignmentsEnded} assignment(s) ended.`
      );
      setOpen(false);
      setReason('');
      router.refresh();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || 'Failed to terminate staff member');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Terminate Staff Member</DialogTitle>
          <DialogDescription>
            This will mark <span className="font-semibold">{staffName}</span> as terminated and preserve all historical data.
          </DialogDescription>
        </DialogHeader>

        {activeAssignmentCount > 0 && (
          <div className="rounded-md bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800">
            {activeAssignmentCount} active assignment{activeAssignmentCount !== 1 ? 's' : ''} will be automatically ended.
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="termination-reason">Reason *</Label>
          <Textarea
            id="termination-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g., Contract ended, Resigned, Performance..."
            rows={3}
          />
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isSubmitting || !reason.trim()}
          >
            {isSubmitting ? 'Terminating...' : 'Terminate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
