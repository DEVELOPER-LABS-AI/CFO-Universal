/**
 * Agency Cost Calculations
 *
 * Provides functions to:
 * - Get actual agency spend from linked Mercury transactions (source of truth)
 * - Apportion agency staff costs to specific clients using StaffAssignment.allocation_percentage
 * - Support client ROI calculation with agency cost line items
 */

import { prisma } from '@/lib/prisma';
import type { StaffBreakdownItem } from '@/lib/validations/agency';
import { getEffectiveAllocationsForMonth, resolveAllocation } from './allocation-utils';

/**
 * Get the actual Mercury-derived spend for an agency in a given month.
 * Sums all ExpenseRecord amounts where agency_id matches and transaction_date
 * falls within the calendar month.
 *
 * @param agencyId - Agency UUID
 * @param month - 1-12
 * @param year - Full year (e.g. 2025)
 * @param organizationId - Organization UUID
 * @returns Total Mercury spend as a number (0 if no transactions linked)
 */
export async function getAgencyMercuryCost(
  agencyId: string,
  month: number,
  year: number,
  organizationId: string
): Promise<number> {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1); // Exclusive upper bound

  const result = await prisma.expenseRecord.aggregate({
    where: {
      organization_id: organizationId,
      agency_id: agencyId,
      is_credit: false,
      transaction_date: {
        gte: startDate,
        lt: endDate,
      },
    },
    _sum: {
      amount: true,
    },
  });

  return Number(result._sum.amount ?? 0);
}

/**
 * Get the total agency staff cost attributed to a specific client for a given month.
 *
 * Uses the AgencyMonthlyBreakdown JSONB (staff[].subtotal) and each staff member's
 * active StaffAssignment.allocation_percentage for the client.
 *
 * Formula: client_cost += staff.subtotal × (allocation_percentage / 100)
 *
 * @param agencyId - Agency UUID
 * @param clientId - Client UUID
 * @param month - 1-12
 * @param year - Full year
 * @returns Portion of agency staff cost attributed to this client
 */
export async function getAgencyStaffCostForClient(
  agencyId: string,
  clientId: string,
  month: number,
  year: number
): Promise<number> {
  // Load the monthly breakdown for this agency/month/year
  const breakdown = await prisma.agencyMonthlyBreakdown.findUnique({
    where: {
      agency_id_month_year: {
        agency_id: agencyId,
        month,
        year,
      },
    },
    select: { breakdown: true },
  });

  if (!breakdown) {
    return 0;
  }

  const breakdownData = breakdown.breakdown as {
    staff?: StaffBreakdownItem[];
    services?: { name: string; description?: string; amount: number }[];
  };

  const staffItems = breakdownData.staff ?? [];

  if (staffItems.length === 0) {
    return 0;
  }

  // Load active StaffAssignments for this client, for staff belonging to this agency
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 1);

  const assignments = await prisma.staffAssignment.findMany({
    where: {
      client_id: clientId,
      staff: {
        agency_id: agencyId,
        deleted_at: null,
      },
      start_date: { lt: endOfMonth },
      OR: [{ end_date: null }, { end_date: { gte: startOfMonth } }],
    },
    select: {
      id: true,
      staff_id: true,
      allocation_percentage: true,
    },
  });

  // Resolve effective allocations (handles monthly overrides)
  const overrideMap = await getEffectiveAllocationsForMonth(
    assignments.map((a) => a.id),
    month,
    year
  );

  // Build a quick lookup: staff_id → effective allocation_percentage
  // Note: if a staff member has multiple assignments (project + retainer), sum them
  const allocationMap = new Map<string, number>();
  for (const a of assignments) {
    const effective = resolveAllocation(a.id, Number(a.allocation_percentage), overrideMap);
    const current = allocationMap.get(a.staff_id) ?? 0;
    allocationMap.set(a.staff_id, current + effective);
  }

  // For each staff item in the breakdown, apply this client's allocation fraction
  let clientShare = 0;
  for (const staffItem of staffItems) {
    const allocationPct = allocationMap.get(staffItem.staff_id) ?? 0;
    if (allocationPct > 0) {
      clientShare += staffItem.subtotal * (allocationPct / 100);
    }
  }

  return clientShare;
}

/**
 * Get the unique agency IDs that have AGENCY_STAFF currently assigned to a client.
 * Used by calculateClientCosts() to know which agencies to query.
 *
 * @param clientId - Client UUID
 * @param month - 1-12
 * @param year - Full year
 * @returns Array of unique agency UUIDs
 */
export async function getAgenciesForClient(
  clientId: string,
  month: number,
  year: number
): Promise<string[]> {
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 1);

  const assignments = await prisma.staffAssignment.findMany({
    where: {
      client_id: clientId,
      staff: {
        deleted_at: null,
        agency_id: { not: null },
      },
      start_date: { lt: endOfMonth },
      OR: [{ end_date: null }, { end_date: { gte: startOfMonth } }],
    },
    select: {
      staff: { select: { agency_id: true } },
    },
  });

  const agencyIds = [
    ...new Set(
      assignments
        .map((a) => a.staff.agency_id)
        .filter((id): id is string => id !== null)
    ),
  ];

  return agencyIds;
}

/**
 * Get average monthly Mercury spend for all agencies in the organization.
 * Groups ExpenseRecords by agency_id and month, then averages across months
 * that have transactions (zero-months are excluded from the average).
 *
 * @param organizationId - Organization UUID
 * @returns Map of agency_id -> { avgMonthlySpend, monthCount, totalSpend }
 */
export async function getAllAgencyAvgMonthlySpend(
  organizationId: string
): Promise<Map<string, { avgMonthlySpend: number; monthCount: number; totalSpend: number }>> {
  const records = await prisma.expenseRecord.findMany({
    where: {
      organization_id: organizationId,
      agency_id: { not: null },
      is_credit: false,
    },
    select: {
      agency_id: true,
      amount: true,
      transaction_date: true,
    },
  });

  // Group by agency_id + year-month
  const agencyMonths = new Map<string, Map<string, number>>();
  for (const record of records) {
    const agencyId = record.agency_id!;
    const monthKey = `${record.transaction_date.getFullYear()}-${record.transaction_date.getMonth() + 1}`;

    if (!agencyMonths.has(agencyId)) {
      agencyMonths.set(agencyId, new Map());
    }
    const months = agencyMonths.get(agencyId)!;
    months.set(monthKey, (months.get(monthKey) ?? 0) + Number(record.amount));
  }

  // Average across months per agency
  const result = new Map<string, { avgMonthlySpend: number; monthCount: number; totalSpend: number }>();
  for (const [agencyId, months] of agencyMonths) {
    const monthCount = months.size;
    const totalSpend = [...months.values()].reduce((sum, v) => sum + v, 0);
    result.set(agencyId, {
      avgMonthlySpend: monthCount > 0 ? totalSpend / monthCount : 0,
      monthCount,
      totalSpend,
    });
  }

  return result;
}
