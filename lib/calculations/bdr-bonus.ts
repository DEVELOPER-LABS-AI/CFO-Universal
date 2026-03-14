/**
 * Represents a single bonus tier for calculation.
 */
export interface BonusTier {
  minThreshold: number;
  maxThreshold: number | null;
  payoutRate: number;
  sortOrder: number;
}

/**
 * Represents a single line in the bonus breakdown.
 */
export interface BonusBreakdownLine {
  tierName: string;
  meetingsInRange: number;
  rate: number;
  subtotal: number;
}

/**
 * Result of the tiered bonus calculation.
 */
export interface BonusCalculationResult {
  total: number;
  breakdown: BonusBreakdownLine[];
}

/**
 * Calculate tiered bonus using cumulative tier logic.
 *
 * Each tier pays its rate for the meetings that fall within that tier's range.
 * Example: 12 meetings with [1-5@$50, 6-10@$75, 11+@$100]
 *   = (5 x $50) + (5 x $75) + (2 x $100) = $825
 *
 * @param metricValue - The number of meetings (or other metric)
 * @param tiers - The tier definitions, sorted by sortOrder
 * @returns The total bonus and per-tier breakdown
 */
export function calculateTieredBonus(
  metricValue: number,
  tiers: BonusTier[]
): BonusCalculationResult {
  if (metricValue <= 0 || tiers.length === 0) {
    return { total: 0, breakdown: [] };
  }

  // Sort tiers by sortOrder (ascending)
  const sortedTiers = [...tiers].sort((a, b) => a.sortOrder - b.sortOrder);

  let total = 0;
  const breakdown: BonusBreakdownLine[] = [];

  for (const tier of sortedTiers) {
    const tierMin = tier.minThreshold;
    const tierMax = tier.maxThreshold;

    // If metric doesn't reach this tier, skip
    if (metricValue < tierMin) {
      break;
    }

    // Calculate how many meetings fall within this tier
    const effectiveMax = tierMax !== null ? Math.min(metricValue, tierMax) : metricValue;
    const meetingsInRange = effectiveMax - tierMin + 1;

    if (meetingsInRange <= 0) {
      continue;
    }

    const subtotal = meetingsInRange * tier.payoutRate;
    total += subtotal;

    // Build tier name for display
    const tierName = tierMax !== null
      ? `${tierMin}-${tierMax} meetings`
      : `${tierMin}+ meetings`;

    breakdown.push({
      tierName,
      meetingsInRange,
      rate: tier.payoutRate,
      subtotal,
    });
  }

  // Round to 2 decimal places
  total = Math.round(total * 100) / 100;

  return { total, breakdown };
}
