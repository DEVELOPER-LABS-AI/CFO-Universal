'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { batchUpsertTimeEntries } from '@/app/actions/timesheet-actions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TimeEntryData {
  id?: string;
  assignment_id: string | null;
  entry_date: string;
  hours: number;
  description: string | null;
  is_billable: boolean;
}

interface AssignmentInfo {
  id: string;
  client_name: string;
}

interface TimesheetGridProps {
  timesheetId: string;
  periodStart: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  entries: TimeEntryData[];
  assignments: AssignmentInfo[];
  onTotalsChange?: (totals: { total: number; billable: number }) => void;
}

// Bench row sentinel
const BENCH_ASSIGNMENT_ID = '__bench__';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDaysOfWeek(mondayStr: string): string[] {
  const monday = new Date(mondayStr + 'T00:00:00Z');
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().split('T')[0];
  });
}

function getDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
}

function getDayNumber(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', { day: 'numeric', timeZone: 'UTC' });
}

function snapTo025(value: number): number {
  return Math.round(value * 4) / 4;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TimesheetGrid({
  timesheetId,
  periodStart,
  status,
  entries,
  assignments,
  onTotalsChange,
}: TimesheetGridProps) {
  const isEditable = status === 'DRAFT' || status === 'REJECTED';
  const days = useMemo(() => getDaysOfWeek(periodStart), [periodStart]);

  // Build rows: one per assignment + bench row
  const rows = useMemo(() => {
    const assignmentRows = assignments.map((a) => ({
      assignmentId: a.id,
      label: a.client_name,
      isBench: false,
    }));
    // Add bench row for unassigned time
    assignmentRows.push({
      assignmentId: BENCH_ASSIGNMENT_ID,
      label: 'Bench / Internal',
      isBench: true,
    });
    return assignmentRows;
  }, [assignments]);

  // Build a grid state: { [assignmentId-date]: { hours, description, entryId, isBillable } }
  type CellKey = string;
  type CellData = {
    hours: number;
    description: string;
    entryId?: string;
    isBillable: boolean;
  };

  function cellKey(assignmentId: string, date: string): CellKey {
    return `${assignmentId}::${date}`;
  }

  const initialGrid = useMemo(() => {
    const grid = new Map<CellKey, CellData>();
    for (const entry of entries) {
      const aId = entry.assignment_id ?? BENCH_ASSIGNMENT_ID;
      const key = cellKey(aId, entry.entry_date);
      grid.set(key, {
        hours: entry.hours,
        description: entry.description ?? '',
        entryId: entry.id,
        isBillable: entry.is_billable,
      });
    }
    return grid;
  }, [entries]);

  const [grid, setGrid] = useState<Map<CellKey, CellData>>(initialGrid);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const pendingChanges = useRef<Set<CellKey>>(new Set());

  // Sync initial grid when entries change
  useEffect(() => {
    setGrid(initialGrid);
  }, [initialGrid]);

  // Calculate totals
  const totals = useMemo(() => {
    let total = 0;
    let billable = 0;
    for (const cell of grid.values()) {
      total += cell.hours;
      if (cell.isBillable) billable += cell.hours;
    }
    return { total, billable };
  }, [grid]);

  // Notify parent of totals
  useEffect(() => {
    onTotalsChange?.(totals);
  }, [totals, onTotalsChange]);

  // Get hours for a specific cell
  const getCellHours = useCallback(
    (assignmentId: string, date: string): number => {
      return grid.get(cellKey(assignmentId, date))?.hours ?? 0;
    },
    [grid],
  );

  // Row total
  const getRowTotal = useCallback(
    (assignmentId: string): number => {
      return days.reduce((sum, d) => sum + getCellHours(assignmentId, d), 0);
    },
    [days, getCellHours],
  );

  // Day total
  const getDayTotal = useCallback(
    (date: string): number => {
      return rows.reduce((sum, r) => sum + getCellHours(r.assignmentId, date), 0);
    },
    [rows, getCellHours],
  );

  // Update cell
  function updateCell(assignmentId: string, date: string, hours: number) {
    const key = cellKey(assignmentId, date);
    const existing = grid.get(key);
    const snapped = snapTo025(Math.max(0, Math.min(24, hours)));

    setGrid((prev) => {
      const next = new Map(prev);
      if (snapped === 0 && !existing?.entryId) {
        next.delete(key);
      } else {
        next.set(key, {
          hours: snapped,
          description: existing?.description ?? '',
          entryId: existing?.entryId,
          isBillable: assignmentId === BENCH_ASSIGNMENT_ID ? false : (existing?.isBillable ?? true),
        });
      }
      return next;
    });

    pendingChanges.current.add(key);
  }

  // Auto-save on blur (debounced via pending changes set)
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function flushChanges() {
    if (pendingChanges.current.size === 0) return;

    const changesToSave = [...pendingChanges.current];
    pendingChanges.current.clear();

    const batchEntries = changesToSave
      .map((key) => {
        const [assignmentId, date] = key.split('::');
        const cell = grid.get(key);
        if (!cell || cell.hours === 0) return null;
        return {
          entry_id: cell.entryId,
          assignment_id: assignmentId === BENCH_ASSIGNMENT_ID ? null : assignmentId,
          entry_date: date,
          hours: cell.hours,
          description: cell.description || null,
          is_billable: cell.isBillable,
        };
      })
      .filter(Boolean) as Array<{
        entry_id?: string;
        assignment_id: string | null;
        entry_date: string;
        hours: number;
        description: string | null;
        is_billable: boolean;
      }>;

    if (batchEntries.length === 0) return;

    setSaving(true);
    setSaveError(null);

    const result = await batchUpsertTimeEntries({
      timesheet_id: timesheetId,
      entries: batchEntries,
    });

    setSaving(false);

    if (!result.success) {
      setSaveError(result.error);
    }
  }

  function handleBlur() {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(flushChanges, 500);
  }

  return (
    <div className="overflow-x-auto">
      {saveError && (
        <div className="mb-2 rounded-md bg-red-50 p-2 text-sm text-red-700">
          {saveError}
        </div>
      )}

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-3 py-2 text-left font-medium text-muted-foreground min-w-[160px]">
              Assignment
            </th>
            {days.map((date) => (
              <th key={date} className="px-2 py-2 text-center font-medium text-muted-foreground min-w-[70px]">
                <div>{getDayLabel(date)}</div>
                <div className="text-xs">{getDayNumber(date)}</div>
              </th>
            ))}
            <th className="px-3 py-2 text-right font-medium text-muted-foreground min-w-[60px]">
              Total
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => {
            const rowTotal = getRowTotal(row.assignmentId);
            return (
              <tr
                key={row.assignmentId}
                className={cn(
                  'border-b hover:bg-muted/30',
                  row.isBench && 'bg-gray-50/50',
                )}
              >
                <td className="px-3 py-2 font-medium text-sm">
                  {row.label}
                  {row.isBench && (
                    <span className="ml-1 text-xs text-muted-foreground">(non-billable)</span>
                  )}
                </td>
                {days.map((date) => {
                  const hours = getCellHours(row.assignmentId, date);
                  return (
                    <td key={date} className="px-1 py-1 text-center">
                      {isEditable ? (
                        <Input
                          type="number"
                          min={0}
                          max={24}
                          step={0.25}
                          value={hours || ''}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            updateCell(row.assignmentId, date, val);
                          }}
                          onBlur={handleBlur}
                          className="h-8 w-16 text-center text-sm mx-auto"
                          placeholder="0"
                        />
                      ) : (
                        <span className={cn('text-sm', hours > 0 ? 'font-medium' : 'text-muted-foreground')}>
                          {hours > 0 ? hours : '–'}
                        </span>
                      )}
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-right font-semibold text-sm">
                  {rowTotal > 0 ? rowTotal : '–'}
                </td>
              </tr>
            );
          })}
        </tbody>

        <tfoot>
          <tr className="border-t bg-muted/50 font-semibold">
            <td className="px-3 py-2 text-sm">Daily Total</td>
            {days.map((date) => {
              const dayTotal = getDayTotal(date);
              return (
                <td key={date} className="px-2 py-2 text-center text-sm">
                  <span className={cn(dayTotal > 8 ? 'text-amber-600' : '')}>
                    {dayTotal > 0 ? dayTotal : '–'}
                  </span>
                </td>
              );
            })}
            <td className="px-3 py-2 text-right text-sm">
              <span className={cn(totals.total > 40 ? 'text-amber-600' : '')}>
                {totals.total}
              </span>
            </td>
          </tr>
        </tfoot>
      </table>

      {saving && (
        <div className="mt-1 text-xs text-muted-foreground animate-pulse">Saving...</div>
      )}
    </div>
  );
}
