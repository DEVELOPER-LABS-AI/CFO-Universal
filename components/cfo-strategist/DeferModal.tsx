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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateRecommendationStatus } from '@/app/actions/cfo-strategist';

interface DeferModalProps {
  recommendationId: string;
  recommendationTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

/**
 * Computes tomorrow's date as a YYYY-MM-DD string for the date input minimum.
 */
function getTomorrowDate(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
}

/**
 * Modal for deferring a CFO Strategist recommendation to a future date.
 * Validates that the selected date is in the future before submitting.
 */
export function DeferModal({
  recommendationId,
  recommendationTitle,
  open,
  onOpenChange,
  onSuccess,
}: DeferModalProps) {
  const [deferDate, setDeferDate] = useState('');
  const [loading, setLoading] = useState(false);

  const minDate = getTomorrowDate();

  async function handleDefer() {
    if (!deferDate) {
      toast.error('Please select a date');
      return;
    }

    const selected = new Date(deferDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selected <= today) {
      toast.error('Defer date must be in the future');
      return;
    }

    setLoading(true);
    try {
      const result = await updateRecommendationStatus(recommendationId, {
        type: 'defer',
        until: deferDate,
      });

      if (result.success) {
        toast.success('Recommendation deferred');
        setDeferDate('');
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(result.error ?? 'Failed to defer recommendation');
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
          <DialogTitle>Defer Recommendation</DialogTitle>
          <DialogDescription>{recommendationTitle}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="defer-date">Defer Until</Label>
            <Input
              id="defer-date"
              type="date"
              min={minDate}
              value={deferDate}
              onChange={(e) => setDeferDate(e.target.value)}
              disabled={loading}
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
          <Button onClick={handleDefer} disabled={loading}>
            {loading ? 'Deferring...' : 'Defer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
