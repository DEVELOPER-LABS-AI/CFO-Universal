'use server';

import { prisma } from '@/lib/prisma';
import { getOrganizationId } from '@/lib/auth/organization';

/**
 * Fetches aggregated stats for the main dashboard page.
 * Returns total revenue, portfolio margin, active client count, and staff count
 * for the current month/year from pre-calculated ClientROI data.
 */
export async function getDashboardStats() {
  const organizationId = await getOrganizationId();

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const [activeClients, staffCount, mercuryRevenue, roiAggregation] = await Promise.all([
    // Active client count
    prisma.client.count({
      where: {
        organization_id: organizationId,
        status: 'ACTIVE',
        deleted_at: null,
      },
    }),

    // Staff count (all types including BDRs)
    prisma.staff.count({
      where: {
        organization_id: organizationId,
        deleted_at: null,
      },
    }),

    // Live revenue from Mercury cash receipts (no refresh needed)
    prisma.clientCashReceipt.aggregate({
      where: {
        organization_id: organizationId,
        period_month: currentMonth,
        period_year: currentYear,
      },
      _sum: { amount: true },
    }),

    // Margin from pre-calculated ClientROI (requires refresh)
    prisma.clientROI.aggregate({
      where: {
        client: {
          organization_id: organizationId,
          deleted_at: null,
        },
        month: currentMonth,
        year: currentYear,
      },
      _sum: { revenue: true },
      _avg: { margin_percentage: true },
    }),
  ]);

  // Use Mercury cash receipts as primary revenue; fall back to ClientROI if higher
  const mercuryTotal = Number(mercuryRevenue._sum.amount ?? 0);
  const roiTotal = Number(roiAggregation._sum.revenue ?? 0);
  const totalRevenue = Math.max(mercuryTotal, roiTotal);
  const portfolioMargin = Number(roiAggregation._avg.margin_percentage ?? 0);

  return {
    totalRevenue,
    portfolioMargin,
    activeClients,
    staffCount,
  };
}
