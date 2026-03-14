'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Receipt, TrendingUp, Users } from 'lucide-react';

interface CompensationData {
  month: number;
  year: number;
  summary: {
    totalBonuses: number;
    totalExpenses: number;
    grandTotal: number;
    bdrCount: number;
    reportsApproved: number;
  };
  perBDR: {
    staffId: string;
    staffName: string;
    status: string;
    bonus: number;
    meetingsBooked: number;
    meetingsShowed: number;
    reportStatus: string | null;
    expenseCount: number;
    expenseTotal: number;
    grandTotal: number;
  }[];
}

interface CompensationSummaryProps {
  data: CompensationData;
}

/**
 * Displays a BDR compensation summary dashboard with summary cards
 * and a per-BDR breakdown table sorted by grand total descending.
 */
export function CompensationSummary({ data }: CompensationSummaryProps) {
  const { summary, perBDR, month, year } = data;

  const monthName = new Date(year, month - 1).toLocaleString('default', {
    month: 'long',
  });

  /** Format a number as a dollar amount with 2 decimal places. */
  const fmt = (amount: number): string =>
    `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const sorted = [...perBDR].sort((a, b) => b.grandTotal - a.grandTotal);

  const totals = sorted.reduce(
    (acc, row) => ({
      bonus: acc.bonus + row.bonus,
      expenseTotal: acc.expenseTotal + row.expenseTotal,
      grandTotal: acc.grandTotal + row.grandTotal,
    }),
    { bonus: 0, expenseTotal: 0, grandTotal: 0 }
  );

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">
        {monthName} {year} Compensation Summary
      </h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Bonuses</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {fmt(summary.totalBonuses)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmt(summary.totalExpenses)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Grand Total</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmt(summary.grandTotal)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">BDR Count</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.bdrCount}</div>
            <p className="text-xs text-muted-foreground">
              {summary.reportsApproved} of {summary.bdrCount} reported
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Per-BDR Breakdown Table */}
      <div className="rounded-lg border">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left text-sm font-medium">BDR Name</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
              <th className="px-4 py-3 text-right text-sm font-medium">Meetings Booked</th>
              <th className="px-4 py-3 text-right text-sm font-medium">Meetings Showed</th>
              <th className="px-4 py-3 text-right text-sm font-medium">Bonus</th>
              <th className="px-4 py-3 text-right text-sm font-medium">Expenses</th>
              <th className="px-4 py-3 text-right text-sm font-medium">Expense Total</th>
              <th className="px-4 py-3 text-right text-sm font-medium">Grand Total</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((bdr) => (
              <tr key={bdr.staffId} className="border-b last:border-b-0">
                <td className="px-4 py-3 text-sm">
                  <div className="flex items-center gap-2">
                    {bdr.staffName}
                    {bdr.reportStatus === 'APPROVED' ? (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        Approved
                      </Badge>
                    ) : bdr.reportStatus === null ? (
                      <span className="text-xs text-muted-foreground">Not reported</span>
                    ) : (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {bdr.reportStatus}
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm">{bdr.status}</td>
                <td className="px-4 py-3 text-sm text-right">{bdr.meetingsBooked}</td>
                <td className="px-4 py-3 text-sm text-right">{bdr.meetingsShowed}</td>
                <td className="px-4 py-3 text-sm text-right">{fmt(bdr.bonus)}</td>
                <td className="px-4 py-3 text-sm text-right">{bdr.expenseCount}</td>
                <td className="px-4 py-3 text-sm text-right">{fmt(bdr.expenseTotal)}</td>
                <td className="px-4 py-3 text-sm text-right font-medium">
                  {fmt(bdr.grandTotal)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t bg-muted/50">
              <td className="px-4 py-3 text-sm font-semibold" colSpan={4}>
                Totals
              </td>
              <td className="px-4 py-3 text-sm text-right font-semibold">
                {fmt(totals.bonus)}
              </td>
              <td className="px-4 py-3 text-sm text-right" />
              <td className="px-4 py-3 text-sm text-right font-semibold">
                {fmt(totals.expenseTotal)}
              </td>
              <td className="px-4 py-3 text-sm text-right font-semibold">
                {fmt(totals.grandTotal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
