/**
 * Merchant-to-Contractor and Merchant-to-Agency Mapping Service
 *
 * Implements tiered matching strategy (for both contractors and agencies):
 * 1. Cache lookup (O(1))
 * 2. Exact name match
 * 3. Fuzzy name match (>0.85 similarity)
 * 4. Return null (flag for manual mapping)
 */

import { prisma } from '@/lib/prisma';
import { normalizeName, calculateSimilarity } from './utils';
import type { MappingConfidence, MappingSource } from '@/types/mercury';

interface ContractorMatch {
  id: string;
  name: string;
  similarity?: number;
}

/**
 * Get cached merchant mapping
 * Tier 1: O(1) cache lookup
 *
 * @param connectionId - Mercury connection ID
 * @param merchantName - Raw merchant name from Mercury
 * @returns Cached contractor ID or null
 */
export async function getCachedMerchantMapping(
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
    select: {
      contractor_id: true,
    },
  });

  return cached?.contractor_id || null;
}

/**
 * Find contractor by exact normalized name match
 * Tier 2: Exact match lookup
 *
 * @param organizationId - Organization ID
 * @param merchantName - Raw merchant name
 * @returns Contractor if found, null otherwise
 */
export async function findContractorByNormalizedName(
  organizationId: string,
  merchantName: string
): Promise<ContractorMatch | null> {
  const normalizedMerchant = normalizeName(merchantName);

  const contractor = await prisma.contractor.findFirst({
    where: {
      organization_id: organizationId,
      deleted_at: null,
      engagement_type: { not: 'OWNER' }, // Owners are mapped via Staff (staff_id) for pay tracking
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (!contractor) {
    return null;
  }

  const normalizedContractor = normalizeName(contractor.name);

  // Check for exact match
  if (normalizedContractor === normalizedMerchant) {
    return {
      id: contractor.id,
      name: contractor.name,
      similarity: 1.0,
    };
  }

  return null;
}

/**
 * Find contractors by fuzzy name matching
 * Tier 3: Fuzzy match using Jaro-Winkler algorithm
 *
 * @param organizationId - Organization ID
 * @param merchantName - Raw merchant name
 * @param threshold - Minimum similarity score (default: 0.85)
 * @returns Array of contractors with similarity scores
 */
export async function findContractorsByFuzzyName(
  organizationId: string,
  merchantName: string,
  threshold: number = 0.85
): Promise<ContractorMatch[]> {
  const normalizedMerchant = normalizeName(merchantName);

  // Get all active non-owner contractors for organization
  // Owners are mapped via Staff (staff_id) for pay tracking, not contractor_id
  const contractors = await prisma.contractor.findMany({
    where: {
      organization_id: organizationId,
      deleted_at: null,
      engagement_type: { not: 'OWNER' },
    },
    select: {
      id: true,
      name: true,
    },
  });

  // Calculate similarity scores
  const matches: ContractorMatch[] = contractors
    .map((contractor) => {
      const normalizedContractor = normalizeName(contractor.name);
      const similarity = calculateSimilarity(normalizedMerchant, normalizedContractor);

      return {
        id: contractor.id,
        name: contractor.name,
        similarity,
      };
    })
    .filter((match) => match.similarity >= threshold)
    .sort((a, b) => (b.similarity || 0) - (a.similarity || 0)); // Sort by similarity desc

  return matches;
}

/**
 * Cache a merchant-to-contractor mapping
 *
 * @param connectionId - Mercury connection ID
 * @param merchantName - Raw merchant name
 * @param contractorId - Contractor ID
 * @param mappingType - Type of mapping (EXACT, FUZZY, MANUAL)
 * @param confidenceScore - Similarity score (0.0-1.0)
 * @param mappedByUserId - User ID if manually mapped
 */
export async function cacheMerchantMapping(
  connectionId: string,
  merchantName: string,
  contractorId: string,
  mappingType: MappingConfidence,
  confidenceScore: number,
  mappedByUserId?: string,
  transactionDate?: Date
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
      contractor_id: contractorId,
      agency_id: null,          // Mutual exclusivity with subscription_id
      subscription_id: null,    // Mutual exclusivity
      mapping_confidence: mappingType,
      confidence_score: confidenceScore,
      mapped_by: mappedBy,
      mapped_by_user_id: mappedByUserId || null,
      last_transaction_date: transactionDate || null,
    },
    update: {
      contractor_id: contractorId,
      agency_id: null,          // Clear conflicting mappings
      subscription_id: null,    // Clear conflicting mappings
      mapping_confidence: mappingType,
      confidence_score: confidenceScore,
      mapped_by: mappedBy,
      mapped_by_user_id: mappedByUserId || null,
      mapped_at: new Date(),
      // Only update last_transaction_date if the new date is more recent
      ...(transactionDate ? { last_transaction_date: transactionDate } : {}),
    },
  });
}

