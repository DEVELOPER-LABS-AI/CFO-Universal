/**
 * Revenue Analyzer for the CFO Strategist recommendation engine.
 *
 * Analyzes per-client revenue patterns to surface:
 *   - Clients whose margin falls below their effective target
 *   - Clients with consecutively declining revenue (MoM or YoY when available)
 *   - Upsell candidates (high-margin clients that could absorb more services)
 *
 * Edge-case handling:
 *   T018b  - Prefer YoY comparison for the same calendar month when data exists;
 *            otherwise fall back to MoM and annotate `limited_comparison_window`.
 *   T018c  - Skip clients with fewer than 2 months of ClientROI data (new clients).
 *   T018d  - Distinguish project-gap zeros (no active ClientService) from
 *            true zero-collection zeros (active services, no revenue).
 */

import { prisma } from '@/lib/prisma';
import { getClientRevenue } from '@/lib/calculations/client-roi';
import { computeTrend } from '@/lib/calculations/trend-reporter';
import { getEffectiveMarginTarget } from '../margin-goals';
import type {
  AnalyzerResult,
  RecommendationInput,
  ThresholdConfig,
} from '../types';

// ---------------------------------------------------------------------------
// Confidence scoring based on data depth
// ---------------------------------------------------------------------------

/** Derive a confidence score from the number of historical data months. */
function confidenceFromDataMonths(monthCount: number): number {
  if (monthCount >= 3) return 0.85;
  if (monthCount === 2) return 0.6;
  return 0.35;
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/**
 * Walk backwards N months from a given (month, year) and return an ordered
 * array oldest-first. The starting period is included.
 */
function buildPriorPeriods(
  month: number,
  year: number,
  count: number
): Array<{ month: number; year: number }> {
  const periods: Array<{ month: number; year: number }> = [];
  let m = month;
  let y = year;

  for (let i = 0; i < count; i++) {
    periods.unshift({ month: m, year: y });
    m -= 1;
    if (m <= 0) {
      m = 12;
      y -= 1;
    }
  }
  return periods;
}

// ---------------------------------------------------------------------------
// Main analyzer
// ---------------------------------------------------------------------------

/**
 * Analyze revenue patterns for every active, non-internal client in the
 * organization and produce recommendations.
 *
 * @param organizationId - The organization to analyze
 * @param month          - Current reporting month (1-12)
 * @param year           - Current reporting year
 * @param thresholds     - Configurable threshold values
 * @returns AnalyzerResult with recommendations and any errors encountered
 */
export async function analyzeRevenue(
  organizationId: string,
  month: number,
  year: number,
  thresholds: ThresholdConfig
): Promise<AnalyzerResult> {
  const recommendations: RecommendationInput[] = [];
  const errors: string[] = [];

  // ------------------------------------------------------------------
  // 1. Fetch all active, non-internal clients with their ROI history
  // ------------------------------------------------------------------

  let clients: Array<{
    id: string;
    name: string;
    roi_metrics: Array<{
      month: number;
      year: number;
      revenue: unknown; // Prisma Decimal
      total_costs: unknown;
      margin_percentage: unknown;
      profit: unknown;
    }>;
    client_services: Array<{ service_id: string }>;
  }>;

  try {
    clients = await prisma.client.findMany({
      where: {
        organization_id: organizationId,
        status: 'ACTIVE',
        is_internal: false,
        deleted_at: null,
      },
      select: {
        id: true,
        name: true,
        roi_metrics: {
          orderBy: [{ year: 'desc' }, { month: 'desc' }],
          select: {
            month: true,
            year: true,
            revenue: true,
            total_costs: true,
            margin_percentage: true,
            profit: true,
          },
        },
        client_services: {
          select: { service_id: true },
        },
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Unknown error fetching clients';
    errors.push(`revenue-analyzer: failed to query clients - ${message}`);
    return { recommendations, errors };
  }

  // ------------------------------------------------------------------
  // 2. Iterate clients and evaluate each check
  // ------------------------------------------------------------------

  for (const client of clients) {
    try {
      const roiRecords = client.roi_metrics;
      const dataMonths = roiRecords.length;

      // T018c: Skip new clients with fewer than 2 months of data
      if (dataMonths < 2) {
        continue;
      }

      const confidence = confidenceFromDataMonths(dataMonths);

      // Most recent ROI record (already ordered desc)
      const latestRoi = roiRecords[0];
      const currentRevenue = Number(latestRoi.revenue);
      const currentMargin = Number(latestRoi.margin_percentage);

      // ------------------------------------------------------------------
      // 2a. Below-margin-target check
      // ------------------------------------------------------------------

      const marginTarget = await getEffectiveMarginTarget(
        organizationId,
        client.id
      );
      const marginGap = marginTarget - currentMargin;

      if (marginGap > thresholds.revenue_margin_gap_pts) {
        recommendations.push({
          category: 'REVENUE_OPPORTUNITY',
          targetEntityType: 'client',
          targetEntityId: client.id,
          title: `${client.name}: margin ${currentMargin.toFixed(1)}% is ${marginGap.toFixed(1)}pp below target`,
          description:
            `Client "${client.name}" has a current margin of ${currentMargin.toFixed(1)}% ` +
            `against an effective target of ${marginTarget.toFixed(1)}%. ` +
            `Consider renegotiating rates, reducing allocated costs, or reviewing service scope.`,
          estimatedMonthlyImpact: Number(
            ((marginGap / 100) * currentRevenue).toFixed(2)
          ),
          confidenceLevel: confidence,
          supportingData: {
            check: 'below_margin_target',
            current_margin: currentMargin,
            target_margin: marginTarget,
            gap_pts: Number(marginGap.toFixed(2)),
            current_revenue: currentRevenue,
            data_months: dataMonths,
          },
        });
      }

      // ------------------------------------------------------------------
      // 2b. Declining revenue check
      // ------------------------------------------------------------------

      const declineWindow = thresholds.revenue_decline_months;

      // Only check if we have enough history
      if (dataMonths >= declineWindow) {
        const periods = buildPriorPeriods(month, year, declineWindow);
        let allDeclining = true;
        let limitedComparisonWindow = false;
        const periodResults: Array<{
          month: number;
          year: number;
          revenue: number;
          direction: string;
          comparison: 'yoy' | 'mom';
        }> = [];

        for (const period of periods) {
          // Get revenue for this period
          let periodRevenue: number;
          try {
            periodRevenue = await getClientRevenue(
              client.id,
              period.month,
              period.year
            );
          } catch {
            // If we can't fetch revenue for a period, we can't confirm decline
            allDeclining = false;
            break;
          }

          // T018d: Zero-revenue classification
          if (periodRevenue === 0) {
            const hasActiveServices = client.client_services.length > 0;

            if (!hasActiveServices) {
              // Project gap - no active services, so zero revenue is expected.
              // Do not count this as a decline.
              allDeclining = false;
              break;
            }
            // else: active services but zero revenue - this counts as decline
          }

          // T018b: Prefer YoY comparison for the same calendar month
          const yoyMonth = period.month;
          const yoyYear = period.year - 1;
          const yoyRecord = roiRecords.find(
            (r) => r.month === yoyMonth && r.year === yoyYear
          );

          let comparisonRevenue: number;
          let comparisonType: 'yoy' | 'mom';

          if (yoyRecord) {
            comparisonRevenue = Number(yoyRecord.revenue);
            comparisonType = 'yoy';
          } else {
            // Fall back to prior month
            let priorMonth = period.month - 1;
            let priorYear = period.year;
            if (priorMonth <= 0) {
              priorMonth = 12;
              priorYear -= 1;
            }

            const momRecord = roiRecords.find(
              (r) => r.month === priorMonth && r.year === priorYear
            );

            comparisonRevenue = momRecord ? Number(momRecord.revenue) : 0;
            comparisonType = 'mom';
            limitedComparisonWindow = true;
          }

          const trend = computeTrend(periodRevenue, comparisonRevenue);

          periodResults.push({
            month: period.month,
            year: period.year,
            revenue: periodRevenue,
            direction: trend.direction,
            comparison: comparisonType,
          });

          if (trend.direction !== 'DOWN') {
            allDeclining = false;
          }
        }

        if (allDeclining && periodResults.length === declineWindow) {
          const oldestRevenue = periodResults[0].revenue;
          const newestRevenue = periodResults[periodResults.length - 1].revenue;
          const totalDrop = oldestRevenue - newestRevenue;

          const supportingData: Record<string, unknown> = {
            check: 'declining_revenue',
            decline_window_months: declineWindow,
            period_results: periodResults,
            total_revenue_drop: Number(totalDrop.toFixed(2)),
            data_months: dataMonths,
          };

          if (limitedComparisonWindow) {
            supportingData.limited_comparison_window = true;
          }

          recommendations.push({
            category: 'REVENUE_OPPORTUNITY',
            targetEntityType: 'client',
            targetEntityId: client.id,
            title: `${client.name}: revenue declining for ${declineWindow} consecutive months`,
            description:
              `Client "${client.name}" has shown declining revenue for the last ` +
              `${declineWindow} month(s). Total drop: $${totalDrop.toFixed(2)}. ` +
              `Investigate whether engagement is dropping, invoices are delayed, ` +
              `or the client is at risk of churn.`,
            estimatedMonthlyImpact: Number(
              (totalDrop / declineWindow).toFixed(2)
            ),
            confidenceLevel: confidence,
            supportingData,
          });
        }
      }

      // ------------------------------------------------------------------
      // 2c. Upsell candidates (high-margin clients)
      // ------------------------------------------------------------------

      const marginTarget2 = await getEffectiveMarginTarget(
        organizationId,
        client.id
      );
      const marginSurplus = currentMargin - marginTarget2;

      // Client is significantly above target (same gap threshold, but positive)
      if (marginSurplus > thresholds.revenue_margin_gap_pts) {
        const potentialAdditionalRevenue = Number(
          ((marginSurplus / 100) * currentRevenue).toFixed(2)
        );

        recommendations.push({
          category: 'REVENUE_OPPORTUNITY',
          targetEntityType: 'client',
          targetEntityId: client.id,
          title: `${client.name}: upsell candidate with ${marginSurplus.toFixed(1)}pp margin surplus`,
          description:
            `Client "${client.name}" has a margin of ${currentMargin.toFixed(1)}%, ` +
            `which is ${marginSurplus.toFixed(1)}pp above the target of ${marginTarget2.toFixed(1)}%. ` +
            `This client could absorb additional services while maintaining healthy margins.`,
          estimatedMonthlyImpact: potentialAdditionalRevenue,
          confidenceLevel: confidence,
          supportingData: {
            check: 'upsell_candidate',
            current_margin: currentMargin,
            target_margin: marginTarget2,
            surplus_pts: Number(marginSurplus.toFixed(2)),
            current_revenue: currentRevenue,
            data_months: dataMonths,
          },
        });
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unknown error';
      errors.push(
        `revenue-analyzer: error processing client ${client.id} (${client.name}) - ${message}`
      );
    }
  }

  return { recommendations, errors };
}
