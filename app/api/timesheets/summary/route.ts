/**
 * T041: GET /api/timesheets/summary
 * Aggregated timesheet summary with breakdown by staff or client.
 *
 * Required params: period_start, period_end (YYYY-MM-DD)
 * Optional params: group_by (staff | client), status, agency_id
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/helpers';
import { getOrganizationId } from '@/lib/auth/organization';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const organizationId = await getOrganizationId();

    const { searchParams } = request.nextUrl;
    const periodStart = searchParams.get('period_start');
    const periodEnd = searchParams.get('period_end');
    const groupBy = searchParams.get('group_by') || 'staff';
    const statusFilter = searchParams.get('status');
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

    // Build where clause
    const where: Record<string, unknown> = {
      organization_id: organizationId,
      deleted_at: null,
      period_start: { gte: new Date(periodStart) },
      period_end: { lte: new Date(periodEnd + 'T23:59:59Z') },
    };

    // Role-based scoping: agency admins see only their agency's timesheets
    if (user.role === 'AGENCY_ADMIN' && user.agencyId) {
      where.staff = { agency_id: user.agencyId };
    } else if (user.role !== 'ADMIN' && user.role !== 'EXECUTIVE') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (statusFilter) {
      where.status = statusFilter;
    }

    // Only allow agency_id filter for platform admins (agency admins are already scoped)
    if (agencyId && user.role !== 'AGENCY_ADMIN') {
      where.staff = { ...(where.staff as object || {}), agency_id: agencyId };
    }

    // Get aggregate totals
    const aggregate = await prisma.timesheet.aggregate({
      where,
      _sum: {
        total_hours: true,
        billable_hours: true,
        overtime_hours: true,
      },
      _count: true,
    });

    // Get breakdown by group_by dimension
    let breakdown: Array<Record<string, unknown>> = [];

    if (groupBy === 'staff') {
      const timesheets = await prisma.timesheet.findMany({
        where,
        select: {
          staff_id: true,
          total_hours: true,
          billable_hours: true,
          overtime_hours: true,
          staff: { select: { name: true } },
        },
      });

      // Group by staff
      const staffMap = new Map<string, {
        staff_name: string;
        total_hours: number;
        billable_hours: number;
        overtime_hours: number;
        timesheet_count: number;
      }>();

      for (const ts of timesheets) {
        const existing = staffMap.get(ts.staff_id);
        if (existing) {
          existing.total_hours += Number(ts.total_hours);
          existing.billable_hours += Number(ts.billable_hours);
          existing.overtime_hours += Number(ts.overtime_hours);
          existing.timesheet_count += 1;
        } else {
          staffMap.set(ts.staff_id, {
            staff_name: ts.staff.name,
            total_hours: Number(ts.total_hours),
            billable_hours: Number(ts.billable_hours),
            overtime_hours: Number(ts.overtime_hours),
            timesheet_count: 1,
          });
        }
      }

      breakdown = Array.from(staffMap.entries()).map(([id, data]) => ({
        id,
        name: data.staff_name,
        total_hours: data.total_hours,
        billable_hours: data.billable_hours,
        overtime_hours: data.overtime_hours,
        timesheet_count: data.timesheet_count,
      }));
    } else if (groupBy === 'client') {
      // Group by client via time entries
      const entries = await prisma.timeEntry.findMany({
        where: {
          timesheet: where,
        },
        select: {
          hours: true,
          is_billable: true,
          is_overtime: true,
          assignment: {
            select: {
              client_id: true,
              client: { select: { name: true } },
            },
          },
        },
      });

      const clientMap = new Map<string, {
        client_name: string;
        total_hours: number;
        billable_hours: number;
        overtime_hours: number;
        entry_count: number;
      }>();

      for (const entry of entries) {
        const clientId = entry.assignment?.client_id ?? 'unassigned';
        const clientName = entry.assignment?.client?.name ?? 'Unassigned';
        const hours = Number(entry.hours);

        const existing = clientMap.get(clientId);
        if (existing) {
          existing.total_hours += hours;
          if (entry.is_billable) existing.billable_hours += hours;
          if (entry.is_overtime) existing.overtime_hours += hours;
          existing.entry_count += 1;
        } else {
          clientMap.set(clientId, {
            client_name: clientName,
            total_hours: hours,
            billable_hours: entry.is_billable ? hours : 0,
            overtime_hours: entry.is_overtime ? hours : 0,
            entry_count: 1,
          });
        }
      }

      breakdown = Array.from(clientMap.entries()).map(([id, data]) => ({
        id,
        name: data.client_name,
        total_hours: data.total_hours,
        billable_hours: data.billable_hours,
        overtime_hours: data.overtime_hours,
        entry_count: data.entry_count,
      }));
    }

    // Sort breakdown by total_hours descending
    breakdown.sort((a, b) => (b.total_hours as number) - (a.total_hours as number));

    return NextResponse.json({
      summary: {
        total_hours: Number(aggregate._sum.total_hours ?? 0),
        billable_hours: Number(aggregate._sum.billable_hours ?? 0),
        overtime_hours: Number(aggregate._sum.overtime_hours ?? 0),
        timesheet_count: aggregate._count,
      },
      breakdown,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Timesheet summary error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
