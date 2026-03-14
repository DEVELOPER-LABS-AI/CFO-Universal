/**
 * Subscription Analyzer for the CFO Strategist recommendation engine.
 *
 * Analyzes active subscriptions to surface cost-saving opportunities:
 *   1. Zero/low allocation: subscriptions with little or no cost allocated
 *   2. Cost increases: month-over-month cost spikes exceeding threshold
 *   3. Similar names: potential duplicate subscriptions that could be consolidated
 *
 * Confidence scoring (per research.md Decision 8):
 *   - High   (0.8 - 1.0): 3+ months of data
 *   - Medium (0.5 - 0.79): 2 months of data
 *   - Low    (0.2 - 0.49): 1 month or inferred
 */

import { prisma } from '@/lib/prisma';
import { computeSubscriptionPeriodCost } from '@/lib/calculations/subscription-cost-calculator';
import { getSubscriptionTrend } from '@/lib/calculations/trend-reporter';
import type { AnalyzerResult, RecommendationInput, ThresholdConfig } from '../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ActiveSubscription {
  id: string;
  name: string;
  total_cost: unknown; // Prisma Decimal
  total_seats: number | null;
  billing_frequency: string;
}

// ---------------------------------------------------------------------------
// Confidence scoring helpers
// ---------------------------------------------------------------------------

/**
 * Determine confidence level based on how many months of history have data.
 *
 * @param historyMonths - Number of periods in the trend history with non-zero totals
 * @returns Confidence score between 0.0 and 1.0
 */
function computeConfidence(historyMonths: number): number {
  if (historyMonths >= 3) return 0.85;
  if (historyMonths === 2) return 0.65;
  return 0.35;
}

// ---------------------------------------------------------------------------
// Name similarity helpers
// ---------------------------------------------------------------------------

/**
 * Normalize a subscription name for comparison.
 * Lowercases, strips non-alphanumeric characters, and collapses whitespace.
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Compute the Levenshtein edit distance between two strings.
 * Used for fuzzy name matching to detect potential duplicate subscriptions.
 */
function levenshtein(a: string, b: string): number {
  const aLen = a.length;
  const bLen = b.length;

  if (aLen === 0) return bLen;
  if (bLen === 0) return aLen;

  // Use a single-row DP approach for memory efficiency
  const row: number[] = Array.from({ length: bLen + 1 }, (_, i) => i);

  for (let i = 1; i <= aLen; i++) {
    let prev = i;
    for (let j = 1; j <= bLen; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const current = Math.min(
        row[j] + 1,       // deletion
        prev + 1,         // insertion
        row[j - 1] + cost // substitution
      );
      row[j - 1] = prev;
      prev = current;
    }
    row[bLen] = prev;
  }

  return row[bLen];
}

/**
 * Determine if two subscription names are similar enough to flag as potential
 * duplicates. Uses normalized Levenshtein distance relative to the shorter
 * name, with a threshold of 30% edit distance or less.
 */
function areNamesSimilar(nameA: string, nameB: string): boolean {
  const a = normalizeName(nameA);
  const b = normalizeName(nameB);

  // Exact match after normalization
  if (a === b) return true;

  // One name contains the other
  if (a.includes(b) || b.includes(a)) return true;

  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return false;

  const distance = levenshtein(a, b);
  const similarity = 1 - distance / maxLen;

  return similarity >= 0.7;
}

// ---------------------------------------------------------------------------
// Individual check functions
// ---------------------------------------------------------------------------

/**
 * Check whether a subscription has low or zero allocation relative to its total cost.
 * Sums all SubscriptionAllocation.cost_allocated and compares against the period cost.
 *
 * @param subscription - The subscription to evaluate
 * @param periodCost - Computed cost for the current period
 * @param allocationPctThreshold - Minimum allocation % before flagging (from ThresholdConfig)
 * @returns A RecommendationInput if the subscription is under-allocated, or null
 */
