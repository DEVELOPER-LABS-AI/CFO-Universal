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
import { addAgencyReimbursement } from '@/app/actions/agency-portal-actions';

interface AddReimbursementPortalModalProps {
  trigger: React.ReactNode;
  staffList: Array<{ id: string; name: string }>;
}

const REIMBURSEMENT_TYPES = [
  { value: 'TRAVEL', label: 'Travel' },
  { value: 'MEALS', label: 'Meals' },
  { value: 'SUPPLIES', label: 'Supplies' },
  { value: 'EQUIPMENT', label: 'Equipment' },
  { value: 'SOFTWARE', label: 'Software' },
  { value: 'PROFESSIONAL_DEV', label: 'Professional Development' },
  { value: 'OTHER', label: 'Other' },
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
 * Dialog modal for adding a reimbursement to an agency staff member.
 * Used in the agency portal (calls addAgencyReimbursement action).
 */
export function AddReimbursementPortalModal({ trigger, staffList }: AddReimbursementPortalModalProps) {
  const router = useRouter();
  const now = new Date();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    staff_id: '',
    reimbursement_type: 'TRAVEL',
    amount: '',
    description: '',
    month: String(now.getMonth() + 1),
    year: String(now.getFullYear()),
  });

  function resetForm() {
    setFormData({
      staff_id: '',
      reimbursement_type: 'TRAVEL',
      amount: '',
      description: '',
      month: String(now.getMonth() + 1),
      year: String(now.getFullYear()),
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    try {
      await addAgencyReimbursement({
        staff_id: formData.staff_id,
        reimbursement_type: formData.reimbursement_type,
        amount: Number(formData.amount),
        description: formData.description || undefined,
        month: Number(formData.month),
        year: Number(formData.year),
      });
      toast.success('Reimbursement has been added');
      resetForm();
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to add reimbursement'
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
            <DialogTitle>Add Reimbursement</DialogTitle>
            <DialogDescription>
              Submit an expense reimbursement for a staff member.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="reimb-staff">Staff Member</Label>
              <Select
                value={formData.staff_id}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, staff_id: value }))
                }
                required
              >
                <SelectTrigger id="reimb-staff">
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
              <Label htmlFor="reimb-type">Reimbursement Type</Label>
              <Select
                value={formData.reimbursement_type}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, reimbursement_type: value }))
                }
              >
                <SelectTrigger id="reimb-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {REIMBURSEMENT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="reimb-amount">Amount</Label>
              <Input
                id="reimb-amount"
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
              <Label htmlFor="reimb-description">Description (optional)</Label>
              <Textarea
                id="reimb-description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="What is this reimbursement for..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="reimb-month">Month</Label>
                <Select
                  value={formData.month}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, month: value }))
                  }
                >
                  <SelectTrigger id="reimb-month">
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
                <Label htmlFor="reimb-year">Year</Label>
                <Input
                  id="reimb-year"
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
              {submitting ? 'Adding...' : 'Add Reimbursement'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
