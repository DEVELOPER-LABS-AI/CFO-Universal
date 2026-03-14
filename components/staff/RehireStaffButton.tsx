'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserCheck } from 'lucide-react';
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
import { rehireStaff } from '@/app/actions/staff-management';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils/error';

interface RehireStaffButtonProps {
  staffId: string;
  staffName: string;
}

export function RehireStaffButton({ staffId, staffName }: RehireStaffButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await rehireStaff({ staff_id: staffId });
      toast.success(`${staffName} has been rehired`);
      setOpen(false);
      router.refresh();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || 'Failed to rehire staff member');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="text-green-600 hover:text-green-700">
          <UserCheck className="mr-2 h-4 w-4" />
          Rehire
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rehire Staff Member</DialogTitle>
          <DialogDescription>
            This will reactivate <span className="font-semibold">{staffName}</span> and set their status back to Active.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Previous assignments will remain in history. You can create new assignments after rehiring.
        </p>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? 'Rehiring...' : 'Confirm Rehire'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
