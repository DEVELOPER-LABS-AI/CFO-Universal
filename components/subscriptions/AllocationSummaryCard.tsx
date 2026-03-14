'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Users, Building2, Percent, Trash2 } from 'lucide-react';
import { removeSubscriptionAllocation } from '@/app/actions/subscription-management';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils/error';
import Link from 'next/link';

// T107: AllocationSummaryCard component showing cost per client/staff
// Client and staff allocations are independent pools, each summing to 100%.

interface SubscriptionAllocation {
  id: string;
  subscription_id: string;
  client_id: string | null;
  staff_id: string | null;
  allocation_type: 'SEAT_BASED' | 'PERCENTAGE_BASED';
  seats_allocated: number | null;
  percentage_allocated: number | null;
  cost_allocated: any;
  client?: {
    id: string;
    name: string;
    status: string;
  };
  staff?: {
    id: string;
    name: string;
    staff_type: string;
  };
}

interface AllocationSummaryCardProps {
  subscriptionName: string;
  /** Monthly cost (already normalized from billing frequency) */
  totalCost: number;
  /** The raw billing-period amount before monthly normalization */
  rawBillingCost: number;
  /** Billing frequency for context display */
  billingFrequency: string;
  allocations: SubscriptionAllocation[];
  /** Optional action element (e.g. allocate button) rendered in header and empty state */
  action?: React.ReactNode;
}

/** Format billing frequency for display. */
function billingLabel(freq: string): string {
  if (freq === 'QUARTERLY') return 'quarterly';
  if (freq === 'ANNUAL') return 'annually';
  return 'monthly';
}

export function AllocationSummaryCard({
  subscriptionName,
  totalCost,
  rawBillingCost,
  billingFrequency,
  allocations,
  action,
}: AllocationSummaryCardProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const clientAllocations = allocations.filter((a) => a.client_id);
  const staffAllocations = allocations.filter((a) => a.staff_id);

  // Per-pool calculations - derive costs from percentage * monthly totalCost
  // This ensures display always reflects monthly cost regardless of DB state
  const clientPercentage = clientAllocations
    .filter((a) => a.percentage_allocated !== null)
    .reduce((sum, a) => sum + Number(a.percentage_allocated), 0);
  const staffPercentage = staffAllocations
    .filter((a) => a.percentage_allocated !== null)
    .reduce((sum, a) => sum + Number(a.percentage_allocated), 0);
  const clientAllocatedCost = (clientPercentage / 100) * totalCost;
  const staffAllocatedCost = (staffPercentage / 100) * totalCost;
  const clientUnallocated = totalCost - clientAllocatedCost;
  const staffUnallocated = totalCost - staffAllocatedCost;

  async function handleRemove(allocationId: string, entityName: string) {
    setDeletingId(allocationId);
    try {
      await removeSubscriptionAllocation(allocationId);
      toast.success(`Removed ${entityName} allocation`);
      router.refresh();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || 'Failed to remove allocation');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">{subscriptionName} - Allocation Summary</CardTitle>
        {action}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Total Cost Reference */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Monthly Cost</p>
            <p className="text-xl font-bold">${totalCost.toFixed(2)}</p>
            {billingFrequency !== 'MONTHLY' && (
              <p className="text-xs text-muted-foreground">
                Billed ${rawBillingCost.toFixed(2)} {billingLabel(billingFrequency)}
              </p>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Client Allocations</p>
            <p className="text-xl font-bold">{clientAllocations.length}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Staff Allocations</p>
            <p className="text-xl font-bold">{staffAllocations.length}</p>
          </div>
        </div>

        {/* Client Pool Section */}
        {clientAllocations.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <h4 className="font-medium">Client Allocations ({clientAllocations.length})</h4>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-green-600 font-medium">
                  ${clientAllocatedCost.toFixed(2)}/mo allocated
                </span>
                {clientUnallocated > 0.01 && (
                  <span className="text-orange-600">
                    ${clientUnallocated.toFixed(2)}/mo unallocated
                  </span>
                )}
              </div>
            </div>
            <Progress value={clientPercentage} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{clientPercentage.toFixed(1)}% allocated</span>
              <span>{(100 - clientPercentage).toFixed(1)}% remaining</span>
            </div>
            <div className="space-y-2">
              {clientAllocations.map((allocation) => {
                const pct = Number(allocation.percentage_allocated ?? 0);
                const monthlyCost = (pct / 100) * totalCost;
                return (
                  <div
                    key={allocation.id}
                    className="flex items-center justify-between p-2 border rounded-lg hover:bg-muted/50 group"
                  >
                    <div className="flex-1">
                      <Link
                        href={`/dashboard/clients/${allocation.client_id}`}
                        className="hover:underline font-medium text-sm"
                      >
                        {allocation.client?.name}
                      </Link>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {allocation.allocation_type === 'SEAT_BASED' ? 'Seats' : 'Percentage'}
                        </Badge>
                        {allocation.percentage_allocated !== null && (
                          <span className="text-xs text-muted-foreground">
                            {pct.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-semibold">${monthlyCost.toFixed(2)}/mo</p>
                        <p className="text-xs text-muted-foreground">
                          {pct.toFixed(1)}% of total
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                        disabled={deletingId === allocation.id}
                        onClick={() => handleRemove(allocation.id, allocation.client?.name || 'Client')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Staff Pool Section */}
        {staffAllocations.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <h4 className="font-medium">Staff Allocations ({staffAllocations.length})</h4>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-green-600 font-medium">
                  ${staffAllocatedCost.toFixed(2)}/mo allocated
                </span>
                {staffUnallocated > 0.01 && (
                  <span className="text-orange-600">
                    ${staffUnallocated.toFixed(2)}/mo unallocated
                  </span>
                )}
              </div>
            </div>
            <Progress value={staffPercentage} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{staffPercentage.toFixed(1)}% allocated</span>
              <span>{(100 - staffPercentage).toFixed(1)}% remaining</span>
            </div>
            <div className="space-y-2">
              {staffAllocations.map((allocation) => {
                const pct = Number(allocation.percentage_allocated ?? 0);
                const monthlyCost = (pct / 100) * totalCost;
                return (
                  <div
                    key={allocation.id}
                    className="flex items-center justify-between p-2 border rounded-lg hover:bg-muted/50 group"
                  >
                    <div className="flex-1">
                      <Link
                        href={`/dashboard/staff/${allocation.staff_id}`}
                        className="hover:underline font-medium text-sm"
                      >
                        {allocation.staff?.name}
                      </Link>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {allocation.staff?.staff_type}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {allocation.allocation_type === 'SEAT_BASED' ? 'Seats' : 'Percentage'}
                        </Badge>
                        {allocation.percentage_allocated !== null && (
                          <span className="text-xs text-muted-foreground">
                            {pct.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-semibold">${monthlyCost.toFixed(2)}/mo</p>
                        <p className="text-xs text-muted-foreground">
                          {pct.toFixed(1)}% of total
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                        disabled={deletingId === allocation.id}
                        onClick={() => handleRemove(allocation.id, allocation.staff?.name || 'Staff')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty State */}
        {allocations.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Percent className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No allocations yet</p>
            <p className="text-sm">Start by allocating this subscription to clients or staff</p>
            {action && <div className="mt-4">{action}</div>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
