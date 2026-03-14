/**
 * Overhead Cost Allocation
 *
 * Calculates the total overhead pool from internal clients (e.g. Developer Labs AI)
 * and distributes it across active external clients weighted by their revenue share.
 *
 * When includeOwnerPay is false, owner staff costs (engagement_type = OWNER) are
 * excluded from the overhead pool.
 */

import { prisma } from '@/lib/prisma';
import { calculateClientCosts } from './client-roi';
import { getEffectiveAllocationsForMonth, resolveAllocation } from './allocation-utils';

/**
 * Calculate revenue-weighted overhead allocation for all active external clients.
 *
 * @param organizationId - Organization UUID
 * @param month - 1-12
 * @param year - Full year
 * @param includeOwnerPay - Whether to include owner compensation in the overhead pool
 * @returns Map of clientId → allocated overhead amount
 */
export async function calculateOverheadAllocation(
  organizationId: string,
  month: number,
  year: number,
  includeOwnerPay: boolean
): Promise<Map<string, number>> {
  const result = new Map<string, number>();

  // 1. Find all internal clients for this org
  const internalClients = await prisma.client.findMany({
    where: {
      organization_id: organizationId,
      is_internal: true,
      deleted_at: null,
    },
    select: { id: true },
  });

  if (internalClients.length === 0) {
    return result;
  }

  // 2. Calculate total costs for each internal client
  let totalOverheadPool = 0;

  for (const client of internalClients) {
    const costs = await calculateClientCosts(client.id, month, year, organizationId);
    totalOverheadPool += costs.totalCosts;
  }

  // 3. If excluding owner pay, subtract owner staff costs
  if (!includeOwnerPay) {
    const ownerCosts = await getOwnerStaffCosts(organizationId, internalClients.map((c) => c.id), month, year);
    totalOverheadPool -= ownerCosts;
  }

  if (totalOverheadPool <= 0) {
    return result;
  }

  // 4. Get revenues for all active external clients
  const externalClients = await prisma.client.findMany({
    where: {
      organization_id: organizationId,
      is_internal: false,
      status: 'ACTIVE',
      deleted_at: null,
    },
    select: { id: true },
  });

  if (externalClients.length === 0) {
    return result;
  }

  const externalClientIds = externalClients.map((c) => c.id);

  // Batch-load revenues from Mercury cash receipts
  const revenueByClient = await prisma.clientCashReceipt.groupBy({
    by: ['client_id'],
    where: {
      client_id: { in: externalClientIds },
      organization_id: organizationId,
      period_month: month,
      period_year: year,
    },
    _sum: { amount: true },
  });

  const revenueMap = new Map<string, number>();
  let totalRevenue = 0;

  for (const row of revenueByClient) {
    const amount = Number(row._sum.amount ?? 0);
    if (amount > 0) {
      revenueMap.set(row.client_id, amount);
      totalRevenue += amount;
    }
  }

  if (totalRevenue <= 0) {
    // If no revenue data, fall back to equal split across all external clients
    const equalShare = totalOverheadPool / externalClientIds.length;
    for (const clientId of externalClientIds) {
      result.set(clientId, equalShare);
    }
    return result;
  }

  // 5. Distribute overhead proportionally by revenue share
  for (const [clientId, revenue] of revenueMap) {
    const share = revenue / totalRevenue;
    result.set(clientId, totalOverheadPool * share);
  }

  return result;
}

/**
 * Calculate total costs of owner staff assigned to internal clients.
 * Used to subtract owner pay when the toggle is off.
 */
async function getOwnerStaffCosts(
  organizationId: string,
  internalClientIds: string[],
  month: number,
  year: number
): Promise<number> {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  const ownerAssignments = await prisma.staffAssignment.findMany({
    where: {
      client_id: { in: internalClientIds },
      staff: {
        organization_id: organizationId,
        engagement_type: 'OWNER',
        deleted_at: null,
      },
      OR: [{ end_date: null }, { end_date: { gte: startDate } }],
      start_date: { lte: endDate },
    },
    include: { staff: true },
  });

  // Resolve effective allocations (handles monthly overrides)
  const overrideMap = await getEffectiveAllocationsForMonth(
    ownerAssignments.map((a) => a.id),
    month,
    year
  );

  let ownerCosts = 0;
  for (const assignment of ownerAssignments) {
    const effectiveAllocation = resolveAllocation(assignment.id, Number(assignment.allocation_percentage), overrideMap);
    ownerCosts += Number(assignment.staff.rate) * (effectiveAllocation / 100);

    // Include approved bonuses
    const bonuses = await prisma.staffBonus.findMany({
      where: { staff_id: assignment.staff_id, month, year, is_approved: true },
    });
    const frac = effectiveAllocation / 100;
    ownerCosts += bonuses.reduce((s, b) => s + Number(b.amount), 0) * frac;
  }

  return ownerCosts;
}