async function checkLowAllocation(
  subscription: ActiveSubscription,
  periodCost: number,
  allocationPctThreshold: number
): Promise<RecommendationInput | null> {
  if (periodCost <= 0) return null;

  const allocationAgg = await prisma.subscriptionAllocation.aggregate({
    where: { subscription_id: subscription.id },
    _sum: { cost_allocated: true },
  });

  const totalAllocated = Number(allocationAgg._sum.cost_allocated || 0);
  const allocationPct = (totalAllocated / periodCost) * 100;

  if (allocationPct >= allocationPctThreshold) return null;

  const unallocatedAmount = periodCost - totalAllocated;

  return {
    category: 'SUBSCRIPTION_OPTIMIZATION',
    targetEntityType: 'subscription',
    targetEntityId: subscription.id,
    title: `Low allocation on ${subscription.name}`,
    description:
      `Only ${allocationPct.toFixed(1)}% of ${subscription.name} cost ` +
      `($${periodCost.toFixed(2)}/mo) is allocated. ` +
      `$${unallocatedAmount.toFixed(2)}/mo is unassigned and may represent waste.`,
    estimatedMonthlyImpact: unallocatedAmount,
    confidenceLevel: 0.65, // allocation data is current-month only
    supportingData: {
      subscriptionName: subscription.name,
      periodCost,
      totalAllocated,
      allocationPct: Math.round(allocationPct * 100) / 100,
      unallocatedAmount,
      thresholdPct: allocationPctThreshold,
    },
  };
}

/**
 * Check whether a subscription has experienced a significant cost increase.
 * Uses getSubscriptionTrend to pull MoM data and flags increases above threshold.
 *
 * @param subscription - The subscription to evaluate
 * @param month - Current analysis month
 * @param year - Current analysis year
 * @param costIncreasePctThreshold - Minimum MoM % increase to flag (from ThresholdConfig)
 * @returns A RecommendationInput if a cost spike is detected, or null
 */
async function checkCostIncrease(
  subscription: ActiveSubscription,
  month: number,
  year: number,
  costIncreasePctThreshold: number
): Promise<RecommendationInput | null> {
  const trendResponse = await getSubscriptionTrend(subscription.id, month, year);

  const { trend, history, currentPeriod, priorPeriod } = trendResponse;

  // Only flag increases above threshold
  if (trend.direction !== 'UP' || trend.percentageChange <= costIncreasePctThreshold) {
    return null;
  }

  // Count months with non-zero data for confidence scoring
  const monthsWithData = history.filter((p) => p.total > 0).length;
  const confidence = computeConfidence(monthsWithData);

  return {
    category: 'SUBSCRIPTION_OPTIMIZATION',
    targetEntityType: 'subscription',
    targetEntityId: subscription.id,
    title: `Cost increase on ${subscription.name} (+${trend.percentageChange.toFixed(1)}%)`,
    description:
      `${subscription.name} cost increased ${trend.percentageChange.toFixed(1)}% MoM ` +
      `(from $${(priorPeriod?.total ?? 0).toFixed(2)} to $${currentPeriod.total.toFixed(2)}). ` +
      `Review for unexpected charges or plan changes.`,
    estimatedMonthlyImpact: trend.absoluteChange,
    confidenceLevel: confidence,
    supportingData: {
      subscriptionName: subscription.name,
      currentPeriodCost: currentPeriod.total,
      priorPeriodCost: priorPeriod?.total ?? 0,
      percentageChange: trend.percentageChange,
      absoluteChange: trend.absoluteChange,
      direction: trend.direction,
      monthsWithData,
      history,
    },
  };
}

/**
 * Find pairs of subscriptions with similar names that may be consolidation candidates.
 * Uses normalized name comparison and Levenshtein distance.
 *
 * @param subscriptions - All active subscriptions to compare
 * @param month - Current analysis month
 * @param year - Current analysis year
 * @returns Array of RecommendationInputs for similar subscription pairs
 */
