/**
 * Bench report calculation logic for Feature 16, Phase 4 (US2).
 * Shared between the bench API route (/api/utilization/bench)
 * and the bench report page (app/dashboard/utilization/bench/page.tsx).
 *
 * Aggregates per-staff utilization, bench cost, and bench duration
 * into a structured bench report response.
 */

import { prisma } from '@/lib/prisma';
import { toMonthlyCost } from '@/lib/utils/currency';
import {
  isEligibleForUtilization,
  getPeriodBoundaries,
  calculateAvailableHours,
  calculateBillableHoursFromTimesheets,
  calculateBillableHoursFromAllocations,
  calculateUtilizationRate,
  getWorkingDaysInPeriod,
} from '@/lib/calculations/utilization';
import {
  calculateStaffBenchCost,
  calculateBenchDuration,
} from '@/lib/calculations/bench-cost';
import {
  resolveEffectiveTarget,
  determineUtilizationStatus,
} from '@/lib/calculations/utilization-targets';
import type { BenchQuery } from '@/lib/validations/utilization';

// ============================================================================
// Types
// ============================================================================

/** Individual bench staff entry in the report. */
export interface BenchStaffEntry {
  staff: {
    id: string;
    name: string;
    staff_type: string;
    engagement_type: string;
    agency_id: string | null;
    agency_name: string | null;
  };
  utilization: {
    rate: number;
    status: 'on_target' | 'warning' | 'critical';
    available_hours: number;
    billable_hours: number;
    non_billable_hours: number;
    bench_hours: number;
    data_source: 'TIMESHEET' | 'ALLOCATION';
  };
  cost: {
    bench_cost: number;
    hourly_cost_rate: number;
    cost_rate_source: 'true_cost' | 'rate';
    monthly_full_cost: number;
  };
  bench_info: {
    days_on_bench: number | null;
    last_assignment_end: string | null;
    last_client_name: string | null;
  };
  current_assignments: Array<{
    client_id: string;
    client_name: string;
    allocation_percentage: number;
  }>;
}

/** Summary metrics for the bench report. */
export interface BenchReportSummary {
  total_bench_headcount: number;
  total_active_staff: number;
  total_bench_cost: number;
  average_bench_duration_days: number;
  bench_cost_as_pct_of_payroll: number;
  total_payroll_cost: number;
  org_utilization_rate: number;
  target_rate: number;
}

/** Full bench report response. */
export interface BenchReportResponse {
  summary: BenchReportSummary;
  bench_staff: BenchStaffEntry[];
  period: {
    start: string;
    end: string;
    working_days: number;
  };
  computed_at: string;
}

// ============================================================================
// Core Calculation
// ============================================================================

/**
 * Generate the full bench report for an organization and period.
 *
 * @param organizationId - The organization UUID
 * @param query - Parsed bench query parameters
 * @param agencyId - Optional agency ID to scope results for AGENCY_ADMIN users
 * @returns Structured bench report response
 */
