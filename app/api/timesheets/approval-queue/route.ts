/**
 * T025: GET /api/timesheets/approval-queue — Submitted timesheets pending approval.
 * Platform admins see all, agency admins see their agency's staff only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/helpers';
import { getOrganizationId } from '@/lib/auth/organization';
import type { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const organizationId = await getOrganizationId();

    // Must be admin, executive, or agency_admin
    if (user.role !== 'ADMIN' && user.role !== 'EXECUTIVE' && user.role !== 'AGENCY_ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('per_page') || '20')));
    const staffId = searchParams.get('staff_id') || undefined;
    const clientId = searchParams.get('client_id') || undefined;
    const periodStart = searchParams.get('period_start') || undefined;
    const periodEnd = searchParams.get('period_end') || undefined;

    const where: Prisma.TimesheetWhereInput = {
      organization_id: organizationId,
      status: 'SUBMITTED',
      deleted_at: null,
    };

    // Agency admin scoping
    if (user.role === 'AGENCY_ADMIN' && user.agencyId) {
      where.staff = { agency_id: user.agencyId };
    }

    if (staffId) where.staff_id = staffId;
    if (periodStart) where.period_start = { gte: new Date(periodStart + 'T00:00:00Z') };
    if (periodEnd) where.period_end = { lte: new Date(periodEnd + 'T00:00:00Z') };

    if (clientId) {
      where.entries = { some: { assignment: { client_id: clientId } } };
    }

    const [total, timesheets, stats] = await Promise.all([
      prisma.timesheet.count({ where }),
      prisma.timesheet.findMany({
        where,
        include: {
          staff: { select: { name: true } },
          _count: { select: { entries: true } },
        },
        orderBy: { submitted_at: 'asc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      prisma.timesheet.aggregate({
        where: {
          organization_id: organizationId,
          status: 'SUBMITTED',
          deleted_at: null,
          ...(user.role === 'AGENCY_ADMIN' && user.agencyId
            ? { staff: { agency_id: user.agencyId } }
            : {}),
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
      reviewed_at: ts.reviewed_at?.toISOString() ?? null,
      entry_count: ts._count.entries,
    }));

    return NextResponse.json({
      data,
      pagination: { page, per_page: perPage, total, total_pages: Math.ceil(total / perPage) },
      stats: {
        pending_count: stats._count,
        total_hours_pending: Number(stats._sum.total_hours ?? 0),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
