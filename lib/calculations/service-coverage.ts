import { prisma } from '@/lib/prisma';

type CoverageStatus = 'COVERED' | 'WARNING' | 'PAST_DUE' | 'SUSPENDED';

interface ServiceCoverageResult {
  monthlyServiceCost: number;
  totalPaid: number;
  totalExpected: number;
  coveredThrough: { month: number; year: number } | null;
  monthsRemaining: number;
  creditBalance: number;
  status: CoverageStatus;
  daysUntilShutoff: number | null;
  gracePeriodDays: number;
  warningDays: number;
}

/**
 * Calculates service coverage status for a client.
 *
 * Walks forward from the client's start date month by month:
 * - Compares allocated revenue per period vs expected service cost
 * - Tracks surplus/deficit and carries forward credit
 * - Determines how many months of service remain
 */
export async function getServiceCoverage(
  clientId: string,
  organizationId: string
): Promise<ServiceCoverageResult> {
  // 1. Get org settings
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { service_grace_period_days: true, service_warning_days: true },
  });

  // 2. Get active services and their effective rates
  const clientServices = await prisma.clientService.findMany({
    where: { client_id: clientId, service: { is_active: true } },
    include: { service: { select: { standard_rate: true } } },
  });

  // Load rate history for all services to resolve period-specific rates
  const rateHistoryEntries = await prisma.serviceRateHistory.findMany({
    where: {
      client_id: clientId,
      service_id: { in: clientServices.map((cs) => cs.service_id) },
    },
    orderBy: [{ effective_year: 'desc' }, { effective_month: 'desc' }],
  });

  const rateHistoryByService = new Map<string, typeof rateHistoryEntries>();
  for (const entry of rateHistoryEntries) {
    const list = rateHistoryByService.get(entry.service_id) ?? [];
    list.push(entry);
    rateHistoryByService.set(entry.service_id, list);
  }

  // Load service contracts (ACTIVE + COMPLETED) for contract-based rate resolution
  const serviceContracts = await prisma.serviceContract.findMany({
    where: {
      client_id: clientId,
      status: { in: ['ACTIVE', 'COMPLETED'] },
      service_id: { in: clientServices.map((cs) => cs.service_id) },
    },
  });

  const contractsByService = new Map<string, typeof serviceContracts>();
  for (const contract of serviceContracts) {
    const list = contractsByService.get(contract.service_id) ?? [];
    list.push(contract);
    contractsByService.set(contract.service_id, list);
  }

  /**
   * Check if a contract covers a given month/year.
   */
  function isContractActiveForPeriod(
    contract: typeof serviceContracts[number],
    m: number, y: number
  ): boolean {
    const afterStart = y > contract.start_year || (y === contract.start_year && m >= contract.start_month);
    if (contract.billing_model === 'PROJECT') {
      return contract.start_month === m && contract.start_year === y;
    }
    if (!afterStart) return false;
    if (contract.end_month && contract.end_year) {
      return y < contract.end_year || (y === contract.end_year && m <= contract.end_month);
    }
    // No end date (RETAINER): active through current month
    const now = new Date();
    return y < now.getFullYear() || (y === now.getFullYear() && m <= now.getMonth() + 1);
  }

  /**
   * Resolves the service rate for a given month/year.
   * Priority: ServiceContract > ServiceRateHistory > custom_rate > standard_rate
   */
  function getServiceCostForPeriod(m: number, y: number): number {
    return clientServices.reduce((sum, cs) => {
      // 1. Check contracts first
      const contracts = contractsByService.get(cs.service_id);
      if (contracts) {
        const activeContract = contracts.find((c) => isContractActiveForPeriod(c, m, y));
        if (activeContract) {
          if (activeContract.billing_model === 'PROJECT') {
            return sum + Number(activeContract.project_fee ?? 0);
          }
          return sum + Number(activeContract.monthly_rate ?? 0);
        }
      }

      // 2. Fall back to rate history
      const fallbackRate = cs.custom_rate ? Number(cs.custom_rate) : Number(cs.service.standard_rate);
      const history = rateHistoryByService.get(cs.service_id);
      if (!history || history.length === 0) return sum + fallbackRate;
      const applicableEntry = history.find(
        (h) => h.effective_year < y || (h.effective_year === y && h.effective_month <= m)
      );
      return sum + (applicableEntry ? Number(applicableEntry.rate) : fallbackRate);
    }, 0);
  }

  // Current monthly rate: use active contract rates for current month, fall back to custom_rate/standard_rate
  const now2 = new Date();
  const curM = now2.getMonth() + 1;
  const curY = now2.getFullYear();
  const monthlyServiceCost = clientServices.reduce((sum, cs) => {
    // Check if an active contract covers the current month
    const contracts = contractsByService.get(cs.service_id);
    if (contracts) {
      const activeContract = contracts.find((c) => isContractActiveForPeriod(c, curM, curY));
      if (activeContract) {
        if (activeContract.billing_model === 'PROJECT') return sum + Number(activeContract.project_fee ?? 0);
        return sum + Number(activeContract.monthly_rate ?? 0);
      }
    }
    const rate = cs.custom_rate ? Number(cs.custom_rate) : Number(cs.service.standard_rate);
    return sum + rate;
  }, 0);

  // If no services, client is trivially covered
  if (monthlyServiceCost <= 0) {
    return {
      monthlyServiceCost: 0,
      totalPaid: 0,
      totalExpected: 0,
      coveredThrough: null,
      monthsRemaining: 0,
      creditBalance: 0,
      status: 'COVERED',
      daysUntilShutoff: null,
      gracePeriodDays: org.service_grace_period_days,
      warningDays: org.service_warning_days,
    };
  }

  // 3. Get client start date
  const client = await prisma.client.findUniqueOrThrow({
    where: { id: clientId },
    select: { start_date: true },
  });

  // 4. Get all payment allocations grouped by period
  const allocations = await prisma.paymentAllocation.findMany({
    where: { cash_receipt: { client_id: clientId } },
    select: { period_month: true, period_year: true, amount: true },
  });

  const revenueByPeriod = new Map<string, number>();
  let totalPaid = 0;
  for (const a of allocations) {
    const key = `${a.period_year}-${a.period_month}`;
    revenueByPeriod.set(key, (revenueByPeriod.get(key) ?? 0) + Number(a.amount));
    totalPaid += Number(a.amount);
  }

  // 5. Walk forward from the earliest known date to present + future
  // Use the earliest of: client start_date, first allocation period, first rate history entry
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  let walkMonth = client.start_date.getMonth() + 1;
  let walkYear = client.start_date.getFullYear();

  // Check earliest allocation period
  for (const a of allocations) {
    if (a.period_year < walkYear || (a.period_year === walkYear && a.period_month < walkMonth)) {
      walkYear = a.period_year;
      walkMonth = a.period_month;
    }
  }

  // Check earliest rate history entry
  for (const entries of rateHistoryByService.values()) {
    for (const h of entries) {
      if (h.effective_year < walkYear || (h.effective_year === walkYear && h.effective_month < walkMonth)) {
        walkYear = h.effective_year;
        walkMonth = h.effective_month;
      }
    }
  }

  // Check earliest contract start date
  for (const c of serviceContracts) {
    if (c.start_year < walkYear || (c.start_year === walkYear && c.start_month < walkMonth)) {
      walkYear = c.start_year;
      walkMonth = c.start_month;
    }
  }
  let cumulativeBalance = 0;
  let coveredThrough: { month: number; year: number } | null = null;
  let totalExpected = 0;

  // Walk up to 24 months into the future to find where coverage ends
  const maxIterations = 120; // 10 years safety limit
  let iterations = 0;

  while (iterations < maxIterations) {
    const key = `${walkYear}-${walkMonth}`;
    const periodRevenue = revenueByPeriod.get(key) ?? 0;

    // Resolve the service cost for this specific period (uses rate history)
    const periodServiceCost = getServiceCostForPeriod(walkMonth, walkYear);

    // Only count expected cost for periods up to and including current
    const isPastOrCurrent =
      walkYear < currentYear || (walkYear === currentYear && walkMonth <= currentMonth);

    if (isPastOrCurrent) {
      totalExpected += periodServiceCost;
    }

    cumulativeBalance += periodRevenue - periodServiceCost;

    if (cumulativeBalance >= 0) {
      coveredThrough = { month: walkMonth, year: walkYear };
    } else if (cumulativeBalance < 0 && !isPastOrCurrent) {
      // We've gone into the future and run out of credit
      break;
    }

    // Stop walking if we're past coverage end and in the future
    if (cumulativeBalance < 0 && !isPastOrCurrent) {
      break;
    }

    // Advance month
    walkMonth++;
    if (walkMonth > 12) {
      walkMonth = 1;
      walkYear++;
    }
    iterations++;

    // Stop if we're well past the current date with no more revenue
    if (walkYear > currentYear + 2) break;
  }

  // 6. Calculate months remaining and credit balance
  const creditBalance = Math.max(0, totalPaid - totalExpected);
  const monthsRemaining = monthlyServiceCost > 0
    ? Math.floor(creditBalance / monthlyServiceCost)
    : 0;

  // 7. Determine status
  let status: CoverageStatus = 'COVERED';
  let daysUntilShutoff: number | null = null;

  if (coveredThrough) {
    // Calculate how far past coverage we are
    const coveredEndDate = new Date(coveredThrough.year, coveredThrough.month, 0); // Last day of covered month
    const daysPastCoverage = Math.floor(
      (now.getTime() - coveredEndDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysPastCoverage <= 0) {
      // Still within covered period or ahead
      const daysUntilCoverageEnds = Math.abs(daysPastCoverage);
      if (daysUntilCoverageEnds <= org.service_warning_days && monthsRemaining === 0) {
        status = 'WARNING';
        daysUntilShutoff = daysUntilCoverageEnds + org.service_grace_period_days;
      } else {
        status = 'COVERED';
      }
    } else if (daysPastCoverage <= org.service_grace_period_days) {
      status = 'PAST_DUE';
      daysUntilShutoff = org.service_grace_period_days - daysPastCoverage;
    } else {
      status = 'SUSPENDED';
      daysUntilShutoff = 0;
    }
  } else if (totalPaid === 0 && totalExpected > 0) {
    // Never paid, but services expected
    status = 'PAST_DUE';
    daysUntilShutoff = org.service_grace_period_days;
  }

  return {
    monthlyServiceCost,
    totalPaid,
    totalExpected,
    coveredThrough,
    monthsRemaining,
    creditBalance,
    status,
    daysUntilShutoff,
    gracePeriodDays: org.service_grace_period_days,
    warningDays: org.service_warning_days,
  };
}
