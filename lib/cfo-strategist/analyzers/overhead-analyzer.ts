/**
 * Overhead Analyzer
 *
 * Analyzes overhead costs and agency spend to generate OVERHEAD_REDUCTION
 * recommendations. Three analysis types:
 *
 *  1. Disproportionate overhead vs revenue — flags clients where allocated
 *     overhead exceeds 50% of revenue, and org-wide overhead ratio above 30%.
 *  2. Agency spend trending up — flags agencies whose current month spend
 *     exceeds historical average by more than 20%.
 *  3. Internal project cost reduction — flags when internal (overhead) clients
 *     represent more than 15% of total organizational costs.
 */

import { prisma } from '@/lib/prisma';
import { calculateOverheadAllocation } from '@/lib/calculations/overhead-allocation';
import { getAllAgencyAvgMonthlySpend } from '@/lib/calculations/agency-costs';
import type { AnalyzerResult, RecommendationInput, ThresholdConfig } from '../types';

/** Overhead-to-revenue ratio threshold for individual clients. */
const CLIENT_OVERHEAD_REVENUE_THRESHOLD = 0.5;

/** Org-wide overhead ratio threshold (overhead / total revenue). */
const ORG_OVERHEAD_RATIO_THRESHOLD = 0.3;

/** Agency spend increase threshold vs historical average. */
const AGENCY_SPEND_INCREASE_THRESHOLD = 0.2;

/** Internal project cost share threshold (of total org costs). */
const INTERNAL_COST_SHARE_THRESHOLD = 0.15;

/**
 * Determine confidence level based on months of available data.
 *
 * @param monthCount - Number of months with actual data
 * @returns Confidence score between 0 and 1
 */
function getConfidenceLevel(monthCount: number): number {
  if (monthCount >= 3) return 0.8;
  if (monthCount === 2) return 0.55;
  return 0.3;
}

/**
 * Analyze overhead allocation and agency costs for an organization.
 *
 * @param organizationId - Organization UUID
 * @param month - 1-12
 * @param year - Full year (e.g. 2025)
 * @param thresholds - Configurable analyzer thresholds
 * @returns Analyzer result with recommendations and any errors
 */
