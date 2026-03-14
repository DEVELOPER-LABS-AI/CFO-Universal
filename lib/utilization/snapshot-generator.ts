/**
 * Utilization snapshot generator for Feature 16 (US5 - Snapshots & Alerts).
 * Generates point-in-time utilization metrics for all eligible staff members
 * within an organization for a given period.
 *
 * Data source priority: TimeEntry (from timesheets) > StaffAssignment (allocations).
 * Snapshots are upserted on the unique constraint [staff_id, period_start, period_end].
 */

import { prisma } from '@/lib/prisma';
import {
  isEligibleForUtilization,
  calculateAvailableHours,
  calculateBillableHoursFromTimesheets,
  calculateBillableHoursFromAllocations,
  calculateUtilizationRate,
  getPeriodBoundaries,
} from '@/lib/calculations/utilization';
import { calculateStaffBenchCost } from '@/lib/calculations/bench-cost';
import {
  resolveEffectiveTarget,
  determineAlertLevel,
} from '@/lib/calculations/utilization-targets';
import type { AlertLevel } from '@/lib/calculations/utilization-targets';

/** Result summary returned after snapshot generation completes. */
export interface SnapshotGenerationResult {
  generated: number;
  skipped: number;
  errors: number;
  alertsCreated: number;
  details: Array<{ staff_id: string; staff_name: string; error: string }>;
  /** Snapshots that were generated, passed downstream to alert generator. */
  snapshots: Array<{
    staff_id: string;
    staff_name: string;
    alert_level: AlertLevel;
    utilization_rate: number;
  }>;
}

/**
 * Generate utilization snapshots for all eligible staff in an organization.
 *
 * @param params.organizationId - The organization to generate snapshots for
 * @param params.periodType - 'weekly' or 'monthly' period granularity
 * @param params.periodStart - Optional explicit period start (defaults to current period)
 * @param params.periodEnd - Optional explicit period end (defaults to current period)
 * @param params.force - When true, regenerate even if snapshots already exist for the period
 * @returns Summary of generation results including counts and any per-staff errors
 */
