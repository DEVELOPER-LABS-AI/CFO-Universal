/**
 * T019: Staff Portal — Timesheet List Page
 * Lists all timesheets for the current staff member with status badges and week navigation.
 */

import { requireAuth } from '@/lib/auth/helpers';
import { getOrganizationId } from '@/lib/auth/organization';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { TimesheetList } from './timesheet-list';

export default async function StaffTimesheetsPage() {
  const user = await requireAuth();
  const organizationId = await getOrganizationId();

  if (!user.bdrStaffId) {
    redirect('/dashboard');
  }

  // Fetch timesheets for this staff member
  const timesheets = await prisma.timesheet.findMany({
    where: {
      organization_id: organizationId,
      staff_id: user.bdrStaffId,
      deleted_at: null,
    },
    include: {
      _count: { select: { entries: true } },
    },
    orderBy: { period_start: 'desc' },
    take: 20,
  });

  const serialized = timesheets.map((ts) => ({
    id: ts.id,
    period_start: ts.period_start.toISOString().split('T')[0],
    period_end: ts.period_end.toISOString().split('T')[0],
    status: ts.status as 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED',
    total_hours: Number(ts.total_hours),
    billable_hours: Number(ts.billable_hours),
    overtime_hours: Number(ts.overtime_hours),
    entry_count: ts._count.entries,
    submitted_at: ts.submitted_at?.toISOString() ?? null,
    rejection_reason: ts.rejection_reason,
  }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">My Timesheets</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track and submit your weekly hours
        </p>
      </div>

      <TimesheetList timesheets={serialized} />
    </div>
  );
}
