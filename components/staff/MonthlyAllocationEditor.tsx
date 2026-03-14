'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { upsertMonthlyAllocation, deleteMonthlyAllocation } from '@/app/actions/staff-management';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils/error';
import { CalendarDays } from 'lucide-react';

interface MonthlyOverride {
  id: string;
  month: number;
  year: number;
  allocation_percentage: number;
}

interface MonthlyAllocationEditorProps {
  assignmentId: string;
  staffName: string;
  clientName: string;
  baseAllocation: number;
  overrides: MonthlyOverride[];
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * Dialog for manually editing monthly allocation overrides on a staff assignment.
 * Shows a grid of months (3 back + current + 3 forward) with editable allocation %.
 */
export function MonthlyAllocationEditor({
  assignmentId,
  staffName,
  clientName,
  baseAllocation,
  overrides,
}: MonthlyAllocationEditorProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Build the list of months to display: 3 back, current, 3 forward
  const now = new Date();
  const months: { month: number; year: number }[] = [];
  for (let offset = -3; offset <= 3; offset++) {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    months.push({ month: d.getMonth() + 1, year: d.getFullYear() });
  }

  // Build override lookup
  const overrideMap = new Map<string, number>();
  for (const o of overrides) {
    overrideMap.set(`${o.year}-${o.month}`, o.allocation_percentage);
  }

  /**
   * Get the effective allocation for a given month.
   */
  function getEffective(month: number, year: number): number {
    return overrideMap.get(`${year}-${month}`) ?? baseAllocation;
  }

  /**
   * Save or delete an override for a specific month.
   */
  async function handleSave(month: number, year: number, value: number) {
    const key = `${year}-${month}`;
    setSavingKey(key);

    try {
      if (value === baseAllocation) {
        // Matches base — remove override
        if (overrideMap.has(key)) {
          await deleteMonthlyAllocation({
            assignment_id: assignmentId,
            month,
            year,
          });
          toast.success(`Reverted ${MONTH_NAMES[month - 1]} ${year} to base allocation`);
        }
      } else {
        await upsertMonthlyAllocation({
          assignment_id: assignmentId,
          month,
          year,
          allocation_percentage: value,
        });
        toast.success(`Updated ${MONTH_NAMES[month - 1]} ${year} to ${value}%`);
      }
      router.refresh();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || 'Failed to update allocation');
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-xs">
          <CalendarDays className="h-3.5 w-3.5 mr-1" />
          Monthly %
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Monthly Allocation</DialogTitle>
          <DialogDescription>
            {staffName} on {clientName} — Base: {baseAllocation}%
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <div className="grid grid-cols-[1fr_80px_60px] gap-2 items-center text-xs font-medium text-muted-foreground px-1">
            <span>Month</span>
            <span>Allocation</span>
            <span></span>
          </div>
          {months.map(({ month, year }) => {
            const key = `${year}-${month}`;
            const effective = getEffective(month, year);
            const hasOverride = overrideMap.has(key);
            const isCurrent = month === now.getMonth() + 1 && year === now.getFullYear();
            const isSaving = savingKey === key;

            return (
              <div
                key={key}
                className={`grid grid-cols-[1fr_80px_60px] gap-2 items-center px-1 py-1.5 rounded ${
                  isCurrent ? 'bg-muted/50' : ''
                }`}
              >
                <span className="text-sm">
                  {MONTH_NAMES[month - 1]} {year}
                  {isCurrent && (
                    <Badge variant="outline" className="ml-2 text-xs">
                      current
                    </Badge>
                  )}
                </span>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={5}
                  defaultValue={effective}
                  className="h-8 text-sm"
                  disabled={isSaving}
                  onBlur={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val) && val >= 0 && val <= 100 && val !== effective) {
                      handleSave(month, year, val);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                />
                <div>
                  {hasOverride && (
                    <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700">
                      override
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground pt-2">
            Edit a month and press Tab or Enter to save. Values matching the base ({baseAllocation}%) will remove the override.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
