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

interface ActOnModalProps {
  recommendationId: string;
  recommendationTitle: string;
  estimatedImpact: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

/**
 * Modal for marking a CFO Strategist recommendation as acted upon.
 * Collects the expected monthly savings amount before confirming.
 */
export function ActOnModal({
  recommendationId,
  recommendationTitle,
  estimatedImpact,
  open,
  onOpenChange,
  onSuccess,
}: ActOnModalProps) {
  const [expectedSavings, setExpectedSavings] = useState<string>(
    String(estimatedImpact)
  );
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    const parsed = parseFloat(expectedSavings);
    if (isNaN(parsed) || parsed < 0) {
      toast.error('Please enter a valid savings amount');
      return;
    }

    setLoading(true);
    try {
      const result = await updateRecommendationStatus(recommendationId, {
        type: 'act',
        expectedSavings: parsed,
      });

      if (result.success) {
        toast.success('Recommendation marked as acted on');
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(result.error ?? 'Failed to update recommendation');
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
          <DialogTitle>Act on Recommendation</DialogTitle>
          <DialogDescription>{recommendationTitle}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="expected-savings">
              Expected Monthly Savings ($)
            </Label>
            <Input
              id="expected-savings"
              type="number"
              min={0}
              step="0.01"
              value={expectedSavings}
              onChange={(e) => setExpectedSavings(e.target.value)}
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
          <Button onClick={handleConfirm} disabled={loading}>
            {loading ? 'Confirming...' : 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
