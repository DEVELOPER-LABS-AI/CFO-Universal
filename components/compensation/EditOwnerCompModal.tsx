'use client';

import { useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { updateOwnerCompSettings } from '@/app/actions/owner-pay-actions';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils/error';

interface EditOwnerCompModalProps {
  owner: {
    id: string;
    name: string;
    rate: string | number;
    rate_type: string;
    compensation_start_date: string | null;
    pay_day: number | null;
  };
  trigger: React.ReactNode;
  onSaved?: () => void;
}

/**
 * Modal for editing owner compensation settings: rate, rate type,
 * compensation start date, and pay day.
 */
export function EditOwnerCompModal({ owner, trigger, onSaved }: EditOwnerCompModalProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    rate: String(Number(owner.rate)),
    rateType: owner.rate_type,
    compensationStartDate: owner.compensation_start_date
      ? owner.compensation_start_date.split('T')[0]
      : '',
    payDay: owner.pay_day != null ? String(owner.pay_day) : '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await updateOwnerCompSettings({
        staffId: owner.id,
        rate: parseFloat(formData.rate),
        rateType: formData.rateType,
        compensationStartDate: formData.compensationStartDate || null,
        payDay: formData.payDay ? parseInt(formData.payDay, 10) : null,
      });

      toast.success(`${owner.name} compensation settings updated`);
      setOpen(false);
      onSaved?.();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || 'Failed to update settings');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Compensation — {owner.name}</DialogTitle>
          <DialogDescription>
            Update rate, tracking start date, and expected pay day.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rate">Rate</Label>
              <Input
                id="rate"
                type="number"
                step="0.01"
                min="0"
                value={formData.rate}
                onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rateType">Rate Type</Label>
              <Select
                value={formData.rateType}
                onValueChange={(v) => setFormData({ ...formData, rateType: v })}
              >
                <SelectTrigger id="rateType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                  <SelectItem value="HOURLY">Hourly</SelectItem>
                  <SelectItem value="DAILY">Daily</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="startDate">Compensation Start Date</Label>
            <Input
              id="startDate"
              type="date"
              value={formData.compensationStartDate}
              onChange={(e) =>
                setFormData({ ...formData, compensationStartDate: e.target.value })
              }
            />
            <p className="text-xs text-gray-500">
              Months before this date will show $0 expected. Leave blank for no restriction.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payDay">Pay Day (day of month)</Label>
            <Input
              id="payDay"
              type="number"
              min="1"
              max="28"
              placeholder="e.g. 1, 15"
              value={formData.payDay}
              onChange={(e) => setFormData({ ...formData, payDay: e.target.value })}
            />
            <p className="text-xs text-gray-500">
              If payment hasn&apos;t arrived by this day, status shows &quot;Overdue&quot;.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
