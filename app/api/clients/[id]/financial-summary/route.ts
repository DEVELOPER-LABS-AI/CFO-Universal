/**
 * GET /api/clients/[id]/financial-summary
 *
 * Returns financial summary with cost breakdown for a client.
 * Supports single-period and all-time aggregation, plus cost itemization details.
 *
 * Query params:
 *   mode   - "month" (default) or "all" for all-time aggregation
 *   month  - 1-12 (defaults to current month)
 *   year   - YYYY (defaults to current year)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getExpectedRevenueForPeriod, getExpectedRevenueAllPeriods } from '@/lib/calculations/expected-revenue';


interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: clientId } = await context.params;
    const { searchParams } = request.nextUrl;

    const mode = searchParams.get('mode') ?? 'month';
    const now = new Date();
    const month = Number(searchParams.get('month') ?? now.getMonth() + 1);
    const year = Number(searchParams.get('year') ?? now.getFullYear());

    // Verify client exists
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, name: true, organization_id: true },
    });
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Always get available periods from BOTH ROI records and cash receipts
    const availablePeriods = await getAvailablePeriodsForClient(clientId);

    if (mode === 'all') {
      // All-time: always use ClientCashReceipts as revenue source of truth
      const [revenueDetails, roiRecords, expectedRevenueByPeriod] = await Promise.all([
        getRevenueItemization(clientId),
        prisma.clientROI.findMany({
          where: { client_id: clientId },
          orderBy: [{ year: 'desc' }, { month: 'desc' }],
        }),
        getExpectedRevenueAllPeriods(clientId, client.organization_id),
      ]);

      const revenue = revenueDetails.total;

      // Sum costs from ROI records (or 0 if none)
      const costTotals = roiRecords.reduce(
        (acc, roi) => ({
          totalCosts: acc.totalCosts + Number(roi.total_costs),
          bdr: acc.bdr + Number(roi.bdr_costs),
          contractor: acc.contractor + Number(roi.contractor_costs),
          subscription: acc.subscription + Number(roi.subscription_costs),
          service: acc.service + Number(roi.service_costs),
          agency: acc.agency + Number(roi.agency_costs),
          overhead: acc.overhead + Number(roi.overhead_costs),
          other: acc.other + Number(roi.other_costs),
        }),
        { totalCosts: 0, bdr: 0, contractor: 0, subscription: 0, service: 0, agency: 0, overhead: 0, other: 0 }
      );

      const profit = revenue - costTotals.totalCosts;
      const marginPercentage = revenue > 0 ? (profit / revenue) * 100 : 0;
      const roiPercentage = costTotals.totalCosts > 0 ? (profit / costTotals.totalCosts) * 100 : 0;

      // Expected revenue from contracts
      const expectedRevenue = expectedRevenueByPeriod.reduce((sum, p) => sum + p.expectedRevenue, 0);
      const variance = revenue - expectedRevenue;
      const variancePercentage = expectedRevenue > 0 ? (variance / expectedRevenue) * 100 : null;

      return NextResponse.json({
        mode: 'all',
        period: null,
        periodCount: availablePeriods.length,
        revenue,
        expectedRevenue,
        variance,
        variancePercentage,
        expectedRevenueByPeriod: expectedRevenueByPeriod.map((p) => ({
          ...p,
          actualRevenue: 0, // Will be populated by client if needed
          variance: 0,
        })),
        totalCosts: costTotals.totalCosts,
        profit,
        roiPercentage,
        marginPercentage,
        costBreakdown: {
          bdr: costTotals.bdr,
          contractor: costTotals.contractor,
          subscription: costTotals.subscription,
          service: costTotals.service,
          agency: costTotals.agency,
          overhead: costTotals.overhead,
          other: costTotals.other,
        },
        costDetails: await getCostItemization(clientId, client.organization_id),
        revenueDetails,
        availablePeriods,
      });
    }

    // Single-period mode: always use ClientCashReceipts for revenue
    const [revenueDetails, roi, expectedRevenue] = await Promise.all([
      getRevenueItemization(clientId, month, year),
      prisma.clientROI.findUnique({
        where: { client_id_month_year: { client_id: clientId, month, year } },
      }),
      getExpectedRevenueForPeriod(clientId, month, year),
    ]);

    const revenue = revenueDetails.total;
    const variance = revenue - expectedRevenue;
    const variancePercentage = expectedRevenue > 0 ? (variance / expectedRevenue) * 100 : null;

    if (!roi) {
      // No ROI record - show revenue from cash receipts, zero costs
      return NextResponse.json({
        mode: 'month',
        period: { month, year },
        revenue,
        expectedRevenue,
        variance,
        variancePercentage,
        totalCosts: 0,
        profit: revenue,
        roiPercentage: 0,
        marginPercentage: revenue > 0 ? 100 : 0,
        costBreakdown: { bdr: 0, contractor: 0, subscription: 0, service: 0, agency: 0, overhead: 0, other: 0 },
        costDetails: await getCostItemization(clientId, client.organization_id, month, year),
        revenueDetails,
        availablePeriods,
        needsRefresh: revenue > 0,
      });
    }

    // ROI exists: use cash receipts for revenue, ROI for costs
    const totalCosts = Number(roi.total_costs);
    const profit = revenue - totalCosts;
    const marginPercentage = revenue > 0 ? (profit / revenue) * 100 : 0;
    const roiPercentage = totalCosts > 0 ? (profit / totalCosts) * 100 : 0;

    return NextResponse.json({
      mode: 'month',
      period: { month: roi.month, year: roi.year },
      calculatedAt: roi.calculated_at,
      revenue,
      expectedRevenue,
      variance,
      variancePercentage,
      totalCosts,
      profit,
      roiPercentage,
      marginPercentage,
      costBreakdown: {
        bdr: Number(roi.bdr_costs),
        contractor: Number(roi.contractor_costs),
        subscription: Number(roi.subscription_costs),
        service: Number(roi.service_costs),
        agency: Number(roi.agency_costs),
        overhead: Number(roi.overhead_costs),
        other: Number(roi.other_costs),
      },
      costDetails: await getCostItemization(clientId, client.organization_id, month, year),
      revenueDetails,
      availablePeriods,
    });
  } catch (error) {
    console.error('[GET /api/clients/[id]/financial-summary]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Returns available periods from BOTH ROI records and cash receipts, deduplicated and sorted desc.
 */
