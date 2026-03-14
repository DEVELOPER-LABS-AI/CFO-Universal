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
import { Checkbox } from '@/components/ui/checkbox';
import { updateSubscription } from '@/app/actions/subscription-management';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils/error';

interface EditSubscriptionModalProps {
  subscription: {
    id: string;
    name: string;
    total_cost: any;
    total_seats: number | null;
    billing_frequency: string;
    is_active: boolean;
  };
  trigger?: React.ReactNode;
}

export function EditSubscriptionModal({ subscription, trigger }: EditSubscriptionModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: subscription.name ?? '',
    total_cost: subscription.total_cost !== undefined && subscription.total_cost !== null
      ? String(Number(subscription.total_cost))
      : '',
    total_seats: subscription.total_seats !== null && subscription.total_seats !== undefined
      ? String(subscription.total_seats)
      : '',
    billing_frequency: subscription.billing_frequency ?? 'Monthly',
    is_active: subscription.is_active ?? true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await updateSubscription(subscription.id, {
        name: formData.name,
        total_cost: parseFloat(formData.total_cost),
        total_seats: formData.total_seats ? parseInt(formData.total_seats) : null,
        billing_frequency: formData.billing_frequency,
        is_active: formData.is_active,
      });

      toast.success(`${formData.name} updated successfully`);
      setOpen(false);
      router.refresh();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || 'Failed to update subscription');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button variant="ghost" size="sm">Edit</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Subscription</DialogTitle>
            <DialogDescription>
              Update details for {subscription.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="edit-sub-name">Subscription Name *</Label>
              <Input
                id="edit-sub-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Salesforce, HubSpot, Adobe Creative Cloud..."
                required
              />
            </div>

            {/* Total Cost */}
            <div className="space-y-2">
              <Label htmlFor="edit-sub-total_cost">Total Cost *</Label>
              <Input
                id="edit-sub-total_cost"
                type="number"
                step="0.01"
                min="0"
                value={formData.total_cost}
                onChange={(e) => setFormData({ ...formData, total_cost: e.target.value })}
                placeholder="500.00"
                required
              />
            </div>

            {/* Total Seats (optional) */}
            <div className="space-y-2">
              <Label htmlFor="edit-sub-total_seats">
                Total Seats (Optional)
                <span className="text-xs text-muted-foreground ml-2">
                  Leave blank for percentage-based allocation
                </span>
              </Label>
              <Input
                id="edit-sub-total_seats"
                type="number"
                min="1"
                value={formData.total_seats}
                onChange={(e) => setFormData({ ...formData, total_seats: e.target.value })}
                placeholder="10"
              />
            </div>

            {/* Billing Frequency */}
            <div className="space-y-2">
              <Label htmlFor="edit-sub-billing_frequency">Billing Frequency *</Label>
              <Input
                id="edit-sub-billing_frequency"
                value={formData.billing_frequency}
                onChange={(e) => setFormData({ ...formData, billing_frequency: e.target.value })}
                placeholder="Monthly, Annual, Quarterly..."
                required
              />
            </div>

            {/* Active Status */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit-sub-is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_active: checked as boolean })
                }
              />
              <Label htmlFor="edit-sub-is_active" className="cursor-pointer">
                Active subscription
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
