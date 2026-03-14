'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/ui/empty-state';
import { CreditCard, AlertCircle, Pencil, Trash2, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { SubscriptionSettingsModal } from './SubscriptionSettingsModal';
import { DeleteConfirmModal } from '@/components/shared/DeleteConfirmModal';
import { softDeleteSubscription } from '@/app/actions/subscription-management';

interface Subscription {
  id: string;
  name: string;
  total_cost: any;
  effective_cost?: number;
  total_seats: number | null;
  billing_frequency: string;
  allocation_type: string;
  is_active: boolean;
  is_enrichment: boolean;
  total_credits: number | null;
  credit_cost_email: any;
  credit_cost_phone: any;
  allocations: any[];
  mapped_merchants?: string[];
  utilization: {
    totalAllocatedCost: number;
    unutilizedCost: number;
    seatsAllocated: number | null;
    seatsRemaining: number | null;
    totalPercentage: number;
  };
}

type SortField = 'name' | 'cost' | 'allocated' | 'unutilized' | 'allocations';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 25;

interface SubscriptionTableProps {
  subscriptions: Subscription[];
}

function getCost(s: Subscription): number {
  // ONE_TIME effective_cost is 0 (not recurring), but show actual cost in table
  if (s.billing_frequency === 'ONE_TIME') return Number(s.total_cost);
  return s.effective_cost ?? Number(s.total_cost);
}

export function SubscriptionTable({ subscriptions }: SubscriptionTableProps) {
  const router = useRouter();
  const [sortField, setSortField] = useState<SortField>('cost');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir(field === 'name' ? 'asc' : 'desc');
    }
    setPage(1); // Reset to page 1 when sort changes
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="ml-1 h-3 w-3 opacity-40" />;
    return sortDir === 'asc'
      ? <ArrowUp className="ml-1 h-3 w-3" />
      : <ArrowDown className="ml-1 h-3 w-3" />;
  };

  // Sort: inactive always at bottom, then by selected field
  const sorted = useMemo(() => {
    const active = subscriptions.filter((s) => s.is_active);
    const inactive = subscriptions.filter((s) => !s.is_active);

    const compare = (a: Subscription, b: Subscription): number => {
      let valA: number | string;
      let valB: number | string;

      switch (sortField) {
        case 'name':
          valA = a.name.toLowerCase();
          valB = b.name.toLowerCase();
          return sortDir === 'asc'
            ? (valA as string).localeCompare(valB as string)
            : (valB as string).localeCompare(valA as string);
        case 'cost':
          valA = getCost(a);
          valB = getCost(b);
          break;
        case 'allocated':
          valA = a.utilization.totalAllocatedCost;
          valB = b.utilization.totalAllocatedCost;
          break;
        case 'unutilized':
          valA = a.utilization.unutilizedCost;
          valB = b.utilization.unutilizedCost;
          break;
        case 'allocations':
          valA = a.allocations.length;
          valB = b.allocations.length;
          break;
        default:
          return 0;
      }

      const diff = (valA as number) - (valB as number);
      return sortDir === 'asc' ? diff : -diff;
    };

    return [...active.sort(compare), ...inactive.sort(compare)];
  }, [subscriptions, sortField, sortDir]);

  // Client-side pagination
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (subscriptions.length === 0) {
    return (
      <EmptyState
        icon={<CreditCard className="h-12 w-12" />}
        title="No subscriptions found"
        description="Add subscriptions to track and allocate SaaS costs."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <button onClick={() => toggleSort('name')} className="flex items-center font-medium hover:text-foreground">
                  Name <SortIcon field="name" />
                </button>
              </TableHead>
              <TableHead>
                <button onClick={() => toggleSort('cost')} className="flex items-center font-medium hover:text-foreground">
                  Monthly Cost <SortIcon field="cost" />
                </button>
              </TableHead>
              <TableHead>Seats</TableHead>
              <TableHead>
                <button onClick={() => toggleSort('allocated')} className="flex items-center font-medium hover:text-foreground">
                  Allocated <SortIcon field="allocated" />
                </button>
              </TableHead>
              <TableHead>
                <button onClick={() => toggleSort('unutilized')} className="flex items-center font-medium hover:text-foreground">
                  Unutilized <SortIcon field="unutilized" />
                </button>
              </TableHead>
              <TableHead>
                <button onClick={() => toggleSort('allocations')} className="flex items-center font-medium hover:text-foreground">
                  Allocations <SortIcon field="allocations" />
                </button>
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.map((subscription) => {
              const cost = getCost(subscription);
              const hasUnutilized = subscription.utilization.unutilizedCost > 0.01;
              const utilizationPercent = cost > 0
                ? ((subscription.utilization.totalAllocatedCost / cost) * 100).toFixed(0)
                : '0';

              return (
                <TableRow key={subscription.id} className={!subscription.is_active ? 'opacity-50' : ''}>
                  <TableCell>
                    <Link
                      href={`/dashboard/subscriptions/${subscription.id}`}
                      className="hover:underline font-medium"
                    >
                      {subscription.name}
                    </Link>
                    {subscription.mapped_merchants && subscription.mapped_merchants.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1 truncate max-w-[250px]" title={subscription.mapped_merchants.join(', ')}>
                        {subscription.mapped_merchants.join(', ')}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">{subscription.billing_frequency}</p>
                  </TableCell>
                  <TableCell>
                    <span className="font-semibold">${cost.toFixed(2)}</span>
                    {subscription.billing_frequency === 'ONE_TIME' && (
                      <p className="text-xs text-muted-foreground">one-time</p>
                    )}
                  </TableCell>
                  <TableCell>
                    {subscription.total_seats ? (
                      <div>
                        <span className="font-medium">
                          {subscription.utilization.seatsAllocated}/{subscription.total_seats}
                        </span>
                        <p className="text-xs text-muted-foreground">
                          {subscription.utilization.seatsRemaining} remaining
                        </p>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">N/A</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div>
                      <span className="font-medium">
                        ${subscription.utilization.totalAllocatedCost.toFixed(2)}
                      </span>
                      <p className="text-xs text-muted-foreground">{utilizationPercent}% of total</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {hasUnutilized ? (
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-orange-500" />
                        <div>
                          <span className="font-medium text-orange-600">
                            ${subscription.utilization.unutilizedCost.toFixed(2)}
                          </span>
                          <p className="text-xs text-muted-foreground">unallocated</p>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Fully allocated</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{subscription.allocations.length} allocations</Badge>
                  </TableCell>
                  <TableCell>
                    {subscription.is_active ? (
                      <Badge variant="default">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <SubscriptionSettingsModal
                        subscriptionId={subscription.id}
                        currentSettings={{
                          name: subscription.name,
                          total_cost: Number(subscription.total_cost),
                          total_seats: subscription.total_seats,
                          allocation_type: subscription.allocation_type,
                          billing_frequency: subscription.billing_frequency,
                          is_active: subscription.is_active,
                          is_enrichment: subscription.is_enrichment,
                          total_credits: subscription.total_credits,
                          credit_cost_email: subscription.credit_cost_email ? Number(subscription.credit_cost_email) : null,
                          credit_cost_phone: subscription.credit_cost_phone ? Number(subscription.credit_cost_phone) : null,
                        }}
                        trigger={
                          <Button variant="ghost" size="sm">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        }
                      />
                      <DeleteConfirmModal
                        entityName="subscription"
                        displayName={subscription.name}
                        onConfirm={async () => {
                          await softDeleteSubscription(subscription.id);
                          router.refresh();
                        }}
                        trigger={
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        }
                      />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages} ({sorted.length} subscriptions)
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
