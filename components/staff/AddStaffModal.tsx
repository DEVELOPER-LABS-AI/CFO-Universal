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
import { createStaff } from '@/app/actions/staff-management';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils/error';

interface AgencyWithMarkup {
  id: string;
  name: string;
  markup_type?: string | null;
  markup_value?: number | string | null;
  markup_basis?: string | null;
}

interface AddStaffModalProps {
  trigger: React.ReactNode;
  agencies?: AgencyWithMarkup[];
  contractors?: Array<{ id: string; name: string }>;
  roles?: Array<{ name: string; display_name: string }>;
}

export function AddStaffModal({ trigger, agencies = [], contractors = [], roles = [] }: AddStaffModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    staff_type: '',
    association: 'direct' as 'direct' | 'agency' | 'contractor',
    rate: '',
    rate_type: '',
    engagement_type: '',
    agency_id: '',
    contractor_id: '',
    // Feature 14: True cost fields
    true_cost: '',
    true_cost_rate_type: '',
    rate_locked: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const agencyId = formData.association === 'agency' ? formData.agency_id : null;
      const contractorId = formData.association === 'contractor' ? formData.contractor_id : null;

      const isAgency = formData.association === 'agency';
      await createStaff({
        name: formData.name,
        staff_type: formData.staff_type,
        rate: parseFloat(formData.rate),
        rate_type: formData.rate_type,
        engagement_type: formData.engagement_type,
        agency_id: agencyId || null,
        contractor_id: contractorId || null,
        // Feature 14: True cost fields (agency staff only)
        ...(isAgency && formData.true_cost && {
          true_cost: parseFloat(formData.true_cost),
          true_cost_rate_type: formData.true_cost_rate_type || formData.rate_type,
          rate_locked: formData.rate_locked,
        }),
      });

      toast.success(`${formData.name} added successfully`);
      setOpen(false);
      setFormData({
        name: '',
        staff_type: '',
        association: 'direct',
        rate: '',
        rate_type: '',
        engagement_type: '',
        agency_id: '',
        contractor_id: '',
        true_cost: '',
        true_cost_rate_type: '',
        rate_locked: false,
      });
      router.refresh();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || 'Failed to add staff member');
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
            <DialogTitle>Add Staff Member</DialogTitle>
            <DialogDescription>
              Add a new team member and associate them with Developer Labs, an agency, or a contractor
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="John Smith"
                required
              />
            </div>

            {/* Role */}
            <div className="space-y-2">
              <Label htmlFor="staff_type">Role *</Label>
              <Select value={formData.staff_type} onValueChange={(value) => setFormData({ ...formData, staff_type: value })}>
                <SelectTrigger id="staff_type">
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
              <Label htmlFor="association">Association *</Label>
              <Select
                value={formData.association}
                onValueChange={(value: 'direct' | 'agency' | 'contractor') =>
                  setFormData({ ...formData, association: value, agency_id: '', contractor_id: '' })
                }
              >
                <SelectTrigger id="association">
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
                <Label htmlFor="agency_id">Agency *</Label>
                <Select value={formData.agency_id} onValueChange={(value) => setFormData({ ...formData, agency_id: value })}>
                  <SelectTrigger id="agency_id">
                    <SelectValue placeholder="Select agency" />
                  </SelectTrigger>
                  <SelectContent>
                    {agencies.length === 0 ? (
                      <SelectItem value="" disabled>No agencies found - create one first</SelectItem>
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
                <Label htmlFor="contractor_id">Contractor *</Label>
                <Select value={formData.contractor_id} onValueChange={(value) => setFormData({ ...formData, contractor_id: value })}>
                  <SelectTrigger id="contractor_id">
                    <SelectValue placeholder="Select contractor" />
                  </SelectTrigger>
                  <SelectContent>
                    {contractors.length === 0 ? (
                      <SelectItem value="" disabled>No contractors found - create one first</SelectItem>
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

            {/* True Cost (agency staff only) */}
            {formData.association === 'agency' && (
              <div className="space-y-3 rounded-md border p-3">
                <Label className="text-sm font-medium">Agency Cost Details</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="true_cost" className="text-xs text-muted-foreground">True Cost (Agency Pays) *</Label>
                    <Input
                      id="true_cost"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.true_cost}
                      onChange={(e) => setFormData({ ...formData, true_cost: e.target.value })}
                      placeholder="3500.00"
                      required={formData.association === 'agency'}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="true_cost_rate_type" className="text-xs text-muted-foreground">Cost Rate Type *</Label>
                    <Select
                      value={formData.true_cost_rate_type || formData.rate_type}
                      onValueChange={(value) => setFormData({ ...formData, true_cost_rate_type: value })}
                    >
                      <SelectTrigger id="true_cost_rate_type">
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
                {(() => {
                  const selectedAgency = agencies.find((a) => a.id === formData.agency_id);
                  if (selectedAgency?.markup_type && selectedAgency?.markup_value && formData.true_cost) {
                    const markupVal = Number(selectedAgency.markup_value);
                    const trueCostVal = parseFloat(formData.true_cost);
                    let computedRate = trueCostVal;
                    if (selectedAgency.markup_type === 'PERCENTAGE') {
                      computedRate = trueCostVal * (1 + markupVal / 100);
                    } else {
                      computedRate = trueCostVal + markupVal;
                    }
                    return (
                      <p className="text-xs text-muted-foreground">
                        Calculated bill rate: <span className="font-medium text-foreground">${computedRate.toFixed(2)}</span>
                        {' '}({selectedAgency.markup_type === 'PERCENTAGE' ? `${markupVal}% markup` : `+$${markupVal} flat`})
                      </p>
                    );
                  }
                  return null;
                })()}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="rate_locked"
                    checked={formData.rate_locked}
                    onChange={(e) => setFormData({ ...formData, rate_locked: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="rate_locked" className="text-xs text-muted-foreground cursor-pointer">
                    Lock bill rate (manual entry, ignore markup)
                  </Label>
                </div>
              </div>
            )}

            {/* Rate */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rate">
                  {formData.association === 'agency' ? 'Bill Rate (You Pay) *' : 'Rate *'}
                </Label>
                <Input
                  id="rate"
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
                <Label htmlFor="rate_type">Rate Type *</Label>
                <Select value={formData.rate_type} onValueChange={(value) => setFormData({ ...formData, rate_type: value })}>
                  <SelectTrigger id="rate_type">
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
              <Label htmlFor="engagement_type">Engagement Type *</Label>
              <Select value={formData.engagement_type} onValueChange={(value) => setFormData({ ...formData, engagement_type: value })}>
                <SelectTrigger id="engagement_type">
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
              {isSubmitting ? 'Adding...' : 'Add Staff Member'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
