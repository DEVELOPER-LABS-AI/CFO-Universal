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
import { toast } from 'sonner';
import { addAgencyStaff } from '@/app/actions/agency-portal-actions';

interface AddStaffModalProps {
  trigger: React.ReactNode;
}

/**
 * Dialog modal for adding a new staff member to the agency.
 * Collects name, role, rate, rate type, and engagement type.
 */
export function AddStaffModal({ trigger }: AddStaffModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    staff_type: '',
    rate: '',
    rate_type: 'HOURLY',
    engagement_type: 'AGENCY',
  });

  /**
   * Resets the form fields to their defaults.
   */
  function resetForm() {
    setFormData({
      name: '',
      staff_type: '',
      rate: '',
      rate_type: 'HOURLY',
      engagement_type: 'AGENCY',
    });
  }

  /**
   * Handles form submission to create a new staff member.
   */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    try {
      await addAgencyStaff({
        name: formData.name,
        staff_type: formData.staff_type,
        rate: Number(formData.rate),
        rate_type: formData.rate_type,
        engagement_type: formData.engagement_type,
      });
      toast.success(`${formData.name} has been added`);
      resetForm();
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to add staff member'
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
            <DialogTitle>Add Staff Member</DialogTitle>
            <DialogDescription>
              Add a new staff member to your agency.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="add-staff-name">Name</Label>
              <Input
                id="add-staff-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Full name"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="add-staff-role">Role</Label>
              <Input
                id="add-staff-role"
                value={formData.staff_type}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    staff_type: e.target.value,
                  }))
                }
                placeholder="e.g. Designer, Developer, PM"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="add-staff-rate">Rate</Label>
              <Input
                id="add-staff-rate"
                type="number"
                min="0"
                step="0.01"
                value={formData.rate}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, rate: e.target.value }))
                }
                placeholder="0.00"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="add-staff-rate-type">Rate Type</Label>
              <Select
                value={formData.rate_type}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, rate_type: value }))
                }
              >
                <SelectTrigger id="add-staff-rate-type">
                  <SelectValue placeholder="Select rate type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HOURLY">Hourly</SelectItem>
                  <SelectItem value="DAILY">Daily</SelectItem>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="add-staff-engagement">Engagement Type</Label>
              <Select
                value={formData.engagement_type}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, engagement_type: value }))
                }
              >
                <SelectTrigger id="add-staff-engagement">
                  <SelectValue placeholder="Select engagement type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AGENCY">Agency</SelectItem>
                  <SelectItem value="CONTRACT">Contract</SelectItem>
                  <SelectItem value="FULL_TIME">Full Time</SelectItem>
                  <SelectItem value="PART_TIME">Part Time</SelectItem>
                </SelectContent>
              </Select>
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
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Adding...' : 'Add Staff'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
