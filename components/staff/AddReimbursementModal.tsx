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
import { createStaffReimbursement } from '@/app/actions/reimbursement-management';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils/error';

interface AddReimbursementModalProps {
  staffId: string;
  staffName: string;
  trigger: React.ReactNode;
}

const REIMBURSEMENT_TYPE_OPTIONS = [
  { value: 'TRAVEL', label: 'Travel' },
  { value: 'MEALS', label: 'Meals' },
  { value: 'SUPPLIES', label: 'Supplies' },
  { value: 'EQUIPMENT', label: 'Equipment' },
  { value: 'SOFTWARE', label: 'Software' },
  { value: 'PROFESSIONAL_DEV', label: 'Professional Development' },
  { value: 'OTHER', label: 'Other' },
];

/**
 * Modal dialog for adding a reimbursement to a staff member.
 */
export function AddReimbursementModal({ staffId, staffName, trigger }: AddReimbursementModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentDate = new Date();
  const [formData, setFormData] = useState({
    reimbursement_type: '',
    amount: '',
    month: currentDate.getMonth() + 1,
    year: currentDate.getFullYear(),
    description: '',
  });

  const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
  ];

  const years = Array.from({ length: 3 }, (_, i) => currentDate.getFullYear() - i);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await createStaffReimbursement({
        staff_id: staffId,
        reimbursement_type: formData.reimbursement_type,
        amount: parseFloat(formData.amount),
        month: formData.month,
        year: formData.year,
        description: formData.description || null,
      });

      toast.success('Reimbursement added successfully');
      setOpen(false);
      setFormData({
        reimbursement_type: '',
        amount: '',
        month: currentDate.getMonth() + 1,
        year: currentDate.getFullYear(),
        description: '',
      });
      router.refresh();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || 'Failed to add reimbursement');
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
            <DialogTitle>Add Reimbursement</DialogTitle>
            <DialogDescription>
              Submit a reimbursement request for {staffName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Reimbursement Type */}
            <div className="space-y-2">
              <Label htmlFor="reimbursement_type">Type *</Label>
              <Select
                value={formData.reimbursement_type}
                onValueChange={(value) => setFormData({ ...formData, reimbursement_type: value })}
              >
                <SelectTrigger id="reimbursement_type">
                  <SelectValue placeholder="Select reimbursement type" />
                </SelectTrigger>
                <SelectContent>
                  {REIMBURSEMENT_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="amount">Amount ($) *</Label>
              <Input
                id="amount"
                type="number"
                min="0.01"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
                required
              />
            </div>

            {/* Period */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="month">Month *</Label>
                <Select
                  value={formData.month.toString()}
                  onValueChange={(value) => setFormData({ ...formData, month: parseInt(value) })}
                >
                  <SelectTrigger id="month">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((month) => (
                      <SelectItem key={month.value} value={month.value.toString()}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="year">Year *</Label>
                <Select
                  value={formData.year.toString()}
                  onValueChange={(value) => setFormData({ ...formData, year: parseInt(value) })}
                >
                  <SelectTrigger id="year">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">
                Description
                <span className="text-xs text-muted-foreground ml-2">Optional</span>
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="What is this reimbursement for..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !formData.reimbursement_type || !formData.amount}>
              {isSubmitting ? 'Adding...' : 'Add Reimbursement'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
