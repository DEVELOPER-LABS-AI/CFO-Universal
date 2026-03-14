'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/currency';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/lib/utils/error';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const PAYMENT_METHODS = [
  { value: 'ACH', label: 'ACH', defaultFee: 0.005 },
  { value: 'CREDIT_CARD', label: 'Credit Card', defaultFee: 0.03 },
  { value: 'DOMESTIC_WIRE', label: 'Wire (Domestic)', defaultFee: 0 },
  { value: 'INTERNATIONAL_WIRE', label: 'Wire (Intl)', defaultFee: 0 },
  { value: 'CHECK', label: 'Check', defaultFee: 0 },
];

interface AllocationRow {
  periodMonth: number;
  periodYear: number;
  serviceId: string | null;
  amount: string;
  description: string;
}

interface ClientService {
  id: string;
  name: string;
}

interface LinkDepositModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deposit: {
    mercuryTransactionId: string;
    amount: number;
    transactionDate: string;
    counterpartyName: string | null;
  };
  clientId: string;
  clientName: string;
  clientServices: ClientService[];
  organizationId: string;
  feeDefaults: Record<string, number>;
  onLinked: (linkedPeriods: { month: number; year: number }[]) => void;
}

/**
 * Modal for linking a Mercury deposit to a client with fee tracking
 * and multi-period payment allocation.
 */
