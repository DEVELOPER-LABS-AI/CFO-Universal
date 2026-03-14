import { prisma } from '@/lib/prisma';
import { toMonthlyCost } from '@/lib/utils/currency';
import { getAgenciesForClient, getAgencyStaffCostForClient } from './agency-costs';
import { getEffectiveAllocationsForMonth, resolveAllocation } from './allocation-utils';

// T123: Get client revenue from PaymentAllocations (period-aware) + Xero invoices
export async function getClientRevenue(
  clientId: string,
  month: number,
  year: number
): Promise<number> {
  // Primary: Revenue from payment allocations assigned to this period
  // This correctly handles multi-period deposits (e.g. $23,400 split across 2 months)
  const allocations = await prisma.paymentAllocation.aggregate({
    where: {
      cash_receipt: { client_id: clientId },
      period_month: month,
      period_year: year,
    },
    _sum: { amount: true },
  });

  const mercuryRevenue = Number(allocations._sum.amount ?? 0);

  // Secondary: Xero invoice records for the same period
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0); // Last day of month

  const xeroRecords = await prisma.revenueRecord.aggregate({
    where: {
      client_id: clientId,
      transaction_date: {
        gte: startDate,
        lte: endDate,
      },
    },
    _sum: { amount: true },
  });

  const xeroRevenue = Number(xeroRecords._sum.amount ?? 0);

  // Use whichever source has data; if both exist, use the higher value
  // (Mercury = actual cash received via allocations, Xero = invoiced amounts)
  return Math.max(mercuryRevenue, xeroRevenue);
}

