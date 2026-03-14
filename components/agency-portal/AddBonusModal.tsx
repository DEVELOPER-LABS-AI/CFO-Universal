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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { addAgencyBonus } from '@/app/actions/agency-portal-actions';

interface AddBonusModalProps {
  trigger: React.ReactNode;
  staffList: Array<{ id: string; name: string }>;
}

const BONUS_TYPES = [
  'PERFORMANCE',
  'SIGNING',
  'REFERRAL',
  'RETENTION',
  'QUARTERLY',
  'ANNUAL',
  'SPOT',
  'OTHER',
] as const;

const MONTHS = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
] as const;

/**
 * Dialog modal for adding a bonus to an agency staff member.
 * Allows selecting the staff member, bonus type, amount, and period.
 */
export function AddBonusModal({ trigger, staffList }: AddBonusModalProps) {
  const router = useRouter();
  const now = new Date();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    staff_id: '',
    bonus_type: 'PERFORMANCE',
    amount: '',
    description: '',
    month: String(now.getMonth() + 1),
    year: String(now.getFullYear()),
  });

  /**
   * Resets the form fields to their defaults.
   */
  function resetForm() {
    setFormData({
      staff_id: '',
      bonus_type: 'PERFORMANCE',
      amount: '',
      description: '',
      month: String(now.getMonth() + 1),
      year: String(now.getFullYear()),
    });
  }

  /**
   * Handles form submission to create a new bonus.
   */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    try {
      await addAgencyBonus({
        staff_id: formData.staff_id,
        bonus_type: formData.bonus_type,
        amount: Number(formData.amount),
        description: formData.description || undefined,
        month: Number(formData.month),
        year: Number(formData.year),
      });
      toast.success('Bonus has been added');
      resetForm();
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to add bonus'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Bonus</DialogTitle>
            <DialogDescription>
              Record a bonus for a staff member.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="bonus-staff">Staff Member</Label>
              <Select
                value={formData.staff_id}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, staff_id: value }))
                }
                required
              >
                <SelectTrigger id="bonus-staff">
                  <SelectValue placeholder="Select staff member" />
                </SelectTrigger>
                <SelectContent>
                  {staffList.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="bonus-type">Bonus Type</Label>
              <Select
                value={formData.bonus_type}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, bonus_type: value }))
                }
              >
                <SelectTrigger id="bonus-type">
                  <SelectValue placeholder="Select bonus type" />
                </SelectTrigger>
                <SelectContent>
                  {BONUS_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.charAt(0) + type.slice(1).toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="bonus-amount">Amount</Label>
              <Input
                id="bonus-amount"
                type="number"
                min="0"
                step="0.01"
                value={formData.amount}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, amount: e.target.value }))
                }
                placeholder="0.00"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="bonus-description">Description (optional)</Label>
              <Textarea
                id="bonus-description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Reason for the bonus..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="bonus-month">Month</Label>
                <Select
                  value={formData.month}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, month: value }))
                  }
                >
                  <SelectTrigger id="bonus-month">
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="bonus-year">Year</Label>
                <Input
                  id="bonus-year"
                  type="number"
                  min="2020"
                  max="2030"
                  value={formData.year}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, year: e.target.value }))
                  }
                  required
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !formData.staff_id}>
              {submitting ? 'Adding...' : 'Add Bonus'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
