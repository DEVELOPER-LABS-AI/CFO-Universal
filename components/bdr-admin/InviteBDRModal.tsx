'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getBDRStaff } from '@/app/actions/bdr-admin-actions';
import { inviteUser } from '@/app/actions/user-management';
import { toast } from 'sonner';

interface InviteBDRModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

/**
 * Modal for inviting a BDR to the portal.
 * Selects an existing staff member with staff_type='BDR' and sends an invite.
 */
export function InviteBDRModal({ open, onOpenChange, onSuccess }: InviteBDRModalProps) {
  const [bdrStaff, setBdrStaff] = useState<{ id: string; name: string }[]>([]);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      getBDRStaff().then((result) => {
        if (result.success) setBdrStaff(result.data);
      });
    }
  }, [open]);

  /** Auto-fill name when a staff member is selected. */
  const handleStaffSelect = (staffId: string) => {
    setSelectedStaffId(staffId);
    const staff = bdrStaff.find((s) => s.id === staffId);
    if (staff) {
      setFullName(staff.name);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const result = await inviteUser({
      email,
      full_name: fullName,
      role: 'BDR',
      bdr_staff_id: selectedStaffId,
    });

    if (result.success) {
      toast.success('BDR invitation sent');
      onOpenChange(false);
      setEmail('');
      setFullName('');
      setSelectedStaffId('');
      onSuccess();
    } else {
      toast.error(result.error || 'Failed to send invitation');
    }

    setIsSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Invite BDR to Portal</DialogTitle>
          <DialogDescription>
            Select a BDR staff member and send them a portal invitation
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>BDR Staff Member</Label>
            <Select value={selectedStaffId} onValueChange={handleStaffSelect} required>
              <SelectTrigger>
                <SelectValue placeholder="Select BDR..." />
              </SelectTrigger>
              <SelectContent>
                {bdrStaff.map((staff) => (
                  <SelectItem key={staff.id} value={staff.id}>
                    {staff.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bdr-email">Email</Label>
            <Input
              id="bdr-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="bdr@company.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bdr-name">Full Name</Label>
            <Input
              id="bdr-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Full name"
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !selectedStaffId || !email}>
              {isSubmitting ? 'Sending...' : 'Send Invitation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
