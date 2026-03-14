'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CheckCircle2, Clock, AlertCircle, TrendingUp } from 'lucide-react';
import { getErrorMessage } from '@/lib/utils/error';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RevenueRecord {
  id: string;
  amount: number;
  transaction_date: string;
  status: string;
  xero_invoice_number: string | null;
  description: string | null;
}

interface CashReceipt {
  id: string;
  mercury_transaction_id: string;
  amount: number;
  receipt_date: string;
  linked_at: string;
}

type ReconciliationStatus = 'FULLY_PAID' | 'PARTIALLY_PAID' | 'UNPAID' | 'OVERPAID';

interface ReconciliationData {
  clientId: string;
  clientName: string;
  period: { month: number; year: number };
  invoiced: { total: number; records: RevenueRecord[] };
  received: { total: number; receipts: CashReceipt[] };
  reconciliation: { outstanding: number; overpayment: number; status: ReconciliationStatus };
}

interface RevenueReconciliationPanelProps {
  clientId: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function StatusBadge({ status }: { status: ReconciliationStatus }) {
  const config: Record<ReconciliationStatus, { label: string; className: string; Icon: any }> = {
    FULLY_PAID: { label: 'Fully Paid', className: 'bg-green-50 text-green-700 border-green-200', Icon: CheckCircle2 },
    PARTIALLY_PAID: { label: 'Partially Paid', className: 'bg-yellow-50 text-yellow-700 border-yellow-200', Icon: Clock },
    UNPAID: { label: 'Unpaid', className: 'bg-red-50 text-red-700 border-red-200', Icon: AlertCircle },
    OVERPAID: { label: 'Overpaid', className: 'bg-blue-50 text-blue-700 border-blue-200', Icon: TrendingUp },
  };

  const { label, className, Icon } = config[status] ?? config.UNPAID;

  return (
    <Badge className={`gap-1 hover:bg-opacity-100 ${className}`}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RevenueReconciliationPanel({ clientId }: RevenueReconciliationPanelProps) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<ReconciliationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `/api/clients/${clientId}/revenue-reconciliation?month=${month}&year=${year}`
        );
        if (!res.ok) throw new Error('Failed to load reconciliation data');
        const json = await res.json();
        setData(json);
      } catch (err: unknown) {
        setError(getErrorMessage(err) ?? 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [clientId, month, year]);

  // Build year options (current year and 2 prior)
  const yearOptions = [year - 2, year - 1, year];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle>Revenue Reconciliation</CardTitle>
            <CardDescription>Invoiced vs received for this period</CardDescription>
          </div>

          {/* Period picker */}
          <div className="flex items-center gap-2">
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_NAMES.map((name, idx) => (
                  <SelectItem key={idx + 1} value={String(idx + 1)}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {loading && (
          <p className="text-sm text-muted-foreground text-center py-4">Loading…</p>
        )}

        {error && (
          <p className="text-sm text-red-600 text-center py-4">{error}</p>
        )}

        {data && !loading && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Invoiced</p>
                <p className="text-xl font-bold">${data.invoiced.total.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Received</p>
                <p className="text-xl font-bold text-green-600">
                  ${data.received.total.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <StatusBadge status={data.reconciliation.status} />
              </div>
            </div>

            {data.reconciliation.outstanding > 0 && (
              <p className="text-sm text-amber-600">
                Outstanding: ${data.reconciliation.outstanding.toFixed(2)}
              </p>
            )}
            {data.reconciliation.overpayment > 0 && (
              <p className="text-sm text-blue-600">
                Overpayment: ${data.reconciliation.overpayment.toFixed(2)}
              </p>
            )}

            {/* Invoiced records */}
            {data.invoiced.records.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Invoiced</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.invoiced.records.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-sm">{r.xero_invoice_number ?? '—'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(r.transaction_date).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs capitalize">
                            {r.status.toLowerCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ${r.amount.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Mercury receipts */}
            {data.received.receipts.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Mercury Deposits</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Transaction ID</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.received.receipts.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs text-muted-foreground truncate max-w-[140px]">
                          {r.mercury_transaction_id}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(r.receipt_date).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right font-medium text-green-600">
                          +${r.amount.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {data.invoiced.records.length === 0 && data.received.receipts.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                No invoices or deposits for {MONTH_NAMES[month - 1]} {year}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