async function getAvailablePeriodsForClient(clientId: string) {
  const [roiPeriods, receiptPeriods, allocationPeriods] = await Promise.all([
    prisma.clientROI.findMany({
      where: { client_id: clientId },
      select: { month: true, year: true },
    }),
    prisma.clientCashReceipt.findMany({
      where: { client_id: clientId },
      select: { period_month: true, period_year: true },
      distinct: ['period_month', 'period_year'],
    }),
    prisma.paymentAllocation.findMany({
      where: { cash_receipt: { client_id: clientId } },
      select: { period_month: true, period_year: true },
      distinct: ['period_month', 'period_year'],
    }),
  ]);

  // Merge and deduplicate
  const periodSet = new Set<string>();
  const periods: { month: number; year: number }[] = [];

  for (const r of roiPeriods) {
    const key = `${r.year}-${r.month}`;
    if (!periodSet.has(key)) {
      periodSet.add(key);
      periods.push({ month: r.month, year: r.year });
    }
  }

  for (const r of receiptPeriods) {
    const key = `${r.period_year}-${r.period_month}`;
    if (!periodSet.has(key)) {
      periodSet.add(key);
      periods.push({ month: r.period_month, year: r.period_year });
    }
  }

  for (const r of allocationPeriods) {
    const key = `${r.period_year}-${r.period_month}`;
    if (!periodSet.has(key)) {
      periodSet.add(key);
      periods.push({ month: r.period_month, year: r.period_year });
    }
  }

  // Sort descending
  periods.sort((a, b) => b.year - a.year || b.month - a.month);
  return periods;
}

/**
 * Returns itemized cost details for popups.
 */
