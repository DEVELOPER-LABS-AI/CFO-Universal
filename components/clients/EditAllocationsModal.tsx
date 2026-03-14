'use client';

import { useState } from 'react';
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
import { updateDepositAllocations } from '@/app/actions/payment-settings';
import { refreshClientROI } from '@/app/actions/roi-calculations';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface AllocationRow {
  periodMonth: number;
  periodYear: number;
  serviceId: string | null;
  amount: string;
  description: string;
}

interface ExistingAllocation {
  periodMonth: number;
  periodYear: number;
  serviceName: string | null;
  serviceId?: string | null;
  amount: number;
  description: string | null;
}

interface ClientService {
  id: string;
  name: string;
}

interface EditAllocationsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receipt: {
    id: string;
    amount: number;
    date: string;
    description: string;
  };
  existingAllocations: ExistingAllocation[];
  clientId: string;
  clientServices: ClientService[];
  onSaved: () => void;
}

/**
 * Modal for editing payment allocations on an existing linked deposit.
 * Allows splitting a deposit across multiple periods/services.
 */
export function EditAllocationsModal({
  open,
  onOpenChange,
  receipt,
  existingAllocations,
  clientId,
  clientServices,
  onSaved,
}: EditAllocationsModalProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  // Initialize allocations from existing data
  const [allocations, setAllocations] = useState<AllocationRow[]>(() =>
    existingAllocations.length > 0
      ? existingAllocations.map((a) => ({
          periodMonth: a.periodMonth,
          periodYear: a.periodYear,
          serviceId: a.serviceId ?? null,
          amount: String(a.amount),
          description: a.description ?? '',
        }))
      : [{
          periodMonth: new Date(receipt.date).getMonth() + 1,
          periodYear: new Date(receipt.date).getFullYear(),
          serviceId: null,
          amount: String(receipt.amount),
          description: '',
        }]
  );

  const allocatedTotal = allocations.reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);
  const remaining = receipt.amount - allocatedTotal;
  const isBalanced = Math.abs(remaining) < 0.01;

  const updateAllocation = (index: number, field: keyof AllocationRow, value: string | number | null) => {
    setAllocations((prev) => prev.map((a, i) => i === index ? { ...a, [field]: value } : a));
  };

  const addRow = () => {
    const lastRow = allocations[allocations.length - 1];
    // Auto-advance month
    let nextMonth = lastRow ? lastRow.periodMonth + 1 : new Date().getMonth() + 1;
    let nextYear = lastRow ? lastRow.periodYear : new Date().getFullYear();
    if (nextMonth > 12) { nextMonth = 1; nextYear++; }

    setAllocations((prev) => [...prev, {
      periodMonth: nextMonth,
      periodYear: nextYear,
      serviceId: lastRow?.serviceId ?? null,
      amount: remaining > 0 ? remaining.toFixed(2) : '',
      description: '',
    }]);
  };

  const removeRow = (index: number) => {
    if (allocations.length <= 1) return;
    setAllocations((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!isBalanced) return;
    setSubmitting(true);
    try {
      const allocationData = allocations.map((a) => ({
        periodMonth: a.periodMonth,
        periodYear: a.periodYear,
        serviceId: a.serviceId,
        amount: parseFloat(a.amount) || 0,
        description: a.description || null,
      }));

      await updateDepositAllocations(receipt.id, allocationData);

      // Auto-refresh ROI for affected periods
      const periodMap = new Map<string, { month: number; year: number }>();
      // Include both old and new periods
      for (const a of existingAllocations) {
        const key = `${a.periodYear}-${a.periodMonth}`;
        if (!periodMap.has(key)) periodMap.set(key, { month: a.periodMonth, year: a.periodYear });
      }
      for (const a of allocations) {
        const key = `${a.periodYear}-${a.periodMonth}`;
        if (!periodMap.has(key)) periodMap.set(key, { month: a.periodMonth, year: a.periodYear });
      }

      for (const p of periodMap.values()) {
        try {
          await refreshClientROI({ client_id: clientId, month: p.month, year: p.year });
        } catch {
          // Non-critical
        }
      }

      toast({ title: 'Allocations updated', description: `${allocations.length} allocation(s) saved.` });
      onSaved();
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
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Allocations</DialogTitle>
          <DialogDescription>
            Split this deposit across periods and services. Total must balance to {formatCurrency(receipt.amount)}.
          </DialogDescription>
        </DialogHeader>

        {/* Deposit info */}
        <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Deposit</span>
            <span className="font-semibold">{formatCurrency(receipt.amount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Date</span>
            <span>{new Date(receipt.date).toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Description</span>
            <span>{receipt.description}</span>
          </div>
        </div>

        {/* Allocation rows */}
        <div className="space-y-3">
          {allocations.map((alloc, idx) => (
            <div key={idx} className="flex items-end gap-2 p-3 border rounded-lg bg-background">
              {/* Month */}
              <div className="w-24">
                {idx === 0 && <label className="text-xs text-muted-foreground block mb-1">Month</label>}
                <Select
                  value={String(alloc.periodMonth)}
                  onValueChange={(v) => updateAllocation(idx, 'periodMonth', Number(v))}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTH_NAMES.map((name, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Year */}
              <div className="w-20">
                {idx === 0 && <label className="text-xs text-muted-foreground block mb-1">Year</label>}
                <Select
                  value={String(alloc.periodYear)}
                  onValueChange={(v) => updateAllocation(idx, 'periodYear', Number(v))}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Service */}
              <div className="flex-1 min-w-0">
                {idx === 0 && <label className="text-xs text-muted-foreground block mb-1">Service</label>}
                <Select
                  value={alloc.serviceId ?? '__none__'}
                  onValueChange={(v) => updateAllocation(idx, 'serviceId', v === '__none__' ? null : v)}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="No service" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No service</SelectItem>
                    {clientServices.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Amount */}
              <div className="w-28">
                {idx === 0 && <label className="text-xs text-muted-foreground block mb-1">Amount</label>}
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={alloc.amount}
                  onChange={(e) => updateAllocation(idx, 'amount', e.target.value)}
                  className="h-8 text-sm"
                  placeholder="0.00"
                />
              </div>

              {/* Delete */}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => removeRow(idx)}
                disabled={allocations.length <= 1}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}

          <Button variant="outline" size="sm" onClick={addRow} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Add Row
          </Button>
        </div>

        {/* Balance bar */}
        <div className={`p-3 rounded-lg border text-sm font-medium ${
          isBalanced
            ? 'bg-green-50 border-green-200 text-green-700'
            : 'bg-amber-50 border-amber-200 text-amber-700'
        }`}>
          Allocated: {formatCurrency(allocatedTotal)} / {formatCurrency(receipt.amount)}
          {!isBalanced && (
            <span className="ml-2">
              ({remaining > 0 ? `${formatCurrency(remaining)} remaining` : `${formatCurrency(Math.abs(remaining))} over`})
            </span>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!isBalanced || submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Allocations
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
