/**
 * Merchant-to-Subscription Mapping Service (T013)
 *
 * Mirrors the tiered mapping pattern from merchant-mapper.ts:
 * 1. Cache lookup (O(1)) — subscription_id IS NOT NULL
 * 2. Exact name match against subscription.name
 * 3. Fuzzy name match (Jaro-Winkler >= 0.85 threshold)
 * 4. Return null (flag for manual mapping)
 *
 * subscription_id is mutually exclusive with contractor_id and agency_id
 * in MerchantMappingCache — enforced at the application layer.
 */

import { prisma } from '@/lib/prisma';
import { normalizeName, calculateSimilarity } from './utils';
import type { MappingConfidence, MappingSource } from '@/types/mercury';

interface SubscriptionMatch {
  id: string;
  name: string;
  similarity?: number;
}

/**
 * Get cached merchant-to-subscription mapping.
 * Tier 1: O(1) cache lookup (subscription_id IS NOT NULL).
 */
export async function getCachedSubscriptionMapping(
  connectionId: string,
  merchantName: string
): Promise<string | null> {
  const normalizedName = normalizeName(merchantName);

  const cached = await prisma.merchantMappingCache.findUnique({
    where: {
      connection_id_normalized_merchant_name: {
        connection_id: connectionId,
        normalized_merchant_name: normalizedName,
      },
    },
    select: { subscription_id: true },
  });

  return cached?.subscription_id || null;
}

/**
 * Find subscription by exact normalized name match.
 * Tier 2: Exact match lookup against subscription.name.
 */
export async function findSubscriptionByMerchantPattern(
  organizationId: string,
  merchantName: string
): Promise<SubscriptionMatch | null> {
  const normalizedMerchant = normalizeName(merchantName);

  const subscriptions = await prisma.subscription.findMany({
    where: {
      organization_id: organizationId,
      is_active: true,
      deleted_at: null,
    },
    select: { id: true, name: true },
  });

  for (const sub of subscriptions) {
    if (normalizeName(sub.name) === normalizedMerchant) {
      return { id: sub.id, name: sub.name, similarity: 1.0 };
    }
  }

  return null;
}

/**
 * Find subscriptions by fuzzy name matching (Jaro-Winkler >= threshold).
 * Tier 3: Fuzzy match.
 *
 * @param threshold - Minimum similarity score (default: 0.85)
 */
export async function findSubscriptionsByFuzzyName(
  organizationId: string,
  merchantName: string,
  threshold: number = 0.85
): Promise<SubscriptionMatch[]> {
  const normalizedMerchant = normalizeName(merchantName);

  const subscriptions = await prisma.subscription.findMany({
    where: {
      organization_id: organizationId,
      is_active: true,
      deleted_at: null,
    },
    select: { id: true, name: true },
  });

  return subscriptions
    .map((sub) => ({
      id: sub.id,
      name: sub.name,
      similarity: calculateSimilarity(normalizedMerchant, normalizeName(sub.name)),
    }))
    .filter((match) => match.similarity >= threshold)
    .sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
}

/**
 * Cache a merchant-to-subscription mapping.
 * Clears contractor_id and agency_id to enforce mutual exclusivity.
 */
export async function cacheSubscriptionMapping(
  connectionId: string,
  merchantName: string,
  subscriptionId: string,
  mappingType: MappingConfidence,
  confidenceScore: number,
  mappedByUserId?: string
): Promise<void> {
  const normalizedName = normalizeName(merchantName);
  const mappedBy: MappingSource = mappedByUserId ? 'ADMIN_USER' : 'SYSTEM';

  await prisma.merchantMappingCache.upsert({
    where: {
      connection_id_normalized_merchant_name: {
        connection_id: connectionId,
        normalized_merchant_name: normalizedName,
      },
    },
    create: {
      connection_id: connectionId,
      mercury_merchant_name: merchantName,
      normalized_merchant_name: normalizedName,
      subscription_id: subscriptionId,
      contractor_id: null,      // Mutual exclusivity
      agency_id: null,          // Mutual exclusivity
      mapping_confidence: mappingType,
      confidence_score: confidenceScore,
      mapped_by: mappedBy,
      mapped_by_user_id: mappedByUserId || null,
    },
    update: {
      subscription_id: subscriptionId,
      contractor_id: null,      // Clear conflicting mappings
      agency_id: null,          // Clear conflicting mappings
      mapping_confidence: mappingType,
      confidence_score: confidenceScore,
      mapped_by: mappedBy,
      mapped_by_user_id: mappedByUserId || null,
      mapped_at: new Date(),
    },
  });
}

/**
 * Promote a fuzzy subscription mapping to EXACT confidence.
 * Used by the admin "Confirm & Make Exact" action (T049).
 */
export async function promoteToExactMapping(
  connectionId: string,
  normalizedMerchantName: string,
  subscriptionId: string
): Promise<void> {
  await prisma.merchantMappingCache.updateMany({
    where: {
      connection_id: connectionId,
      normalized_merchant_name: normalizedMerchantName,
      subscription_id: subscriptionId,
    },
    data: {
      mapping_confidence: 'EXACT',
      confidence_score: 1.0,
      mapped_at: new Date(),
    },
  });
}

/**
 * Orchestrate tiered merchant-to-subscription mapping.
 * Main entry point — mirrors mapMerchantToContractor pattern.
 *
 * @returns Subscription ID if matched, null otherwise
 */
export async function mapMerchantToSubscription(
  connectionId: string,
  organizationId: string,
  merchantName: string
): Promise<string | null> {
  // Tier 1: Cache lookup
  const cached = await getCachedSubscriptionMapping(connectionId, merchantName);
  if (cached) {
    return cached;
  }

  // Tier 2: Exact name match
  const exactMatch = await findSubscriptionByMerchantPattern(organizationId, merchantName);
  if (exactMatch) {
    await cacheSubscriptionMapping(connectionId, merchantName, exactMatch.id, 'EXACT', 0.95);
    return exactMatch.id;
  }

  // Tier 3: Fuzzy match (>= 0.85 threshold)
  const fuzzyMatches = await findSubscriptionsByFuzzyName(organizationId, merchantName, 0.85);
  const bestMatch = fuzzyMatches[0];

  if (bestMatch && bestMatch.similarity && bestMatch.similarity > 0.85) {
    await cacheSubscriptionMapping(connectionId, merchantName, bestMatch.id, 'FUZZY', bestMatch.similarity);
    return bestMatch.id;
  }

  // Tier 4: No match
  return null;
}
