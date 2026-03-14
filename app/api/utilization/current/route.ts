/**
 * T008/T037: GET /api/utilization/current
 * Returns current-period utilization data for all eligible staff in the organization.
 * Calculates utilization rates, bench costs, and status for each staff member
 * using timesheet data (primary) or allocation data (fallback).
 *
 * AGENCY_ADMIN users see only staff belonging to their agency.
 *
 * Query params: period, month, year, staff_type, engagement_type
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/helpers';
import { getOrganizationId } from '@/lib/auth/organization';
import { currentUtilizationQuerySchema } from '@/lib/validations/utilization';
import {
  isEligibleForUtilization,
  calculateAvailableHours,
  calculateBillableHoursFromTimesheets,
  calculateBillableHoursFromAllocations,
  calculateUtilizationRate,
  getPeriodBoundaries,
  STANDARD_DAILY_HOURS,
} from '@/lib/calculations/utilization';
import { calculateStaffBenchCost } from '@/lib/calculations/bench-cost';
import {
  resolveEffectiveTarget,
  determineUtilizationStatus,
} from '@/lib/calculations/utilization-targets';

/** Shape of a single staff member in the response. */
interface StaffUtilizationResult {
  staff_id: string;
  name: string;
  staff_type: string;
  engagement_type: string;
  utilization_rate: number;
  available_hours: number;
  billable_hours: number;
  non_billable_hours: number;
  bench_hours: number;
  bench_cost: number;
  cost_rate_hourly: number;
  cost_rate_source: 'true_cost' | 'rate';
  data_source: 'TIMESHEET' | 'ALLOCATION';
  status: 'on_target' | 'warning' | 'critical';
  target_rate: number;
  current_assignments: Array<{
    id: string;
    client_name: string;
    allocation_percentage: number;
  }>;
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const organizationId = await getOrganizationId();

    // Parse and validate query parameters
    const { searchParams } = request.nextUrl;
    const rawParams = {
      period: searchParams.get('period') ?? undefined,
      month: searchParams.get('month') ?? undefined,
      year: searchParams.get('year') ?? undefined,
      staff_type: searchParams.get('staff_type') ?? undefined,
      engagement_type: searchParams.get('engagement_type') ?? undefined,
    };

