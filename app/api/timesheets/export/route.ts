/**
 * T042: GET /api/timesheets/export
 * CSV export of timesheet entries within a date range.
 *
 * Required params: period_start, period_end (YYYY-MM-DD)
 * Optional params: status, staff_id, client_id, agency_id
 *
 * Returns text/csv with Content-Disposition header for download.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/helpers';
import { getOrganizationId } from '@/lib/auth/organization';

/**
 * Escape a CSV field value. Wraps in double quotes if the value contains
 * commas, double quotes, or newlines.
 */
function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const organizationId = await getOrganizationId();

    const { searchParams } = request.nextUrl;
    const periodStart = searchParams.get('period_start');
    const periodEnd = searchParams.get('period_end');
    const statusFilter = searchParams.get('status');
    const staffId = searchParams.get('staff_id');
    const clientId = searchParams.get('client_id');
    const agencyId = searchParams.get('agency_id');

    if (!periodStart || !periodEnd) {
      return NextResponse.json(
        { error: 'period_start and period_end are required (YYYY-MM-DD)' },
        { status: 400 },
      );
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(periodStart) || !dateRegex.test(periodEnd)) {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD.' },
        { status: 400 },
      );
    }

    // Build timesheet where clause
    const timesheetWhere: Record<string, unknown> = {
      organization_id: organizationId,
      deleted_at: null,
      period_start: { gte: new Date(periodStart) },
      period_end: { lte: new Date(periodEnd + 'T23:59:59Z') },
    };

    // Role-based scoping: agency admins see only their agency's timesheets
    if (user.role === 'AGENCY_ADMIN' && user.agencyId) {
      timesheetWhere.staff = { agency_id: user.agencyId };
    } else if (user.role !== 'ADMIN' && user.role !== 'EXECUTIVE') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (statusFilter) {
      timesheetWhere.status = statusFilter;
    }

    if (staffId) {
      timesheetWhere.staff_id = staffId;
    }

    // Only allow agency_id filter for platform admins (agency admins are already scoped)
    if (agencyId && user.role !== 'AGENCY_ADMIN') {
      timesheetWhere.staff = { ...(timesheetWhere.staff as object || {}), agency_id: agencyId };
    }

    // Build entry where clause for client filter
    const entryWhere: Record<string, unknown> = {
      timesheet: timesheetWhere,
    };

    if (clientId) {
      entryWhere.assignment = { client_id: clientId };
    }

    // Fetch all matching time entries with joined data
    const entries = await prisma.timeEntry.findMany({
      where: entryWhere,
      select: {
        entry_date: true,
        hours: true,
        is_billable: true,
        description: true,
        staff: { select: { name: true } },
        timesheet: {
          select: {
            period_start: true,
          },
        },
        assignment: {
          select: {
            client: { select: { name: true } },
          },
        },
      },
      orderBy: [
        { staff: { name: 'asc' } },
        { entry_date: 'asc' },
      ],
    });

    // Build CSV
    const headers = ['Staff Name', 'Week Start', 'Date', 'Client', 'Hours', 'Billable', 'Description'];
    const rows: string[] = [headers.join(',')];

    for (const entry of entries) {
      const row = [
        escapeCsvField(entry.staff.name),
        entry.timesheet.period_start.toISOString().split('T')[0],
        entry.entry_date.toISOString().split('T')[0],
        escapeCsvField(entry.assignment?.client?.name ?? 'Unassigned'),
        Number(entry.hours).toFixed(2),
        entry.is_billable ? 'Yes' : 'No',
        escapeCsvField(entry.description ?? ''),
      ];
      rows.push(row.join(','));
    }

    const csv = rows.join('\n');
    const filename = `timesheets_${periodStart}_to_${periodEnd}.csv`;

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Timesheet export error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