/**
 * Flag unmapped merchant for manual review
 * Creates a cache entry with null contractor_id, or updates last_transaction_date if already flagged
 *
 * @param connectionId - Mercury connection ID
 * @param merchantName - Raw merchant name
 * @param transactionDate - Date of the transaction that triggered this flag
 */
export async function flagUnmappedMerchant(
  connectionId: string,
  merchantName: string,
  transactionDate?: Date
): Promise<void> {
  const normalizedName = normalizeName(merchantName);

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
      contractor_id: null,
      mapping_confidence: 'MANUAL', // Requires manual mapping
      confidence_score: null,
      mapped_by: 'SYSTEM',
      mapped_by_user_id: null,
      last_transaction_date: transactionDate || null,
    },
    update: {
      // Update last_transaction_date if the new date is more recent
      ...(transactionDate ? { last_transaction_date: transactionDate } : {}),
    },
  });
}

/**
 * Orchestrate tiered merchant-to-contractor mapping
 * Main entry point for mapping logic
 *
 * @param connectionId - Mercury connection ID
 * @param organizationId - Organization ID
 * @param merchantName - Raw merchant name from Mercury
 * @returns Contractor ID if found, null otherwise
 */
export async function mapMerchantToContractor(
  connectionId: string,
  organizationId: string,
  merchantName: string,
  transactionDate?: Date
): Promise<string | null> {
  // Tier 1: Check cache (O(1) lookup)
  const cached = await getCachedMerchantMapping(connectionId, merchantName);
  if (cached) {
    return cached;
  }

  // Tier 2: Exact name match
  const exactMatch = await findContractorByNormalizedName(organizationId, merchantName);
  if (exactMatch) {
    // Cache the exact match
    await cacheMerchantMapping(
      connectionId,
      merchantName,
      exactMatch.id,
      'EXACT',
      0.95,
      undefined,
      transactionDate
    );
    return exactMatch.id;
  }

  // Tier 3: Fuzzy name match (> 0.85 similarity threshold)
  const fuzzyMatches = await findContractorsByFuzzyName(organizationId, merchantName, 0.85);
  const bestMatch = fuzzyMatches[0]; // Highest similarity

  if (bestMatch && bestMatch.similarity && bestMatch.similarity > 0.85) {
    // Cache the fuzzy match
    await cacheMerchantMapping(
      connectionId,
      merchantName,
      bestMatch.id,
      'FUZZY',
      bestMatch.similarity,
      undefined,
      transactionDate
    );
    return bestMatch.id;
  }

  // Tier 4: No match - flag for manual mapping
  await flagUnmappedMerchant(connectionId, merchantName, transactionDate);
  return null;
}

// ============================================================================
// AGENCY MAPPING
// ============================================================================

interface AgencyMatch {
  id: string;
  name: string;
  similarity?: number;
}

/**
 * Get cached merchant-to-agency mapping
 * Tier 1: O(1) cache lookup (agency_id IS NOT NULL)
 */
async function getCachedAgencyMapping(
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
    select: { agency_id: true },
  });

  return cached?.agency_id || null;
}

/**
 * Find agency by exact normalized name match
 * Matches against agency.name and agency.merchant_name
 * Tier 2: Exact match lookup
 */
