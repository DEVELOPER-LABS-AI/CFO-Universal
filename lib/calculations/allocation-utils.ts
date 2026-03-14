import { prisma } from '@/lib/prisma';

/**
 * Get the effective allocation percentage for a staff assignment in a specific month.
 * Checks for a MonthlyAllocationOverride first; falls back to the base allocation_percentage.
 *
 * @param assignmentId - StaffAssignment UUID
 * @param baseAllocation - The assignment's default allocation_percentage (avoids re-query)
 * @param month - 1-12
 * @param year - Full year (e.g. 2026)
 * @returns Effective allocation percentage as a number (0-100)
 */
export async function getEffectiveAllocation(
  assignmentId: string,
  baseAllocation: number,
  month: number,
  year: number
): Promise<number> {
  const override = await prisma.monthlyAllocationOverride.findUnique({
    where: {
      assignment_id_month_year: {
        assignment_id: assignmentId,
        month,
        year,
      },
    },
    select: { allocation_percentage: true },
  });

  return override ? Number(override.allocation_percentage) : baseAllocation;
}

/**
 * Batch version: get effective allocations for multiple assignments in a single month.
 * Performs one query instead of N queries. Returns a map of assignmentId -> override value.
 * For assignments not in the map, use the base allocation_percentage.
 *
 * @param assignmentIds - Array of StaffAssignment UUIDs
 * @param month - 1-12
 * @param year - Full year (e.g. 2026)
 * @returns Map of assignmentId -> overridden allocation percentage (only entries with overrides)
 */
export async function getEffectiveAllocationsForMonth(
  assignmentIds: string[],
  month: number,
  year: number
): Promise<Map<string, number>> {
  if (assignmentIds.length === 0) return new Map();

  const overrides = await prisma.monthlyAllocationOverride.findMany({
    where: {
      assignment_id: { in: assignmentIds },
      month,
      year,
    },
    select: { assignment_id: true, allocation_percentage: true },
  });

  const map = new Map<string, number>();
  for (const o of overrides) {
    map.set(o.assignment_id, Number(o.allocation_percentage));
  }
  return map;
}

/**
 * Resolve the effective allocation for an assignment, given a preloaded override map.
 * Convenience function to avoid repeated map lookups with fallback logic.
 *
 * @param assignmentId - StaffAssignment UUID
 * @param baseAllocation - The assignment's default allocation_percentage
 * @param overrideMap - Map from getEffectiveAllocationsForMonth
 * @returns Effective allocation percentage as a number (0-100)
 */
export function resolveAllocation(
  assignmentId: string,
  baseAllocation: number,
  overrideMap: Map<string, number>
): number {
  return overrideMap.get(assignmentId) ?? baseAllocation;
}
