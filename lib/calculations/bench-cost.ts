/**
 * Bench cost calculation functions for Feature 16.
 * Calculates bench hours, bench cost, and cost rates for idle staff time.
 */
import { toHourlyCost } from '@/lib/utils/currency';

/**
 * Calculate bench (idle) hours.
 * bench_hours = available_hours - billable_hours - non_billable_hours
 * Minimum of 0 (cannot have negative bench hours).
 */
export function calculateBenchHours(
  availableHours: number,
  billableHours: number,
  nonBillableHours: number
): number {
  const bench = availableHours - billableHours - nonBillableHours;
  return Math.max(0, Math.round(bench * 100) / 100);
}

/**
 * Get the hourly cost rate for a staff member.
 * Prefers true_cost over rate for more accurate bench cost calculation.
 * Returns { hourlyRate, source } indicating which field was used.
 */
export function getHourlyCostRate(staff: {
  rate: number;
  rate_type: string;
  true_cost?: number | null;
  true_cost_rate_type?: string | null;
}): { hourlyRate: number; source: 'true_cost' | 'rate' } {
  // Prefer true_cost when available
  if (staff.true_cost != null && staff.true_cost > 0 && staff.true_cost_rate_type) {
    return {
      hourlyRate: toHourlyCost(
        typeof staff.true_cost === 'number' ? staff.true_cost : Number(staff.true_cost),
        staff.true_cost_rate_type
      ),
      source: 'true_cost',
    };
  }

  // Fall back to bill rate
  return {
    hourlyRate: toHourlyCost(
      typeof staff.rate === 'number' ? staff.rate : Number(staff.rate),
      staff.rate_type
    ),
    source: 'rate',
  };
}

/**
 * Calculate the monetary bench cost.
 * bench_cost = bench_hours * hourly_cost_rate
 */
export function calculateBenchCost(
  benchHours: number,
  hourlyCostRate: number
): number {
  return Math.round(benchHours * hourlyCostRate * 100) / 100;
}

/**
 * Calculate consecutive days a staff member has been on bench (no billable assignment).
 * Returns null if staff currently has an active assignment.
 */
export function calculateBenchDuration(
  assignments: Array<{
    start_date: Date;
    end_date: Date | null;
  }>,
  referenceDate: Date = new Date()
): { daysOnBench: number | null; lastAssignmentEnd: Date | null } {
  // Check for any currently active assignment
  const hasActiveAssignment = assignments.some(a => {
    const start = new Date(a.start_date);
    const end = a.end_date ? new Date(a.end_date) : null;
    return start <= referenceDate && (end === null || end >= referenceDate);
  });

  if (hasActiveAssignment) {
    return { daysOnBench: null, lastAssignmentEnd: null };
  }

  // Find the most recent ended assignment
  const endedAssignments = assignments
    .filter(a => a.end_date !== null)
    .map(a => new Date(a.end_date!))
    .sort((a, b) => b.getTime() - a.getTime());

  if (endedAssignments.length === 0) {
    // Never had an assignment - return null for lastAssignmentEnd
    return { daysOnBench: null, lastAssignmentEnd: null };
  }

  const lastEnd = endedAssignments[0];
  const diffMs = referenceDate.getTime() - lastEnd.getTime();
  const daysOnBench = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return {
    daysOnBench: Math.max(0, daysOnBench),
    lastAssignmentEnd: lastEnd,
  };
}

/**
 * Full bench cost calculation for a single staff member.
 * Combines all bench cost calculations into a single result.
 */
export function calculateStaffBenchCost(params: {
  availableHours: number;
  billableHours: number;
  nonBillableHours: number;
  staff: {
    rate: number;
    rate_type: string;
    true_cost?: number | null;
    true_cost_rate_type?: string | null;
  };
}): {
  benchHours: number;
  benchCost: number;
  costRateHourly: number;
  costRateSource: 'true_cost' | 'rate';
} {
  const benchHours = calculateBenchHours(
    params.availableHours,
    params.billableHours,
    params.nonBillableHours
  );

  const { hourlyRate, source } = getHourlyCostRate(params.staff);
  const benchCost = calculateBenchCost(benchHours, hourlyRate);

  return {
    benchHours,
    benchCost,
    costRateHourly: Math.round(hourlyRate * 100) / 100,
    costRateSource: source,
  };
}