export function LinkDepositModal({
  open,
  onOpenChange,
  deposit,
  clientId,
  clientName,
  clientServices,
  organizationId,
  feeDefaults,
  onLinked,
}: LinkDepositModalProps) {
  const { toast } = useToast();
  const txDate = new Date(deposit.transactionDate);
  const defaultMonth = txDate.getMonth() + 1;
  const defaultYear = txDate.getFullYear();

  const [paymentMethod, setPaymentMethod] = useState<string>('ACH');
  const [feePercentage, setFeePercentage] = useState<string>('0.5');
  const [feeAmountOverride, setFeeAmountOverride] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [allocations, setAllocations] = useState<AllocationRow[]>([
    {
      periodMonth: defaultMonth,
      periodYear: defaultYear,
      serviceId: null,
      amount: deposit.amount.toFixed(2),
      description: '',
    },
  ]);

  // Update fee when payment method changes
  useEffect(() => {
    const defaultPct = feeDefaults[paymentMethod] ?? 0;
    setFeePercentage((defaultPct * 100).toFixed(1));
    setFeeAmountOverride('');
  }, [paymentMethod, feeDefaults]);

  const netAmount = deposit.amount;
  const feeAmount = feeAmountOverride
    ? parseFloat(feeAmountOverride) || 0
    : netAmount * (parseFloat(feePercentage) / 100 || 0);
  const grossAmount = netAmount + feeAmount;

  const allocationTotal = allocations.reduce(
    (sum, a) => sum + (parseFloat(a.amount) || 0),
    0
  );
  const isBalanced = Math.abs(allocationTotal - netAmount) < 0.01;

  const addRow = () => {
    setAllocations([
      ...allocations,
      {
        periodMonth: defaultMonth,
        periodYear: defaultYear,
        serviceId: null,
        amount: '',
        description: '',
      },
    ]);
  };

  const removeRow = (idx: number) => {
    if (allocations.length <= 1) return;
    setAllocations(allocations.filter((_, i) => i !== idx));
  };

  const updateRow = (idx: number, field: keyof AllocationRow, value: string | number | null) => {
    setAllocations(
      allocations.map((row, i) =>
        i === idx ? { ...row, [field]: value } : row
      )
    );
  };

  const handleSubmit = async () => {
    if (!isBalanced) return;
    setSubmitting(true);

    try {
      const body = {
        mercuryTransactionId: deposit.mercuryTransactionId,
        clientId,
        organizationId,
        userId: 'admin',
        paymentMethod: paymentMethod || null,
        grossAmount: feeAmount > 0 ? grossAmount : null,
        feeAmount,
        feePercentage: feeAmount > 0 ? parseFloat(feePercentage) / 100 : null,
        notes: notes || null,
        allocations: allocations.map((a) => ({
          periodMonth: a.periodMonth,
          periodYear: a.periodYear,
          serviceId: a.serviceId || null,
          amount: parseFloat(a.amount) || 0,
          description: a.description || null,
        })),
      };

      const res = await fetch('/api/mercury/deposits/link-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || data.error || 'Failed to link deposit');
      }

      toast({ title: 'Deposit linked', description: `Linked to ${clientName} with ${allocations.length} allocation(s)` });
      // Deduplicate periods from allocations
      const periodMap = new Map<string, { month: number; year: number }>();
      for (const a of allocations) {
        const key = `${a.periodYear}-${a.periodMonth}`;
        if (!periodMap.has(key)) periodMap.set(key, { month: a.periodMonth, year: a.periodYear });
      }
      onLinked(Array.from(periodMap.values()));
      onOpenChange(false);
    } catch (error: unknown) {
      toast({ title: 'Error', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Link Deposit to {clientName}</DialogTitle>
          <DialogDescription>
            Allocate this deposit across periods and services. Total allocations must equal the net amount.
          </DialogDescription>
        </DialogHeader>

        {/* Deposit info */}
        <div className="p-3 bg-green-50 rounded-lg border border-green-200">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-medium">{deposit.counterpartyName || 'Mercury Deposit'}</p>
              <p className="text-xs text-muted-foreground">{new Date(deposit.transactionDate).toLocaleDateString()}</p>
            </div>
            <p className="text-lg font-bold text-green-600">+{formatCurrency(deposit.amount)}</p>
          </div>
        </div>

        {/* Payment method + Fee */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Payment Method</label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((pm) => (
                  <SelectItem key={pm.value} value={pm.value}>{pm.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Fee %</label>
            <Input
              className="mt-1"
              type="number"
              step="0.1"
              min="0"
              max="50"
              value={feePercentage}
              onChange={(e) => { setFeePercentage(e.target.value); setFeeAmountOverride(''); }}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Fee $ (override)</label>
            <Input
              className="mt-1"
              type="number"
              step="0.01"
              min="0"
              placeholder={feeAmount.toFixed(2)}
              value={feeAmountOverride}
              onChange={(e) => setFeeAmountOverride(e.target.value)}
            />
          </div>
        </div>

        {/* Fee summary */}
        {feeAmount > 0 && (
          <div className="flex gap-4 text-xs text-muted-foreground px-1">
            <span>Gross: {formatCurrency(grossAmount)}</span>
            <span>Fee: -{formatCurrency(feeAmount)}</span>
            <span className="font-medium text-foreground">Net: {formatCurrency(netAmount)}</span>
          </div>
        )}

        {/* Allocation rows */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Period Allocations</label>
            <Button variant="outline" size="sm" onClick={addRow}>
              <Plus className="h-3 w-3 mr-1" /> Add Row
            </Button>
          </div>

          {allocations.map((row, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-center">
              <Select
                value={String(row.periodMonth)}
                onValueChange={(v) => updateRow(idx, 'periodMonth', parseInt(v))}
              >
                <SelectTrigger className="col-span-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.map((name, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={String(row.periodYear)}
                onValueChange={(v) => updateRow(idx, 'periodYear', parseInt(v))}
              >
                <SelectTrigger className="col-span-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {clientServices.length > 0 && (
                <Select
                  value={row.serviceId || '__none'}
                  onValueChange={(v) => updateRow(idx, 'serviceId', v === '__none' ? null : v)}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Service" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">No service</SelectItem>
                    {clientServices.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Input
                className={clientServices.length > 0 ? 'col-span-3' : 'col-span-6'}
                type="number"
                step="0.01"
                min="0"
                placeholder="Amount"
                value={row.amount}
                onChange={(e) => updateRow(idx, 'amount', e.target.value)}
              />

              <Button
                variant="ghost"
                size="sm"
                className="col-span-2 h-9"
                onClick={() => removeRow(idx)}
                disabled={allocations.length <= 1}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}

          {/* Balance indicator */}
          <div className={`p-2 rounded text-sm font-medium text-center ${
            isBalanced
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            Allocated: {formatCurrency(allocationTotal)} / {formatCurrency(netAmount)} net
            {isBalanced ? ' -- Balanced' : ` -- ${formatCurrency(Math.abs(netAmount - allocationTotal))} remaining`}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="text-xs font-medium text-muted-foreground">Notes (optional)</label>
          <Input
            className="mt-1"
            placeholder="e.g. Covers Oct + Nov BDR service"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!isBalanced || submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Link & Allocate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
