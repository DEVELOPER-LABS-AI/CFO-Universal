/**
 * T023: GET /api/utilization/staff/[staffId]
 * Staff detail utilization API - returns current period utilization,
 * historical snapshots, assignments, target thresholds, and bench duration
 * for a single staff member.
 *
 * Roles: ADMIN, EXECUTIVE, ANALYST, or the staff member's own linked user.
 * Agency admins can view only staff linked to their agency.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/helpers';
import { getOrganizationId } from '@/lib/auth/organization';
import {
  calculateAvailableHours,
  calculateBillableHoursFromTimesheets,
  calculateBillableHoursFromAllocations,
  calculateUtilizationRate,
  getPeriodBoundaries,
} from '@/lib/calculations/utilization';
import {
  calculateBenchHours,
  calculateBenchCost,
  getHourlyCostRate,
  calculateBenchDuration,
} from '@/lib/calculations/bench-cost';
import {
  resolveEffectiveTarget,
  determineUtilizationStatus,
} from '@/lib/calculations/utilization-targets';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ staffId: string }> }
) {
  try {
    const user = await requireAuth();
    const organizationId = await getOrganizationId();
    const { staffId } = await params;

    // Parse query params
    const { searchParams } = request.nextUrl;
    const months = Math.min(
      Math.max(parseInt(searchParams.get('months') || '6', 10) || 6, 1),
      24
    );

    // --- Access control ---
    const allowedRoles = ['ADMIN', 'EXECUTIVE', 'ANALYST', 'AGENCY_ADMIN'];
    const isPrivileged = allowedRoles.includes(user.role);

    // For non-privileged users, check if they are viewing their own staff record
    if (!isPrivileged) {
      // Check if the user has a linked staff profile matching this staffId
      const linkedProfile = await prisma.userProfile.findUnique({
        where: { user_id: user.userId },
        select: { bdr_staff_id: true },
      });

      if (!linkedProfile || linkedProfile.bdr_staff_id !== staffId) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // --- Fetch staff member ---
    const staff = await prisma.staff.findFirst({
      where: {
        id: staffId,
        organization_id: organizationId,
        deleted_at: null,
      },
      select: {
        id: true,
        name: true,
        staff_type: true,
        engagement_type: true,
        rate: true,
        rate_type: true,
        true_cost: true,
        true_cost_rate_type: true,
        agency_id: true,
        status: true,
        created_at: true,
      },
    });

    if (!staff) {
      return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
    }

    // Agency admin scoping: verify staff belongs to their agency
    if (user.role === 'AGENCY_ADMIN' && user.agencyId) {
      if (staff.agency_id !== user.agencyId) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // --- Resolve effective target ---
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

    const numericTargets = targets.map((t) => ({
      staff_type: t.staff_type,
      target_rate: Number(t.target_rate),
      warning_threshold: Number(t.warning_threshold),
      critical_threshold: Number(t.critical_threshold),
      standard_daily_hours: Number(t.standard_daily_hours),
      enabled: t.enabled,
    }));

    const effectiveTarget = resolveEffectiveTarget(numericTargets, staff.staff_type);

    // --- Current period calculation ---
    const now = new Date();
    const { start: periodStart, end: periodEnd } = getPeriodBoundaries(now, 'monthly');

    const availableHours = calculateAvailableHours(
      periodStart,
      periodEnd,
      effectiveTarget.standard_daily_hours,
      staff.created_at
    );

    // Try timesheet data first
    const timesheetEntries = await prisma.timeEntry.findMany({
      where: {
        staff_id: staffId,
        entry_date: {
          gte: periodStart,
          lte: periodEnd,
        },
        timesheet: {
          status: { in: ['SUBMITTED', 'APPROVED'] },
          deleted_at: null,
        },
      },
      select: {
        hours: true,
        is_billable: true,
      },
    });

    let billableHours: number;
    let nonBillableHours: number;
    let dataSource: 'TIMESHEET' | 'ALLOCATION';

    if (timesheetEntries.length > 0) {
      const timesheetResult = calculateBillableHoursFromTimesheets(
        timesheetEntries.map((e) => ({
          hours: Number(e.hours),
          is_billable: e.is_billable,
        }))
      );
      billableHours = timesheetResult.billableHours;
      nonBillableHours = timesheetResult.nonBillableHours;
      dataSource = 'TIMESHEET';
    } else {
      // Fallback to allocation data
      const assignments = await prisma.staffAssignment.findMany({
        where: {
          staff_id: staffId,
          start_date: { lte: periodEnd },
          OR: [{ end_date: null }, { end_date: { gte: periodStart } }],
        },
        select: {
          allocation_percentage: true,
          start_date: true,
          end_date: true,
        },
      });

      const allocationResult = calculateBillableHoursFromAllocations(
        assignments.map((a) => ({
          allocation_percentage: Number(a.allocation_percentage),
          start_date: a.start_date,
          end_date: a.end_date,
        })),
        periodStart,
        periodEnd,
        availableHours
      );
      billableHours = allocationResult.billableHours;
      nonBillableHours = allocationResult.nonBillableHours;
      dataSource = 'ALLOCATION';
    }

    const benchHours = calculateBenchHours(availableHours, billableHours, nonBillableHours);
    const utilizationRate = calculateUtilizationRate(billableHours, availableHours);
    const { hourlyRate } = getHourlyCostRate({
      rate: Number(staff.rate),
      rate_type: staff.rate_type,
      true_cost: staff.true_cost ? Number(staff.true_cost) : null,
      true_cost_rate_type: staff.true_cost_rate_type,
    });
    const benchCost = calculateBenchCost(benchHours, hourlyRate);
    const status = determineUtilizationStatus(utilizationRate, effectiveTarget);

    // --- Historical snapshots ---
    const historyStart = new Date(now);
    historyStart.setMonth(historyStart.getMonth() - months);
    historyStart.setDate(1);
    historyStart.setHours(0, 0, 0, 0);

    const snapshots = await prisma.utilizationSnapshot.findMany({
      where: {
        staff_id: staffId,
        organization_id: organizationId,
        period_start: { gte: historyStart },
      },
      orderBy: { period_start: 'asc' },
      select: {
        period_start: true,
        period_end: true,
        utilization_rate: true,
        billable_hours: true,
        bench_hours: true,
        bench_cost: true,
        data_source: true,
      },
    });

    // --- Current assignments ---
    const currentAssignments = await prisma.staffAssignment.findMany({
      where: {
        staff_id: staffId,
      },
      include: {
        client: {
          select: { id: true, name: true },
        },
      },
      orderBy: { start_date: 'desc' },
    });

    // --- Bench duration ---
    const assignmentsForBench = currentAssignments.map((a) => ({
      start_date: a.start_date,
      end_date: a.end_date,
    }));
    const { daysOnBench, lastAssignmentEnd } = calculateBenchDuration(assignmentsForBench, now);

    // --- Build response ---
    return NextResponse.json({
      staff: {
        id: staff.id,
        name: staff.name,
        staff_type: staff.staff_type,
        engagement_type: staff.engagement_type,
        rate: Number(staff.rate),
        rate_type: staff.rate_type,
        true_cost: staff.true_cost ? Number(staff.true_cost) : null,
        true_cost_rate_type: staff.true_cost_rate_type,
      },
      current_period: {
        utilization_rate: utilizationRate,
        available_hours: availableHours,
        billable_hours: billableHours,
        non_billable_hours: nonBillableHours,
        bench_hours: benchHours,
        bench_cost: benchCost,
        status,
        data_source: dataSource,
        period_start: periodStart.toISOString(),
        period_end: periodEnd.toISOString(),
      },
      target: {
        target_rate: effectiveTarget.target_rate,
        warning_threshold: effectiveTarget.warning_threshold,
        critical_threshold: effectiveTarget.critical_threshold,
        source: effectiveTarget.source,
      },
      history: snapshots.map((s) => ({
        period_start: s.period_start.toISOString(),
        period_end: s.period_end.toISOString(),
        utilization_rate: Number(s.utilization_rate),
        billable_hours: Number(s.billable_hours),
        bench_hours: Number(s.bench_hours),
        bench_cost: Number(s.bench_cost),
        data_source: s.data_source,
      })),
      assignments: currentAssignments.map((a) => ({
        id: a.id,
        client_id: a.client.id,
        client_name: a.client.name,
        allocation_percentage: Number(a.allocation_percentage),
        start_date: a.start_date.toISOString(),
        end_date: a.end_date ? a.end_date.toISOString() : null,
        is_active: a.start_date <= now && (a.end_date === null || a.end_date >= now),
      })),
      bench_duration_days: daysOnBench,
      last_assignment_end: lastAssignmentEnd ? lastAssignmentEnd.toISOString() : null,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (error.message === 'Account inactive') {
        return NextResponse.json({ error: 'Account inactive' }, { status: 403 });
      }
      if (error.message.includes('not associated with any organization')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }
    console.error('Staff utilization detail error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
