'use server';

import { prisma } from '@/lib/prisma';
import { getOrganizationId } from '@/lib/auth/organization';
import { revalidatePath } from 'next/cache';
import {
  getCompanyMarginTarget,
  getAllClientMarginTargets,
} from '@/lib/cfo-strategist/margin-goals';
import { getEffectiveThresholds } from '@/lib/cfo-strategist/thresholds';
import { projectNextMonthMargin } from '@/lib/cfo-strategist/forecasting';
import { DEFAULT_THRESHOLDS, type ThresholdConfig, type DashboardData, type ReportContent } from '@/lib/cfo-strategist/types';
import { generateRecommendations } from '@/lib/cfo-strategist/recommendation-engine';

// ============================================================================
// Margin Goals (T011, T012)
// ============================================================================

/**
 * T011: Fetch current margin goal configuration.
 */
export async function getMarginGoals() {
  const organizationId = await getOrganizationId();

  const [companyTarget, globalTarget, clients] = await Promise.all([
    getCompanyMarginTarget(organizationId),
    prisma.financialTarget.findFirst({
      where: { organization_id: organizationId, scope: 'GLOBAL' },
      orderBy: { created_at: 'desc' },
      select: { id: true },
    }),
    prisma.client.findMany({
      where: {
        organization_id: organizationId,
        status: 'ACTIVE',
        deleted_at: null,
      },
      select: {
        id: true,
        name: true,
        custom_margin_target: true,
      },
      orderBy: { name: 'asc' },
    }),
  ]);

  return {
    companyTarget,
    companyTargetId: globalTarget?.id ?? null,
    clientOverrides: clients
      .filter((c) => c.custom_margin_target != null)
      .map((c) => ({
        clientId: c.id,
        clientName: c.name,
        target: Number(c.custom_margin_target),
      })),
    allClients: clients.map((c) => ({
      clientId: c.id,
      clientName: c.name,
      target: c.custom_margin_target != null ? Number(c.custom_margin_target) : null,
    })),
  };
}

/**
 * T012: Create or update a margin goal.
 */
export async function updateMarginGoal(
  data:
    | { scope: 'GLOBAL'; targetMargin: number }
    | { scope: 'CLIENT'; clientId: string; targetMargin: number | null }
): Promise<{ success: boolean; error?: string }> {
  const organizationId = await getOrganizationId();

  if (data.scope === 'GLOBAL') {
    if (data.targetMargin < 0 || data.targetMargin > 100) {
      return { success: false, error: 'Target margin must be between 0 and 100' };
    }

    // Upsert the GLOBAL financial target
    const existing = await prisma.financialTarget.findFirst({
      where: { organization_id: organizationId, scope: 'GLOBAL' },
      orderBy: { created_at: 'desc' },
    });

    if (existing) {
      await prisma.financialTarget.update({
        where: { id: existing.id },
        data: { target_margin: data.targetMargin },
      });
    } else {
      const now = new Date();
      const fiscalPeriod = `FY-${now.getFullYear()}`;
      await prisma.financialTarget.create({
        data: {
          organization_id: organizationId,
          scope: 'GLOBAL',
          target_margin: data.targetMargin,
          fiscal_period: fiscalPeriod,
        },
      });
    }
  } else {
    // CLIENT scope
    if (data.targetMargin !== null && (data.targetMargin < 0 || data.targetMargin > 100)) {
      return { success: false, error: 'Target margin must be between 0 and 100' };
    }

    const client = await prisma.client.findFirst({
      where: { id: data.clientId, organization_id: organizationId },
    });

    if (!client) {
      return { success: false, error: 'Client not found' };
    }

    await prisma.client.update({
      where: { id: data.clientId },
      data: { custom_margin_target: data.targetMargin },
    });
  }

  revalidatePath('/dashboard/settings');
  return { success: true };
}

// ============================================================================
// Analyzer Thresholds (T014d)
// ============================================================================

/**
 * T014d: Fetch current analyzer threshold configuration.
 */
export async function getAnalyzerThresholds() {
  const organizationId = await getOrganizationId();
  const thresholds = await getEffectiveThresholds(organizationId);
  return { thresholds, defaults: DEFAULT_THRESHOLDS };
}

/**
 * T014d: Update analyzer thresholds.
 */
