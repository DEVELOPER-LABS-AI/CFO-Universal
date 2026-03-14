/**
 * T032: Agency Portal Timesheet Dashboard
 * Approval queue, filters, and summary stats for agency staff timesheets.
 */

import { requireAgencyAdmin } from '@/lib/auth/helpers';
import { getOrganizationId } from '@/lib/auth/organization';
import { prisma } from '@/lib/prisma';
import { AgencyTimesheetDashboard } from './agency-timesheet-dashboard';

export default async function AgencyTimesheetDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await requireAgencyAdmin();
  const organizationId = await getOrganizationId();

  const params = await searchParams;
  const tab = (params.tab as string) || 'pending';
  const status = (params.status as string) || undefined;
  const page = Math.max(1, parseInt((params.page as string) || '1'));
  const perPage = 20;

  // Get all agency staff IDs for scoping
  const agencyStaff = await prisma.staff.findMany({
    where: {
      organization_id: organizationId,
      agency_id: user.agencyId,
      deleted_at: null,
    },
    select: { id: true },
  });

  const staffIds = agencyStaff.map((s) => s.id);

  // Build where clause
  const where: Record<string, unknown> = {
    organization_id: organizationId,
    staff_id: { in: staffIds },
    deleted_at: null,
  };

  if (tab === 'pending') {
    where.status = 'SUBMITTED';
  } else if (status) {
    where.status = status;
  }

  // Fetch timesheets, total count, and pending stats in parallel
  const [total, timesheets, stats] = await Promise.all([
    prisma.timesheet.count({ where }),
    prisma.timesheet.findMany({
      where,
      include: {
        staff: { select: { name: true } },
        _count: { select: { entries: true } },
      },
      orderBy: tab === 'pending'
        ? { submitted_at: 'asc' }
        : { period_start: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.timesheet.aggregate({
      where: {
        organization_id: organizationId,
        staff_id: { in: staffIds },
        status: 'SUBMITTED',
        deleted_at: null,
      },
      _count: true,
      _sum: { total_hours: true },
    }),
  ]);

  // Serialize Decimal fields to Number for client component
  const data = timesheets.map((ts) => ({
    id: ts.id,
    staff_id: ts.staff_id,
    staff_name: ts.staff.name,
    period_start: ts.period_start.toISOString().split('T')[0],
    period_end: ts.period_end.toISOString().split('T')[0],
    status: ts.status,
    total_hours: Number(ts.total_hours),
    billable_hours: Number(ts.billable_hours),
    overtime_hours: Number(ts.overtime_hours),
    submitted_at: ts.submitted_at?.toISOString() ?? null,
    entry_count: ts._count.entries,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Timesheets</h1>
        <p className="text-sm text-gray-500 mt-1">
          Review and approve timesheets submitted by your agency staff.
        </p>
      </div>

      <AgencyTimesheetDashboard
        timesheets={data}
        activeTab={tab}
        pendingCount={stats._count}
        pendingHours={Number(stats._sum.total_hours ?? 0)}
        pagination={{ page, perPage, total, totalPages: Math.ceil(total / perPage) }}
      />
    </div>
  );
}
