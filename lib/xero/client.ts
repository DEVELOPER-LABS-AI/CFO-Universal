/**
 * Xero Client Initialization with Token Refresh
 *
 * Manages XeroClient instances with automatic token refresh before expiry.
 *
 * Flow:
 * 1. Load connection from database
 * 2. Check if access token expires within 5 minutes
 * 3. If expiring: use refresh token to get new access/refresh tokens
 * 4. Encrypt and store new tokens
 * 5. Return initialized XeroClient ready for API calls
 */

import { XeroClient } from 'xero-node';
import { PrismaClient } from '@prisma/client';
import { decryptToken, encryptToken } from './crypto';

const prisma = new PrismaClient();

const TOKEN_EXPIRY_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

export interface XeroClientWithTenant {
  client: XeroClient;
  tenantId: string;
  connectionId: string;
}

/**
 * Get Xero client with automatic token refresh
 *
 * @param organizationId - Organization UUID
 * @returns Initialized XeroClient with valid access token
 * @throws Error if connection not found or refresh fails
 */
export async function getXeroClientWithTokenRefresh(
  organizationId: string
): Promise<XeroClientWithTenant> {
  // Load Xero connection
  const connection = await prisma.xeroConnection.findUnique({
    where: { organization_id: organizationId },
  });

  if (!connection) {
    throw new Error('Xero connection not found for this organization');
  }

  if (connection.connection_status !== 'ACTIVE') {
    throw new Error(
      `Xero connection is ${connection.connection_status}. Cannot sync.`
    );
  }

  // Check if token expires within 5 minutes
  const now = new Date();
  const expiryDate = new Date(connection.token_expiry);
  const timeUntilExpiry = expiryDate.getTime() - now.getTime();
  const needsRefresh = timeUntilExpiry < TOKEN_EXPIRY_THRESHOLD_MS;

  // Initialize Xero client
  const xeroClient = new XeroClient({
    clientId: process.env.XERO_CLIENT_ID!,
    clientSecret: process.env.XERO_CLIENT_SECRET!,
    redirectUris: [process.env.XERO_REDIRECT_URI!],
    scopes: connection.scopes_granted,
  });

  if (needsRefresh) {
    console.log(
      `Token expires in ${Math.round(timeUntilExpiry / 1000)}s, refreshing...`
    );

    // Decrypt refresh token
    const refreshToken = await decryptToken(connection.refresh_token);

    // Initialize OAuth2 client by calling buildConsentUrl
    // This is required before calling refreshToken() in xero-node v13+
    await xeroClient.buildConsentUrl();

    // Set token set for refresh
    xeroClient.setTokenSet({
      refresh_token: refreshToken,
      access_token: '', // Not needed for refresh
      token_type: 'Bearer',
    });

    // Refresh tokens
    const newTokenSet = await xeroClient.refreshToken();

    // Encrypt new tokens
    const encryptedAccessToken = await encryptToken(newTokenSet.access_token!);
    const encryptedRefreshToken = await encryptToken(
      newTokenSet.refresh_token!
    );

    // Calculate new expiry
    const newTokenExpiry = new Date(
      Date.now() + newTokenSet.expires_in! * 1000
    );

    // Update database with new tokens
    await prisma.xeroConnection.update({
      where: { id: connection.id },
      data: {
        access_token: encryptedAccessToken,
        refresh_token: encryptedRefreshToken,
        token_expiry: newTokenExpiry,
        updated_at: new Date(),
      },
    });

    console.log('Token refreshed successfully');

    // Set new token set for client
    xeroClient.setTokenSet(newTokenSet);
  } else {
    console.log(
      `Token valid for ${Math.round(timeUntilExpiry / 1000)}s, no refresh needed`
    );

    // Decrypt access token and set token set
    const accessToken = await decryptToken(connection.access_token);

    xeroClient.setTokenSet({
      access_token: accessToken,
      refresh_token: '', // Not needed for API calls
      token_type: 'Bearer',
      expires_in: Math.floor(timeUntilExpiry / 1000),
    });
  }

  // Update tenants (Xero organization)
  await xeroClient.updateTenants();

  return {
    client: xeroClient,
    tenantId: connection.xero_tenant_id,
    connectionId: connection.id,
  };
}

/**
 * Test connection to Xero API
 *
 * @param organizationId - Organization UUID
 * @returns Organization info from Xero
 */
export async function testXeroConnection(organizationId: string) {
  const { client, tenantId } = await getXeroClientWithTokenRefresh(
    organizationId
  );

  const organisation = await client.accountingApi.getOrganisations(tenantId);

  return organisation.body.organisations?.[0];
}
