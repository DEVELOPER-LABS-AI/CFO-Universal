'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils/error';
import { createAgencyMonthlyBreakdown } from '@/app/actions/agency-management';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

interface StaffItem {
  staff_id: string;
  name: string;
  role: string;
  base_pay: string;
  expenses: string;
  reimbursements: string;
  notes: string;
  true_cost: number | null;
}

interface ServiceItem {
  name: string;
  description: string;
  amount: string;
}

interface AddBreakdownModalProps {
  agencyId: string;
  agencyStaff: Array<{ id: string; name: string; role: string; true_cost?: number | null }>;
  trigger?: React.ReactNode;
}

export function AddBreakdownModal({ agencyId, agencyStaff, trigger }: AddBreakdownModalProps) {
  const router = useRouter();
  const now = new Date();

  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const [staffItems, setStaffItems] = useState<StaffItem[]>(
    agencyStaff.map((s) => ({
      staff_id: s.id,
      name: s.name,
      role: s.role,
      base_pay: '',
      expenses: '',
      reimbursements: '',
      notes: '',
      true_cost: s.true_cost ?? null,
    }))
  );

  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([]);

  const parseNum = (val: string) => parseFloat(val) || 0;

  const getStaffSubtotal = (item: StaffItem) =>
    parseNum(item.base_pay) + parseNum(item.expenses) + parseNum(item.reimbursements);

  const staffTotal = staffItems.reduce((sum, s) => sum + getStaffSubtotal(s), 0);
  const servicesTotal = serviceItems.reduce((sum, s) => sum + parseNum(s.amount), 0);
  const breakdownTotal = staffTotal + servicesTotal;

  const updateStaffItem = (index: number, field: keyof StaffItem, value: string) => {
    setStaffItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const updateServiceItem = (index: number, field: keyof ServiceItem, value: string) => {
    setServiceItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addServiceRow = () => {
    setServiceItems((prev) => [...prev, { name: '', description: '', amount: '' }]);
  };

  const removeServiceRow = (index: number) => {
    setServiceItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const staff = staffItems.map((s) => ({
        staff_id: s.staff_id,
        name: s.name,
        role: s.role,
        base_pay: parseNum(s.base_pay),
        expenses: parseNum(s.expenses),
        reimbursements: parseNum(s.reimbursements),
        notes: s.notes,
        subtotal: getStaffSubtotal(s),
        true_cost: s.true_cost,
      }));

      const services = serviceItems.map((s) => ({
        name: s.name,
        description: s.description,
        amount: parseNum(s.amount),
      }));

      const result = await createAgencyMonthlyBreakdown({
        agency_id: agencyId,
        month,
        year,
        breakdown: { staff, services },
      });

      if (result.warning) {
        toast.warning(result.warning);
      } else {
        toast.success('Breakdown added successfully');
      }

      setOpen(false);
      router.refresh();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || 'Failed to add breakdown');
    } finally {
      setIsSubmitting(false);
    }
  };

  const yearOptions = [2024, 2025, 2026];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button variant="outline" size="sm">Add Breakdown</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Monthly Breakdown</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Month / Year */}
          <div className="flex gap-4">
            <div className="space-y-2 flex-1">
              <Label htmlFor="month">Month</Label>
              <select
                id="month"
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {MONTH_LABELS.map((label, i) => (
                  <option key={i + 1} value={i + 1}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2 flex-1">
              <Label htmlFor="year">Year</Label>
              <select
                id="year"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Staff Costs */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Staff Costs</h3>
            {staffItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">No staff members linked to this agency.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left pb-2 font-medium">Name / Role</th>
                      <th className="text-right pb-2 font-medium px-2">Base Pay</th>
                      <th className="text-right pb-2 font-medium px-2">Expenses</th>
                      <th className="text-right pb-2 font-medium px-2">Reimbursements</th>
                      <th className="text-left pb-2 font-medium px-2">Notes</th>
                      <th className="text-right pb-2 font-medium">Subtotal</th>
                      <th className="text-right pb-2 font-medium px-2">True Cost</th>
                      <th className="text-right pb-2 font-medium">Margin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {staffItems.map((item, i) => (
                      <tr key={item.staff_id}>
                        <td className="py-2 pr-2">
                          <p className="font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {item.role.replace(/_/g, ' ').toLowerCase()}
                          </p>
                        </td>
                        <td className="py-2 px-2">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={item.base_pay}
                            onChange={(e) => updateStaffItem(i, 'base_pay', e.target.value)}
                            className="w-24 text-right h-8"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={item.expenses}
                            onChange={(e) => updateStaffItem(i, 'expenses', e.target.value)}
                            className="w-24 text-right h-8"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={item.reimbursements}
                            onChange={(e) => updateStaffItem(i, 'reimbursements', e.target.value)}
                            className="w-24 text-right h-8"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <Input
                            placeholder="Optional notes"
                            value={item.notes}
                            onChange={(e) => updateStaffItem(i, 'notes', e.target.value)}
                            className="w-36 h-8"
                          />
                        </td>
                        <td className="py-2 text-right font-semibold">
                          ${getStaffSubtotal(item).toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-right text-muted-foreground">
                          {item.true_cost != null
                            ? `$${item.true_cost.toFixed(2)}`
                            : '\u2014'}
                        </td>
                        <td className="py-2 text-right">
                          {item.true_cost != null && parseNum(item.base_pay) > 0 ? (
                            (() => {
                              const margin = parseNum(item.base_pay) - item.true_cost;
                              const pct = item.true_cost > 0
                                ? ((margin / item.true_cost) * 100).toFixed(0)
                                : '0';
                              return (
                                <span className={margin < 0 ? 'text-destructive font-medium' : 'text-green-600 font-medium'}>
                                  ${margin.toFixed(2)} ({pct}%)
                                </span>
                              );
                            })()
                          ) : (
                            <span className="text-muted-foreground">&mdash;</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t">
                      <td colSpan={5} className="pt-2 text-right text-sm font-medium text-muted-foreground pr-2">
                        Staff Total
                      </td>
                      <td className="pt-2 text-right font-bold">
                        ${staffTotal.toFixed(2)}
                      </td>
                      <td className="pt-2 px-2 text-right font-bold text-muted-foreground">
                        {(() => {
                          const trueCostTotal = staffItems.reduce(
                            (sum, s) => sum + (s.true_cost ?? 0), 0
                          );
                          return trueCostTotal > 0 ? `$${trueCostTotal.toFixed(2)}` : '\u2014';
                        })()}
                      </td>
                      <td className="pt-2 text-right font-bold">
                        {(() => {
                          const trueCostTotal = staffItems.reduce(
                            (sum, s) => sum + (s.true_cost ?? 0), 0
                          );
                          if (trueCostTotal <= 0) return '\u2014';
                          const marginTotal = staffTotal - trueCostTotal;
                          const marginPct = ((marginTotal / trueCostTotal) * 100).toFixed(0);
                          return (
                            <span className={marginTotal < 0 ? 'text-destructive' : 'text-green-600'}>
                              ${marginTotal.toFixed(2)} ({marginPct}%)
                            </span>
                          );
                        })()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Services */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Services</h3>
              <Button type="button" variant="outline" size="sm" onClick={addServiceRow}>
                Add Service
              </Button>
            </div>
            {serviceItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">No services added yet.</p>
            ) : (
              <div className="space-y-2">
                {serviceItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      placeholder="Service name"
                      value={item.name}
                      onChange={(e) => updateServiceItem(i, 'name', e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => updateServiceItem(i, 'description', e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={item.amount}
                      onChange={(e) => updateServiceItem(i, 'amount', e.target.value)}
                      className="w-28 text-right"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeServiceRow(i)}
                      className="text-destructive hover:text-destructive px-2"
                      title="Remove service"
                    >
                      &times;
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Summary */}
          {(() => {
            const trueCostTotal = staffItems.reduce(
              (sum, s) => sum + (s.true_cost ?? 0), 0
            );
            const marginTotal = trueCostTotal > 0 ? staffTotal - trueCostTotal : 0;
            const marginPct = trueCostTotal > 0 ? ((marginTotal / trueCostTotal) * 100).toFixed(1) : null;

            return (
              <div className="rounded-lg border bg-muted/30 p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Staff Total (Billed)</span>
                  <span className="font-medium">${staffTotal.toFixed(2)}</span>
                </div>
                {trueCostTotal > 0 && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Staff True Cost</span>
                      <span className="font-medium">${trueCostTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Staff Margin</span>
                      <span className={`font-medium ${marginTotal < 0 ? 'text-destructive' : 'text-green-600'}`}>
                        ${marginTotal.toFixed(2)} ({marginPct}%)
                      </span>
                    </div>
                  </>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Services Total</span>
                  <span className="font-medium">${servicesTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="font-semibold">Breakdown Total</span>
                  <span className="font-bold">${breakdownTotal.toFixed(2)}</span>
                </div>
              </div>
            );
          })()}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Breakdown'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
