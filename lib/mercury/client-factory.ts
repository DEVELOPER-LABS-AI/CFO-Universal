/**
 * Mercury Client Factory
 * Handles creation of Mercury API clients with decrypted API keys
 * Uses Lambda proxy to route all calls through whitelisted static IP
 */

import { LambdaMercuryClient } from './lambda-client';
import { decryptToken } from '@/lib/xero/crypto';
import { prisma } from '@/lib/prisma';

/**
 * Get Mercury client for an organization
 * Retrieves encrypted API key from database, decrypts it, and returns configured client
 * Uses Lambda proxy for all API calls (whitelisted static IP)
 *
 * @param organizationId - Organization ID
 * @returns Configured Lambda-based Mercury API client
 * @throws Error if no active connection found or decryption fails
 */
export async function getMercuryClient(organizationId: string): Promise<LambdaMercuryClient> {
  // Find active Mercury connection for organization
  const connection = await prisma.mercuryConnection.findUnique({
    where: {
      organization_id: organizationId,
    },
    select: {
      id: true,
      api_key_encrypted: true,
      connection_status: true,
    },
  });

  if (!connection) {
    throw new Error('No Mercury connection found for this organization');
  }

  if (connection.connection_status !== 'ACTIVE') {
    throw new Error(`Mercury connection is ${connection.connection_status}. Please reconnect.`);
  }

  // Decrypt API key
  const apiKey = await decryptToken(connection.api_key_encrypted);

  if (!apiKey) {
    throw new Error('Failed to decrypt Mercury API key');
  }

  // Create and return Lambda-based Mercury client
  return new LambdaMercuryClient(apiKey);
}

/**
 * Get Mercury client from encrypted API key (for connection testing)
 * Used during initial connection setup before storing in database
 * Uses Lambda proxy for all API calls (whitelisted static IP)
 *
 * @param encryptedApiKey - Encrypted API key
 * @returns Configured Lambda-based Mercury API client
 * @throws Error if decryption fails
 */
export async function getMercuryClientFromEncryptedKey(
  encryptedApiKey: string
): Promise<LambdaMercuryClient> {
  const apiKey = await decryptToken(encryptedApiKey);

  if (!apiKey) {
    throw new Error('Failed to decrypt Mercury API key');
  }

  return new LambdaMercuryClient(apiKey);
}

/**
 * Get Mercury client from raw API key (for initial validation)
 * Used to test API key before encryption and storage
 * Uses Lambda proxy for all API calls (whitelisted static IP)
 *
 * @param apiKey - Raw unencrypted API key
 * @returns Configured Lambda-based Mercury API client
 */
export function getMercuryClientFromRawKey(apiKey: string): LambdaMercuryClient {
  return new LambdaMercuryClient(apiKey);
}
