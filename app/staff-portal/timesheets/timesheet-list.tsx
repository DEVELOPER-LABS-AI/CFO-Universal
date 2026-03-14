'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TimesheetStatusBadge } from '@/components/timesheets/timesheet-status-badge';
import { WeekNavigator } from '@/components/timesheets/week-navigator';
import { getOrCreateDraftTimesheet } from '@/app/actions/timesheet-actions';
import { Plus } from 'lucide-react';

interface TimesheetSummary {
  id: string;
  period_start: string;
  period_end: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  total_hours: number;
  billable_hours: number;
  overtime_hours: number;
  entry_count: number;
  submitted_at: string | null;
  rejection_reason: string | null;
}

function getMonday(date: Date): string {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  d.setUTCDate(diff);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
}

export function TimesheetList({ timesheets }: { timesheets: TimesheetSummary[] }) {
  const router = useRouter();
  const [currentMonday, setCurrentMonday] = useState(getMonday(new Date()));
  const [creating, setCreating] = useState(false);

  async function handleCreateOrOpen() {
    setCreating(true);
    const result = await getOrCreateDraftTimesheet({ period_start: currentMonday });
    setCreating(false);
    if (result.success) {
      router.push(`/staff-portal/timesheets/${result.timesheet.id}`);
    }
  }

  function formatWeek(start: string, end: string): string {
    const s = new Date(start + 'T00:00:00Z');
    const e = new Date(end + 'T00:00:00Z');
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', timeZone: 'UTC' };
    return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-lg">Navigate to Week</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <WeekNavigator
            currentMonday={currentMonday}
            onWeekChange={setCurrentMonday}
          />
          <Button onClick={handleCreateOrOpen} disabled={creating}>
            <Plus className="mr-2 h-4 w-4" />
            {creating ? 'Opening...' : 'Open Week'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Timesheets</CardTitle>
        </CardHeader>
        <CardContent>
          {timesheets.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No timesheets yet. Use the week navigator above to get started.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Week</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                  <TableHead className="text-right">Billable</TableHead>
                  <TableHead className="text-right">OT</TableHead>
                  <TableHead className="text-right">Entries</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {timesheets.map((ts) => (
                  <TableRow
                    key={ts.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/staff-portal/timesheets/${ts.id}`)}
                  >
                    <TableCell className="font-medium">
                      {formatWeek(ts.period_start, ts.period_end)}
                    </TableCell>
                    <TableCell>
                      <TimesheetStatusBadge status={ts.status} />
                    </TableCell>
                    <TableCell className="text-right">{ts.total_hours}</TableCell>
                    <TableCell className="text-right">{ts.billable_hours}</TableCell>
                    <TableCell className="text-right">
                      {ts.overtime_hours > 0 ? (
                        <span className="text-amber-600">{ts.overtime_hours}</span>
                      ) : (
                        '–'
                      )}
                    </TableCell>
                    <TableCell className="text-right">{ts.entry_count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
