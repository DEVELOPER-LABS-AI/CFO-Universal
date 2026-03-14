import { prisma } from '@/lib/prisma';
import { getClientRevenue } from './client-roi';
import { getEffectiveAllocationsForMonth, resolveAllocation } from './allocation-utils';

// T139: Calculate attributed revenue for a BDR
// Revenue attribution: for each client assignment, get client_revenue × (allocation_percentage / 100), sum all
export async function calculateAttributedRevenue(
  bdrId: string,
  month: number,
  year: number
): Promise<number> {
  // Get all active assignments for this BDR in the specified period
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  const assignments = await prisma.staffAssignment.findMany({
    where: {
      staff_id: bdrId,
      OR: [
        { end_date: null },
        { end_date: { gte: startDate } },
      ],
      start_date: { lte: endDate },
    },
    include: {
      client: true,
    },
  });

  // Resolve effective allocation for each assignment (handles monthly overrides)
  const overrideMap = await getEffectiveAllocationsForMonth(
    assignments.map((a) => a.id),
    month,
    year
  );

  let totalAttributedRevenue = 0;

  for (const assignment of assignments) {
    // Get client revenue for this month
    const clientRevenue = await getClientRevenue(assignment.client_id, month, year);

    // Calculate attributed portion based on effective allocation percentage
    const effectiveAllocation = resolveAllocation(assignment.id, Number(assignment.allocation_percentage), overrideMap);
    const allocationFraction = effectiveAllocation / 100;
    const attributedRevenue = clientRevenue * allocationFraction;

    totalAttributedRevenue += attributedRevenue;
  }

  return totalAttributedRevenue;
}

/**
 * Calculate total BDR cost for a period: base salary + approved bonuses.
 */
export async function calculateBDRTotalCost(
  bdrId: string,
  month: number,
  year: number
): Promise<{ baseCost: number; bonusCost: number; totalCost: number }> {
  const bdr = await prisma.staff.findUnique({
    where: { id: bdrId },
    select: { rate: true },
  });

  const baseCost = bdr ? Number(bdr.rate) : 0;

  const approvedBonuses = await prisma.staffBonus.findMany({
    where: {
      staff_id: bdrId,
      month,
      year,
      is_approved: true,
    },
  });

  const bonusCost = approvedBonuses.reduce(
    (sum, bonus) => sum + Number(bonus.amount), 0
  );

  return { baseCost, bonusCost, totalCost: baseCost + bonusCost };
}

// T142: Get total meetings attended for a BDR in the specified period
export async function getTotalMeetingsAttended(
  bdrId: string,
  month: number,
  year: number
): Promise<number> {
  const metrics = await prisma.bDRProductivityMetric.findMany({
    where: {
      bdr_id: bdrId,
      month,
      year,
    },
  });

  return metrics.reduce((sum, metric) => sum + metric.meetings_attended, 0);
}
