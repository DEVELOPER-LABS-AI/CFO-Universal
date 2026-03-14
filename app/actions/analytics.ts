'use server';

import { prisma } from '@/lib/prisma';
import { getOrganizationId } from '@/lib/auth/organization';

/**
 * Fetches live analytics data directly from Mercury transactions and entity tables.
 * Independent of ClientROI — no refresh needed.
 */
export async function getAnalyticsData() {
  const organizationId = await getOrganizationId();

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const priorMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const priorYear = currentMonth === 1 ? currentYear - 1 : currentYear;

  // Build last 6 months date ranges
  const months: { month: number; year: number; start: Date; end: Date }[] = [];
  let m = currentMonth;
  let y = currentYear;
  for (let i = 0; i < 6; i++) {
    months.unshift({
      month: m,
      year: y,
      start: new Date(y, m - 1, 1),
      end: new Date(y, m, 0), // last day of month
    });
    m--;
    if (m === 0) { m = 12; y--; }
  }

  const sixMonthsAgo = months[0].start;
  const currentEnd = months[months.length - 1].end;

  const [
    revenueByMonth,
    expensesByMonth,
    expensesByCategory,
    priorExpensesByCategory,
    topClientRevenue,
    activeClientsCount,
    priorActiveClientsCount,
    priorRevenue,
  ] = await Promise.all([
    // 1. Monthly revenue from ClientCashReceipt (Mercury deposits)
    prisma.clientCashReceipt.groupBy({
      by: ['period_month', 'period_year'],
      where: {
        organization_id: organizationId,
        OR: months.map(({ month, year }) => ({ period_month: month, period_year: year })),
      },
      _sum: { amount: true },
    }),

    // 2. Monthly expenses from ExpenseRecord (Mercury debits)
    prisma.expenseRecord.groupBy({
      by: ['category'],
      where: {
        organization_id: organizationId,
        is_credit: false,
        transaction_date: { gte: sixMonthsAgo, lte: currentEnd },
      },
      _sum: { amount: true },
      _count: true,
    }),

    // 3. Current month expense breakdown by category
    prisma.expenseRecord.groupBy({
      by: ['category'],
      where: {
        organization_id: organizationId,
        is_credit: false,
        transaction_date: {
          gte: new Date(currentYear, currentMonth - 1, 1),
          lte: new Date(currentYear, currentMonth, 0),
        },
      },
      _sum: { amount: true },
    }),

    // 4. Prior month expense breakdown (for MoM)
    prisma.expenseRecord.groupBy({
      by: ['category'],
      where: {
        organization_id: organizationId,
        is_credit: false,
        transaction_date: {
          gte: new Date(priorYear, priorMonth - 1, 1),
          lte: new Date(priorYear, priorMonth, 0),
        },
      },
      _sum: { amount: true },
    }),

    // 5. Top clients by revenue (current month from ClientCashReceipt)
    prisma.clientCashReceipt.groupBy({
      by: ['client_id'],
      where: {
        organization_id: organizationId,
        period_month: currentMonth,
        period_year: currentYear,
      },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 10,
    }),

    // 6. Active clients count
    prisma.client.count({
      where: { organization_id: organizationId, status: 'ACTIVE', deleted_at: null },
    }),

    // 7. Prior month active clients (approximate)
    prisma.client.count({
      where: {
        organization_id: organizationId,
        deleted_at: null,
        OR: [
          { status: 'ACTIVE' },
          { status: 'CHURNED', churn_date: { gte: new Date(priorYear, priorMonth - 1, 1) } },
        ],
      },
    }),

    // 8. Prior month total revenue
    prisma.clientCashReceipt.aggregate({
      where: {
        organization_id: organizationId,
        period_month: priorMonth,
        period_year: priorYear,
      },
      _sum: { amount: true },
    }),
  ]);

  // Also get monthly expense totals for trend chart
  const monthlyExpenseTotals = await prisma.expenseRecord.groupBy({
    by: ['transaction_date'],
    where: {
      organization_id: organizationId,
      is_credit: false,
      transaction_date: { gte: sixMonthsAgo, lte: currentEnd },
    },
    _sum: { amount: true },
  });

  // Aggregate expenses by month
  const expenseByMonthMap = new Map<string, number>();
  for (const row of monthlyExpenseTotals) {
    const d = new Date(row.transaction_date);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
    expenseByMonthMap.set(key, (expenseByMonthMap.get(key) ?? 0) + Number(row._sum.amount ?? 0));
  }

  // Format monthly trends
  const monthlyTrends = months.map(({ month, year }) => {
    const revRow = revenueByMonth.find((r) => r.period_month === month && r.period_year === year);
    const revenue = Number(revRow?._sum.amount ?? 0);
    const costs = expenseByMonthMap.get(`${year}-${month}`) ?? 0;
    const profit = revenue - costs;
    const label = new Date(year, month - 1).toLocaleDateString('en-US', {
      month: 'short',
      year: '2-digit',
    });
    return { label, month, year, revenue, costs, profit };
  });

  // Format cost breakdown (current month) with category labels
  const categoryLabels: Record<string, { name: string; color: string }> = {
    CONTRACTOR_COST: { name: 'Contractor', color: '#8b5cf6' },
    SUBSCRIPTION: { name: 'Subscription', color: '#f59e0b' },
    TOOLS: { name: 'Tools', color: '#06b6d4' },
    PAYROLL: { name: 'Payroll', color: '#3b82f6' },
    OVERHEAD: { name: 'Overhead', color: '#6b7280' },
    MARKETING: { name: 'Marketing', color: '#ec4899' },
    OTHER: { name: 'Other', color: '#9ca3af' },
  };

  const costBreakdown = expensesByCategory
    .map((row) => ({
      name: categoryLabels[row.category]?.name ?? row.category,
      value: Number(row._sum.amount ?? 0),
      color: categoryLabels[row.category]?.color ?? '#9ca3af',
    }))
    .filter((item) => item.value > 0);

  // Get client names for top revenue clients
  const topClientIds = topClientRevenue.map((r) => r.client_id);
  const clientNames = topClientIds.length > 0
    ? await prisma.client.findMany({
        where: { id: { in: topClientIds } },
        select: { id: true, name: true },
      })
    : [];
  const clientNameMap = new Map(clientNames.map((c) => [c.id, c.name]));

  const topClientsByMargin = topClientRevenue.map((row) => ({
    name: clientNameMap.get(row.client_id) ?? 'Unknown',
    margin: 0, // Not calculable without per-client costs here
    revenue: Number(row._sum.amount ?? 0),
    profit: Number(row._sum.amount ?? 0), // Revenue as proxy when costs unknown
  }));

  // KPIs from live data
  const curRevenue = monthlyTrends[monthlyTrends.length - 1]?.revenue ?? 0;
  const curCosts = monthlyTrends[monthlyTrends.length - 1]?.costs ?? 0;
  const curProfit = curRevenue - curCosts;
  const curMargin = curRevenue > 0 ? (curProfit / curRevenue) * 100 : 0;

  const prevRev = Number(priorRevenue._sum.amount ?? 0);
  const prevCostsTotal = priorExpensesByCategory.reduce(
    (sum, r) => sum + Number(r._sum.amount ?? 0), 0
  );
  const prevProfit = prevRev - prevCostsTotal;
  const prevMargin = prevRev > 0 ? (prevProfit / prevRev) * 100 : 0;

  const pctChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / Math.abs(previous)) * 100;
  };

  const kpis = {
    revenue: { value: curRevenue, change: pctChange(curRevenue, prevRev) },
    profit: { value: curProfit, change: pctChange(curProfit, prevProfit) },
    margin: { value: curMargin, change: curMargin - prevMargin },
    activeClients: {
      value: activeClientsCount,
      change: activeClientsCount - priorActiveClientsCount,
    },
  };

  return {
    monthlyTrends,
    costBreakdown,
    topClientsByMargin,
    kpis,
  };
}