export async function analyzeOverhead(
  organizationId: string,
  month: number,
  year: number,
  thresholds: ThresholdConfig
): Promise<AnalyzerResult> {
  const recommendations: RecommendationInput[] = [];
  const errors: string[] = [];

  // Load org settings for overhead allocation
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { include_owner_pay: true },
  });

  if (!org) {
    return { recommendations, errors: [`Organization ${organizationId} not found`] };
  }

  // --- Analysis 1: Disproportionate overhead vs revenue ---
  try {
    const overheadRecs = await analyzeOverheadVsRevenue(
      organizationId,
      month,
      year,
      org.include_owner_pay
    );
    recommendations.push(...overheadRecs);
  } catch (err) {
    errors.push(
      `Overhead vs revenue analysis failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // --- Analysis 2: Agency spend trending up ---
  try {
    const agencyRecs = await analyzeAgencySpendTrend(
      organizationId,
      month,
      year
    );
    recommendations.push(...agencyRecs);
  } catch (err) {
    errors.push(
      `Agency spend trend analysis failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // --- Analysis 3: Internal project cost reduction ---
  try {
    const internalRecs = await analyzeInternalProjectCosts(
      organizationId,
      month,
      year
    );
    recommendations.push(...internalRecs);
  } catch (err) {
    errors.push(
      `Internal project cost analysis failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  return { recommendations, errors };
}

/**
 * Analysis 1: Identify clients where overhead allocation is disproportionate
 * relative to revenue, and check the org-wide overhead ratio.
 *
 * Flags:
 *  - Individual clients where overhead > 50% of their revenue
 *  - Org-wide overhead ratio above 30%
 */
async function analyzeOverheadVsRevenue(
  organizationId: string,
  month: number,
  year: number,
  includeOwnerPay: boolean
): Promise<RecommendationInput[]> {
  const recommendations: RecommendationInput[] = [];

  // Get overhead allocation per client
  const overheadMap = await calculateOverheadAllocation(
    organizationId,
    month,
    year,
    includeOwnerPay
  );

  if (overheadMap.size === 0) {
    return recommendations;
  }

  // Load ClientROI data for the month to get per-client revenue
  const clientIds = Array.from(overheadMap.keys());
  const clientRois = await prisma.clientROI.findMany({
    where: {
      client_id: { in: clientIds },
      month,
      year,
      client: { organization_id: organizationId },
    },
    include: {
      client: { select: { id: true, name: true } },
    },
  });

  // Count historical months for confidence scoring
  const historicalCounts = await prisma.clientROI.groupBy({
    by: ['client_id'],
    where: {
      client_id: { in: clientIds },
      client: { organization_id: organizationId },
    },
    _count: { id: true },
  });

  const monthCountMap = new Map<string, number>();
  for (const row of historicalCounts) {
    monthCountMap.set(row.client_id, row._count.id);
  }

  let totalRevenue = 0;
  let totalOverhead = 0;

  for (const roi of clientRois) {
    const revenue = Number(roi.revenue);
    const overhead = overheadMap.get(roi.client_id) ?? 0;

    totalRevenue += revenue;
    totalOverhead += overhead;

    // Flag individual clients where overhead > 50% of revenue
    if (revenue > 0 && overhead / revenue > CLIENT_OVERHEAD_REVENUE_THRESHOLD) {
      const overheadPct = Math.round((overhead / revenue) * 100);
      const monthCount = monthCountMap.get(roi.client_id) ?? 1;
      const potentialSavings = overhead - revenue * CLIENT_OVERHEAD_REVENUE_THRESHOLD;

      recommendations.push({
        category: 'OVERHEAD_REDUCTION',
        targetEntityType: 'client',
        targetEntityId: roi.client_id,
        title: `High overhead allocation for ${roi.client.name}`,
        description:
          `Overhead costs represent ${overheadPct}% of revenue for ${roi.client.name}. ` +
          `Allocated overhead is $${overhead.toFixed(2)} against $${revenue.toFixed(2)} revenue. ` +
          `Consider rebalancing workload or reviewing overhead drivers.`,
        estimatedMonthlyImpact: Math.round(potentialSavings * 100) / 100,
        confidenceLevel: getConfidenceLevel(monthCount),
        supportingData: {
          clientName: roi.client.name,
          allocatedOverhead: overhead,
          clientRevenue: revenue,
          overheadRevenueRatio: overhead / revenue,
          totalCosts: Number(roi.total_costs),
          monthsOfData: monthCount,
        },
      });
    }
  }

  // Flag org-wide overhead ratio above 30%
  if (totalRevenue > 0 && totalOverhead / totalRevenue > ORG_OVERHEAD_RATIO_THRESHOLD) {
    const orgOverheadPct = Math.round((totalOverhead / totalRevenue) * 100);
    const excessOverhead =
      totalOverhead - totalRevenue * ORG_OVERHEAD_RATIO_THRESHOLD;

    // Use the median month count across all clients for confidence
    const allCounts = Array.from(monthCountMap.values());
    const sortedCounts = allCounts.sort((a, b) => a - b);
    const medianMonths =
      sortedCounts.length > 0
        ? sortedCounts[Math.floor(sortedCounts.length / 2)]
        : 1;

    recommendations.push({
      category: 'OVERHEAD_REDUCTION',
      targetEntityType: 'client',
      targetEntityId: organizationId,
      title: `Organization overhead ratio at ${orgOverheadPct}%`,
      description:
        `Total overhead ($${totalOverhead.toFixed(2)}) represents ${orgOverheadPct}% of total revenue ` +
        `($${totalRevenue.toFixed(2)}), exceeding the 30% threshold. ` +
        `Review internal project costs, owner compensation, and overhead distribution.`,
      estimatedMonthlyImpact: Math.round(excessOverhead * 100) / 100,
      confidenceLevel: getConfidenceLevel(medianMonths),
      supportingData: {
        totalOverhead,
        totalRevenue,
        overheadRatio: totalOverhead / totalRevenue,
        thresholdPct: ORG_OVERHEAD_RATIO_THRESHOLD * 100,
        clientCount: clientRois.length,
        monthsOfData: medianMonths,
      },
    });
  }

  return recommendations;
}

/**
 * Analysis 2: Identify agencies where current month spend exceeds
 * the historical average by more than 20%.
 *
 * Compares actual ExpenseRecord spend for the target month against
 * the all-time average from getAllAgencyAvgMonthlySpend.
 */
async function analyzeAgencySpendTrend(
  organizationId: string,
  month: number,
  year: number
): Promise<RecommendationInput[]> {
  const recommendations: RecommendationInput[] = [];

  // Get historical averages per agency
  const avgSpendMap = await getAllAgencyAvgMonthlySpend(organizationId);

  if (avgSpendMap.size === 0) {
    return recommendations;
  }

  // Get current month actual spend per agency from ExpenseRecord
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  const currentMonthSpend = await prisma.expenseRecord.groupBy({
    by: ['agency_id'],
    where: {
      organization_id: organizationId,
      agency_id: { not: null },
      is_credit: false,
      transaction_date: {
        gte: startDate,
        lt: endDate,
      },
    },
    _sum: { amount: true },
  });

  // Load agency names for readable recommendations
  const agencyIds = Array.from(avgSpendMap.keys());
  const agencies = await prisma.agency.findMany({
    where: {
      id: { in: agencyIds },
      organization_id: organizationId,
      deleted_at: null,
    },
    select: { id: true, name: true },
  });

  const agencyNameMap = new Map<string, string>();
  for (const agency of agencies) {
    agencyNameMap.set(agency.id, agency.name);
  }

  // Compare current month vs historical average
  for (const row of currentMonthSpend) {
    const agencyId = row.agency_id;
    if (!agencyId) continue;

    const currentSpend = Number(row._sum.amount ?? 0);
    const avgData = avgSpendMap.get(agencyId);

    if (!avgData || avgData.avgMonthlySpend <= 0) continue;

    const increaseRatio =
      (currentSpend - avgData.avgMonthlySpend) / avgData.avgMonthlySpend;

    if (increaseRatio > AGENCY_SPEND_INCREASE_THRESHOLD) {
      const agencyName = agencyNameMap.get(agencyId) ?? 'Unknown Agency';
      const increasePct = Math.round(increaseRatio * 100);
      const excessSpend = currentSpend - avgData.avgMonthlySpend;

      recommendations.push({
        category: 'OVERHEAD_REDUCTION',
        targetEntityType: 'agency',
        targetEntityId: agencyId,
        title: `${agencyName} spend up ${increasePct}% vs average`,
        description:
          `Current month spend for ${agencyName} is $${currentSpend.toFixed(2)}, ` +
          `which is ${increasePct}% above the historical average of ` +
          `$${avgData.avgMonthlySpend.toFixed(2)} (based on ${avgData.monthCount} months). ` +
          `Review recent invoices and scope changes.`,
        estimatedMonthlyImpact: Math.round(excessSpend * 100) / 100,
        confidenceLevel: getConfidenceLevel(avgData.monthCount),
        supportingData: {
          agencyName,
          currentMonthSpend: currentSpend,
          avgMonthlySpend: avgData.avgMonthlySpend,
          totalHistoricalSpend: avgData.totalSpend,
          monthsOfData: avgData.monthCount,
          increasePercent: increasePct,
        },
      });
    }
  }

  return recommendations;
}

/**
 * Analysis 3: Check if internal project costs represent a disproportionate
 * share of total organizational costs (> 15%).
 *
 * Internal clients (is_internal=true) carry overhead costs. If their combined
 * cost share is too high, the organization may benefit from a review.
 */
async function analyzeInternalProjectCosts(
  organizationId: string,
  month: number,
  year: number
): Promise<RecommendationInput[]> {
  const recommendations: RecommendationInput[] = [];

  // Get all ClientROI records for the month across internal and external clients
  const allRois = await prisma.clientROI.findMany({
    where: {
      month,
      year,
      client: { organization_id: organizationId },
    },
    include: {
      client: {
        select: { id: true, name: true, is_internal: true },
      },
    },
  });

  if (allRois.length === 0) {
    return recommendations;
  }

  let totalCosts = 0;
  let internalCosts = 0;
  const internalBreakdown: Array<{
    clientId: string;
    clientName: string;
    costs: number;
  }> = [];

  for (const roi of allRois) {
    const costs = Number(roi.total_costs);
    totalCosts += costs;

    if (roi.client.is_internal) {
      internalCosts += costs;
      internalBreakdown.push({
        clientId: roi.client.id,
        clientName: roi.client.name,
        costs,
      });
    }
  }

  if (totalCosts <= 0 || internalCosts <= 0) {
    return recommendations;
  }

  const internalCostShare = internalCosts / totalCosts;

  if (internalCostShare > INTERNAL_COST_SHARE_THRESHOLD) {
    const sharePct = Math.round(internalCostShare * 100);
    const excessCost =
      internalCosts - totalCosts * INTERNAL_COST_SHARE_THRESHOLD;

    // Count historical months for confidence
    const internalClientIds = internalBreakdown.map((b) => b.clientId);
    const historicalCount = await prisma.clientROI.groupBy({
      by: ['client_id'],
      where: {
        client_id: { in: internalClientIds },
        client: { organization_id: organizationId },
      },
      _count: { id: true },
    });

    const monthCounts = historicalCount.map((r) => r._count.id);
    const minMonths = monthCounts.length > 0 ? Math.min(...monthCounts) : 1;

    // Create a recommendation per internal client exceeding threshold
    for (const internal of internalBreakdown) {
      const clientSharePct = Math.round((internal.costs / totalCosts) * 100);

      recommendations.push({
        category: 'OVERHEAD_REDUCTION',
        targetEntityType: 'client',
        targetEntityId: internal.clientId,
        title: `Internal project "${internal.clientName}" costs at ${clientSharePct}% of total`,
        description:
          `Internal project "${internal.clientName}" has costs of $${internal.costs.toFixed(2)}, ` +
          `representing ${clientSharePct}% of total organizational costs ($${totalCosts.toFixed(2)}). ` +
          `Combined internal projects account for ${sharePct}% (threshold: 15%). ` +
          `Review internal staffing, subscriptions, and services for reduction opportunities.`,
        estimatedMonthlyImpact: Math.round(
          (internal.costs / internalCosts) * excessCost * 100
        ) / 100,
        confidenceLevel: getConfidenceLevel(minMonths),
        supportingData: {
          clientName: internal.clientName,
          isInternal: true,
          internalCosts: internal.costs,
          totalOrganizationCosts: totalCosts,
          internalCostSharePct: clientSharePct,
          combinedInternalSharePct: sharePct,
          internalProjectCount: internalBreakdown.length,
          monthsOfData: minMonths,
          internalBreakdown: internalBreakdown.map((b) => ({
            clientName: b.clientName,
            costs: b.costs,
            sharePct: Math.round((b.costs / totalCosts) * 100),
          })),
        },
      });
    }
  }

  return recommendations;
}
