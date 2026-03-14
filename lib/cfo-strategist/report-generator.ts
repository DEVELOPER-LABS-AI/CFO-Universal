/**
 * CFO Strategist report generator.
 *
 * Generates daily, weekly, and monthly reports and upserts them
 * into the CfoReport table by (org_id, report_type, period_start).
 */

import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getCompanyMarginTarget } from '@/lib/cfo-strategist/margin-goals';
import { projectNextMonthMargin } from '@/lib/cfo-strategist/forecasting';
import type {
  DailyReportContent,
  WeeklyReportContent,
  MonthlyReportContent,
} from '@/lib/cfo-strategist/types';

// ============================================================================
// Helpers
// ============================================================================

/** Returns a Date set to midnight UTC for today. */
function todayUTC(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Returns a Date N days before the given date. */
function daysAgo(date: Date, n: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

/** Returns period_start for the first day of the current month. */
function firstOfMonth(): Date {
  const d = todayUTC();
  d.setUTCDate(1);
  return d;
}

/** Returns period_start for the first day of the prior month. */
function firstOfPriorMonth(): Date {
  const d = firstOfMonth();
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d;
}

/** Maps a CfoRecommendationCategory enum to a human-friendly label. */
const CATEGORY_LABELS: Record<string, string> = {
  SUBSCRIPTION_OPTIMIZATION: 'Subscriptions',
  STAFFING_EFFICIENCY: 'Staffing',
  REVENUE_OPPORTUNITY: 'Revenue',
  OVERHEAD_REDUCTION: 'Overhead',
};

// ============================================================================
// Daily Report
// ============================================================================

/**
 * Generates a daily report containing margin snapshot, active alerts,
 * and top 3 recommendations by impact.
 */
export async function generateDailyReport(organizationId: string) {
  const today = todayUTC();

  const [target, latestMetrics, alerts, topRecs, activeRecCount] =
    await Promise.all([
      getCompanyMarginTarget(organizationId),
      prisma.companyMetrics.findFirst({
        where: { organization_id: organizationId },
        orderBy: { period_start: 'desc' },
        select: {
          portfolio_margin: true,
          total_revenue: true,
          total_expenses: true,
        },
      }),
      prisma.notification.findMany({
        where: {
          organization_id: organizationId,
          source: 'CFO_STRATEGIST',
          read_at: null,
        },
        orderBy: { created_at: 'desc' },
        take: 10,
        select: { title: true, message: true, type: true },
      }),
      prisma.cfoRecommendation.findMany({
        where: {
          organization_id: organizationId,
          status: 'ACTIVE',
          deleted_at: null,
        },
        orderBy: { estimated_monthly_impact: 'desc' },
        take: 3,
        select: {
          title: true,
          estimated_monthly_impact: true,
          category: true,
        },
      }),
      prisma.cfoRecommendation.count({
        where: {
          organization_id: organizationId,
          status: 'ACTIVE',
          deleted_at: null,
        },
      }),
    ]);

  const marginActual = latestMetrics
    ? Number(latestMetrics.portfolio_margin)
    : 0;
  const totalRevenue = latestMetrics
    ? Number(latestMetrics.total_revenue)
    : 0;
  const totalExpenses = latestMetrics
    ? Number(latestMetrics.total_expenses)
    : 0;
  const totalPotentialSavings = topRecs.reduce(
    (sum, r) => sum + Number(r.estimated_monthly_impact),
    0
  );

  const content: DailyReportContent = {
    alerts: alerts.map((a) => ({
      title: a.title,
      message: a.message ?? '',
      severity: a.type ?? 'INFO',
    })),
    topActions: topRecs.map((r) => ({
      title: r.title,
      impact: Number(r.estimated_monthly_impact),
      category: CATEGORY_LABELS[r.category] ?? r.category,
    })),
  };

  await prisma.cfoReport.upsert({
    where: {
      organization_id_report_type_period_start: {
        organization_id: organizationId,
        report_type: 'DAILY',
        period_start: today,
      },
    },
    update: {
      period_end: today,
      margin_actual: marginActual,
      margin_target: target,
      total_revenue: totalRevenue,
      total_expenses: totalExpenses,
      recommendations_count: activeRecCount,
      total_potential_savings: totalPotentialSavings,
      report_content: content as unknown as Prisma.InputJsonValue,
    },
    create: {
      organization_id: organizationId,
      report_type: 'DAILY',
      period_start: today,
      period_end: today,
      margin_actual: marginActual,
      margin_target: target,
      total_revenue: totalRevenue,
      total_expenses: totalExpenses,
      recommendations_count: activeRecCount,
      total_potential_savings: totalPotentialSavings,
      report_content: content as unknown as Prisma.InputJsonValue,
    },
  });

  return { reportType: 'DAILY' as const, content };
}

// ============================================================================
// Weekly Report
// ============================================================================

/**
 * Generates a weekly report extending daily with trend data,
 * acted recommendations, new recommendation count, and cost breakdown changes.
 */
export async function generateWeeklyReport(organizationId: string) {
  const today = todayUTC();
  const weekStart = daysAgo(today, 7);

  const [
    target,
    latestMetrics,
    priorWeekMetrics,
    alerts,
    topRecs,
    activeRecCount,
    actedRecs,
    newRecsCount,
    marginHistory,
  ] = await Promise.all([
    getCompanyMarginTarget(organizationId),
    prisma.companyMetrics.findFirst({
      where: { organization_id: organizationId },
      orderBy: { period_start: 'desc' },
      select: {
        portfolio_margin: true,
        total_revenue: true,
        total_expenses: true,
      },
    }),
    prisma.companyMetrics.findMany({
      where: {
        organization_id: organizationId,
        period_start: { gte: daysAgo(today, 14), lt: weekStart },
      },
      orderBy: { period_start: 'desc' },
      take: 1,
      select: {
        total_revenue: true,
        total_expenses: true,
      },
    }),
    prisma.notification.findMany({
      where: {
        organization_id: organizationId,
        source: 'CFO_STRATEGIST',
        read_at: null,
      },
      orderBy: { created_at: 'desc' },
      take: 10,
      select: { title: true, message: true, type: true },
    }),
    prisma.cfoRecommendation.findMany({
      where: {
        organization_id: organizationId,
        status: 'ACTIVE',
        deleted_at: null,
      },
      orderBy: { estimated_monthly_impact: 'desc' },
      take: 3,
      select: {
        title: true,
        estimated_monthly_impact: true,
        category: true,
      },
    }),
    prisma.cfoRecommendation.count({
      where: {
        organization_id: organizationId,
        status: 'ACTIVE',
        deleted_at: null,
      },
    }),
    prisma.cfoRecommendation.findMany({
      where: {
        organization_id: organizationId,
        status: 'ACTED_ON',
        acted_on_at: { gte: weekStart },
        deleted_at: null,
      },
      select: {
        title: true,
        acted_on_expected_savings: true,
      },
    }),
    prisma.cfoRecommendation.count({
      where: {
        organization_id: organizationId,
        created_at: { gte: weekStart },
        deleted_at: null,
      },
    }),
    prisma.companyMetrics.findMany({
      where: { organization_id: organizationId },
      orderBy: { period_start: 'desc' },
      take: 7,
      select: { period_start: true, portfolio_margin: true },
    }),
  ]);

  const marginActual = latestMetrics
    ? Number(latestMetrics.portfolio_margin)
    : 0;
  const totalRevenue = latestMetrics
    ? Number(latestMetrics.total_revenue)
    : 0;
  const totalExpenses = latestMetrics
    ? Number(latestMetrics.total_expenses)
    : 0;
  const totalPotentialSavings = topRecs.reduce(
    (sum, r) => sum + Number(r.estimated_monthly_impact),
    0
  );

  // Cost breakdown: compare current vs prior week
  const priorRevenue =
    priorWeekMetrics.length > 0 ? Number(priorWeekMetrics[0].total_revenue) : 0;
  const priorExpenses =
    priorWeekMetrics.length > 0
      ? Number(priorWeekMetrics[0].total_expenses)
      : 0;

  const content: WeeklyReportContent = {
    alerts: alerts.map((a) => ({
      title: a.title,
      message: a.message ?? '',
      severity: a.type ?? 'INFO',
    })),
    topActions: topRecs.map((r) => ({
      title: r.title,
      impact: Number(r.estimated_monthly_impact),
      category: CATEGORY_LABELS[r.category] ?? r.category,
    })),
    marginTrend: [...marginHistory].reverse().map((m) => ({
      date: new Date(m.period_start).toISOString().split('T')[0],
      margin: Number(m.portfolio_margin),
    })),
    actedRecommendations: actedRecs.map((r) => ({
      title: r.title,
      expectedImpact: Number(r.acted_on_expected_savings ?? 0),
    })),
    newRecommendations: newRecsCount,
    costBreakdownChanges: {
      revenue: {
        current: totalRevenue,
        prior: priorRevenue,
        change: totalRevenue - priorRevenue,
      },
      expenses: {
        current: totalExpenses,
        prior: priorExpenses,
        change: totalExpenses - priorExpenses,
      },
    },
  };

  await prisma.cfoReport.upsert({
    where: {
      organization_id_report_type_period_start: {
        organization_id: organizationId,
        report_type: 'WEEKLY',
        period_start: weekStart,
      },
    },
    update: {
      period_end: today,
      margin_actual: marginActual,
      margin_target: target,
      total_revenue: totalRevenue,
      total_expenses: totalExpenses,
      recommendations_count: activeRecCount,
      recommendations_acted_count: actedRecs.length,
      total_potential_savings: totalPotentialSavings,
      report_content: content as unknown as Prisma.InputJsonValue,
    },
    create: {
      organization_id: organizationId,
      report_type: 'WEEKLY',
      period_start: weekStart,
      period_end: today,
      margin_actual: marginActual,
      margin_target: target,
      total_revenue: totalRevenue,
      total_expenses: totalExpenses,
      recommendations_count: activeRecCount,
      recommendations_acted_count: actedRecs.length,
      total_potential_savings: totalPotentialSavings,
      report_content: content as unknown as Prisma.InputJsonValue,
    },
  });

  return { reportType: 'WEEKLY' as const, content };
}

// ============================================================================
// Monthly Report
// ============================================================================

/**
 * Generates a monthly report with full MoM comparison, forecast,
 * impact review, and category deep dive.
 */
export async function generateMonthlyReport(organizationId: string) {
  const monthStart = firstOfMonth();
  const priorMonthStart = firstOfPriorMonth();
  const today = todayUTC();

  const [
    target,
    currentMetrics,
    priorMetrics,
    alerts,
    topRecs,
    activeRecCount,
    actedRecs,
    newRecsCount,
    marginHistory,
    forecast,
    actedWithImpact,
    categoryRecs,
  ] = await Promise.all([
    getCompanyMarginTarget(organizationId),
    prisma.companyMetrics.findFirst({
      where: {
        organization_id: organizationId,
        period_start: { gte: monthStart },
      },
      orderBy: { period_start: 'desc' },
      select: {
        portfolio_margin: true,
        total_revenue: true,
        total_expenses: true,
      },
    }),
    prisma.companyMetrics.findFirst({
      where: {
        organization_id: organizationId,
        period_start: { gte: priorMonthStart, lt: monthStart },
      },
      orderBy: { period_start: 'desc' },
      select: {
        portfolio_margin: true,
        total_revenue: true,
        total_expenses: true,
      },
    }),
    prisma.notification.findMany({
      where: {
        organization_id: organizationId,
        source: 'CFO_STRATEGIST',
        read_at: null,
      },
      orderBy: { created_at: 'desc' },
      take: 10,
      select: { title: true, message: true, type: true },
    }),
    prisma.cfoRecommendation.findMany({
      where: {
        organization_id: organizationId,
        status: 'ACTIVE',
        deleted_at: null,
      },
      orderBy: { estimated_monthly_impact: 'desc' },
      take: 3,
      select: {
        title: true,
        estimated_monthly_impact: true,
        category: true,
      },
    }),
    prisma.cfoRecommendation.count({
      where: {
        organization_id: organizationId,
        status: 'ACTIVE',
        deleted_at: null,
      },
    }),
    prisma.cfoRecommendation.findMany({
      where: {
        organization_id: organizationId,
        status: 'ACTED_ON',
        acted_on_at: { gte: monthStart },
        deleted_at: null,
      },
      select: {
        title: true,
        acted_on_expected_savings: true,
      },
    }),
    prisma.cfoRecommendation.count({
      where: {
        organization_id: organizationId,
        created_at: { gte: monthStart },
        deleted_at: null,
      },
    }),
    prisma.companyMetrics.findMany({
      where: { organization_id: organizationId },
      orderBy: { period_start: 'desc' },
      take: 6,
      select: { period_start: true, portfolio_margin: true },
    }),
    projectNextMonthMargin(organizationId),
    // Acted-on recommendations with impact data (for effectiveness review)
    prisma.cfoRecommendation.findMany({
      where: {
        organization_id: organizationId,
        status: 'ACTED_ON',
        deleted_at: null,
      },
      select: {
        title: true,
        acted_on_expected_savings: true,
        realized_savings: true,
      },
    }),
    // Category-level recommendation data for deep dive
    prisma.cfoRecommendation.groupBy({
      by: ['category'],
      where: {
        organization_id: organizationId,
        deleted_at: null,
      },
      _count: { id: true },
      _sum: { estimated_monthly_impact: true },
    }),
  ]);

  const curRevenue = currentMetrics
    ? Number(currentMetrics.total_revenue)
    : 0;
  const curExpenses = currentMetrics
    ? Number(currentMetrics.total_expenses)
    : 0;
  const curMargin = currentMetrics
    ? Number(currentMetrics.portfolio_margin)
    : 0;
  const curProfit = curRevenue - curExpenses;

  const prevRevenue = priorMetrics ? Number(priorMetrics.total_revenue) : 0;
  const prevExpenses = priorMetrics
    ? Number(priorMetrics.total_expenses)
    : 0;
  const prevMargin = priorMetrics
    ? Number(priorMetrics.portfolio_margin)
    : 0;
  const prevProfit = prevRevenue - prevExpenses;

  const totalPotentialSavings = topRecs.reduce(
    (sum, r) => sum + Number(r.estimated_monthly_impact),
    0
  );

  // Build category deep dive
  const totalCategoryCost = categoryRecs.reduce(
    (sum, r) => sum + Number(r._sum.estimated_monthly_impact ?? 0),
    0
  );

  const categoryDeepDive: MonthlyReportContent['categoryDeepDive'] = {};
  for (const cat of categoryRecs) {
    const catCost = Number(cat._sum.estimated_monthly_impact ?? 0);
    const label = CATEGORY_LABELS[cat.category] ?? cat.category;
    categoryDeepDive[label] = {
      totalCost: catCost,
      percentOfTotal: totalCategoryCost > 0
        ? Math.round((catCost / totalCategoryCost) * 100)
        : 0,
      change: 0, // No prior-period category comparison available yet
      recommendations: [], // Populated below
    };
  }

  // Add top recommendations per category
  const allActiveRecs = await prisma.cfoRecommendation.findMany({
    where: {
      organization_id: organizationId,
      status: 'ACTIVE',
      deleted_at: null,
    },
    orderBy: { estimated_monthly_impact: 'desc' },
    select: {
      title: true,
      category: true,
      estimated_monthly_impact: true,
    },
  });

  for (const rec of allActiveRecs) {
    const label = CATEGORY_LABELS[rec.category] ?? rec.category;
    if (categoryDeepDive[label]) {
      categoryDeepDive[label].recommendations.push({
        title: rec.title,
        impact: Number(rec.estimated_monthly_impact),
      });
    }
  }

  const content: MonthlyReportContent = {
    alerts: alerts.map((a) => ({
      title: a.title,
      message: a.message ?? '',
      severity: a.type ?? 'INFO',
    })),
    topActions: topRecs.map((r) => ({
      title: r.title,
      impact: Number(r.estimated_monthly_impact),
      category: CATEGORY_LABELS[r.category] ?? r.category,
    })),
    marginTrend: [...marginHistory].reverse().map((m) => ({
      date: new Date(m.period_start).toISOString().split('T')[0],
      margin: Number(m.portfolio_margin),
    })),
    actedRecommendations: actedRecs.map((r) => ({
      title: r.title,
      expectedImpact: Number(r.acted_on_expected_savings ?? 0),
    })),
    newRecommendations: newRecsCount,
    costBreakdownChanges: {
      revenue: {
        current: curRevenue,
        prior: prevRevenue,
        change: curRevenue - prevRevenue,
      },
      expenses: {
        current: curExpenses,
        prior: prevExpenses,
        change: curExpenses - prevExpenses,
      },
    },
    monthOverMonth: {
      revenue: curRevenue - prevRevenue,
      expenses: curExpenses - prevExpenses,
      margin: curMargin - prevMargin,
      profit: curProfit - prevProfit,
    },
    impactReview: actedWithImpact.map((r) => ({
      title: r.title,
      expectedSavings: Number(r.acted_on_expected_savings ?? 0),
      realizedSavings: r.realized_savings ? Number(r.realized_savings) : null,
    })),
    forecast: forecast
      ? {
          projectedMargin: forecast.projectedMargin,
          projectedRevenue: forecast.projectedRevenue,
          projectedExpenses: forecast.projectedExpenses,
        }
      : {
          projectedMargin: curMargin,
          projectedRevenue: curRevenue,
          projectedExpenses: curExpenses,
        },
    categoryDeepDive,
  };

  await prisma.cfoReport.upsert({
    where: {
      organization_id_report_type_period_start: {
        organization_id: organizationId,
        report_type: 'MONTHLY',
        period_start: monthStart,
      },
    },
    update: {
      period_end: today,
      margin_actual: curMargin,
      margin_target: target,
      total_revenue: curRevenue,
      total_expenses: curExpenses,
      recommendations_count: activeRecCount,
      recommendations_acted_count: actedRecs.length,
      total_potential_savings: totalPotentialSavings,
      report_content: content as unknown as Prisma.InputJsonValue,
    },
    create: {
      organization_id: organizationId,
      report_type: 'MONTHLY',
      period_start: monthStart,
      period_end: today,
      margin_actual: curMargin,
      margin_target: target,
      total_revenue: curRevenue,
      total_expenses: curExpenses,
      recommendations_count: activeRecCount,
      recommendations_acted_count: actedRecs.length,
      total_potential_savings: totalPotentialSavings,
      report_content: content as unknown as Prisma.InputJsonValue,
    },
  });

  return { reportType: 'MONTHLY' as const, content };
}
