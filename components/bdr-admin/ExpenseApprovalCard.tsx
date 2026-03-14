'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { approveExpense, rejectExpense, markExpenseReimbursed, getAdminReceiptUrl } from '@/app/actions/bdr-admin-actions';
import { toast } from 'sonner';
import { CheckCircle, XCircle, DollarSign, FileText } from 'lucide-react';

interface ExpenseData {
  id: string;
  staffId: string;
  staffName: string;
  expenseDate: string;
  category: string;
  amount: number;
  description: string | null;
  hasReceipt: boolean;
  status: string;
  adminNotes: string | null;
  createdAt: string;
}

interface ExpenseApprovalCardProps {
  expense: ExpenseData;
  onAction: () => void;
}

/**
 * Admin card for reviewing and acting on a single BDR expense claim.
 * Supports approve, reject (with required notes), and mark-reimbursed actions.
 */
export function ExpenseApprovalCard({ expense, onAction }: ExpenseApprovalCardProps) {
  const [adminNotes, setAdminNotes] = useState('');
  const [notesError, setNotesError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  /** Returns the appropriate badge variant for a given expense status. */
  function getStatusVariant(status: string): 'secondary' | 'default' | 'destructive' | 'outline' {
    switch (status) {
      case 'SUBMITTED':
        return 'secondary';
      case 'APPROVED':
        return 'default';
      case 'REJECTED':
        return 'destructive';
      case 'REIMBURSED':
        return 'outline';
      default:
        return 'secondary';
    }
  }

  /** Opens the receipt in a new tab by fetching a signed URL from the server. */
  async function handleViewReceipt() {
    const result = await getAdminReceiptUrl({ expense_id: expense.id });
    if (result.success) {
      window.open(result.data.url, '_blank');
    } else {
      toast.error(result.error);
    }
  }

  /** Approves the expense claim and refreshes the list. */
  async function handleApprove() {
    setIsLoading(true);
    try {
      const result = await approveExpense({
        expense_id: expense.id,
        admin_notes: adminNotes || undefined,
      });
      if (result.success) {
        toast.success('Expense approved');
        onAction();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error('Failed to approve expense');
    } finally {
      setIsLoading(false);
    }
  }

  /** Rejects the expense claim. Requires admin notes as a rejection reason. */
  async function handleReject() {
    if (!adminNotes.trim()) {
      setNotesError('Rejection reason is required');
      return;
    }
    setNotesError('');
    setIsLoading(true);
    try {
      const result = await rejectExpense({
        expense_id: expense.id,
        admin_notes: adminNotes,
      });
      if (result.success) {
        toast.success('Expense rejected');
        onAction();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error('Failed to reject expense');
    } finally {
      setIsLoading(false);
    }
  }

  /** Marks an approved expense as reimbursed. */
  async function handleMarkReimbursed() {
    setIsLoading(true);
    try {
      const result = await markExpenseReimbursed({
        expense_id: expense.id,
      });
      if (result.success) {
        toast.success('Expense marked as reimbursed');
        onAction();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error('Failed to mark expense as reimbursed');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        {/* Header row: BDR name, status badge, amount */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-medium">{expense.staffName}</span>
            <Badge variant={getStatusVariant(expense.status)}>{expense.status}</Badge>
          </div>
          <span className="font-semibold text-lg">${expense.amount.toFixed(2)}</span>
        </div>

        {/* Details row: date, category, receipt link */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>{new Date(expense.expenseDate).toLocaleDateString()}</span>
          <span>{expense.category}</span>
          {expense.hasReceipt && (
            <button
              type="button"
              onClick={handleViewReceipt}
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <FileText className="h-3.5 w-3.5" />
              View Receipt
            </button>
          )}
        </div>

        {/* Description */}
        {expense.description && (
          <p className="text-sm">{expense.description}</p>
        )}

        {/* Existing admin notes */}
        {expense.adminNotes && (
          <div className="text-sm bg-muted/50 rounded p-2">
            <span className="font-medium text-muted-foreground">Admin notes: </span>
            {expense.adminNotes}
          </div>
        )}

        {/* Admin notes input for SUBMITTED expenses */}
        {expense.status === 'SUBMITTED' && (
          <div className="space-y-1">
            <Textarea
              placeholder="Admin notes (required for rejection)"
              value={adminNotes}
              onChange={(e) => {
                setAdminNotes(e.target.value);
                if (notesError) setNotesError('');
              }}
              rows={2}
              className="text-sm"
            />
            {notesError && (
              <p className="text-xs text-destructive">{notesError}</p>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {expense.status === 'SUBMITTED' && (
            <>
              <Button
                size="sm"
                onClick={handleApprove}
                disabled={isLoading}
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleReject}
                disabled={isLoading}
              >
                <XCircle className="h-4 w-4 mr-1" />
                Reject
              </Button>
            </>
          )}
          {expense.status === 'APPROVED' && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleMarkReimbursed}
              disabled={isLoading}
            >
              <DollarSign className="h-4 w-4 mr-1" />
              Mark Reimbursed
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
