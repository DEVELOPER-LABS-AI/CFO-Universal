'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { removeAllocation } from '@/app/actions/project-allocation';

interface AllocationTableProps {
  allocations: Array<{
    id: string;
    cost_source_type: string;
    cost_source_id: string;
    source_name: string;
    allocation_percentage: number;
    fixed_amount: number | null;
    effective_start_date: Date;
    effective_end_date: Date | null;
    monthly_cost: number;
    notes: string | null;
  }>;
  projectId: string;
}

/** Color-coded badge styles for each cost source type. */
const typeBadgeStyles: Record<string, string> = {
  STAFF: 'bg-blue-100 text-blue-800',
  CONTRACTOR: 'bg-purple-100 text-purple-800',
  SUBSCRIPTION: 'bg-green-100 text-green-800',
  OTHER: 'bg-gray-100 text-gray-800',
};

/**
 * Formats a number as USD currency.
 * @param amount - The numeric amount to format.
 * @returns A formatted currency string (e.g. "$1,234.56").
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

/**
 * Formats a Date object as a short locale date string.
 * @param date - The date to format.
 * @returns A formatted date string (e.g. "1/15/2025").
 */
function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * AllocationTable displays project cost allocations in a table format
 * with the ability to remove individual allocations.
 */
export function AllocationTable({ allocations, projectId }: AllocationTableProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [removingId, setRemovingId] = useState<string | null>(null);

  /**
   * Handles removing an allocation after user confirmation.
   * @param allocationId - The ID of the allocation to remove.
   * @param sourceName - The display name of the source, used in confirmation and toast messages.
   */
  async function handleRemove(allocationId: string, sourceName: string): Promise<void> {
    const confirmed = window.confirm(
      `Are you sure you want to remove the allocation for "${sourceName}"?`
    );
    if (!confirmed) return;

    setRemovingId(allocationId);
    try {
      await removeAllocation(allocationId);
      toast({
        title: 'Allocation removed',
      });
      router.refresh();
    } catch (error) {
      toast({
        title: 'Failed to remove allocation',
        description: error instanceof Error ? error.message : 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setRemovingId(null);
    }
  }

  if (allocations.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        No cost allocations yet
      </div>
    );
  }

  const totalMonthlyCost = allocations.reduce((sum, a) => sum + a.monthly_cost, 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="pb-2 pr-4 font-medium">Source Name</th>
            <th className="pb-2 pr-4 font-medium">Type</th>
            <th className="pb-2 pr-4 font-medium text-right">Allocation %</th>
            <th className="pb-2 pr-4 font-medium text-right">Monthly Cost</th>
            <th className="pb-2 pr-4 font-medium">Effective From</th>
            <th className="pb-2 font-medium text-right">Remove</th>
          </tr>
        </thead>
        <tbody>
          {allocations.map((allocation) => (
            <tr key={allocation.id} className="border-b last:border-b-0">
              <td className="py-3 pr-4 font-medium">{allocation.source_name}</td>
              <td className="py-3 pr-4">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                    typeBadgeStyles[allocation.cost_source_type] ?? typeBadgeStyles.OTHER
                  }`}
                >
                  {allocation.cost_source_type}
                </span>
              </td>
              <td className="py-3 pr-4 text-right">{allocation.allocation_percentage}%</td>
              <td className="py-3 pr-4 text-right">{formatCurrency(allocation.monthly_cost)}</td>
              <td className="py-3 pr-4">{formatDate(allocation.effective_start_date)}</td>
              <td className="py-3 text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={removingId === allocation.id}
                  onClick={() => handleRemove(allocation.id, allocation.source_name)}
                  className="text-destructive hover:text-destructive"
                >
                  {removingId === allocation.id ? 'Removing...' : 'Remove'}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t font-medium">
            <td className="pt-3 pr-4" colSpan={3}>
              Total
            </td>
            <td className="pt-3 pr-4 text-right">{formatCurrency(totalMonthlyCost)}</td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