async function getCostItemization(clientId: string, organizationId: string, month?: number, year?: number) {
  const periodFilter = month && year
    ? { start_date: { lte: new Date(year, month, 0) }, OR: [{ end_date: null }, { end_date: { gte: new Date(year, month - 1, 1) } }] }
    : {};

  // Staff assignments with details (include status for terminated badge)
  const staffAssignments = await prisma.staffAssignment.findMany({
    where: { client_id: clientId, staff: { deleted_at: null }, ...periodFilter },
    include: {
      staff: { select: { id: true, name: true, staff_type: true, rate: true, rate_type: true, status: true, terminated_at: true } },
    },
    orderBy: { start_date: 'desc' },
  });

  // Contractor assignments with details
  const contractorAssignments = await prisma.contractorAssignment.findMany({
    where: { client_id: clientId, ...(month && year ? { start_date: { lte: new Date(year, month, 0) }, OR: [{ end_date: null }, { end_date: { gte: new Date(year, month - 1, 1) } }] } : {}) },
    include: {
      contractor: { select: { id: true, name: true, rate: true, rate_type: true } },
    },
    orderBy: { start_date: 'desc' },
  });

  // Subscription allocations
  const subscriptionAllocations = await prisma.subscriptionAllocation.findMany({
    where: { client_id: clientId },
    include: {
      subscription: { select: { id: true, name: true, total_cost: true, billing_frequency: true } },
    },
  });

  // Services
  const clientServices = await prisma.clientService.findMany({
    where: { client_id: clientId },
    include: {
      service: { select: { id: true, name: true, standard_rate: true, billing_type: true } },
    },
  });

  // Get contractor IDs for expense matching
  // NOTE: Agency IDs intentionally excluded — agency expenses have their own dedicated
  // cost path (getAgencyStaffCostForClient). Including them here would double-count
  // agency payments (e.g. Flowks payments appearing under "Other" for Rego).
  const contractorIdsForClient = (await prisma.contractorAssignment.findMany({
    where: { client_id: clientId },
    select: { contractor_id: true },
    distinct: ['contractor_id'],
  })).map((a) => a.contractor_id);

  const expenseOrConditions: any[] = [{ client_id: clientId }];
  if (contractorIdsForClient.length > 0) {
    expenseOrConditions.push({ contractor_id: { in: contractorIdsForClient } });
  }

  const dateFilter = month && year
    ? { transaction_date: { gte: new Date(year, month - 1, 1), lte: new Date(year, month, 0) } }
    : {};

  const [otherExpenses, subscriptionExpenses] = await Promise.all([
    prisma.expenseRecord.findMany({
      where: {
        organization_id: organizationId,
        OR: expenseOrConditions,
        is_credit: false,
        category: { in: ['PAYROLL', 'OVERHEAD', 'MARKETING', 'OTHER'] },
        ...dateFilter,
      },
      select: {
        id: true, description: true, merchant_name: true,
        category: true, amount: true, transaction_date: true,
      },
      orderBy: { transaction_date: 'desc' },
      take: 100,
    }),
    prisma.expenseRecord.findMany({
      where: {
        organization_id: organizationId,
        OR: expenseOrConditions,
        is_credit: false,
        category: { in: ['SUBSCRIPTION', 'TOOLS'] },
        ...dateFilter,
      },
      select: {
        id: true, description: true, merchant_name: true,
        category: true, amount: true, transaction_date: true,
      },
      orderBy: { transaction_date: 'desc' },
      take: 100,
    }),
  ]);

  return {
    staff: staffAssignments.map((a) => ({
      name: a.staff.name,
      type: a.staff.staff_type,
      rate: a.staff.rate ? Number(a.staff.rate) : 0,
      rateType: a.staff.rate_type,
      allocation: Number(a.allocation_percentage),
      startDate: a.start_date,
      endDate: a.end_date,
      status: a.staff.status,
      terminatedAt: a.staff.terminated_at,
    })),
    contractors: contractorAssignments.map((a) => ({
      name: a.contractor.name,
      rate: a.contractor.rate ? Number(a.contractor.rate) : 0,
      rateType: a.contractor.rate_type,
      allocation: Number(a.allocation_percentage),
      startDate: a.start_date,
      endDate: a.end_date,
    })),
    subscriptions: subscriptionAllocations.map((a) => ({
      name: a.subscription.name,
      monthlyCost: Number(a.subscription.total_cost),
      allocated: Number(a.cost_allocated),
      percentage: Number(a.percentage_allocated ?? 0),
    })),
    services: clientServices.map((cs) => ({
      id: cs.service.id,
      name: cs.service.name,
      category: cs.service.billing_type,
      standardRate: Number(cs.service.standard_rate),
      customRate: cs.custom_rate ? Number(cs.custom_rate) : null,
      effectiveRate: cs.custom_rate ? Number(cs.custom_rate) : Number(cs.service.standard_rate),
    })),
    otherExpenses: otherExpenses.map((e) => ({
      id: e.id,
      description: e.description,
      merchant: e.merchant_name,
      category: e.category,
      amount: Number(e.amount),
      date: e.transaction_date,
    })),
    subscriptionExpenses: subscriptionExpenses.map((e) => ({
      id: e.id,
      description: e.description,
      merchant: e.merchant_name,
      category: e.category,
      amount: Number(e.amount),
      date: e.transaction_date,
    })),
  };
}

