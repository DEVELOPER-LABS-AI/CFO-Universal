/**
 * T027: Platform Admin Timesheet Dashboard
 * Approval queue, filters, and summary stats for all org timesheets.
 */

import { requireAuth } from '@/lib/auth/helpers';
import { getOrganizationId } from '@/lib/auth/organization';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { TimesheetDashboardContent } from './timesheet-dashboard-content';

export default async function TimesheetDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await requireAuth();
  const organizationId = await getOrganizationId();

  if (user.role !== 'ADMIN' && user.role !== 'EXECUTIVE') {
    redirect('/dashboard');
  }

  const params = await searchParams;
  const status = (params.status as string) || undefined;
  const tab = (params.tab as string) || 'pending';
  const page = Math.max(1, parseInt((params.page as string) || '1'));
  const perPage = 20;

  // Build where clause
  const where: Record<string, unknown> = {
    organization_id: organizationId,
    deleted_at: null,
  };

  if (tab === 'pending') {
    where.status = 'SUBMITTED';
  } else if (status) {
    where.status = status;
  }

  const [total, timesheets, stats] = await Promise.all([
    prisma.timesheet.count({ where }),
    prisma.timesheet.findMany({
      where,
      include: {
        staff: { select: { name: true, agency_id: true } },
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
        status: 'SUBMITTED',
        deleted_at: null,
      },
      _count: true,
      _sum: { total_hours: true },
    }),
  ]);

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
          Review, approve, and manage staff timesheets across the organization.
        </p>
      </div>

      <TimesheetDashboardContent
        timesheets={data}
        activeTab={tab}
        pendingCount={stats._count}
        pendingHours={Number(stats._sum.total_hours ?? 0)}
        pagination={{ page, perPage, total, totalPages: Math.ceil(total / perPage) }}
      />
    </div>
  );
}
