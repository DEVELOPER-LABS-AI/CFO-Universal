/**
 * T020: Staff Portal — Weekly Grid Entry Page
 * Renders the timesheet grid for a specific week. Shows rejection banner,
 * overtime indicators, and submission flow.
 */

import { requireAuth } from '@/lib/auth/helpers';
import { getOrganizationId } from '@/lib/auth/organization';
import { prisma } from '@/lib/prisma';
import { redirect, notFound } from 'next/navigation';
import { TimesheetEntryView } from './timesheet-entry-view';

export default async function TimesheetEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAuth();
  const organizationId = await getOrganizationId();
  const { id } = await params;

  if (!user.bdrStaffId) {
    redirect('/dashboard');
  }

  const timesheet = await prisma.timesheet.findUnique({
    where: { id },
    include: {
      entries: {
        orderBy: [{ entry_date: 'asc' }, { assignment_id: 'asc' }],
      },
      staff: {
        select: {
          id: true,
          name: true,
          assignments: {
            where: {
              OR: [
                { end_date: null },
                { end_date: { gte: new Date() } },
              ],
            },
            select: {
              id: true,
              client: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  if (!timesheet || timesheet.organization_id !== organizationId) {
    notFound();
  }

  // Verify ownership
  if (timesheet.staff_id !== user.bdrStaffId) {
    redirect('/staff-portal/timesheets');
  }

  const serializedEntries = timesheet.entries.map((e) => ({
    id: e.id,
    assignment_id: e.assignment_id,
    entry_date: e.entry_date.toISOString().split('T')[0],
    hours: Number(e.hours),
    description: e.description,
    is_billable: e.is_billable,
  }));

  const assignments = timesheet.staff.assignments.map((a) => ({
    id: a.id,
    client_name: a.client.name,
  }));

  return (
    <TimesheetEntryView
      timesheetId={timesheet.id}
      periodStart={timesheet.period_start.toISOString().split('T')[0]}
      periodEnd={timesheet.period_end.toISOString().split('T')[0]}
      status={timesheet.status as 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'}
      totalHours={Number(timesheet.total_hours)}
      billableHours={Number(timesheet.billable_hours)}
      overtimeHours={Number(timesheet.overtime_hours)}
      rejectionReason={timesheet.rejection_reason}
      entries={serializedEntries}
      assignments={assignments}
    />
  );
}
