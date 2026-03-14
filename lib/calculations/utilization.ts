/**
 * Core utilization calculation functions for Feature 16.
 * Calculates utilization rates, available hours, and billable hours
 * from timesheet data (primary) or allocation data (fallback).
 */

// Constants
export const WORKING_DAYS_PER_MONTH = 22;
export const WORKING_DAYS_PER_WEEK = 5;
export const STANDARD_DAILY_HOURS = 8;
export const HOURS_PER_MONTH = 176; // 22 * 8

// Eligible engagement types (OWNER excluded from utilization calculations)
export const ELIGIBLE_ENGAGEMENT_TYPES = ['FULL_TIME', 'PART_TIME', 'PROJECT', 'AGENCY'] as const;

/**
 * Check if a staff member is eligible for utilization calculations.
 * Excludes OWNER engagement type and TERMINATED status.
 */
export function isEligibleForUtilization(
  engagementType: string,
  status: string
): boolean {
  if (status === 'TERMINATED') return false;
  return ELIGIBLE_ENGAGEMENT_TYPES.includes(engagementType as any);
}

/**
 * Calculate working days in a date range (Mon-Fri).
 * Excludes weekends. Does not account for public holidays.
 */
export function getWorkingDaysInPeriod(start: Date, end: Date): number {
  let count = 0;
  const current = new Date(start);
  // Set to start of day
  current.setHours(0, 0, 0, 0);
  const endDate = new Date(end);
  endDate.setHours(0, 0, 0, 0);

  while (current <= endDate) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) { // Not Sunday or Saturday
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
}

/**
 * Calculate available hours for a period given standard daily hours.
 * For staff who started mid-period, prorates based on their start date.
 */
export function calculateAvailableHours(
  periodStart: Date,
  periodEnd: Date,
  standardDailyHours: number = STANDARD_DAILY_HOURS,
  staffStartDate?: Date | null
): number {
  const effectiveStart = staffStartDate && staffStartDate > periodStart
    ? staffStartDate
    : periodStart;

  const workingDays = getWorkingDaysInPeriod(effectiveStart, periodEnd);
  return workingDays * standardDailyHours;
}

/**
 * Calculate billable hours from timesheet entries.
 * Uses approved/submitted timesheet data when available.
 * Returns { billableHours, nonBillableHours, dataSource }
 */
export function calculateBillableHoursFromTimesheets(
  timeEntries: Array<{
    hours: number;
    is_billable: boolean;
  }>
): { billableHours: number; nonBillableHours: number; dataSource: 'TIMESHEET' } {
  let billableHours = 0;
  let nonBillableHours = 0;

  for (const entry of timeEntries) {
    const hours = typeof entry.hours === 'number' ? entry.hours : Number(entry.hours);
    if (entry.is_billable) {
      billableHours += hours;
    } else {
      nonBillableHours += hours;
    }
  }

  return {
    billableHours: Math.round(billableHours * 100) / 100,
    nonBillableHours: Math.round(nonBillableHours * 100) / 100,
    dataSource: 'TIMESHEET' as const,
  };
}

/**
 * Estimate billable hours from staff assignments (allocation fallback).
 * Used when no timesheet data is available for the period.
 * allocation_percentage represents the % of time allocated to a client.
 */
export function calculateBillableHoursFromAllocations(
  assignments: Array<{
    allocation_percentage: number;
    start_date: Date;
    end_date: Date | null;
  }>,
  periodStart: Date,
  periodEnd: Date,
  availableHours: number
): { billableHours: number; nonBillableHours: number; dataSource: 'ALLOCATION' } {
  // Sum active allocation percentages for the period
  let totalAllocationPct = 0;

  for (const assignment of assignments) {
    const assignmentStart = new Date(assignment.start_date);
    const assignmentEnd = assignment.end_date ? new Date(assignment.end_date) : periodEnd;

    // Check if assignment overlaps with the period
    if (assignmentStart > periodEnd || assignmentEnd < periodStart) {
      continue; // No overlap
    }

    totalAllocationPct += typeof assignment.allocation_percentage === 'number'
      ? assignment.allocation_percentage
      : Number(assignment.allocation_percentage);
  }

  // Cap at 100%
  totalAllocationPct = Math.min(totalAllocationPct, 100);

  const billableHours = Math.round((availableHours * totalAllocationPct / 100) * 100) / 100;

  return {
    billableHours,
    nonBillableHours: 0, // Can't determine non-billable from allocations alone
    dataSource: 'ALLOCATION' as const,
  };
}

/**
 * Calculate the utilization rate as a percentage.
 * utilization_rate = (billable_hours / available_hours) * 100
 * Returns 0 if available_hours is 0 (avoid division by zero).
 */
export function calculateUtilizationRate(
  billableHours: number,
  availableHours: number
): number {
  if (availableHours <= 0) return 0;
  const rate = (billableHours / availableHours) * 100;
  return Math.round(rate * 100) / 100; // Round to 2 decimal places
}

/**
 * Get period boundaries for a given date.
 * Returns { start, end } for the specified period type.
 */
export function getPeriodBoundaries(
  date: Date,
  periodType: 'weekly' | 'monthly'
): { start: Date; end: Date } {
  if (periodType === 'weekly') {
    // Week starts Monday
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Monday start
    const start = new Date(d.setDate(diff));
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  // Monthly
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}