// T124: Calculate total client costs from all sources
// Uses actual Mercury expense data as primary source, falls back to configured rates
export async function calculateClientCosts(
  clientId: string,
  month: number,
  year: number,
  organizationId: string
): Promise<{
  bdrCosts: number;
  contractorCosts: number;
  subscriptionCosts: number;
  serviceCosts: number;
  agencyCosts: number;
  otherCosts: number;
  totalCosts: number;
}> {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  // ---------- Actual Mercury expense data (primary source) ----------

  // First resolve which contractors and agencies serve this client
  const contractorIdsForClient = (await prisma.contractorAssignment.findMany({
    where: {
      client_id: clientId,
      OR: [{ end_date: null }, { end_date: { gte: startDate } }],
      start_date: { lte: endDate },
    },
    select: { contractor_id: true },
  })).map((a) => a.contractor_id);

  const agencyIdsForClient = await getAgenciesForClient(clientId, month, year);

  // Build OR conditions for expenses related to this client
  // NOTE: Agency IDs intentionally excluded — agency expenses have their own dedicated
  // cost path (getAgencyStaffCostForClient at line 127+). Including them here would
  // double-count agency payments in mercuryOtherCosts.
  const expenseOrConditions: any[] = [{ client_id: clientId }];
  if (contractorIdsForClient.length > 0) {
    expenseOrConditions.push({ contractor_id: { in: contractorIdsForClient } });
  }

  // Get Mercury expenses grouped by category for this client's entities
  const mercuryExpensesByCategory = await prisma.expenseRecord.groupBy({
    by: ['category'],
    where: {
      organization_id: organizationId,
      is_credit: false,
      transaction_date: { gte: startDate, lte: endDate },
      OR: expenseOrConditions,
    },
    _sum: { amount: true },
  });

  // Map Mercury categories to cost buckets
  let mercuryContractorCosts = 0;
  let mercurySubscriptionCosts = 0;
  let mercuryOtherCosts = 0;

  for (const row of mercuryExpensesByCategory) {
    const amount = Number(row._sum.amount ?? 0);
    switch (row.category) {
      case 'CONTRACTOR_COST':
        mercuryContractorCosts += amount;
        break;
      case 'SUBSCRIPTION':
      case 'TOOLS':
        mercurySubscriptionCosts += amount;
        break;
      case 'PAYROLL':
      case 'OVERHEAD':
      case 'MARKETING':
      case 'OTHER':
        mercuryOtherCosts += amount;
        break;
    }
  }

  // Get agency-specific Mercury expenses and use allocation-based costing
  let mercuryAgencyCosts = 0;
  if (agencyIdsForClient.length > 0) {
    const agencyExpenses = await prisma.expenseRecord.aggregate({
      where: {
        organization_id: organizationId,
        agency_id: { in: agencyIdsForClient },
        is_credit: false,
        transaction_date: { gte: startDate, lte: endDate },
      },
      _sum: { amount: true },
    });
    const totalAgencyMercury = Number(agencyExpenses._sum.amount ?? 0);
    if (totalAgencyMercury > 0) {
      const agencyStaffCosts = await Promise.all(
        agencyIdsForClient.map((id) => getAgencyStaffCostForClient(id, clientId, month, year))
      );
      mercuryAgencyCosts = agencyStaffCosts.reduce((sum, c) => sum + c, 0);
    }
  }

  // ---------- Configured rate-based costs (fallback) ----------

  // 1. Staff Costs from StaffAssignment rates (all staff types: BDR, admin, owner, etc.)
  const staffAssignments = await prisma.staffAssignment.findMany({
    where: {
      client_id: clientId,
      staff: { organization_id: organizationId },
      OR: [{ end_date: null }, { end_date: { gte: startDate } }],
      start_date: { lte: endDate },
    },
    include: { staff: true },
  });

  // Resolve effective allocation for each staff assignment (handles monthly overrides)
  const staffOverrideMap = await getEffectiveAllocationsForMonth(
    staffAssignments.map((a) => a.id),
    month,
    year
  );

  let configuredBdrCosts = staffAssignments.reduce((sum, a) => {
    const rate = Number(a.staff.rate);
    const rateType = a.staff.rate_type ?? 'MONTHLY';
    const effectiveAllocation = resolveAllocation(a.id, Number(a.allocation_percentage), staffOverrideMap);
    return sum + toMonthlyCost(rate, rateType) * (effectiveAllocation / 100);
  }, 0);

  for (const assignment of staffAssignments) {
    const effectiveAllocation = resolveAllocation(assignment.id, Number(assignment.allocation_percentage), staffOverrideMap);
    const frac = effectiveAllocation / 100;
    const bonuses = await prisma.staffBonus.findMany({
      where: { staff_id: assignment.staff_id, month, year, is_approved: true },
    });
    configuredBdrCosts += bonuses.reduce((s, b) => s + Number(b.amount), 0) * frac;
  }

  // 2. Contractor Costs from ContractorAssignment rates
  const contractorAssignments = await prisma.contractorAssignment.findMany({
    where: {
      client_id: clientId,
      contractor: { organization_id: organizationId },
      OR: [{ end_date: null }, { end_date: { gte: startDate } }],
      start_date: { lte: endDate },
    },
    include: { contractor: true },
  });

  const configuredContractorCosts = contractorAssignments.reduce((sum, a) => {
    const rate = a.contractor.rate != null ? Number(a.contractor.rate) : 0;
    const rateType = a.contractor.rate_type ?? 'MONTHLY';
    return sum + toMonthlyCost(rate, rateType) * (Number(a.allocation_percentage) / 100);
  }, 0);

  // 3. Subscription Costs from SubscriptionAllocation
  const subscriptionAllocations = await prisma.subscriptionAllocation.findMany({
    where: {
      client_id: clientId,
      subscription: { organization_id: organizationId, is_active: true },
    },
  });

  const configuredSubscriptionCosts = subscriptionAllocations.reduce(
    (sum, alloc) => sum + Number(alloc.cost_allocated), 0
  );

  // 4. Service Costs from ClientService (with rate history support)
  const clientServices = await prisma.clientService.findMany({
    where: {
      client_id: clientId,
      service: { organization_id: organizationId, is_active: true },
    },
    include: { service: true },
  });

  // Look up rate history for all client services to find the rate in effect for this period
  const rateHistoryEntries = await prisma.serviceRateHistory.findMany({
    where: {
      client_id: clientId,
      service_id: { in: clientServices.map((cs) => cs.service_id) },
    },
    orderBy: [{ effective_year: 'desc' }, { effective_month: 'desc' }],
  });

  // Group rate history by service_id
  const rateHistoryByService = new Map<string, typeof rateHistoryEntries>();
  for (const entry of rateHistoryEntries) {
    const list = rateHistoryByService.get(entry.service_id) ?? [];
    list.push(entry);
    rateHistoryByService.set(entry.service_id, list);
  }

  const serviceCosts = clientServices.reduce((sum, cs) => {
    const fallbackRate = cs.custom_rate ? Number(cs.custom_rate) : Number(cs.service.standard_rate);
    const history = rateHistoryByService.get(cs.service_id);
    if (!history || history.length === 0) {
      return sum + fallbackRate;
    }
    // Find the most recent rate entry on or before the target period
    // History is sorted desc, so first match is the most recent applicable entry
    const applicableEntry = history.find(
      (h) => h.effective_year < year || (h.effective_year === year && h.effective_month <= month)
    );
    const rate = applicableEntry ? Number(applicableEntry.rate) : fallbackRate;
    return sum + rate;
  }, 0);

  // 5. Agency Costs from AgencyMonthlyBreakdown
  const configuredAgencyCosts = agencyIdsForClient.length > 0
    ? (await Promise.all(
        agencyIdsForClient.map((id) => getAgencyStaffCostForClient(id, clientId, month, year))
      )).reduce((sum, c) => sum + c, 0)
    : 0;

  // ---------- Use whichever source has more data per category ----------
  const bdrCosts = configuredBdrCosts;  // BDRs don't have Mercury category
  const contractorCosts = Math.max(mercuryContractorCosts, configuredContractorCosts);
  const subscriptionCosts = Math.max(mercurySubscriptionCosts, configuredSubscriptionCosts);
  const agencyCosts = Math.max(mercuryAgencyCosts, configuredAgencyCosts);

  const otherCosts = mercuryOtherCosts;
  // serviceCosts = what we BILL the client (revenue-side), not an internal cost
  // Only internal costs contribute to totalCosts
  const totalCosts = bdrCosts + contractorCosts + subscriptionCosts + agencyCosts + otherCosts;

  return {
    bdrCosts,
    contractorCosts,
    subscriptionCosts,
    serviceCosts,
    agencyCosts,
    otherCosts,
    totalCosts,
  };
}
