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
import { createAgency } from '@/app/actions/agency-management';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils/error';

interface AddAgencyModalProps {
  trigger: React.ReactNode;
  onCreated?: (agency: { id: string; name: string }) => void;
}

// T118: AddAgencyModal component
export function AddAgencyModal({ trigger, onCreated }: AddAgencyModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    start_date: new Date().toISOString().split('T')[0],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const agency = await createAgency({
        name: formData.name,
        start_date: new Date(formData.start_date),
      });

      toast.success(`${formData.name} added successfully`);
      onCreated?.({ id: agency.id, name: agency.name });
      setOpen(false);
      setFormData({
        name: '',
        start_date: new Date().toISOString().split('T')[0],
      });
      router.refresh();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || 'Failed to add agency');
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
            <DialogTitle>Add Agency Partner</DialogTitle>
            <DialogDescription>
              Add a new agency partner to track variable monthly staffing breakdowns
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Agency Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Agency Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="XYZ Staffing Agency"
                required
              />
            </div>

            {/* Start Date */}
            <div className="space-y-2">
              <Label htmlFor="start_date">Partnership Start Date *</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Adding...' : 'Add Agency'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