export async function generateBenchReport(
  organizationId: string,
  query: BenchQuery,
  agencyId?: string
): Promise<BenchReportResponse> {
  const now = new Date();
  const month = query.month ?? now.getMonth() + 1;
  const year = query.year ?? now.getFullYear();

  // 1. Get period boundaries
  const refDate = new Date(year, month - 1, 15); // mid-month reference
  const { start: periodStart, end: periodEnd } = getPeriodBoundaries(refDate, 'monthly');
  const workingDays = getWorkingDaysInPeriod(periodStart, periodEnd);

  // 2. Fetch all eligible staff with assignments, rates, and agency info
  const allStaff = await prisma.staff.findMany({
    where: {
      organization_id: organizationId,
      deleted_at: null,
      status: 'ACTIVE',
      ...(agencyId ? { agency_id: agencyId } : {}),
      ...(query.staff_type ? { staff_type: query.staff_type } : {}),
      ...(query.engagement_type ? { engagement_type: query.engagement_type as any } : {}),
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
      agency: {
        select: { id: true, name: true },
      },
      assignments: {
        select: {
          id: true,
          client_id: true,
          allocation_percentage: true,
          start_date: true,
          end_date: true,
          client: {
            select: { id: true, name: true },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  // 3. Fetch utilization targets for the org
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

  // Convert Decimal fields to numbers for target resolution
  const targetsAsNumbers = targets.map(t => ({
    staff_type: t.staff_type,
    target_rate: Number(t.target_rate),
    warning_threshold: Number(t.warning_threshold),
    critical_threshold: Number(t.critical_threshold),
    standard_daily_hours: Number(t.standard_daily_hours),
    enabled: t.enabled,
  }));

  // 4. Fetch all approved/submitted timesheet entries for the period
  const timesheetEntries = await prisma.timeEntry.findMany({
    where: {
      timesheet: {
        organization_id: organizationId,
        deleted_at: null,
        status: { in: ['APPROVED', 'SUBMITTED'] },
        period_start: { lte: periodEnd },
        period_end: { gte: periodStart },
      },
      entry_date: {
        gte: periodStart,
        lte: periodEnd,
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
  for (const entry of timesheetEntries) {
    const staffEntries = entriesByStaff.get(entry.staff_id) ?? [];
    staffEntries.push({ hours: Number(entry.hours), is_billable: entry.is_billable });
    entriesByStaff.set(entry.staff_id, staffEntries);
  }

  // 5. Process each staff member
  const benchEntries: BenchStaffEntry[] = [];
  let totalPayroll = 0;
  let totalBillableHours = 0;
  let totalAvailableHours = 0;
  let eligibleStaffCount = 0;

  // Resolve org-level default target for summary
  const defaultTarget = resolveEffectiveTarget(targetsAsNumbers, '__default__');

  for (const staff of allStaff) {
    // Skip owners and ineligible staff
    if (!isEligibleForUtilization(staff.engagement_type, 'ACTIVE')) {
      continue;
    }

    eligibleStaffCount++;

    // Resolve the target for this staff member
    const effectiveTarget = resolveEffectiveTarget(targetsAsNumbers, staff.staff_type);

    // Calculate available hours
    const availableHours = calculateAvailableHours(
      periodStart,
      periodEnd,
      effectiveTarget.standard_daily_hours
    );

    // Try TimeEntry data first, fall back to allocations
    const staffTimeEntries = entriesByStaff.get(staff.id);
    let billableHours: number;
    let nonBillableHours: number;
    let dataSource: 'TIMESHEET' | 'ALLOCATION';

    if (staffTimeEntries && staffTimeEntries.length > 0) {
      const result = calculateBillableHoursFromTimesheets(staffTimeEntries);
      billableHours = result.billableHours;
      nonBillableHours = result.nonBillableHours;
      dataSource = result.dataSource;
    } else {
      // Fall back to allocation-based estimation
      const activeAssignments = staff.assignments
        .filter(a => {
          const aStart = new Date(a.start_date);
          const aEnd = a.end_date ? new Date(a.end_date) : null;
          return aStart <= periodEnd && (aEnd === null || aEnd >= periodStart);
        })
        .map(a => ({
          allocation_percentage: Number(a.allocation_percentage),
          start_date: new Date(a.start_date),
          end_date: a.end_date ? new Date(a.end_date) : null,
        }));

      const result = calculateBillableHoursFromAllocations(
        activeAssignments,
        periodStart,
        periodEnd,
        availableHours
      );
      billableHours = result.billableHours;
      nonBillableHours = result.nonBillableHours;
      dataSource = result.dataSource;
    }

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

    // Calculate utilization rate
    const utilizationRate = calculateUtilizationRate(billableHours, availableHours);

    // Determine status
    const status = determineUtilizationStatus(utilizationRate, effectiveTarget);

    // Calculate bench duration
    const allAssignmentsForDuration = staff.assignments.map(a => ({
      start_date: new Date(a.start_date),
      end_date: a.end_date ? new Date(a.end_date) : null,
    }));
    const benchDuration = calculateBenchDuration(allAssignmentsForDuration, periodEnd);

    // Find the last ended assignment for last_client_name
    let lastClientName: string | null = null;
    if (benchDuration.lastAssignmentEnd) {
      const lastEndedAssignment = staff.assignments
        .filter(a => a.end_date !== null)
        .sort((a, b) => new Date(b.end_date!).getTime() - new Date(a.end_date!).getTime())[0];
      if (lastEndedAssignment) {
        lastClientName = lastEndedAssignment.client.name;
      }
    }

    // Monthly full cost
    const monthlyFullCost = toMonthlyCost(Number(staff.rate), staff.rate_type);
    totalPayroll += monthlyFullCost;
    totalBillableHours += billableHours;
    totalAvailableHours += availableHours;

    // Current active assignments
    const currentAssignments = staff.assignments
      .filter(a => {
        const aStart = new Date(a.start_date);
        const aEnd = a.end_date ? new Date(a.end_date) : null;
        return aStart <= periodEnd && (aEnd === null || aEnd >= periodStart);
      })
      .map(a => ({
        client_id: a.client.id,
        client_name: a.client.name,
        allocation_percentage: Number(a.allocation_percentage),
      }));

    const entry: BenchStaffEntry = {
      staff: {
        id: staff.id,
        name: staff.name,
        staff_type: staff.staff_type,
        engagement_type: staff.engagement_type,
        agency_id: staff.agency_id,
        agency_name: staff.agency?.name ?? null,
      },
      utilization: {
        rate: utilizationRate,
        status,
        available_hours: availableHours,
        billable_hours: billableHours,
        non_billable_hours: nonBillableHours,
        bench_hours: benchResult.benchHours,
        data_source: dataSource,
      },
      cost: {
        bench_cost: benchResult.benchCost,
        hourly_cost_rate: benchResult.costRateHourly,
        cost_rate_source: benchResult.costRateSource,
        monthly_full_cost: Math.round(monthlyFullCost * 100) / 100,
      },
      bench_info: {
        days_on_bench: benchDuration.daysOnBench,
        last_assignment_end: benchDuration.lastAssignmentEnd
          ? benchDuration.lastAssignmentEnd.toISOString().split('T')[0]
          : null,
        last_client_name: lastClientName,
      },
      current_assignments: currentAssignments,
    };

    benchEntries.push(entry);
  }

  // 6. Filter to only staff below target (unless include_all=true)
  let filteredEntries = query.include_all
    ? benchEntries
    : benchEntries.filter(e => e.utilization.status !== 'on_target');

  // 7. Sort by the specified field
  const sortBy = query.sort_by ?? 'bench_cost';
  const sortOrder = query.sort_order ?? 'desc';
  const multiplier = sortOrder === 'desc' ? -1 : 1;

  filteredEntries.sort((a, b) => {
    switch (sortBy) {
      case 'bench_cost':
        return (a.cost.bench_cost - b.cost.bench_cost) * multiplier;
      case 'utilization_rate':
        return (a.utilization.rate - b.utilization.rate) * multiplier;
      case 'bench_days':
        return ((a.bench_info.days_on_bench ?? 0) - (b.bench_info.days_on_bench ?? 0)) * multiplier;
      case 'name':
        return a.staff.name.localeCompare(b.staff.name) * multiplier;
      default:
        return 0;
    }
  });

  // 8. Calculate summary metrics
  const totalBenchCost = filteredEntries.reduce((sum, e) => sum + e.cost.bench_cost, 0);
  const benchWithDays = filteredEntries.filter(e => e.bench_info.days_on_bench !== null);
  const avgBenchDays = benchWithDays.length > 0
    ? benchWithDays.reduce((sum, e) => sum + (e.bench_info.days_on_bench ?? 0), 0) / benchWithDays.length
    : 0;
  const orgUtilizationRate = totalAvailableHours > 0
    ? Math.round((totalBillableHours / totalAvailableHours) * 100 * 100) / 100
    : 0;
  const benchPctOfPayroll = totalPayroll > 0
    ? Math.round((totalBenchCost / totalPayroll) * 100 * 100) / 100
    : 0;

  const summary: BenchReportSummary = {
    total_bench_headcount: filteredEntries.length,
    total_active_staff: eligibleStaffCount,
    total_bench_cost: Math.round(totalBenchCost * 100) / 100,
    average_bench_duration_days: Math.round(avgBenchDays * 10) / 10,
    bench_cost_as_pct_of_payroll: benchPctOfPayroll,
    total_payroll_cost: Math.round(totalPayroll * 100) / 100,
    org_utilization_rate: orgUtilizationRate,
    target_rate: defaultTarget.target_rate,
  };

  return {
    summary,
    bench_staff: filteredEntries,
    period: {
      start: periodStart.toISOString().split('T')[0],
      end: periodEnd.toISOString().split('T')[0],
      working_days: workingDays,
    },
    computed_at: new Date().toISOString(),
  };
}
