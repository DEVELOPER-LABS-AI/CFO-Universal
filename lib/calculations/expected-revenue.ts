import { prisma } from '@/lib/prisma';
import { type ServiceContract } from '@prisma/client';

/**
 * Helper: compare month/year pairs. Returns -1 if a < b, 0 if equal, 1 if a > b.
 */
function compareMonthYear(aMonth: number, aYear: number, bMonth: number, bYear: number): number {
  if (aYear !== bYear) return aYear < bYear ? -1 : 1;
  if (aMonth !== bMonth) return aMonth < bMonth ? -1 : 1;
  return 0;
}

/**
 * Check if a given month/year falls within a contract's active period.
 * - CONTRACT: between start and end (inclusive)
 * - PROJECT: matches the start month/year (single billing period)
 * - RETAINER: from start through end (if set) or current month (if no end)
 */
function isContractActiveForPeriod(
  contract: {
    billing_model: string;
    start_month: number;
    start_year: number;
    end_month: number | null;
    end_year: number | null;
  },
  month: number,
  year: number
): boolean {
  const afterStart = compareMonthYear(month, year, contract.start_month, contract.start_year) >= 0;

  if (contract.billing_model === 'PROJECT') {
    // PROJECT: single billing period at start month/year
    return contract.start_month === month && contract.start_year === year;
  }

  if (!afterStart) return false;

  if (contract.end_month && contract.end_year) {
    // Has an end date — check period is within range
    return compareMonthYear(month, year, contract.end_month, contract.end_year) <= 0;
  }

  // RETAINER with no end date: active from start through current month only
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  return compareMonthYear(month, year, currentMonth, currentYear) <= 0;
}

/**
 * Get the expected revenue amount from a contract for a given period.
 */
function getContractRevenueForPeriod(
  contract: {
    billing_model: string;
    monthly_rate: any;
    project_fee: any;
  }
): number {
  if (contract.billing_model === 'PROJECT') {
    return Number(contract.project_fee ?? 0);
  }
  // CONTRACT and RETAINER both use monthly_rate
  return Number(contract.monthly_rate ?? 0);
}

/**
 * Calculate expected revenue for a client in a given period.
 * Uses ServiceContract records as primary source, falls back to ServiceRateHistory.
 *
 * For each service assigned to the client:
 * 1. Check if any contract (ACTIVE or COMPLETED) covers this period
 * 2. If yes, use the contract rate
 * 3. If no contract, fall back to ServiceRateHistory for that service
 * 4. If no rate history, use current custom_rate or standard_rate
 */
export async function getExpectedRevenueForPeriod(
  clientId: string,
  month: number,
  year: number
): Promise<number> {
  // Get all client services
  const clientServices = await prisma.clientService.findMany({
    where: { client_id: clientId },
    include: { service: { select: { id: true, standard_rate: true } } },
  });

  if (clientServices.length === 0) return 0;

  // Get all contracts (ACTIVE + COMPLETED) for this client
  const contracts = await prisma.serviceContract.findMany({
    where: {
      client_id: clientId,
      status: { in: ['ACTIVE', 'COMPLETED'] },
    },
  });

  // Group contracts by service_id
  const contractsByService = new Map<string, typeof contracts>();
  for (const contract of contracts) {
    const list = contractsByService.get(contract.service_id) ?? [];
    list.push(contract);
    contractsByService.set(contract.service_id, list);
  }

  // Get rate history for fallback
  const rateHistory = await prisma.serviceRateHistory.findMany({
    where: {
      client_id: clientId,
      service_id: { in: clientServices.map((cs) => cs.service_id) },
    },
    orderBy: [{ effective_year: 'desc' }, { effective_month: 'desc' }],
  });

  const rateHistoryByService = new Map<string, typeof rateHistory>();
  for (const entry of rateHistory) {
    const list = rateHistoryByService.get(entry.service_id) ?? [];
    list.push(entry);
    rateHistoryByService.set(entry.service_id, list);
  }

  let totalExpected = 0;

  for (const cs of clientServices) {
    const serviceContracts = contractsByService.get(cs.service_id);

    // Check if any contract covers this period
    const activeContract = serviceContracts?.find((c) =>
      isContractActiveForPeriod(c, month, year)
    );

    if (activeContract) {
      totalExpected += getContractRevenueForPeriod(activeContract);
      continue;
    }

    // Fallback: use rate history
    const history = rateHistoryByService.get(cs.service_id);
    if (history && history.length > 0) {
      // Find the most recent entry that is effective on or before this period
      const applicableEntry = history.find(
        (h) => h.effective_year < year || (h.effective_year === year && h.effective_month <= month)
      );
      if (applicableEntry) {
        totalExpected += Number(applicableEntry.rate);
        continue;
      }
    }

    // Final fallback: current custom_rate or standard_rate
    totalExpected += cs.custom_rate
      ? Number(cs.custom_rate)
      : Number(cs.service.standard_rate);
  }

  return totalExpected;
}

