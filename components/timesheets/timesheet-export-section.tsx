'use client';

/**
 * T044: Reusable timesheet export section.
 * Provides date range inputs and a CSV download button.
 * Can be embedded in the admin dashboard or agency portal.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

interface TimesheetExportSectionProps {
  /** Base path for the export API (e.g. "/api/timesheets/export") */
  basePath?: string;
  /** Optional title displayed above the section */
  title?: string;
  /** Optional additional query params to append (e.g. agency_id) */
  extraParams?: Record<string, string>;
}

/**
 * Get the first and last day of the current month in YYYY-MM-DD format.
 */
function getCurrentMonthRange(): { start: string; end: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);

  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

export function TimesheetExportSection({
  basePath = '/api/timesheets/export',
  title = 'Export Timesheets',
  extraParams = {},
}: TimesheetExportSectionProps) {
  const defaults = getCurrentMonthRange();
  const [periodStart, setPeriodStart] = useState(defaults.start);
  const [periodEnd, setPeriodEnd] = useState(defaults.end);

  function handleExport() {
    const params = new URLSearchParams({
      period_start: periodStart,
      period_end: periodEnd,
      ...extraParams,
    });
    window.open(`${basePath}?${params.toString()}`, '_blank');
  }

  return (
    <div className="space-y-3">
      {title && (
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="export-start" className="block text-xs text-muted-foreground mb-1">
            Start Date
          </label>
          <input
            id="export-start"
            type="date"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div>
          <label htmlFor="export-end" className="block text-xs text-muted-foreground mb-1">
            End Date
          </label>
          <input
            id="export-end"
            type="date"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <Button onClick={handleExport} size="sm" className="gap-1.5">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>
    </div>
  );
}
