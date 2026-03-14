/**
 * Staffing Analyzer for the CFO Strategist recommendation engine.
 *
 * Analyzes staff and contractor costs relative to revenue, identifying:
 * - Low utilization (too few active client assignments)
 * - Cost-to-revenue outliers (ratio significantly above company average)
 * - Clients where contractor costs exceed attributed revenue
 * - Reallocation opportunities (under-utilized staff + high-need clients)
 */

import { prisma } from '@/lib/prisma';
import { calculateClientCosts, getClientRevenue } from '@/lib/calculations/client-roi';
import {
  calculateAttributedRevenue,
  calculateBDRTotalCost,
} from '@/lib/calculations/bdr-roi';
import {
  resolveEffectiveTarget,
  determineAlertLevel,
} from '@/lib/calculations/utilization-targets';
import type {
  AnalyzerResult,
  RecommendationInput,
  ThresholdConfig,
} from '../types';

// ---------------------------------------------------------------------------
// Confidence levels based on data availability
// ---------------------------------------------------------------------------

/** 3+ months of data with a clear pattern. */
const CONFIDENCE_HIGH = 0.85;
/** 2 months of data. */
const CONFIDENCE_MEDIUM = 0.6;
/** 1 month or inferred data. */
const CONFIDENCE_LOW = 0.35;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Determine confidence level based on the number of historical ClientROI
 * records available for a given entity's assigned clients.
 */
async function resolveConfidence(
  clientIds: string[],
  organizationId: string,
): Promise<number> {
  if (clientIds.length === 0) return CONFIDENCE_LOW;

  const roiCount = await prisma.clientROI.count({
    where: {
      client_id: { in: clientIds },
      client: { organization_id: organizationId },
    },
  });

  // Average months of data per client
  const avgMonths = roiCount / clientIds.length;

  if (avgMonths >= 3) return CONFIDENCE_HIGH;
  if (avgMonths >= 2) return CONFIDENCE_MEDIUM;
  return CONFIDENCE_LOW;
}

/**
 * Identify clients that have high unmet staffing needs -- those with the
 * worst margin relative to their target and no recent staff additions.
 * Returns the top N client IDs sorted by margin gap (worst first).
 */
async function findHighNeedClients(
  organizationId: string,
  month: number,
  year: number,
  limit: number = 5,
): Promise<Array<{ clientId: string; clientName: string; marginGap: number }>> {
  const recentROIs = await prisma.clientROI.findMany({
    where: {
      month,
      year,
      client: {
        organization_id: organizationId,
        status: 'ACTIVE',
        deleted_at: null,
      },
    },
    include: { client: { select: { id: true, name: true, custom_margin_target: true } } },
    orderBy: { margin_percentage: 'asc' },
    take: limit,
  });

  return recentROIs.map((roi) => ({
    clientId: roi.client.id,
    clientName: roi.client.name,
    marginGap: Number(roi.margin_percentage) - Number(roi.client.custom_margin_target ?? 25),
  }));
}

// ---------------------------------------------------------------------------
// Main analyzer
// ---------------------------------------------------------------------------

/**
 * Analyze staff and contractor utilization, cost efficiency, and
 * reallocation opportunities for an organization.
 */
