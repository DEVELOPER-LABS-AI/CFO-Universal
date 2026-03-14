'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ExpenseApprovalCard } from '@/components/bdr-admin/ExpenseApprovalCard';
import { getExpensesForApproval } from '@/app/actions/bdr-admin-actions';
import { DollarSign, Clock, CheckCircle, XCircle } from 'lucide-react';

/**
 * Admin page for reviewing and approving BDR expense claims.
 */
export default function BDRExpenseApprovalPage() {
  const [statusFilter, setStatusFilter] = useState('SUBMITTED');
  const [expenses, setExpenses] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  const loadExpenses = useCallback(async () => {
    setLoading(true);
    const result = await getExpensesForApproval({
      status: statusFilter === 'ALL' ? undefined : statusFilter,
      page,
      pageSize,
    });
    if (result.success) {
      setExpenses(result.data.expenses);
      setTotal(result.data.total);
      setSummary(result.data.summary);
    }
    setLoading(false);
  }, [statusFilter, page]);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">BDR Expense Approval</h1>
        <p className="text-muted-foreground">Review and approve expense reimbursement claims</p>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">
                ${summary.pendingAmount.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">{summary.pendingCount} claims</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Approved</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                ${summary.approvedAmount.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">{summary.approvedCount} claims</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rejected</CardTitle>
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                ${summary.rejectedAmount.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">{summary.rejectedCount} claims</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${(summary.pendingAmount + summary.approvedAmount).toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">pending + approved</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Status Filter */}
      <div className="flex gap-4 items-end">
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SUBMITTED">Pending</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
              <SelectItem value="ALL">All</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Expenses List */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading expenses...</div>
      ) : expenses.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No expenses found
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {expenses.map((expense) => (
            <ExpenseApprovalCard key={expense.id} expense={expense} onAction={loadExpenses} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 text-sm border rounded disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-3 py-1 text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 text-sm border rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
