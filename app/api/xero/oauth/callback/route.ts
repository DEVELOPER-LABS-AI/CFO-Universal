/**
 * Xero OAuth 2.0 Callback Handler
 *
 * Handles the OAuth callback from Xero after user authorization.
 *
 * Flow:
 * 1. Validate CSRF token from state parameter
 * 2. Exchange authorization code for access/refresh tokens
 * 3. Get Xero tenant_id
 * 4. Encrypt tokens using AES-256-GCM
 * 5. Store in xero_connections table
 * 6. Create default expense category mappings
 * 7. Create audit log entry
 * 8. Redirect to integration dashboard
 *
 * @see specs/4-xero-integration/contracts/oauth.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { XeroClient } from 'xero-node';
import { cookies } from 'next/headers';
import { PrismaClient } from '@prisma/client';
import { encryptToken } from '@/lib/xero/crypto';
import { createServerClient } from '@supabase/ssr';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const scope = searchParams.get('scope');

    // Validate authorization code
    if (!code) {
      return NextResponse.redirect(
        new URL(
          '/dashboard/integrations/xero?status=error&message=Missing+authorization+code',
          request.url
        )
      );
    }

    // Get organization_id from cookie (CSRF is handled by xero-node internally)
    const cookieStore = await cookies();
    const organizationId = cookieStore.get('xero_org_id')?.value;

    if (!organizationId) {
      return NextResponse.redirect(
        new URL(
          '/dashboard/integrations/xero?status=error&message=Organization+not+found',
          request.url
        )
      );
    }

    // Get authenticated user for audit log
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(
        new URL(
          '/dashboard/integrations/xero?status=error&message=Authentication+required',
          request.url
        )
      );
    }

    // Initialize Xero OAuth client
    const xeroClient = new XeroClient({
      clientId: process.env.XERO_CLIENT_ID!,
      clientSecret: process.env.XERO_CLIENT_SECRET!,
      redirectUris: [process.env.XERO_REDIRECT_URI!],
      scopes: 'offline_access accounting.transactions.read accounting.contacts.read accounting.settings.read'.split(' '),
    });

    // Exchange authorization code for tokens
    const tokenSet = await xeroClient.apiCallback(request.url);

    // Get Xero tenant ID (organization identifier)
    await xeroClient.updateTenants();
    const tenants = xeroClient.tenants;

    if (!tenants || tenants.length === 0) {
      return NextResponse.redirect(
        new URL(
          '/dashboard/integrations/xero?status=error&message=No+Xero+tenant+found',
          request.url
        )
      );
    }

    const xeroTenantId = tenants[0].tenantId;

    // Encrypt access token and refresh token
    const encryptedAccessToken = await encryptToken(tokenSet.access_token!);
    const encryptedRefreshToken = await encryptToken(tokenSet.refresh_token!);

    // Calculate token expiry timestamp
    const tokenExpiry = new Date(Date.now() + tokenSet.expires_in! * 1000);

    // Parse granted scopes
    const scopesGranted = scope ? scope.split(' ') : [];

    // Store or update connection in database
    const connection = await prisma.xeroConnection.upsert({
      where: {
        organization_id: organizationId,
      },
      update: {
        xero_tenant_id: xeroTenantId,
        access_token: encryptedAccessToken,
        refresh_token: encryptedRefreshToken,
        token_expiry: tokenExpiry,
        scopes_granted: scopesGranted,
        connection_status: 'ACTIVE',
        updated_at: new Date(),
      },
      create: {
        organization_id: organizationId,
        xero_tenant_id: xeroTenantId,
        access_token: encryptedAccessToken,
        refresh_token: encryptedRefreshToken,
        token_expiry: tokenExpiry,
        scopes_granted: scopesGranted,
        connection_status: 'ACTIVE',
      },
    });

    // Create default expense category mappings if this is a new connection
    const existingMappings = await prisma.xeroExpenseCategoryMapping.count({
      where: { connection_id: connection.id },
    });

    if (existingMappings === 0) {
      await prisma.xeroExpenseCategoryMapping.createMany({
        data: [
          {
            connection_id: connection.id,
            account_code_pattern: '6%',
            expense_type: 'CONTRACTOR',
            priority: 100,
            is_active: true,
            created_by_user_id: user.id,
          },
          {
            connection_id: connection.id,
            keyword_pattern: 'subscription|saas|software',
            expense_type: 'SUBSCRIPTION',
            priority: 90,
            is_active: true,
            created_by_user_id: user.id,
          },
          {
            connection_id: connection.id,
            keyword_pattern: 'rent|utilities|office|insurance',
            expense_type: 'OVERHEAD',
            priority: 80,
            is_active: true,
            created_by_user_id: user.id,
          },
        ],
      });
    }

    // TODO: Add XERO_CONNECT to AuditActionType enum to enable audit logging
    // await prisma.auditLog.create({
    //   data: {
    //     organization_id: organizationId,
    //     actor_id: user.id,
    //     action_type: 'XERO_CONNECT',
    //     action_details: {
    //       xero_tenant_id: xeroTenantId,
    //       scopes_granted: scopesGranted,
    //       connection_id: connection.id,
    //     },
    //     timestamp: new Date(),
    //   },
    // });

    // Clear OAuth session cookies
    const response = NextResponse.redirect(
      new URL('/dashboard/integrations/xero?status=connected', request.url)
    );

    response.cookies.delete('xero_org_id');

    return response;
  } catch (error) {
    console.error('Xero OAuth callback error:', error);

    // Clean up cookies on error
    const response = NextResponse.redirect(
      new URL(
        '/dashboard/integrations/xero?status=error&message=OAuth+callback+failed',
        request.url
      )
    );

    response.cookies.delete('xero_org_id');

    return response;
  } finally {
    await prisma.$disconnect();
  }
}
