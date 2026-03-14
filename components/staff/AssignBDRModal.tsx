'use client';

import { useState, useEffect } from 'react';
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
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createStaffAssignment } from '@/app/actions/staff-management';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils/error';

// T085: AssignBDRModal component with multi-client allocation UI
// T086: Allocation remaining indicator using progress bar pattern
// T087: "Distribute Evenly" and "Allocate Remaining" bulk action buttons

interface AssignBDRModalProps {
  trigger: React.ReactNode;
  staffId: string;
  staffName: string;
  currentUtilization?: number;
  clients: Array<{ id: string; name: string; status: string }>;
}

interface ClientAllocation {
  id: string;
  clientId: string;
  clientName: string;
  allocationPercentage: number;
}

export function AssignBDRModal({
  trigger,
  staffId,
  staffName,
  currentUtilization = 0,
  clients,
}: AssignBDRModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allocations, setAllocations] = useState<ClientAllocation[]>([
    { id: '1', clientId: '', clientName: '', allocationPercentage: 0 },
  ]);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);

  const totalAllocated = allocations.reduce((sum, alloc) => sum + alloc.allocationPercentage, 0);
  const totalWithCurrent = currentUtilization + totalAllocated;
  const remaining = 100 - totalWithCurrent;
  const isOverAllocated = totalWithCurrent > 100;

  // T086: Allocation remaining indicator
  const getProgressColor = () => {
    if (totalWithCurrent > 100) return 'bg-red-600';
    if (totalWithCurrent > 80) return 'bg-yellow-600';
    return 'bg-green-600';
  };

  const addAllocation = () => {
    const newId = (allocations.length + 1).toString();
    setAllocations([...allocations, { id: newId, clientId: '', clientName: '', allocationPercentage: 0 }]);
  };

  const removeAllocation = (id: string) => {
    setAllocations(allocations.filter((alloc) => alloc.id !== id));
  };

  const updateAllocation = (id: string, field: 'clientId' | 'allocationPercentage', value: string | number) => {
    setAllocations(
      allocations.map((alloc) => {
        if (alloc.id === id) {
          if (field === 'clientId') {
            const client = clients.find((c) => c.id === value);
            return { ...alloc, clientId: value as string, clientName: client?.name || '' };
          } else {
            return { ...alloc, allocationPercentage: Number(value) };
          }
        }
        return alloc;
      })
    );
  };

  // T087: "Distribute Evenly" bulk action
  const distributeEvenly = () => {
    const validAllocations = allocations.filter((alloc) => alloc.clientId);
    if (validAllocations.length === 0) return;

    const perClient = Math.floor(remaining / validAllocations.length);

    setAllocations(
      allocations.map((alloc) => {
        if (alloc.clientId) {
          return { ...alloc, allocationPercentage: perClient };
        }
        return alloc;
      })
    );
  };

  // T087: "Allocate Remaining" bulk action
  const allocateRemaining = () => {
    const validAllocations = allocations.filter((alloc) => alloc.clientId);
    if (validAllocations.length === 0) return;

    // Find the first allocation and add all remaining to it
    const firstValidIndex = allocations.findIndex((alloc) => alloc.clientId);
    if (firstValidIndex === -1) return;

    setAllocations(
      allocations.map((alloc, index) => {
        if (index === firstValidIndex) {
          return { ...alloc, allocationPercentage: alloc.allocationPercentage + remaining };
        }
        return alloc;
      })
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const validAllocations = allocations.filter(
        (alloc) => alloc.clientId && alloc.allocationPercentage > 0
      );

      if (validAllocations.length === 0) {
        toast.error('Please add at least one client allocation');
        return;
      }

      // Create assignments for each client
      const results = await Promise.allSettled(
        validAllocations.map((alloc) =>
          createStaffAssignment({
            staff_id: staffId,
            client_id: alloc.clientId,
            allocation_percentage: alloc.allocationPercentage,
            start_date: new Date(startDate + 'T00:00:00'),
          })
        )
      );

      const successful = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      if (successful > 0) {
        toast.success(`Created ${successful} assignment(s) for ${staffName}`);
      }

      if (failed > 0) {
        toast.error(`Failed to create ${failed} assignment(s)`);
      }

      if (successful > 0) {
        setOpen(false);
        setAllocations([{ id: '1', clientId: '', clientName: '', allocationPercentage: 0 }]);
        setStartDate(new Date().toISOString().split('T')[0]);
        router.refresh();
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || 'Failed to create assignments');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Assign {staffName} to Clients</DialogTitle>
            <DialogDescription>
              Allocate this staff member's time across multiple clients
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Current Utilization */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Current Utilization</span>
                <Badge variant={currentUtilization > 100 ? 'destructive' : 'secondary'}>
                  {currentUtilization.toFixed(0)}%
                </Badge>
              </div>

              {/* T086: Allocation remaining indicator */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Total with New Allocations</span>
                  <span className={`font-bold ${isOverAllocated ? 'text-red-600' : 'text-green-600'}`}>
                    {totalWithCurrent.toFixed(0)}%
                  </span>
                </div>
                <Progress value={Math.min(totalWithCurrent, 100)} className={getProgressColor()} />
                {isOverAllocated && (
                  <div className="flex items-center gap-1 text-xs text-red-600">
                    <AlertTriangle className="h-3 w-3" />
                    Over-allocated by {(totalWithCurrent - 100).toFixed(0)}%
                  </div>
                )}
                {remaining > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {remaining.toFixed(0)}% remaining available
                  </p>
                )}
              </div>
            </div>

            {/* Start Date */}
            <div className="space-y-2">
              <Label htmlFor="bdr-start-date">Assignment Start Date</Label>
              <Input
                id="bdr-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                All assignments below will use this start date. Use a past date for historical assignments.
              </p>
            </div>

            {/* T087: Bulk Action Buttons */}
            {allocations.filter((a) => a.clientId).length > 1 && remaining > 0 && (
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={distributeEvenly}>
                  Distribute Evenly
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={allocateRemaining}>
                  Allocate Remaining to First
                </Button>
              </div>
            )}

            {/* Client Allocations */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Client Allocations</Label>
                <Button type="button" variant="ghost" size="sm" onClick={addAllocation}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Client
                </Button>
              </div>

              {allocations.map((allocation, index) => (
                <div key={allocation.id} className="flex gap-2 items-start">
                  <div className="flex-1 space-y-2">
                    <Select
                      value={allocation.clientId}
                      onValueChange={(value) => updateAllocation(allocation.id, 'clientId', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select client" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients
                          .filter((c) => c.status === 'ACTIVE')
                          .map((client) => (
                            <SelectItem key={client.id} value={client.id}>
                              {client.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="w-32">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="5"
                      placeholder="0%"
                      value={allocation.allocationPercentage || ''}
                      onChange={(e) =>
                        updateAllocation(allocation.id, 'allocationPercentage', e.target.value)
                      }
                    />
                  </div>

                  {allocations.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeAllocation(allocation.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || allocations.filter((a) => a.clientId).length === 0}>
              {isSubmitting ? 'Creating...' : 'Create Assignments'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
