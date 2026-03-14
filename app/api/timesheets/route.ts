/**
 * T015: GET /api/timesheets — List timesheets with filtering and pagination.
 * Scoped by auth role: staff sees own, admin sees all, agency_admin sees their agency's staff.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/helpers';
import { getOrganizationId } from '@/lib/auth/organization';
import { timesheetListFilterSchema } from '@/lib/validations/timesheet';
import type { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const organizationId = await getOrganizationId();

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const parsed = timesheetListFilterSchema.safeParse({
      status: searchParams.get('status') || undefined,
      staff_id: searchParams.get('staff_id') || undefined,
      client_id: searchParams.get('client_id') || undefined,
      agency_id: searchParams.get('agency_id') || undefined,
      period_start: searchParams.get('period_start') || undefined,
      period_end: searchParams.get('period_end') || undefined,
      page: searchParams.get('page') || undefined,
      per_page: searchParams.get('per_page') || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      );
    }

    const { status, staff_id, client_id, agency_id, period_start, period_end, page, per_page } = parsed.data;

    // Build where clause with org scoping
    const where: Prisma.TimesheetWhereInput = {
      organization_id: organizationId,
      deleted_at: null,
    };

    // Role-based scoping
    if (user.bdrStaffId && user.role !== 'ADMIN' && user.role !== 'EXECUTIVE') {
      // Staff members: own timesheets only
      where.staff_id = user.bdrStaffId;
    } else if (user.role === 'AGENCY_ADMIN' && user.agencyId) {
      // Agency admins: their agency's staff only
      where.staff = { agency_id: user.agencyId };
    }
    // Admins/Executives: no additional scoping

    // Apply filters
    if (status) where.status = status;
    if (staff_id) where.staff_id = staff_id;
    if (agency_id) where.staff = { ...where.staff as Prisma.StaffWhereInput, agency_id };
    if (period_start) where.period_start = { gte: new Date(period_start + 'T00:00:00Z') };
    if (period_end) where.period_end = { lte: new Date(period_end + 'T00:00:00Z') };

    // Client filter: timesheets with entries for a specific client
    if (client_id) {
      where.entries = {
        some: {
          assignment: { client_id },
        },
      };
    }

    // Count total
    const total = await prisma.timesheet.count({ where });

    // Fetch paginated results
    const timesheets = await prisma.timesheet.findMany({
      where,
      include: {
        staff: { select: { name: true } },
        _count: { select: { entries: true } },
      },
      orderBy: [{ period_start: 'desc' }, { created_at: 'desc' }],
      skip: (page - 1) * per_page,
      take: per_page,
    });

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
      pagination: {
        page,
        per_page,
        total,
        total_pages: Math.ceil(total / per_page),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