export async function updateAnalyzerThresholds(
  updates: Partial<ThresholdConfig>
): Promise<{ success: boolean; error?: string }> {
  const organizationId = await getOrganizationId();

  // Validate numeric ranges
  if (updates.subscription_allocation_pct != null) {
    if (updates.subscription_allocation_pct < 0 || updates.subscription_allocation_pct > 100) {
      return { success: false, error: 'Subscription allocation threshold must be 0-100%' };
    }
  }
  if (updates.subscription_cost_increase_pct != null) {
    if (updates.subscription_cost_increase_pct < 0 || updates.subscription_cost_increase_pct > 100) {
      return { success: false, error: 'Subscription cost increase threshold must be 0-100%' };
    }
  }
  if (updates.staffing_utilization_min_assignments != null) {
    if (updates.staffing_utilization_min_assignments < 0 || updates.staffing_utilization_min_assignments > 50) {
      return { success: false, error: 'Staffing utilization threshold must be 0-50' };
    }
  }
  if (updates.staffing_cost_ratio_multiplier != null) {
    if (updates.staffing_cost_ratio_multiplier < 0.1 || updates.staffing_cost_ratio_multiplier > 10) {
      return { success: false, error: 'Cost ratio multiplier must be 0.1-10' };
    }
  }
  if (updates.revenue_margin_gap_pts != null) {
    if (updates.revenue_margin_gap_pts < 0 || updates.revenue_margin_gap_pts > 100) {
      return { success: false, error: 'Revenue margin gap must be 0-100 points' };
    }
  }
  if (updates.revenue_decline_months != null) {
    if (updates.revenue_decline_months < 1 || updates.revenue_decline_months > 12) {
      return { success: false, error: 'Revenue decline months must be 1-12' };
    }
  }

  // Merge with existing stored overrides
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { analyzer_thresholds: true },
  });

  const existing = (org?.analyzer_thresholds ?? {}) as Partial<ThresholdConfig>;
  const merged = { ...existing, ...updates };

  await prisma.organization.update({
    where: { id: organizationId },
    data: { analyzer_thresholds: merged },
  });

  revalidatePath('/dashboard/settings');
  return { success: true };
}

// ============================================================================
// Dashboard Data (T020)
// ============================================================================

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * T020: Fetch all data for the CFO Strategist dashboard.
 * Aggregates margin history, recommendations, client margins, forecasting,
 * and alert counts into a single DashboardData shape.
 */
