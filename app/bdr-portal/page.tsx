'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Receipt, DollarSign, Clock } from 'lucide-react';
import Link from 'next/link';
import { getBDRDashboard } from '@/app/actions/bdr-portal-actions';

/**
 * BDR Portal dashboard showing current month status, bonus preview, and recent expenses.
 */
export default function BDRPortalDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const result = await getBDRDashboard();
      if (result.success) setData(result.data);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading dashboard...</div>;
  }

  if (!data) {
    return <div className="text-center py-8 text-muted-foreground">Failed to load dashboard.</div>;
  }

  const now = new Date();
  const monthName = now.toLocaleString('default', { month: 'long', year: 'numeric' });

  const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
    DRAFT: { label: 'Draft', variant: 'secondary' },
    SUBMITTED: { label: 'Submitted', variant: 'default' },
    APPROVED: { label: 'Approved', variant: 'default' },
    NEEDS_CORRECTION: { label: 'Needs Correction', variant: 'destructive' },
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Welcome, {data.bdr.name}</h1>
        <p className="text-muted-foreground">{monthName} Overview</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Bonus</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              ${data.monthlyStats.totalBonus.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              {data.currentPayPlan ? `Plan: ${data.currentPayPlan.name}` : 'No pay plan assigned'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expenses Approved</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${data.monthlyStats.totalExpensesApproved.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              ${data.monthlyStats.totalExpensesPending.toFixed(2)} pending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Report Status</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {data.currentReport ? (
              <div>
                <Badge variant={statusMap[data.currentReport.status]?.variant ?? 'secondary'}>
                  {statusMap[data.currentReport.status]?.label ?? data.currentReport.status}
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">
                  {data.currentReport.meetingsShowed} meetings showed
                </p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-medium">Not started</p>
                <p className="text-xs text-muted-foreground">Submit your monthly report</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-3">
        <Link href="/bdr-portal/reports">
          <Button>
            <FileText className="h-4 w-4 mr-2" />
            {data.currentReport ? 'View Report' : 'Submit Report'}
          </Button>
        </Link>
        <Link href="/bdr-portal/expenses">
          <Button variant="outline">
            <Receipt className="h-4 w-4 mr-2" />
            New Expense
          </Button>
        </Link>
      </div>

      {/* Recent Expenses */}
      {data.recentExpenses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Expenses</CardTitle>
            <CardDescription>Your latest expense submissions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.recentExpenses.map((expense: any) => (
                <div key={expense.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{expense.category}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(expense.expenseDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">${expense.amount.toFixed(2)}</span>
                    <Badge
                      variant={expense.status === 'APPROVED' ? 'default' : expense.status === 'REJECTED' ? 'destructive' : 'secondary'}
                      className="text-xs"
                    >
                      {expense.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
