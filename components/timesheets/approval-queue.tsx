'use client';

import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApprovalQueueTimesheet {
  id: string;
  staff_name: string;
  period_start: string;
  period_end: string;
  total_hours: number;
  billable_hours: number;
  overtime_hours: number;
  submitted_at: string | null;
  entry_count: number;
}

interface ApprovalQueueProps {
  /** Array of SUBMITTED timesheets to display in the approval queue. */
  timesheets: ApprovalQueueTimesheet[];
  /** Called when the "Review" button is clicked on a row. */
  onReview: (timesheetId: string) => void;
  /** Called when the "Bulk Approve" button is clicked with all selected IDs. */
  onBulkApprove?: (timesheetIds: string[]) => void;
  /** Shows a loading overlay / skeleton state when true. */
  isLoading?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format a date range as "Mar 3 - Mar 9, 2026".
 * Both dates are parsed in UTC to avoid timezone shifting.
 */
function formatPeriod(startStr: string, endStr: string): string {
  const start = new Date(startStr + 'T00:00:00Z');
  const end = new Date(endStr + 'T00:00:00Z');

  const startMonth = start.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
  const startDay = start.getUTCDate();
  const endMonth = end.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
  const endDay = end.getUTCDate();
  const endYear = end.getUTCFullYear();

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay} - ${endDay}, ${endYear}`;
  }
  return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${endYear}`;
}

/**
 * Format an ISO timestamp as a short readable date (e.g. "Mar 5, 2026 3:42 PM").
 */
function formatSubmittedAt(isoStr: string | null): string {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ApprovalQueue({
  timesheets,
  onReview,
  onBulkApprove,
  isLoading = false,
}: ApprovalQueueProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  /** Derive whether all rows are selected. */
  const allSelected = useMemo(
    () => timesheets.length > 0 && selectedIds.size === timesheets.length,
    [timesheets.length, selectedIds.size],
  );

  /** Derive whether some (but not all) rows are selected. */
  const someSelected = useMemo(
    () => selectedIds.size > 0 && selectedIds.size < timesheets.length,
    [timesheets.length, selectedIds.size],
  );

  /** Toggle a single row's selection. */
  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  /** Toggle all rows on or off. */
  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(timesheets.map((t) => t.id)));
    }
  }

  /** Handle bulk approve click. */
  function handleBulkApprove() {
    if (onBulkApprove && selectedIds.size > 0) {
      onBulkApprove(Array.from(selectedIds));
    }
  }

  // Empty state
  if (!isLoading && timesheets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-lg font-medium text-muted-foreground">
          No timesheets awaiting approval
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Submitted timesheets will appear here for review.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Bulk actions toolbar */}
      {onBulkApprove && (
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            onClick={handleBulkApprove}
            disabled={selectedIds.size === 0 || isLoading}
          >
            Bulk Approve ({selectedIds.size})
          </Button>
          {selectedIds.size > 0 && (
            <span className="text-sm text-muted-foreground">
              {selectedIds.size} timesheet{selectedIds.size !== 1 ? 's' : ''} selected
            </span>
          )}
        </div>
      )}

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]">
              <Checkbox
                checked={allSelected}
                ref={undefined}
                onCheckedChange={toggleAll}
                aria-label="Select all timesheets"
                {...(someSelected ? { 'data-state': 'indeterminate' } : {})}
              />
            </TableHead>
            <TableHead>Staff Name</TableHead>
            <TableHead>Period</TableHead>
            <TableHead className="text-right">Total Hours</TableHead>
            <TableHead className="text-right">Billable Hours</TableHead>
            <TableHead className="text-right">Overtime</TableHead>
            <TableHead>Submitted</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            // Skeleton rows while loading
            Array.from({ length: 3 }).map((_, i) => (
              <TableRow key={`skeleton-${i}`}>
                {Array.from({ length: 8 }).map((_, j) => (
                  <TableCell key={j}>
                    <div className="h-4 w-full animate-pulse rounded bg-muted" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            timesheets.map((ts) => (
              <TableRow key={ts.id} data-state={selectedIds.has(ts.id) ? 'selected' : undefined}>
                <TableCell>
                  <Checkbox
                    checked={selectedIds.has(ts.id)}
                    onCheckedChange={() => toggleRow(ts.id)}
                    aria-label={`Select timesheet for ${ts.staff_name}`}
                  />
                </TableCell>
                <TableCell className="font-medium">{ts.staff_name}</TableCell>
                <TableCell>{formatPeriod(ts.period_start, ts.period_end)}</TableCell>
                <TableCell className="text-right tabular-nums">{ts.total_hours}</TableCell>
                <TableCell className="text-right tabular-nums">{ts.billable_hours}</TableCell>
                <TableCell className="text-right tabular-nums">
                  <span className={cn(ts.overtime_hours > 0 && 'text-amber-600 font-medium')}>
                    {ts.overtime_hours}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {formatSubmittedAt(ts.submitted_at)}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" onClick={() => onReview(ts.id)}>
                    Review
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