export async function analyzeStaffing(
  organizationId: string,
  month: number,
  year: number,
  thresholds: ThresholdConfig,
): Promise<AnalyzerResult> {
  const recommendations: RecommendationInput[] = [];
  const errors: string[] = [];
  const now = new Date();

  // -----------------------------------------------------------------------
  // 1. Fetch all non-deleted staff (excluding OWNERs)
  // -----------------------------------------------------------------------

  const staffMembers = await prisma.staff.findMany({
    where: {
      organization_id: organizationId,
      deleted_at: null,
      engagement_type: { not: 'OWNER' },
    },
    include: {
      assignments: {
        where: {
          OR: [{ end_date: null }, { end_date: { gt: now } }],
        },
        include: { client: { select: { id: true, name: true } } },
      },
    },
  });

  // -----------------------------------------------------------------------
  // 2. Compute per-staff cost and attributed revenue
  // -----------------------------------------------------------------------

  interface StaffMetrics {
    id: string;
    name: string;
    staffType: string;
    engagementType: string;
    activeAssignmentCount: number;
    clientIds: string[];
    totalCost: number;
    attributedRevenue: number;
    costToRevenueRatio: number;
  }

  const staffMetricsList: StaffMetrics[] = [];

  for (const staff of staffMembers) {
    try {
      const activeAssignments = staff.assignments;
      const activeAssignmentCount = activeAssignments.length;
      const clientIds = activeAssignments.map((a) => a.client.id);

      // Cost: base rate + bonuses
      const { totalCost } = await calculateBDRTotalCost(staff.id, month, year);

      // Revenue: sum of attributed revenue across all client assignments
      const attributedRevenue = await calculateAttributedRevenue(
        staff.id,
        month,
        year,
      );

      const costToRevenueRatio =
        attributedRevenue > 0 ? totalCost / attributedRevenue : Infinity;

      staffMetricsList.push({
        id: staff.id,
        name: staff.name,
        staffType: staff.staff_type,
        engagementType: staff.engagement_type,
        activeAssignmentCount,
        clientIds,
        totalCost,
        attributedRevenue,
        costToRevenueRatio,
      });
    } catch (err) {
      errors.push(
        `Failed to compute metrics for staff "${staff.name}" (${staff.id}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  // -----------------------------------------------------------------------
  // 3. Company average cost-to-revenue ratio (finite values only)
  // -----------------------------------------------------------------------

  const finiteRatios = staffMetricsList
    .map((m) => m.costToRevenueRatio)
    .filter((r) => Number.isFinite(r));

  const companyAvgRatio =
    finiteRatios.length > 0
      ? finiteRatios.reduce((sum, r) => sum + r, 0) / finiteRatios.length
      : 1;

  // -----------------------------------------------------------------------
  // 4. Generate recommendations per staff member
  // -----------------------------------------------------------------------

  for (const metrics of staffMetricsList) {
    try {
      const confidence = await resolveConfidence(
        metrics.clientIds,
        organizationId,
      );

      // -- 4a. Low utilization -----------------------------------------------
      if (
        metrics.activeAssignmentCount <
        thresholds.staffing_utilization_min_assignments
      ) {
        const estimatedWaste =
          metrics.totalCost *
          (1 -
            metrics.activeAssignmentCount /
              thresholds.staffing_utilization_min_assignments);

        recommendations.push({
          category: 'STAFFING_EFFICIENCY',
          targetEntityType: 'staff',
          targetEntityId: metrics.id,
          title: `Low utilization: ${metrics.name} has ${metrics.activeAssignmentCount} active assignment(s)`,
          description:
            `${metrics.name} (${metrics.staffType}) currently has only ` +
            `${metrics.activeAssignmentCount} active client assignment(s), below the ` +
            `minimum threshold of ${thresholds.staffing_utilization_min_assignments}. ` +
            `Consider assigning additional clients or reviewing capacity allocation.`,
          estimatedMonthlyImpact: Math.round(estimatedWaste * 100) / 100,
          confidenceLevel: confidence,
          supportingData: {
            staffName: metrics.name,
            staffType: metrics.staffType,
            activeAssignments: metrics.activeAssignmentCount,
            threshold: thresholds.staffing_utilization_min_assignments,
            monthlyCost: metrics.totalCost,
          },
        });
      }

      // -- 4b. Cost-to-revenue outlier ---------------------------------------
      if (
        Number.isFinite(metrics.costToRevenueRatio) &&
        metrics.costToRevenueRatio >
          companyAvgRatio * thresholds.staffing_cost_ratio_multiplier
      ) {
        const excessCost =
          metrics.totalCost -
          metrics.attributedRevenue * companyAvgRatio;

        recommendations.push({
          category: 'STAFFING_EFFICIENCY',
          targetEntityType: 'staff',
          targetEntityId: metrics.id,
          title: `Cost-to-revenue outlier: ${metrics.name}`,
          description:
            `${metrics.name}'s cost-to-revenue ratio ` +
            `(${metrics.costToRevenueRatio.toFixed(2)}) is more than ` +
            `${thresholds.staffing_cost_ratio_multiplier}x the company average ` +
            `(${companyAvgRatio.toFixed(2)}). Review rate or assignment mix.`,
          estimatedMonthlyImpact:
            Math.round(Math.max(excessCost, 0) * 100) / 100,
          confidenceLevel: confidence,
          supportingData: {
            staffName: metrics.name,
            staffType: metrics.staffType,
            costToRevenueRatio: metrics.costToRevenueRatio,
            companyAvgRatio,
            monthlyCost: metrics.totalCost,
            attributedRevenue: metrics.attributedRevenue,
            thresholdMultiplier: thresholds.staffing_cost_ratio_multiplier,
          },
        });
      }

      // -- 4c. Clients where contractor costs exceed revenue -----------------
      const staffRecord = staffMembers.find((s) => s.id === metrics.id);
      for (const assignment of staffRecord?.assignments ?? []) {
        try {
          const clientCosts = await calculateClientCosts(
            assignment.client_id,
            month,
            year,
            organizationId,
          );

          const clientRevenue = await getClientRevenue(
            assignment.client_id,
            month,
            year,
          );

          if (clientCosts.contractorCosts > clientRevenue && clientRevenue > 0) {
            const overspend = clientCosts.contractorCosts - clientRevenue;

            recommendations.push({
              category: 'STAFFING_EFFICIENCY',
              targetEntityType: 'staff',
              targetEntityId: metrics.id,
              title: `Contractor costs exceed revenue for client ${assignment.client.name}`,
              description:
                `Client "${assignment.client.name}" has contractor costs of ` +
                `$${clientCosts.contractorCosts.toFixed(2)} which exceed ` +
                `its revenue of $${clientRevenue.toFixed(2)}. ` +
                `${metrics.name} is assigned to this client. ` +
                `Consider renegotiating rates or reallocating resources.`,
              estimatedMonthlyImpact: Math.round(overspend * 100) / 100,
              confidenceLevel: confidence,
              supportingData: {
                staffName: metrics.name,
                clientId: assignment.client_id,
                clientName: assignment.client.name,
                contractorCosts: clientCosts.contractorCosts,
                clientRevenue,
                totalClientCosts: clientCosts.totalCosts,
                overspend,
              },
            });
          }
        } catch (err) {
          errors.push(
            `Failed to check contractor costs for client "${assignment.client.name}" ` +
              `(staff: ${metrics.name}): ${
                err instanceof Error ? err.message : String(err)
              }`,
          );
        }
      }
    } catch (err) {
      errors.push(
        `Failed to generate recommendations for staff "${metrics.name}" (${metrics.id}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  // -----------------------------------------------------------------------
  // 5. Reallocation opportunities: under-utilized staff + high-need clients
  // -----------------------------------------------------------------------

  try {
    const underUtilized = staffMetricsList.filter(
      (m) =>
        m.activeAssignmentCount <
        thresholds.staffing_utilization_min_assignments,
    );

    if (underUtilized.length > 0) {
      const highNeedClients = await findHighNeedClients(
        organizationId,
        month,
        year,
      );

      for (const staff of underUtilized) {
        // Only suggest clients the staff member is NOT already assigned to
        const unassignedHighNeed = highNeedClients.filter(
          (c) => !staff.clientIds.includes(c.clientId),
        );

        if (unassignedHighNeed.length === 0) continue;

        const topCandidate = unassignedHighNeed[0];
        const confidence = await resolveConfidence(
          [topCandidate.clientId],
          organizationId,
        );

        recommendations.push({
          category: 'STAFFING_EFFICIENCY',
          targetEntityType: 'staff',
          targetEntityId: staff.id,
          title: `Reallocation opportunity: assign ${staff.name} to ${topCandidate.clientName}`,
          description:
            `${staff.name} (${staff.staffType}) has capacity with only ` +
            `${staff.activeAssignmentCount} active assignment(s). ` +
            `"${topCandidate.clientName}" has a margin gap of ` +
            `${topCandidate.marginGap.toFixed(1)} points and could benefit ` +
            `from additional ${staff.staffType} support.`,
          estimatedMonthlyImpact: 0, // Speculative -- no direct savings
          confidenceLevel: confidence,
          supportingData: {
            staffName: staff.name,
            staffType: staff.staffType,
            currentAssignments: staff.activeAssignmentCount,
            suggestedClientId: topCandidate.clientId,
            suggestedClientName: topCandidate.clientName,
            clientMarginGap: topCandidate.marginGap,
            candidateClients: unassignedHighNeed.map((c) => ({
              clientId: c.clientId,
              clientName: c.clientName,
              marginGap: c.marginGap,
            })),
          },
        });
      }
    }
  } catch (err) {
    errors.push(
      `Failed to compute reallocation opportunities: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  // -----------------------------------------------------------------------
  // 6. Contractor-specific analysis
  // -----------------------------------------------------------------------

  try {
    const contractors = await prisma.contractor.findMany({
      where: {
        organization_id: organizationId,
        deleted_at: null,
      },
      include: {
        assignments: {
          where: {
            OR: [{ end_date: null }, { end_date: { gt: now } }],
          },
          include: { client: { select: { id: true, name: true } } },
        },
      },
    });

    for (const contractor of contractors) {
      try {
        const activeAssignments = contractor.assignments;

        // Flag contractors with zero active assignments
        if (activeAssignments.length === 0 && contractor.rate != null) {
          const monthlyCost = Number(contractor.rate);

          recommendations.push({
            category: 'STAFFING_EFFICIENCY',
            targetEntityType: 'contractor',
            targetEntityId: contractor.id,
            title: `Unassigned contractor: ${contractor.name}`,
            description:
              `Contractor "${contractor.name}" has no active client assignments ` +
              `but may still incur costs. Review whether this contractor ` +
              `should be reassigned or their engagement ended.`,
            estimatedMonthlyImpact: Math.round(monthlyCost * 100) / 100,
            confidenceLevel: CONFIDENCE_LOW,
            supportingData: {
              contractorName: contractor.name,
              activeAssignments: 0,
              estimatedMonthlyCost: monthlyCost,
              engagementType: contractor.engagement_type,
            },
          });
        }

        // Check each contractor assignment for cost > revenue
        for (const assignment of activeAssignments) {
          try {
            const clientCosts = await calculateClientCosts(
              assignment.client_id,
              month,
              year,
              organizationId,
            );

            const clientRevenue = await getClientRevenue(
              assignment.client_id,
              month,
              year,
            );

            if (
              clientCosts.contractorCosts > clientRevenue &&
              clientRevenue > 0
            ) {
              const overspend = clientCosts.contractorCosts - clientRevenue;
              const clientIds = activeAssignments.map((a) => a.client.id);
              const confidence = await resolveConfidence(
                clientIds,
                organizationId,
              );

              recommendations.push({
                category: 'STAFFING_EFFICIENCY',
                targetEntityType: 'contractor',
                targetEntityId: contractor.id,
                title: `Contractor costs exceed revenue: ${contractor.name} on ${assignment.client.name}`,
                description:
                  `Client "${assignment.client.name}" has contractor costs of ` +
                  `$${clientCosts.contractorCosts.toFixed(2)} exceeding revenue ` +
                  `of $${clientRevenue.toFixed(2)}. Contractor "${contractor.name}" ` +
                  `is assigned to this client. Consider rate renegotiation or ` +
                  `reducing allocation.`,
                estimatedMonthlyImpact: Math.round(overspend * 100) / 100,
                confidenceLevel: confidence,
                supportingData: {
                  contractorName: contractor.name,
                  clientId: assignment.client_id,
                  clientName: assignment.client.name,
                  contractorCosts: clientCosts.contractorCosts,
                  clientRevenue,
                  totalClientCosts: clientCosts.totalCosts,
                  overspend,
                },
              });
            }
          } catch (err) {
            errors.push(
              `Failed to check contractor costs for "${contractor.name}" ` +
                `on client "${assignment.client.name}": ${
                  err instanceof Error ? err.message : String(err)
                }`,
            );
          }
        }
      } catch (err) {
        errors.push(
          `Failed to analyze contractor "${contractor.name}" (${contractor.id}): ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
  } catch (err) {
    errors.push(
      `Failed to fetch contractors: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  // -----------------------------------------------------------------------
  // 7. Utilization snapshot analysis — surface chronic low-utilization staff
  // -----------------------------------------------------------------------

  try {
    // Fetch utilization targets for threshold resolution
    const utilizationTargets = await prisma.utilizationTarget.findMany({
      where: {
        organization_id: organizationId,
        deleted_at: null,
      },
      select: {
        staff_type: true,
        target_rate: true,
        warning_threshold: true,
        critical_threshold: true,
        standard_daily_hours: true,
        enabled: true,
      },
    });

    const targetsNumeric = utilizationTargets.map((t) => ({
      staff_type: t.staff_type,
      target_rate: Number(t.target_rate),
      warning_threshold: Number(t.warning_threshold),
      critical_threshold: Number(t.critical_threshold),
      standard_daily_hours: Number(t.standard_daily_hours),
      enabled: t.enabled,
    }));

    // Find staff with multiple recent snapshots below warning threshold
    // Look at the last 3 monthly snapshots for each staff member
    const recentSnapshots = await prisma.utilizationSnapshot.findMany({
      where: {
        organization_id: organizationId,
        staff: {
          deleted_at: null,
          engagement_type: { not: 'OWNER' },
        },
      },
      orderBy: { period_end: 'desc' },
      select: {
        staff_id: true,
        utilization_rate: true,
        bench_cost: true,
        period_start: true,
        period_end: true,
        staff: {
          select: {
            id: true,
            name: true,
            staff_type: true,
          },
        },
      },
    });

    // Group snapshots by staff_id and take up to 3 most recent per staff
    const snapshotsByStaff = new Map<
      string,
      Array<{
        utilization_rate: number;
        bench_cost: number;
        period_start: Date;
        period_end: Date;
        staff_name: string;
        staff_type: string;
      }>
    >();

    for (const snap of recentSnapshots) {
      const existing = snapshotsByStaff.get(snap.staff_id) ?? [];
      if (existing.length < 3) {
        existing.push({
          utilization_rate: Number(snap.utilization_rate),
          bench_cost: Number(snap.bench_cost),
          period_start: snap.period_start,
          period_end: snap.period_end,
          staff_name: snap.staff.name,
          staff_type: snap.staff.staff_type,
        });
        snapshotsByStaff.set(snap.staff_id, existing);
      }
    }

    // Analyze each staff member's utilization trend
    for (const [staffId, staffSnapshots] of snapshotsByStaff) {
      if (staffSnapshots.length === 0) continue;

      const staffType = staffSnapshots[0].staff_type;
      const staffName = staffSnapshots[0].staff_name;
      const effectiveTarget = resolveEffectiveTarget(targetsNumeric, staffType);

      // Count how many periods are below warning threshold
      const belowWarning = staffSnapshots.filter(
        (s) => s.utilization_rate < effectiveTarget.warning_threshold
      );
      const belowCritical = staffSnapshots.filter(
        (s) => s.utilization_rate < effectiveTarget.critical_threshold
      );

      // Only flag staff with persistent low utilization (2+ periods below warning)
      if (belowWarning.length < 2) continue;

      const avgRate =
        staffSnapshots.reduce((sum, s) => sum + s.utilization_rate, 0) /
        staffSnapshots.length;
      const totalBenchCost = staffSnapshots.reduce(
        (sum, s) => sum + s.bench_cost,
        0
      );
      const monthsBelow = belowWarning.length;

      const isCritical = belowCritical.length >= 2;
      const confidence = staffSnapshots.length >= 3 ? CONFIDENCE_HIGH : CONFIDENCE_MEDIUM;

      recommendations.push({
        category: 'STAFFING_EFFICIENCY',
        targetEntityType: 'staff',
        targetEntityId: staffId,
        title: `Chronic low utilization: ${staffName} at ${avgRate.toFixed(1)}% avg`,
        description:
          `${staffName} (${staffType}) has been below the ${
            isCritical ? 'critical' : 'warning'
          } utilization threshold for ${monthsBelow} of the last ${staffSnapshots.length} periods, ` +
          `averaging ${avgRate.toFixed(1)}% utilization (target: ${effectiveTarget.target_rate}%). ` +
          `Total bench cost over this period: $${totalBenchCost.toFixed(2)}. ` +
          `Consider reassigning to higher-need clients or reviewing capacity allocation.`,
        estimatedMonthlyImpact:
          Math.round((totalBenchCost / staffSnapshots.length) * 100) / 100,
        confidenceLevel: confidence,
        supportingData: {
          staffName,
          staffType,
          averageUtilization: avgRate,
          targetRate: effectiveTarget.target_rate,
          warningThreshold: effectiveTarget.warning_threshold,
          criticalThreshold: effectiveTarget.critical_threshold,
          periodsAnalyzed: staffSnapshots.length,
          periodsBelowWarning: monthsBelow,
          periodsBelowCritical: belowCritical.length,
          totalBenchCost,
          snapshotDetails: staffSnapshots.map((s) => ({
            periodStart: s.period_start.toISOString(),
            periodEnd: s.period_end.toISOString(),
            utilizationRate: s.utilization_rate,
            benchCost: s.bench_cost,
          })),
        },
      });
    }
  } catch (err) {
    errors.push(
      `Failed to analyze utilization snapshots: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  return { recommendations, errors };
}