export async function generateSnapshots(params: {
  organizationId: string;
  periodType: 'weekly' | 'monthly';
  periodStart?: Date;
  periodEnd?: Date;
  force?: boolean;
}): Promise<SnapshotGenerationResult> {
  const { organizationId, periodType, force = false } = params;

  // 1. Determine period boundaries
  let periodStart: Date;
  let periodEnd: Date;

  if (params.periodStart && params.periodEnd) {
    periodStart = new Date(params.periodStart);
    periodStart.setHours(0, 0, 0, 0);
    periodEnd = new Date(params.periodEnd);
    periodEnd.setHours(23, 59, 59, 999);
  } else {
    const boundaries = getPeriodBoundaries(new Date(), periodType);
    periodStart = boundaries.start;
    periodEnd = boundaries.end;
  }

  // 2. Fetch all non-terminated staff for the organization
  const allStaff = await prisma.staff.findMany({
    where: {
      organization_id: organizationId,
      status: { not: 'TERMINATED' },
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
      created_at: true,
    },
  });

  // Filter to eligible engagement types
  const eligibleStaff = allStaff.filter((s) =>
    isEligibleForUtilization(s.engagement_type, 'ACTIVE')
  );

  // 3. Fetch utilization targets for the organization
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

  // Convert Decimal fields to numbers for calculation functions
  const targetsAsNumbers = targets.map((t) => ({
    staff_type: t.staff_type,
    target_rate: Number(t.target_rate),
    warning_threshold: Number(t.warning_threshold),
    critical_threshold: Number(t.critical_threshold),
    standard_daily_hours: Number(t.standard_daily_hours),
    enabled: t.enabled,
  }));

  // 4. If not forcing, check for existing snapshots to skip
  let existingStaffIds = new Set<string>();
  if (!force) {
    const existingSnapshots = await prisma.utilizationSnapshot.findMany({
      where: {
        organization_id: organizationId,
        period_start: periodStart,
        period_end: periodEnd,
      },
      select: { staff_id: true },
    });
    existingStaffIds = new Set(existingSnapshots.map((s) => s.staff_id));
  }

  const result: SnapshotGenerationResult = {
    generated: 0,
    skipped: 0,
    errors: 0,
    alertsCreated: 0,
    details: [],
    snapshots: [],
  };

  // 5. Process each eligible staff member
  for (const staff of eligibleStaff) {
    // Skip if snapshot already exists and not forcing
    if (!force && existingStaffIds.has(staff.id)) {
      result.skipped++;
      continue;
    }

    try {
      // 5a. Resolve effective target for this staff member's type
      const effectiveTarget = resolveEffectiveTarget(
        targetsAsNumbers,
        staff.staff_type
      );

      // 5b. Calculate available hours (prorate for staff created mid-period)
      const availableHours = calculateAvailableHours(
        periodStart,
        periodEnd,
        effectiveTarget.standard_daily_hours,
        staff.created_at
      );

      // 5c. Get billable hours: try timesheets first, fall back to allocations
      let billableHours = 0;
      let nonBillableHours = 0;
      let dataSource: 'TIMESHEET' | 'ALLOCATION' | 'BLENDED' = 'ALLOCATION';

      // Fetch time entries from approved/submitted timesheets in the period
      const timeEntries = await prisma.timeEntry.findMany({
        where: {
          staff_id: staff.id,
          entry_date: {
            gte: periodStart,
            lte: periodEnd,
          },
          timesheet: {
            status: { in: ['APPROVED', 'SUBMITTED'] },
          },
        },
        select: {
          hours: true,
          is_billable: true,
        },
      });

      if (timeEntries.length > 0) {
        // Use timesheet data
        const timesheetResult = calculateBillableHoursFromTimesheets(
          timeEntries.map((e) => ({
            hours: Number(e.hours),
            is_billable: e.is_billable,
          }))
        );
        billableHours = timesheetResult.billableHours;
        nonBillableHours = timesheetResult.nonBillableHours;
        dataSource = 'TIMESHEET';
      } else {
        // Fall back to allocation data
        const assignments = await prisma.staffAssignment.findMany({
          where: {
            staff_id: staff.id,
            start_date: { lte: periodEnd },
            OR: [
              { end_date: null },
              { end_date: { gte: periodStart } },
            ],
          },
          select: {
            allocation_percentage: true,
            start_date: true,
            end_date: true,
          },
        });

        if (assignments.length > 0) {
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
        // If no assignments either, billable/nonBillable remain 0 with ALLOCATION source
      }

      // 5d. Calculate bench cost
      const benchResult = calculateStaffBenchCost({
        availableHours,
        billableHours,
        nonBillableHours,
        staff: {
          rate: Number(staff.rate),
          rate_type: staff.rate_type,
          true_cost: staff.true_cost != null ? Number(staff.true_cost) : null,
          true_cost_rate_type: staff.true_cost_rate_type ?? null,
        },
      });

      // 5e. Calculate utilization rate
      const utilizationRate = calculateUtilizationRate(
        billableHours,
        availableHours
      );

      // 5f. Determine alert level from target thresholds
      const alertLevel = determineAlertLevel(utilizationRate, {
        warning_threshold: effectiveTarget.warning_threshold,
        critical_threshold: effectiveTarget.critical_threshold,
      });

      // 5g. Upsert snapshot (unique on [staff_id, period_start, period_end])
      await prisma.utilizationSnapshot.upsert({
        where: {
          staff_id_period_start_period_end: {
            staff_id: staff.id,
            period_start: periodStart,
            period_end: periodEnd,
          },
        },
        create: {
          organization_id: organizationId,
          staff_id: staff.id,
          period_start: periodStart,
          period_end: periodEnd,
          available_hours: availableHours,
          billable_hours: billableHours,
          non_billable_hours: nonBillableHours,
          bench_hours: benchResult.benchHours,
          utilization_rate: utilizationRate,
          bench_cost: benchResult.benchCost,
          cost_rate_hourly: benchResult.costRateHourly,
          cost_rate_source: benchResult.costRateSource,
          data_source: dataSource,
          alert_level: alertLevel,
        },
        update: {
          available_hours: availableHours,
          billable_hours: billableHours,
          non_billable_hours: nonBillableHours,
          bench_hours: benchResult.benchHours,
          utilization_rate: utilizationRate,
          bench_cost: benchResult.benchCost,
          cost_rate_hourly: benchResult.costRateHourly,
          cost_rate_source: benchResult.costRateSource,
          data_source: dataSource,
          alert_level: alertLevel,
          generated_at: new Date(),
        },
      });

      result.generated++;
      result.snapshots.push({
        staff_id: staff.id,
        staff_name: staff.name,
        alert_level: alertLevel,
        utilization_rate: utilizationRate,
      });
    } catch (error) {
      result.errors++;
      result.details.push({
        staff_id: staff.id,
        staff_name: staff.name,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      console.error(
        `[snapshot-generator] Error processing staff ${staff.name} (${staff.id}):`,
        error
      );
    }
  }

  return result;
}
