'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Paperclip } from 'lucide-react';
import { ExpenseForm } from '@/components/bdr-portal/ExpenseForm';
import { getBDRExpenses } from '@/app/actions/bdr-portal-actions';

interface Expense {
  id: string;
  expenseDate: string;
  category: { id: string; name: string };
  amount: number;
  description: string | null;
  hasReceipt: boolean;
  status: string;
  adminNotes: string | null;
  createdAt: string;
}

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  SUBMITTED: 'secondary',
  APPROVED: 'default',
  REJECTED: 'destructive',
  REIMBURSED: 'outline',
};

/**
 * BDR expenses page showing expense history and new expense form.
 */
export default function BDRExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showNewExpense, setShowNewExpense] = useState(false);

  const loadExpenses = useCallback(async () => {
    setLoading(true);
    const result = await getBDRExpenses({
      status: statusFilter === 'all' ? undefined : statusFilter as any,
      page: 1,
      pageSize: 50,
    });
    if (result.success) {
      setExpenses(result.data.expenses);
      setTotal(result.data.total);
    }
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Expenses</h1>
          <p className="text-muted-foreground">Submit and track expense reimbursements</p>
        </div>
        <Button onClick={() => setShowNewExpense(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Expense
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="SUBMITTED">Submitted</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
            <SelectItem value="REIMBURSED">Reimbursed</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{total} expense{total !== 1 ? 's' : ''}</span>
      </div>

      {/* Expenses Table */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">Loading expenses...</p>
          ) : expenses.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              No expenses found. Submit your first expense to get started.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Receipt</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>{new Date(expense.expenseDate).toLocaleDateString()}</TableCell>
                    <TableCell>{expense.category.name}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {expense.description || '—'}
                      {expense.adminNotes && expense.status === 'REJECTED' && (
                        <p className="text-xs text-destructive mt-1">Reason: {expense.adminNotes}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">${expense.amount.toFixed(2)}</TableCell>
                    <TableCell>
                      {expense.hasReceipt ? (
                        <Paperclip className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <span className="text-xs text-amber-600">None</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[expense.status] ?? 'secondary'}>
                        {expense.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ExpenseForm
        open={showNewExpense}
        onOpenChange={setShowNewExpense}
        onSuccess={loadExpenses}
      />
    </div>
  );
}
