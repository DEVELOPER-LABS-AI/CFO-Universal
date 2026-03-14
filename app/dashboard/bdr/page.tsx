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
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CompensationSummary } from '@/components/bdr-admin/CompensationSummary';
import { getBDRCompensationSummary } from '@/app/actions/bdr-admin-actions';
import Link from 'next/link';
import { FileText, Receipt, Settings } from 'lucide-react';

/**
 * BDR Management dashboard for leadership with compensation summary
 * and navigation to sub-pages.
 */
export default function BDRDashboardPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const result = await getBDRCompensationSummary({ month, year });
    if (result.success) {
      setData(result.data);
    }
    setLoading(false);
  }, [month, year]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">BDR Management</h1>
          <p className="text-muted-foreground">Compensation overview and team management</p>
        </div>
      </div>

      {/* Quick Navigation */}
      <div className="flex gap-3">
        <Link href="/dashboard/bdr/pay-plans">
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Pay Plans
          </Button>
        </Link>
        <Link href="/dashboard/bdr/reports">
          <Button variant="outline" size="sm">
            <FileText className="h-4 w-4 mr-2" />
            Report Review
          </Button>
        </Link>
        <Link href="/dashboard/bdr/expenses">
          <Button variant="outline" size="sm">
            <Receipt className="h-4 w-4 mr-2" />
            Expense Approval
          </Button>
        </Link>
      </div>

      {/* Month/Year Selector */}
      <div className="flex gap-4 items-end">
        <div className="space-y-2">
          <Label>Month</Label>
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>
                  {new Date(2000, i).toLocaleString('default', { month: 'long' })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Year</Label>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 5 }, (_, i) => {
                const y = now.getFullYear() - 2 + i;
                return (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Compensation Summary */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading compensation data...</div>
      ) : data ? (
        <CompensationSummary data={data} />
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Failed to load compensation data
          </CardContent>
        </Card>
      )}
    </div>
  );
}
