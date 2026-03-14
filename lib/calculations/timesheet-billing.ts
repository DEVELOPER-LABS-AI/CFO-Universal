/**
 * Timesheet Billing & Overtime Calculation Module (Feature 15).
 *
 * Pure functions for computing overtime distribution and billing amounts
 * from approved timesheet hours.
 */

import prisma from '@/lib/prisma';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OvertimeConfigData {
  threshold: number;
  multiplier: number;
  enabled: boolean;
}

export interface AssignmentBillingBreakdown {
  assignmentId: string;
  clientName: string;
  regularHours: number;
  overtimeHours: number;
  regularAmount: number;
  overtimeAmount: number;
  totalAmount: number;
}

export interface TimesheetBillingResult {
  totalBillableHours: number;
  totalNonBillableHours: number;
  totalOvertimeHours: number;
  regularAmount: number;
  overtimeAmount: number;
  totalAmount: number;
  byAssignment: AssignmentBillingBreakdown[];
}

export interface StaffRateInfo {
  rate: number;
  rateType: 'HOURLY' | 'DAILY' | 'MONTHLY' | 'VARIABLE';
}

/** Entries grouped by assignment. */
export interface AssignmentHours {
  assignmentId: string;
  clientName: string;
  totalHours: number;
  billableHours: number;
}

// ---------------------------------------------------------------------------
// Database helper (only function that touches the DB)
// ---------------------------------------------------------------------------

/**
 * Resolve the effective overtime configuration for a given organisation
 * (and optionally a specific agency).
 *
 * Priority chain:
 * 1. Agency-level override (organization_id + agency_id)
 * 2. Org-level default   (organization_id, agency_id IS NULL)
 * 3. Hard-coded defaults  { threshold: 40, multiplier: 1.5, enabled: true }
 *
 * Prisma `Decimal` values are converted to native `number` via `Number()`.
 */
export async function getEffectiveOvertimeConfig(
  organizationId: string,
  agencyId?: string | null,
): Promise<OvertimeConfigData> {
  const defaults: OvertimeConfigData = {
    threshold: 40,
    multiplier: 1.5,
    enabled: true,
  };

  // 1. Try agency-level override
  if (agencyId) {
    const agencyConfig = await prisma.overtimeConfig.findFirst({
      where: {
        organization_id: organizationId,
        agency_id: agencyId,
      },
    });

    if (agencyConfig) {
      return {
        threshold: Number(agencyConfig.weekly_hours_threshold),
        multiplier: Number(agencyConfig.overtime_multiplier),
        enabled: agencyConfig.is_enabled,
      };
    }
  }

  // 2. Org-level default
  const orgConfig = await prisma.overtimeConfig.findFirst({
    where: {
      organization_id: organizationId,
      agency_id: null,
    },
  });

  if (orgConfig) {
    return {
      threshold: Number(orgConfig.weekly_hours_threshold),
      multiplier: Number(orgConfig.overtime_multiplier),
      enabled: orgConfig.is_enabled,
    };
  }

  // 3. Hard-coded defaults
  return defaults;
}

// ---------------------------------------------------------------------------
// Pure calculation functions
// ---------------------------------------------------------------------------

/**
 * Split total billable hours into regular and overtime portions based on the
 * provided overtime configuration.
 *
 * - If overtime is disabled, all hours are treated as regular.
 * - Hours up to the threshold are regular; any excess is overtime.
 */
export function calculateOvertimeBreakdown(
  totalBillableHours: number,
  config: OvertimeConfigData,
): { regularHours: number; overtimeHours: number; isOvertime: boolean } {
  if (!config.enabled) {
    return {
      regularHours: totalBillableHours,
      overtimeHours: 0,
      isOvertime: false,
    };
  }

  if (totalBillableHours <= config.threshold) {
    return {
      regularHours: totalBillableHours,
      overtimeHours: 0,
      isOvertime: false,
    };
  }

  const overtimeHours = totalBillableHours - config.threshold;
  return {
    regularHours: config.threshold,
    overtimeHours,
    isOvertime: true,
  };
}

/**
 * Distribute overtime hours proportionally across assignments based on each
 * assignment's share of total billable hours.
 *
 * Each assignment's regular hours = billableHours - its overtime share.
 * If total billable hours is 0, overtime is distributed evenly.
 */
export function distributeOvertimeProportionally(
  assignments: AssignmentHours[],
  totalOvertimeHours: number,
): Array<{
  assignmentId: string;
  clientName: string;
  regularHours: number;
  overtimeHours: number;
}> {
  const totalBillable = assignments.reduce((sum, a) => sum + a.billableHours, 0);

  return assignments.map((assignment) => {
    let share: number;

    if (totalBillable === 0) {
      // Edge case: distribute evenly when no billable hours exist
      share = assignments.length > 0 ? totalOvertimeHours / assignments.length : 0;
    } else {
      share = (assignment.billableHours / totalBillable) * totalOvertimeHours;
    }

    return {
      assignmentId: assignment.assignmentId,
      clientName: assignment.clientName,
      regularHours: assignment.billableHours - share,
      overtimeHours: share,
    };
  });
}

