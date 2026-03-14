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
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { assignContractorToClient } from '@/app/actions/contractor-management';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils/error';

interface AssignContractorToClientModalProps {
  trigger: React.ReactNode;
  contractorId: string;
  contractorName: string;
  currentUtilization: number;
  clients: Array<{ id: string; name: string }>;
}

/**
 * Modal to assign a contractor to a client with an allocation percentage.
 * Accessible from the contractors table row and contractor detail page.
 */
export function AssignContractorToClientModal({
  trigger,
  contractorId,
  contractorName,
  currentUtilization,
  clients,
}: AssignContractorToClientModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [allocationPercentage, setAllocationPercentage] = useState('');

  const remainingCapacity = 100 - currentUtilization;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedClientId) {
      toast.error('Please select a client');
      return;
    }

    const allocation = parseInt(allocationPercentage, 10);
    if (!allocation || allocation < 1 || allocation > 100) {
      toast.error('Allocation must be between 1 and 100');
      return;
    }

    if (allocation > remainingCapacity) {
      toast.error(
        `Only ${remainingCapacity}% capacity remaining. Cannot allocate ${allocation}%.`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await assignContractorToClient({
        contractor_id: contractorId,
        client_id: selectedClientId,
        allocation_percentage: allocation,
        start_date: new Date(),
      });

      const clientName = clients.find((c) => c.id === selectedClientId)?.name;
      toast.success(`Assigned ${contractorName} to ${clientName}`);
      setOpen(false);
      setSelectedClientId('');
      setAllocationPercentage('');
      router.refresh();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || 'Failed to create assignment');
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
            <DialogTitle>Assign {contractorName}</DialogTitle>
            <DialogDescription>
              Assign this contractor to a client and set their allocation percentage
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Current Utilization */}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Current utilization:</span>
              <Badge
                variant={
                  currentUtilization >= 100
                    ? 'destructive'
                    : currentUtilization > 0
                      ? 'default'
                      : 'secondary'
                }
              >
                {currentUtilization}%
              </Badge>
              {remainingCapacity > 0 && (
                <span className="text-muted-foreground">
                  ({remainingCapacity}% available)
                </span>
              )}
            </div>

            {/* Client Selection */}
            <div className="space-y-2">
              <Label htmlFor="client-select">Client *</Label>
              {clients.length === 0 ? (
                <p className="text-sm text-muted-foreground">No clients available.</p>
              ) : (
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger id="client-select">
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Allocation Percentage */}
            <div className="space-y-2">
              <Label htmlFor="allocation">Allocation Percentage *</Label>
              <Input
                id="allocation"
                type="number"
                min="1"
                max={remainingCapacity}
                step="1"
                placeholder={`e.g. ${Math.min(100, remainingCapacity)}`}
                value={allocationPercentage}
                onChange={(e) => setAllocationPercentage(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Percentage of this contractor&apos;s time allocated to the selected client
                (max {remainingCapacity}%)
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                isSubmitting ||
                !selectedClientId ||
                clients.length === 0 ||
                remainingCapacity <= 0
              }
            >
              {isSubmitting ? 'Assigning...' : 'Assign Contractor'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
