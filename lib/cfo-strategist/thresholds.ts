/**
 * Analyzer threshold resolution logic.
 *
 * Merges stored Organization.analyzer_thresholds overrides with defaults.
 */

import { prisma } from '@/lib/prisma';
import { DEFAULT_THRESHOLDS, type ThresholdConfig } from './types';

/**
 * Get effective thresholds for an organization, merging stored overrides
 * with defaults. Missing keys fall back to DEFAULT_THRESHOLDS.
 */
export async function getEffectiveThresholds(
  organizationId: string
): Promise<ThresholdConfig> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { analyzer_thresholds: true },
  });

  const stored = (org?.analyzer_thresholds ?? {}) as Partial<ThresholdConfig>;

  return {
    ...DEFAULT_THRESHOLDS,
    ...stored,
  };
}
