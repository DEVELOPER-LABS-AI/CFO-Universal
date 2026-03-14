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
import { Receipt, MoreHorizontal, Check, X, Trash2, DollarSign } from 'lucide-react';
import {
  toggleReimbursementApproval,
  toggleReimbursementPaid,
  deleteStaffReimbursement,
} from '@/app/actions/reimbursement-management';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils/error';

const REIMBURSEMENT_TYPE_LABELS: Record<string, string> = {
  TRAVEL: 'Travel',
  MEALS: 'Meals',
  SUPPLIES: 'Supplies',
  EQUIPMENT: 'Equipment',
  SOFTWARE: 'Software',
  PROFESSIONAL_DEV: 'Professional Dev',
  OTHER: 'Other',
};

interface StaffReimbursement {
  id: string;
  staff_id: string;
  reimbursement_type: string;
  amount: any;
  description: string | null;
  receipt_url: string | null;
  month: number;
  year: number;
  is_approved: boolean;
  is_paid: boolean;
  approved_at: Date | null;
  paid_at: Date | null;
  created_at: Date;
}

interface ReimbursementHistoryTableProps {
  reimbursements: StaffReimbursement[];
  staffId: string;
}

/**
 * Table displaying reimbursement history with approval and payment toggles.
 */
export function ReimbursementHistoryTable({ reimbursements, staffId }: ReimbursementHistoryTableProps) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  function formatPeriod(month: number, year: number): string {
    return new Date(year, month - 1).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  }

  function formatCurrency(amount: any): string {
    return `$${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  const handleToggleApproval = async (reimbursement: StaffReimbursement) => {
    setLoadingId(reimbursement.id);
    try {
      await toggleReimbursementApproval({
        reimbursement_id: reimbursement.id,
        approved: !reimbursement.is_approved,
      });
      toast.success(reimbursement.is_approved ? 'Reimbursement unapproved' : 'Reimbursement approved');
      router.refresh();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || 'Failed to update approval');
    } finally {
      setLoadingId(null);
    }
  };

  const handleTogglePaid = async (reimbursement: StaffReimbursement) => {
    setLoadingId(reimbursement.id);
    try {
      await toggleReimbursementPaid({
        reimbursement_id: reimbursement.id,
        paid: !reimbursement.is_paid,
      });
      toast.success(reimbursement.is_paid ? 'Marked as unpaid' : 'Marked as paid');
      router.refresh();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || 'Failed to update payment status');
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (reimbursement: StaffReimbursement) => {
    if (!confirm(`Delete ${REIMBURSEMENT_TYPE_LABELS[reimbursement.reimbursement_type] || reimbursement.reimbursement_type} reimbursement of ${formatCurrency(reimbursement.amount)}?`)) {
      return;
    }
    setLoadingId(reimbursement.id);
    try {
      await deleteStaffReimbursement(reimbursement.id);
      toast.success('Reimbursement deleted');
      router.refresh();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || 'Failed to delete reimbursement');
    } finally {
      setLoadingId(null);
    }
  };

  if (reimbursements.length === 0) {
    return (
      <EmptyState
        icon={<Receipt className="h-12 w-12" />}
        title="No reimbursements recorded"
        description="Add a reimbursement to start tracking expenses for this staff member"
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
            {reimbursements.map((reimbursement) => (
              <TableRow key={reimbursement.id}>
                <TableCell className="text-sm">
                  {formatPeriod(reimbursement.month, reimbursement.year)}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {REIMBURSEMENT_TYPE_LABELS[reimbursement.reimbursement_type] || reimbursement.reimbursement_type}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono font-medium">
                  {formatCurrency(reimbursement.amount)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                  {reimbursement.description || '-'}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleApproval(reimbursement)}
                    disabled={loadingId === reimbursement.id || reimbursement.is_paid}
                    title={reimbursement.is_paid ? 'Cannot change approval on paid reimbursement' : undefined}
                  >
                    {reimbursement.is_approved ? (
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
                  {reimbursement.is_paid ? (
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
                      <Button variant="ghost" size="sm" disabled={loadingId === reimbursement.id}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {reimbursement.is_approved && !reimbursement.is_paid && (
                        <DropdownMenuItem onClick={() => handleTogglePaid(reimbursement)}>
                          <DollarSign className="h-4 w-4 mr-2" />
                          Mark as Paid
                        </DropdownMenuItem>
                      )}
                      {reimbursement.is_paid && (
                        <DropdownMenuItem onClick={() => handleTogglePaid(reimbursement)}>
                          <X className="h-4 w-4 mr-2" />
                          Mark as Unpaid
                        </DropdownMenuItem>
                      )}
                      {!reimbursement.is_paid && (
                        <DropdownMenuItem
                          onClick={() => handleDelete(reimbursement)}
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
        {reimbursements.map((reimbursement) => (
          <div key={reimbursement.id} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">{formatPeriod(reimbursement.month, reimbursement.year)}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">
                    {REIMBURSEMENT_TYPE_LABELS[reimbursement.reimbursement_type] || reimbursement.reimbursement_type}
                  </Badge>
                  {reimbursement.is_approved ? (
                    <Badge variant="default" className="bg-green-600 text-xs">Approved</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">Pending</Badge>
                  )}
                  {reimbursement.is_paid && (
                    <Badge variant="default" className="bg-blue-600 text-xs">Paid</Badge>
                  )}
                </div>
              </div>
              <p className="font-mono font-medium text-lg">{formatCurrency(reimbursement.amount)}</p>
            </div>

            {reimbursement.description && (
              <p className="text-sm text-muted-foreground">{reimbursement.description}</p>
            )}

            <div className="flex gap-2">
              {!reimbursement.is_paid && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleToggleApproval(reimbursement)}
                  disabled={loadingId === reimbursement.id}
                >
                  {reimbursement.is_approved ? 'Unapprove' : 'Approve'}
                </Button>
              )}
              {reimbursement.is_approved && !reimbursement.is_paid && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleTogglePaid(reimbursement)}
                  disabled={loadingId === reimbursement.id}
                >
                  Mark Paid
                </Button>
              )}
              {!reimbursement.is_paid && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(reimbursement)}
                  disabled={loadingId === reimbursement.id}
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