/**
 * Calculate expected revenue for a client across all historical periods.
 * Gathers periods from: ROI records, payment allocations, and contracts.
 * Returns per-period breakdown sorted chronologically.
 */
export async function getExpectedRevenueAllPeriods(
  clientId: string,
  organizationId: string
): Promise<Array<{ month: number; year: number; expectedRevenue: number }>> {
  // Collect all unique periods from multiple sources
  const periodSet = new Set<string>();

  // Source 1: ClientROI records
  const roiRecords = await prisma.clientROI.findMany({
    where: { client_id: clientId },
    select: { month: true, year: true },
  });
  for (const r of roiRecords) {
    periodSet.add(`${r.year}-${r.month}`);
  }

  // Source 2: Payment allocations
  const allocations = await prisma.paymentAllocation.findMany({
    where: { cash_receipt: { client_id: clientId } },
    select: { period_month: true, period_year: true },
    distinct: ['period_month', 'period_year'],
  });
  for (const a of allocations) {
    periodSet.add(`${a.period_year}-${a.period_month}`);
  }

  // Source 3: Contract periods (expand contract ranges into individual months)
  const contracts = await prisma.serviceContract.findMany({
    where: {
      client_id: clientId,
      status: { in: ['ACTIVE', 'COMPLETED'] },
    },
    select: {
      billing_model: true,
      start_month: true,
      start_year: true,
      end_month: true,
      end_year: true,
    },
  });

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  for (const c of contracts) {
    if (c.billing_model === 'PROJECT') {
      periodSet.add(`${c.start_year}-${c.start_month}`);
      continue;
    }

    // Expand month range for CONTRACT and RETAINER
    let m = c.start_month;
    let y = c.start_year;
    const endM = c.end_month ?? currentMonth;
    const endY = c.end_year ?? currentYear;

    let iterations = 0;
    while (compareMonthYear(m, y, endM, endY) <= 0 && iterations < 120) {
      // Don't project past current month for retainers
      if (c.billing_model === 'RETAINER' && !c.end_month) {
        if (compareMonthYear(m, y, currentMonth, currentYear) > 0) break;
      }
      periodSet.add(`${y}-${m}`);
      m++;
      if (m > 12) { m = 1; y++; }
      iterations++;
    }
  }

  // Parse and sort periods chronologically
  const periods = Array.from(periodSet).map((key) => {
    const [yearStr, monthStr] = key.split('-');
    return { month: parseInt(monthStr, 10), year: parseInt(yearStr, 10) };
  });
  periods.sort((a, b) => compareMonthYear(a.month, a.year, b.month, b.year));

  // Calculate expected revenue for each period
  const results: Array<{ month: number; year: number; expectedRevenue: number }> = [];
  for (const p of periods) {
    const expectedRevenue = await getExpectedRevenueForPeriod(clientId, p.month, p.year);
    results.push({ month: p.month, year: p.year, expectedRevenue });
  }

  return results;
}

/**
 * Check if a proposed contract overlaps with any existing ACTIVE contracts
 * for the same client-service pair.
 *
 * Two date ranges overlap if: rangeA.start <= rangeB.end AND rangeA.end >= rangeB.start
 * For open-ended ranges (no end date), treat end as infinity.
 */
export async function checkContractOverlap(
  clientId: string,
  serviceId: string,
  startMonth: number,
  startYear: number,
  endMonth: number | null,
  endYear: number | null,
  excludeContractId?: string
): Promise<{ overlaps: boolean; conflictingContract?: ServiceContract }> {
  const activeContracts = await prisma.serviceContract.findMany({
    where: {
      client_id: clientId,
      service_id: serviceId,
      status: 'ACTIVE',
      ...(excludeContractId ? { id: { not: excludeContractId } } : {}),
    },
    include: { service: { select: { name: true } } },
  });

  for (const existing of activeContracts) {
    const existingStartMonth = existing.start_month;
    const existingStartYear = existing.start_year;
    const existingEndMonth = existing.end_month;
    const existingEndYear = existing.end_year;

    // Check overlap: two ranges overlap if start_a <= end_b AND end_a >= start_b
    // For open-ended contracts (no end date), treat as extending to infinity

    // Does the proposed range start before or when the existing range ends?
    const proposedStartsBeforeExistingEnds =
      existingEndMonth === null || existingEndYear === null
        ? true // Existing has no end → always true
        : compareMonthYear(startMonth, startYear, existingEndMonth, existingEndYear) <= 0;

    // Does the proposed range end after or when the existing range starts?
    const proposedEndsAfterExistingStarts =
      endMonth === null || endYear === null
        ? true // Proposed has no end → always true
        : compareMonthYear(endMonth, endYear, existingStartMonth, existingStartYear) >= 0;

    if (proposedStartsBeforeExistingEnds && proposedEndsAfterExistingStarts) {
      return { overlaps: true, conflictingContract: existing };
    }
  }

  return { overlaps: false };
}