    const parseResult = currentUtilizationQuerySchema.safeParse(rawParams);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parseResult.error.flatten() },
        { status: 400 },
      );
    }

    const query = parseResult.data;

    // Determine period boundaries
    const now = new Date();
    const periodType = query.period ?? 'monthly';
    let referenceDate: Date;

    if (query.month && query.year) {
      referenceDate = new Date(query.year, query.month - 1, 15);
    } else if (query.year) {
      referenceDate = new Date(query.year, now.getMonth(), 15);
    } else {
      referenceDate = now;
    }

    const { start: periodStart, end: periodEnd } = getPeriodBoundaries(referenceDate, periodType);

    // Calculate working days and standard daily hours for the period header
    const workingDays = getWorkingDaysCount(periodStart, periodEnd);

    // Build staff filter
    const staffWhere: Record<string, unknown> = {
      organization_id: organizationId,
      status: { not: 'TERMINATED' },
      deleted_at: null,
      engagement_type: { in: ['FULL_TIME', 'PART_TIME', 'PROJECT', 'AGENCY'] },
    };

    // Scope to agency staff when AGENCY_ADMIN is viewing
    if (user.role === 'AGENCY_ADMIN' && user.agencyId) {
      staffWhere.agency_id = user.agencyId;
    }

    if (query.staff_type) {
      staffWhere.staff_type = query.staff_type;
    }
    if (query.engagement_type) {
      staffWhere.engagement_type = query.engagement_type;
    }

    // Fetch all eligible staff with their assignments
    const staffList = await prisma.staff.findMany({
      where: staffWhere,
      select: {
        id: true,
        name: true,
        staff_type: true,
        engagement_type: true,
        status: true,
        rate: true,
        rate_type: true,
        true_cost: true,
        true_cost_rate_type: true,
        created_at: true,
        assignments: {
          where: {
            OR: [
              { end_date: null },
              { end_date: { gte: now } },
            ],
          },
          select: {
            id: true,
            allocation_percentage: true,
            start_date: true,
            end_date: true,
            client: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Fetch utilization targets for the org
    const targets = await prisma.utilizationTarget.findMany({
      where: {
        organization_id: organizationId,
        deleted_at: null,
      },
      select: {
        staff_type: true,
        target_rate: true,
        warning_threshold: true,
        critical_threshold: true,
        standard_daily_hours: true,
        enabled: true,
      },
    });

    // Convert Decimal targets to numbers
    const targetsNumeric = targets.map((t) => ({
      staff_type: t.staff_type,
      target_rate: Number(t.target_rate),
      warning_threshold: Number(t.warning_threshold),
      critical_threshold: Number(t.critical_threshold),
      standard_daily_hours: Number(t.standard_daily_hours),
      enabled: t.enabled,
    }));

    // Fetch time entries for the period (batch for all staff)
    const timeEntries = await prisma.timeEntry.findMany({
      where: {
        staff_id: { in: staffList.map((s) => s.id) },
        entry_date: {
          gte: periodStart,
          lte: periodEnd,
        },
        timesheet: {
          status: { in: ['APPROVED', 'SUBMITTED'] },
          deleted_at: null,
        },
      },
      select: {
        staff_id: true,
        hours: true,
        is_billable: true,
      },
    });

    // Group time entries by staff_id
    const entriesByStaff = new Map<string, Array<{ hours: number; is_billable: boolean }>>();
    for (const entry of timeEntries) {
      const list = entriesByStaff.get(entry.staff_id) ?? [];
      list.push({ hours: Number(entry.hours), is_billable: entry.is_billable });
      entriesByStaff.set(entry.staff_id, list);
    }

    // Fetch all assignments for the period (for allocation fallback)
    const allAssignments = await prisma.staffAssignment.findMany({
      where: {
        staff_id: { in: staffList.map((s) => s.id) },
        start_date: { lte: periodEnd },
        OR: [
          { end_date: null },
          { end_date: { gte: periodStart } },
        ],
      },
      select: {
        staff_id: true,
        allocation_percentage: true,
        start_date: true,
        end_date: true,
      },
    });

    // Group assignments by staff_id
    const assignmentsByStaff = new Map<string, Array<{
      allocation_percentage: number;
      start_date: Date;
      end_date: Date | null;
    }>>();
    for (const a of allAssignments) {
      const list = assignmentsByStaff.get(a.staff_id) ?? [];
      list.push({
        allocation_percentage: Number(a.allocation_percentage),
        start_date: a.start_date,
        end_date: a.end_date,
      });
      assignmentsByStaff.set(a.staff_id, list);
    }

    // Calculate per-staff utilization
    const staffResults: StaffUtilizationResult[] = [];
    let totalAvailableHours = 0;
    let totalBillableHours = 0;
    let totalNonBillableHours = 0;
    let totalBenchHours = 0;
    let totalBenchCost = 0;
    let benchStaffCount = 0;

    for (const staff of staffList) {
      if (!isEligibleForUtilization(staff.engagement_type, staff.status)) {
        continue;
      }

      // Resolve effective target for this staff member
      const effectiveTarget = resolveEffectiveTarget(targetsNumeric, staff.staff_type);

      // Calculate available hours (prorate for staff who started mid-period)
      const availableHours = calculateAvailableHours(
        periodStart,
        periodEnd,
        effectiveTarget.standard_daily_hours,
        staff.created_at,
      );

      // Calculate billable hours: try timesheets first, fall back to allocations
      const staffEntries = entriesByStaff.get(staff.id);
      let billableHours: number;
      let nonBillableHours: number;
      let dataSource: 'TIMESHEET' | 'ALLOCATION';

      if (staffEntries && staffEntries.length > 0) {
        const tsResult = calculateBillableHoursFromTimesheets(staffEntries);
        billableHours = tsResult.billableHours;
        nonBillableHours = tsResult.nonBillableHours;
        dataSource = tsResult.dataSource;
      } else {
        const staffAssignments = assignmentsByStaff.get(staff.id) ?? [];
        const allocResult = calculateBillableHoursFromAllocations(
          staffAssignments,
          periodStart,
          periodEnd,
          availableHours,
        );
        billableHours = allocResult.billableHours;
        nonBillableHours = allocResult.nonBillableHours;
        dataSource = allocResult.dataSource;
      }

      // Calculate utilization rate
      const utilizationRate = calculateUtilizationRate(billableHours, availableHours);

      // Calculate bench cost
      const benchResult = calculateStaffBenchCost({
        availableHours,
        billableHours,
        nonBillableHours,
        staff: {
          rate: Number(staff.rate),
          rate_type: staff.rate_type,
          true_cost: staff.true_cost ? Number(staff.true_cost) : null,
          true_cost_rate_type: staff.true_cost_rate_type,
        },
      });

      // Determine utilization status
      const status = determineUtilizationStatus(utilizationRate, effectiveTarget);

      // Track whether staff is on bench
      if (benchResult.benchHours > 0) {
        benchStaffCount++;
      }

      // Build current assignments list
      const currentAssignments = staff.assignments.map((a) => ({
        id: a.id,
        client_name: a.client.name,
        allocation_percentage: Number(a.allocation_percentage),
      }));

      // Accumulate org-wide totals
      totalAvailableHours += availableHours;
      totalBillableHours += billableHours;
      totalNonBillableHours += nonBillableHours;
      totalBenchHours += benchResult.benchHours;
      totalBenchCost += benchResult.benchCost;

      staffResults.push({
        staff_id: staff.id,
        name: staff.name,
        staff_type: staff.staff_type,
        engagement_type: staff.engagement_type,
        utilization_rate: utilizationRate,
        available_hours: availableHours,
        billable_hours: billableHours,
        non_billable_hours: nonBillableHours,
        bench_hours: benchResult.benchHours,
        bench_cost: benchResult.benchCost,
        cost_rate_hourly: benchResult.costRateHourly,
        cost_rate_source: benchResult.costRateSource,
        data_source: dataSource,
        status,
        target_rate: effectiveTarget.target_rate,
        current_assignments: currentAssignments,
      });
    }

    // Calculate org-wide utilization (weighted average)
    const orgUtilizationRate = totalAvailableHours > 0
      ? Math.round((totalBillableHours / totalAvailableHours) * 100 * 100) / 100
      : 0;

    // Resolve org-level target for status
    const orgTarget = resolveEffectiveTarget(targetsNumeric, '');
    const orgStatus = determineUtilizationStatus(orgUtilizationRate, orgTarget);

    return NextResponse.json({
      organization: {
        utilization_rate: orgUtilizationRate,
        total_available_hours: Math.round(totalAvailableHours * 100) / 100,
        total_billable_hours: Math.round(totalBillableHours * 100) / 100,
        total_non_billable_hours: Math.round(totalNonBillableHours * 100) / 100,
        total_bench_hours: Math.round(totalBenchHours * 100) / 100,
        total_bench_cost: Math.round(totalBenchCost * 100) / 100,
        active_staff_count: staffResults.length,
        bench_staff_count: benchStaffCount,
        target_rate: orgTarget.target_rate,
        status: orgStatus,
      },
      staff: staffResults,
      period: {
        start: periodStart.toISOString(),
        end: periodEnd.toISOString(),
        working_days: workingDays,
        standard_daily_hours: STANDARD_DAILY_HOURS,
      },
      computed_at: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Account inactive') {
      return NextResponse.json({ error: 'Account inactive' }, { status: 403 });
    }
    if (error instanceof Error && error.message === 'User is not associated with any organization') {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 });
    }
    console.error('Utilization current error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

/**
 * Count working days (Mon-Fri) between two dates, inclusive.
 */
function getWorkingDaysCount(start: Date, end: Date): number {
  let count = 0;
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);
  const endDate = new Date(end);
  endDate.setHours(0, 0, 0, 0);

  while (current <= endDate) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
}
