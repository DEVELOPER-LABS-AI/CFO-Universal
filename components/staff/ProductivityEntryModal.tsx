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
import { recordBDRProductivity } from '@/app/actions/productivity-management';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils/error';

interface ProductivityEntryModalProps {
  bdrId: string;
  bdrName: string;
  trigger: React.ReactNode;
  clients?: Array<{ id: string; name: string }>;
}

// T092: ProductivityEntryModal component for BDR metrics
export function ProductivityEntryModal({
  bdrId,
  bdrName,
  trigger,
  clients = [],
}: ProductivityEntryModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentDate = new Date();
  const [formData, setFormData] = useState({
    client_id: 'none',
    month: currentDate.getMonth() + 1,
    year: currentDate.getFullYear(),
    meetings_attended: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await recordBDRProductivity({
        bdr_id: bdrId,
        client_id: formData.client_id === 'none' ? null : formData.client_id,
        month: formData.month,
        year: formData.year,
        meetings_attended: parseInt(formData.meetings_attended),
      });

      toast.success('Productivity recorded successfully');
      setOpen(false);
      setFormData({
        client_id: 'none',
        month: currentDate.getMonth() + 1,
        year: currentDate.getFullYear(),
        meetings_attended: '',
      });
      router.refresh();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || 'Failed to record productivity');
    } finally {
      setIsSubmitting(false);
    }
  };

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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Record BDR Productivity</DialogTitle>
            <DialogDescription>
              Record meeting attendance for {bdrName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
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

            {/* Client (optional) */}
            <div className="space-y-2">
              <Label htmlFor="client_id">
                Client (Optional)
                <span className="text-xs text-muted-foreground ml-2">
                  Leave blank for overall metrics
                </span>
              </Label>
              <Select
                value={formData.client_id}
                onValueChange={(value) => setFormData({ ...formData, client_id: value })}
              >
                <SelectTrigger id="client_id">
                  <SelectValue placeholder="All clients (aggregate)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">All clients (aggregate)</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Meetings Attended */}
            <div className="space-y-2">
              <Label htmlFor="meetings_attended">
                Meetings Attended *
                <span className="text-xs text-muted-foreground ml-2">
                  Qualified meetings that showed up
                </span>
              </Label>
              <Input
                id="meetings_attended"
                type="number"
                min="0"
                value={formData.meetings_attended}
                onChange={(e) => setFormData({ ...formData, meetings_attended: e.target.value })}
                placeholder="0"
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Recording...' : 'Record Productivity'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
