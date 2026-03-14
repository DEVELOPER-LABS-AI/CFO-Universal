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
import { updateAgencyStaff } from '@/app/actions/agency-portal-actions';

interface EditStaffModalProps {
  trigger: React.ReactNode;
  staff: {
    id: string;
    name: string;
    staff_type: string;
    rate: unknown;
    rate_type: string;
    engagement_type: string;
  };
}

/**
 * Dialog modal for editing an existing staff member.
 * Pre-populates fields with current staff data.
 */
export function EditStaffModal({ trigger, staff }: EditStaffModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: staff.name,
    staff_type: staff.staff_type,
    rate: String(staff.rate),
    rate_type: staff.rate_type,
    engagement_type: staff.engagement_type,
  });

  /**
   * Handles form submission to update the staff member.
   */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    try {
      await updateAgencyStaff(staff.id, {
        name: formData.name,
        staff_type: formData.staff_type,
        rate: Number(formData.rate),
        rate_type: formData.rate_type,
        engagement_type: formData.engagement_type,
      });
      toast.success(`${formData.name} has been updated`);
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to update staff member'
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
            <DialogTitle>Edit Staff Member</DialogTitle>
            <DialogDescription>
              Update details for {staff.name}.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-staff-name">Name</Label>
              <Input
                id="edit-staff-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Full name"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-staff-role">Role</Label>
              <Input
                id="edit-staff-role"
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
              <Label htmlFor="edit-staff-rate">Rate</Label>
              <Input
                id="edit-staff-rate"
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
              <Label htmlFor="edit-staff-rate-type">Rate Type</Label>
              <Select
                value={formData.rate_type}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, rate_type: value }))
                }
              >
                <SelectTrigger id="edit-staff-rate-type">
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
              <Label htmlFor="edit-staff-engagement">Engagement Type</Label>
              <Select
                value={formData.engagement_type}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, engagement_type: value }))
                }
              >
                <SelectTrigger id="edit-staff-engagement">
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
              {submitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
