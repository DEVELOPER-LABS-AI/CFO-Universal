import { prisma } from '@/lib/prisma';
import { toMonthlyCost } from '@/lib/utils/currency';

/**
 * Resolves the monthly cost for a staff member by ID.
 * Normalizes the rate using toMonthlyCost based on the staff member's rate_type.
 * @param staffId - The unique identifier of the staff member.
 * @returns The normalized monthly cost, or 0 if the staff member is not found.
 */
export async function resolveStaffMonthlyCost(staffId: string): Promise<number> {
  const staff = await prisma.staff.findUnique({
    where: { id: staffId },
  });

  if (!staff) {
    return 0;
  }

  return toMonthlyCost(Number(staff.rate), staff.rate_type);
}

/**
 * Resolves the monthly cost for a contractor by ID.
 * Normalizes the rate using toMonthlyCost based on the contractor's rate_type.
 * @param contractorId - The unique identifier of the contractor.
 * @returns The normalized monthly cost, or 0 if the contractor is not found or has no rate/rate_type.
 */
export async function resolveContractorMonthlyCost(contractorId: string): Promise<number> {
  const contractor = await prisma.contractor.findUnique({
    where: { id: contractorId },
  });

  if (!contractor || !contractor.rate || !contractor.rate_type) {
    return 0;
  }

  return toMonthlyCost(Number(contractor.rate), contractor.rate_type);
}

/**
 * Resolves the monthly cost for a subscription by ID.
 * Checks Mercury transaction records for actual spend first, falls back to
 * the static total_cost field, then normalizes to monthly based on billing_frequency.
 * @param subscriptionId - The unique identifier of the subscription.
 * @returns The normalized monthly cost, or 0 if the subscription is not found.
 */
export async function resolveSubscriptionMonthlyCost(subscriptionId: string): Promise<number> {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
  });

  if (!subscription) {
    return 0;
  }

  // Check Mercury transaction records for the latest period's actual cost
  const latestPeriod = await prisma.subscriptionTransactionRecord.groupBy({
    by: ['period_month', 'period_year'],
    where: { subscription_id: subscriptionId },
    _sum: { amount: true },
    orderBy: [{ period_year: 'desc' }, { period_month: 'desc' }],
    take: 1,
  });

  const txCost = latestPeriod.length > 0 ? Number(latestPeriod[0]._sum.amount || 0) : 0;
  const rawCost = txCost > 0 ? txCost : Number(subscription.total_cost);

  // Normalize based on billing frequency (ANNUAL, QUARTERLY, MONTHLY)
  // Note: toMonthlyCost handles staff rate types (HOURLY/DAILY/MONTHLY),
  // so we handle subscription billing frequencies directly here.
  switch (subscription.billing_frequency) {
    case 'ANNUAL':
      return rawCost / 12;
    case 'QUARTERLY':
      return rawCost / 3;
    case 'MONTHLY':
    default:
      return rawCost;
  }
}

/**
 * Calculates aggregated project costs for a given month and year.
 * Fetches all active allocations for the project within the specified period,
 * resolves the monthly cost for each allocation based on its cost_source_type,
 * and aggregates costs by category.
 *
 * @param projectId - The unique identifier of the project.
 * @param month - The month (1-12).
 * @param year - The four-digit year.
 * @returns An object containing subscription_costs, staff_costs, contractor_costs,
 *          other_costs, and total_costs for the specified period.
 */
export async function calculateProjectCosts(
  projectId: string,
  month: number,
  year: number
): Promise<{
  subscription_costs: number;
  staff_costs: number;
  contractor_costs: number;
  other_costs: number;
  total_costs: number;
}> {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  const allocations = await prisma.projectCostAllocation.findMany({
    where: {
      project_id: projectId,
      effective_start_date: { lte: endDate },
      OR: [
        { effective_end_date: null },
        { effective_end_date: { gte: startDate } },
      ],
    },
  });

  let subscriptionCosts = 0;
  let staffCosts = 0;
  let contractorCosts = 0;
  let otherCosts = 0;

  for (const allocation of allocations) {
    const allocationPercentage = Number(allocation.allocation_percentage) / 100;

    switch (allocation.cost_source_type) {
      case 'STAFF': {
        const monthlyCost = await resolveStaffMonthlyCost(allocation.cost_source_id);
        staffCosts += monthlyCost * allocationPercentage;
        break;
      }
      case 'CONTRACTOR': {
        const monthlyCost = await resolveContractorMonthlyCost(allocation.cost_source_id);
        contractorCosts += monthlyCost * allocationPercentage;
        break;
      }
      case 'SUBSCRIPTION': {
        const monthlyCost = await resolveSubscriptionMonthlyCost(allocation.cost_source_id);
        subscriptionCosts += monthlyCost * allocationPercentage;
        break;
      }
      case 'OTHER': {
        otherCosts += Number(allocation.fixed_amount) || 0;
        break;
      }
    }
  }

  const totalCosts = subscriptionCosts + staffCosts + contractorCosts + otherCosts;

  return {
    subscription_costs: subscriptionCosts,
    staff_costs: staffCosts,
    contractor_costs: contractorCosts,
    other_costs: otherCosts,
    total_costs: totalCosts,
  };
}