export async function getStrategistDashboard(): Promise<DashboardData> {
  const organizationId = await getOrganizationId();

  const [
    companyTarget,
    forecast,
    companyMetrics,
    recCounts,
    topRecs,
    activeClients,
    clientTargets,
    alertCount,
    actedWithSavings,
  ] = await Promise.all([
    // Company margin target (already imported)
    getCompanyMarginTarget(organizationId),

    // Projected next-month margin via linear regression
    projectNextMonthMargin(organizationId),

    // Last 6 months of company metrics, newest first
    prisma.companyMetrics.findMany({
      where: { organization_id: organizationId },
      orderBy: { period_start: 'desc' },
      take: 6,
      select: {
        period_start: true,
        portfolio_margin: true,
        total_revenue: true,
        total_expenses: true,
      },
    }),

    // Active recommendation counts grouped by category
    prisma.cfoRecommendation.groupBy({
      by: ['category'],
      where: {
        organization_id: organizationId,
        status: 'ACTIVE',
        deleted_at: null,
      },
      _count: { id: true },
    }),

    // Top 3 active recommendations by estimated monthly impact
    prisma.cfoRecommendation.findMany({
      where: {
        organization_id: organizationId,
        status: 'ACTIVE',
        deleted_at: null,
      },
      orderBy: { estimated_monthly_impact: 'desc' },
      take: 3,
      select: {
        id: true,
        title: true,
        category: true,
        estimated_monthly_impact: true,
        confidence_level: true,
        supporting_data: true,
      },
    }),

    // All active non-internal clients with their latest ClientROI
    prisma.client.findMany({
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
          take: 1,
          select: {
            month: true,
            year: true,
            revenue: true,
            total_costs: true,
            margin_percentage: true,
          },
        },
        _count: {
          select: { roi_metrics: true },
        },
      },
    }),

    // All client margin targets (Map<clientId, target>)
    getAllClientMarginTargets(organizationId),

    // Unread notifications from CFO_STRATEGIST
    prisma.notification.count({
      where: {
        organization_id: organizationId,
        source: 'CFO_STRATEGIST',
        read_at: null,
      },
    }),

    // T047: ACTED_ON recommendations with realized_savings for accuracy score
    prisma.cfoRecommendation.findMany({
      where: {
        organization_id: organizationId,
        status: 'ACTED_ON',
        realized_savings: { not: null },
        deleted_at: null,
      },
      select: {
        acted_on_expected_savings: true,
        realized_savings: true,
      },
    }),
  ]);

  // ---------------------------------------------------------------------------
  // Margin History (oldest-first)
  // ---------------------------------------------------------------------------
  const marginHistory = [...companyMetrics].reverse().map((m) => {
    const d = new Date(m.period_start);
    const month = d.getMonth() + 1;
    const year = d.getFullYear();
    return {
      month,
      year,
      label: `${MONTH_LABELS[month - 1]} ${year}`,
      margin: Number(m.portfolio_margin),
      target: companyTarget,
      revenue: Number(m.total_revenue),
      expenses: Number(m.total_expenses),
    };
  });

  // ---------------------------------------------------------------------------
  // Current margin & trend
  // ---------------------------------------------------------------------------
  const currentMargin =
    companyMetrics.length > 0 ? Number(companyMetrics[0].portfolio_margin) : 0;

  let marginTrend: DashboardData['marginTrend'] = 'NEW';
  let marginChangePercent = 0;

  if (companyMetrics.length >= 2) {
    const priorMargin = Number(companyMetrics[1].portfolio_margin);
    marginChangePercent = Math.abs(currentMargin - priorMargin);
    if (currentMargin > priorMargin) {
      marginTrend = 'UP';
    } else if (currentMargin < priorMargin) {
      marginTrend = 'DOWN';
    } else {
      marginTrend = 'FLAT';
    }
  } else if (companyMetrics.length === 1) {
    marginTrend = 'NEW';
  }

  // ---------------------------------------------------------------------------
  // Projected margin
  // ---------------------------------------------------------------------------
  const projectedMargin = forecast?.projectedMargin ?? currentMargin;

  // ---------------------------------------------------------------------------
  // Recommendation counts
  // ---------------------------------------------------------------------------
  const countMap: Record<string, number> = {};
  for (const row of recCounts) {
    countMap[row.category] = row._count.id;
  }
  const recommendationCounts = {
    subscription: countMap['SUBSCRIPTION_OPTIMIZATION'] ?? 0,
    staffing: countMap['STAFFING_EFFICIENCY'] ?? 0,
    revenue: countMap['REVENUE_OPPORTUNITY'] ?? 0,
    overhead: countMap['OVERHEAD_REDUCTION'] ?? 0,
    total:
      (countMap['SUBSCRIPTION_OPTIMIZATION'] ?? 0) +
      (countMap['STAFFING_EFFICIENCY'] ?? 0) +
      (countMap['REVENUE_OPPORTUNITY'] ?? 0) +
      (countMap['OVERHEAD_REDUCTION'] ?? 0),
  };

  // ---------------------------------------------------------------------------
  // Top recommendations
  // ---------------------------------------------------------------------------
  const topRecommendations = topRecs.map((r) => {
    const supportingData = (r.supporting_data ?? {}) as Record<string, unknown>;
    return {
      id: r.id,
      title: r.title,
      category: r.category,
      estimatedMonthlyImpact: Number(r.estimated_monthly_impact),
      confidenceLevel: Number(r.confidence_level),
      hasTradeOff: Boolean(supportingData.has_trade_off),
    };
  });

  // ---------------------------------------------------------------------------
  // Client margins
  // ---------------------------------------------------------------------------
  const clientMargins = activeClients
    .map((client) => {
      const latestRoi = client.roi_metrics[0] ?? null;
      const margin = latestRoi ? Number(latestRoi.margin_percentage) : 0;
      const revenue = latestRoi ? Number(latestRoi.revenue) : 0;
      const costs = latestRoi ? Number(latestRoi.total_costs) : 0;
      const target = clientTargets.get(client.id) ?? companyTarget;
      const isNewClient = client._count.roi_metrics < 2;

      let status: 'above' | 'near' | 'below';
      if (margin >= target) {
        status = 'above';
      } else if (margin >= target - 5) {
        status = 'near';
      } else {
        status = 'below';
      }

      return {
        clientId: client.id,
        clientName: client.name,
        margin,
        target,
        status,
        revenue,
        costs,
        isNewClient,
      };
    })
    .sort((a, b) => a.margin - b.margin);

  // ---------------------------------------------------------------------------
  // Assemble response
  // ---------------------------------------------------------------------------
  return {
    currentMargin,
    targetMargin: companyTarget,
    marginTrend,
    marginChangePercent,
    projectedMargin,
    marginHistory,
    recommendationCounts,
    topRecommendations,
    clientMargins,
    accuracyScore: actedWithSavings.length > 0
      ? Math.round(
          (actedWithSavings.filter(
            (r) => Number(r.realized_savings) >= Number(r.acted_on_expected_savings ?? 0)
          ).length / actedWithSavings.length) * 100
        )
      : null,
    activeAlerts: alertCount,
  };
}

