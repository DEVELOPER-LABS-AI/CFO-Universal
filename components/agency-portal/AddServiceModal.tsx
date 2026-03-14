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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { addAgencyService } from '@/app/actions/agency-portal-actions';

interface AddServiceModalProps {
  trigger: React.ReactNode;
}

/**
 * Dialog modal for adding a new agency service.
 * Collects name, description, standard rate, and target margin.
 */
export function AddServiceModal({ trigger }: AddServiceModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [standardRate, setStandardRate] = useState('');
  const [billingType, setBillingType] = useState<'recurring' | 'one_time'>('recurring');
  const [targetMargin, setTargetMargin] = useState('0');

  /** Reset form fields to their initial values. */
  function resetForm() {
    setName('');
    setDescription('');
    setStandardRate('');
    setBillingType('recurring');
    setTargetMargin('0');
  }

  /** Validate and submit the new service form. */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Service name is required');
      return;
    }

    const rate = parseFloat(standardRate);
    if (isNaN(rate) || rate < 0) {
      toast.error('Please enter a valid rate');
      return;
    }

    const margin = parseFloat(targetMargin);
    if (isNaN(margin) || margin < 0 || margin > 100) {
      toast.error('Target margin must be between 0 and 100');
      return;
    }

    setSaving(true);
    try {
      await addAgencyService({
        name: name.trim(),
        description: description.trim() || undefined,
        standard_rate: rate,
        billing_type: billingType,
        target_margin: margin,
      });
      toast.success(`Service "${name.trim()}" added successfully`);
      setOpen(false);
      resetForm();
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to add service'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) resetForm(); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Service</DialogTitle>
            <DialogDescription>
              Add a new service that your agency provides.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="add-service-name">Name</Label>
              <Input
                id="add-service-name"
                placeholder="e.g. Web Development"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="add-service-description">
                Description <span className="text-gray-400">(optional)</span>
              </Label>
              <Textarea
                id="add-service-description"
                placeholder="Brief description of this service"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="add-service-billing">Billing Type</Label>
              <Select value={billingType} onValueChange={(v) => setBillingType(v as 'recurring' | 'one_time')}>
                <SelectTrigger id="add-service-billing">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recurring">Recurring (Hourly/Monthly)</SelectItem>
                  <SelectItem value="one_time">One-Time (Project Fee)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="add-service-rate">
                {billingType === 'one_time' ? 'Project Fee ($)' : 'Standard Rate ($)'}
              </Label>
              <Input
                id="add-service-rate"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={standardRate}
                onChange={(e) => setStandardRate(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="add-service-margin">Target Margin (%)</Label>
              <Input
                id="add-service-margin"
                type="number"
                min="0"
                max="100"
                step="0.01"
                placeholder="0"
                value={targetMargin}
                onChange={(e) => setTargetMargin(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Adding...' : 'Add Service'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
