'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils/error';
import { updateAgency } from '@/app/actions/agency-management';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Agency {
  id: string;
  name: string;
  merchant_name: string | null;
  start_date: Date;
  markup_type?: string | null;
  markup_value?: number | string | null;
  markup_basis?: string | null;
}

interface EditAgencyModalProps {
  agency: Agency;
  trigger?: React.ReactNode;
}

export function EditAgencyModal({ agency, trigger }: EditAgencyModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: agency.name,
    merchant_name: agency.merchant_name ?? '',
    start_date: new Date(agency.start_date).toISOString().split('T')[0],
    markup_type: agency.markup_type ?? '',
    markup_value: agency.markup_value != null ? String(agency.markup_value) : '',
    markup_basis: agency.markup_basis ?? 'BASE_PAY',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await updateAgency(agency.id, {
        name: formData.name,
        merchant_name: formData.merchant_name || null,
        start_date: new Date(formData.start_date),
        markup_type: formData.markup_type || null,
        markup_value: formData.markup_value ? parseFloat(formData.markup_value) : null,
        markup_basis: formData.markup_type ? (formData.markup_basis || 'BASE_PAY') : null,
      });
      toast.success('Agency updated successfully');
      setOpen(false);
      router.refresh();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || 'Failed to update agency');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button variant="outline" size="sm">Edit</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Agency</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Agency Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              placeholder="e.g. RevenuePatch Agency"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="merchant_name">Mercury Merchant Name</Label>
            <Input
              id="merchant_name"
              value={formData.merchant_name}
              onChange={(e) => setFormData({ ...formData, merchant_name: e.target.value })}
              placeholder="Exact name as it appears in Mercury (for auto-matching)"
            />
            <p className="text-xs text-muted-foreground">
              Used to automatically link Mercury transactions to this agency.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="start_date">Start Date</Label>
            <Input
              id="start_date"
              type="date"
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
            />
          </div>

          {/* Markup Configuration */}
          <div className="space-y-3 rounded-md border p-3">
            <Label className="text-sm font-medium">Default Markup Configuration</Label>
            <div className="space-y-2">
              <Label htmlFor="markup_type" className="text-xs text-muted-foreground">Markup Type</Label>
              <Select
                value={formData.markup_type || 'NONE'}
                onValueChange={(value) => {
                  if (value === 'NONE') {
                    setFormData({ ...formData, markup_type: '', markup_value: '', markup_basis: 'BASE_PAY' });
                  } else {
                    setFormData({ ...formData, markup_type: value });
                  }
                }}
              >
                <SelectTrigger id="markup_type">
                  <SelectValue placeholder="No markup" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">No Markup</SelectItem>
                  <SelectItem value="PERCENTAGE">Percentage</SelectItem>
                  <SelectItem value="FLAT_RATE">Flat Rate</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.markup_type && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="markup_value" className="text-xs text-muted-foreground">
                    {formData.markup_type === 'PERCENTAGE' ? 'Markup Percentage (%)' : 'Flat Rate Amount ($)'}
                  </Label>
                  <Input
                    id="markup_value"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.markup_value}
                    onChange={(e) => setFormData({ ...formData, markup_value: e.target.value })}
                    placeholder={formData.markup_type === 'PERCENTAGE' ? 'e.g. 30' : 'e.g. 15.00'}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="markup_basis" className="text-xs text-muted-foreground">Markup Basis</Label>
                  <Select
                    value={formData.markup_basis}
                    onValueChange={(value) => setFormData({ ...formData, markup_basis: value })}
                  >
                    <SelectTrigger id="markup_basis">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BASE_PAY">Base Pay Only</SelectItem>
                      <SelectItem value="TOTAL_COMPENSATION">Total Compensation</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {formData.markup_basis === 'TOTAL_COMPENSATION'
                      ? 'Markup applies to base pay + expenses + reimbursements'
                      : 'Markup applies to base pay only'}
                  </p>
                </div>

                <p className="text-xs font-medium text-blue-600">
                  {formData.markup_type === 'PERCENTAGE' && formData.markup_value
                    ? `${formData.markup_value}% markup on ${formData.markup_basis === 'TOTAL_COMPENSATION' ? 'total compensation' : 'base pay'}`
                    : formData.markup_type === 'FLAT_RATE' && formData.markup_value
                      ? `$${formData.markup_value} flat rate markup`
                      : ''}
                </p>
              </>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
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
