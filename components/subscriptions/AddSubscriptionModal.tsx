'use client';

import { useState, useEffect } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { createSubscription } from '@/app/actions/subscription-management';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils/error';

interface AddSubscriptionModalProps {
  trigger: React.ReactNode;
  /** Pre-fill the subscription name (e.g. from a merchant name). */
  defaultName?: string;
  /** Called after successful creation with the new subscription's id and name. */
  onCreated?: (subscription: { id: string; name: string }) => void;
}

// T103: AddSubscriptionModal component
export function AddSubscriptionModal({ trigger, defaultName, onCreated }: AddSubscriptionModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: defaultName ?? '',
    total_cost: '',
    total_seats: '',
    billing_frequency: 'Monthly',
    is_active: true,
  });

  useEffect(() => {
    if (defaultName !== undefined) {
      setFormData((prev) => ({ ...prev, name: defaultName }));
    }
  }, [defaultName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const created = await createSubscription({
        name: formData.name,
        total_cost: formData.total_cost ? parseFloat(formData.total_cost) : 0,
        total_seats: formData.total_seats ? parseInt(formData.total_seats) : null,
        billing_frequency: formData.billing_frequency,
        is_active: formData.is_active,
      });

      toast.success(`${formData.name} added successfully`);
      setOpen(false);
      setFormData({
        name: defaultName ?? '',
        total_cost: '',
        total_seats: '',
        billing_frequency: 'Monthly',
        is_active: true,
      });
      onCreated?.({ id: created.id, name: created.name });
      router.refresh();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || 'Failed to add subscription');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Subscription</DialogTitle>
            <DialogDescription>
              Add a new SaaS subscription to track and allocate costs
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Subscription Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Salesforce, HubSpot, Adobe Creative Cloud..."
                required
              />
            </div>

            {/* Total Cost */}
            <div className="space-y-2">
              <Label htmlFor="total_cost">
                Total Cost
                <span className="text-xs text-muted-foreground ml-2">
                  Leave blank if variable — actual cost syncs from Mercury
                </span>
              </Label>
              <Input
                id="total_cost"
                type="number"
                step="0.01"
                min="0"
                value={formData.total_cost}
                onChange={(e) => setFormData({ ...formData, total_cost: e.target.value })}
                placeholder="0.00"
              />
            </div>

            {/* Total Seats (optional) */}
            <div className="space-y-2">
              <Label htmlFor="total_seats">
                Total Seats (Optional)
                <span className="text-xs text-muted-foreground ml-2">
                  Leave blank for percentage-based allocation
                </span>
              </Label>
              <Input
                id="total_seats"
                type="number"
                min="1"
                value={formData.total_seats}
                onChange={(e) => setFormData({ ...formData, total_seats: e.target.value })}
                placeholder="10"
              />
            </div>

            {/* Billing Frequency */}
            <div className="space-y-2">
              <Label htmlFor="billing_frequency">Billing Frequency *</Label>
              <Input
                id="billing_frequency"
                value={formData.billing_frequency}
                onChange={(e) => setFormData({ ...formData, billing_frequency: e.target.value })}
                placeholder="Monthly, Annual, Quarterly..."
                required
              />
            </div>

            {/* Active Status */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_active: checked as boolean })
                }
              />
              <Label htmlFor="is_active" className="cursor-pointer">
                Active subscription
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Adding...' : 'Add Subscription'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