// ============================================================================
// Recommendation Management (T028, T029)
// ============================================================================

/**
 * T028: Fetch recommendations with optional category/status filters.
 * Returns enriched recommendations with resolved entity names and trade-off metadata.
 */
export async function getRecommendations(filters?: {
  category?: string;
  status?: string;
}) {
  const organizationId = await getOrganizationId();

  // Build where clause
  const where: Record<string, unknown> = {
    organization_id: organizationId,
    deleted_at: null,
  };
  if (filters?.category && filters.category !== 'all') {
    where.category = filters.category;
  }
  if (filters?.status && filters.status !== 'all') {
    where.status = filters.status;
  }

  const recommendations = await prisma.cfoRecommendation.findMany({
    where,
    orderBy: { estimated_monthly_impact: 'desc' },
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      status: true,
      target_entity_type: true,
      target_entity_id: true,
      estimated_monthly_impact: true,
      confidence_level: true,
      supporting_data: true,
      acted_on_at: true,
      acted_on_expected_savings: true,
      dismissed_reason: true,
      deferred_until: true,
      created_at: true,
    },
  });

  // Resolve target entity names in parallel
  const enriched = await Promise.all(
    recommendations.map(async (rec) => {
      let targetEntityName: string = rec.target_entity_id;

      try {
        switch (rec.target_entity_type) {
          case 'subscription': {
            const entity = await prisma.subscription.findUnique({
              where: { id: rec.target_entity_id },
              select: { name: true },
            });
            if (entity) targetEntityName = entity.name;
            break;
          }
          case 'staff': {
            const entity = await prisma.staff.findUnique({
              where: { id: rec.target_entity_id },
              select: { name: true },
            });
            if (entity) targetEntityName = entity.name;
            break;
          }
          case 'contractor': {
            const entity = await prisma.contractor.findUnique({
              where: { id: rec.target_entity_id },
              select: { name: true },
            });
            if (entity) targetEntityName = entity.name;
            break;
          }
          case 'client': {
            const entity = await prisma.client.findUnique({
              where: { id: rec.target_entity_id },
              select: { name: true },
            });
            if (entity) targetEntityName = entity.name;
            break;
          }
          case 'agency': {
            const entity = await prisma.agency.findUnique({
              where: { id: rec.target_entity_id },
              select: { name: true },
            });
            if (entity) targetEntityName = entity.name;
            break;
          }
          default:
            // Use target_entity_id as fallback
            break;
        }
      } catch {
        // Entity resolution failed — use target_entity_id as fallback
        targetEntityName = rec.target_entity_id;
      }

      const supportingData = (rec.supporting_data ?? {}) as Record<string, unknown>;

      return {
        id: rec.id,
        title: rec.title,
        description: rec.description,
        category: rec.category,
        status: rec.status,
        targetEntityType: rec.target_entity_type,
        targetEntityId: rec.target_entity_id,
        estimatedMonthlyImpact: Number(rec.estimated_monthly_impact),
        confidenceLevel: Number(rec.confidence_level),
        supportingData: rec.supporting_data,
        actedOnAt: rec.acted_on_at,
        actedOnExpectedSavings: rec.acted_on_expected_savings ? Number(rec.acted_on_expected_savings) : null,
        dismissedReason: rec.dismissed_reason,
        deferredUntil: rec.deferred_until,
        createdAt: rec.created_at,
        targetEntityName,
        hasTradeOff: Boolean(supportingData.has_trade_off),
        conflictingCategories: (supportingData.conflicting_categories as string[] | undefined) ?? [],
      };
    })
  );

  return enriched;
}

/**
 * T029: Update a recommendation's status (act, dismiss, or defer).
 * Only ACTIVE recommendations can be updated.
 */
