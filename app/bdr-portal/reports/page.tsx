'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { MonthlyReportForm } from '@/components/bdr-portal/MonthlyReportForm';
import { getBDRMonthlyReport } from '@/app/actions/bdr-portal-actions';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * BDR monthly report page with month selector.
 */
export default function BDRReportsPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [report, setReport] = useState<any>(null);
  const [payPlan, setPayPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadReport = useCallback(async () => {
    setLoading(true);
    const result = await getBDRMonthlyReport({ month, year });
    if (result.success) {
      setReport(result.data.report);
      setPayPlan(result.data.payPlan);
    }
    setLoading(false);
  }, [month, year]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  // Generate year options (current year and previous 2 years)
  const years = Array.from({ length: 3 }, (_, i) => now.getFullYear() - i);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Monthly Report</h1>
        <p className="text-muted-foreground">
          Submit your end-of-month performance report
        </p>
      </div>

      {/* Month/Year Selector */}
      <div className="flex gap-4 items-end">
        <div className="space-y-2">
          <Label>Month</Label>
          <Select value={String(month)} onValueChange={(v) => setMonth(parseInt(v))}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Year</Label>
          <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v))}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Report Form */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading report...</div>
      ) : (
        <MonthlyReportForm
          key={`${month}-${year}`}
          month={month}
          year={year}
          report={report}
          payPlan={payPlan}
          onSaved={loadReport}
        />
      )}
    </div>
  );
}
