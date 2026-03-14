'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TierEditor, type TierInput } from './TierEditor';
import { createPayPlan, updatePayPlan } from '@/app/actions/bdr-admin-actions';
import { toast } from 'sonner';

interface PayPlanData {
  id?: string;
  name: string;
  description: string;
  baseMetric: 'MEETINGS_BOOKED' | 'MEETINGS_SHOWED';
  effectiveStart: string;
  effectiveEnd: string;
  tiers: TierInput[];
}

interface PayPlanFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editData?: {
    id: string;
    name: string;
    description: string | null;
    baseMetric: string;
    effectiveStart: string;
    effectiveEnd: string | null;
    tiers: { minThreshold: number; maxThreshold: number | null; payoutRate: number }[];
  };
}

/**
 * Dialog form for creating or editing a BDR pay plan.
 */
export function PayPlanForm({ open, onOpenChange, onSuccess, editData }: PayPlanFormProps) {
  const isEdit = !!editData;

  const [formData, setFormData] = useState<PayPlanData>(() => {
    if (editData) {
      return {
        id: editData.id,
        name: editData.name,
        description: editData.description ?? '',
        baseMetric: editData.baseMetric as 'MEETINGS_BOOKED' | 'MEETINGS_SHOWED',
        effectiveStart: editData.effectiveStart.split('T')[0],
        effectiveEnd: editData.effectiveEnd?.split('T')[0] ?? '',
        tiers: editData.tiers.map((t) => ({
          min_threshold: t.minThreshold,
          max_threshold: t.maxThreshold,
          payout_rate: t.payoutRate,
        })),
      };
    }
    return {
      name: '',
      description: '',
      baseMetric: 'MEETINGS_SHOWED',
      effectiveStart: new Date().toISOString().split('T')[0],
      effectiveEnd: '',
      tiers: [{ min_threshold: 1, max_threshold: null, payout_rate: 50 }],
    };
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const payload = {
        ...(isEdit && { id: editData!.id }),
        name: formData.name,
        description: formData.description || undefined,
        base_metric: formData.baseMetric,
        effective_start: formData.effectiveStart,
        effective_end: formData.effectiveEnd || undefined,
        tiers: formData.tiers,
      };

      const result = isEdit
        ? await updatePayPlan(payload)
        : await createPayPlan(payload);

      if (result.success) {
        toast.success(isEdit ? 'Pay plan updated' : 'Pay plan created');
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Pay Plan' : 'Create Pay Plan'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update the pay plan details and tier structure.'
              : 'Define a new bonus pay plan with tiered payout rates.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Plan Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Standard BDR Plan Q1 2026"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional plan description"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Base Metric</Label>
            <Select
              value={formData.baseMetric}
              onValueChange={(v) =>
                setFormData({ ...formData, baseMetric: v as 'MEETINGS_BOOKED' | 'MEETINGS_SHOWED' })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MEETINGS_SHOWED">Meetings Showed</SelectItem>
                <SelectItem value="MEETINGS_BOOKED">Meetings Booked</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="effectiveStart">Effective Start</Label>
              <Input
                id="effectiveStart"
                type="date"
                value={formData.effectiveStart}
                onChange={(e) => setFormData({ ...formData, effectiveStart: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="effectiveEnd">Effective End</Label>
              <Input
                id="effectiveEnd"
                type="date"
                value={formData.effectiveEnd}
                onChange={(e) => setFormData({ ...formData, effectiveEnd: e.target.value })}
                placeholder="Optional"
              />
            </div>
          </div>

          <TierEditor
            tiers={formData.tiers}
            onChange={(tiers) => setFormData({ ...formData, tiers })}
          />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : isEdit ? 'Update Plan' : 'Create Plan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