/**
 * Convert any supported rate type to an effective hourly rate.
 *
 * - HOURLY:   returned as-is
 * - DAILY:    rate / 8
 * - MONTHLY:  rate / (22 * 8)   — 22 working days, 8 hours each
 * - VARIABLE: treated as hourly
 */
export function getHourlyRate(rate: number, rateType: string): number {
  switch (rateType) {
    case 'HOURLY':
      return rate;
    case 'DAILY':
      return rate / 8;
    case 'MONTHLY':
      return rate / (22 * 8);
    case 'VARIABLE':
      return rate;
    default:
      return rate;
  }
}

/**
 * Compute a full billing breakdown for a set of timesheet entries.
 *
 * 1. Groups entries by assignment.
 * 2. Separates billable from non-billable hours.
 * 3. Applies overtime rules via `calculateOvertimeBreakdown`.
 * 4. Distributes overtime proportionally via `distributeOvertimeProportionally`.
 * 5. Calculates monetary amounts using the staff rate.
 *
 * Non-billable entries (null assignment_id or is_billable === false) receive
 * $0 amounts in the output.
 */
export function calculateTimesheetBilling(params: {
  entries: Array<{
    assignmentId: string | null;
    clientName: string;
    hours: number;
    isBillable: boolean;
  }>;
  staffRate: StaffRateInfo;
  overtimeConfig: OvertimeConfigData;
}): TimesheetBillingResult {
  const { entries, staffRate, overtimeConfig } = params;

  // --- 1. Separate billable vs non-billable and group by assignment ----------
  const assignmentMap = new Map<
    string,
    { clientName: string; billableHours: number; totalHours: number }
  >();
  let totalNonBillableHours = 0;

  for (const entry of entries) {
    if (!entry.isBillable || entry.assignmentId == null) {
      totalNonBillableHours += entry.hours;
      continue;
    }

    const existing = assignmentMap.get(entry.assignmentId);
    if (existing) {
      existing.billableHours += entry.hours;
      existing.totalHours += entry.hours;
    } else {
      assignmentMap.set(entry.assignmentId, {
        clientName: entry.clientName,
        billableHours: entry.hours,
        totalHours: entry.hours,
      });
    }
  }

  // --- 2. Build AssignmentHours array ----------------------------------------
  const assignmentHours: AssignmentHours[] = Array.from(
    assignmentMap.entries(),
  ).map(([assignmentId, data]) => ({
    assignmentId,
    clientName: data.clientName,
    totalHours: data.totalHours,
    billableHours: data.billableHours,
  }));

  const totalBillableHours = assignmentHours.reduce(
    (sum, a) => sum + a.billableHours,
    0,
  );

  // --- 3. Overtime breakdown -------------------------------------------------
  const overtimeBreakdown = calculateOvertimeBreakdown(
    totalBillableHours,
    overtimeConfig,
  );

  // --- 4. Distribute overtime proportionally ---------------------------------
  const distributed = distributeOvertimeProportionally(
    assignmentHours,
    overtimeBreakdown.overtimeHours,
  );

  // --- 5. Calculate amounts --------------------------------------------------
  const hourlyRate = getHourlyRate(staffRate.rate, staffRate.rateType);

  const byAssignment: AssignmentBillingBreakdown[] = distributed.map((d) => {
    const regularAmount =
      Math.round(d.regularHours * hourlyRate * 100) / 100;
    const overtimeAmount =
      Math.round(
        d.overtimeHours * hourlyRate * overtimeConfig.multiplier * 100,
      ) / 100;

    return {
      assignmentId: d.assignmentId,
      clientName: d.clientName,
      regularHours: d.regularHours,
      overtimeHours: d.overtimeHours,
      regularAmount,
      overtimeAmount,
      totalAmount: Math.round((regularAmount + overtimeAmount) * 100) / 100,
    };
  });

  const regularAmount = byAssignment.reduce(
    (sum, a) => sum + a.regularAmount,
    0,
  );
  const overtimeAmount = byAssignment.reduce(
    (sum, a) => sum + a.overtimeAmount,
    0,
  );

  return {
    totalBillableHours,
    totalNonBillableHours,
    totalOvertimeHours: overtimeBreakdown.overtimeHours,
    regularAmount: Math.round(regularAmount * 100) / 100,
    overtimeAmount: Math.round(overtimeAmount * 100) / 100,
    totalAmount: Math.round((regularAmount + overtimeAmount) * 100) / 100,
    byAssignment,
  };
}
