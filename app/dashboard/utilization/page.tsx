/**
 * T013/T035/T042: Utilization Dashboard page (server component).
 * Fetches utilization data server-side using the same calculation logic as
 * the /api/utilization/current endpoint and renders client components.
 * Includes historical utilization trend chart from UtilizationSnapshot data.
 *
 * AGENCY_ADMIN users see only staff belonging to their agency, with a
 * subtitle indicating the agency-scoped view.
 */

import { requireAuth } from '@/lib/auth/helpers';
import { getOrganizationId } from '@/lib/auth/organization';
import { prisma } from '@/lib/prisma';
import {
  isEligibleForUtilization,
  calculateAvailableHours,
  calculateBillableHoursFromTimesheets,
  calculateBillableHoursFromAllocations,
  calculateUtilizationRate,
  getPeriodBoundaries,
  getWorkingDaysInPeriod,
  STANDARD_DAILY_HOURS,
} from '@/lib/calculations/utilization';
import { calculateStaffBenchCost } from '@/lib/calculations/bench-cost';
import {
  resolveEffectiveTarget,
  determineUtilizationStatus,
} from '@/lib/calculations/utilization-targets';
import { UtilizationGauge } from '@/components/utilization/utilization-gauge';
import { BenchCostCard } from '@/components/utilization/bench-cost-card';
import { StaffUtilizationTable, type StaffUtilizationRow } from '@/components/utilization/staff-utilization-table';
import { UtilizationTrendChart } from '@/components/utilization/utilization-trend-chart';

