'use client';

import { useState } from 'react';
import { toast } from 'sonner';
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
import { Label } from '@/components/ui/label';
import { updateRecommendationStatus } from '@/app/actions/cfo-strategist';

interface DismissModalProps {
  recommendationId: string;
  recommendationTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

/**
 * Modal for dismissing a CFO Strategist recommendation.
 * Requires a reason before the recommendation can be dismissed.
 */
export function DismissModal({
  recommendationId,
  recommendationTitle,
  open,
  onOpenChange,
  onSuccess,
}: DismissModalProps) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleDismiss() {
    if (reason.trim().length < 5) {
      toast.error('Please provide a reason (at least 5 characters)');
      return;
    }

    setLoading(true);
    try {
      const result = await updateRecommendationStatus(recommendationId, {
        type: 'dismiss',
        reason: reason.trim(),
      });

      if (result.success) {
        toast.success('Recommendation dismissed');
        setReason('');
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(result.error ?? 'Failed to dismiss recommendation');
      }
    } catch {
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dismiss Recommendation</DialogTitle>
          <DialogDescription>{recommendationTitle}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="dismiss-reason">Reason for Dismissal</Label>
            <Textarea
              id="dismiss-reason"
              placeholder="Explain why this recommendation is being dismissed..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={loading}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDismiss}
            disabled={loading}
          >
            {loading ? 'Dismissing...' : 'Dismiss'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
