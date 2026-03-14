/**
 * Recommendation engine orchestrator.
 *
 * Runs all 4 analyzers in parallel, deduplicates results via composite key
 * upsert, detects conflicting recommendations, and manages lifecycle
 * transitions (deferred reactivation, dismissed reactivation on metric change).
 */

import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getEffectiveThresholds } from './thresholds';
import { analyzeSubscriptions } from './analyzers/subscription-analyzer';
import { analyzeStaffing } from './analyzers/staffing-analyzer';
import { analyzeRevenue } from './analyzers/revenue-analyzer';
import { analyzeOverhead } from './analyzers/overhead-analyzer';
import type { EngineResult, RecommendationInput } from './types';

/**
 * Run the full recommendation engine for an organization.
 *
 * Steps:
 *  1. Load configurable thresholds
 *  2. Run all 4 analyzers in parallel
 *  3. Detect conflicting recommendations (same entity in cost-cut + revenue)
 *  4. Upsert by composite key, preserving existing lifecycle status
 *  5. Track impact for ACTED_ON recommendations (realized vs baseline)
 *  6. Reactivate deferred recommendations past their date
 *  7. Reactivate dismissed recommendations with 15%+ metric change
 */
export async function generateRecommendations(
  organizationId: string,
  month: number,
  year: number
): Promise<EngineResult> {
  const errors: string[] = [];
  let generated = 0;
  let updated = 0;
  let reactivated = 0;
  let conflictsTagged = 0;

  // 1. Load thresholds
  const thresholds = await getEffectiveThresholds(organizationId);

  // 2. Run all analyzers in parallel
  const results = await Promise.allSettled([
    analyzeSubscriptions(organizationId, month, year, thresholds),
    analyzeStaffing(organizationId, month, year, thresholds),
    analyzeRevenue(organizationId, month, year, thresholds),
    analyzeOverhead(organizationId, month, year, thresholds),
  ]);

  const allRecommendations: RecommendationInput[] = [];
  const analyzerNames = ['subscription', 'staffing', 'revenue', 'overhead'];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled') {
      allRecommendations.push(...result.value.recommendations);
      errors.push(...result.value.errors);
    } else {
      errors.push(`${analyzerNames[i]} analyzer failed: ${result.reason}`);
    }
  }

  // 3. Detect conflicting recommendations
  // Build a map of entityId -> categories to find entities appearing in both
  // cost-cutting and revenue-generating contexts
  const entityCategories = new Map<string, Set<string>>();
  for (const rec of allRecommendations) {
    const key = rec.targetEntityId;
    if (!entityCategories.has(key)) {
      entityCategories.set(key, new Set());
    }
    entityCategories.get(key)!.add(rec.category);
  }

  const conflictingEntities = new Set<string>();
  for (const [entityId, categories] of entityCategories) {
    if (categories.size > 1) {
      conflictingEntities.add(entityId);
    }
  }

  // Tag conflicting recommendations
  for (const rec of allRecommendations) {
    if (conflictingEntities.has(rec.targetEntityId)) {
      rec.supportingData = {
        ...rec.supportingData,
        has_trade_off: true,
        conflicting_categories: Array.from(
          entityCategories.get(rec.targetEntityId)!
        ),
      };
      conflictsTagged++;
    }
  }

  // 4. Upsert each recommendation by composite key
  for (const rec of allRecommendations) {
    try {
      const existing = await prisma.cfoRecommendation.findUnique({
        where: {
          organization_id_category_target_entity_type_target_entity_id: {
            organization_id: organizationId,
            category: rec.category,
            target_entity_type: rec.targetEntityType,
            target_entity_id: rec.targetEntityId,
          },
        },
      });

      if (existing) {
        // Preserve lifecycle status — only update content fields
        if (existing.status === 'ACTIVE') {
          await prisma.cfoRecommendation.update({
            where: { id: existing.id },
            data: {
              title: rec.title,
              description: rec.description,
              estimated_monthly_impact: rec.estimatedMonthlyImpact,
              confidence_level: rec.confidenceLevel,
              supporting_data: rec.supportingData as Prisma.InputJsonValue,
            },
          });
        }
        // For ACTED_ON/DISMISSED/DEFERRED — keep existing, don't overwrite
        updated++;
      } else {
        await prisma.cfoRecommendation.create({
          data: {
            organization_id: organizationId,
            category: rec.category,
            target_entity_type: rec.targetEntityType,
            target_entity_id: rec.targetEntityId,
            title: rec.title,
            description: rec.description,
            estimated_monthly_impact: rec.estimatedMonthlyImpact,
            confidence_level: rec.confidenceLevel,
            supporting_data: rec.supportingData as Prisma.InputJsonValue,
            status: 'ACTIVE',
          },
        });
        generated++;
      }
    } catch (err) {
      errors.push(
        `Failed to upsert recommendation "${rec.title}": ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // 5. Impact tracking for ACTED_ON recommendations
  try {
    const actedRecs = await prisma.cfoRecommendation.findMany({
      where: {
        organization_id: organizationId,
        status: 'ACTED_ON',
        baseline_metric_value: { not: null },
        deleted_at: null,
      },
    });

    for (const rec of actedRecs) {
      const baseline = Number(rec.baseline_metric_value);
      if (baseline <= 0) continue;

      // Find current metric value from this engine run
      const currentRec = allRecommendations.find(
        (r) =>
          r.category === rec.category &&
          r.targetEntityType === rec.target_entity_type &&
          r.targetEntityId === rec.target_entity_id
      );

      // If the issue no longer appears, full savings realized.
      // Otherwise, savings = baseline - current remaining impact.
      const currentImpact = currentRec?.estimatedMonthlyImpact ?? 0;
      const realizedSavings = Math.max(baseline - currentImpact, 0);

      await prisma.cfoRecommendation.update({
        where: { id: rec.id },
        data: { realized_savings: realizedSavings },
      });
    }
  } catch (err) {
    errors.push(
      `Failed to track impact: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // 6. Reactivate deferred recommendations past their date
  try {
    const reactivatedDeferred = await prisma.cfoRecommendation.updateMany({
      where: {
        organization_id: organizationId,
        status: 'DEFERRED',
        deferred_until: { lte: new Date() },
        deleted_at: null,
      },
      data: {
        status: 'ACTIVE',
        deferred_until: null,
      },
    });
    reactivated += reactivatedDeferred.count;
  } catch (err) {
    errors.push(
      `Failed to reactivate deferred recommendations: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // 7. Reactivate dismissed recommendations with 15%+ metric change
  try {
    const dismissedRecs = await prisma.cfoRecommendation.findMany({
      where: {
        organization_id: organizationId,
        status: 'DISMISSED',
        dismissed_metric_snapshot: { not: null },
        deleted_at: null,
      },
    });

    for (const rec of dismissedRecs) {
      // Find the current metric value from the latest recommendation input
      const currentRec = allRecommendations.find(
        (r) =>
          r.category === rec.category &&
          r.targetEntityType === rec.target_entity_type &&
          r.targetEntityId === rec.target_entity_id
      );

      if (currentRec && rec.dismissed_metric_snapshot != null) {
        const snapshot = Number(rec.dismissed_metric_snapshot);
        const current = currentRec.estimatedMonthlyImpact;
        if (snapshot > 0) {
          const changePercent =
            Math.abs(current - snapshot) / snapshot;
          if (changePercent >= 0.15) {
            await prisma.cfoRecommendation.update({
              where: { id: rec.id },
              data: {
                status: 'ACTIVE',
                dismissed_reason: null,
                dismissed_metric_snapshot: null,
                title: currentRec.title,
                description: currentRec.description,
                estimated_monthly_impact: currentRec.estimatedMonthlyImpact,
                confidence_level: currentRec.confidenceLevel,
                supporting_data: currentRec.supportingData as Prisma.InputJsonValue,
              },
            });
            reactivated++;
          }
        }
      }
    }
  } catch (err) {
    errors.push(
      `Failed to check dismissed recommendations: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  return { generated, updated, reactivated, conflictsTagged: conflictsTagged, errors };
}