export default async function UtilizationDashboardPage() {
  const user = await requireAuth();
  const organizationId = await getOrganizationId();

  // Determine if this is an agency-scoped view
  const isAgencyAdmin = user.role === 'AGENCY_ADMIN' && !!user.agencyId;

  // Fetch agency name for subtitle when agency-scoped
  let agencyName: string | null = null;
  if (isAgencyAdmin) {
    const agency = await prisma.agency.findUnique({
      where: { id: user.agencyId! },
      select: { name: true },
    });
    agencyName = agency?.name ?? null;
  }

  // Default to current month
  const now = new Date();
  const { start: periodStart, end: periodEnd } = getPeriodBoundaries(now, 'monthly');
  const workingDays = getWorkingDaysInPeriod(periodStart, periodEnd);

  // Build staff where clause, scoped to agency for AGENCY_ADMIN users
  const staffWhereClause: Record<string, unknown> = {
    organization_id: organizationId,
    status: { not: 'TERMINATED' },
    deleted_at: null,
    engagement_type: { in: ['FULL_TIME', 'PART_TIME', 'PROJECT', 'AGENCY'] },
  };
  if (isAgencyAdmin) {
    staffWhereClause.agency_id = user.agencyId;
  }

  // Fetch eligible staff (agency-scoped for AGENCY_ADMIN)
  const staffList = await prisma.staff.findMany({
    where: staffWhereClause,
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

  // Fetch utilization targets
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

  const targetsNumeric = targets.map((t) => ({
    staff_type: t.staff_type,
    target_rate: Number(t.target_rate),
    warning_threshold: Number(t.warning_threshold),
    critical_threshold: Number(t.critical_threshold),
    standard_daily_hours: Number(t.standard_daily_hours),
    enabled: t.enabled,
  }));

  // Batch fetch time entries for the period
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

  // Group time entries by staff
  const entriesByStaff = new Map<string, Array<{ hours: number; is_billable: boolean }>>();
  for (const entry of timeEntries) {
    const list = entriesByStaff.get(entry.staff_id) ?? [];
    list.push({ hours: Number(entry.hours), is_billable: entry.is_billable });
    entriesByStaff.set(entry.staff_id, list);
  }

  // Batch fetch assignments for allocation fallback
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
  const staffRows: StaffUtilizationRow[] = [];
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

    const effectiveTarget = resolveEffectiveTarget(targetsNumeric, staff.staff_type);

    const availableHours = calculateAvailableHours(
      periodStart,
      periodEnd,
      effectiveTarget.standard_daily_hours,
      staff.created_at,
    );

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

    const utilizationRate = calculateUtilizationRate(billableHours, availableHours);

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

    const status = determineUtilizationStatus(utilizationRate, effectiveTarget);

    if (benchResult.benchHours > 0) {
      benchStaffCount++;
    }

    totalAvailableHours += availableHours;
    totalBillableHours += billableHours;
    totalNonBillableHours += nonBillableHours;
    totalBenchHours += benchResult.benchHours;
    totalBenchCost += benchResult.benchCost;

    staffRows.push({
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
      data_source: dataSource,
      status,
      target_rate: effectiveTarget.target_rate,
      current_assignments: staff.assignments.map((a) => ({
        id: a.id,
        client_name: a.client.name,
        allocation_percentage: Number(a.allocation_percentage),
      })),
    });
  }

  // Org-level metrics
  const orgUtilizationRate = totalAvailableHours > 0
    ? Math.round((totalBillableHours / totalAvailableHours) * 100 * 100) / 100
    : 0;
  const orgTarget = resolveEffectiveTarget(targetsNumeric, '');
  const orgStatus = determineUtilizationStatus(orgUtilizationRate, orgTarget);

  // --- T035: Fetch last 12 months of snapshots for trend chart ---
  const trendLookback = new Date();
  trendLookback.setMonth(trendLookback.getMonth() - 12);
  trendLookback.setHours(0, 0, 0, 0);

  // For AGENCY_ADMIN, scope trend snapshots to only their agency's staff
  const trendSnapshotWhere: Record<string, unknown> = {
    organization_id: organizationId,
    period_start: { gte: trendLookback },
  };
  if (isAgencyAdmin) {
    trendSnapshotWhere.staff_id = { in: staffList.map((s) => s.id) };
  }

  const trendSnapshots = await prisma.utilizationSnapshot.findMany({
    where: trendSnapshotWhere,
    select: {
      period_start: true,
      period_end: true,
      utilization_rate: true,
      billable_hours: true,
      bench_hours: true,
      data_source: true,
    },
    orderBy: { period_start: 'asc' },
  });

  // Aggregate snapshots by period to compute org-level averages
  const trendPeriodMap = new Map<
    string,
    {
      period_start: string;
      totalUtilRate: number;
      totalBillable: number;
      totalBench: number;
      count: number;
      dataSources: Set<string>;
    }
  >();

  for (const snap of trendSnapshots) {
    const key = snap.period_start.toISOString();
    const entry = trendPeriodMap.get(key) ?? {
      period_start: key,
      totalUtilRate: 0,
      totalBillable: 0,
      totalBench: 0,
      count: 0,
      dataSources: new Set<string>(),
    };
    entry.totalUtilRate += Number(snap.utilization_rate);
    entry.totalBillable += Number(snap.billable_hours);
    entry.totalBench += Number(snap.bench_hours);
    entry.count += 1;
    entry.dataSources.add(snap.data_source);
    trendPeriodMap.set(key, entry);
  }

  const trendHistory = Array.from(trendPeriodMap.values())
    .sort((a, b) => a.period_start.localeCompare(b.period_start))
    .map((p) => ({
      period_start: p.period_start,
      utilization_rate:
        p.count > 0
          ? Math.round((p.totalUtilRate / p.count) * 100) / 100
          : 0,
      billable_hours: Math.round(p.totalBillable * 100) / 100,
      bench_hours: Math.round(p.totalBench * 100) / 100,
      data_source: p.dataSources.size === 1
        ? Array.from(p.dataSources)[0]
        : 'BLENDED',
    }));

  // Format period label
  const periodLabel = periodStart.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Utilization Dashboard</h1>
        {isAgencyAdmin && agencyName && (
          <p className="text-sm font-medium text-blue-600 mt-0.5">
            Agency View: {agencyName}
          </p>
        )}
        <p className="text-sm text-muted-foreground mt-1">
          {periodLabel} &middot; {workingDays} working days &middot; {staffRows.length} active staff
        </p>
      </div>

      {/* Top row: Gauge + Bench Cost Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <UtilizationGauge
          utilizationRate={orgUtilizationRate}
          targetRate={orgTarget.target_rate}
          status={orgStatus}
          billableHours={Math.round(totalBillableHours * 100) / 100}
          availableHours={Math.round(totalAvailableHours * 100) / 100}
        />
        <BenchCostCard
          totalBenchCost={Math.round(totalBenchCost * 100) / 100}
          benchStaffCount={benchStaffCount}
          activeStaffCount={staffRows.length}
          totalBenchHours={Math.round(totalBenchHours * 100) / 100}
          totalAvailableHours={Math.round(totalAvailableHours * 100) / 100}
        />
      </div>

      {/* Utilization Trend Chart */}
      <UtilizationTrendChart
        history={trendHistory}
        targetRate={orgTarget.target_rate}
        warningThreshold={orgTarget.warning_threshold}
        criticalThreshold={orgTarget.critical_threshold}
      />

      {/* Staff table */}
      <StaffUtilizationTable staff={staffRows} />
    </div>
  );
}
