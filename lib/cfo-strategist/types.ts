/**
 * Shared TypeScript types for the CFO Strategist recommendation engine.
 */

import type {
  CfoRecommendationCategory,
  CfoRecommendationStatus,
  CfoReportType,
} from '@prisma/client';

// ============================================================================
// Threshold Configuration
// ============================================================================

/** Default threshold values applied when no custom config exists. */
export const DEFAULT_THRESHOLDS: ThresholdConfig = {
  subscription_allocation_pct: 5,
  subscription_cost_increase_pct: 10,
  staffing_utilization_min_assignments: 2,
  staffing_cost_ratio_multiplier: 1.5,
  revenue_margin_gap_pts: 10,
  revenue_decline_months: 3,
};

/** Configurable thresholds stored as Organization.analyzer_thresholds JSONB. */
export interface ThresholdConfig {
  /** Subscriptions below this % allocated are flagged as waste (default: 5) */
  subscription_allocation_pct: number;
  /** MoM cost increase % that triggers a subscription recommendation (default: 10) */
  subscription_cost_increase_pct: number;
  /** Minimum active client assignments before flagging low utilization (default: 2) */
  staffing_utilization_min_assignments: number;
  /** Cost-to-revenue ratio multiplier vs company avg to flag outliers (default: 1.5) */
  staffing_cost_ratio_multiplier: number;
  /** Percentage points below target to flag a client (default: 10) */
  revenue_margin_gap_pts: number;
  /** Consecutive months of decline before flagging revenue drop (default: 3) */
  revenue_decline_months: number;
}

// ============================================================================
// Recommendation Engine Types
// ============================================================================

/** Input produced by each analyzer, before upsert into the database. */
export interface RecommendationInput {
  category: CfoRecommendationCategory;
  targetEntityType: string;
  targetEntityId: string;
  title: string;
  description: string;
  estimatedMonthlyImpact: number;
  confidenceLevel: number;
  supportingData: Record<string, unknown>;
}

/** Summary returned by each analyzer after processing. */
export interface AnalyzerResult {
  recommendations: RecommendationInput[];
  errors: string[];
}

/** Summary returned by the recommendation engine orchestrator. */
export interface EngineResult {
  generated: number;
  updated: number;
  reactivated: number;
  conflictsTagged: number;
  errors: string[];
}

// ============================================================================
// Report Content Types
// ============================================================================

export interface DailyReportContent {
  alerts: Array<{ title: string; message: string; severity: string }>;
  topActions: Array<{ title: string; impact: number; category: string }>;
}

export interface WeeklyReportContent extends DailyReportContent {
  marginTrend: Array<{ date: string; margin: number }>;
  actedRecommendations: Array<{ title: string; expectedImpact: number }>;
  newRecommendations: number;
  costBreakdownChanges: Record<
    string,
    { current: number; prior: number; change: number }
  >;
}

export interface MonthlyReportContent extends WeeklyReportContent {
  monthOverMonth: {
    revenue: number;
    expenses: number;
    margin: number;
    profit: number;
  };
  impactReview: Array<{
    title: string;
    expectedSavings: number;
    realizedSavings: number | null;
  }>;
  forecast: {
    projectedMargin: number;
    projectedRevenue: number;
    projectedExpenses: number;
  };
  categoryDeepDive: Record<
    string,
    {
      totalCost: number;
      percentOfTotal: number;
      change: number;
      recommendations: Array<{ title: string; impact: number }>;
    }
  >;
}

export type ReportContent =
  | DailyReportContent
  | WeeklyReportContent
  | MonthlyReportContent;

// ============================================================================
// Dashboard Types
// ============================================================================

export interface DashboardData {
  currentMargin: number;
  targetMargin: number;
  marginTrend: 'UP' | 'DOWN' | 'FLAT' | 'NEW';
  marginChangePercent: number;
  projectedMargin: number;
  marginHistory: Array<{
    month: number;
    year: number;
    label: string;
    margin: number;
    target: number;
    revenue: number;
    expenses: number;
  }>;
  recommendationCounts: {
    subscription: number;
    staffing: number;
    revenue: number;
    overhead: number;
    total: number;
  };
  topRecommendations: Array<{
    id: string;
    title: string;
    category: string;
    estimatedMonthlyImpact: number;
    confidenceLevel: number;
    hasTradeOff: boolean;
  }>;
  clientMargins: Array<{
    clientId: string;
    clientName: string;
    margin: number;
    target: number;
    status: 'above' | 'near' | 'below';
    revenue: number;
    costs: number;
    isNewClient: boolean;
  }>;
  accuracyScore: number | null;
  activeAlerts: number;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Check if a client has fewer than 2 months of data (new client).
 * Uses ClientROI records to determine data history.
 */
export async function isNewClient(
  clientId: string,
  organizationId: string,
  prisma: { clientROI: { count: (args: unknown) => Promise<number> } }
): Promise<boolean> {
  const monthCount = await prisma.clientROI.count({
    where: {
      client_id: clientId,
      client: { organization_id: organizationId },
    },
  } as unknown);
  return (monthCount as number) < 2;
}