/**
 * Returns itemized revenue details for popups.
 * When month/year specified, returns receipts that have allocations for that period
 * (not just receipts whose primary period matches).
 */
async function getRevenueItemization(clientId: string, month?: number, year?: number) {
  let receipts;

  if (month && year) {
    // Find receipts that have allocations for this specific period
    const allocationReceiptIds = await prisma.paymentAllocation.findMany({
      where: {
        cash_receipt: { client_id: clientId },
        period_month: month,
        period_year: year,
      },
      select: { client_cash_receipt_id: true },
      distinct: ['client_cash_receipt_id'],
    });

    const receiptIds = allocationReceiptIds.map((a) => a.client_cash_receipt_id);

    receipts = receiptIds.length > 0
      ? await prisma.clientCashReceipt.findMany({
          where: { id: { in: receiptIds } },
          orderBy: { receipt_date: 'desc' },
          include: {
            allocations: {
              orderBy: { sort_order: 'asc' },
              include: { service: { select: { id: true, name: true } } },
            },
          },
        })
      : [];
  } else {
    // All-time: return all receipts with their allocations
    receipts = await prisma.clientCashReceipt.findMany({
      where: { client_id: clientId },
      orderBy: { receipt_date: 'desc' },
      include: {
        allocations: {
          orderBy: { sort_order: 'asc' },
          include: { service: { select: { id: true, name: true } } },
        },
      },
    });
  }

  // Enrich with bank description
  const mercuryIds = receipts.map((r) => r.mercury_transaction_id).filter(Boolean);
  const expenses = mercuryIds.length > 0
    ? await prisma.expenseRecord.findMany({
        where: { mercury_transaction_id: { in: mercuryIds } },
        select: { mercury_transaction_id: true, merchant_name: true, description: true },
      })
    : [];

  const expenseMap = new Map(expenses.map((e) => [e.mercury_transaction_id, e]));

  // Calculate total from allocations for the requested period (not raw receipt amounts)
  let total: number;
  if (month && year) {
    // Sum only the allocation amounts for this specific period
    total = receipts.reduce((sum, r) => {
      const periodAllocations = r.allocations.filter(
        (a) => a.period_month === month && a.period_year === year
      );
      return sum + periodAllocations.reduce((s, a) => s + Number(a.amount), 0);
    }, 0);
  } else {
    // All-time: sum all receipt net amounts
    total = receipts.reduce((sum, r) => sum + Number(r.amount), 0);
  }

  return {
    receipts: receipts.map((r) => {
      const expense = expenseMap.get(r.mercury_transaction_id);
      return {
        id: r.id,
        amount: Number(r.amount),
        grossAmount: r.gross_amount ? Number(r.gross_amount) : null,
        feeAmount: Number(r.fee_amount),
        feePercentage: r.fee_percentage ? Number(r.fee_percentage) : null,
        paymentMethod: r.payment_method,
        date: r.receipt_date,
        period: `${r.period_month}/${r.period_year}`,
        description: expense?.description || expense?.merchant_name || 'Mercury Deposit',
        allocations: r.allocations.map((a) => ({
          periodMonth: a.period_month,
          periodYear: a.period_year,
          serviceName: a.service?.name ?? null,
          amount: Number(a.amount),
          description: a.description,
        })),
      };
    }),
    total,
    count: receipts.length,
  };
}
