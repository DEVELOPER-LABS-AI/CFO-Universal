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
import { updateAgencyService } from '@/app/actions/agency-portal-actions';

interface EditServiceModalProps {
  trigger: React.ReactNode;
  service: {
    id: string;
    name: string;
    description: string | null;
    standard_rate: unknown;
    billing_type: string;
    target_margin: unknown;
  };
}

/**
 * Dialog modal for editing an existing agency service.
 * Pre-populates form fields with current service data.
 */
export function EditServiceModal({ trigger, service }: EditServiceModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(service.name);
  const [description, setDescription] = useState(service.description ?? '');
  const [standardRate, setStandardRate] = useState(String(service.standard_rate));
  const [billingType, setBillingType] = useState<'recurring' | 'one_time'>(
    (service.billing_type as 'recurring' | 'one_time') || 'recurring'
  );
  const [targetMargin, setTargetMargin] = useState(String(service.target_margin));

  /** Reset form fields to the current service values. */
  function resetForm() {
    setName(service.name);
    setDescription(service.description ?? '');
    setStandardRate(String(service.standard_rate));
    setBillingType((service.billing_type as 'recurring' | 'one_time') || 'recurring');
    setTargetMargin(String(service.target_margin));
  }

  /** Validate and submit the updated service data. */
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
      await updateAgencyService(service.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        standard_rate: rate,
        billing_type: billingType,
        target_margin: margin,
      });
      toast.success(`Service "${name.trim()}" updated successfully`);
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to update service'
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
            <DialogTitle>Edit Service</DialogTitle>
            <DialogDescription>
              Update the details for this service.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor={`edit-service-name-${service.id}`}>Name</Label>
              <Input
                id={`edit-service-name-${service.id}`}
                placeholder="e.g. Web Development"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor={`edit-service-description-${service.id}`}>
                Description <span className="text-gray-400">(optional)</span>
              </Label>
              <Textarea
                id={`edit-service-description-${service.id}`}
                placeholder="Brief description of this service"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor={`edit-service-billing-${service.id}`}>Billing Type</Label>
              <Select value={billingType} onValueChange={(v) => setBillingType(v as 'recurring' | 'one_time')}>
                <SelectTrigger id={`edit-service-billing-${service.id}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recurring">Recurring (Hourly/Monthly)</SelectItem>
                  <SelectItem value="one_time">One-Time (Project Fee)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor={`edit-service-rate-${service.id}`}>
                {billingType === 'one_time' ? 'Project Fee ($)' : 'Standard Rate ($)'}
              </Label>
              <Input
                id={`edit-service-rate-${service.id}`}
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
              <Label htmlFor={`edit-service-margin-${service.id}`}>Target Margin (%)</Label>
              <Input
                id={`edit-service-margin-${service.id}`}
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
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
