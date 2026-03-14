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

interface AvailableContractor {
  id: string;
  name: string;
  utilization: number;
}

interface AssignContractorToClientModalProps {
  trigger: React.ReactNode;
  clientId: string;
  clientName: string;
  availableContractors: AvailableContractor[];
}

/**
 * Modal to assign a contractor to a specific client (client -> contractor direction).
 * Used on the client detail page.
 */
export function AssignContractorToClientModal({
  trigger,
  clientId,
  clientName,
  availableContractors,
}: AssignContractorToClientModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedContractorId, setSelectedContractorId] = useState('');
  const [allocationPercentage, setAllocationPercentage] = useState('');

  const selectedContractor = availableContractors.find((c) => c.id === selectedContractorId);
  const currentUtilization = selectedContractor?.utilization ?? 0;
  const remainingCapacity = 100 - currentUtilization;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedContractorId) {
      toast.error('Please select a contractor');
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
        contractor_id: selectedContractorId,
        client_id: clientId,
        allocation_percentage: allocation,
        start_date: new Date(),
      });

      toast.success(`Assigned ${selectedContractor?.name} to ${clientName}`);
      setOpen(false);
      setSelectedContractorId('');
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
            <DialogTitle>Assign Contractor to {clientName}</DialogTitle>
            <DialogDescription>
              Select a contractor and set their allocation percentage for this client
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Contractor Selection */}
            <div className="space-y-2">
              <Label htmlFor="contractor-select">Contractor *</Label>
              {availableContractors.length === 0 ? (
                <p className="text-sm text-muted-foreground">No contractors available.</p>
              ) : (
                <Select value={selectedContractorId} onValueChange={setSelectedContractorId}>
                  <SelectTrigger id="contractor-select">
                    <SelectValue placeholder="Select a contractor" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableContractors.map((contractor) => (
                      <SelectItem key={contractor.id} value={contractor.id}>
                        {contractor.name} - {contractor.utilization}% utilized
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Current Utilization Info */}
            {selectedContractor && (
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
            )}

            {/* Allocation Percentage */}
            <div className="space-y-2">
              <Label htmlFor="allocation">Allocation Percentage *</Label>
              <Input
                id="allocation"
                type="number"
                min="1"
                max={selectedContractor ? remainingCapacity : 100}
                step="1"
                placeholder={`e.g. ${selectedContractor ? Math.min(100, remainingCapacity) : 100}`}
                value={allocationPercentage}
                onChange={(e) => setAllocationPercentage(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Percentage of this contractor&apos;s time allocated to {clientName}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                isSubmitting ||
                !selectedContractorId ||
                availableContractors.length === 0 ||
                (selectedContractor && remainingCapacity <= 0)
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
