'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/ui/empty-state';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DollarSign, MoreHorizontal, Check, X, Trash2 } from 'lucide-react';
import { toggleBonusApproval, toggleBonusPaid, deleteStaffBonus } from '@/app/actions/bonus-management';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils/error';

const BONUS_TYPE_LABELS: Record<string, string> = {
  PERFORMANCE: 'Performance',
  SIGNING: 'Signing',
  REFERRAL: 'Referral',
  RETENTION: 'Retention',
  QUARTERLY: 'Quarterly',
  ANNUAL: 'Annual',
  SPOT: 'Spot',
  OTHER: 'Other',
};

interface StaffBonus {
  id: string;
  staff_id: string;
  bonus_type: string;
  amount: any;
  description: string | null;
  month: number;
  year: number;
  is_approved: boolean;
  is_paid: boolean;
  approved_at: Date | null;
  paid_at: Date | null;
  created_at: Date;
}

interface BonusHistoryTableProps {
  bonuses: StaffBonus[];
  staffId: string;
}

/**
 * Table displaying bonus history with approval and payment toggles.
 */
export function BonusHistoryTable({ bonuses, staffId }: BonusHistoryTableProps) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  /**
   * Format month/year into a readable period string.
   */
  function formatPeriod(month: number, year: number): string {
    return new Date(year, month - 1).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  }

  /**
   * Format a decimal amount as currency.
   */
  function formatCurrency(amount: any): string {
    return `$${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  const handleToggleApproval = async (bonus: StaffBonus) => {
    setLoadingId(bonus.id);
    try {
      await toggleBonusApproval({
        bonus_id: bonus.id,
        approved: !bonus.is_approved,
      });
      toast.success(bonus.is_approved ? 'Bonus unapproved' : 'Bonus approved');
      router.refresh();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || 'Failed to update approval');
    } finally {
      setLoadingId(null);
    }
  };

  const handleTogglePaid = async (bonus: StaffBonus) => {
    setLoadingId(bonus.id);
    try {
      await toggleBonusPaid({
        bonus_id: bonus.id,
        paid: !bonus.is_paid,
      });
      toast.success(bonus.is_paid ? 'Marked as unpaid' : 'Marked as paid');
      router.refresh();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || 'Failed to update payment status');
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (bonus: StaffBonus) => {
    if (!confirm(`Delete ${BONUS_TYPE_LABELS[bonus.bonus_type] || bonus.bonus_type} bonus of ${formatCurrency(bonus.amount)}?`)) {
      return;
    }
    setLoadingId(bonus.id);
    try {
      await deleteStaffBonus(bonus.id);
      toast.success('Bonus deleted');
      router.refresh();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || 'Failed to delete bonus');
    } finally {
      setLoadingId(null);
    }
  };

  if (bonuses.length === 0) {
    return (
      <EmptyState
        icon={<DollarSign className="h-12 w-12" />}
        title="No bonuses recorded"
        description="Add a bonus to start tracking variable costs for this staff member"
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Desktop Table */}
      <div className="hidden md:block border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Period</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Approved</TableHead>
              <TableHead>Paid</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bonuses.map((bonus) => (
              <TableRow key={bonus.id}>
                <TableCell className="text-sm">
                  {formatPeriod(bonus.month, bonus.year)}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {BONUS_TYPE_LABELS[bonus.bonus_type] || bonus.bonus_type}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono font-medium">
                  {formatCurrency(bonus.amount)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                  {bonus.description || '-'}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleApproval(bonus)}
                    disabled={loadingId === bonus.id || bonus.is_paid}
                    title={bonus.is_paid ? 'Cannot change approval on paid bonus' : undefined}
                  >
                    {bonus.is_approved ? (
                      <Badge variant="default" className="bg-green-600">
                        <Check className="h-3 w-3 mr-1" />
                        Approved
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        Pending
                      </Badge>
                    )}
                  </Button>
                </TableCell>
                <TableCell>
                  {bonus.is_paid ? (
                    <Badge variant="default" className="bg-blue-600">
                      Paid
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      Unpaid
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" disabled={loadingId === bonus.id}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {bonus.is_approved && !bonus.is_paid && (
                        <DropdownMenuItem onClick={() => handleTogglePaid(bonus)}>
                          <DollarSign className="h-4 w-4 mr-2" />
                          Mark as Paid
                        </DropdownMenuItem>
                      )}
                      {bonus.is_paid && (
                        <DropdownMenuItem onClick={() => handleTogglePaid(bonus)}>
                          <X className="h-4 w-4 mr-2" />
                          Mark as Unpaid
                        </DropdownMenuItem>
                      )}
                      {!bonus.is_paid && (
                        <DropdownMenuItem
                          onClick={() => handleDelete(bonus)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-4">
        {bonuses.map((bonus) => (
          <div key={bonus.id} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">{formatPeriod(bonus.month, bonus.year)}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">
                    {BONUS_TYPE_LABELS[bonus.bonus_type] || bonus.bonus_type}
                  </Badge>
                  {bonus.is_approved ? (
                    <Badge variant="default" className="bg-green-600 text-xs">Approved</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">Pending</Badge>
                  )}
                  {bonus.is_paid && (
                    <Badge variant="default" className="bg-blue-600 text-xs">Paid</Badge>
                  )}
                </div>
              </div>
              <p className="font-mono font-medium text-lg">{formatCurrency(bonus.amount)}</p>
            </div>

            {bonus.description && (
              <p className="text-sm text-muted-foreground">{bonus.description}</p>
            )}

            <div className="flex gap-2">
              {!bonus.is_paid && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleToggleApproval(bonus)}
                  disabled={loadingId === bonus.id}
                >
                  {bonus.is_approved ? 'Unapprove' : 'Approve'}
                </Button>
              )}
              {bonus.is_approved && !bonus.is_paid && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleTogglePaid(bonus)}
                  disabled={loadingId === bonus.id}
                >
                  Mark Paid
                </Button>
              )}
              {!bonus.is_paid && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(bonus)}
                  disabled={loadingId === bonus.id}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