async function checkSimilarNames(
  subscriptions: ActiveSubscription[],
  month: number,
  year: number
): Promise<RecommendationInput[]> {
  const recommendations: RecommendationInput[] = [];
  const flaggedPairs = new Set<string>();

  for (let i = 0; i < subscriptions.length; i++) {
    for (let j = i + 1; j < subscriptions.length; j++) {
      const subA = subscriptions[i];
      const subB = subscriptions[j];

      if (!areNamesSimilar(subA.name, subB.name)) continue;

      // Deduplicate pairs (order-independent key)
      const pairKey = [subA.id, subB.id].sort().join('|');
      if (flaggedPairs.has(pairKey)) continue;
      flaggedPairs.add(pairKey);

      // Compute combined cost for impact estimation
      const [costA, costB] = await Promise.all([
        computeSubscriptionPeriodCost(subA.id, month, year),
        computeSubscriptionPeriodCost(subB.id, month, year),
      ]);

      // Estimate savings as the lesser of the two costs (one could be eliminated)
      const potentialSavings = Math.min(costA, costB);

      if (potentialSavings <= 0) continue;

      recommendations.push({
        category: 'SUBSCRIPTION_OPTIMIZATION',
        targetEntityType: 'subscription',
        targetEntityId: costA <= costB ? subA.id : subB.id,
        title: `Possible duplicate: ${subA.name} / ${subB.name}`,
        description:
          `"${subA.name}" ($${costA.toFixed(2)}/mo) and "${subB.name}" ($${costB.toFixed(2)}/mo) ` +
          `have similar names and may be consolidation candidates. ` +
          `Consolidating could save up to $${potentialSavings.toFixed(2)}/mo.`,
        estimatedMonthlyImpact: potentialSavings,
        confidenceLevel: 0.45, // name-based heuristic, lower confidence
        supportingData: {
          subscriptionAId: subA.id,
          subscriptionAName: subA.name,
          subscriptionACost: costA,
          subscriptionBId: subB.id,
          subscriptionBName: subB.name,
          subscriptionBCost: costB,
          normalizedNameA: normalizeName(subA.name),
          normalizedNameB: normalizeName(subB.name),
        },
      });
    }
  }

  return recommendations;
}

// ---------------------------------------------------------------------------
// Main analyzer
// ---------------------------------------------------------------------------

/**
 * Analyze all active subscriptions for an organization and produce
 * cost-saving recommendations.
 *
 * Checks performed:
 *   1. Zero/low allocation relative to subscription cost
 *   2. Month-over-month cost increases above threshold
 *   3. Subscriptions with similar names (potential duplicates)
 *
 * Individual subscription failures are captured in the errors array
 * and do not halt analysis of remaining subscriptions.
 *
 * @param organizationId - Organization to analyze
 * @param month - Analysis period month (1-12)
 * @param year - Analysis period year
 * @param thresholds - Configurable threshold values
 * @returns AnalyzerResult with recommendations and any errors
 */
export async function analyzeSubscriptions(
  organizationId: string,
  month: number,
  year: number,
  thresholds: ThresholdConfig
): Promise<AnalyzerResult> {
  const recommendations: RecommendationInput[] = [];
  const errors: string[] = [];

  // -----------------------------------------------------------------------
  // 1. Fetch all active subscriptions for the organization
  // -----------------------------------------------------------------------

  let subscriptions: ActiveSubscription[];

  try {
    subscriptions = await prisma.subscription.findMany({
      where: {
        organization_id: organizationId,
        is_active: true,
        deleted_at: null,
      },
      select: {
        id: true,
        name: true,
        total_cost: true,
        total_seats: true,
        billing_frequency: true,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      recommendations: [],
      errors: [`Failed to fetch subscriptions: ${message}`],
    };
  }

  if (subscriptions.length === 0) {
    return { recommendations: [], errors: [] };
  }

  // -----------------------------------------------------------------------
  // 2. Per-subscription checks (allocation + cost increase)
  // -----------------------------------------------------------------------

  for (const subscription of subscriptions) {
    try {
      const periodCost = await computeSubscriptionPeriodCost(
        subscription.id,
        month,
        year
      );

      // Check 1: Low / zero allocation
      const lowAllocRec = await checkLowAllocation(
        subscription,
        periodCost,
        thresholds.subscription_allocation_pct
      );
      if (lowAllocRec) {
        recommendations.push(lowAllocRec);
      }

      // Check 2: MoM cost increase
      const costIncRec = await checkCostIncrease(
        subscription,
        month,
        year,
        thresholds.subscription_cost_increase_pct
      );
      if (costIncRec) {
        recommendations.push(costIncRec);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(
        `Error analyzing subscription "${subscription.name}" (${subscription.id}): ${message}`
      );
    }
  }

  // -----------------------------------------------------------------------
  // 3. Cross-subscription check: similar names
  // -----------------------------------------------------------------------

  try {
    const similarNameRecs = await checkSimilarNames(subscriptions, month, year);
    recommendations.push(...similarNameRecs);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(`Error checking similar subscription names: ${message}`);
  }

  return { recommendations, errors };
}
