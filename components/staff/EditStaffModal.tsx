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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { updateStaff } from '@/app/actions/staff-management';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils/error';

interface EditStaffModalProps {
  staff: any;
  agencies?: any[];
  contractors?: Array<{ id: string; name: string }>;
  roles?: Array<{ name: string; display_name: string }>;
  trigger?: React.ReactNode;
}

export function EditStaffModal({ staff, agencies = [], contractors = [], roles = [], trigger }: EditStaffModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: staff.name ?? '',
    staff_type: staff.staff_type ?? '',
    association: (staff.contractor_id ? 'contractor' : staff.agency_id ? 'agency' : 'direct') as 'direct' | 'agency' | 'contractor',
    rate: staff.rate !== undefined && staff.rate !== null ? String(Number(staff.rate)) : '',
    rate_type: staff.rate_type ?? '',
    engagement_type: staff.engagement_type ?? '',
    agency_id: staff.agency_id ?? '',
    contractor_id: staff.contractor_id ?? '',
    // Feature 14: True cost and markup override fields
    true_cost: staff.true_cost != null ? String(Number(staff.true_cost)) : '',
    true_cost_rate_type: staff.true_cost_rate_type ?? '',
    markup_override_type: staff.markup_override_type ?? '',
    markup_override_value: staff.markup_override_value != null ? String(Number(staff.markup_override_value)) : '',
    rate_locked: staff.rate_locked ?? false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const agencyId = formData.association === 'agency' ? formData.agency_id : null;
      const contractorId = formData.association === 'contractor' ? formData.contractor_id : null;

      const isAgency = formData.association === 'agency';
      await updateStaff(staff.id, {
        name: formData.name,
        staff_type: formData.staff_type,
        rate: parseFloat(formData.rate),
        rate_type: formData.rate_type,
        engagement_type: formData.engagement_type,
        agency_id: agencyId || null,
        contractor_id: contractorId || null,
        // Feature 14: True cost and markup override
        ...(isAgency && {
          true_cost: formData.true_cost ? parseFloat(formData.true_cost) : null,
          true_cost_rate_type: formData.true_cost_rate_type || null,
          markup_override_type: formData.markup_override_type || null,
          markup_override_value: formData.markup_override_value ? parseFloat(formData.markup_override_value) : null,
          rate_locked: formData.rate_locked,
        }),
      });

      toast.success(`${formData.name} updated successfully`);
      setOpen(false);
      router.refresh();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || 'Failed to update staff member');
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
            <DialogTitle>Edit Staff Member</DialogTitle>
            <DialogDescription>
              Update details for {staff.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="John Smith"
                required
              />
            </div>

            {/* Role */}
            <div className="space-y-2">
              <Label htmlFor="edit-staff_type">Role *</Label>
              <Select
                value={formData.staff_type}
                onValueChange={(value) => setFormData({ ...formData, staff_type: value })}
              >
                <SelectTrigger id="edit-staff_type">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.name} value={role.name}>
                      {role.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Association */}
            <div className="space-y-2">
              <Label htmlFor="edit-association">Association *</Label>
              <Select
                value={formData.association}
                onValueChange={(value: 'direct' | 'agency' | 'contractor') =>
                  setFormData({ ...formData, association: value, agency_id: '', contractor_id: '' })
                }
              >
                <SelectTrigger id="edit-association">
                  <SelectValue placeholder="Select association" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="direct">Developer Labs (Direct)</SelectItem>
                  <SelectItem value="agency">Agency Partner</SelectItem>
                  <SelectItem value="contractor">Contractor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Agency (conditional) */}
            {formData.association === 'agency' && (
              <div className="space-y-2">
                <Label htmlFor="edit-agency_id">Agency *</Label>
                <Select
                  value={formData.agency_id}
                  onValueChange={(value) => setFormData({ ...formData, agency_id: value })}
                >
                  <SelectTrigger id="edit-agency_id">
                    <SelectValue placeholder="Select agency" />
                  </SelectTrigger>
                  <SelectContent>
                    {agencies.length === 0 ? (
                      <SelectItem value="" disabled>No agencies found</SelectItem>
                    ) : (
                      agencies.map((agency) => (
                        <SelectItem key={agency.id} value={agency.id}>
                          {agency.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Contractor (conditional) */}
            {formData.association === 'contractor' && (
              <div className="space-y-2">
                <Label htmlFor="edit-contractor_id">Contractor *</Label>
                <Select
                  value={formData.contractor_id}
                  onValueChange={(value) => setFormData({ ...formData, contractor_id: value })}
                >
                  <SelectTrigger id="edit-contractor_id">
                    <SelectValue placeholder="Select contractor" />
                  </SelectTrigger>
                  <SelectContent>
                    {contractors.length === 0 ? (
                      <SelectItem value="" disabled>No contractors found</SelectItem>
                    ) : (
                      contractors.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* True Cost & Markup Override (agency staff only) */}
            {formData.association === 'agency' && (
              <div className="space-y-3 rounded-md border p-3">
                <Label className="text-sm font-medium">Agency Cost Details</Label>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-true_cost" className="text-xs text-muted-foreground">True Cost (Agency Pays)</Label>
                    <Input
                      id="edit-true_cost"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.true_cost}
                      onChange={(e) => setFormData({ ...formData, true_cost: e.target.value })}
                      placeholder="3500.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-true_cost_rate_type" className="text-xs text-muted-foreground">Cost Rate Type</Label>
                    <Select
                      value={formData.true_cost_rate_type || formData.rate_type}
                      onValueChange={(value) => setFormData({ ...formData, true_cost_rate_type: value })}
                    >
                      <SelectTrigger id="edit-true_cost_rate_type">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="HOURLY">Hourly</SelectItem>
                        <SelectItem value="DAILY">Daily</SelectItem>
                        <SelectItem value="MONTHLY">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Margin display */}
                {formData.true_cost && formData.rate && (
                  <div className="text-xs">
                    {(() => {
                      const tc = parseFloat(formData.true_cost);
                      const br = parseFloat(formData.rate);
                      if (isNaN(tc) || isNaN(br) || tc === 0) return null;
                      const margin = br - tc;
                      const marginPct = ((margin / tc) * 100).toFixed(1);
                      return (
                        <p className={margin < 0 ? 'text-red-600 font-medium' : 'text-muted-foreground'}>
                          Margin: ${margin.toFixed(2)} ({marginPct}%)
                          {margin < 0 && ' - Negative margin'}
                        </p>
                      );
                    })()}
                  </div>
                )}

                {/* Rate Lock */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="edit-rate_locked"
                    checked={formData.rate_locked}
                    onChange={(e) => setFormData({ ...formData, rate_locked: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="edit-rate_locked" className="text-xs text-muted-foreground cursor-pointer">
                    Lock bill rate (ignore markup changes)
                  </Label>
                </div>

                {/* Markup Override */}
                <details className="text-sm">
                  <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                    Override Markup {formData.markup_override_type ? '(Active)' : '(Agency Default)'}
                  </summary>
                  <div className="mt-2 space-y-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label htmlFor="edit-markup_override_type" className="text-xs text-muted-foreground">Type</Label>
                        <Select
                          value={formData.markup_override_type || 'NONE'}
                          onValueChange={(value) => {
                            if (value === 'NONE') {
                              setFormData({ ...formData, markup_override_type: '', markup_override_value: '' });
                            } else {
                              setFormData({ ...formData, markup_override_type: value });
                            }
                          }}
                        >
                          <SelectTrigger id="edit-markup_override_type">
                            <SelectValue placeholder="Agency Default" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="NONE">Agency Default</SelectItem>
                            <SelectItem value="PERCENTAGE">Percentage</SelectItem>
                            <SelectItem value="FLAT_RATE">Flat Rate</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {formData.markup_override_type && (
                        <div className="space-y-1">
                          <Label htmlFor="edit-markup_override_value" className="text-xs text-muted-foreground">
                            {formData.markup_override_type === 'PERCENTAGE' ? 'Percentage (%)' : 'Amount ($)'}
                          </Label>
                          <Input
                            id="edit-markup_override_value"
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData.markup_override_value}
                            onChange={(e) => setFormData({ ...formData, markup_override_value: e.target.value })}
                            placeholder={formData.markup_override_type === 'PERCENTAGE' ? '25' : '15.00'}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </details>
              </div>
            )}

            {/* Rate */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-rate">
                  {formData.association === 'agency' ? 'Bill Rate (You Pay) *' : 'Rate *'}
                </Label>
                <Input
                  id="edit-rate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.rate}
                  onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                  placeholder="5000.00"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-rate_type">Rate Type *</Label>
                <Select
                  value={formData.rate_type}
                  onValueChange={(value) => setFormData({ ...formData, rate_type: value })}
                >
                  <SelectTrigger id="edit-rate_type">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HOURLY">Hourly</SelectItem>
                    <SelectItem value="DAILY">Daily</SelectItem>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Engagement Type */}
            <div className="space-y-2">
              <Label htmlFor="edit-engagement_type">Engagement Type *</Label>
              <Select
                value={formData.engagement_type}
                onValueChange={(value) => setFormData({ ...formData, engagement_type: value })}
              >
                <SelectTrigger id="edit-engagement_type">
                  <SelectValue placeholder="Select engagement type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FULL_TIME">Full Time</SelectItem>
                  <SelectItem value="PART_TIME">Part Time</SelectItem>
                  <SelectItem value="PROJECT">Project Based</SelectItem>
                  <SelectItem value="OWNER">Owner</SelectItem>
                  <SelectItem value="AGENCY">Agency</SelectItem>
                </SelectContent>
              </Select>
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
