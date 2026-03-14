/**
 * Xero OAuth 2.0 Authorization Endpoint
 *
 * Initiates the OAuth flow by redirecting the user to Xero's authorization page.
 *
 * Flow:
 * 1. Get authenticated user's organization_id
 * 2. Build Xero authorization URL with required scopes (xero-node handles CSRF)
 * 3. Redirect user to Xero
 *
 * @see specs/4-xero-integration/contracts/oauth.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { XeroClient } from 'xero-node';
import { getOrganizationId } from '@/lib/auth/organization';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user's organization_id (throws on auth failure or missing org)
    const organizationId = await getOrganizationId();

    // Initialize Xero OAuth client
    const xeroClient = new XeroClient({
      clientId: process.env.XERO_CLIENT_ID!,
      clientSecret: process.env.XERO_CLIENT_SECRET!,
      redirectUris: [process.env.XERO_REDIRECT_URI!],
      scopes: 'offline_access accounting.transactions.read accounting.contacts.read accounting.settings.read'.split(' '),
    });

    // Build authorization URL (xero-node handles CSRF state internally)
    const authorizationUrl = await xeroClient.buildConsentUrl();

    // Store organization_id in session for callback
    const response = NextResponse.redirect(authorizationUrl, { status: 302 });

    response.cookies.set('xero_org_id', organizationId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Xero OAuth authorization error:', error);

    if (error instanceof Error) {
      if (error.message === 'Unauthorized' || error.message === 'Account inactive') {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }
      if (error.message === 'User is not associated with any organization') {
        return NextResponse.json(
          { error: 'User organization not found' },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to initiate OAuth flow' },
      { status: 500 }
    );
  }
}
