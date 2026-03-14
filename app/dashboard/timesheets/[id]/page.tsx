/**
 * T028: Platform Admin Timesheet Detail Page
 * Read-only grid view with approve/reject buttons and billing summary.
 */

import { requireAuth } from '@/lib/auth/helpers';
import { getOrganizationId } from '@/lib/auth/organization';
import { prisma } from '@/lib/prisma';
import { redirect, notFound } from 'next/navigation';
import { TimesheetDetailContent } from './timesheet-detail-content';

export default async function AdminTimesheetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAuth();
  const organizationId = await getOrganizationId();
  const { id } = await params;

  if (user.role !== 'ADMIN' && user.role !== 'EXECUTIVE') {
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
          rate: true,
          rate_type: true,
          staff_type: true,
          agency_id: true,
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
      reviewer: {
        select: { full_name: true },
      },
    },
  });

  if (!timesheet || timesheet.organization_id !== organizationId) {
    notFound();
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
    <TimesheetDetailContent
      timesheetId={timesheet.id}
      staffName={timesheet.staff.name}
      staffRate={Number(timesheet.staff.rate)}
      staffRateType={timesheet.staff.rate_type}
      periodStart={timesheet.period_start.toISOString().split('T')[0]}
      periodEnd={timesheet.period_end.toISOString().split('T')[0]}
      status={timesheet.status as 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'}
      totalHours={Number(timesheet.total_hours)}
      billableHours={Number(timesheet.billable_hours)}
      overtimeHours={Number(timesheet.overtime_hours)}
      rejectionReason={timesheet.rejection_reason}
      reviewerName={timesheet.reviewer?.full_name ?? null}
      reviewedAt={timesheet.reviewed_at?.toISOString() ?? null}
      submittedAt={timesheet.submitted_at?.toISOString() ?? null}
      entries={serializedEntries}
      assignments={assignments}
      backUrl="/dashboard/timesheets"
    />
  );
}
