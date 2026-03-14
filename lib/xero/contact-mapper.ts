/**
 * Xero Contact-to-Client Mapping Service
 *
 * Implements tiered matching strategy with caching:
 * 1. Check cache (xero_contact_mappings) - O(1)
 * 2. Email exact match
 * 3. Name exact match (normalized)
 * 4. Fuzzy name match (Jaro-Winkler > 0.85)
 * 5. Return null (flag for manual mapping)
 *
 * Caches successful mappings for fast subsequent lookups.
 */

import { PrismaClient } from '@prisma/client';
import { compareTwoStrings, findBestMatch } from 'string-similarity';

const prisma = new PrismaClient();

const FUZZY_MATCH_THRESHOLD = 0.85;

export interface XeroContact {
  ContactID: string;
  Name: string;
  EmailAddress?: string;
}

export interface MappingResult {
  clientId: string | null;
  mappingType: 'EMAIL_EXACT' | 'NAME_EXACT' | 'NAME_FUZZY' | 'MANUAL' | null;
  confidenceScore: number | null;
  unmapped: boolean;
}

/**
 * Normalize name for consistent matching
 * - Lowercase
 * - Trim whitespace
 * - Remove special characters
 * - Collapse multiple spaces
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Check cache for existing mapping
 */
async function getCachedMapping(
  connectionId: string,
  xeroContactId: string
): Promise<string | null> {
  const cached = await prisma.xeroContactMapping.findUnique({
    where: {
      connection_id_xero_contact_id: {
        connection_id: connectionId,
        xero_contact_id: xeroContactId,
      },
    },
    select: { client_id: true },
  });

  return cached?.client_id || null;
}

/**
 * Find client by email (exact match)
 * Note: Client model doesn't have email field in current schema
 * This function returns null for compatibility
 */
async function findClientByEmail(
  organizationId: string,
  email: string
): Promise<string | null> {
  // Client model doesn't have email field
  // Skip email matching and rely on name matching instead
  return null;
}

/**
 * Find client by normalized name (exact match after normalization)
 */
async function findClientByNormalizedName(
  organizationId: string,
  contactName: string
): Promise<string | null> {
  const normalizedContactName = normalizeName(contactName);

  // Get all clients for this organization
  const clients = await prisma.client.findMany({
    where: {
      organization_id: organizationId,
    },
    select: {
      id: true,
      name: true,
    },
  });

  // Find exact match after normalization
  const match = clients.find(
    (client) => normalizeName(client.name) === normalizedContactName
  );

  return match?.id || null;
}

/**
 * Find clients by fuzzy name matching (Jaro-Winkler > 0.85)
 */
async function findClientsByFuzzyName(
  organizationId: string,
  contactName: string
): Promise<{ clientId: string; score: number } | null> {
  const normalizedContactName = normalizeName(contactName);

  // Get all clients for this organization
  const clients = await prisma.client.findMany({
    where: {
      organization_id: organizationId,
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (clients.length === 0) return null;

  // Build array of normalized client names
  const clientNames = clients.map((c) => normalizeName(c.name));

  // Find best match using string similarity (Jaro-Winkler)
  const bestMatch = findBestMatch(normalizedContactName, clientNames);

  if (bestMatch.bestMatch.rating >= FUZZY_MATCH_THRESHOLD) {
    const matchedClient = clients[bestMatch.bestMatchIndex];
    return {
      clientId: matchedClient.id,
      score: bestMatch.bestMatch.rating,
    };
  }

  return null;
}

/**
 * Cache a successful mapping for future lookups
 */
async function cacheMapping(
  connectionId: string,
  xeroContactId: string,
  xeroContactName: string,
  clientId: string,
  mappingType: 'EMAIL_EXACT' | 'NAME_EXACT' | 'NAME_FUZZY' | 'MANUAL',
  confidenceScore: number | null,
  mappedByUserId?: string
): Promise<void> {
  await prisma.xeroContactMapping.upsert({
    where: {
      connection_id_xero_contact_id: {
        connection_id: connectionId,
        xero_contact_id: xeroContactId,
      },
    },
    update: {
      client_id: clientId,
      mapping_type: mappingType,
      confidence_score: confidenceScore,
      mapped_by_user_id: mappedByUserId,
      updated_at: new Date(),
    },
    create: {
      connection_id: connectionId,
      xero_contact_id: xeroContactId,
      xero_contact_name: xeroContactName,
      client_id: clientId,
      mapping_type: mappingType,
      confidence_score: confidenceScore,
      mapped_by_user_id: mappedByUserId,
    },
  });
}

/**
 * Flag unmapped contact for manual admin mapping
 */
export async function flagUnmappedContact(
  connectionId: string,
  xeroContact: XeroContact
): Promise<void> {
  console.warn(
    `Unmapped contact: ${xeroContact.Name} (${xeroContact.ContactID})`
  );

  // Store unmapped contact for admin review (could be a separate table)
  // For now, we just log it. In Phase 7, we'll build UI to review these.
}

/**
 * Map Xero contact to internal client using tiered matching
 *
 * Matching strategy:
 * 1. Cache lookup (O(1))
 * 2. Email exact match (high confidence)
 * 3. Name exact match after normalization
 * 4. Fuzzy name match (Jaro-Winkler > 0.85)
 * 5. Return null (manual mapping required)
 *
 * @returns MappingResult with clientId and mapping metadata
 */
export async function mapContactToClient(
  organizationId: string,
  connectionId: string,
  xeroContact: XeroContact
): Promise<MappingResult> {
  const { ContactID, Name, EmailAddress } = xeroContact;

  // Strategy 1: Check cache
  const cachedClientId = await getCachedMapping(connectionId, ContactID);
  if (cachedClientId) {
    return {
      clientId: cachedClientId,
      mappingType: null, // Already cached, no need to update
      confidenceScore: null,
      unmapped: false,
    };
  }

  // Strategy 2: Email exact match
  if (EmailAddress) {
    const clientId = await findClientByEmail(organizationId, EmailAddress);
    if (clientId) {
      await cacheMapping(
        connectionId,
        ContactID,
        Name,
        clientId,
        'EMAIL_EXACT',
        1.0
      );
      return {
        clientId,
        mappingType: 'EMAIL_EXACT',
        confidenceScore: 1.0,
        unmapped: false,
      };
    }
  }

  // Strategy 3: Name exact match (after normalization)
  const exactNameClientId = await findClientByNormalizedName(
    organizationId,
    Name
  );
  if (exactNameClientId) {
    await cacheMapping(
      connectionId,
      ContactID,
      Name,
      exactNameClientId,
      'NAME_EXACT',
      1.0
    );
    return {
      clientId: exactNameClientId,
      mappingType: 'NAME_EXACT',
      confidenceScore: 1.0,
      unmapped: false,
    };
  }

  // Strategy 4: Fuzzy name match
  const fuzzyMatch = await findClientsByFuzzyName(organizationId, Name);
  if (fuzzyMatch) {
    await cacheMapping(
      connectionId,
      ContactID,
      Name,
      fuzzyMatch.clientId,
      'NAME_FUZZY',
      fuzzyMatch.score
    );
    return {
      clientId: fuzzyMatch.clientId,
      mappingType: 'NAME_FUZZY',
      confidenceScore: fuzzyMatch.score,
      unmapped: false,
    };
  }

  // Strategy 5: No match found - flag for manual mapping
  await flagUnmappedContact(connectionId, xeroContact);

  return {
    clientId: null,
    mappingType: null,
    confidenceScore: null,
    unmapped: true,
  };
}
