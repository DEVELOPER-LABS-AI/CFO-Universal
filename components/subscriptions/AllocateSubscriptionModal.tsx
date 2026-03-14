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
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { addSubscriptionAllocation } from '@/app/actions/subscription-management';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils/error';

interface AllocateSubscriptionModalProps {
  trigger: React.ReactNode;
  subscriptionId: string;
  subscriptionName: string;
  totalCost: number;
  currentClientAllocationCount: number;
  currentStaffAllocationCount: number;
  existingClientIds: string[];
  existingStaffIds: string[];
  clients: Array<{ id: string; name: string; status: string }>;
  staff: Array<{ id: string; name: string; staff_type: string }>;
}

type EntityType = 'client' | 'staff';

export function AllocateSubscriptionModal({
  trigger,
  subscriptionId,
  subscriptionName,
  totalCost,
  currentClientAllocationCount,
  currentStaffAllocationCount,
  existingClientIds,
  existingStaffIds,
  clients,
  staff,
}: AllocateSubscriptionModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [entityType, setEntityType] = useState<EntityType>('client');
  const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(new Set());
  const [selectedStaffIds, setSelectedStaffIds] = useState<Set<string>>(new Set());

  // Filter out already-allocated entities
  const availableClients = clients.filter(
    (c) => c.status === 'ACTIVE' && !existingClientIds.includes(c.id)
  );
  const availableStaff = staff.filter(
    (s) => !existingStaffIds.includes(s.id)
  );

  // Per-pool preview calculations
  const selectedIds = entityType === 'client' ? selectedClientIds : selectedStaffIds;
  const currentPoolCount = entityType === 'client'
    ? currentClientAllocationCount
    : currentStaffAllocationCount;
  const newCount = currentPoolCount + selectedIds.size;
  const newPercentage = newCount > 0 ? 100 / newCount : 0;
  const newCostEach = newCount > 0 ? totalCost / newCount : 0;

  function toggleEntity(id: string) {
    if (entityType === 'client') {
      setSelectedClientIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    } else {
      setSelectedStaffIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    }
  }

  function toggleAll() {
    if (entityType === 'client') {
      if (selectedClientIds.size === availableClients.length) {
        setSelectedClientIds(new Set());
      } else {
        setSelectedClientIds(new Set(availableClients.map((c) => c.id)));
      }
    } else {
      if (selectedStaffIds.size === availableStaff.length) {
        setSelectedStaffIds(new Set());
      } else {
        setSelectedStaffIds(new Set(availableStaff.map((s) => s.id)));
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.size === 0) {
      toast.error(`Please select at least one ${entityType}`);
      return;
    }

    setIsSubmitting(true);
    try {
      await addSubscriptionAllocation({
        subscription_id: subscriptionId,
        client_ids: entityType === 'client' ? Array.from(selectedClientIds) : undefined,
        staff_ids: entityType === 'staff' ? Array.from(selectedStaffIds) : undefined,
      });

      toast.success(
        `Allocated ${subscriptionName} — split evenly across ${newCount} ${entityType} allocations`
      );
      setOpen(false);
      setSelectedClientIds(new Set());
      setSelectedStaffIds(new Set());
      router.refresh();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || 'Failed to allocate subscription');
    } finally {
      setIsSubmitting(false);
    }
  };

  const availableList = entityType === 'client' ? availableClients : availableStaff;
  const allSelected = entityType === 'client'
    ? selectedClientIds.size === availableClients.length && availableClients.length > 0
    : selectedStaffIds.size === availableStaff.length && availableStaff.length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Allocate {subscriptionName}</DialogTitle>
            <DialogDescription>
              Select clients or staff members. Cost is split evenly within each pool.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            {/* Subscription cost info */}
            <div className="p-3 border rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Total Cost</p>
              <p className="text-lg font-bold">${totalCost.toFixed(2)}</p>
            </div>

            {/* Entity picker with tabs */}
            <div className="space-y-2">
              <Label>Allocate To</Label>
              <Tabs
                value={entityType}
                onValueChange={(v) => setEntityType(v as EntityType)}
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="client">
                    Clients {availableClients.length > 0 && `(${availableClients.length})`}
                  </TabsTrigger>
                  <TabsTrigger value="staff">
                    Staff {availableStaff.length > 0 && `(${availableStaff.length})`}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="client" className="space-y-2">
                  {availableClients.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      All active clients are already allocated
                    </p>
                  ) : (
                    <>
                      <div className="flex items-center justify-between py-1">
                        <button
                          type="button"
                          onClick={toggleAll}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          {allSelected ? 'Deselect All' : 'Select All'}
                        </button>
                        <span className="text-xs text-muted-foreground">
                          {selectedClientIds.size} selected
                        </span>
                      </div>
                      <div className="h-[200px] overflow-y-auto border rounded-md p-2">
                        <div className="space-y-1">
                          {availableClients.map((client) => (
                            <label
                              key={client.id}
                              className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                            >
                              <Checkbox
                                checked={selectedClientIds.has(client.id)}
                                onCheckedChange={() => toggleEntity(client.id)}
                              />
                              <span className="text-sm font-medium">{client.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </TabsContent>

                <TabsContent value="staff" className="space-y-2">
                  {availableStaff.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      All staff members are already allocated
                    </p>
                  ) : (
                    <>
                      <div className="flex items-center justify-between py-1">
                        <button
                          type="button"
                          onClick={toggleAll}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          {allSelected ? 'Deselect All' : 'Select All'}
                        </button>
                        <span className="text-xs text-muted-foreground">
                          {selectedStaffIds.size} selected
                        </span>
                      </div>
                      <div className="h-[200px] overflow-y-auto border rounded-md p-2">
                        <div className="space-y-1">
                          {availableStaff.map((member) => (
                            <label
                              key={member.id}
                              className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                            >
                              <Checkbox
                                checked={selectedStaffIds.has(member.id)}
                                onCheckedChange={() => toggleEntity(member.id)}
                              />
                              <span className="text-sm font-medium">{member.name}</span>
                              <span className="text-xs text-muted-foreground">
                                ({member.staff_type})
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </TabsContent>
              </Tabs>
            </div>

            {/* Auto-split preview */}
            {selectedIds.size > 0 && (
              <div className="p-3 border rounded-lg bg-muted/50 space-y-2">
                <p className="text-sm font-medium">After adding {selectedIds.size} {entityType}(s):</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">{entityType === 'client' ? 'Client' : 'Staff'} Pool</p>
                    <p className="font-semibold">{currentPoolCount} → {newCount}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Each gets</p>
                    <p className="font-semibold">{newPercentage.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Cost each</p>
                    <p className="font-semibold">${newCostEach.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Pool total</p>
                    <p className="font-semibold text-green-600">100%</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || selectedIds.size === 0}>
              {isSubmitting ? 'Allocating...' : `Add ${selectedIds.size > 0 ? selectedIds.size : ''} & Split Evenly`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