async function findAgencyByNormalizedName(
  organizationId: string,
  merchantName: string
): Promise<AgencyMatch | null> {
  const normalizedMerchant = normalizeName(merchantName);

  const agencies = await prisma.agency.findMany({
    where: {
      organization_id: organizationId,
      deleted_at: null,
    },
    select: { id: true, name: true, merchant_name: true },
  });

  for (const agency of agencies) {
    if (
      normalizeName(agency.name) === normalizedMerchant ||
      (agency.merchant_name && normalizeName(agency.merchant_name) === normalizedMerchant)
    ) {
      return { id: agency.id, name: agency.name, similarity: 1.0 };
    }
  }

  return null;
}

/**
 * Find agencies by fuzzy name matching (Jaro-Winkler >= threshold)
 * Tier 3: Fuzzy match
 */
async function findAgenciesByFuzzyName(
  organizationId: string,
  merchantName: string,
  threshold: number = 0.85
): Promise<AgencyMatch[]> {
  const normalizedMerchant = normalizeName(merchantName);

  const agencies = await prisma.agency.findMany({
    where: { organization_id: organizationId, deleted_at: null },
    select: { id: true, name: true, merchant_name: true },
  });

  const matches: AgencyMatch[] = agencies
    .flatMap((agency) => {
      const nameSim = calculateSimilarity(normalizedMerchant, normalizeName(agency.name));
      const merchantSim = agency.merchant_name
        ? calculateSimilarity(normalizedMerchant, normalizeName(agency.merchant_name))
        : 0;
      const bestSim = Math.max(nameSim, merchantSim);
      return bestSim >= threshold ? [{ id: agency.id, name: agency.name, similarity: bestSim }] : [];
    })
    .sort((a, b) => (b.similarity || 0) - (a.similarity || 0));

  return matches;
}

/**
 * Cache a merchant-to-agency mapping
 */
export async function cacheAgencyMapping(
  connectionId: string,
  merchantName: string,
  agencyId: string,
  mappingType: MappingConfidence,
  confidenceScore: number,
  mappedByUserId?: string,
  transactionDate?: Date
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
      contractor_id: null,
      agency_id: agencyId,
      subscription_id: null,    // Mutual exclusivity
      mapping_confidence: mappingType,
      confidence_score: confidenceScore,
      mapped_by: mappedBy,
      mapped_by_user_id: mappedByUserId || null,
      last_transaction_date: transactionDate || null,
    },
    update: {
      contractor_id: null,
      agency_id: agencyId,
      subscription_id: null,    // Clear conflicting mappings
      mapping_confidence: mappingType,
      confidence_score: confidenceScore,
      mapped_by: mappedBy,
      mapped_by_user_id: mappedByUserId || null,
      mapped_at: new Date(),
      ...(transactionDate ? { last_transaction_date: transactionDate } : {}),
    },
  });
}

/**
 * Orchestrate tiered merchant-to-agency mapping
 * Called after contractor mapping returns null, so agencies get matched
 * only when no contractor match exists.
 *
 * @param connectionId - Mercury connection ID
 * @param organizationId - Organization ID
 * @param merchantName - Raw merchant name from Mercury
 * @returns Agency ID if matched, null otherwise
 */
export async function mapMerchantToAgency(
  connectionId: string,
  organizationId: string,
  merchantName: string,
  transactionDate?: Date
): Promise<string | null> {
  // Tier 1: Cache lookup for agency mappings
  const cached = await getCachedAgencyMapping(connectionId, merchantName);
  if (cached) {
    return cached;
  }

  // Tier 2: Exact name match
  const exactMatch = await findAgencyByNormalizedName(organizationId, merchantName);
  if (exactMatch) {
    await cacheAgencyMapping(connectionId, merchantName, exactMatch.id, 'EXACT', 0.95, undefined, transactionDate);
    return exactMatch.id;
  }

  // Tier 3: Fuzzy match (>= 0.85 threshold)
  const fuzzyMatches = await findAgenciesByFuzzyName(organizationId, merchantName, 0.85);
  const bestMatch = fuzzyMatches[0];

  if (bestMatch && bestMatch.similarity && bestMatch.similarity > 0.85) {
    await cacheAgencyMapping(connectionId, merchantName, bestMatch.id, 'FUZZY', bestMatch.similarity, undefined, transactionDate);
    return bestMatch.id;
  }

  // Tier 4: No match — remain unmapped (contractor flagUnmappedMerchant already handled upstream)
  return null;
}