export async function updateRecommendationStatus(
  id: string,
  action:
    | { type: 'act'; expectedSavings: number }
    | { type: 'dismiss'; reason: string }
    | { type: 'defer'; until: string }
): Promise<{ success: boolean; error?: string }> {
  const organizationId = await getOrganizationId();

  const rec = await prisma.cfoRecommendation.findFirst({
    where: { id, organization_id: organizationId, deleted_at: null },
  });

  if (!rec) {
    return { success: false, error: 'Recommendation not found' };
  }

  if (rec.status !== 'ACTIVE') {
    return { success: false, error: 'Only active recommendations can be updated' };
  }

  switch (action.type) {
    case 'act': {
      await prisma.cfoRecommendation.update({
        where: { id },
        data: {
          status: 'ACTED_ON',
          acted_on_at: new Date(),
          acted_on_expected_savings: action.expectedSavings,
          baseline_metric_value: rec.estimated_monthly_impact,
        },
      });
      break;
    }
    case 'dismiss': {
      await prisma.cfoRecommendation.update({
        where: { id },
        data: {
          status: 'DISMISSED',
          dismissed_reason: action.reason,
          dismissed_metric_snapshot: rec.estimated_monthly_impact,
        },
      });
      break;
    }
    case 'defer': {
      const deferDate = new Date(action.until);
      if (isNaN(deferDate.getTime())) {
        return { success: false, error: 'Invalid defer date' };
      }
      if (deferDate <= new Date()) {
        return { success: false, error: 'Defer date must be in the future' };
      }
      await prisma.cfoRecommendation.update({
        where: { id },
        data: {
          status: 'DEFERRED',
          deferred_until: deferDate,
        },
      });
      break;
    }
  }

  revalidatePath('/dashboard/strategist');
  return { success: true };
}

// ============================================================================
// Reports (T035, T036)
// ============================================================================

/**
 * T035: Fetch CFO reports with optional type filter and limit.
 * Returns a list of reports ordered by period start (newest first).
 */
export async function getCfoReports(
  type?: 'DAILY' | 'WEEKLY' | 'MONTHLY',
  limit: number = 10
) {
  const organizationId = await getOrganizationId();

  const where: Record<string, unknown> = {
    organization_id: organizationId,
    deleted_at: null,
  };
  if (type) {
    where.report_type = type;
  }

  const reports = await prisma.cfoReport.findMany({
    where,
    orderBy: { period_start: 'desc' },
    take: limit,
    select: {
      id: true,
      report_type: true,
      period_start: true,
      period_end: true,
      margin_actual: true,
      margin_target: true,
      total_revenue: true,
      total_expenses: true,
      recommendations_count: true,
      total_potential_savings: true,
      created_at: true,
    },
  });

  return reports.map((r) => ({
    id: r.id,
    reportType: r.report_type,
    periodStart: r.period_start,
    periodEnd: r.period_end,
    marginActual: Number(r.margin_actual),
    marginTarget: Number(r.margin_target),
    totalRevenue: Number(r.total_revenue),
    totalExpenses: Number(r.total_expenses),
    recommendationsCount: r.recommendations_count,
    totalPotentialSavings: Number(r.total_potential_savings),
    createdAt: r.created_at,
  }));
}

/**
 * T036: Fetch a single CFO report with full detail including report content.
 * Throws if the report is not found or does not belong to the organization.
 */
export async function getCfoReportDetail(id: string) {
  const organizationId = await getOrganizationId();

  const report = await prisma.cfoReport.findFirst({
    where: { id, organization_id: organizationId, deleted_at: null },
  });

  if (!report) {
    throw new Error('Report not found');
  }

  return {
    id: report.id,
    reportType: report.report_type,
    periodStart: report.period_start,
    periodEnd: report.period_end,
    marginActual: Number(report.margin_actual),
    marginTarget: Number(report.margin_target),
    totalRevenue: Number(report.total_revenue),
    totalExpenses: Number(report.total_expenses),
    recommendationsCount: report.recommendations_count,
    recommendationsActedCount: report.recommendations_acted_count,
    totalPotentialSavings: Number(report.total_potential_savings),
    reportContent: report.report_content as unknown as ReportContent,
    createdAt: report.created_at,
  };
}

// ============================================================================
// Refresh Recommendations (T044)
// ============================================================================

/**
 * T044: Manually refresh recommendations for the current organization.
 * Runs the full recommendation engine and returns summary counts.
 */
export async function refreshRecommendations() {
  const organizationId = await getOrganizationId();
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const result = await generateRecommendations(organizationId, month, year);

  revalidatePath('/dashboard/strategist');
  return result;
}
